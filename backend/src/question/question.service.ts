import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual, Like, ArrayContains } from 'typeorm';
import { Question, AuditLog, Notification } from '../database/entities';
import { QuestionStatus, MediaType, AuditAction, ActorType, Season, VerificationStatus } from '../common/enums';
import { NotificationType, NotificationTriggerType } from '../database/entities/notification.entity';
import { SubmitQuestionDto, SubmitQuestionResponseDto, PreviewQuestionDto } from './dto/submit-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { DOMAINS } from './constants/domains';
import { UserService } from '../user/user.service';
import { AdminService } from '../admin/admin.service';
import { StorageService } from '../storage/storage.service';
import { GemmaService } from '../ai/gemma.service';
import { GdbService } from '../ai/gdb.service';
import { EmbedService } from '../ai/embed.service';
import { DuplicateDetectionService } from '../cache/duplicate-detection.service';
import { AnalyticsCacheService } from '../cache/analytics-cache.service';
import { HotDataService } from '../cache/hot-data.service';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly dataSource: DataSource,
    private readonly adminService: AdminService,
    private readonly userService: UserService,
    private readonly storageService: StorageService,
    private readonly gemmaService: GemmaService,
    private readonly gdbService: GdbService,
    private readonly embedService: EmbedService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly analyticsCacheService: AnalyticsCacheService,
    private readonly hotDataService: HotDataService,
  ) {}

  // ─── Submit ──────────────────────────────────────────────────────────────────

  /** Derives agro-climatic zone from state. Mirrors mobile/src/utils/agro-climatic-zones.ts */
  private deriveAgroClimaticZone(state: string): string {
    const s = state.toLowerCase().trim();
    if (
      s === 'jammu & kashmir' ||
      s === 'ladakh' ||
      s === 'himachal pradesh' ||
      s === 'uttarakhand'
    ) return 'western_himalayan';
    if (
      s === 'assam' ||
      s === 'sikkim' ||
      s === 'nagaland' ||
      s === 'meghalaya' ||
      s === 'manipur' ||
      s === 'tripura' ||
      s === 'mizoram' ||
      s === 'arunachal pradesh'
    ) return 'eastern_himalayan';
    if (s === 'west bengal' || s === 'odisha') return 'lower_gangetic_plain';
    if (s === 'bihar' || s === 'jharkhand') return 'middle_gangetic_plain';
    if (s === 'uttar pradesh') return 'upper_gangetic_plain';
    if (s === 'punjab' || s === 'haryana' || s === 'delhi' || s === 'chandigarh') return 'trans_gangetic_plain';
    if (s === 'maharashtra' || s === 'chhattisgarh' || s === 'madhya pradesh') return 'eastern_plateau_and_hills';
    if (s === 'rajasthan' || s === 'gujarat') return 'central_plateau_and_hills';
    if (s === 'karnataka') return 'karnataka_plain_and_lcms';
    if (s === 'tamil nadu' || s === 'puducherry') return 'coastal_andhra_and_karnataka';
    if (s === 'andhra pradesh' || s === 'telangana') return 'krishna_godavari_delta';
    if (s === 'kerala') return 'western_ghats_and_coastal_kerala';
    return 'other';
  }

  async submit(userId: string, dto: SubmitQuestionDto): Promise<SubmitQuestionResponseDto> {
    console.log('[SUBMIT DEBUG] dto.state=', dto.state, '| dto.district=', dto.district, '| dto.block=', dto.block);
    // 0. User must be verified to submit questions
    const user = await this.userService.getProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Your account has not been verified by an admin yet. You can submit questions only after verification.',
      );
    }

    // 1. Enforce live config: daily_question_limit + question_edit_window_seconds
    const [dailyLimit, editWindowSec] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.adminService.getConfigValue('question_edit_window_seconds'),
    ]);
    await this.checkDailyLimit(userId, dailyLimit);

    // 2. Validate image submission: when mediaType is 'image' exactly 1 URL is required
    if (dto.mediaType === 'image') {
      if (!dto.mediaUrls || dto.mediaUrls.length === 0) {
        throw new BadRequestException(
          'An image URL is required when mediaType is "image". Upload the image via POST /storage/upload first.',
        );
      }
      if (dto.mediaUrls.length > 1) {
        throw new BadRequestException('At most 1 image is allowed per question');
      }
      const url = dto.mediaUrls[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new BadRequestException('mediaUrls must be valid HTTP(S) URLs');
      }
    }

    const now = new Date();
    const editWindowClosesAt = new Date(now.getTime() + editWindowSec * 1000);

    // 3. Infer crop + domains via Gemma (re-infer at submit time for the final question text)
    const inferred = await this.gemmaService.inferCropAndDomains(dto.questionText);
    const cropType = dto.cropType?.trim() || inferred.crop;
    const domains  = dto.domains?.length  ? dto.domains  : inferred.domains;

    // 4. Fast exact-duplicate gate via Redis — throws ConflictException (HTTP 409) if exact dup found.
    //    cropType must be resolved above first.
    const userIdNum = parseInt(userId, 10);
    await this.duplicateDetectionService.checkDuplicate(
      userIdNum,
      dto.state ?? '',
      cropType,
      dto.questionText,
    );

    // 4b. GDB semantic duplicate check — run before saving so we can return early with
    //     the matched Q&A pair for the mobile app to display instead of blocking silently.
    const duplicateResult = await this.gdbService.checkDuplicate({
      questionText: dto.questionText,
      crop: cropType,
      state: dto.state ?? '',
    });
    if (duplicateResult.isDuplicate) {
      return {
        id: '',
        status: 'DUPLICATE',
        editWindowClosesAt: new Date().toISOString(),
        message: 'Similar question found',
        duplicate: {
          isDuplicate: true,
          matchedQuestionId: duplicateResult.matchedQuestionId,
          matchedQuestion: duplicateResult.matchedQuestion,
          matchedAnswer: duplicateResult.matchedAnswer,
          similarityScore: duplicateResult.similarityScore,
        },
      };
    }

    // 5. Record in Redis dup index (only after all duplicate checks pass).
    await this.duplicateDetectionService.recordQuestion(
      userIdNum,
      dto.state ?? '',
      cropType,
      dto.questionText,
    );

    // 6. Update real-time analytics counters
    await this.analyticsCacheService.onQuestionSubmitted().catch(() => {/* best-effort */});

    // 7. Derive agro-climatic zone from state when not provided
    const agroClimaticZone = dto.agroClimaticZone ?? this.deriveAgroClimaticZone(dto.state ?? '');

    // 8. Low-confidence submissions go to human review
    const status: QuestionStatus = inferred.confidence < 0.9
      ? QuestionStatus.HUMAN_REVIEW
      : QuestionStatus.PENDING;

    // 7. Validate domains against allowed list
    const invalidDomains = dto.domains.filter((d) => !DOMAINS.includes(d as any));
    if (invalidDomains.length > 0) {
      throw new BadRequestException(`Invalid domains: ${invalidDomains.join(', ')}`);
    }

    // 8. Fetch embedding for the question text
    const [embedding] = await Promise.all([
      this.embedService.embed(dto.questionText),
    ]);

    // 9. Persist question in a transaction
    const question = this.questionRepo.create({
      userId,
      domains,
      season: dto.season,
      cropType,
      agroClimaticZone,
      questionText: dto.questionText,
      state: dto.state ?? '',
      district: dto.district ?? '',
      block: dto.block ?? null,
      mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
      mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
      deviceInfo: dto.deviceInfo ?? null,
      status,
      editWindowClosesAt,
      submittedAt: now,
      embedding,
    });

    const saved = await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(Question);
      return repo.save(question) as Promise<Question>;
    });

    // 10. Audit log
    await this.auditRepo.save({
      actorType: ActorType.USER,
      actorId: userId,
      action: AuditAction.QUESTION_SUBMITTED,
      entityType: 'question',
      entityId: saved.id,
      newValue: { status: saved.status, domains: saved.domains },
      metadata: { cropType: saved.cropType, season: saved.season },
    });

    // 11. Send semantic-duplicate notification after saving (Redis exact-dup throws before this)
    if (duplicateResult.isDuplicate) {
      await this.notifRepo.save(
        this.notifRepo.create({
          userId,
          type: NotificationType.DUPLICATE_QUESTION,
          title: 'Similar Question Found',
          body: `Your question "${dto.questionText.slice(0, 80)}" was flagged as similar to an existing question.`,
          data: {
            questionId: saved.id,
            matchedQuestionId: duplicateResult.matchedQuestionId,
            similarityScore: duplicateResult.similarityScore,
          },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
    }

    return {
      id: saved.id,
      status: saved.status,
      editWindowClosesAt: editWindowClosesAt.toISOString(),
      message: duplicateResult.isDuplicate ? 'Duplicate question flagged' : 'Question submitted successfully',
    };
  }

  // ─── Update (edit window only) ──────────────────────────────────────────────

  async update(userId: string, questionId: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });

    if (!question) throw new NotFoundException('Question not found');
    if (question.userId !== userId) throw new ForbiddenException('Not your question');
    if (question.editWindowClosesAt && new Date() > question.editWindowClosesAt) {
      throw new BadRequestException('Edit window has closed');
    }

    const oldValue = {
      questionText: question.questionText,
      domains: question.domains,
      season: question.season,
      cropType: question.cropType,
      mediaType: question.mediaType,
      mediaUrls: question.mediaUrls,
    };

    // Apply updates
    if (dto.questionText !== undefined) question.questionText = dto.questionText;
    if (dto.domains !== undefined) {
      const invalidDomains = dto.domains.filter((d) => !DOMAINS.includes(d as any));
      if (invalidDomains.length > 0) {
        throw new BadRequestException(`Invalid domains: ${invalidDomains.join(', ')}`);
      }
      question.domains = dto.domains;
    }
    if (dto.season !== undefined) question.season = dto.season;
    if (dto.cropType !== undefined) question.cropType = dto.cropType;
    if (dto.mediaType !== undefined) question.mediaType = dto.mediaType as MediaType;
    if (dto.mediaUrls !== undefined) question.mediaUrls = dto.mediaUrls;

    const saved = await this.questionRepo.save(question);

    await this.auditRepo.save({
      actorType: ActorType.USER,
      actorId: userId,
      action: 'question_edited',
      entityType: 'question',
      entityId: questionId,
      oldValue,
      newValue: {
        questionText: saved.questionText,
        domains: saved.domains,
        season: saved.season,
        cropType: saved.cropType,
        mediaType: saved.mediaType,
        mediaUrls: saved.mediaUrls,
      },
    });

    return saved;
  }

  // ─── Get single ─────────────────────────────────────────────────────────────

  async findOne(id: string, userId?: string): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    // Non-owners can only see approved questions (or own questions)
    if (userId && question.userId !== userId && question.status !== QuestionStatus.APPROVED) {
      throw new ForbiddenException('Question not available');
    }
    return question;
  }

  // ─── List ───────────────────────────────────────────────────────────────────

  async list(userId: string, dto: ListQuestionsDto, isAdmin = false) {
    const { page = 1, limit = 20, status, domains, cropType, season, state, search, fromDate, toDate } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (isAdmin) {
      // Admin can filter by any status
      if (status) where.status = status;
    } else {
      // Users see only their own questions
      where.userId = userId;
      // If status filter given, apply it; otherwise default to own questions
      if (status) where.status = status;
    }

    // Filter by a single domain string — matches any question that has that domain in its array
    if (domains) where.domains = ArrayContains([domains]);
    if (search) where.cropType = Like(`%${search}%`);
    else if (cropType) where.cropType = Like(`%${cropType}%`);
    if (season) where.season = season;
    if (state) where.state = state;

    if (fromDate && toDate) {
      where.submittedAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.submittedAt = MoreThanOrEqual(new Date(fromDate));
    } else if (toDate) {
      where.submittedAt = LessThanOrEqual(new Date(toDate));
    }

    const [items, total] = await this.questionRepo.findAndCount({
      where,
      relations: { user: true, reviewer: true },
      order: { submittedAt: 'DESC' },
      skip,
      take: limit,
      select: [
        'id', 'domains', 'season', 'cropType', 'questionText',
        'mediaType', 'mediaUrls', 'status', 'duplicateFlag',
        'submittedAt', 'reviewedAt', 'rejectionReason', 'heldReason', 'approvalReason',
        'state', 'district', 'block', 'language',
        'editWindowClosesAt', 'createdAt',
      ],
    });

    return {
      items: items.map((q) => ({
        ...q,
        reviewedByName: (q as any).reviewer?.name ?? null,
      })),
      total, page, limit, pages: Math.ceil(total / limit),
    };
  }

  // ─── Admin: approve / reject ────────────────────────────────────────────────

  async approve(questionId: string, reviewerId: string, reason?: string): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    question.status = QuestionStatus.APPROVED;
    question.reviewedAt = new Date();
    question.reviewerId = reviewerId;
    question.approvalReason = reason ?? null;

    const saved = await this.questionRepo.save(question);

    await this.auditRepo.save({
      actorType: ActorType.ADMIN,
      actorId: reviewerId,
      action: AuditAction.QUESTION_APPROVED,
      entityType: 'question',
      entityId: questionId,
      oldValue: { status: question.status },
      newValue: { status: saved.status },
    });

    return saved;
  }

  async reject(questionId: string, reviewerId: string, reason: string): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    question.status = QuestionStatus.REJECTED;
    question.reviewedAt = new Date();
    question.reviewerId = reviewerId;
    question.rejectionReason = reason;

    const saved = await this.questionRepo.save(question);

    await this.auditRepo.save({
      actorType: ActorType.ADMIN,
      actorId: reviewerId,
      action: AuditAction.QUESTION_REJECTED,
      entityType: 'question',
      entityId: questionId,
      oldValue: { status: question.status },
      newValue: { status: saved.status, rejectionReason: reason },
    });

    return saved;
  }

  // ─── Get daily count ────────────────────────────────────────────────────────

  async getDailyCount(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.questionRepo.count({
      where: {
        userId,
        submittedAt: MoreThanOrEqual(startOfDay),
      },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async checkDailyLimit(userId: string, dailyLimit: number): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await this.questionRepo.count({
      where: { userId, submittedAt: MoreThanOrEqual(startOfDay) },
    });

    if (count >= dailyLimit) {
      throw new BadRequestException(
        `Daily limit of ${dailyLimit} questions reached. Please try again tomorrow.`,
      );
    }
  }

  async getLimits() {
    const [dailyLimit, editWindowSec, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars, maxImageSizeMb] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.adminService.getConfigValue('question_edit_window_seconds'),
      this.adminService.getConfigValue('video_max_size_mb'),
      this.adminService.getConfigValue('video_max_duration_seconds'),
      this.adminService.getConfigValue('max_question_chars'),
      this.adminService.getConfigValue('max_image_size_mb'),
    ]);
    return { dailyLimit, editWindowSec, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars, maxImageSizeMb };
  }

  // ─── Preview ────────────────────────────────────────────────────────────────

  /**
   * Validates the step-1 payload and returns enriched field values.
   * Does NOT write anything to the database.
   *
   * - Location (state, district, block) comes from the user's profile.
   * - domains / cropType come from Gemma inference.
   * - season is derived from the current month.
   * - agroClimaticZone is derived from the user's state.
   * - suggestedDistricts / suggestedBlocks come from the LGD master-data service.
   */
  async preview(userId: string, dto: PreviewQuestionDto) {
    // 1. Load user profile for location
    const user = await this.userService.getProfile(userId);
    if (!user) throw new NotFoundException('User not found');

    const { state, district, block } = user;

    // 2. Gemma inference: domains + cropType  (run first so we have crop for GDB call)
    const inferred = await this.gemmaService.inferCropAndDomains(dto.questionText);

    // 3. Check for semantically similar questions via GDB semantic search
    //    If a match above the similarity threshold is found, the response carries
    //    the matched question + answer so the mobile app can show it to the user.
    const duplicateResult = await this.gdbService.checkDuplicate({
      questionText: dto.questionText,
      crop: inferred.crop,
      state,
    });

    // 4. Derive season from current month (India-centric calendar)
    const season = deriveSeasonFromMonth(new Date().getMonth()); // 0-indexed

    // 5. Derive agro-climatic zone from state
    const agroClimaticZone = this.deriveAgroClimaticZone(state);

    // 6. Daily-limit counters
    const [dailyLimit, dailyCount] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.getDailyCount(userId),
    ]);

    return {
      state,
      district,
      block: block ?? null,

      // Pre-filled from Gemma inference; user can modify on the preview screen
      domains: inferred.domains,
      cropType: inferred.crop,
      season,

      questionText: dto.questionText,
      mediaType: dto.mediaType ?? 'none',
      mediaUrls: dto.mediaUrls ?? [],

      agroClimaticZone,
      suggestedDistricts: [],   // populated from user profile; no LGD lookup needed for preview
      suggestedBlocks: [],

      remainingToday: Math.max(0, dailyLimit - dailyCount),
      dailyLimit,

      // Duplicate-check result — present when GDB found a similar question
      duplicate: duplicateResult,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the agricultural season from a 0-indexed month number (JavaScript convention).
 * India-centric calendar:
 *   Kharif  — June through October  (months 5–9)
 *   Rabi    — November through March (months 10, 11, 0, 1, 2)
 *   Zaid    — April through May       (months 3, 4)
 * Pre/Post-Kharif and Pre-Rabi are used as sub-seasons around the main windows.
 */

function deriveSeasonFromMonth(month: number): Season {
  if (month >= 5 && month <= 9)  return Season.KHARIF;   // Jun–Oct  (sown Jun, harvested Oct–Nov)
  if (month === 10 || month === 11 || month >= 0 && month <= 2) return Season.RABI; // Nov–Mar
  if (month === 3 || month === 4) return Season.ZAID;    // Apr–May
  return Season.RABI; // fallback (never reached with valid 0–11 input)
}


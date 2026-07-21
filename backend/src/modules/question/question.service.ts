import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual, Like, ArrayContains } from 'typeorm';
import { Question, AuditLog, Notification } from '../../shared/database/entities';
import { QuestionStatus, MediaType, AuditAction, ActorType, Season, VerificationStatus } from '../../shared/classes/enums';
import { NotificationType, NotificationTriggerType } from '../../shared/database/entities/notification.entity';
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
import { DuplicateDetectionService } from '../../shared/database/cache/duplicate-detection.service';
import { AnalyticsCacheService } from '../../shared/database/cache/analytics-cache.service';
import { HotDataService } from '../../shared/database/cache/hot-data.service';

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

  // ─── Exact Duplicate Check (Our DB) ────────────────────────────────────────

  /**
   * Checks whether an exact (case-insensitive, trimmed) copy of the questionText
   * already exists in our own question collection, submitted by any user.
   *
   * Runs before the GDB semantic check so we can return a human-readable
   * "submitted by {name}" message when we already have the exact question.
   *
   * Returns null if no exact match found.
   * Returns the matched question with its submitter's display name if found.
   */
  private async findExactDuplicate(
    questionText: string,
    userId: string,
  ): Promise<{ matchedQuestion: Question; matchedUserName: string | null } | null> {
    const normalized = questionText.trim().toLowerCase();
    const existing = await this.questionRepo
      .createQueryBuilder('q')
      .innerJoinAndSelect('q.user', 'u')
      .where('LOWER(TRIM(q.question_text)) = :normalized', { normalized })
      .andWhere('q.user_id != :userId', { userId })
      .orderBy('q.submittedAt', 'DESC')
      .getOne();

    if (!existing) return null;

    // Resolve submitter name: prefer username > name > mobileNumber (masked)
    let displayName: string | null = 'user name not available';
    if (existing.user) {
      if (existing.user.username) {
        displayName = existing.user.username;
      } else if (existing.user.name && existing.user.name.trim()) {
        displayName = existing.user.name.trim();
      } else if (existing.user.mobileNumber) {
        displayName = this.maskMobile(existing.user.mobileNumber);
      }
    }

    return { matchedQuestion: existing, matchedUserName: displayName };
  }

  private maskMobile(mobile: string): string {
    // Show only last 4 digits: +91****7654
    const digits = mobile.replace(/\D/g, '');
    return digits.length >= 4
      ? `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`
      : mobile;
  }

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
    // 0. User must be verified and location must be set in profile
    const user = await this.userService.getProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.state || !user.district) {
      throw new BadRequestException(
        'Your profile is missing state or district. Please update your profile before submitting a question.',
      );
    }
    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Your account has not been verified by an admin yet. You can submit questions only after verification.',
      );
    }

    // 1. Enforce daily_question_limit
    const dailyLimit = await this.adminService.getConfigValue('daily_question_limit');
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

    // 2. Infer crop + domains via Gemma (re-infer at submit time for the final question text)
    const inferred = await this.gemmaService.inferCropAndDomains(dto.questionText);
    const cropType = dto.cropType?.trim() || inferred.crop;
    const domains  = dto.domains?.length  ? dto.domains  : inferred.domains;

    // 4. Fast exact-duplicate gate via Redis — throws ConflictException (HTTP 409) if exact dup found.
    //    cropType must be resolved above first.
    const userIdNum = parseInt(userId, 10);
    await this.duplicateDetectionService.checkDuplicate(
      userIdNum,
      user.state,
      cropType,
      dto.questionText,
    );

    // 4b. Check our own DB first — exact text match (case-insensitive, trimmed).
    //     If found, we already know the submitter and can show a user-friendly message
    //     ("submitted by rakesh_farmer42") without needing the GDB semantic check.
    const dbDup = await this.findExactDuplicate(dto.questionText, userId);
    if (dbDup) {
      const dup = dbDup.matchedQuestion;
      let duplicateQuestion = this.questionRepo.create({
        userId,
        domains,
        season: dto.season,
        cropType,
        agroClimaticZone: dto.agroClimaticZone ?? this.deriveAgroClimaticZone(user.state),
        questionText: dto.questionText,
        state: user.state,
        district: user.district,
        block: user.block ?? null,
        mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
        mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
        deviceInfo: dto.deviceInfo ?? null,
        status: QuestionStatus.REJECTED,
        rejectionReason: `Question already submitted by ${dbDup.matchedUserName ?? 'another user'} in our database`,
        submittedAt: now,
        embedding: [0],
      });
      duplicateQuestion = await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(Question);
        return repo.save(duplicateQuestion) as Promise<Question>;
      });
      await this.auditRepo.save({
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: duplicateQuestion.id,
        newValue: { status: QuestionStatus.REJECTED, reason: 'DUPLICATE' },
        metadata: { duplicateQuestionId: duplicateQuestion.id, matchedQuestionId: dup.id },
      });
      return {
        id: duplicateQuestion.id,
        status: 'DUPLICATE',
        message: 'This question already exists in our database',
        duplicate: {
          isDuplicate: true,
          matchedQuestionId: dup.id,
          matchedQuestion: dup.questionText,
          matchedAnswer: null,
          similarityScore: null,
          matchedUserName: dbDup.matchedUserName,
        },
      };
    }

    // 4c. GDB semantic duplicate check — run after our DB check; may add additional
    //     context (matchedAnswer, similarityScore) if GDB has a confident match.
    const duplicateResult = await this.gdbService.checkDuplicate({
      questionText: dto.questionText,
      crop: cropType,
      state: user.state,
    });

    // Derive agro-climatic zone from user's profile state.
    const agroClimaticZone = dto.agroClimaticZone ?? this.deriveAgroClimaticZone(user.state);

    // Fetch embedding upfront — needed regardless of which branch we take below.
    const [embedding] = await Promise.all([
      this.embedService.embed(dto.questionText),
    ]);

    if (duplicateResult.isDuplicate) {
      // Save the question as REJECTED so it counts as a submission against the daily limit,
      // then return the matched Q&A pair so the mobile can display DuplicateFoundModal.
      const dup = duplicateResult as { isDuplicate: true; matchedQuestionId: string | null; matchedQuestion: string | null; matchedAnswer: string | null; similarityScore: number | null; matchedUserName: string | null };
      let duplicateQuestion = this.questionRepo.create({
        userId,
        domains,
        season: dto.season,
        cropType,
        agroClimaticZone,
        questionText: dto.questionText,
        state: user.state,
        district: user.district,
        block: user.block ?? null,
        mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
        mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
        deviceInfo: dto.deviceInfo ?? null,
        status: QuestionStatus.REJECTED,
        rejectionReason: `Question already answered by ${dup.matchedUserName ?? 'another user'} in our knowledge base`,
        submittedAt: now,
        embedding: [0], // zero embedding — saved to satisfy FK, not for search
      });
      // Capture the saved entity so we have its ID for audit metadata.
      duplicateQuestion = await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(Question);
        return repo.save(duplicateQuestion) as Promise<Question>;
      });
      await this.auditRepo.save({
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: duplicateQuestion.id,
        newValue: { status: QuestionStatus.REJECTED, reason: 'DUPLICATE' },
        metadata: { duplicateQuestionId: duplicateQuestion.id, matchedQuestionId: dup.matchedQuestionId },
      });
      return {
        id: duplicateQuestion.id,
        status: 'DUPLICATE',
        message: 'Similar question found',
        duplicate: {
          isDuplicate: true,
          matchedQuestionId: dup.matchedQuestionId,
          matchedQuestion: dup.matchedQuestion,
          matchedAnswer: dup.matchedAnswer,
          similarityScore: dup.similarityScore,
          matchedUserName: dup.matchedUserName ?? 'user name not available',
        },
      };
    }

    // 5. Record in Redis dup index (only after all duplicate checks pass).
    await this.duplicateDetectionService.recordQuestion(
      userIdNum,
      user.state,
      cropType,
      dto.questionText,
    );

    // 6. Update real-time analytics counters
    await this.analyticsCacheService.onQuestionSubmitted().catch(() => {/* best-effort */});

    // 7. Low-confidence submissions go to human review
    const status: QuestionStatus = inferred.confidence < 0.9
      ? QuestionStatus.HUMAN_REVIEW
      : QuestionStatus.PENDING;

    // 7. Validate domains against allowed list
    const invalidDomains = dto.domains.filter((d) => !DOMAINS.includes(d as any));
    if (invalidDomains.length > 0) {
      throw new BadRequestException(`Invalid domains: ${invalidDomains.join(', ')}`);
    }

    // 8. Persist question in a transaction
    const question = this.questionRepo.create({
      userId,
      domains,
      season: dto.season,
      cropType,
      agroClimaticZone,
      questionText: dto.questionText,
      state: user.state,
      district: user.district,
      block: user.block ?? null,
      mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
      mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
      deviceInfo: dto.deviceInfo ?? null,
      status,
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

    return {
      id: saved.id,
      status: saved.status,
      message: 'Question submitted successfully',
    };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(userId: string, questionId: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });

    if (!question) throw new NotFoundException('Question not found');
    if (question.userId !== userId) throw new ForbiddenException('Not your question');
    throw new ForbiddenException('Question editing is no longer available');
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
        'createdAt',
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

  async getApprovedCount(userId: string): Promise<number> {
    return this.questionRepo.count({ where: { userId, status: QuestionStatus.APPROVED } });
  }

  async getLimits() {
    const [dailyLimit, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars, maxImageSizeMb] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.adminService.getConfigValue('video_max_size_mb'),
      this.adminService.getConfigValue('video_max_duration_seconds'),
      this.adminService.getConfigValue('max_question_chars'),
      this.adminService.getConfigValue('max_image_size_mb'),
    ]);
    return { dailyLimit, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars, maxImageSizeMb };
  }

  // ─── Preview ────────────────────────────────────────────────────────────────

  /**
   * Validates the step-1 payload and returns enriched field values.
   *
   * - Location (state, district, block) comes from the user's profile.
   * - domains / cropType come from Gemma inference.
   * - season is derived from the current month.
   * - agroClimaticZone is derived from the user's state.
   * - suggestedDistricts / suggestedBlocks come from the LGD master-data service.
   *
   * When GDB finds a semantic duplicate, the question is immediately saved as
   * REJECTED (counting against the daily limit) so the user sees the result
   * without needing a separate submit call.
   */
  async preview(userId: string, dto: PreviewQuestionDto) {
    // 1. Load user profile for location
    const user = await this.userService.getProfile(userId);
    if (!user) throw new NotFoundException('User not found');

    const { state, district, block } = user;

    // 2. Gemma inference: domains + cropType  (run first so we have crop for GDB call)
    const inferred = await this.gemmaService.inferCropAndDomains(dto.questionText);

    // 3. Check our own DB first — exact text match (case-insensitive, trimmed).
    //     Preferred over GDB because we know the exact submitter's display name.
    const dbDup = await this.findExactDuplicate(dto.questionText, userId);

    // 4. GDB semantic search runs second — may add matchedAnswer + similarityScore
    //    if GDB has a confident match beyond what our DB found.
    const gdbDup = await this.gdbService.checkDuplicate({
      questionText: dto.questionText,
      crop: inferred.crop,
      state,
    });

    // 5. Derive season from current month (India-centric calendar)
    const season = deriveSeasonFromMonth(new Date().getMonth()); // 0-indexed

    // 6. Derive agro-climatic zone from state
    const agroClimaticZone = this.deriveAgroClimaticZone(state);

    // 7. Daily-limit counters
    const [dailyLimit, dailyCount] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.getDailyCount(userId),
    ]);

    // 8. If our DB found an exact match: save as REJECTED (counts as a submission)
    //    and return immediately with the submitter's display name.
    if (dbDup) {
      const dup = dbDup.matchedQuestion;
      const now = new Date();

      let duplicateQuestion = this.questionRepo.create({
        userId,
        domains: inferred.domains,
        season,
        cropType: inferred.crop,
        agroClimaticZone,
        questionText: dto.questionText,
        state,
        district,
        block: block ?? null,
        mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
        mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
        status: QuestionStatus.REJECTED,
        rejectionReason: `Question already submitted by ${dbDup.matchedUserName ?? 'another user'} in our database`,
        submittedAt: now,
        embedding: [0], // zero embedding — saved to satisfy FK, not for search
      });
      duplicateQuestion = await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(Question);
        return repo.save(duplicateQuestion) as Promise<Question>;
      });
      await this.auditRepo.save({
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: duplicateQuestion.id,
        newValue: { status: QuestionStatus.REJECTED, reason: 'DUPLICATE' },
        metadata: { duplicateQuestionId: duplicateQuestion.id, matchedQuestionId: dup.id },
      });

      return {
        state,
        district,
        block: block ?? null,
        domains: inferred.domains,
        cropType: inferred.crop,
        season,
        questionText: dto.questionText,
        mediaType: dto.mediaType ?? 'none',
        mediaUrls: dto.mediaUrls ?? [],
        agroClimaticZone,
        suggestedDistricts: [],
        suggestedBlocks: [],
        remainingToday: Math.max(0, dailyLimit - dailyCount - 1),
        dailyLimit,
        duplicate: {
          isDuplicate: true,
          matchedQuestionId: dup.id,
          matchedQuestion: dup.questionText,
          matchedAnswer: null,
          similarityScore: null,
          matchedUserName: dbDup.matchedUserName,
          submissionStatus: 'rejected' as const,
        },
      };
    }

    // 9. If GDB found a semantic duplicate: save as REJECTED and return with its
    //    matchedAnswer + similarityScore (may have a better answer than our DB).
    if (gdbDup.isDuplicate) {
      const dup = gdbDup as {
        isDuplicate: true;
        matchedQuestionId: string | null;
        matchedQuestion: string | null;
        matchedAnswer: string | null;
        similarityScore: number | null;
        matchedUserName: string | null;
      };
      const now = new Date();

      let duplicateQuestion = this.questionRepo.create({
        userId,
        domains: inferred.domains,
        season,
        cropType: inferred.crop,
        agroClimaticZone,
        questionText: dto.questionText,
        state,
        district,
        block: block ?? null,
        mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
        mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
        status: QuestionStatus.REJECTED,
        rejectionReason: `Question already answered by ${dup.matchedUserName ?? 'another user'} in our knowledge base`,
        submittedAt: now,
        embedding: [0], // zero embedding — saved to satisfy FK, not for search
      });
      duplicateQuestion = await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(Question);
        return repo.save(duplicateQuestion) as Promise<Question>;
      });
      await this.auditRepo.save({
        actorType: ActorType.USER,
        actorId: userId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: duplicateQuestion.id,
        newValue: { status: QuestionStatus.REJECTED, reason: 'DUPLICATE' },
        metadata: { duplicateQuestionId: duplicateQuestion.id, matchedQuestionId: dup.matchedQuestionId },
      });

      return {
        state,
        district,
        block: block ?? null,
        domains: inferred.domains,
        cropType: inferred.crop,
        season,
        questionText: dto.questionText,
        mediaType: dto.mediaType ?? 'none',
        mediaUrls: dto.mediaUrls ?? [],
        agroClimaticZone,
        suggestedDistricts: [],
        suggestedBlocks: [],
        remainingToday: Math.max(0, dailyLimit - dailyCount - 1),
        dailyLimit,
        duplicate: {
          isDuplicate: true,
          matchedQuestionId: dup.matchedQuestionId,
          matchedQuestion: dup.matchedQuestion,
          matchedAnswer: dup.matchedAnswer,
          similarityScore: dup.similarityScore,
          matchedUserName: dup.matchedUserName ?? 'user name not available',
          submissionStatus: 'rejected' as const,
        },
      };
    }

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
      suggestedDistricts: [],
      suggestedBlocks: [],

      remainingToday: Math.max(0, dailyLimit - dailyCount),
      dailyLimit,

      // No duplicate found — pass through for normal preview flow
      duplicate: gdbDup,
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


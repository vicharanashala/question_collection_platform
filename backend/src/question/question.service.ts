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
import { DOMAINS, inferDomains } from './constants/domains';
import { UserService } from '../user/user.service';
import { AdminService } from '../admin/admin.service';
import { StorageService } from '../storage/storage.service';

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

    // 3. Check for exact-duplicate question
    const existingDuplicate = await this.questionRepo.findOne({
      where: { questionText: dto.questionText },
      select: ['id'],
    });
    const isDuplicate = !!existingDuplicate;

    // 4. Derive agro-climatic zone from state when not provided
    const agroClimaticZone = dto.agroClimaticZone ?? this.deriveAgroClimaticZone(dto.state ?? '');

    // 5. Validate domains against allowed list
    const invalidDomains = dto.domains.filter((d) => !DOMAINS.includes(d as any));
    if (invalidDomains.length > 0) {
      throw new BadRequestException(`Invalid domains: ${invalidDomains.join(', ')}`);
    }

    // 6. Persist question in a transaction
    const question = this.questionRepo.create({
      userId,
      domains: dto.domains,
      season: dto.season,
      cropType: dto.cropType,
      agroClimaticZone,
      questionText: dto.questionText,
      state: dto.state ?? '',
      district: dto.district ?? '',
      block: dto.block ?? null,
      mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
      mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
      deviceInfo: dto.deviceInfo ?? null,
      status: isDuplicate ? QuestionStatus.REJECTED : QuestionStatus.PENDING,
      editWindowClosesAt,
      submittedAt: now,
    });

    const saved = await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(Question);
      return repo.save(question) as Promise<Question>;
    });

    // 7. Audit log
    await this.auditRepo.save({
      actorType: ActorType.USER,
      actorId: userId,
      action: AuditAction.QUESTION_SUBMITTED,
      entityType: 'question',
      entityId: saved.id,
      newValue: { status: saved.status, domains: saved.domains },
      metadata: { cropType: saved.cropType, season: saved.season },
    });

    // 8. Send duplicate notification after saving
    if (isDuplicate) {
      await this.notifRepo.save(
        this.notifRepo.create({
          userId,
          type: NotificationType.DUPLICATE_QUESTION,
          title: 'Duplicate Question Rejected',
          body: `Your question "${dto.questionText.slice(0, 80)}" was rejected because an identical question already exists in our system.`,
          data: { questionId: saved.id, duplicateOf: existingDuplicate?.id },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
    }

    return {
      id: saved.id,
      status: saved.status,
      editWindowClosesAt: editWindowClosesAt.toISOString(),
      message: isDuplicate ? 'Duplicate question rejected' : 'Question submitted successfully',
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
        'mediaType', 'mediaUrls', 'status', 'aiConfidenceScore', 'duplicateFlag',
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
   * - domains / season / cropType get placeholder defaults — user fills
   *   them in on the preview screen before final submission.
   */
  async preview(userId: string, dto: PreviewQuestionDto) {
    const inferredDomains = inferDomains(dto.questionText);

    return {
      state: 'Maharashtra',
      district: 'Pune',
      block: 'Haveli',

      // Pre-filled with backend-inferred domains; user can modify on the preview screen
      domains: inferredDomains,
      season: Season.KHARIF,
      cropType: CROPS[0],

      questionText: dto.questionText,
      mediaType: dto.mediaType ?? 'none',
      mediaUrls: dto.mediaUrls ?? [],

      agroClimaticZone: this.deriveAgroClimaticZone('Maharashtra'),
      suggestedDistricts: dummyDistrictsFor('Maharashtra'),
      suggestedBlocks: dummyBlocksFor('Pune'),

      remainingToday: Math.max(0, (await this.adminService.getConfigValue('daily_question_limit')) - (await this.getDailyCount(userId))),
      dailyLimit: await this.adminService.getConfigValue('daily_question_limit'),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CROPS = ['Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Soybean', 'Maize', 'Groundnut', 'Mustard'];

const AGRO_CLIMATIC_ZONE_LABELS: Record<string, string> = {
  western_himalayan: 'Western Himalayan',
  eastern_himalayan: 'Eastern Himalayan',
  lower_gangetic_plain: 'Lower Gangetic Plain',
  middle_gangetic_plain: 'Middle Gangetic Plain',
  upper_gangetic_plain: 'Upper Gangetic Plain',
  trans_gangetic_plain: 'Trans-Gangetic Plain',
  eastern_plateau_and_hills: 'Eastern Plateau and Hills',
  central_plateau_and_hills: 'Central Plateau and Hills',
  karnataka_plain_and_lcms: 'Karnataka Plain and LCMS',
  coastal_andhra_and_karnataka: 'Coastal Andhra and Karnataka',
  krishna_godavari_delta: 'Krishna-Godavari Delta',
  western_ghats_and_coastal_kerala: 'Western Ghats and Coastal Kerala',
  other: 'Other',
};

/** Returns dummy districts for a given state — replace with real master-data call */
function dummyDistrictsFor(state: string): string[] {
  const map: Record<string, string[]> = {
    'Maharashtra': ['Pune', 'Mumbai Suburban', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Allahabad', 'Meerut'],
    'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar'],
    'Karnataka': ['Bangalore Urban', 'Mysore', 'Belgaum', 'Dharwad', 'Gulbarga', 'Mangalore'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli'],
    'West Bengal': ['Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Berhampore'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'],
    'Haryana': ['Gurgaon', 'Faridabad', 'Rohtak', 'Hisar', 'Karnal', 'Panipat'],
    'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Rajnandgaon', 'Jagdalpur'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati'],
    'Telangana': ['Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Rangareddy'],
    'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad'],
    'Assam': ['Kamrup', 'Dibrugarh', 'Tinsukia', 'Jorhat', 'Silchar', 'Guwahati'],
  };
  return map[state] ?? ['District A', 'District B', 'District C'];
}

/** Returns dummy blocks for a given district — replace with real master-data call */
function dummyBlocksFor(district: string): string[] {
  if (!district) return [];
  return [
    `${district} Block 1`,
    `${district} Block 2`,
    `${district} Block 3`,
  ];
}
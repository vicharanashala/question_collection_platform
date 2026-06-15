import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual, Like } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Question, AuditLog } from '../database/entities';
import { QuestionStatus, MediaType, AuditAction, ActorType, Season, VerificationStatus } from '../common/enums';
import { SubmitQuestionDto, SubmitQuestionResponseDto, PreviewQuestionDto } from './dto/submit-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ListQuestionsDto } from './dto/list-questions.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class QuestionService {
  private readonly dailyLimit: number;
  private readonly editWindowSec: number;
  private readonly videoMaxSizeMb: number;
  private readonly videoMaxDurationSec: number;

  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly userService: UserService,
  ) {
    this.dailyLimit = this.config.get<number>('question.dailyLimit') ?? 20;
    this.editWindowSec = this.config.get<number>('question.editWindowSec') ?? 30;
    this.videoMaxSizeMb = this.config.get<number>('question.videoMaxSizeMb') ?? 10;
    this.videoMaxDurationSec = this.config.get<number>('question.videoMaxDurationSec') ?? 10;
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
    // 0. User must be verified to submit questions
    const user = await this.userService.getProfile(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Your account has not been verified by an admin yet. You can submit questions only after verification.',
      );
    }

    // 1. Daily limit check
    await this.checkDailyLimit(userId);

    const now = new Date();
    const editWindowClosesAt = new Date(now.getTime() + this.editWindowSec * 1000);

    // 2. Derive agro-climatic zone from state when not provided
    const agroClimaticZone = dto.agroClimaticZone ?? this.deriveAgroClimaticZone(dto.state ?? '');

    // 3. Persist question in a transaction
    const question = this.questionRepo.create({
      userId,
      domainCategory: dto.domainCategory,
      season: dto.season as Season,
      cropType: dto.cropType,
      agroClimaticZone,
      questionText: dto.questionText,
      state: dto.state ?? '',
      district: dto.district ?? '',
      block: dto.block ?? null,
      mediaType: (dto.mediaType as MediaType) ?? MediaType.NONE,
      mediaUrls: dto.mediaUrls?.length ? dto.mediaUrls : null,
      deviceInfo: dto.deviceInfo ?? null,
      status: QuestionStatus.PENDING,
      editWindowClosesAt,
      submittedAt: now,
    });

    const saved = await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(Question);
      return repo.save(question) as Promise<Question>;
    });

    // 3. Audit log
    await this.auditRepo.save({
      actorType: ActorType.USER,
      actorId: userId,
      action: AuditAction.QUESTION_SUBMITTED,
      entityType: 'question',
      entityId: saved.id,
      newValue: { status: saved.status, domainCategory: saved.domainCategory },
      metadata: { cropType: saved.cropType, season: saved.season },
    });

    return {
      id: saved.id,
      status: saved.status,
      editWindowClosesAt: editWindowClosesAt.toISOString(),
      message: 'Question submitted successfully',
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
      domainCategory: question.domainCategory,
      season: question.season,
      cropType: question.cropType,
      mediaType: question.mediaType,
      mediaUrls: question.mediaUrls,
    };

    // Apply updates
    if (dto.questionText !== undefined) question.questionText = dto.questionText;
    if (dto.domainCategory !== undefined) question.domainCategory = dto.domainCategory;
    if (dto.season !== undefined) question.season = dto.season as Season;
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
        domainCategory: saved.domainCategory,
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
    const { page = 1, limit = 20, status, domainCategory, cropType, season, state, search, fromDate, toDate } = dto;
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

    if (domainCategory) where.domainCategory = domainCategory;
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
      order: { submittedAt: 'DESC' },
      skip,
      take: limit,
      select: [
        'id', 'domainCategory', 'season', 'cropType', 'questionText',
        'mediaType', 'mediaUrls', 'status', 'aiConfidenceScore', 'duplicateFlag',
        'submittedAt', 'reviewedAt', 'rejectionReason', 'state', 'district', 'block',
        'editWindowClosesAt', 'createdAt',
      ],
    });

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Admin: approve / reject ────────────────────────────────────────────────

  async approve(questionId: string, reviewerId: string): Promise<Question> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    question.status = QuestionStatus.APPROVED;
    question.reviewedAt = new Date();
    question.reviewerId = reviewerId;

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

  private async checkDailyLimit(userId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await this.questionRepo.count({
      where: { userId, submittedAt: MoreThanOrEqual(startOfDay) },
    });

    if (count >= this.dailyLimit) {
      throw new BadRequestException(
        `Daily limit of ${this.dailyLimit} questions reached. Please try again tomorrow.`,
      );
    }
  }

  getLimits() {
    return {
      dailyLimit: this.dailyLimit,
      editWindowSec: this.editWindowSec,
      videoMaxSizeMb: this.videoMaxSizeMb,
      videoMaxDurationSec: this.videoMaxDurationSec,
    };
  }

  // ─── Preview ────────────────────────────────────────────────────────────────

  /**
   * Validates the step-1 payload and returns enriched field values.
   * Does NOT write anything to the database.
   *
   * - Location (state, district, block) comes from the user's profile.
   * - domainCategory / season / cropType get placeholder defaults — user fills
   *   them in on the preview screen before final submission.
   */
  async preview(userId: string, dto: PreviewQuestionDto) {
    return {
      // Always return dummy data — mobile app fills these in on the preview screen
      state: 'Maharashtra',
      district: 'Pune',
      block: 'Haveli',

      // Defaults — user will edit these on the preview screen
      domainCategory: 'crop_protection',
      season: Season.KHARIF,
      cropType: '',

      // Echo what the user actually submitted
      questionText: dto.questionText,
      mediaType: dto.mediaType ?? 'none',
      mediaUrls: dto.mediaUrls ?? [],

      // Enriched
      agroClimaticZone: this.deriveAgroClimaticZone('Maharashtra'),
      suggestedDistricts: dummyDistrictsFor('Maharashtra'),
      suggestedBlocks: dummyBlocksFor('Pune'),

      // Counts
      remainingToday: Math.max(0, this.dailyLimit - (await this.getDailyCount(userId))),
      dailyLimit: this.dailyLimit,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
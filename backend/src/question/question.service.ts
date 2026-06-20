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
    const [dailyLimit, editWindowSec, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars] = await Promise.all([
      this.adminService.getConfigValue('daily_question_limit'),
      this.adminService.getConfigValue('question_edit_window_seconds'),
      this.adminService.getConfigValue('video_max_size_mb'),
      this.adminService.getConfigValue('video_max_duration_seconds'),
      this.adminService.getConfigValue('max_question_chars'),
    ]);
    return { dailyLimit, editWindowSec, videoMaxSizeMb, videoMaxDurationSec, maxQuestionChars };
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

  // ─── Server-side AI Validation ──────────────────────────────────────────────

  /**
   * POST /questions/validate
   *
   * Server-side mirror of the mobile on-device AI pipeline.
   * Used as a fallback when the mobile device cannot run local checks
   * (e.g. unknown OS, storage unavailable) or when the question warrants
   * a server-authoritative duplicate check against the full question corpus.
   *
   * Does NOT write to the database.
   *
   * Returns:
   *   { verdict: 'pass' | 'warn' | 'fail', reasonKey: string | null, stages: {...}, duplicateId?: string }
   */
  async validateQuestion(userId: string, dto: ValidateQuestionDto) {
    // 1. Spam check — mirrors mobile/src/utils/onDeviceAI.ts checkSpam()
    const spamResult = this.serverCheckSpam(dto.questionText);

    // 2. Agriculture relevance check — mirrors computeRelevanceScore()
    const relevanceResult = this.serverCheckRelevance(dto.questionText);

    // 3. Duplicate check — queries the full question corpus (authoritative)
    const duplicateResult = await this.serverCheckDuplicate(userId, dto.questionText);

    // Aggregate: spam > duplicate > relevance
    let verdict: 'pass' | 'warn' | 'fail' = 'pass';
    let reasonKey: string | null = null;

    if (!spamResult.pass) {
      verdict = 'fail';
      reasonKey = spamResult.reasonKey ?? 'onDeviceAI.spam.default';
    } else if (!duplicateResult.pass) {
      verdict = 'warn';
      reasonKey = duplicateResult.reasonKey ?? 'onDeviceAI.duplicate.semantic';
    } else if (!relevanceResult.pass) {
      verdict = 'warn';
      reasonKey = 'onDeviceAI.relevance.low';
    }

    return {
      verdict,
      reasonKey,
      stages: {
        spam: { pass: spamResult.pass, confidence: spamResult.pass ? 1 : 0.98, detail: spamResult.detail },
        relevance: { pass: relevanceResult.pass, confidence: relevanceResult.score, detail: relevanceResult.detail },
        duplicate: { pass: duplicateResult.pass, confidence: duplicateResult.similarity ?? 0, detail: duplicateResult.detail },
      },
      ...(duplicateResult.duplicateId ? { duplicateId: duplicateResult.duplicateId } : {}),
    };
  }

  // Private spam check (mirrors mobile checkSpam)
  private serverCheckSpam(text: string) {
    if (!text?.trim()) return { pass: true, reasonKey: null, detail: 'empty' };
    const lower = text.toLowerCase();
    const spamPatterns: Array<{ pattern: RegExp; reasonKey: string }> = [
      { pattern: /\b(buy|sell|order|shop|discount|offer|free|gift|prize|winner|click here|register now)\b/gi, reasonKey: 'onDeviceAI.spam.promotional' },
      { pattern: /(.)\1{5,}/g, reasonKey: 'onDeviceAI.spam.repeatedChars' },
      { pattern: /https?:\/\/|www\./gi, reasonKey: 'onDeviceAI.spam.urlPresent' },
      { pattern: /\b\d{10,}\b|\b\d[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, reasonKey: 'onDeviceAI.spam.phoneNumber' },
      { pattern: /[\w.-]+@[\w.-]+\.\w{2,}/gi, reasonKey: 'onDeviceAI.spam.emailAddress' },
    ];
    for (const { pattern, reasonKey } of spamPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) return { pass: false, reasonKey, detail: 'spam_match' };
    }
    const words = text.trim().split(/\s+/);
    if (words.length < 3) return { pass: false, reasonKey: 'onDeviceAI.spam.tooShort', detail: 'too_short' };
    return { pass: true, reasonKey: null, detail: 'clean' };
  }

  // Private relevance check (mirrors mobile computeRelevanceScore)
  private serverCheckRelevance(text: string) {
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return { pass: false, score: 0, detail: 'empty' };

    // Stop words + agriculture keywords (inline set — keep in sync with mobile)
    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','shall','can','need','to','of','in','for','on','with','at','by','from','as','into','and','but','if','or','because','while','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their','this','that','these','those','what','which','who','whom','when','where','why','how','all','some','any','no','not','only','same','so','than','too','very','just','also']);
    const agriKeywords = new Set([
      'wheat','rice','paddy','maize','bajra','jowar','ragi','barley','cotton','sugarcane','groundnut','mustard','soybean','sunflower','sesame','castor','gram','tur','masoor','moong','urad','lentil','chickpea','pigeonpea',
      'tomato','potato','onion','garlic','ginger','turmeric','chilli','brinjal','cabbage','cauliflower','okra','cucumber','gourd','pumpkin','carrot','radish','spinach','fenugreek',
      'coriander','cumin','fennel','blackpepper','cardamom','cinnamon','cloves',
      'mango','banana','grape','citrus','orange','guava','pomegranate','papaya','coconut','arecanut','cashew',
      'cattle','buffalo','cow','goat','sheep','poultry','chicken','fish','milk','dairy','breeding','milking','mastitis','fodder','feed',
      'soil','nitrogen','phosphorus','potash','urea','dap','npk','compost','manure','vermicompost','biofertilizer','organic','lime',
      'irrigation','drip','sprinkler','flood','canal','pump','borewell','drainage','drought','rainfall','monsoon',
      'pesticide','insecticide','fungicide','herbicide','ipm','biopesticide','pest','insect','aphid','whitefly','borer','termite','mite','disease','blight','rust','mildew','wilt','rot',
      'harvest','yield','storage','processing','milling',
      'tractor','rotavator','seed drill','sprayer','harvester','thresher',
      'fertilizer','dose','npk','urea','dap','micronutrient',
      'seed','variety','hybrid','seed rate','seed treatment','foundation seed',
      'crop','farming','agriculture','agronomy','horticulture','sowing','weeding','pruning','grafting',
      'kharif','rabi','zaid','monsoon','sowing','pest','disease','fertilizer','irrigation','harvest',
    ]);

    let matched = 0;
    for (const word of words) {
      if (!stopWords.has(word) && agriKeywords.has(word)) matched++;
    }
    const score = Math.min(1, matched * 0.15 + Math.min(0.3, (matched / Math.max(words.length, 1)) * 0.8));
    return { pass: score >= 0.15, score, detail: matched === 0 ? 'no_keywords' : `matched_${matched}` };
  }

  // Private duplicate check — authoritative, queries DB
  private async serverCheckDuplicate(userId: string, text: string) {
    const SIMILARITY_THRESHOLD = 0.9;
    const maxChars = 300;
    const truncated = text.length > maxChars ? text.slice(0, maxChars) : text;

    // Exact match
    const exact = await this.questionRepo.findOne({
      where: [{ userId, questionText: text }, { userId, questionText: truncated }],
      select: ['id'],
    });
    if (exact) return { pass: false, reasonKey: 'onDeviceAI.duplicate.exact', detail: 'exact_match', duplicateId: exact.id, similarity: 1 };

    // Levenshtein similarity against recent questions (last 100, ordered by recency)
    const recent = await this.questionRepo
      .find({
        where: { userId },
        select: ['id', 'questionText'],
        order: { submittedAt: 'DESC' },
        take: 100,
      })
      .catch(() => []);

    const normalised = (t: string) => t.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const normTarget = normalised(text);

    for (const q of recent) {
      const sim = this.levenshteinSimilarity(normTarget, normalised(q.questionText));
      if (sim >= SIMILARITY_THRESHOLD) {
        return { pass: false, reasonKey: 'onDeviceAI.duplicate.semantic', detail: `sim_${Math.round(sim * 100)}`, duplicateId: q.id, similarity: sim };
      }
    }
    return { pass: true, reasonKey: null, detail: 'no_duplicate', duplicateId: undefined, similarity: 0 };
  }

  /** Levenshtein similarity ratio: 1 - (editDistance / maxLen) */
  private levenshteinSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const m = a.length, n = b.length;
    if (m === 0 || n === 0) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    let curr = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return 1 - prev[n] / Math.max(m, n);
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
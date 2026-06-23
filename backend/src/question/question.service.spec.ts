import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuestionService } from './question.service';
import { UserService } from '../user/user.service';
import { AdminService } from '../admin/admin.service';
import { StorageService } from '../storage/storage.service';
import { GemmaService } from '../ai/gemma.service';
import { Question, AuditLog, Notification } from '../database/entities';
import { QuestionStatus, MediaType, Season, VerificationStatus } from '../common/enums';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

// ─── Repository / service mocks ────────────────────────────────────────────────

const mockQuestionRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
});

const mockAuditRepo = () => ({
  save: jest.fn(),
});

const mockNotificationRepo = () => ({
  save: jest.fn(),
  create: jest.fn((obj) => obj),
});

const mockDataSource = () => ({
  transaction: jest.fn((fn) => fn({ getRepository: () => mockQuestionRepo() })),
});

const mockAdminService = () => ({
  getConfigValue: jest.fn((key: string) => {
    const map: Record<string, number> = {
      daily_question_limit: 20,
      question_edit_window_seconds: 30,
      video_max_size_mb: 10,
      video_max_duration_seconds: 10,
      max_question_chars: 1000,
      max_image_size_mb: 5,
    };
    return Promise.resolve(map[key] ?? 0);
  }),
  getConfigValues: jest.fn(),
});

const mockUserService = () => {
  const verifiedUser = {
    id: '11111111-1111-1111-1111-111111111111',
    verificationStatus: VerificationStatus.VERIFIED,
    languagePreference: 'hi',
  };
  return {
    getProfile: jest.fn().mockResolvedValue(verifiedUser),
    findOne: jest.fn().mockResolvedValue(verifiedUser),
  };
};

const mockGemmaService = () => ({
  inferCropAndDomains: jest.fn().mockResolvedValue({
    crop: 'Rice',
    domains: ['Insect-Pest Management', 'Disease Management'],
    confidence: 0.92,
  }),
});

const mockStorageService = () => ({
  upload: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuestionService', () => {
  let service: QuestionService;
  let questionRepo: ReturnType<typeof mockQuestionRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const questionId = '22222222-2222-2222-2222-222222222222';

  const baseDto = {
    domains: ['Insect-Pest Management', 'Disease Management'],
    season: Season.KHARIF,
    cropType: 'Rice',
    questionText: 'What is the best pesticide for brown planthopper?',
    state: 'Odisha',
    district: 'Bhubaneswar',
    agroClimaticZone: 'eastern_ghats_and_coastal_odisha',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionService,
        { provide: getRepositoryToken(Question), useFactory: mockQuestionRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditRepo },
        { provide: getRepositoryToken(Notification), useFactory: mockNotificationRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: AdminService, useFactory: mockAdminService },
        { provide: UserService, useFactory: mockUserService },
        { provide: StorageService, useFactory: mockStorageService },
        { provide: GemmaService, useFactory: mockGemmaService },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
    questionRepo = module.get(getRepositoryToken(Question));
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── submit ────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('should create a question with PENDING status and return editWindowClosesAt', async () => {
      questionRepo.count.mockResolvedValue(0);

      const createdQuestion = {
        id: questionId,
        userId,
        status: QuestionStatus.PENDING,
        ...baseDto,
        mediaType: MediaType.NONE,
        mediaUrls: null,
        deviceInfo: null,
        editWindowClosesAt: new Date(Date.now() + 30_000),
        submittedAt: new Date(),
      };

      // Override transaction so it uses our createdQuestion
      (service as any).dataSource.transaction.mockImplementation(
        async (fn: (em: unknown) => Promise<unknown>) => {
          const repo = { save: jest.fn().mockResolvedValue(createdQuestion) };
          return fn({ getRepository: () => repo });
        },
      );

      const result = await service.submit(userId, baseDto);

      expect(result.status).toBe(QuestionStatus.PENDING);
      expect(result.id).toBe(questionId);
      expect(result.editWindowClosesAt).toBeDefined();
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'question_submitted', entityType: 'question' }),
      );
    });

    it('should throw BadRequestException when daily limit is reached', async () => {
      questionRepo.count.mockResolvedValue(20); // already at limit

      await expect(service.submit(userId, baseDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when daily limit exceeded', async () => {
      questionRepo.count.mockResolvedValue(21);

      await expect(service.submit(userId, baseDto)).rejects.toThrow(
        /Daily limit.*reached/,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should allow update within edit window', async () => {
      const futureEditWindow = new Date(Date.now() + 15_000); // 15 seconds left
      const existingQuestion = {
        id: questionId,
        userId,
        questionText: 'Original text',
        domains: ['Insect-Pest Management'],
        season: 'Kharif',
        cropType: 'Rice',
        mediaType: MediaType.NONE,
        mediaUrls: null,
        editWindowClosesAt: futureEditWindow,
      };

      questionRepo.findOne.mockResolvedValue(existingQuestion);
      questionRepo.save.mockResolvedValue({ ...existingQuestion, questionText: 'Updated text' });

      const result = await service.update(userId, questionId, { questionText: 'Updated text' });

      expect(result.questionText).toBe('Updated text');
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'question_edited' }),
      );
    });

    it('should throw NotFoundException for unknown question id', async () => {
      questionRepo.findOne.mockResolvedValue(null);

      await expect(service.update(userId, questionId, { questionText: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the question', async () => {
      questionRepo.findOne.mockResolvedValue({
        id: questionId,
        userId: 'another-user-id',
        editWindowClosesAt: new Date(Date.now() + 30_000),
      });

      await expect(service.update(userId, questionId, { questionText: 'Hack' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if edit window has closed', async () => {
      questionRepo.findOne.mockResolvedValue({
        id: questionId,
        userId,
        questionText: 'Original',
        editWindowClosesAt: new Date(Date.now() - 5000), // already closed
      });

      await expect(service.update(userId, questionId, { questionText: 'Late edit' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a question for the owner', async () => {
      const question = { id: questionId, userId, status: QuestionStatus.PENDING };
      questionRepo.findOne.mockResolvedValue(question);

      const result = await service.findOne(questionId, userId);

      expect(result).toEqual(question);
    });

    it('should throw NotFoundException if question does not exist', async () => {
      questionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(questionId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-owner accesses non-approved question', async () => {
      questionRepo.findOne.mockResolvedValue({
        id: questionId,
        userId: 'another-user',
        status: QuestionStatus.PENDING,
      });

      await expect(service.findOne(questionId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should allow non-owner to see an approved question', async () => {
      const question = { id: questionId, userId: 'another', status: QuestionStatus.APPROVED };
      questionRepo.findOne.mockResolvedValue(question);

      const result = await service.findOne(questionId, userId);

      expect(result).toEqual(question);
    });
  });

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated results for a user', async () => {
      const items = [{ id: questionId, userId, status: QuestionStatus.PENDING, reviewedByName: null }];
      questionRepo.findAndCount.mockResolvedValue([items, 1]);

      const result = await service.list(userId, { page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.items).toEqual(items);
    });

    it('should apply status filter when provided', async () => {
      questionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list(userId, { page: 1, limit: 20, status: 'approved' });

      expect(questionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
      );
    });

    it('should apply search filter with LIKE', async () => {
      questionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.list(userId, { page: 1, limit: 20, search: 'rice' });

      expect(questionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cropType: expect.objectContaining({ _value: '%rice%' }),
          }),
        }),
      );
    });
  });

  // ─── approve / reject ──────────────────────────────────────────────────────

  describe('approve', () => {
    it('should approve a question and set reviewerId', async () => {
      const reviewerId = '33333333-3333-3333-3333-333333333333';
      const question = {
        id: questionId,
        userId,
        status: QuestionStatus.HUMAN_REVIEW,
        reviewedAt: null,
        reviewerId: null,
      };
      questionRepo.findOne.mockResolvedValue(question);
      questionRepo.save.mockImplementation((q) => Promise.resolve(q));

      const result = await service.approve(questionId, reviewerId);

      expect(result.status).toBe(QuestionStatus.APPROVED);
      expect(result.reviewerId).toBe(reviewerId);
      expect(result.reviewedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when approving unknown question', async () => {
      questionRepo.findOne.mockResolvedValue(null);

      await expect(service.approve(questionId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('should reject a question with the given reason', async () => {
      const question = {
        id: questionId,
        userId,
        status: QuestionStatus.HUMAN_REVIEW,
        reviewedAt: null,
        reviewerId: null,
      };
      questionRepo.findOne.mockResolvedValue(question);
      questionRepo.save.mockImplementation((q) => Promise.resolve(q));

      const result = await service.reject(questionId, userId, 'Off-topic question');

      expect(result.status).toBe(QuestionStatus.REJECTED);
      expect(result.rejectionReason).toBe('Off-topic question');
    });
  });

  // ─── getDailyCount ─────────────────────────────────────────────────────────

  describe('getDailyCount', () => {
    it('should return the count of questions submitted today', async () => {
      questionRepo.count.mockResolvedValue(5);

      const count = await service.getDailyCount(userId);

      expect(count).toBe(5);
    });
  });

  // ─── getLimits ─────────────────────────────────────────────────────────────

  describe('getLimits', () => {
    it('should return configured limits', async () => {
      const limits = await service.getLimits();

      expect(limits.dailyLimit).toBe(20);
      expect(limits.editWindowSec).toBe(30);
      expect(limits.videoMaxSizeMb).toBe(10);
      expect(limits.videoMaxDurationSec).toBe(10);
    });
  });
});
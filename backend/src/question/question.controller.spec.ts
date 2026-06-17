import { Test, TestingModule } from '@nestjs/testing';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole, QuestionStatus, Season, MediaType } from '../common/enums';

const mockQuestionService = () => ({
  submit: jest.fn(),
  preview: jest.fn(),
  list: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  getDailyCount: jest.fn(),
  getLimits: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
});

describe('QuestionController', () => {
  let controller: QuestionController;
  let service: ReturnType<typeof mockQuestionService>;

  const userReq = { user: { id: 'user-1', role: UserRole.USER } };
  const adminReq = { user: { id: 'admin-1', role: UserRole.ADMIN } };

  const submitDto = {
    domainCategory: 'crop_protection',
    season: Season.KHARIF,
    cropType: 'Rice',
    questionText: 'What is the best pesticide for brown planthopper?',
    state: 'Odisha',
    district: 'Bhubaneswar',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [
        { provide: QuestionService, useFactory: mockQuestionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuestionController>(QuestionController);
    service = module.get(QuestionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /questions ────────────────────────────────────────────────────────

  describe('POST /questions', () => {
    it('should call service.submit and return the response', async () => {
      const mockResponse = {
        id: 'q-1',
        status: QuestionStatus.PENDING,
        editWindowClosesAt: new Date(Date.now() + 30_000).toISOString(),
        message: 'Question submitted successfully',
      };
      service.submit.mockResolvedValue(mockResponse);

      const result = await controller.submit(submitDto, userReq as any);

      expect(result).toEqual(mockResponse);
      expect(service.submit).toHaveBeenCalledWith('user-1', submitDto);
    });

    it('should pass through service errors', async () => {
      service.submit.mockRejectedValue(new Error('Service error'));

      await expect(controller.submit(submitDto, userReq as any)).rejects.toThrow('Service error');
    });
  });

  // ─── POST /questions/preview ────────────────────────────────────────────────

  describe('POST /questions/preview', () => {
    it('should return enriched preview data', async () => {
      const previewData = {
        state: 'Maharashtra',
        district: 'Pune',
        block: 'Haveli',
        domainCategory: 'crop_protection',
        season: Season.KHARIF,
        cropType: '',
        questionText: 'Test question',
        mediaType: 'none',
        mediaUrls: [],
        agroClimaticZone: 'eastern_plateau_and_hills',
        suggestedDistricts: ['Pune', 'Mumbai Suburban'],
        suggestedBlocks: ['Pune Block 1'],
        remainingToday: 19,
        dailyLimit: 20,
      };
      service.preview.mockResolvedValue(previewData);

      const result = await controller.preview({ questionText: 'Test question' } as any, userReq as any);

      expect(result.agroClimaticZone).toBeDefined();
      expect(result.dailyLimit).toBe(20);
    });
  });

  // ─── GET /questions ─────────────────────────────────────────────────────────

  describe('GET /questions', () => {
    it('should call list with user id and dto', async () => {
      const listResult = { items: [], total: 0, page: 1, limit: 20, pages: 0 };
      service.list.mockResolvedValue(listResult);

      const result = await controller.list({ page: 1, limit: 20 } as any, userReq as any);

      expect(result).toEqual(listResult);
      expect(service.list).toHaveBeenCalledWith('user-1', expect.any(Object), false);
    });

    it('should pass isAdmin=true when user role is admin', async () => {
      service.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, pages: 0 });

      await controller.list({ page: 1, limit: 20 } as any, adminReq as any);

      expect(service.list).toHaveBeenCalledWith('admin-1', expect.any(Object), true);
    });
  });

  // ─── GET /questions/stats/me ────────────────────────────────────────────────

  describe('GET /questions/stats/me', () => {
    it('should return daily count, remaining, and limits', async () => {
      service.getDailyCount.mockResolvedValue(5);
      service.getLimits.mockResolvedValue({
        dailyLimit: 20,
        editWindowSec: 30,
        videoMaxSizeMb: 10,
        videoMaxDurationSec: 10,
      });

      const result = await controller.getMyStats(userReq as any);

      expect(result.dailyCount).toBe(5);
      expect(result.remainingToday).toBe(15);
      expect(result.dailyLimit).toBe(20);
    });
  });

  // ─── GET /questions/:id ─────────────────────────────────────────────────────

  describe('GET /questions/:id', () => {
    it('should return a single question', async () => {
      const question = { id: 'q-1', questionText: 'Test', status: QuestionStatus.PENDING };
      service.findOne.mockResolvedValue(question);

      const result = await controller.getOne('q-1', userReq as any);

      expect(result).toEqual(question);
      expect(service.findOne).toHaveBeenCalledWith('q-1', 'user-1');
    });
  });

  // ─── PATCH /questions/:id ───────────────────────────────────────────────────

  describe('PATCH /questions/:id', () => {
    it('should call update with id and dto', async () => {
      const updated = { id: 'q-1', questionText: 'Updated' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        'q-1',
        { questionText: 'Updated' } as any,
        userReq as any,
      );

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith('user-1', 'q-1', { questionText: 'Updated' });
    });
  });

  // ─── POST /questions/:id/approve ────────────────────────────────────────────

  describe('POST /questions/:id/approve', () => {
    it('should call approve on the service with reason', async () => {
      const approved = { id: 'q-1', status: QuestionStatus.APPROVED };
      service.approve.mockResolvedValue(approved);

      const result = await controller.approve('q-1', 'Looks good', adminReq as any);

      expect(result).toEqual(approved);
      expect(service.approve).toHaveBeenCalledWith('q-1', 'admin-1', 'Looks good');
    });

    it('should allow approve without reason', async () => {
      const approved = { id: 'q-1', status: QuestionStatus.APPROVED };
      service.approve.mockResolvedValue(approved);

      const result = await controller.approve('q-1', undefined, adminReq as any);

      expect(result).toEqual(approved);
      expect(service.approve).toHaveBeenCalledWith('q-1', 'admin-1', undefined);
    });
  });

  // ─── POST /questions/:id/reject ─────────────────────────────────────────────

  describe('POST /questions/:id/reject', () => {
    it('should call reject with id, adminId, and reason', async () => {
      const rejected = { id: 'q-1', status: QuestionStatus.REJECTED, rejectionReason: 'Off-topic' };
      service.reject.mockResolvedValue(rejected);

      const result = await controller.reject('q-1', 'Off-topic' as any, adminReq as any);

      expect(result).toEqual(rejected);
      expect(service.reject).toHaveBeenCalledWith('q-1', 'admin-1', 'Off-topic');
    });

    it('should default reason to "Not provided" when omitted', async () => {
      service.reject.mockResolvedValue({ id: 'q-1', status: QuestionStatus.REJECTED });

      await controller.reject('q-1', undefined as any, adminReq as any);

      expect(service.reject).toHaveBeenCalledWith('q-1', 'admin-1', 'Not provided');
    });
  });
});
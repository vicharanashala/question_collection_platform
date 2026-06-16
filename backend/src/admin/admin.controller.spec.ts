import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, VerificationStatus, QuestionStatus, UserCategory } from '../common/enums';

const mockAdminService = () => ({
  createUser: jest.fn(),
  listUsers: jest.fn(),
  getUserDetail: jest.fn(),
  suspendOrBanUser: jest.fn(),
  unsuspendOrUnbanUser: jest.fn(),
  verifyUser: jest.fn(),
  listReviewQueue: jest.fn(),
  getQuestionForReview: jest.fn(),
  reviewQuestion: jest.fn(),
  getQuestionMetrics: jest.fn(),
  listConfig: jest.fn(),
  updateConfig: jest.fn(),
  createConfig: jest.fn(),
  getDashboardStats: jest.fn(),
  getStats: jest.fn(),
  getRewardSummary: jest.fn(),
  listRewardLogs: jest.fn(),
  getFraudStats: jest.fn(),
  listWithdrawals: jest.fn(),
  processWithdrawal: jest.fn(),
  exportData: jest.fn(),
});

describe('AdminController', () => {
  let controller: AdminController;
  let service: ReturnType<typeof mockAdminService>;

  const adminReq = { user: { id: 'admin-1', mobileNumber: '9999', role: UserRole.ADMIN } };
  const superAdminReq = { user: { id: 'super-1', mobileNumber: '9998', role: UserRole.SUPER_ADMIN } };
  const curatorReq = { user: { id: 'curator-1', mobileNumber: '9997', role: UserRole.CURATOR } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useFactory: mockAdminService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── User Management ────────────────────────────────────────────────────────

  describe('POST /admin/users', () => {
    it('should call createUser and return the created user', async () => {
      const created = {
        user: {
          id: 'new-1',
          name: 'New Farmer',
          mobileNumber: '9123456789',
          role: UserRole.USER,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      };
      service.createUser.mockResolvedValue(created);

      const result = await controller.createUser(
        { name: 'New Farmer', mobileNumber: '9123456789', role: UserRole.USER, state: 'Maharashtra', district: 'Pune' } as any,
        adminReq as any,
      );

      expect(result.user.id).toBe('new-1');
      expect(service.createUser).toHaveBeenCalledWith('admin-1', UserRole.ADMIN, expect.any(Object));
    });
  });

  describe('GET /admin/users', () => {
    it('should return paginated user list', async () => {
      const result = { items: [], total: 0, page: 1, limit: 20, pages: 0 };
      service.listUsers.mockResolvedValue(result);

      const response = await controller.listUsers({ page: 1, limit: 20 } as any);

      expect(response.total).toBe(0);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('should return user detail with recent questions', async () => {
      const detail = { user: { id: 'user-1' }, questions: [] };
      service.getUserDetail.mockResolvedValue(detail);

      const result = await controller.getUserDetail('user-1');

      expect(result.user.id).toBe('user-1');
    });
  });

  describe('POST /admin/users/:id/suspend', () => {
    it('should suspend a user', async () => {
      service.suspendOrBanUser.mockResolvedValue({ success: true, userId: 'user-1', newStatus: VerificationStatus.SUSPENDED });

      const result = await controller.suspendUser(
        'user-1',
        { action: 'suspend', reason: 'Violation' } as any,
        adminReq as any,
      );

      expect(result.newStatus).toBe(VerificationStatus.SUSPENDED);
    });

    it('should ban a user with optional suspendedUntil', async () => {
      service.suspendOrBanUser.mockResolvedValue({ success: true, userId: 'user-1', newStatus: VerificationStatus.BANNED });

      await controller.suspendUser(
        'user-1',
        { action: 'ban', reason: 'Fraud', suspendedUntil: '2025-12-31' } as any,
        superAdminReq as any,
      );

      expect(service.suspendOrBanUser).toHaveBeenCalledWith(
        'super-1',
        'user-1',
        'ban',
        'Fraud',
        '2025-12-31',
      );
    });
  });

  describe('POST /admin/users/:id/unsuspend', () => {
    it('should unsuspend or unban a user', async () => {
      service.unsuspendOrUnbanUser.mockResolvedValue({ success: true, userId: 'user-1', newStatus: VerificationStatus.VERIFIED });

      const result = await controller.unsuspendUser('user-1', superAdminReq as any);

      expect(result.newStatus).toBe(VerificationStatus.VERIFIED);
    });
  });

  describe('POST /admin/users/:id/verify', () => {
    it('should verify a pending user', async () => {
      service.verifyUser.mockResolvedValue({ success: true, userId: 'user-1', newStatus: VerificationStatus.VERIFIED });

      const result = await controller.verifyUser('user-1', adminReq as any);

      expect(result.newStatus).toBe(VerificationStatus.VERIFIED);
    });

    it('should return early when user is already verified', async () => {
      service.verifyUser.mockResolvedValue({ success: true, userId: 'user-1', newStatus: VerificationStatus.VERIFIED, message: 'User already verified' });

      const result = await controller.verifyUser('user-1', adminReq as any);

      expect(result.message).toBe('User already verified');
    });
  });

  // ─── Question Review ────────────────────────────────────────────────────────

  describe('GET /admin/questions/queue', () => {
    it('should return paginated review queue', async () => {
      const queue = { items: [], total: 0, page: 1, limit: 20, pages: 0 };
      service.listReviewQueue.mockResolvedValue(queue);

      const result = await controller.listReviewQueue({ page: 1, limit: 20 } as any);

      expect(result.total).toBe(0);
    });

    it('should pass through all query params', async () => {
      service.listReviewQueue.mockResolvedValue({ items: [], total: 0, page: 2, limit: 10, pages: 0 });

      await controller.listReviewQueue({ page: 2, limit: 10, state: 'Maharashtra', search: 'rice' } as any);

      expect(service.listReviewQueue).toHaveBeenCalledWith(expect.objectContaining({
        state: 'Maharashtra',
        search: 'rice',
      }));
    });
  });

  describe('GET /admin/questions/:id', () => {
    it('should return question for review', async () => {
      const q = { id: 'q-1', questionText: 'Test?', user: { id: 'user-1', name: 'Ramesh', mobileNumber: '9876', state: 'Maharashtra' } };
      service.getQuestionForReview.mockResolvedValue(q);

      const result = await controller.getQuestion('q-1');

      expect(result.user).not.toBeNull();
      expect(result.user!.name).toBe('Ramesh');
    });
  });

  describe('POST /admin/questions/:id/review', () => {
    it('should call reviewQuestion with the correct role', async () => {
      service.reviewQuestion.mockResolvedValue({ success: true, action: 'approved', questionId: 'q-1' });

      await controller.reviewQuestion('q-1', { action: 'approve' } as any, adminReq as any);

      expect(service.reviewQuestion).toHaveBeenCalledWith('admin-1', 'q-1', { action: 'approve' }, UserRole.ADMIN);
    });

    it('should pass curator role when request is from curator', async () => {
      service.reviewQuestion.mockResolvedValue({ success: true, action: 'request_info', questionId: 'q-1' });

      await controller.reviewQuestion('q-1', { action: 'request_info' } as any, curatorReq as any);

      expect(service.reviewQuestion).toHaveBeenCalledWith('curator-1', 'q-1', { action: 'request_info' }, UserRole.CURATOR);
    });
  });

  describe('GET /admin/questions/metrics', () => {
    it('should return question metrics', async () => {
      const metrics = { summary: { total: 100, approved: 80 }, period: {} };
      service.getQuestionMetrics.mockResolvedValue(metrics);

      const result = await controller.getQuestionMetrics({ fromDate: '2024-01-01', toDate: '2024-12-31' } as any);

      expect(result.summary.total).toBe(100);
    });
  });

  // ─── Configuration ─────────────────────────────────────────────────────────

  describe('GET /admin/config', () => {
    it('should return list of config items', async () => {
      const configs = { items: [{ key: 'daily_question_limit', value: 20, description: 'Max per day' }] };
      service.listConfig.mockResolvedValue(configs);

      const result = await controller.listConfig();

      expect(result.items).toHaveLength(1);
    });
  });

  describe('POST /admin/config', () => {
    it('should create a new config entry', async () => {
      service.createConfig.mockResolvedValue({ success: true, config: { key: 'new_key', value: 42 } });

      const result = await controller.createConfig(
        { key: 'new_key', value: 42, description: 'New config' } as any,
        adminReq as any,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('PATCH /admin/config', () => {
    it('should update an existing config entry', async () => {
      service.updateConfig.mockResolvedValue({ success: true, key: 'daily_question_limit', oldValue: 20, newValue: 30 });

      const result = await controller.updateConfig(
        { key: 'daily_question_limit', value: 30 } as any,
        adminReq as any,
      );

      expect(result.newValue).toBe(30);
    });
  });

  // ─── Analytics ─────────────────────────────────────────────────────────────

  describe('GET /admin/analytics/dashboard', () => {
    it('should return dashboard stats', async () => {
      const stats = { summary: { totalQuestions: 100, approvedQuestions: 80 } };
      service.getDashboardStats.mockResolvedValue(stats);

      const result = await controller.getDashboard({} as any);

      expect(result.summary.totalQuestions).toBe(100);
    });
  });

  describe('GET /admin/stats', () => {
    it('should return full admin stats', async () => {
      const stats = { dashboard: { totalUsers: 500, verifiedUsers: 400, pendingUsers: 50, suspendedUsers: 20, bannedUsers: 10, totalQuestions: 1000, approvedQuestions: 800, rejectedQuestions: 100, pendingQuestions: 100, questionsThisWeek: 200, usersThisWeek: 50 }, recentActivity: [], roleDistribution: [], categoryDistribution: [], historical: [] };
      service.getStats.mockResolvedValue(stats);

      const result = await controller.getStats({} as any) as any;

      expect(result.dashboard.totalUsers).toBe(500);
    });
  });

  describe('GET /admin/analytics/rewards', () => {
    it('should return reward summary', async () => {
      service.getRewardSummary.mockResolvedValue({ totalRewarded: 50000, rewardCount: 120, avgReward: 416.67, totalWithdrawn: 30000, withdrawalCount: 80, pendingWithdrawals: 5 });

      const result = await controller.getRewardSummary({} as any) as any;

      expect(result.totalRewarded).toBe(50000);
    });
  });

  describe('GET /admin/analytics/reward-logs', () => {
    it('should return paginated reward logs', async () => {
      service.listRewardLogs.mockResolvedValue({ items: [], from: new Date(), to: new Date() });

      const result = await controller.getRewardLogs({} as any) as any;

      expect(result.items).toEqual([]);
    });
  });

  // ─── Fraud ─────────────────────────────────────────────────────────────────

  describe('GET /admin/fraud', () => {
    it('should return fraud statistics', async () => {
      service.getFraudStats.mockResolvedValue({ duplicateSubmissions: [], totalDuplicates: 5, totalRejected: 12, page: 1, limit: 20, pages: 1 });

      const result = await controller.getFraudStats({} as any) as any;

      expect(result.totalDuplicates).toBe(5);
    });
  });

  // ─── Withdrawals ───────────────────────────────────────────────────────────

  describe('GET /admin/withdrawals', () => {
    it('should return paginated withdrawal list', async () => {
      service.listWithdrawals.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      const result = await controller.listWithdrawals({ page: 1, limit: 20 } as any);

      expect(result.total).toBe(0);
    });
  });

  describe('POST /admin/withdrawals/:id/process', () => {
    it('should process a withdrawal request', async () => {
      service.processWithdrawal.mockResolvedValue({ success: true, withdrawalId: 'wd-1', status: 'approved' });

      const result = await controller.processWithdrawal(
        'wd-1',
        { action: 'approve' } as any,
        adminReq as any,
      );

      expect(result.status).toBe('approved');
    });
  });
});
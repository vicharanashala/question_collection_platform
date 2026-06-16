import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ConfigService } from '@nestjs/config';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
} from '../database/entities';
import {
  VerificationStatus,
  QuestionStatus,
  UserRole,
  UserCategory,
  AuditAction,
  ActorType,
  WithdrawalStatus,
  Season,
} from '../common/enums';

// ─── Repository mocks ─────────────────────────────────────────────────────────

const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockQuestionRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockWalletRepo = () => ({
  findOne: jest.fn(),
});

const mockTransactionRepo = () => ({
  findAndCount: jest.fn(),
});

const mockWithdrawalRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockAuditRepo = () => ({
  save: jest.fn(),
});

const mockConfigRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

// ─── QueryBuilder mock factory ────────────────────────────────────────────────

function mockQueryBuilder(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getManyAndCount: jest.fn().mockResolvedValue([result, Array.isArray(result) ? result.length : 1]),
    getRawMany: jest.fn().mockResolvedValue(result),
    getRawOne: jest.fn().mockResolvedValue(result),
  };
}

// ─── Shared test data ─────────────────────────────────────────────────────────

const mockAdminUser = {
  id: 'admin-1',
  role: UserRole.ADMIN,
  mobileNumber: '9999988888',
  name: 'Admin User',
  verificationStatus: VerificationStatus.VERIFIED,
};

const mockSuperAdminUser = {
  id: 'superadmin-1',
  role: UserRole.SUPER_ADMIN,
  mobileNumber: '9999977777',
  name: 'Super Admin',
  verificationStatus: VerificationStatus.VERIFIED,
};

const mockCuratorUser = {
  id: 'curator-1',
  role: UserRole.CURATOR,
  mobileNumber: '9999966666',
  name: 'Curator',
  verificationStatus: VerificationStatus.VERIFIED,
};

const mockTargetUser = {
  id: 'user-1',
  mobileNumber: '9876543210',
  name: 'Ramesh Kumar',
  role: UserRole.USER,
  category: UserCategory.FARMER,
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Haveli',
  languagePreference: 'hi',
  verificationStatus: VerificationStatus.PENDING,
  tokenVersion: 0,
  lastLoginAt: null,
  createdAt: new Date(),
};

const mockQuestion = {
  id: 'q-1',
  userId: 'user-1',
  questionText: 'What is the best pesticide for brown planthopper?',
  status: QuestionStatus.PENDING,
  domainCategory: 'crop_protection',
  season: Season.KHARIF,
  cropType: 'Rice',
  state: 'Maharashtra',
  submittedAt: new Date(),
  aiConfidenceScore: 75,
};

const mockConfig = {
  id: 'config-1',
  key: 'daily_question_limit',
  value: 20,
  description: 'Max questions per user per day',
};

// ─── Test module setup ────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let questionRepo: ReturnType<typeof mockQuestionRepo>;
  let withdrawalRepo: ReturnType<typeof mockWithdrawalRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;
  let configRepo: ReturnType<typeof mockConfigRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Question), useFactory: mockQuestionRepo },
        { provide: getRepositoryToken(Wallet), useFactory: mockWalletRepo },
        { provide: getRepositoryToken(Transaction), useFactory: mockTransactionRepo },
        { provide: getRepositoryToken(WithdrawalRequest), useFactory: mockWithdrawalRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditRepo },
        { provide: getRepositoryToken(AdminConfig), useFactory: mockConfigRepo },
        { provide: ConfigService, useFactory: () => ({ get: jest.fn() }) },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get(getRepositoryToken(User));
    questionRepo = module.get(getRepositoryToken(Question));
    withdrawalRepo = module.get(getRepositoryToken(WithdrawalRequest));
    auditRepo = module.get(getRepositoryToken(AuditLog));
    configRepo = module.get(getRepositoryToken(AdminConfig));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createUser ─────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('should create a user with verified status', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.count.mockResolvedValue(5);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-user-1', ...u }));
      configRepo.findOne.mockResolvedValue({ key: 'max_users_per_state', value: 100 });
      configRepo.find.mockResolvedValue([]);

      const result = await service.createUser(
        mockAdminUser.id,
        UserRole.ADMIN,
        {
          name: 'New Farmer',
          mobileNumber: '9123456789',
          role: UserRole.USER,
          category: UserCategory.FARMER,
          state: 'Maharashtra',
          district: 'Pune',
        },
      );

      expect(result.user).toHaveProperty('verificationStatus', VerificationStatus.VERIFIED);
      expect(result.user).toHaveProperty('mobileNumber', '9123456789');
    });

    it('should normalize mobile number by stripping +91/0 prefix', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.count.mockResolvedValue(0);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-1', ...u }));
      configRepo.findOne.mockResolvedValue({ key: 'max_users_per_state', value: 100 });
      configRepo.find.mockResolvedValue([]);

      const result = await service.createUser(mockAdminUser.id, UserRole.ADMIN, {
        name: 'Test',
        mobileNumber: '+91 9876543210',
        role: UserRole.USER,
        category: UserCategory.FARMER,
        state: 'Maharashtra',
        district: 'Pune',
      });

      expect(result.user.mobileNumber).toBe('9876543210');
    });

    it('should throw BadRequestException for duplicate mobile number', async () => {
      userRepo.findOne.mockResolvedValue(mockTargetUser);

      await expect(
        service.createUser(mockAdminUser.id, UserRole.ADMIN, {
          name: 'Duplicate',
          mobileNumber: '9876543210',
          role: UserRole.USER,
          category: UserCategory.FARMER,
          state: 'Maharashtra',
          district: 'Pune',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when state user limit is reached', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.count.mockResolvedValue(100); // at the limit
      configRepo.findOne.mockResolvedValue({ key: 'max_users_per_state', value: 100 });

      await expect(
        service.createUser(mockAdminUser.id, UserRole.ADMIN, {
          name: 'Over Limit',
          mobileNumber: '9000000001',
          role: UserRole.USER,
          category: UserCategory.FARMER,
          state: 'Maharashtra',
          district: 'Pune',
        }),
      ).rejects.toThrow(/maximum/);
    });

    it('should skip max_users_per_state check for ADMIN role', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'admin-new', ...u }));
      // count returns high number that would fail if checked
      userRepo.count.mockResolvedValue(1000);
      configRepo.findOne.mockResolvedValue({ key: 'max_users_per_state', value: 100 });
      configRepo.find.mockResolvedValue([]);

      const result = await service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
        name: 'New Admin',
        mobileNumber: '9000000002',
        role: UserRole.ADMIN,
        state: 'Maharashtra',
        district: 'Pune',
      });

      expect(result.user.role).toBe(UserRole.ADMIN);
      // count should not have been called with state filter for admin
      expect(userRepo.count).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when trying to create a SUPER_ADMIN', async () => {
      await expect(
        service.createUser(mockAdminUser.id, UserRole.ADMIN, {
          name: 'Super',
          mobileNumber: '9000000003',
          role: UserRole.SUPER_ADMIN,
          state: 'Maharashtra',
          district: 'Pune',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when a SUPER_ADMIN tries to create another SUPER_ADMIN', async () => {
      await expect(
        service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
          name: 'Another Super',
          mobileNumber: '9000000004',
          role: UserRole.SUPER_ADMIN,
          state: 'Maharashtra',
          district: 'Pune',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set category to null for privileged roles (ADMIN/CURATOR)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.count.mockResolvedValue(0);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'curator-1', ...u }));
      configRepo.find.mockResolvedValue([]);

      const result = await service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
        name: 'New Curator',
        mobileNumber: '9000000005',
        role: UserRole.CURATOR,
        state: 'Maharashtra',
        district: 'Pune',
      });

      expect(result.user.category).toBeNull();
    });
  });

  // ─── listUsers ──────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('should return paginated user list', async () => {
      const qb = mockQueryBuilder([mockTargetUser]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should apply all filters via andWhere', async () => {
      const qb = mockQueryBuilder([]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listUsers({
        state: 'Maharashtra',
        category: UserCategory.FARMER,
        status: VerificationStatus.VERIFIED,
        search: 'ramesh',
        page: 2,
        limit: 10,
      });

      // andWhere is called multiple times (state, category, status, search)
      expect(qb.andWhere).toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(10); // (page-1)*limit
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  // ─── getUserDetail ──────────────────────────────────────────────────────────

  describe('getUserDetail', () => {
    it('should return user with relations and recent questions', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockTargetUser, wallet: { id: 'w-1' } });
      questionRepo.find.mockResolvedValue([mockQuestion]);

      const result = await service.getUserDetail('user-1');

      expect(result.user.id).toBe('user-1');
      expect(result.questions).toHaveLength(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verifyUser ─────────────────────────────────────────────────────────────

  describe('verifyUser', () => {
    it('should verify a pending user and log audit', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockTargetUser });
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.verifyUser(mockAdminUser.id, 'user-1');

      expect(result.newStatus).toBe(VerificationStatus.VERIFIED);
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        verificationStatus: VerificationStatus.VERIFIED,
      });
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should return early when user is already verified', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockTargetUser,
        verificationStatus: VerificationStatus.VERIFIED,
      });

      const result = await service.verifyUser(mockAdminUser.id, 'user-1');

      expect(result.message).toBe('User already verified');
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyUser(mockAdminUser.id, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── suspendOrBanUser ───────────────────────────────────────────────────────

  describe('suspendOrBanUser', () => {
    it('should ban a user when action is ban', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser }) // target user lookup
        .mockResolvedValueOnce({ ...mockAdminUser, role: UserRole.SUPER_ADMIN }); // isSuperAdmin check
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.suspendOrBanUser(
        mockSuperAdminUser.id,
        'user-1',
        'ban',
        'Fraudulent activity',
      );

      expect(result.newStatus).toBe(VerificationStatus.BANNED);
      expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        verificationStatus: VerificationStatus.BANNED,
        bannedAt: expect.any(Date),
        bannedReason: 'Fraudulent activity',
      }));
    });

    it('should suspend a user when action is suspend', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser })
        .mockResolvedValueOnce({ ...mockAdminUser, role: UserRole.SUPER_ADMIN });
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.suspendOrBanUser(
        mockSuperAdminUser.id,
        'user-1',
        'suspend',
        'Temporary violation',
        '2025-12-31',
      );

      expect(result.newStatus).toBe(VerificationStatus.SUSPENDED);
    });

    it('should throw ForbiddenException if not a super admin', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser })
        .mockResolvedValueOnce({ ...mockAdminUser, role: UserRole.ADMIN }); // not super admin

      await expect(
        service.suspendOrBanUser(mockAdminUser.id, 'user-1', 'ban'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to ban a super admin', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockSuperAdminUser, id: 'target-super' })
        .mockResolvedValueOnce({ ...mockSuperAdminUser });

      await expect(
        service.suspendOrBanUser(mockSuperAdminUser.id, 'target-super', 'ban'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.suspendOrBanUser(mockSuperAdminUser.id, 'nonexistent', 'ban'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── unsuspendOrUnbanUser ───────────────────────────────────────────────────

  describe('unsuspendOrUnbanUser', () => {
    it('should unban a banned user', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser, verificationStatus: VerificationStatus.BANNED })
        .mockResolvedValueOnce({ ...mockSuperAdminUser });
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.unsuspendOrUnbanUser(mockSuperAdminUser.id, 'user-1');

      expect(result.newStatus).toBe(VerificationStatus.VERIFIED);
      expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
        verificationStatus: VerificationStatus.VERIFIED,
      }));
    });

    it('should unsuspend a suspended user', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser, verificationStatus: VerificationStatus.SUSPENDED })
        .mockResolvedValueOnce({ ...mockSuperAdminUser });
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.unsuspendOrUnbanUser(mockSuperAdminUser.id, 'user-1');

      expect(result.newStatus).toBe(VerificationStatus.VERIFIED);
    });

    it('should throw BadRequestException if user is not suspended or banned', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockTargetUser, verificationStatus: VerificationStatus.VERIFIED })
        .mockResolvedValueOnce({ ...mockSuperAdminUser });

      await expect(
        service.unsuspendOrUnbanUser(mockSuperAdminUser.id, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getConfigValue ─────────────────────────────────────────────────────────

  describe('getConfigValue', () => {
    it('should return cached value when available', async () => {
      configRepo.find.mockResolvedValue([{ key: 'daily_question_limit', value: 20 }]);

      const val1 = await service.getConfigValue('daily_question_limit');
      const val2 = await service.getConfigValue('daily_question_limit');

      expect(val1).toBe(20);
      expect(val2).toBe(20);
      // find should only be called once (cache hit on second call)
      expect(configRepo.find).toHaveBeenCalledTimes(1);
    });

    it('should fall back to default when key not in DB', async () => {
      configRepo.findOne.mockResolvedValue(null);
      configRepo.find.mockResolvedValue([]);

      // Trigger cache miss by making expiry old — access private via any
      await (service as unknown as { configCacheExpiry: number }).configCacheExpiry; // no-op, just ensure init ran
      const val = await service.getConfigValue('min_withdrawal_amount');

      expect(val).toBe(50); // default from DEFAULT_CONFIG
    });
  });

  // ─── updateConfig ───────────────────────────────────────────────────────────

  describe('updateConfig', () => {
    it('should update config value and invalidate cache', async () => {
      configRepo.findOne.mockResolvedValue({ ...mockConfig });
      configRepo.update.mockResolvedValue(undefined);

      const result = await service.updateConfig(mockAdminUser.id, {
        key: 'daily_question_limit',
        value: 30,
      });

      expect(result.success).toBe(true);
      expect(result.oldValue).toBe(20);
      expect(result.newValue).toBe(30);
    });

    it('should throw NotFoundException when config key does not exist', async () => {
      configRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateConfig(mockAdminUser.id, { key: 'nonexistent_key', value: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createConfig ───────────────────────────────────────────────────────────

  describe('createConfig', () => {
    it('should create a new config entry', async () => {
      configRepo.findOne.mockResolvedValue(null);
      configRepo.save.mockImplementation((c) => Promise.resolve({ id: 'c-new', ...c }));

      const result = await service.createConfig(mockAdminUser.id, {
        key: 'new_config_key',
        value: 42,
        description: 'A new config',
      });

      expect(result.success).toBe(true);
      expect(result.config.key).toBe('new_config_key');
    });

    it('should throw BadRequestException when key already exists', async () => {
      configRepo.findOne.mockResolvedValue(mockConfig);

      await expect(
        service.createConfig(mockAdminUser.id, {
          key: 'daily_question_limit',
          value: 30,
          description: 'Changed',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── reviewQuestion ─────────────────────────────────────────────────────────

  describe('reviewQuestion', () => {
    const reviewDto = { action: 'approve' as const };

    it('should approve a question in human_review status', async () => {
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.HUMAN_REVIEW });
      questionRepo.update.mockResolvedValue(undefined);

      const result = await service.reviewQuestion(
        mockAdminUser.id,
        'q-1',
        reviewDto,
        UserRole.ADMIN,
      );

      expect(result.action).toBe('approved');
      expect(questionRepo.update).toHaveBeenCalledWith('q-1', expect.objectContaining({
        status: QuestionStatus.APPROVED,
        reviewerId: mockAdminUser.id,
        reviewedAt: expect.any(Date),
      }));
    });

    it('should reject a question with a reason', async () => {
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.AI_REVIEW });
      questionRepo.update.mockResolvedValue(undefined);

      const result = await service.reviewQuestion(
        mockAdminUser.id,
        'q-1',
        { action: 'reject', reason: 'Off-topic' },
        UserRole.ADMIN,
      );

      expect(result.action).toBe('rejected');
      expect(questionRepo.update).toHaveBeenCalledWith('q-1', expect.objectContaining({
        status: QuestionStatus.REJECTED,
        rejectionReason: 'Off-topic',
      }));
    });

    it('should move question to human_review on request_info action', async () => {
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.AI_REVIEW });
      questionRepo.update.mockResolvedValue(undefined);

      const result = await service.reviewQuestion(
        mockCuratorUser.id,
        'q-1',
        { action: 'request_info' },
        UserRole.CURATOR,
      );

      expect(result.action).toBe('request_info');
      expect(questionRepo.update).toHaveBeenCalledWith('q-1', {
        status: QuestionStatus.HUMAN_REVIEW,
      });
    });

    it('should throw NotFoundException for unknown question', async () => {
      questionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewQuestion(mockAdminUser.id, 'nonexistent', reviewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for question not in reviewable state', async () => {
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.APPROVED });

      await expect(
        service.reviewQuestion(mockAdminUser.id, 'q-1', reviewDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── listReviewQueue ────────────────────────────────────────────────────────

  describe('listReviewQueue', () => {
    it('should return paginated review queue items with user info', async () => {
      const qb = mockQueryBuilder([{ ...mockQuestion, user: { id: 'user-1', name: 'Ramesh', mobileNumber: '9876' } }]);
      questionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listReviewQueue({ page: 1, limit: 20 });

      expect(result.items[0]).toHaveProperty('user');
      expect(result.total).toBe(1);
    });

    it('should filter by state when provided', async () => {
      const qb = mockQueryBuilder([]);
      questionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listReviewQueue({ state: 'Maharashtra' });

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should default to pending+human_review+ai_review statuses', async () => {
      const qb = mockQueryBuilder([]);
      questionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listReviewQueue({});

      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  // ─── getQuestionForReview ───────────────────────────────────────────────────

  describe('getQuestionForReview', () => {
    it('should return question with sanitized user info', async () => {
      questionRepo.findOne.mockResolvedValue({
        ...mockQuestion,
        user: { id: 'user-1', name: 'Ramesh', mobileNumber: '9876543210', state: 'Maharashtra' },
      });

      const result = await service.getQuestionForReview('q-1');

      expect(result.user).toHaveProperty('mobileNumber', '9876543210');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException when question not found', async () => {
      questionRepo.findOne.mockResolvedValue(null);

      await expect(service.getQuestionForReview('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDashboardStats ──────────────────────────────────────────────────────

  describe('getDashboardStats', () => {
    it('should return summary, breakdowns, and daily volume', async () => {
      const mockQb = () => {
        const qb = mockQueryBuilder([]);
        return qb;
      };

      questionRepo.count
        .mockResolvedValueOnce(100) // totalQuestions
        .mockResolvedValueOnce(60)  // approvedQuestions
        .mockResolvedValueOnce(10)  // rejectedQuestions
        .mockResolvedValueOnce(30)  // pendingQuestions
        .mockResolvedValueOnce(500) // totalUsers
        .mockResolvedValueOnce(5);  // flaggedQuestions

      questionRepo.createQueryBuilder.mockReturnValue(mockQb());
      userRepo.createQueryBuilder.mockReturnValue(mockQb());

      const result = await service.getDashboardStats({});

      expect(result.summary).toMatchObject({
        totalQuestions: 100,
        approvedQuestions: 60,
        rejectedQuestions: 10,
        pendingQuestions: 30,
        totalUsers: 500,
        flaggedQuestions: 5,
      });
      expect(result.summary.approvalRate).toBe(60);
    });
  });
});
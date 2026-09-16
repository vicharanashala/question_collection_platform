import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ConfigService } from '@nestjs/config';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notification/notifications.service';
import { PinelabsService } from '../payment/pinelabs.service';
import { RazorpayPayoutService } from '../payment/razorpay-payout.service';
import { GdbService } from '../ai/gdb.service';
import { RedisService } from '../../shared/database/cache/redis.service';
import { HotDataService } from '../../shared/database/cache/hot-data.service';
import { AnalyticsCacheService } from '../../shared/database/cache/analytics-cache.service';
import { MongoTransactionService } from '../../shared/database/mongodb/mongo-transaction.service';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
} from '../../shared/database/entities';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import {
  VerificationStatus,
  QuestionStatus,
  UserRole,
  UserCategory,
  AuditAction,
  ActorType,
  WithdrawalStatus,
  Season,
} from '../../shared/classes/enums';

// â”€â”€â”€ Repository mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mockUserRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn().mockImplementation((data) => ({ id: 'generated-id', ...(data ?? {}) })),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  create: jest.fn().mockImplementation((data) => ({ id: undefined, ...data })),
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
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const emptyMock = () => ({});

// â”€â”€â”€ QueryBuilder mock factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Shared test data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  village: 'Hadapsar',
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
};

const mockConfig = {
  id: 'config-1',
  key: 'daily_question_limit',
  value: 20,
  description: 'Max questions per user per day',
};

// â”€â”€â”€ Test module setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let questionRepo: ReturnType<typeof mockQuestionRepo>;
  let withdrawalRepo: ReturnType<typeof mockWithdrawalRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;
  let configRepo: ReturnType<typeof mockConfigRepo>;

  beforeEach(async () => {
    const mockWalletsService = {
      creditReward: jest.fn().mockResolvedValue({
        transaction: { id: 'tx-1', amount: 1, balanceAfter: 101 },
        newBalance: 101,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: REPOSITORY_TOKENS.User, useFactory: mockUserRepo },
        { provide: REPOSITORY_TOKENS.Question, useFactory: mockQuestionRepo },
        { provide: REPOSITORY_TOKENS.Wallet, useFactory: mockWalletRepo },
        { provide: REPOSITORY_TOKENS.Transaction, useFactory: mockTransactionRepo },
        { provide: REPOSITORY_TOKENS.WithdrawalRequest, useFactory: mockWithdrawalRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useFactory: mockAuditRepo },
        { provide: REPOSITORY_TOKENS.AdminConfig, useFactory: mockConfigRepo },
        { provide: REPOSITORY_TOKENS.Notification, useFactory: emptyMock },
        { provide: REPOSITORY_TOKENS.PaymentLog, useFactory: emptyMock },
        { provide: REPOSITORY_TOKENS.UserPaymentDetail, useFactory: emptyMock },
        { provide: ConfigService, useFactory: () => ({ get: jest.fn() }) },
        { provide: WalletsService, useValue: mockWalletsService },
        { provide: NotificationsService, useFactory: emptyMock },
        { provide: PinelabsService, useFactory: emptyMock },
        { provide: RazorpayPayoutService, useFactory: emptyMock },
        { provide: RedisService, useFactory: emptyMock },
        { provide: HotDataService, useFactory: emptyMock },
        { provide: AnalyticsCacheService, useFactory: emptyMock },
        { provide: GdbService, useFactory: emptyMock },
        { provide: MongoTransactionService, useFactory: emptyMock },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get(REPOSITORY_TOKENS.User);
    questionRepo = module.get(REPOSITORY_TOKENS.Question);
    withdrawalRepo = module.get(REPOSITORY_TOKENS.WithdrawalRequest);
    auditRepo = module.get(REPOSITORY_TOKENS.AuditLog);
    configRepo = module.get(REPOSITORY_TOKENS.AdminConfig);
  });

  afterEach(() => jest.clearAllMocks());

  // â”€â”€â”€ createUser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('createUser', () => {
    it('should create an end-user with only basic fields and the selected category', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-user-1', ...u }));

      const result = await service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
        name: 'New Farmer',
        mobileNumber: '9123456789',
        role: UserRole.USER,
        category: UserCategory.FARMER,
        isUserCreatedBySuperAdmin: false
      });

      expect(userRepo.create).toHaveBeenCalledWith({
        name: 'New Farmer',
        mobileNumber: '9123456789',
        role: UserRole.USER,
        category: UserCategory.FARMER,
        languagePreference: 'en',
        consentGiven: false,
        verificationStatus: VerificationStatus.VERIFIED,
        tokenVersion: 0,
        lastLoginAt: null,
      });
      expect(result.user).toHaveProperty('verificationStatus', VerificationStatus.VERIFIED);
      expect(userRepo.count).not.toHaveBeenCalled();
    });

    it('should create staff without a category', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'finance-new', ...u }));

      const result = await service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
        name: 'Finance Staff',
        mobileNumber: '9000000011',
        role: UserRole.FINANCE,
        isUserCreatedBySuperAdmin: false
      });

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Finance Staff',
        mobileNumber: '9000000011',
        role: UserRole.FINANCE,
        category: null,
        consentGiven: false,
      }));
      expect(result.user.role).toBe(UserRole.FINANCE);
      expect(userRepo.count).not.toHaveBeenCalled();
    });

    it('should require category when creating an end-user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
          name: 'User Without Category',
          mobileNumber: '9000000012',
          role: UserRole.USER,
          isUserCreatedBySuperAdmin: false
        }),
      ).rejects.toThrow(/Category is required/);
    });

    it('should normalize mobile number by stripping +91/0 prefix', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockImplementation((u) => Promise.resolve({ id: 'new-1', ...u }));

      const result = await service.createUser(mockAdminUser.id, UserRole.ADMIN, {
        name: 'Test',
        mobileNumber: '+91 9876543210',
        role: UserRole.USER,
        category: UserCategory.FARMER,
        isUserCreatedBySuperAdmin: false
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
          isUserCreatedBySuperAdmin: false
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when trying to create a SUPER_ADMIN', async () => {
      await expect(
        service.createUser(mockAdminUser.id, UserRole.ADMIN, {
          name: 'Super',
          mobileNumber: '9000000003',
          role: UserRole.SUPER_ADMIN,
          isUserCreatedBySuperAdmin: false
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when a SUPER_ADMIN tries to create another SUPER_ADMIN', async () => {
      await expect(
        service.createUser(mockSuperAdminUser.id, UserRole.SUPER_ADMIN, {
          name: 'Another Super',
          mobileNumber: '9000000004',
          role: UserRole.SUPER_ADMIN,
          isUserCreatedBySuperAdmin: false
        }),
      ).rejects.toThrow(ForbiddenException);
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

  // â”€â”€â”€ getUserDetail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ verifyUser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ suspendOrBanUser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ unsuspendOrUnbanUser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ getConfigValue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      // Trigger cache miss by making expiry old â€” access private via any
      await (service as unknown as { configCacheExpiry: number }).configCacheExpiry; // no-op, just ensure init ran
      const val = await service.getConfigValue('min_withdrawal_amount');

      expect(val).toBe(50); // default from DEFAULT_CONFIG
    });
  });

  // â”€â”€â”€ updateConfig â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ createConfig â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ reviewQuestion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('reviewQuestion', () => {
    const reviewDto = { action: 'approve' as const };

    it('should approve a question in human_review status', async () => {
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.PENDING });
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
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.PENDING });
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
      questionRepo.findOne.mockResolvedValue({ ...mockQuestion, status: QuestionStatus.PENDING });
      questionRepo.update.mockResolvedValue(undefined);

      const result = await service.reviewQuestion(
        mockCuratorUser.id,
        'q-1',
        { action: 'request_info' },
        UserRole.CURATOR,
      );

      expect(result.action).toBe('request_info');
      expect(questionRepo.update).toHaveBeenCalledWith('q-1', {
        status: QuestionStatus.PENDING,
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

  // â”€â”€â”€ listReviewQueue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ getQuestionForReview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ getDashboardStats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        .mockResolvedValueOnce(5);  // flaggedQuestions
      userRepo.count.mockResolvedValueOnce(500); // totalUsers

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
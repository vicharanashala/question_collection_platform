import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { AdminService } from '../admin/admin.service';
import { Wallet, Transaction, WithdrawalRequest } from '../database/entities';
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
} from '../common/enums';

const mockWalletRepo = () => ({
  findOne: jest.fn(),
});

const mockTransactionRepo = () => ({
  findAndCount: jest.fn(),
});

const mockWithdrawalRepo = () => ({
  findOne: jest.fn(),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

const mockAdminService = () => ({
  getConfigValue: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, number> = {
      min_withdrawal_amount: 50,
    };
    return Promise.resolve(map[key] ?? 0);
  }),
});

describe('WalletsService', () => {
  let service: WalletsService;
  let walletRepo: ReturnType<typeof mockWalletRepo>;
  let transactionRepo: ReturnType<typeof mockTransactionRepo>;
  let withdrawalRepo: ReturnType<typeof mockWithdrawalRepo>;

  const userId = '11111111-1111-1111-1111-111111111111';
  const walletId = '22222222-2222-2222-2222-222222222222';

  const mockWallet = {
    id: walletId,
    userId,
    balance: 500,
    currency: 'INR',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(Wallet), useFactory: mockWalletRepo },
        { provide: getRepositoryToken(Transaction), useFactory: mockTransactionRepo },
        { provide: getRepositoryToken(WithdrawalRequest), useFactory: mockWithdrawalRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: AdminService, useFactory: mockAdminService },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    walletRepo = module.get(getRepositoryToken(Wallet));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    withdrawalRepo = module.get(getRepositoryToken(WithdrawalRequest));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getBalance ─────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return balance and currency for a valid wallet', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);

      const result = await service.getBalance(userId);

      expect(result).toEqual({ balance: 500, currency: 'INR' });
    });

    it('should throw NotFoundException when wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.getBalance(userId)).rejects.toThrow(NotFoundException);
    });

    it('should return balance as a plain number even if stored as string', async () => {
      walletRepo.findOne.mockResolvedValue({ ...mockWallet, balance: '750' });

      const result = await service.getBalance(userId);

      expect(result.balance).toBe(750);
    });
  });

  // ─── getTransactions ────────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('should throw NotFoundException when wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.getTransactions(userId)).rejects.toThrow(NotFoundException);
    });

    it('should return paginated transactions ordered by createdAt DESC', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      const transactions = [
        { id: 'tx-1', type: TransactionType.CREDIT, amount: 100, balanceAfter: 500 },
        { id: 'tx-2', type: TransactionType.DEBIT, amount: 50, balanceAfter: 450 },
      ];
      transactionRepo.findAndCount.mockResolvedValue([transactions, 2]);

      const result = await service.getTransactions(userId, { page: 1, limit: 20 });

      expect(result.transactions).toEqual(transactions);
      expect(result.total).toBe(2);
      expect(transactionRepo.findAndCount).toHaveBeenCalledWith({
        where: { walletId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should cap limit at 50 and floor page at 1', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      transactionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getTransactions(userId, { page: -5, limit: 200 });

      expect(transactionRepo.findAndCount).toHaveBeenCalledWith({
        where: { walletId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 50,
      });
    });

    it('should use default pagination when params are omitted', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      transactionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getTransactions(userId);

      expect(transactionRepo.findAndCount).toHaveBeenCalledWith({
        where: { walletId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });

  // ─── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    let mockQueryRunner: {
      connect: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
      release: jest.Mock;
      manager: {
        findOne: jest.Mock;
        update: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
      };
    };

    const setupQueryRunner = (walletBalance = 500) => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          findOne: jest.fn().mockResolvedValue({ id: walletId, balance: walletBalance }),
          update: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockImplementation((EntityClass, data) => ({
            id: 'withdrawal-1',
            userId: data.userId,
            walletId: data.walletId,
            amount: data.amount,
            payoutMethod: data.payoutMethod,
            payoutDetails: data.payoutDetails,
            status: WithdrawalStatus.PENDING,
          })),
          save: jest.fn().mockImplementation((first, second) => {
            // TypeORM calls manager.save(EntityClass, entityInstance)
            const entity = typeof first === 'function' ? second : first;
            if (Array.isArray(entity)) return entity;
            return entity as object;
          }),
        },
      };
      (service as unknown as { dataSource: { createQueryRunner: jest.Mock } }).dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    };

    it('should throw NotFoundException when wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.withdraw(userId, { amount: 100, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when amount is below minimum', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);

      await expect(
        service.withdraw(userId, { amount: 10, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds balance', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);

      await expect(
        service.withdraw(userId, { amount: 1000, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a pending withdrawal already exists', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'existing-pending',
        status: WithdrawalStatus.PENDING,
      });

      await expect(
        service.withdraw(userId, { amount: 100, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow(/pending/);
    });

    it('should successfully create a withdrawal request and deduct balance', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      withdrawalRepo.findOne.mockResolvedValue(null);
      setupQueryRunner(500);

      const result = await service.withdraw(userId, {
        amount: 100,
        payoutMethod: PayoutMethod.UPI,
        payoutDetails: { upiId: 'test@upi' },
      });

      expect(result).toHaveProperty('amount', 100);
      expect(result).toHaveProperty('status', WithdrawalStatus.PENDING);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Wallet,
        walletId,
        expect.objectContaining({ balance: 400 }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on insufficient locked balance', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      withdrawalRepo.findOne.mockResolvedValue(null);
      setupQueryRunner(50); // balance is 50 but we try to withdraw 100

      await expect(
        service.withdraw(userId, { amount: 100, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback on unexpected error', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      withdrawalRepo.findOne.mockResolvedValue(null);
      setupQueryRunner(500);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.withdraw(userId, { amount: 100, payoutMethod: PayoutMethod.UPI, payoutDetails: {} }),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should always release the query runner even on success', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      withdrawalRepo.findOne.mockResolvedValue(null);
      setupQueryRunner(500);

      await service.withdraw(userId, { amount: 100, payoutMethod: PayoutMethod.UPI, payoutDetails: {} });

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── getRewardTier ──────────────────────────────────────────────────────────

  describe('getRewardTier', () => {
    // Tier 1: 1–25 approved → ₹1  (stored as maxApproved=26: count < 26)
    it.each([0, 1, 10, 25])(
      'should return tier 1 (₹1) when approvedCount=%i',
      (count) => {
        const result = service.getRewardTier(count);
        expect(result.reward).toBe(1);
        expect(result.maxApproved).toBe(26);
        expect(result.nextTier).not.toBeNull();
        expect(result.nextTier?.reward).toBe(5);
      },
    );

    // Tier 2: 26–250 approved → ₹5  (stored as maxApproved=251: count < 251)
    it.each([26, 100, 250])(
      'should return tier 2 (₹5) when approvedCount=%i',
      (count) => {
        const result = service.getRewardTier(count);
        expect(result.reward).toBe(5);
        expect(result.maxApproved).toBe(251);
        expect(result.nextTier).not.toBeNull();
        expect(result.nextTier?.reward).toBe(10);
      },
    );

    // Tier 3: 251+ approved → ₹10  (stored as maxApproved=501: count < 501)
    it.each([251, 500, 1000])(
      'should return tier 3 (₹10) when approvedCount=%i',
      (count) => {
        const result = service.getRewardTier(count);
        expect(result.reward).toBe(10);
        expect(result.maxApproved).toBe(501);
        expect(result.nextTier).toBeNull();
      },
    );

    it('should return maxApproved=501 with nextTier=null at count=500 (boundary of tier 3)', () => {
      const result = service.getRewardTier(500);
      expect(result.reward).toBe(10);
      expect(result.maxApproved).toBe(501);
      expect(result.nextTier).toBeNull();
    });
  });

  // ─── creditReward ───────────────────────────────────────────────────────────

  describe('creditReward', () => {
    let mockQueryRunner: {
      connect: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
      release: jest.Mock;
      manager: {
        findOne: jest.Mock;
        update: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
      };
    };

    const setupQueryRunner = (walletBalance = 0) => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          findOne: jest.fn().mockResolvedValue({ id: walletId, balance: walletBalance }),
          update: jest.fn().mockResolvedValue(undefined),
          create: jest
            .fn()
            .mockImplementation((_EntityClass, data) => ({
              id: 'tx-new',
              walletId: data.walletId,
              type: data.type,
              source: data.source,
              amount: data.amount,
              balanceAfter: data.balanceAfter,
              referenceId: data.referenceId,
              description: data.description,
              status: data.status,
            })),
          save: jest.fn().mockImplementation((EntityClass, entity) => {
            // TypeORM queryRunner.manager.save(EntityClass, entityInstance)
            const instance = typeof EntityClass === 'function' ? entity : EntityClass;
            return { id: 'tx-new', status: TransactionStatus.COMPLETED, ...(instance as object) };
          }),
        },
      };
      (
        service as unknown as { dataSource: { createQueryRunner: jest.Mock } }
      ).dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    };

    beforeEach(() => {
      // Reset the static mock between creditReward describe blocks
      (service as unknown as { dataSource: { createQueryRunner: jest.Mock } }).dataSource.createQueryRunner.mockReset();
    });

    it('should throw NotFoundException when wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.creditReward({
          userId,
          questionId: 'q-1',
          approvedCount: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should credit ₹1 for tier 1 (approvedCount ≤ 25)', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(0);

      const result = await service.creditReward({
        userId,
        questionId: 'q-tier1',
        approvedCount: 5,
      });

      expect(result.transaction.amount).toBe(1);
      expect(result.newBalance).toBe(1);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Wallet,
        walletId,
        expect.objectContaining({ balance: 1 }),
      );
    });

    it('should credit ₹5 for tier 2 (26 ≤ approvedCount ≤ 250)', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(100);

      const result = await service.creditReward({
        userId,
        questionId: 'q-tier2',
        approvedCount: 100,
      });

      expect(result.transaction.amount).toBe(5);
      expect(result.newBalance).toBe(105);
    });

    it('should credit ₹10 for tier 3 (approvedCount ≥ 251)', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(500);

      const result = await service.creditReward({
        userId,
        questionId: 'q-tier3',
        approvedCount: 300,
      });

      expect(result.transaction.amount).toBe(10);
      expect(result.newBalance).toBe(510);
    });

    it('should create a CREDIT transaction with REWARD source and completed status', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(0);

      await service.creditReward({
        userId,
        questionId: 'q-tx-check',
        approvedCount: 20,
      });

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({
          type: TransactionType.CREDIT,
          source: TransactionSource.REWARD,
          amount: 1,
          status: TransactionStatus.COMPLETED,
          referenceId: 'q-tx-check',
        }),
      );
    });

    it('should commit the transaction on success', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(0);

      await service.creditReward({ userId, questionId: 'q-commit', approvedCount: 1 });

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback on unexpected error', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(0);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB write failure'));

      await expect(
        service.creditReward({ userId, questionId: 'q-err', approvedCount: 1 }),
      ).rejects.toThrow('DB write failure');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should always release the query runner even on failure', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);
      setupQueryRunner(0);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.creditReward({ userId, questionId: 'q-release', approvedCount: 1 }),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
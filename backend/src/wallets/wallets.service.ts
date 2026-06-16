import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, Transaction, WithdrawalRequest, Question } from '../database/entities';
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
} from '../common/enums';
import { AdminService } from '../admin/admin.service';
import { WithdrawDto } from './dto';

// Reward tiers based on approved question count (per TASK_06)
// Tier 1:  1–25  approved → ₹1  (stored as maxApproved=26 → condition: count < 26)
// Tier 2: 26–250 approved → ₹5  (stored as maxApproved=251 → condition: count < 251)
// Tier 3: 251–500 approved → ₹10 (stored as maxApproved=501 → condition: count < 501)
// Beyond 500: stays at ₹10
const REWARD_TIERS: ReadonlyArray<{ maxApproved: number; reward: number }> = [
  { maxApproved: 26, reward: 1 },
  { maxApproved: 251, reward: 5 },
  { maxApproved: 501, reward: 10 },
] as const;

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,
  ) {}

  /**
   * Returns the reward amount in rupees for a given approved question count.
   * Tier 1: 1–25 approved  → ₹1
   * Tier 2: 26–250 approved → ₹5
   * Tier 3: 251+ approved   → ₹10
   */
  private getRewardAmount(approvedCount: number): number {
    const tier = REWARD_TIERS.find((t) => approvedCount < t.maxApproved);
    return tier?.reward ?? 10;
  }

  /**
   * Credits reward to a user's wallet after question approval.
   * Returns the transaction record and new balance.
   */
  async creditReward(params: {
    userId: string;
    questionId: string;
    approvedCount: number;
  }): Promise<{ transaction: Transaction; newBalance: number }> {
    const wallet = await this.walletRepo.findOne({ where: { userId: params.userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const rewardAmount = this.getRewardAmount(params.approvedCount);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const locked = await queryRunner.manager.findOne(Wallet, {
        where: { id: wallet.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Wallet not found');

      const updatedBalance = Number(locked.balance) + rewardAmount;
      await queryRunner.manager.update(Wallet, wallet.id, { balance: updatedBalance });

      const tx = queryRunner.manager.create(Transaction, {
        walletId: wallet.id,
        type: TransactionType.CREDIT,
        source: TransactionSource.REWARD,
        amount: rewardAmount,
        balanceAfter: updatedBalance,
        referenceId: params.questionId,
        description: `Reward for approved question (total approved: ${params.approvedCount}, ₹${rewardAmount})`,
        status: TransactionStatus.COMPLETED,
      });
      const savedTx = await queryRunner.manager.save(Transaction, tx);

      await queryRunner.commitTransaction();
      return { transaction: savedTx, newBalance: updatedBalance };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Returns reward tier information for a user given their approved question count.
   * Tier 1:  1–25  approved → ₹1  (maxApproved=26, check: count < 26)
   * Tier 2: 26–250 approved → ₹5  (maxApproved=251, check: count < 251)
   * Tier 3: 251+ approved   → ₹10 (maxApproved=501, check: count < 501; falls through to last tier)
   */
  getRewardTier(
    approvedCount: number,
  ): {
    reward: number;
    maxApproved: number;
    nextTier: { maxApproved: number; reward: number } | null;
  } {
    const idx = REWARD_TIERS.findIndex((t) => approvedCount < t.maxApproved);
    const currentTier = idx === -1 ? REWARD_TIERS[REWARD_TIERS.length - 1] : REWARD_TIERS[idx];
    const nextTier = idx === -1 || idx >= REWARD_TIERS.length - 1 ? null : REWARD_TIERS[idx + 1] ?? null;
    return { reward: currentTier.reward, maxApproved: currentTier.maxApproved, nextTier };
  }

  async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return { balance: Number(wallet.balance), currency: wallet.currency };
  }

  async getTransactions(
    userId: string,
    params?: { page?: number; limit?: number },
  ): Promise<{ transactions: unknown[]; total: number }> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(50, Math.max(1, params?.limit ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.transactionRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { transactions: items, total };
  }

  /**
   * Request a withdrawal.
   *
   * Enforcement chain:
   *  1. min_withdrawal_amount — backend config (from admin_config table)
   *  2. Sufficient wallet balance
   *  3. One pending request at a time (idempotency)
   */
  async withdraw(userId: string, dto: WithdrawDto): Promise<WithdrawalRequest> {
    const [wallet, minAmount] = await Promise.all([
      this.walletRepo.findOne({ where: { userId } }),
      this.adminService.getConfigValue('min_withdrawal_amount'),
    ]);

    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = Number(wallet.balance);
    if (dto.amount < minAmount) {
      throw new BadRequestException(
        `Withdrawal amount must be at least ₹${minAmount}.`,
      );
    }
    if (dto.amount > balance) {
      throw new BadRequestException('Insufficient wallet balance.');
    }

    // Prevent duplicate pending requests
    const pending = await this.withdrawalRepo.findOne({
      where: { userId, status: WithdrawalStatus.PENDING },
    });
    if (pending) {
      throw new BadRequestException(
        'A withdrawal request is already pending. Please wait for it to be processed.',
      );
    }

    // Atomic: deduct balance + create withdrawal request + create transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the wallet row
      const locked = await queryRunner.manager.findOne(Wallet, {
        where: { id: wallet.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || Number(locked.balance) < dto.amount) {
        throw new BadRequestException('Insufficient wallet balance.');
      }

      // Deduct balance
      const newBalance = Number(locked.balance) - dto.amount;
      await queryRunner.manager.update(Wallet, wallet.id, { balance: newBalance });

      // Create withdrawal request
      const withdrawal = queryRunner.manager.create(WithdrawalRequest, {
        userId,
        walletId: wallet.id,
        amount: dto.amount,
        payoutMethod: dto.payoutMethod as PayoutMethod,
        payoutDetails: dto.payoutDetails,
        status: WithdrawalStatus.PENDING,
      });
      const saved = await queryRunner.manager.save(WithdrawalRequest, withdrawal);

      // Create transaction log
      const tx = queryRunner.manager.create(Transaction, {
        walletId: wallet.id,
        type: TransactionType.DEBIT,
        source: TransactionSource.WITHDRAWAL,
        amount: dto.amount,
        balanceAfter: newBalance,
        referenceId: saved.id,
        description: `Withdrawal request — ${dto.payoutMethod}`,
        status: TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(Transaction, tx);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
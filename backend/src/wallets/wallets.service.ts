import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, Transaction, WithdrawalRequest } from '../database/entities';
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
  AuditAction,
  ActorType,
} from '../common/enums';
import { AdminService } from '../admin/admin.service';
import { WithdrawDto } from './dto';

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
    private readonly adminService: AdminService,
  ) {}

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
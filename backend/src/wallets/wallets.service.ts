import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, Transaction, WithdrawalRequest } from '../database/entities';
import { UserPaymentDetail } from '../database/entities/user-payment-detail.entity';
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
  WithdrawalStatus,
  PayoutMethod,
} from '../common/enums';
import { AdminService } from '../admin/admin.service';
import { PinelabsService } from '../payment/pinelabs.service';
import { WithdrawDto } from './dto';
import { AddPaymentDetailDto, PaymentDetailDto } from './dto/payment-details.dto';
import { encrypt, decrypt } from '../common/utils/encryption.util';

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
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(UserPaymentDetail)
    private readonly paymentDetailRepo: Repository<UserPaymentDetail>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,
    private readonly pinelabsService: PinelabsService,
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

  async getWalletConfig(): Promise<{ minWithdrawalAmount: number }> {
    const minWithdrawalAmount = await this.adminService.getConfigValue('min_withdrawal_amount');
    return { minWithdrawalAmount };
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

  async getWithdrawals(
    userId: string,
    params?: { page?: number; limit?: number },
  ): Promise<{ items: WithdrawalRequest[]; total: number; page: number; limit: number; pages: number }> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(50, Math.max(1, params?.limit ?? 20));

    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .where('wr.walletId = :walletId', { walletId: wallet.id })
      .select(['wr.id', 'wr.amount', 'wr.payoutMethod', 'wr.payoutDetails', 'wr.status', 'wr.rejectionReason', 'wr.processedAt', 'wr.createdAt', 'wr.cancelledAt'])
      .orderBy('wr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

    // Load and verify the payment detail
    const paymentDetail = await this.paymentDetailRepo.findOne( {
      where: { id: dto.paymentDetailId, userId },
    });
    if (!paymentDetail) {
      throw new NotFoundException('Payment detail not found.');
    }
    if (paymentDetail.status !== 'verified') {
      throw new BadRequestException(
        `Payment detail is not verified (current status: ${paymentDetail.status}). Please add and verify a payment method first.`,
      );
    }

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

    // Build payoutDetails from the stored payment detail
    const payoutDetails: Record<string, unknown> = paymentDetail.payoutMethod === PayoutMethod.UPI
      ? { upiId: paymentDetail.upiId }
      : {
          accountNumberEncrypted: paymentDetail.accountNumberEncrypted,
          ifsc: paymentDetail.ifsc,
          accountHolderName: paymentDetail.accountHolderName,
        };

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
        payoutMethod: paymentDetail.payoutMethod,
        payoutDetails,
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
        description: `Withdrawal request — ${paymentDetail.payoutMethod}`,
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

  /**
   * Cancel a pending withdrawal and refund the amount to the wallet.
   * Only the withdrawal owner can cancel, and only while status is PENDING.
   */
  async cancelWithdrawal(
    userId: string,
    withdrawalId: string,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found.');
    }
    if (withdrawal.userId !== userId) {
      throw new NotFoundException('Withdrawal request not found.');
    }
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending withdrawal can be cancelled.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Mark withdrawal as cancelled
      await queryRunner.manager.update(WithdrawalRequest, withdrawalId, {
        status: WithdrawalStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      // Refund balance to wallet
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: withdrawal.walletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found.');

      const newBalance = Number(wallet.balance) + Number(withdrawal.amount);
      await queryRunner.manager.update(Wallet, wallet.id, {
        balance: newBalance,
      });

      // Update the original debit transaction to reversed status
      await queryRunner.manager.update(
        Transaction,
        { referenceId: withdrawalId },
        { status: TransactionStatus.REVERSED },
      );

      await queryRunner.commitTransaction();

      // Reload to return updated entity
      const cancelled = await this.withdrawalRepo.findOne({
        where: { id: withdrawalId },
      });
      if (!cancelled) throw new NotFoundException('Withdrawal request not found.');
      return cancelled;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Payment Details ────────────────────────────────────────────────────────

  /**
   * Save a new payment detail and initiate micro-transaction verification.
   * The detail starts with status 'in_progress' and a ₹1 debit is sent via PineLabs.
   * On webhook success: status → 'verified', refund ₹1 to wallet.
   * On webhook failure: status → 'failed'.
   */
  async addPaymentDetail(
    userId: string,
    dto: AddPaymentDetailDto,
  ): Promise<{ id: string; status: string; message: string }> {
    // Basic check: does user have a wallet?
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // Reject if wallet balance < ₹1 (verification charge)
    if (Number(wallet.balance) < 1) {
      throw new BadRequestException(
        'Insufficient balance (₹1 verification charge required). Please earn rewards first.',
      );
    }

    // Check: no duplicate verified UPI already on this account
    if (dto.payoutMethod === 'upi') {
      const existing = await this.paymentDetailRepo.findOne( {
        where: { userId, upiId: dto.upiId, status: 'verified' },
      });
      if (existing) {
        throw new BadRequestException('This UPI ID is already verified on your account.');
      }
    }

    // Build entity
    const detail = new UserPaymentDetail();
    detail.userId = userId;
    detail.payoutMethod = dto.payoutMethod as PayoutMethod;
    detail.status = 'in_progress';

    if (dto.payoutMethod === 'upi') {
      detail.upiId = dto.upiId ?? null;
    } else {
      if (dto.accountNumber !== dto.confirmAccountNumber) {
        throw new BadRequestException('Account numbers do not match. Please re-enter.');
      }
      detail.accountNumberLast4 = dto.accountNumber!.slice(-4);
      detail.ifsc = dto.ifsc ?? null;
      detail.accountHolderName = dto.accountHolderName ?? null;
      detail.bankName = dto.bankName ?? null;
      detail.accountNumberEncrypted = encrypt(dto.accountNumber!);
    }

    // Save (without verification_order_id yet — we create that after debit)
    const saved = await this.paymentDetailRepo.save( detail);

    // Atomic: deduct ₹1 verification charge + create pending transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newBalance = Number(wallet.balance) - 1;
      await queryRunner.manager.update(Wallet, wallet.id, { balance: newBalance });

      const verificationOrderId = this.pinelabsService.generateVerificationOrderId(saved.id);
      const tx = queryRunner.manager.create(Transaction, {
        walletId: wallet.id,
        type: TransactionType.DEBIT,
        source: TransactionSource.WITHDRAWAL,
        amount: 1,
        balanceAfter: newBalance,
        referenceId: verificationOrderId, // used to match refund webhook
        description: `Verification charge — ${dto.payoutMethod === 'upi' ? 'UPI' : 'bank account'}`,
        status: TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(Transaction, tx);

      // Store orderId on the detail record
      await queryRunner.manager.update(UserPaymentDetail, saved.id, {
        verificationOrderId,
      });

      await queryRunner.commitTransaction();

      // Fire-and-forget: send ₹1 to PineLabs (webhook will handle the result)
      this.pinelabsService
        .dispatchVerificationPayout({
          orderId: verificationOrderId,
          paymentMethod: dto.payoutMethod as PayoutMethod,
          payoutDetails: this.buildPayoutDetailsForVerification(saved),
        })
        .catch((err) => this.logger.error(`[Verification] Payout dispatch failed: ${err.message}`));

      return {
        id: saved.id,
        status: 'in_progress',
        message:
          'Payment detail saved. A ₹1 verification charge has been sent. ' +
          'You will be notified once it is confirmed (usually within a few minutes).',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      // Clean up the payment detail record on failure
      await this.paymentDetailRepo.delete( saved.id);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get all payment details for a user (masked).
   * Never returns the full account number or decrypted data.
   */
  async getPaymentDetails(userId: string): Promise<PaymentDetailDto[]> {
    const details = await this.paymentDetailRepo.find( {
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return details.map((d) => ({
      id: d.id,
      payoutMethod: d.payoutMethod as 'upi' | 'bank_transfer',
      status: d.status as 'pending' | 'in_progress' | 'verified' | 'failed',
      displayValue:
        d.payoutMethod === PayoutMethod.UPI
          ? (d.upiId ?? '—')
          : d.accountNumberLast4 ? `****${d.accountNumberLast4}` : '****',
      bankName: d.bankName,
      ifsc: d.ifsc,
      accountHolderName: d.accountHolderName,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    }));
  }

  /**
   * Delete a payment detail.
   * Only unverified or failed details can be deleted.
   * Users cannot delete a detail that has an active verification in progress.
   */
  async deletePaymentDetail(userId: string, detailId: string): Promise<void> {
    const detail = await this.paymentDetailRepo.findOne( {
      where: { id: detailId, userId },
    });
    if (!detail) throw new NotFoundException('Payment detail not found');
    if (detail.status === 'verified') {
      throw new BadRequestException('Cannot delete a verified payment detail.');
    }
    if (detail.status === 'in_progress') {
      throw new BadRequestException('Cannot delete while verification is in progress. Please wait a few minutes.');
    }
    await this.paymentDetailRepo.delete( detailId);
  }

  /**
   * Called by the PineLabs webhook handler to mark a payment detail verified or failed.
   * If successful: marks detail verified, refunds the ₹1 charge to the user's wallet.
   * If failed: marks detail failed (no refund needed).
   */
  async handleVerificationCallback(params: {
    orderId: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    pinelabsTransactionId?: string;
  }): Promise<void> {
    const detail = await this.paymentDetailRepo.findOne( {
      where: { verificationOrderId: params.orderId },
      relations: ['user'],
    });
    if (!detail) {
      this.logger.warn(`[Verification] No payment detail found for orderId=${params.orderId}`);
      return;
    }

    if (params.success) {
      // Mark verified
      await this.paymentDetailRepo.update( detail.id, {
        status: 'verified',
        verifiedAt: new Date(),
      });

      // Refund ₹1 to user's wallet
      const wallet = await this.walletRepo.findOne({ where: { userId: detail.userId } });
      if (wallet) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const newBalance = Number(wallet.balance) + 1;
          await queryRunner.manager.update(Wallet, wallet.id, { balance: newBalance });

          // Credit refund transaction
          const creditTx = queryRunner.manager.create(Transaction, {
            walletId: wallet.id,
            type: TransactionType.CREDIT,
            source: TransactionSource.REFUND,
            amount: 1,
            balanceAfter: newBalance,
            referenceId: params.orderId,
            description: 'Verification refund — payment detail confirmed',
            status: TransactionStatus.COMPLETED,
          });
          await queryRunner.manager.save(Transaction, creditTx);

          // Update debit tx to completed
          await queryRunner.manager.update(
            Transaction,
            { referenceId: params.orderId },
            { status: TransactionStatus.COMPLETED },
          );

          await queryRunner.commitTransaction();
        } catch (err) {
          await queryRunner.rollbackTransaction();
          this.logger.error(`[Verification] Refund failed for orderId=${params.orderId}: ${err.message}`);
        } finally {
          await queryRunner.release();
        }
      }

      this.logger.log(`[Verification] Payment detail verified | detailId=${detail.id} | orderId=${params.orderId}`);
    } else {
      // Mark failed
      await this.paymentDetailRepo.update( detail.id, {
        status: 'failed',
        verificationFailedReason: [params.errorCode, params.errorMessage].filter(Boolean).join(': '),
      });

      // Mark the ₹1 debit as failed
      await this.transactionRepo.update(
        { referenceId: params.orderId },
        { status: TransactionStatus.FAILED },
      );

      this.logger.warn(`[Verification] Payment detail failed | detailId=${detail.id} | code=${params.errorCode} | msg=${params.errorMessage}`);
    }
  }

  /**
   * Check whether user has at least one verified payment detail.
   */
  async hasVerifiedPaymentDetail(userId: string): Promise<boolean> {
    const count = await this.paymentDetailRepo.count( {
      where: { userId, status: 'verified' },
    });
    return count > 0;
  }

  /**
   * Get the decrypted account number for a verified payment detail.
   * Only used when dispatching a withdrawal payout.
   */
  async getDecryptedPayoutDetails(detailId: string): Promise<Record<string, unknown>> {
    const detail = await this.paymentDetailRepo.findOne( {
      where: { id: detailId, status: 'verified' },
    });
    if (!detail) throw new NotFoundException('Verified payment detail not found');
    return this.buildPayoutDetailsForVerification(detail);
  }

  /**
   * Build the payoutDetails object from a UserPaymentDetail entity.
   * For bank accounts, uses the encrypted account number.
   */
  private buildPayoutDetailsForVerification(detail: UserPaymentDetail): Record<string, unknown> {
    if (detail.payoutMethod === PayoutMethod.UPI) {
      return { upiId: detail.upiId };
    }
    return {
      accountNumberEncrypted: detail.accountNumberEncrypted,
      ifsc: detail.ifsc,
      accountHolderName: detail.accountHolderName,
      accountNumber: undefined as unknown, // placeholder — not used when encrypted field is present
    };
  }
}
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet, Transaction, WithdrawalRequest, User } from '../database/entities';
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
import { RazorpayPayoutService } from '../payment/razorpay-payout.service';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,
    private readonly pinelabsService: PinelabsService,
    private readonly razorpayPayoutService: RazorpayPayoutService,
    private readonly configService: ConfigService,
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

  async getWalletConfig(): Promise<{
    minWithdrawalAmount: number;
    razorpayKeyId: string;
  }> {
    const minWithdrawalAmount = await this.adminService.getConfigValue('min_withdrawal_amount');
    const razorpayKeyId = this.configService.get<string>('payment.razorpay.apiKey') ?? '';
    return { minWithdrawalAmount, razorpayKeyId };
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

  async getWithdrawal(userId: string, withdrawalId: string) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId, walletId: wallet.id },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');

    return withdrawal;
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
          ifsc: paymentDetail.ifscEncrypted ? decrypt(paymentDetail.ifscEncrypted) : null,
          accountHolderName: paymentDetail.accountHolderNameEncrypted ? decrypt(paymentDetail.accountHolderNameEncrypted) : null,
          bankName: paymentDetail.bankName,
          accountNumber: paymentDetail.accountNumberEncrypted
            ? decrypt(paymentDetail.accountNumberEncrypted)
            : null,
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

  /**
   * Credit a reversed payout amount back to the user's wallet.
   * Called exclusively from the Razorpay payout.reversed webhook handler.
   *
   * The payout was already debited from the wallet when the withdrawal was created.
   * When it gets reversed, we credit the amount back + create a REFUND transaction log.
   */
  async creditReversedWithdrawal(
    walletId: string,
    amount: number,
    withdrawalId: string,
    payoutId: string,
  ): Promise<Wallet> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found for reversed payout credit');
      }

      const newBalance = Number(wallet.balance) + Number(amount);

      // Credit the reversed amount back to wallet
      await queryRunner.manager.update(Wallet, walletId, { balance: newBalance });

      // Create a REFUND transaction record
      const refundTx = queryRunner.manager.create(Transaction, {
        walletId,
        type: TransactionType.CREDIT,
        source: TransactionSource.REFUND,
        amount,
        balanceAfter: newBalance,
        referenceId: payoutId,
        description: `Withdrawal reversal — payout ${payoutId} was reversed by bank`,
        status: TransactionStatus.COMPLETED,
      });
      await queryRunner.manager.save(Transaction, refundTx);

      // Mark the original debit transaction as reversed
      await queryRunner.manager.update(
        Transaction,
        { referenceId: withdrawalId },
        { status: TransactionStatus.REVERSED },
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `[Reversal] ₹${amount} credited to wallet ${walletId} | withdrawal=${withdrawalId} | payout=${payoutId}`,
      );

      return wallet;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[Reversal] Failed to credit wallet ${walletId}: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Payment Details ────────────────────────────────────────────────────────


  async addPaymentDetail(
    userId: string,
    dto: AddPaymentDetailDto,
  ): Promise<{
    id: string;
    status: string;
    message: string;
  }> {
    // Check: no duplicate verified UPI already on this account
    if (dto.payoutMethod === 'upi') {
      const existing = await this.paymentDetailRepo.findOne({
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
      detail.bankName = dto.bankName ?? null;
      detail.accountNumberEncrypted = encrypt(dto.accountNumber!);
      detail.ifscEncrypted = encrypt(dto.ifsc!);
      detail.accountHolderNameEncrypted = encrypt(dto.accountHolderName!);
    }

    // Save with status in_progress
    const saved = await this.paymentDetailRepo.save(detail);

    // Load user to get phone and existing Razorpay contact ID
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const userPhone = user?.mobileNumber ?? '9999999999';

    try {
      // Step 1: Create or reuse Razorpay Contact
      const contactResult = await this.razorpayPayoutService.createContact({
        userId,
        phone: userPhone,
        name: user?.name ?? 'User',
      });

      // Persist the contact ID on the user for reuse
      if (!user?.razorpayContactId) {
        await this.userRepo.update(userId, { razorpayContactId: contactResult.contactId });
      }

      // Step 2: Create Fund Account (idempotent per user via X-Goa-Idempotency-Key)
      const fundAccountResult = await this.razorpayPayoutService.createFundAccount({
        userId,
        phone: userPhone,
        name: user?.name ?? 'User',
        existingContactId: contactResult.contactId,
        vpa: dto.payoutMethod === 'upi' ? dto.upiId! : undefined,
        bankAccount:
          dto.payoutMethod !== 'upi'
            ? {
                accountNumber: dto.accountNumber!,
                ifsc: dto.ifsc!,
                accountHolderName: dto.accountHolderName!,
              }
            : undefined,
      });

      // Step 3: Initiate Fund Account Validation
      const validationResult = await this.razorpayPayoutService.validateFundAccount({
        fundAccountId: fundAccountResult.fundAccountId,
        contactId: contactResult.contactId,
        paymentDetailId: saved.id,
        userPhone,
      });

      // Persist IDs on the payment detail record
      await this.paymentDetailRepo.update(saved.id, {
        razorpayFundAccountId: fundAccountResult.fundAccountId,
        razorpayValidationId: validationResult.validationId,
      });

      // Step 4: For VPAs, Razorpay may return status=completed synchronously.
      // If so, mark the detail verified immediately instead of waiting for a webhook.
      if (validationResult.status === 'completed') {
        await this.paymentDetailRepo.update(saved.id, {
          status: 'verified',
          verifiedAt: new Date(),
        });
        return {
          id: saved.id,
          status: 'verified',
          message:
            `Your ${dto.payoutMethod === 'upi' ? 'UPI ID' : 'bank account'} has been verified successfully.`,
        };
      }

      return {
        id: saved.id,
        status: 'in_progress',
        message:
          `Your ${dto.payoutMethod === 'upi' ? 'UPI ID' : 'bank account'} is being verified. ` +
          `This usually takes a few seconds. You'll be notified once verification is complete.`,
      };
    } catch (err: any) {
      // Clean up the payment detail if we couldn't initiate validation
      await this.paymentDetailRepo.delete(saved.id);
      this.logger.error(`[addPaymentDetail] Fund account validation failed: ${err.message}`);
      throw new BadRequestException(
        'Could not initiate account verification. Please check your details and try again.',
      );
    }
  }

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
      ifsc: d.ifscEncrypted ? decrypt(d.ifscEncrypted) : null,
      accountHolderName: d.accountHolderNameEncrypted ? decrypt(d.accountHolderNameEncrypted) : null,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
      // Include payment link URL while verification is still in progress
      paymentLinkUrl: d.status === 'in_progress' ? d.razorpayPaymentLinkUrl ?? undefined : undefined,
    }));
  }

  /**
   * Delete a payment detail.
   * Users cannot delete a detail that has an active verification in progress.
   */
  async deletePaymentDetail(userId: string, detailId: string): Promise<void> {
    const detail = await this.paymentDetailRepo.findOne({
      where: { id: detailId, userId },
    });
    if (!detail) throw new NotFoundException('Payment detail not found');
    await this.paymentDetailRepo.delete(detailId);
  }

  /**
   * Auto-verify a payment detail for development/demo purposes.
   * Only works when PINELABS_MOCK_VERIFICATION=true on the server.
   * Marks the payment detail as verified without any ₹1 micro-transaction.
   */
  async autoVerifyPaymentDetail(userId: string, detailId: string): Promise<{ success: boolean; message: string }> {
    const mockVerification = this.configService.get<boolean>('payment.pinelabs.mockVerification') ?? false;

    if (!mockVerification) {
      throw new BadRequestException(
        'Auto-verify is only available when mock verification is enabled on the server.',
      );
    }

    const detail = await this.paymentDetailRepo.findOne({
      where: { id: detailId, userId },
    });

    if (!detail) {
      throw new NotFoundException('Payment detail not found');
    }

    if (detail.status === 'verified') {
      return { success: true, message: 'Already verified' };
    }

    await this.paymentDetailRepo.update(detailId, {
      status: 'verified',
      verifiedAt: new Date(),
    });

    this.logger.log(`[AutoVerify] Payment detail verified | detailId=${detailId} | userId=${userId}`);

    return { success: true, message: 'Payment method verified successfully' };
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
    /** Razorpay only: registered name returned by the bank (from fund_account.validated webhook) */
    registeredName?: string;
  }): Promise<void> {
    // Support both PineLabs (VF_*) and Razorpay (rzp_pl_*) order ID formats.
    // PineLabs: VF_<paymentDetailId>_<uuid>  → matches UserPaymentDetail.verificationOrderId
    // Razorpay: rzp_pl_<paymentDetailId>     → extract paymentDetailId and find by primary key
    let detail: UserPaymentDetail | null = null;

    // Resolve paymentDetailId from orderId prefix:
    // - rzp_pl_<paymentDetailId>  → Razorpay payment link (old ₹1 flow)
    // - fav_<paymentDetailId>      → Razorpay fund account validation (new flow)
    // - VF_<paymentDetailId>_...   → PineLabs (legacy)
    let paymentDetailId: string | null = null;

    if (params.orderId.startsWith('rzp_pl_')) {
      paymentDetailId = params.orderId.replace('rzp_pl_', '');
    } else if (params.orderId.startsWith('fav_')) {
      // Look up the payment detail by razorpayValidationId
      const validationDetail = await this.paymentDetailRepo.findOne({
        where: { razorpayValidationId: params.orderId },
      });
      paymentDetailId = validationDetail?.id ?? null;
    }
    // else: PineLabs or other — try by verificationOrderId below

    if (paymentDetailId) {
      detail = await this.paymentDetailRepo.findOne({ where: { id: paymentDetailId } });
    } else {
      detail = await this.paymentDetailRepo.findOne({
        where: { verificationOrderId: params.orderId },
        relations: ['user'],
      });
    }

    if (!detail) {
      this.logger.warn(`[Verification] No payment detail found for orderId=${params.orderId}`);
      return;
    }

    if (params.success) {
      // Mark verified
      await this.paymentDetailRepo.update(detail.id, {
        status: 'verified',
        verifiedAt: new Date(),
      });

      // Refund ₹1 to user's wallet — only for PineLabs verification (VF_* order IDs).
      // For Razorpay Payment Link (rzp_pl_*), the user paid us ₹1 — no refund needed.
      const isPineLabsVerification = params.orderId.startsWith('VF_');

      if (isPineLabsVerification) {
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
    }

    this.logger.log(`[Verification] Payment detail verified | detailId=${detail.id} | orderId=${params.orderId}`);
  } else {
    // Mark failed
    await this.paymentDetailRepo.update(detail.id, {
      status: 'failed',
      verificationFailedReason: [params.errorCode, params.errorMessage].filter(Boolean).join(': '),
    });

    // Mark the ₹1 debit as failed — only for PineLabs flow (Razorpay has no debit)
    if (params.orderId.startsWith('VF_')) {
      await this.transactionRepo.update(
        { referenceId: params.orderId },
        { status: TransactionStatus.FAILED },
      );
    }

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
   * Handle verification callback when the mobile app uses the native Razorpay SDK.
   * The SDK returns razorpay_payment_id on success; we fetch payment details from
   * Razorpay API to confirm it was for the right amount, then mark the detail verified.
   */
  async handleRazorpayVerificationCallback(params: {
    userId: string;
    paymentDetailId: string;
    razorpayPaymentId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { userId, paymentDetailId, razorpayPaymentId } = params;

    const detail = await this.paymentDetailRepo.findOne({
      where: { id: paymentDetailId, userId },
    });
    if (!detail) {
      throw new NotFoundException('Payment detail not found');
    }

    if (detail.status === 'verified') {
      return { success: true, message: 'Already verified' };
    }

    // Fetch the payment from Razorpay to confirm amount and status
    const payment = await this.razorpayPayoutService.getRazorpayPayment(razorpayPaymentId);

    if (!payment) {
      this.logger.warn(`[Razorpay Verification] Payment not found: ${razorpayPaymentId}`);
      throw new BadRequestException('Payment not found on Razorpay');
    }

    if (payment.status !== 'captured') {
      this.logger.warn(
        `[Razorpay Verification] Payment not captured: ${razorpayPaymentId} status=${payment.status}`,
      );
      throw new BadRequestException(`Payment not captured (status: ${payment.status})`);
    }

    // Amount should be 100 paise (₹1) for verification payments
    if (Number(payment.amount) !== 100) {
      this.logger.warn(
        `[Razorpay Verification] Unexpected amount ${payment.amount} for payment ${razorpayPaymentId}`,
      );
      throw new BadRequestException('Invalid payment amount');
    }

    // Mark verified
    await this.paymentDetailRepo.update(detail.id, {
      status: 'verified',
      verifiedAt: new Date(),
    });

    this.logger.log(
      `[Razorpay Verification] Payment detail verified via SDK | detailId=${detail.id} | paymentId=${razorpayPaymentId}`,
    );

    return { success: true, message: 'Payment verified successfully' };
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
   * For bank accounts, passes accountNumberEncrypted so PinelabsService.decryptPayoutBank
   * handles decryption at payout dispatch time.
   */
  private buildPayoutDetailsForVerification(detail: UserPaymentDetail): Record<string, unknown> {
    if (detail.payoutMethod === PayoutMethod.UPI) {
      return { upiId: detail.upiId };
    }
    return {
      accountNumberEncrypted: detail.accountNumberEncrypted,
      ifscEncrypted: detail.ifscEncrypted,
      accountHolderNameEncrypted: detail.accountHolderNameEncrypted,
    };
  }
}
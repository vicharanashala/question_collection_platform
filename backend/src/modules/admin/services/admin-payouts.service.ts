import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from "@nestjs/common";
import { Transaction, Notification, PaymentLog, UserPaymentDetail } from "../../../shared/database/entities";
import {
  UserRole,
  ActorType,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
  PaymentLogStatus,
} from "../../../shared/classes/enums";
import { AnalyticsQueryDto, ListWithdrawalsDto, ProcessWithdrawalDto } from "../dto";
import { RazorpayPayoutService } from "../../payment/services/razorpay-payout.service";
import { decrypt } from "../../../shared/utils/encryption.util";
import {
  IUserRepository,
  IWalletRepository,
  ITransactionRepository,
  IWithdrawalRequestRepository,
  INotificationRepository,
  IPaymentLogRepository,
  IUserPaymentDetailRepository,
} from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { MongoTransactionService } from "../../../shared/database/mongodb/mongo-transaction.service";
import { Types } from "mongoose";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Wallet } from "@/shared/database/mongodb/schemas/wallet.schema";
import { NotificationType, NotificationTriggerType } from "../../../shared/classes/enums";
import { WithdrawalRequest } from "@/shared/database/mongodb/schemas/withdrawal-request.schema";

// Reward payouts: withdrawal processing, retries, failures and reward logs.
@Injectable()
export class AdminPayoutsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Wallet)
    private readonly walletRepo: IWalletRepository,
    @Inject(REPOSITORY_TOKENS.Transaction)
    private readonly transactionRepo: ITransactionRepository,
    @Inject(REPOSITORY_TOKENS.WithdrawalRequest)
    private readonly withdrawalRepo: IWithdrawalRequestRepository,
    @Inject(REPOSITORY_TOKENS.Notification)
    private readonly notificationRepo: INotificationRepository,
    @Inject(REPOSITORY_TOKENS.PaymentLog)
    private readonly paymentLogRepo: IPaymentLogRepository,
    @Inject(REPOSITORY_TOKENS.UserPaymentDetail)
    private readonly paymentDetailRepo: IUserPaymentDetailRepository,
    private readonly razorpayPayoutService: RazorpayPayoutService,
    private readonly mongoTransactionService: MongoTransactionService,
  ) {}

  private readonly logger = new Logger(AdminPayoutsService.name);

  // ─────────────────────────────────────────────────────────────
  // Section 5: Reward & Payout
  // ─────────────────────────────────────────────────────────────

  async listWithdrawals(dto: ListWithdrawalsDto) {
    const {
      page = 1,
      limit = 20,
      status,
      state,
      search,
      sortBy = "createdAt",
      sortOrder = "DESC",
      fromDate,
      toDate,
      filterStatus,
      tester,
      anveshanScope,
    } = dto;

    const result = await this.withdrawalRepo.listWithdrawals({
      page,
      limit,
      status,
      state,
      search,
      sortBy,
      sortOrder,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      filterStatus,
      tester,
      anveshanScope,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      pages: Math.ceil(result.total / limit),
    };
  }

  //     // ── Step 4: Update withdrawal based on Razorpay response ─────────────────
  //     const { payoutId, status: razorpayStatus } = payoutResult;
  //     const finalStatus =
  //       razorpayStatus === "success" || razorpayStatus === "processed"
  //         ? WithdrawalStatus.COMPLETED
  //         : razorpayStatus === "failed" || razorpayStatus === "rejected"
  //           ? WithdrawalStatus.FAILED
  //           : WithdrawalStatus.PROCESSING;

  //     const actorType: ActorType =
  //       reviewerRole === UserRole.FINANCE
  //         ? ActorType.FINANCE
  //         : reviewerRole === UserRole.CURATOR
  //           ? ActorType.CURATOR
  //           : ActorType.ADMIN;

  //     // await this.logAudit({
  //     //   actorType,
  //     //   actorId: adminId,
  //     //   action:
  //     //     finalStatus === WithdrawalStatus.COMPLETED
  //     //       ? "withdrawal_completed"
  //     //       : "withdrawal_approved",
  //     //   entityType: "withdrawal_request",
  //     //   entityId: withdrawalId,
  //     // });

  async processWithdrawal(
    adminId: string,
    withdrawalId: string,
    dto: ProcessWithdrawalDto,
    reviewerRole?: UserRole,
  ) {
    if (!Types.ObjectId.isValid(withdrawalId)) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const alreadyProcessed = (status: WithdrawalStatus) => ({
      success: true,
      action: status === WithdrawalStatus.PROCESSING ? "approved" : "rejected",
      withdrawalId,
      status,
    });

    const withdrawal = await this.withdrawalRepo.findById(withdrawalId);
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return alreadyProcessed(withdrawal.status);
    }

    // ───────────────────────────── APPROVE ─────────────────────────────
    if (dto.action === "approve") {
      // No joins in Mongo: fetch the user explicitly
      const user = await this.userRepo.findById(withdrawal.userId);
      if (!user)
        throw new NotFoundException("User not found for this withdrawal");

      const paymentDetail =
        await this.paymentDetailRepo.findLatestVerifiedByUserId(
          withdrawal.userId,
        );
      if (!paymentDetail) {
        throw new BadRequestException(
          "No verified payment detail found for this user.",
        );
      }

      // Atomic claim: only one admin request can move PENDING -> PROCESSING,
      // so two simultaneous approvals can never trigger two payouts.
      const claimed = await this.withdrawalRepo.findOneAndUpdate(
        { _id: withdrawalId, status: WithdrawalStatus.PENDING },
        { status: WithdrawalStatus.PROCESSING },
      );
      if (!claimed) {
        const current = await this.withdrawalRepo.findById(withdrawalId);
        return alreadyProcessed(current?.status ?? WithdrawalStatus.PROCESSING);
      }

      // Fund account setup. If this throws, release the claim so it can be retried
      // (matches the old behaviour where status stayed PENDING).
      let fundAccountId = paymentDetail.razorpayFundAccountId;
      try {
        if (!fundAccountId) {
          const fundAccount =
            await this.razorpayPayoutService.createFundAccount({
              userId: withdrawal.userId,
              phone: user.mobileNumber,
              name: user.name ?? "User",
              existingContactId: user.razorpayContactId ?? undefined,
              vpa: paymentDetail.upiId ?? undefined,
              bankAccount:
                paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
                  ? {
                      accountNumber: decrypt(
                        paymentDetail.accountNumberEncrypted,
                      ),
                      ifsc: paymentDetail.ifsc,
                      accountHolderName: paymentDetail.accountHolderName ?? "",
                    }
                  : undefined,
            });
          fundAccountId = fundAccount.fundAccountId;

          await this.paymentDetailRepo.update(paymentDetail._id.toString(), {
            razorpayFundAccountId: fundAccountId,
          });
          if (!user.razorpayContactId) {
            await this.userRepo.update(withdrawal.userId, {
              razorpayContactId: fundAccount.contactId,
            });
          }
        }
      } catch (err) {
        await this.withdrawalRepo.update(withdrawalId, {
          status: WithdrawalStatus.PENDING,
        });
        throw err;
      }

      const referenceId = `wd_${withdrawalId}`;
      const amountPaise = Math.round(Number(withdrawal.amount) * 100);
      const payoutMode = withdrawal.payoutMethod === "upi" ? "UPI" : "IMPS";

      let payoutResult: {
        payoutId: string;
        status: string;
        utrNumber?: string | null;
      };
      try {
        payoutResult = await this.razorpayPayoutService.initiatePayout({
          fundAccountId,
          amount: amountPaise,
          referenceId,
          mode: payoutMode,
          narration: "Withdrawal payout",
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[Razorpay] initiatePayout failed for withdrawal ${withdrawalId}: ${errorMessage}`,
        );
        await this.handleWithdrawalFailure({
          withdrawal,
          orderId: referenceId,
          adminId,
          result: {
            pinelabsTransactionId: null,
            errorCode: "RAZORPAY_INIT_ERROR",
            errorMessage,
            rawResponse: {},
          },
        });
        return {
          success: true,
          action: "approved",
          withdrawalId,
          status: WithdrawalStatus.FAILED,
          paymentFailed: true,
          errorCode: "RAZORPAY_INIT_ERROR",
          errorMessage,
        };
      }

      const { payoutId, status: razorpayStatus } = payoutResult;
      const finalStatus =
        razorpayStatus === "success" || razorpayStatus === "processed"
          ? WithdrawalStatus.COMPLETED
          : razorpayStatus === "failed" || razorpayStatus === "rejected"
            ? WithdrawalStatus.FAILED
            : WithdrawalStatus.PROCESSING;

      await this.withdrawalRepo.update(withdrawalId, {
        status: finalStatus,
        processedAt:
          finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
        razorpayPayoutId: payoutId,
        orderId: referenceId,
        utrNumber: payoutResult.utrNumber ?? null,
      });

      await this.paymentLogRepo.save(
        await this.paymentLogRepo.create({
          withdrawalRequestId: withdrawalId,
          adminId,
          orderId: referenceId,
          razorpayPayoutId: payoutId,
          utrNumber: payoutResult.utrNumber ?? null,
          status:
            finalStatus === WithdrawalStatus.COMPLETED
              ? PaymentLogStatus.SUCCESS
              : finalStatus === WithdrawalStatus.FAILED
                ? PaymentLogStatus.FAILED
                : PaymentLogStatus.PENDING,
        }),
      );

      const actorType: ActorType =
        reviewerRole === UserRole.FINANCE
          ? ActorType.FINANCE
          : reviewerRole === UserRole.CURATOR
            ? ActorType.CURATOR
            : ActorType.ADMIN;
      // logAudit stays commented out as before; actorType is ready for it.

      if (finalStatus === WithdrawalStatus.FAILED) {
        await this.handleWithdrawalFailure({
          withdrawal,
          orderId: referenceId,
          adminId,
          result: {
            pinelabsTransactionId: null,
            errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
            errorMessage: `Razorpay payout status: ${razorpayStatus}`,
            rawResponse: { payoutId, razorpayStatus },
          },
        });
      } else {
        await this.notificationRepo.save(
          await this.notificationRepo.create({
            userId: withdrawal.userId,
            type: NotificationType.WITHDRAWAL_APPROVED,
            title: "Withdrawal Approved",
            body:
              finalStatus === WithdrawalStatus.COMPLETED
                ? `Your withdrawal of Rs. ${withdrawal.amount} has been credited to your account.`
                : `Your withdrawal of Rs. ${withdrawal.amount} has been approved and will be processed shortly.`,
            data: {
              withdrawalId,
              status:
                finalStatus === WithdrawalStatus.COMPLETED
                  ? "completed"
                  : "processing",
              userId: withdrawal.userId,
            },
            triggerType: NotificationTriggerType.WITHDRAW,
          }),
        );
      }

      return {
        success: true,
        action: "approved",
        withdrawalId,
        status: finalStatus,
        razorpayPayoutId: payoutId,
        paymentFailed: finalStatus === WithdrawalStatus.FAILED,
      };
    }

    // ───────────────────────────── REJECT ─────────────────────────────
    const rejectionReason = dto.rejectionReason ?? "Rejected by admin";

    // Claim FIRST (PENDING -> REJECTED), then refund. A retry or double click can
    // never refund twice. If the process crashes between the claim and the refund,
    // you get a rejected withdrawal with no REFUND transaction, which is detectable
    // and fixable, whereas a double refund creates money.
    const claimed = await this.withdrawalRepo.findOneAndUpdate(
      { _id: withdrawalId, status: WithdrawalStatus.PENDING },
      {
        status: WithdrawalStatus.REJECTED,
        processedAt: new Date(),
        failureReason: rejectionReason,
      },
    );
    if (!claimed) {
      const current = await this.withdrawalRepo.findById(withdrawalId);
      return alreadyProcessed(current?.status ?? WithdrawalStatus.REJECTED);
    }

    const refundedBalance = await this.walletRepo.incrementBalance(
      withdrawal.walletId,
      Number(withdrawal.amount),
    );
    if (refundedBalance === null) {
      this.logger.error(
        `Wallet ${withdrawal.walletId} not found while refunding withdrawal ${withdrawalId}`,
      );
    }
    const newBalance = refundedBalance ?? 0;

    await this.transactionRepo.updateMany(
      { referenceId: withdrawalId, status: TransactionStatus.PENDING },
      { status: TransactionStatus.REJECTED, rejectionReason },
    );

    await this.transactionRepo.save(
      await this.transactionRepo.create({
        walletId: withdrawal.walletId,
        amount: Number(withdrawal.amount),
        type: TransactionType.CREDIT,
        source: TransactionSource.REFUND,
        description: `Withdrawal refunded${rejectionReason ? ": " + rejectionReason : ""}`,
        status: TransactionStatus.COMPLETED,
        referenceId: withdrawalId,
        balanceAfter: newBalance,
      }),
    );

    await this.notificationRepo.save(
      await this.notificationRepo.create({
        userId: withdrawal.userId,
        type: NotificationType.WITHDRAWAL_REJECTED,
        title: "Withdrawal Rejected",
        body: `Your withdrawal of Rs. ${withdrawal.amount} was rejected.${rejectionReason ? " Reason: " + rejectionReason + "." : ""} Rs. ${withdrawal.amount} has been credited back to your wallet.`,
        data: {
          withdrawalId,
          status: "rejected",
          reason: rejectionReason,
          userId: withdrawal.userId,
        },
        triggerType: NotificationTriggerType.WITHDRAW,
      }),
    );

    return {
      success: true,
      action: "rejected",
      withdrawalId,
      status: WithdrawalStatus.REJECTED,
    };
  }

  /**
   * Retry a PROCESSING withdrawal via Razorpay.
   * On payout failure the withdrawal is marked FAILED (no auto-refund —
   * admin must explicitly call markWithdrawalFailed to refund the user).
   */

  //   const { payoutId, status: razorpayStatus } = payoutResult;
  //   const finalStatus =
  //     razorpayStatus === "success" || razorpayStatus === "processed"
  //       ? WithdrawalStatus.COMPLETED
  //       : razorpayStatus === "failed" || razorpayStatus === "rejected"
  //         ? WithdrawalStatus.FAILED
  //         : WithdrawalStatus.PROCESSING;

  //   // await this.logAudit({
  //   //   actorType: ActorType.ADMIN,
  //   //   actorId: adminId,
  //   //   action: "withdrawal_completed",
  //   //   entityType: "withdrawal_request",
  //   //   entityId: withdrawalId,
  //   // });

  private async getLatestVerifiedPaymentDetail(userId: string) {
    const details = await this.paymentDetailRepo.findAll({
      userId,
      status: "verified",
    });
    const time = (d: { verifiedAt: Date | null }) =>
      d.verifiedAt ? new Date(d.verifiedAt).getTime() : 0;
    return details.sort((a, b) => time(b) - time(a))[0] ?? null;
  }

  async retryWithdrawal(
    adminId: string,
    withdrawalId: string,
  ): Promise<{
    success: boolean;
    withdrawalId: string;
    status: WithdrawalStatus;
    paymentFailed?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }> {
    if (!Types.ObjectId.isValid(withdrawalId)) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = await this.withdrawalRepo.findById(withdrawalId);
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");
    if (withdrawal.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(
        `Cannot retry withdrawal in '${withdrawal.status}' status. Only PROCESSING withdrawals can be retried.`,
      );
    }
    if (!withdrawal.orderId) {
      throw new BadRequestException(
        "No orderId found for this withdrawal. Please re-approve the withdrawal first.",
      );
    }

    const user = await this.userRepo.findById(withdrawal.userId);
    if (!user)
      throw new NotFoundException("User not found for this withdrawal");

    // Latest verified payment detail (same lookup as processWithdrawal)
    const details = await this.paymentDetailRepo.findAll({
      userId: withdrawal.userId,
      status: "verified",
    });
    const paymentDetail = await this.getLatestVerifiedPaymentDetail(
      withdrawal.userId,
    );
    if (!paymentDetail) {
      throw new BadRequestException(
        "No verified payment detail found for this user.",
      );
    }

    // Optimistic lock: only one concurrent retry can move retryCount from N to N+1
    const claimed = await this.withdrawalRepo.findOneAndUpdate(
      {
        _id: withdrawalId,
        status: WithdrawalStatus.PROCESSING,
        retryCount: withdrawal.retryCount ?? 0,
      },
      { $inc: { retryCount: 1 } },
    );
    if (!claimed) {
      throw new BadRequestException(
        "This withdrawal is already being retried. Please refresh.",
      );
    }

    let fundAccountId = paymentDetail.razorpayFundAccountId;
    if (!fundAccountId) {
      const fundAccount = await this.razorpayPayoutService.createFundAccount({
        userId: withdrawal.userId,
        phone: user.mobileNumber,
        name: user.name ?? "User",
        existingContactId: user.razorpayContactId ?? undefined,
        vpa: paymentDetail.upiId ?? undefined,
        bankAccount:
          paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
            ? {
                accountNumber: decrypt(paymentDetail.accountNumberEncrypted),
                ifsc: paymentDetail.ifsc,
                accountHolderName: paymentDetail.accountHolderName ?? "",
              }
            : undefined,
      });
      fundAccountId = fundAccount.fundAccountId;
      await this.paymentDetailRepo.update(paymentDetail._id.toString(), {
        razorpayFundAccountId: fundAccountId,
      });
      if (!user.razorpayContactId) {
        await this.userRepo.update(withdrawal.userId, {
          razorpayContactId: fundAccount.contactId,
        });
      }
    }

    const referenceId = `wd_${withdrawalId}`;
    const amountPaise = Math.round(Number(withdrawal.amount) * 100);
    const payoutMode = withdrawal.payoutMethod === "upi" ? "UPI" : "IMPS";

    let payoutResult: {
      payoutId: string;
      status: string;
      utrNumber?: string | null;
    };
    try {
      payoutResult = await this.razorpayPayoutService.initiatePayout({
        fundAccountId,
        amount: amountPaise,
        referenceId,
        mode: payoutMode,
        narration: "Withdrawal payout retry",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: "RAZORPAY_INIT_ERROR",
          errorMessage,
          rawResponse: {},
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: "RAZORPAY_INIT_ERROR",
        errorMessage,
      };
    }

    const { payoutId, status: razorpayStatus } = payoutResult;
    const finalStatus =
      razorpayStatus === "success" || razorpayStatus === "processed"
        ? WithdrawalStatus.COMPLETED
        : razorpayStatus === "failed" || razorpayStatus === "rejected"
          ? WithdrawalStatus.FAILED
          : WithdrawalStatus.PROCESSING;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt:
        finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
      razorpayPayoutId: payoutId,
      utrNumber: payoutResult.utrNumber ?? null,
    });

    if (finalStatus === WithdrawalStatus.FAILED) {
      await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
          errorMessage: `Razorpay payout status: ${razorpayStatus}`,
          rawResponse: { payoutId, razorpayStatus },
          utrNumber: payoutResult.utrNumber ?? null,
        },
      });
      return {
        success: true,
        withdrawalId,
        status: finalStatus,
        paymentFailed: true,
        errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
        errorMessage: `Razorpay payout status: ${razorpayStatus}`,
      };
    }

    return { success: true, withdrawalId, status: finalStatus };
  }

  /**
   * Retry a FAILED withdrawal (one that was already refunded).
   * Resets to PROCESSING, creates a fresh DEBIT transaction, re-attempts payout.
   * If payout fails again, withdrawal is marked FAILED again — no auto-refund;
   * admin must explicitly call markWithdrawalFailed to refund.
   */

  //   // Use existing referenceId if present, otherwise build a new one
  //   const referenceId = withdrawal.orderId ?? `wd_${withdrawalId}`;

  //   // await this.logAudit({
  //   //   actorType: ActorType.ADMIN,
  //   //   actorId: adminId,
  //   //   action: "withdrawal_retry_refund",
  //   //   entityType: "withdrawal_request",
  //   //   entityId: withdrawalId,
  //   //   newValue: { action: "retry_refund_attempted", orderId: referenceId },
  //   // });

  //   const { payoutId, status: razorpayStatus } = payoutResult;
  //   const finalStatus =
  //     razorpayStatus === "success" || razorpayStatus === "processed"
  //       ? WithdrawalStatus.COMPLETED
  //       : razorpayStatus === "failed" || razorpayStatus === "rejected"
  //         ? WithdrawalStatus.FAILED
  //         : WithdrawalStatus.PROCESSING;

  //   // await this.logAudit({
  //   //   actorType: ActorType.ADMIN,
  //   //   actorId: adminId,
  //   //   action: "withdrawal_completed",
  //   //   entityType: "withdrawal_request",
  //   //   entityId: withdrawalId,
  //   // });

  async retryFailedWithdrawal(
    adminId: string,
    withdrawalId: string,
  ): Promise<{
    success: boolean;
    withdrawalId: string;
    status: WithdrawalStatus;
    paymentFailed?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }> {
    if (!Types.ObjectId.isValid(withdrawalId)) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = await this.withdrawalRepo.findById(withdrawalId);
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");
    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      throw new BadRequestException(
        `Cannot retry-refund a withdrawal in '${withdrawal.status}' status. Only FAILED withdrawals can be retried.`,
      );
    }

    const user = await this.userRepo.findById(withdrawal.userId);
    if (!user)
      throw new NotFoundException("User not found for this withdrawal");

    const referenceId = withdrawal.orderId ?? `wd_${withdrawalId}`;

    // Atomic claim: only one request can move FAILED -> PROCESSING
    const claimed = await this.withdrawalRepo.findOneAndUpdate(
      { _id: withdrawalId, status: WithdrawalStatus.FAILED },
      {
        $set: {
          status: WithdrawalStatus.PROCESSING,
          processedAt: new Date(),
          orderId: referenceId,
          razorpayPayoutId: null,
        },
        $inc: { retryCount: 1 },
      },
    );
    if (!claimed) {
      throw new BadRequestException(
        "This withdrawal is already being retried. Please refresh.",
      );
    }

    // Latest verified payment detail
    const details = await this.paymentDetailRepo.findAll({
      userId: withdrawal.userId,
      status: "verified",
    });
    const paymentDetail = await this.getLatestVerifiedPaymentDetail(
      withdrawal.userId,
    );

    if (!paymentDetail) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: "NO_PAYMENT_DETAIL",
          errorMessage: "No verified payment detail found for this user.",
          rawResponse: {},
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: "NO_PAYMENT_DETAIL",
        errorMessage: "No verified payment detail found.",
      };
    }

    // Fund account setup; if it throws, put the withdrawal back to FAILED
    // so it isn't stuck in PROCESSING with no payout behind it.
    let fundAccountId = paymentDetail.razorpayFundAccountId;
    try {
      if (!fundAccountId) {
        const fundAccount = await this.razorpayPayoutService.createFundAccount({
          userId: withdrawal.userId,
          phone: user.mobileNumber,
          name: user.name ?? "User",
          existingContactId: user.razorpayContactId ?? undefined,
          vpa: paymentDetail.upiId ?? undefined,
          bankAccount:
            paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
              ? {
                  accountNumber: decrypt(paymentDetail.accountNumberEncrypted),
                  ifsc: paymentDetail.ifsc,
                  accountHolderName: paymentDetail.accountHolderName ?? "",
                }
              : undefined,
        });
        fundAccountId = fundAccount.fundAccountId;
        await this.paymentDetailRepo.update(paymentDetail._id.toString(), {
          razorpayFundAccountId: fundAccountId,
        });
        if (!user.razorpayContactId) {
          await this.userRepo.update(withdrawal.userId, {
            razorpayContactId: fundAccount.contactId,
          });
        }
      }
    } catch (err) {
      await this.withdrawalRepo.update(withdrawalId, {
        status: WithdrawalStatus.FAILED,
      });
      throw err;
    }

    const amountPaise = Math.round(Number(withdrawal.amount) * 100);
    const payoutMode = withdrawal.payoutMethod === "upi" ? "UPI" : "IMPS";

    let payoutResult: {
      payoutId: string;
      status: string;
      utrNumber?: string | null;
    };
    try {
      payoutResult = await this.razorpayPayoutService.initiatePayout({
        fundAccountId,
        amount: amountPaise,
        referenceId,
        mode: payoutMode,
        narration: "Withdrawal payout retry",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: "RAZORPAY_INIT_ERROR",
          errorMessage,
          rawResponse: {},
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: "RAZORPAY_INIT_ERROR",
        errorMessage,
      };
    }

    const { payoutId, status: razorpayStatus } = payoutResult;
    const finalStatus =
      razorpayStatus === "success" || razorpayStatus === "processed"
        ? WithdrawalStatus.COMPLETED
        : razorpayStatus === "failed" || razorpayStatus === "rejected"
          ? WithdrawalStatus.FAILED
          : WithdrawalStatus.PROCESSING;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt:
        finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
      razorpayPayoutId: payoutId,
      utrNumber: payoutResult.utrNumber ?? null,
    });

    if (finalStatus === WithdrawalStatus.FAILED) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
          errorMessage: `Razorpay payout status: ${razorpayStatus}`,
          rawResponse: { payoutId, razorpayStatus },
          utrNumber: payoutResult.utrNumber ?? null,
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
        errorMessage: `Razorpay payout status: ${razorpayStatus}`,
      };
    }

    return { success: true, withdrawalId, status: finalStatus };
  }

  /**
   * Handle a PineLabs payout failure by:
   * 1. Logging to payment_logs
   * 2. Marking the withdrawal as FAILED
   *
   * No refund is issued here. The admin must explicitly call markWithdrawalFailed
   * to trigger the refund after reviewing the failure.
   *
   * Returns the new withdrawal status (always FAILED).
   */
  private async handleWithdrawalFailure(params: {
    withdrawal: WithdrawalRequest;
    orderId: string;
    adminId: string;
    result: {
      pinelabsTransactionId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
      rawResponse: Record<string, unknown>;
      utrNumber?: string | null;
    };
  }): Promise<WithdrawalStatus> {
    const { withdrawal, orderId, adminId, result } = params;

    // 1. Log failure to payment_logs
    await this.paymentLogRepo.save(
      await this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal._id.toString(),
        adminId,
        orderId,
        pinelabsTransactionId: result.pinelabsTransactionId,
        status: PaymentLogStatus.FAILED,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        rawResponse: result.rawResponse,
        utrNumber: result.utrNumber ?? null,
      }),
    );

    // 2. Mark withdrawal as FAILED — NO refund here; admin must explicitly call markWithdrawalFailed
    const failureReason =
      result.errorCode === "NETWORK_ERROR"
        ? (result.errorMessage ?? "Payout dispatch failed")
        : `${result.errorCode ?? "Payout failed"}: ${result.errorMessage ?? "Unknown error"}`;

    await this.withdrawalRepo.update(withdrawal._id, {
      status: WithdrawalStatus.FAILED,
      failureReason,
    });

    // No notification here — notification is sent only after admin explicitly clicks "Mark Failed"
    return WithdrawalStatus.FAILED;
  }

  /**
   * Admin explicitly marks a PROCESSING withdrawal as FAILED.
   * Refunds balance to user and marks the corresponding transaction as FAILED.
   */
  async markWithdrawalFailed(
    adminId: string,
    withdrawalId: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    withdrawalId: string;
    status: WithdrawalStatus;
  }> {
    const withdrawal = await this.withdrawalRepo.findOne({ id: withdrawalId });
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");
    if (withdrawal.status === WithdrawalStatus.FAILED) {
      // Idempotent: already failed — update the DEBIT and CREDIT (refund) transaction reasons
      if (reason) {
        await this.transactionRepo.updateMany(
          { referenceId: withdrawalId, type: TransactionType.DEBIT },
          { rejectionReason: reason },
        );
        await this.transactionRepo.updateMany(
          {
            referenceId: withdrawalId,
            type: TransactionType.CREDIT,
            source: TransactionSource.REFUND,
          },
          { rejectionReason: reason },
        );
        await this.withdrawalRepo.update(withdrawalId, {
          failureReason: reason,
        });
      }
      return { success: true, withdrawalId, status: WithdrawalStatus.FAILED };
    }
    if (withdrawal.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(
        `Cannot mark withdrawal as failed in '${withdrawal.status}' status. Only PROCESSING withdrawals can be marked failed.`,
      );
    }

    let claimedOk = true;

    await this.mongoTransactionService.runInTransaction(async (session) => {

      const claimed = await this.withdrawalRepo.findOneAndUpdate(
        { _id: withdrawalId, status: WithdrawalStatus.PROCESSING },
        {
          status: WithdrawalStatus.FAILED,
          processedAt: new Date(),
          failureReason: reason ?? "Marked failed by admin",
        },
        session,
      );
      if (!claimed) {
        claimedOk = false;
        return; // someone else already handled it; don't refund
      }

      // 2. Mark the DEBIT transaction as FAILED and store the reason
      await this.transactionRepo.updateMany(
        { referenceId: withdrawalId, type: TransactionType.DEBIT },
        {
          status: TransactionStatus.FAILED,
          rejectionReason: reason ?? "Marked failed by admin",
        },
        session,
      );

      // 3. Refund balance to wallet (atomic $inc — also returns the post-refund balance)
      const newBalance = await this.walletRepo.incrementBalance(
        withdrawal.walletId,
        Number(withdrawal.amount),
        session,
      );

      // 4. Create refund CREDIT transaction
      await this.transactionRepo.save(
        {
          walletId: withdrawal.walletId,
          amount: Number(withdrawal.amount),
          type: TransactionType.CREDIT,
          source: TransactionSource.REFUND,
          description: `Withdrawal failed${reason ? ": " + reason : ""}`,
          rejectionReason: reason ?? "Marked failed by admin",
          status: TransactionStatus.COMPLETED,
          referenceId: withdrawalId,
          balanceAfter: newBalance,
        },
        session,
      );
    });

    // return { success: true, withdrawalId, status: WithdrawalStatus.FAILED };

    const user = await this.userRepo.findById(withdrawal.userId);
    if (user) {
      const maskPayout = (details: Record<string, unknown> | null) => {
        if (!details) return {};
        return Object.fromEntries(
          Object.entries(details).map(([k, v]) => [
            k,
            typeof v === "string" && v.length > 4
              ? v.slice(0, 2) + "****" + v.slice(-2)
              : (v ?? ""),
          ]),
        );
      };
      const maskedDetails = maskPayout(withdrawal.payoutDetails ?? null);

      // Notify: withdrawal failed
      await this.notificationRepo.save(
        await this.notificationRepo.create({
          userId: withdrawal.userId,
          type: NotificationType.WITHDRAWAL_FAILED,
          title: "Withdrawal Failed",
          body: `Your withdrawal of Rs. ${withdrawal.amount} has failed.${reason ? " Reason: " + reason + "." : ""}`,
          data: {
            withdrawalId,
            status: "failed",
            reason,
            payoutDetails: maskedDetails,
            userId: withdrawal.userId,
          },
          triggerType: NotificationTriggerType.WITHDRAW,
        }),
      );

      // Notify: refund completed
      await this.notificationRepo.save(
        await this.notificationRepo.create({
          userId: withdrawal.userId,
          type: NotificationType.REFUND_COMPLETED,
          title: "Refund Processed",
          body: `Rs. ${withdrawal.amount} has been credited back to your wallet.${reason ? " Reason: " + reason + "." : ""}`,
          data: {
            withdrawalId,
            refundAmount: Number(withdrawal.amount),
            reason,
            payoutDetails: maskedDetails,
            userId: withdrawal.userId,
          },
          triggerType: NotificationTriggerType.WITHDRAW,
        }),
      );
    }

    return { success: true, withdrawalId, status: WithdrawalStatus.FAILED };
  }

  /** Admin updates the failure reason on an already-failed withdrawal. */
  async updateWithdrawalFailureReason(
    adminId: string,
    withdrawalId: string,
    reason: string,
  ): Promise<{ success: boolean; withdrawalId: string }> {
    const withdrawal = await this.withdrawalRepo.findOne({ id: withdrawalId });
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");
    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      throw new BadRequestException(
        `Can only update failure reason for FAILED withdrawals. Current status: ${withdrawal.status}`,
      );
    }

    // Update the rejection reason on the associated DEBIT transaction
    const debitTx = await this.transactionRepo.findOne({ referenceId: withdrawalId, type: TransactionType.DEBIT });
    await this.transactionRepo.updateMany(
      { referenceId: withdrawalId, type: TransactionType.DEBIT },
      { rejectionReason: reason },
    );

    return { success: true, withdrawalId };
  }

  async listRewardLogs(dto: AnalyticsQueryDto) {
    const { fromDate, toDate, state } = dto;
    const from = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    // 1. State filter: users in state -> their wallets
    let walletIdFilter: string[] | undefined;
    if (state) {
      const stateUsers = await this.userRepo.findAll({ state });
      const stateUserIds = stateUsers.map((u) => u._id.toString());
      const stateWallets = stateUserIds.length
        ? await this.walletRepo.findAll({ userId: { $in: stateUserIds } })
        : [];
      walletIdFilter = stateWallets.map((w) => w._id.toString());
      if (walletIdFilter.length === 0) return { items: [], from, to };
    }

    // 2. Transactions
    const transactions = await this.transactionRepo.findBySource(
      TransactionSource.REWARD,
      {
        fromDate: from,
        toDate: to,
        walletIds: walletIdFilter,
        limit: 100,
        select:
          "amount type source description status referenceId createdAt walletId",
      },
    );

    // 3. Batch-fetch wallets, then users
    const walletIds = [
      ...new Set(transactions.map((tx) => String(tx.walletId))),
    ].filter((id) => Types.ObjectId.isValid(id));
    const wallets = walletIds.length
      ? await this.walletRepo.findAll({
          _id: { $in: walletIds.map((id) => new Types.ObjectId(id)) },
        })
      : [];
    const walletsById = new Map(wallets.map((w) => [w._id.toString(), w]));

    const userIds = [...new Set(wallets.map((w) => String(w.userId)))].filter(
      (id) => Types.ObjectId.isValid(id),
    );
    const users = userIds.length
      ? await this.userRepo.findAll({
          _id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        })
      : [];
    const usersById = new Map(users.map((u) => [u._id.toString(), u]));

    // 4. Join (mirrors the inner joins: orphaned rows are dropped)
    const items = transactions.flatMap((tx) => {
      const wallet = walletsById.get(String(tx.walletId));
      const user = wallet ? usersById.get(String(wallet.userId)) : undefined;
      if (!user) return [];
      return [
        {
          id: tx._id.toString(),
          amount: tx.amount,
          type: tx.type,
          source: tx.source,
          description: tx.description,
          status: tx.status,
          referenceId: tx.referenceId,
          createdAt: tx.createdAt,
          user: {
            id: user._id.toString(),
            name: user.name,
            mobileNumber: user.mobileNumber,
            state: user.state,
          },
        },
      ];
    });

    return { items, from, to };
  }
}

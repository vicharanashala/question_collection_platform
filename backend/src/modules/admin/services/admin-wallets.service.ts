import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from "@nestjs/common";
import { Transaction, PaymentLog } from "../../../shared/database/entities";
import { TransactionSource, TransactionStatus, TransactionType } from "../../../shared/classes/enums";
import {
  ListUserTransactionsDto,
  ListUserWithdrawalsDto,
  AdjustWalletDto,
  ListAllWalletsDto,
  WalletScopeDto,
} from "../dto";
import {
  IUserRepository,
  IWalletRepository,
  ITransactionRepository,
  IWithdrawalRequestRepository,
  IPaymentLogRepository,
  AdminWalletScope,
} from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { Types } from "mongoose";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Wallet } from "@/shared/database/mongodb/schemas/wallet.schema";
import { WithdrawalRequest } from "@/shared/database/mongodb/schemas/withdrawal-request.schema";
import { isSuperAdminUser } from './admin-access.util';

// Staff wallet views and super admin balance adjustments.
@Injectable()
export class AdminWalletsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Wallet)
    private readonly walletRepo: IWalletRepository,
    @Inject(REPOSITORY_TOKENS.Transaction)
    private readonly transactionRepo: ITransactionRepository,
    @Inject(REPOSITORY_TOKENS.WithdrawalRequest)
    private readonly withdrawalRepo: IWithdrawalRequestRepository,
    @Inject(REPOSITORY_TOKENS.PaymentLog)
    private readonly paymentLogRepo: IPaymentLogRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Section 8b: Wallet Management (super_admin only for adjustments)
  // ─────────────────────────────────────────────────────────────

  async getUserWallet(userId: string) {
    const wallet = await this.walletRepo.findOne({ userId });
    if (!wallet) throw new NotFoundException("Wallet not found for this user");
    if (wallet.isDeleted) throw new Error("Wallet is deleted for this user.");

    const [user, { totalEarned, totalWithdrawn }] = await Promise.all([
      // replaces relations: ["user"]; there are no joins in Mongo
      this.userRepo.findById(userId),
      this.transactionRepo.getEarnedAndWithdrawn(wallet._id.toString()),
    ]);

    return {
      id: wallet._id.toString(),
      balance: Number(wallet.balance),
      totalEarned,
      totalWithdrawn,
      currency: "INR",
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      user: user
        ? {
            id: user._id.toString(),
            name: user.name,
            mobileNumber: user.mobileNumber,
            state: user.state,
            district: user.district,
            category: user.category,
            role: user.role,
            verificationStatus: user.verificationStatus,
          }
        : null,
    };
  }

  async getWithdrawalWithTransactions(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Withdrawal request not found");
    }

    const withdrawal = await this.withdrawalRepo.findById(id);
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");

    const [user, logs, transactions] = await Promise.all([
      this.userRepo.findById(withdrawal.userId),
      this.paymentLogRepo.findAll({ withdrawalRequestId: id }),
      this.transactionRepo.findAll({ referenceId: id }),
    ]);

    // Sort in JS so this doesn't depend on whether findAll supports sorting.
    // A single withdrawal only has a handful of logs and transactions.
    const byDate = (
      a: { createdAt?: Date; attemptedAt?: Date },
      b: typeof a,
      key: "createdAt" | "attemptedAt",
    ) =>
      new Date(a[key] as Date).getTime() - new Date(b[key] as Date).getTime();

    const paymentLogs = logs
      .sort((a, b) => byDate(a, b, "attemptedAt"))
      .map((pl) => ({
        id: pl._id.toString(),
        orderId: pl.orderId,
        pinelabsTransactionId: pl.pinelabsTransactionId,
        razorpayPayoutId: pl.razorpayPayoutId,
        utrNumber: pl.utrNumber,
        status: pl.status,
        errorCode: pl.errorCode,
        errorMessage: pl.errorMessage,
        rawResponse: pl.rawResponse,
        attemptedAt: pl.attemptedAt,
      }));

    return {
      ...withdrawal,
      id: withdrawal._id.toString(),
      user: user
        ? {
            id: user._id.toString(),
            name: user.name,
            mobileNumber: user.mobileNumber,
            state: user.state,
            district: user.district,
          }
        : null,
      transactions: transactions
        .sort((a, b) => byDate(a, b, "createdAt"))
        .map((tx) => ({
          id: tx._id.toString(),
          type: tx.type,
          amount: Number(tx.amount),
          status: tx.status,
          rejectionReason: tx.rejectionReason,
          description: tx.description,
          source: tx.source,
          createdAt: tx.createdAt,
        })),
      paymentLogs,
    };
  }

  async listUserTransactions(userId: string, dto: ListUserTransactionsDto) {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      source,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = dto;

    const wallet = await this.walletRepo.findOne({ userId });
    if (!wallet) throw new NotFoundException("Wallet not found for this user");
    if (wallet.isDeleted)
      throw new Error(
        "Wallet for this user is deleted so unable to show transcations!!",
      );
    const walletId = wallet._id.toString();

    const [{ items, total }, summary] = await Promise.all([
      this.transactionRepo.findPaginatedByWalletId(walletId, page, limit, {
        type: type && type !== "all" ? type : undefined,
        status: status && status !== "all" ? status : undefined,
        source: source && source !== "all" ? source : undefined,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        sortBy: sortBy === "amount" ? "amount" : "createdAt",
        sortOrder: sortOrder === "ASC" ? "ASC" : "DESC",
        select:
          "amount type source description rejectionReason status referenceId balanceAfter createdAt",
      }),
      this.transactionRepo.getWalletSummary(walletId),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      summary: {
        totalTransactions: summary.totalCount,
        totalCredits: summary.totalCredits,
        totalDebits: summary.totalDebits,
        completedCredits: summary.completedCredits,
        completedDebits: summary.completedDebits,
        withdrawalTransactions: summary.withdrawalCount,
      },
    };
  }

  async listUserWithdrawals(userId: string, dto: ListUserWithdrawalsDto) {
    const { page = 1, limit = 20, status, fromDate, toDate } = dto;

    const wallet = await this.walletRepo.findOne({ userId });
    if (!wallet) throw new NotFoundException("Wallet not found for this user");
    if (wallet.isDeleted)
      throw new Error(
        "Wallet is deleted so unable to show the withdrawal data",
      );
    const { items, total } = await this.withdrawalRepo.findPaginatedByWalletId(
      wallet._id.toString(),
      page,
      limit,
      {
        status,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        select:
          "amount payoutMethod payoutDetails status processedAt createdAt utrNumber razorpayPayoutId",
      },
    );

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adjustWalletBalance(adminId: string, dto: AdjustWalletDto) {
    const isSuperAdmin = await isSuperAdminUser(this.userRepo, adminId);
    if (!isSuperAdmin)
      throw new ForbiddenException(
        "Only super admins can manually adjust wallet balances",
      );

    const wallet = await this.walletRepo.findOne({ userId: dto.userId });
    if (!wallet) throw new NotFoundException("Wallet not found for this user");

    // Extract non-null values immediately after the guard — TypeScript cannot narrow across await
    const walletId = wallet!._id.toString();
    const initialBalance = Number(wallet!.balance);
    let currentBalance = initialBalance;

    const amount = Number(dto.amount);
    if (amount === 0)
      throw new BadRequestException("Adjustment amount cannot be zero");

    if (amount > 0) {
      await this.walletRepo.increment(
        { _id: new Types.ObjectId(walletId) },
        "balance",
        amount,
      );
      currentBalance += amount;
      await this.transactionRepo.save({
        walletId,
        amount,
        type: TransactionType.CREDIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: currentBalance,
      });
    } else {
      const debit = Math.abs(amount);
      if (currentBalance < debit) {
        throw new BadRequestException(
          "Insufficient balance for this debit adjustment",
        );
      }
      await this.walletRepo.decrement(
        { _id: new Types.ObjectId(walletId) },
        "balance",
        debit,
      );
      currentBalance -= debit;
      await this.transactionRepo.save({
        walletId,
        amount: debit,
        type: TransactionType.DEBIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: currentBalance,
      });
    }

    const updatedWallet = await this.walletRepo.findOne({ id: walletId });

    return {
      success: true,
      userId: dto.userId,
      walletId,
      previousBalance: initialBalance,
      newBalance: Number(updatedWallet!.balance),
      adjustment: amount,
      reason: dto.reason,
    };
  }

  async listAllWallets(dto: ListAllWalletsDto) {
    const { page = 1, limit = 50, sortBy = "createdAt", sortOrder = "DESC" } = dto;

    const { items, total } = await this.walletRepo.findAdminPage(
      this.toWalletScope(dto),
      { page, limit, sortBy, sortOrder },
    );

    return {
      items: items.map(({ owner, ...wallet }) => ({ ...wallet, user: owner })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /** Wallet count and money totals across every wallet the filters cover, plus the filters that were applied. */
  async getWalletsSummary(dto: WalletScopeDto) {
    const scope = this.toWalletScope(dto);
    const totals = await this.walletRepo.getAdminTotals(scope);
    const appliedFilters = Object.fromEntries(
      Object.entries(scope).filter(([, value]) => value !== undefined),
    ) as AdminWalletScope;

    return {
      ...totals,
      appliedFilters,
      isFiltered: Object.keys(appliedFilters).length > 0,
    };
  }

  // Normalizes the wallet filters so the list and the summary read them the same way.
  private toWalletScope(dto: WalletScopeDto): AdminWalletScope {
    return {
      userId: dto.userId || undefined,
      search: dto.search?.trim() || undefined,
      state: dto.state || undefined,
      tester: dto.tester,
      anveshanScope: dto.anveshanScope,
    };
  }
}

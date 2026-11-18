import { isTesterCondition } from "../../../shared/utils/tester.util";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from "@nestjs/common";
import { RedisService } from "../../../shared/database/cache/redis.service";
import { usernameKey } from "../../../shared/database/cache/cache.keys";
import { Question, Transaction, Notification, PaymentLog, UserPaymentDetail } from "../../../shared/database/entities";
import { VerificationStatus, UserRole, UserCategory, AuditAction, WithdrawalStatus } from "../../../shared/classes/enums";
import { ListUsersDto, ListUserStatsDto } from "../dto";
import { AnveshanProgressService } from "./anveshan-progress.service";
import {
  IUserRepository,
  IQuestionRepository,
  IWalletRepository,
  ITransactionRepository,
  IWithdrawalRequestRepository,
  INotificationRepository,
  IPaymentLogRepository,
  IUserPaymentDetailRepository,
  IFinalQuestionRepository,
  IAgriEntityRepository,
  IReportRepository,
  IAppFeedbackRepository,
  IAnveshanAnswerRepository,
} from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { MongoTransactionService } from "../../../shared/database/mongodb/mongo-transaction.service";
import { ClientSession, Types } from "mongoose";
import { INCLUDE_DELETED } from "../../../shared/database/abstractions/mongo-utils";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Wallet } from "@/shared/database/mongodb/schemas/wallet.schema";
import { WithdrawalRequest } from "@/shared/database/mongodb/schemas/withdrawal-request.schema";
import { isSuperAdminUser } from './admin-access.util';

// Builds a createdAt range from YYYY-MM-DD strings as whole days in Indian Standard Time, end date inclusive.
function buildJoinedRange(fromDate?: string, toDate?: string): Record<string, Date> | undefined {
  if (!fromDate && !toDate) return undefined;
  const range: Record<string, Date> = {};
  if (fromDate) range.$gte = new Date(fromDate.length <= 10 ? `${fromDate}T00:00:00.000+05:30` : fromDate);
  if (toDate) range.$lte = new Date(toDate.length <= 10 ? `${toDate}T23:59:59.999+05:30` : toDate);
  return range;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
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
    @Inject(REPOSITORY_TOKENS.FinalQuestion)
    private readonly finalQuestionRepo: IFinalQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AgriEntity)
    private readonly agriEntityRepo: IAgriEntityRepository,
    @Inject(REPOSITORY_TOKENS.Report)
    private readonly reportRepo: IReportRepository,
    @Inject(REPOSITORY_TOKENS.AppFeedback)
    private readonly feedbackRepo: IAppFeedbackRepository,
    @Inject(REPOSITORY_TOKENS.AnveshanAnswer)
    private readonly anveshanAnswerRepo: IAnveshanAnswerRepository,
    private readonly redisService: RedisService,
    private readonly mongoTransactionService: MongoTransactionService,
    private readonly anveshanProgressService: AnveshanProgressService,
  ) {}

  private readonly logger = new Logger(AdminService.name);

  /** Maps an audit action + entity to a human-readable description string. */
  private buildActivityDescription(
    action: string,
    entityType: string | null,
    metadata: Record<string, unknown> | null,
  ): string {
    switch (action) {
      case AuditAction.QUESTION_APPROVED:
        return `Approved ${entityType ?? "question"}`;
      case AuditAction.QUESTION_REJECTED:
        return `Rejected ${entityType ?? "question"}`;
      case AuditAction.USER_VERIFIED:
        return `Verified user`;
      case AuditAction.USER_SUSPENDED:
        return `Suspended user`;
      case AuditAction.USER_BANNED:
        return `Banned user`;
      case AuditAction.USER_UNSUSPENDED:
        return `Unsuspended user`;
      case AuditAction.USER_UNBANNED:
        return `Unbanned user`;
      case AuditAction.REWARD_CREDITED:
        return `Credited reward${metadata?.amount ? ` of ₹${metadata.amount}` : ""}`;
      case AuditAction.WITHDRAWAL_REQUESTED:
        return `Requested withdrawal${metadata?.amount ? ` of ₹${metadata.amount}` : ""}`;
      case AuditAction.WITHDRAWAL_COMPLETED:
        return `Completed withdrawal${metadata?.amount ? ` of ₹${metadata.amount}` : ""}`;
      default:
        return (action ?? "").replace(/_/g, " ") || action;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management
  // ─────────────────────────────────────────────────────────────

  async createUser(
    actorId: string,
    actorRole: UserRole,
    dto: {
      name: string;
      mobileNumber: string;
      role: UserRole;
      category?: UserCategory;
      isUserCreatedBySuperAdmin: boolean;
      profileCreatedByAdminCompleted: boolean;
    },
  ) {
    // Super admin cannot create another super admin
    if (
      actorRole === UserRole.SUPER_ADMIN &&
      dto.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        "Super admin cannot assign a super admin role.",
      );
    }

    // Cannot create a super admin through this endpoint (only ADMIN can create one)
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Super admin role cannot be assigned via this endpoint.",
      );
    }

    // Normalize: strip +91 or 0 prefix so numbers are stored consistently
    const mobile = dto.mobileNumber.replace(/^\+91 ?/, "").replace(/^0/, "");

    // Check for duplicate mobile number
    const existing = await this.userRepo.findOne({ mobileNumber: mobile });
    if (existing) {
      throw new BadRequestException(
        "A user with this mobile number already exists.",
      );
    }

    const isEndUser = dto.role === UserRole.USER;
    if (isEndUser && !dto.category) {
      throw new BadRequestException("Category is required for user accounts.");
    }
    const isCreatedBySuperAdmin = dto.isUserCreatedBySuperAdmin ?? true;

    const profileCreatedByAdminCompleted =
      dto.profileCreatedByAdminCompleted ?? false;

    const user = await this.userRepo.create({
      name: dto.name.trim(),
      mobileNumber: mobile,
      role: dto.role,
      category: isEndUser ? dto.category! : null,
      languagePreference: "en",
      consentGiven: false,
      verificationStatus: VerificationStatus.VERIFIED,
      tokenVersion: 0,
      lastLoginAt: null,
      isUserCreatedBySuperAdmin: isCreatedBySuperAdmin,
      profileCreatedByAdminCompleted: profileCreatedByAdminCompleted,
    });

    await this.userRepo.save(user);

    return { user: this.toPublicUser(user) };
  }

// Counts users by type for an optional join date range.
async getUserStats(dto: ListUserStatsDto) {
  const base: Record<string, unknown> = {};
  const joinedRange = buildJoinedRange(dto.fromDate, dto.toDate);
  if (joinedRange) base.createdAt = joinedRange;
  if (dto.anveshanScope) base.isAnveshanUser = dto.anveshanScope === 'only' ? true : { $ne: true };
  Object.assign(base, isTesterCondition(dto.tester));

  const [total, testers, anveshan] = await Promise.all([
    this.userRepo.countByFilter(base),
    this.userRepo.countByFilter({ ...base, is_tester: true }),
    this.userRepo.countByFilter({ ...base, isAnveshanUser: true }),
  ]);
  return { total, testers, anveshan, nonAnveshan: total - anveshan };
}

  async listUsers(dto: ListUsersDto) {
    const {
      page = 1,
      limit = 20,
      state,
      category,
      status,
      role, // ← destructure it
      search,
      anveshan,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = dto;
    // The admin list shows deleted users too, so they can be restored.
    const filter: Record<string, unknown> = { isDeleted: INCLUDE_DELETED };
    if (state) filter.state = state;
    if (category) filter.category = category;
    if (status) filter.verificationStatus = status;
    if (role) filter.role = role; // ← apply it
    if (search) {
      const regex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: regex },
        { mobileNumber: regex },
        { username: regex },
      ];
    }
    // Mongoose casts a valid hex string to ObjectId during query execution.
    if (dto.excludeId) filter._id = { $ne: dto.excludeId };

    const testerCondition = isTesterCondition(dto.tester);
    if (testerCondition) Object.assign(filter, testerCondition);
    if (dto.anveshanScope) filter.isAnveshanUser = dto.anveshanScope === 'only' ? true : { $ne: true };

    // Anveshan filter: completion is computed from submissions, so 100% / in-progress become an id list.
    if (anveshan) {
      filter.isAnveshanUser = true;
      if (anveshan !== "all") {
        const completedIds =
          await this.anveshanProgressService.findCompletedUserIds();
        filter._id =
          anveshan === "completed"
            ? { $in: completedIds.filter((id) => id !== dto.excludeId) }
            : {
                $nin: dto.excludeId
                  ? [...completedIds, dto.excludeId]
                  : completedIds,
              };
      }
    }

    const direction = sortOrder === "ASC" ? 1 : -1;

    const { data, total } =
      sortBy === "anveshanProgress"
        ? await this.findUsersByAnveshanProgress(filter, direction, page, limit)
        : await this.userRepo.findAndCount(filter, {
            pagination: {
              page,
              limit,
              // The id tie breaker keeps page contents stable when many users share a value.
              sort: { [sortBy]: direction, _id: direction },
            },
          });

    // Project down to the same field set the admin user list has always returned
    // (excludes otpHash and other internal-only fields on the User document).
    const items = data.map((u) => ({
      id: u._id.toString(),
      mobileNumber: u.mobileNumber,
      name: u.name,
      username: u.username,
      category: u.category,
      state: u.state,
      district: u.district,
      verificationStatus: u.verificationStatus,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      isAnveshanUser: !!u.isAnveshanUser,
      isTester: !!u.is_tester,
      isDeleted: !!u.isDeleted,  
    }));

    // Attach milestone progress for the Anveshan users on this page only.
    const anveshanIds = items.filter((u) => u.isAnveshanUser).map((u) => u.id);
    const progressById =
      await this.anveshanProgressService.getProgressForUsers(anveshanIds);
    const itemsWithProgress = items.map((u) => ({
      ...u,
      anveshanProgress: progressById.get(u.id) ?? null,
    }));

    return {
      items: itemsWithProgress,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // Pages users ordered by Anveshan progress. Progress is computed, so Anveshan users are ranked in memory
  // and other users follow, newest first.
  private async findUsersByAnveshanProgress(
    filter: Record<string, unknown>,
    direction: 1 | -1,
    page: number,
    limit: number,
  ) {
    const anveshanOnly = filter.isAnveshanUser === true;
    const nonAnveshanOnly = typeof filter.isAnveshanUser === "object" && filter.isAnveshanUser !== null;
    const anveshanUsers = nonAnveshanOnly ? [] : await this.userRepo.findAll({ ...filter, isAnveshanUser: true });
    const progress = await this.anveshanProgressService.getProgressForUsers(anveshanUsers.map((u) => u._id.toString()));
    const percentOf = (id: string) => progress.get(id)?.percent ?? 0;
    const ranked = [...anveshanUsers].sort(
      (a, b) =>
        direction * (percentOf(a._id.toString()) - percentOf(b._id.toString())) ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        (a._id.toString() < b._id.toString() ? -1 : 1),
    );

    const start = (page - 1) * limit;
    const data = ranked.slice(start, start + limit);
    const otherFilter = { ...filter, isAnveshanUser: { $ne: true } };
    const otherTotal = anveshanOnly ? 0 : await this.userRepo.count(otherFilter);
    const missing = limit - data.length;
    if (missing > 0 && otherTotal > 0) {
      const skip = Math.max(0, start - ranked.length);
      const others = await this.userRepo.findAll(otherFilter, {
        pagination: { page: 1, limit: skip + missing, sort: { createdAt: -1, _id: -1 } },
      });
      data.push(...others.slice(skip, skip + missing));
    }
    return { data, total: ranked.length + otherTotal };
  }

  // async getUserDetail(userId: string) {
  //   const user = await this.userRepo.findOne({
  //     where: { id: userId },
  //     relations: ["wallet"],
  //     select: [
  //       "id",
  //       "mobileNumber",
  //       "name",
  //       "username",
  //       "role",
  //       "verificationStatus",
  //       "category",
  //       "district",
  //       "state",
  //       "block",
  //       "village",
  //       "kvk",
  //       "numberOfFarmers",
  //       "organisationType",
  //       "languagePreference",
  //       "age",
  //       "gender",
  //       "farmSize",
  //       "season",
  //       "cropType",
  //       "courseName",
  //       "collegeName",
  //       "universityName",
  //       "organizationName",
  //       "organizationRole",
  //       "organizationState",
  //       "organizationDistrict",
  //       "organizationBlock",
  //       "organizationVillage",
  //       "crops",
  //       "createdAt",
  //       "lastLoginAt",
  //       "suspendedAt",
  //       "suspendedUntil",
  //       "suspendedReason",
  //       "bannedAt",
  //       "bannedReason",
  //       "consentGiven",
  //       "consentTimestamp",
  //     ],
  //   });
  //   if (!user) throw new NotFoundException("User not found");

  async getUserDetail(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new NotFoundException("User not found");
  }

  // The explicit isDeleted key bypasses the default "hide deleted" filter,
  // so a deleted user's page still opens (with the Restore button).
  const user = await this.userRepo.findOne({
    _id: userId, // plain string: Mongoose casts it, the repo won't mangle it
    isDeleted: INCLUDE_DELETED,
  });
  if (!user) throw new NotFoundException("User not found");

  // A deleted user's related records were marked deleted by the cascade,
  // so for them we need to read the deleted ones instead of hiding them.
  const recordScope = user.isDeleted ? { isDeleted: true } : { isDeleted: { $ne: true } };

  const [{ data: questionRows }, paymentRows] = await Promise.all([
    this.questionRepo.findAndCount(
      { userId, ...recordScope },
      { pagination: { page: 1, limit: 20, sort: { submittedAt: -1, _id: -1 } } },
    ),
    this.paymentDetailRepo.findAll({ userId, ...recordScope }),
  ]);

  const questions = questionRows.map((q) => ({
    id: String(q._id),
    questionText: q.questionText,
    status: q.status,
    submittedAt: q.submittedAt,
    reviewedAt: q.reviewedAt,
    rejectionReason: q.rejectionReason,
    // the page's search box reads these two; without them q.cropType.toLowerCase() throws
    cropType: q.cropType ?? "",
    domains: q.domains ?? [],
  }));

  // Never send secrets to the browser (the old code returned whole entities)
  const paymentDetails = paymentRows
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(({ accountNumberEncrypted, razorpayFundAccountId, ...safe }: any) => ({
      ...safe,
      id: String(safe._id),
    }));

  return {
    user: {
      id: String(user._id),
      mobileNumber: user.mobileNumber,
      name: user.name,
      username: user.username,
      role: user.role,
      verificationStatus: user.verificationStatus,
      category: user.category,
      district: user.district,
      state: user.state,
      block: user.block,
      village: user.village,
      kvk: user.kvk,
      numberOfFarmers: user.numberOfFarmers,
      organisationType: user.organisationType,
      languagePreference: user.languagePreference,
      age: user.age,
      gender: user.gender,
      farmSize: user.farmSize,
      season: user.season,
      cropType: user.cropType,
      courseName: user.courseName,
      collegeName: user.collegeName,
      universityName: user.universityName,
      organizationName: user.organizationName,
      organizationRole: user.organizationRole,
      organizationState: user.organizationState,
      organizationDistrict: user.organizationDistrict,
      organizationBlock: user.organizationBlock,
      organizationVillage: user.organizationVillage,
      crops: user.crops ?? [],
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      suspendedAt: user.suspendedAt,
      suspendedUntil: user.suspendedUntil,
      suspendedReason: user.suspendedReason,
      bannedAt: user.bannedAt,
      bannedReason: user.bannedReason,
      consentGiven: user.consentGiven,
      consentTimestamp: user.consentTimestamp,
      // needed by the Restore button, the "Deleted account" banner and hiding Verify
      isDeleted: !!user.isDeleted,
      deletedAt: user.deletedAt ?? null,
    },
    questions,
    paymentDetails,
    crops: user.crops ?? [],
  };
}

  async suspendOrBanUser(
    adminId: string,
    userId: string,
    action: "suspend" | "ban",
    reason?: string,
    suspendedUntil?: string,
  ) {
    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (user.isDeleted)
      throw new Error("Deleted users can not be Ban or Suspend");

    const isSuperAdmin = await isSuperAdminUser(this.userRepo, adminId);
    if (!isSuperAdmin)
      throw new ForbiddenException(
        "Only super admins can suspend or ban users",
      );

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Cannot suspend or ban a super admin");
    }

    // Guard: cannot suspend an already suspended user, or ban an already banned user
    if (
      action === "suspend" &&
      user.verificationStatus === VerificationStatus.SUSPENDED
    ) {
      throw new BadRequestException("User is already suspended");
    }
    if (
      action === "ban" &&
      user.verificationStatus === VerificationStatus.BANNED
    ) {
      throw new BadRequestException("User is already banned");
    }
    // Also guard against banning an already-suspended user (must unsuspend first)
    if (
      action === "ban" &&
      user.verificationStatus === VerificationStatus.SUSPENDED
    ) {
      throw new BadRequestException(
        "User is currently suspended — lift the suspension before banning",
      );
    }

    const newStatus =
      action === "ban"
        ? VerificationStatus.BANNED
        : VerificationStatus.SUSPENDED;
    const oldStatus = user.verificationStatus;
    const now = new Date();

    await this.userRepo.update(userId, {
      verificationStatus: newStatus,
      ...(action === "ban"
        ? {
            bannedAt: now,
            bannedReason: reason ?? null,
            suspendedAt: null,
            suspendedReason: null,
            suspendedUntil: null,
          }
        : {
            suspendedAt: now,
            suspendedUntil: suspendedUntil ? new Date(suspendedUntil) : null,
            suspendedReason: reason ?? null,
            bannedAt: null,
            bannedReason: null,
          }),
    });

    return { success: true, userId, newStatus };
  }

  async unsuspendOrUnbanUser(adminId: string, userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.isDeleted)
      throw new Error("Deleted User can not be unbanned or unsuspend");
    const isSuperAdmin = await isSuperAdminUser(this.userRepo, adminId);
    if (!isSuperAdmin)
      throw new ForbiddenException(
        "Only super admins can unsuspend or unban users",
      );

    if (
      user.verificationStatus !== VerificationStatus.SUSPENDED &&
      user.verificationStatus !== VerificationStatus.BANNED
    ) {
      throw new BadRequestException("User is not suspended or banned");
    }

    const oldStatus = user.verificationStatus;
    await this.userRepo.update(userId, {
      verificationStatus: VerificationStatus.VERIFIED,
      suspendedAt: null,
      suspendedUntil: null,
      suspendedReason: null,
      bannedAt: null,
      bannedReason: null,
    });

    return { success: true, userId, newStatus: VerificationStatus.VERIFIED };
  }

  async verifyUser(actorId: string, userId: string) {
    const actor = await this.userRepo.findOne({ id: actorId });
    if (!actor) throw new NotFoundException("Actor not found");
    const validActors = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.FINANCE,
    ];
    if (!validActors.includes(actor.role as UserRole)) {
      throw new ForbiddenException(
        "Only admins, super admins or finance can verify users",
      );
    }

    const user = await this.userRepo.findOne({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (user.isDeleted) throw new Error("Deleted users cannot be verified.");
    const oldStatus = user.verificationStatus;
    if (oldStatus === VerificationStatus.VERIFIED) {
      return {
        success: true,
        userId,
        newStatus: oldStatus,
        message: "User already verified",
      };
    }

    await this.userRepo.update(userId, {
      verificationStatus: VerificationStatus.VERIFIED,
    });

    return { success: true, userId, newStatus: VerificationStatus.VERIFIED };
  }

  private toPublicUser(user: User): Record<string, unknown> {
    return {
      id: user._id.toString(),
      mobileNumber: user.mobileNumber,
      name: user.name,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      village: user.village,
      kvk: user.kvk,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isUserCreatedBySuperAdmin: user.isUserCreatedBySuperAdmin,
      profileCreatedByAdminCompleted: user.profileCreatedByAdminCompleted,
    };
  }

  /** Flush cache keys matching a pattern. Super admin only. */
  async flushCache(keyPattern: string): Promise<{ flushed: number }> {
    const count = await this.redisService.delByPattern(keyPattern);
    this.logger.log(
      `Cache flush: ${count} keys deleted matching "${keyPattern}"`,
    );
    return { flushed: count };
  }

  async deleteUser(
    userId: string,
  ): Promise<{ message: string; userId: string; deleted: any }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException("User not found");
    }
    const user = await this.userRepo.findById(userId);
    if (!user || user.isDeleted) throw new NotFoundException("User not found");
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("A super admin cannot be deleted");
    }

    const [wallets, withdrawals] = await Promise.all([
      this.walletRepo.findAll({ userId }),
      this.withdrawalRepo.findAll({ userId }),
    ]);
    const walletIds = wallets.map((w) => String(w._id));
    const withdrawalIds = withdrawals.map((w) => String(w._id));

    const mark = { isDeleted: true, deletedAt: new Date() };
    const notDeleted = { isDeleted: { $ne: true } };

    const count = (r: unknown): number | null => {
      const x = r as
        | { modifiedCount?: number; affected?: number }
        | null
        | undefined;
      return x?.modifiedCount ?? x?.affected ?? null;
    };

    const none = Promise.resolve(null);

    const [
      questions,
      wallets_,
      withdrawals_,
      paymentDetails,
      notifications,
      finalQuestions,
      agriEntities,
      reports,
      feedback,
      anveshanAnswers,
      transactions,
      paymentLogs,
    ] = await this.mongoTransactionService.runInTransaction(async (session) => {
      // Checked inside the transaction so a withdrawal that touches the wallet at the same
      // time causes a write conflict, and the retry sees it.
      const openWithdrawal = await this.withdrawalRepo.findOne(
        {
          userId,
          status: { $in: [WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING] },
        },
        session,
      );
      if (openWithdrawal) {
        throw new BadRequestException(
          "User has pending or processing withdrawals. Settle them before deleting.",
        );
      }

      // Sequential on purpose: a transaction session must not run operations in parallel.
      const operations: Array<() => Promise<unknown>> = [
      () => this.questionRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.walletRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.withdrawalRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.paymentDetailRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.notificationRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.finalQuestionRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.agriEntityRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.reportRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.feedbackRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () => this.anveshanAnswerRepo.updateMany({ userId, ...notDeleted }, mark, session),
      () =>
        walletIds.length
        ? this.transactionRepo.updateMany(
            { walletId: { $in: walletIds }, ...notDeleted },
            mark,
            session,
          )
        : none,
      () =>
        withdrawalIds.length
        ? this.paymentLogRepo.updateMany(
            { withdrawalRequestId: { $in: withdrawalIds }, ...notDeleted },
            mark,
            session,
          )
        : none,
      ];
      const results: unknown[] = [];
      for (const run of operations) results.push(await run());

      await this.userRepo.update(
        userId,
        {
          ...mark,
          tokenVersion: (user.tokenVersion ?? 0) + 1,
          otpHash: null,
          otpExpiresAt: null,
          expoPushToken: null,
        },
        session,
      );
      return results;
    });

    // The username is free again, so the cached "taken" entry must go.
    if (user.username) await this.clearUsernameCache(user.username);

    return {
      message: "User deleted successfully.",
      userId,
      deleted: {
        user: 1,
        questions: count(questions),
        wallets: count(wallets_),
        withdrawals: count(withdrawals_),
        paymentDetails: count(paymentDetails),
        notifications: count(notifications),
        finalQuestions: count(finalQuestions),
        agriEntities: count(agriEntities),
        reports: count(reports),
        feedback: count(feedback),
        anveshanAnswers: count(anveshanAnswers),
        transactions: count(transactions),
        paymentLogs: count(paymentLogs),
      },
    };
  }

  // Restores a soft deleted user and every record that was deleted together with them, in one transaction.
  async restoreUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException("User not found");
    }

    // Explicit isDeleted key bypasses the default "hide deleted" filter
    const user = await this.userRepo.findOne({ _id: userId, isDeleted: true });
    if (!user) throw new NotFoundException("Deleted user not found");

    // Users deleted before deletedAt existed have no stamp. Their cascade left deletedAt
    // empty, so matching null skips records that were deleted separately with a timestamp.
    const deletedWithUser = (extra: Record<string, unknown>) => ({
      ...extra,
      isDeleted: true,
      deletedAt: user.deletedAt ?? null,
    });
    const unmark = { isDeleted: false, deletedAt: null };

    await this.mongoTransactionService.runInTransaction(async (session) => {
      // Inside the transaction so a concurrent sign up with the same value is caught
      // by the unique index and rolls everything back.
      await this.assertNoActiveUserWith("mobileNumber", user.mobileNumber, session);
      await this.assertNoActiveUserWith("username", user.username, session);

      const [wallets, withdrawals] = await Promise.all([
        this.walletRepo.findAll(deletedWithUser({ userId })),
        this.withdrawalRepo.findAll(deletedWithUser({ userId })),
      ]);
      const walletIds = wallets.map((w) => String(w._id));
      const withdrawalIds = withdrawals.map((w) => String(w._id));

      // Sequential on purpose: a transaction session must not run operations in parallel.
      const operations: Array<() => Promise<unknown>> = [
        () => this.questionRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.walletRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.withdrawalRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.paymentDetailRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.notificationRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.finalQuestionRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.agriEntityRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.reportRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.feedbackRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () => this.anveshanAnswerRepo.updateMany(deletedWithUser({ userId }), unmark, session),
        () =>
          walletIds.length
            ? this.transactionRepo.updateMany(
                deletedWithUser({ walletId: { $in: walletIds } }),
                unmark,
                session,
              )
            : Promise.resolve(),
        () =>
          withdrawalIds.length
            ? this.paymentLogRepo.updateMany(
                deletedWithUser({ withdrawalRequestId: { $in: withdrawalIds } }),
                unmark,
                session,
              )
            : Promise.resolve(),
        // update() only touches active records, so the user is restored with an explicit filter.
        () => this.userRepo.updateMany({ _id: userId, isDeleted: true }, unmark, session),
      ];
      for (const run of operations) await run();
    });

    if (user.username) await this.cacheUsername(user.username, String(user._id));

    return { message: "User restored successfully.", userId };
  }

  // Rejects a restore when an active user already holds the deleted user's mobile number or username.
  private async assertNoActiveUserWith(
    field: "mobileNumber" | "username",
    value: string | null | undefined,
    session: ClientSession,
  ): Promise<void> {
    if (!value) return;
    const activeUser = await this.userRepo.findOne({ [field]: value }, session);
    if (!activeUser) return;
    const label = field === "mobileNumber" ? "mobile number" : "username";
    throw new BadRequestException(`Another active user already uses this ${label}.`);
  }

  // Marks a username as taken in the availability cache. A cache failure must not undo a committed restore.
  private async cacheUsername(username: string, userId: string): Promise<void> {
    try {
      await this.redisService.set(usernameKey(username), userId);
    } catch (error) {
      this.logger.warn(
        `Could not cache username "${username}": ${(error as Error).message}`,
      );
    }
  }

  // Removes a username from the availability cache. A cache failure must not undo a committed delete.
  private async clearUsernameCache(username: string): Promise<void> {
    try {
      await this.redisService.del(usernameKey(username));
    } catch (error) {
      this.logger.warn(
        `Could not clear username cache for "${username}": ${(error as Error).message}`,
      );
    }
  }

async getUserAuditSnapshot(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  const u = await this.userRepo.findOne({
    _id: userId,
    isDeleted: INCLUDE_DELETED,
  });
  if (!u) return null;
  return {
    name: u.name,
    mobileNumber: u.mobileNumber,
    role: u.role,
    verificationStatus: u.verificationStatus,
    isDeleted: !!u.isDeleted,
    deletedAt: u.deletedAt ?? null,
  };
}
}

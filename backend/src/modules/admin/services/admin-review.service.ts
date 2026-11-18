import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from "@nestjs/common";
import { HotDataService } from "../../../shared/database/cache/hot-data.service";
import { AnalyticsCacheService } from "../../../shared/database/cache/analytics-cache.service";
import { Question, Notification } from "../../../shared/database/entities";
import { QuestionStatus, UserRole, ActorType } from "../../../shared/classes/enums";
import { ListReviewQueueDto, ReviewActionDto } from "../dto";
import { WalletsService } from "../../wallets/services/wallets.service";
import { GdbService } from "../../ai/services/gdb.service";
import {
  IUserRepository,
  IQuestionRepository,
  INotificationRepository,
  QUESTION_RESPONSE_SELECT,
} from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { Types } from "mongoose";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { NotificationType, NotificationTriggerType } from "../../../shared/classes/enums";

// Staff question review: the review queue, duplicate checks and review decisions.
@Injectable()
export class AdminReviewService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.Notification)
    private readonly notificationRepo: INotificationRepository,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
    private readonly hotDataService: HotDataService,
    private readonly analyticsCacheService: AnalyticsCacheService,
    private readonly gdbService: GdbService,
  ) {}

  private readonly logger = new Logger(AdminReviewService.name);

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review
  // ─────────────────────────────────────────────────────────────

  async listReviewQueue(dto: ListReviewQueueDto) {
    return this.questionRepo.listQueue(dto);
  }

  async getQuestionForReview(questionId: string) {
    if (!Types.ObjectId.isValid(questionId)) {
      throw new NotFoundException("Question not found");
    }

    // Project to the response contract; keeps the embedding vector and other
    // internals out of the review payload.
    const question = await this.questionRepo.findById(questionId, [
      ...QUESTION_RESPONSE_SELECT,
      'isDeleted',
    ]);
    if (!question || question.isDeleted) {
      throw new NotFoundException("Question not found");
    }

    const [user, reviewer] = await Promise.all([
      Types.ObjectId.isValid(String(question.userId))
        ? this.userRepo.findById(String(question.userId), ['id', 'name', 'mobileNumber', 'state'])
        : null,
      question.reviewerId && Types.ObjectId.isValid(String(question.reviewerId))
        ? this.userRepo.findById(String(question.reviewerId), ['id', 'name'])
        : null,
    ]);

    return {
      ...question,
      id: String(question._id),
      user: user
        ? {
            id: String(user._id),
            name: user.name,
            mobileNumber: user.mobileNumber,
            state: user.state,
          }
        : null,
      reviewedByName: reviewer?.name ?? null,
    };
  }

  /**
   * Check whether a question in the curator queue is a duplicate of an existing
   * approved question. Mirrors the duplicate-detection logic used at submit time
   * (exact-match via Redis + DB, then GDB semantic search).
   *
   * Returns { isDuplicate: false } if no duplicate is found.
   * Returns { isDuplicate: true, matchedQuestion, matchedAnswer, similarityScore }
   *         if a duplicate was found in either the DB or GDB.
   */
  async checkDuplicate(questionId: string): Promise<{
    isDuplicate: boolean;
    matchedQuestion?: string;
    matchedAnswer?: string | null;
    similarityScore?: number | null;
    matchedUserName?: string | null;
  }> {
    if (!Types.ObjectId.isValid(questionId)) {
      throw new NotFoundException("Question not found");
    }

    const question = await this.questionRepo.findById(questionId);
    if (!question || question.isDeleted) {
      throw new NotFoundException("Question not found");
    }

    // Step 1: DB exact-match (case-insensitive, whitespace-trimmed, excluding self)
    const text = question.questionText.trim();
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const dbDup = await this.questionRepo.findOne({
      questionText: { $regex: `^\\s*${escaped}\\s*$`, $options: "i" },
      _id: { $ne: questionId }, // plain string: Mongoose casts it, and the repo won't mangle it
      status: QuestionStatus.APPROVED,
      isDeleted: { $ne: true },
    });

    if (dbDup) {
      // Replaces innerJoinAndSelect("q.user", "u")
      const matchedUser = Types.ObjectId.isValid(String(dbDup.userId))
        ? await this.userRepo.findById(String(dbDup.userId))
        : null;

      return {
        isDuplicate: true,
        matchedQuestion: dbDup.questionText,
        matchedAnswer: null, // exact DB match has no stored answer in this query path
        similarityScore: null,
        matchedUserName: matchedUser?.name ?? null,
      };
    }

    // Step 2: GDB semantic duplicate check (unchanged)
    const gdbResult = await this.gdbService.checkDuplicate({
      questionText: question.questionText,
      languageCode: question.language,
    });

    if (gdbResult.isDuplicate) {
      return {
        isDuplicate: true,
        matchedQuestion: gdbResult.matchedQuestion ?? undefined,
        matchedAnswer: gdbResult.matchedAnswer ?? null,
        similarityScore: gdbResult.similarityScore ?? null,
        matchedUserName: gdbResult.matchedUserName ?? null,
      };
    }

    return { isDuplicate: false };
  }

  async reviewQuestion(
    reviewerId: string,
    questionId: string,
    dto: ReviewActionDto,
    reviewerRole: UserRole = UserRole.ADMIN,
  ) {
    const question = await this.questionRepo.findOne({ id: questionId });
    if (!question) throw new NotFoundException("Question not found");
    if (question.isDeleted)
      throw new Error("Deleted questions are not allowed to review...");
    const terminalStatuses = [QuestionStatus.APPROVED, QuestionStatus.REJECTED];
    if (terminalStatuses.includes(question.status)) {
      throw new BadRequestException("Question has already been reviewed");
    }

    const actorType: ActorType =
      reviewerRole === UserRole.CURATOR ? ActorType.CURATOR : ActorType.ADMIN;
    const oldStatus = question.status;

    if (dto.action === "approve") {
      // Count total approved questions for this user (to compute reward tier)
      const approvedCount = await this.questionRepo.count({ userId: question.userId, status: QuestionStatus.APPROVED });
      // Include the one being approved right now in the count for tier calculation
      const rewardTierCount = approvedCount + 1;

      await this.questionRepo.update(questionId, {
        status: QuestionStatus.APPROVED,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        approvalReason: dto.reason ?? null,
      });

      // Credit reward to user wallet
      const rewardResult = await this.walletsService.creditReward({
        userId: question.userId,
        questionId,
        approvedCount: rewardTierCount,
      });

      // Update Redis caches: leaderboard score + analytics counters
      await Promise.all([
        this.hotDataService.incrementLeaderboardScore(
          Number(question.userId),
          1,
        ),
        this.analyticsCacheService.onQuestionApproved(),
        this.hotDataService.incrementTodayApprovals(),
      ]).catch((err) =>
        this.logger.warn(
          `Redis cache update failed after approval: ${err.message}`,
        ),
      );

      await this.notificationRepo.save(
        await this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_APPROVED,
          title: "Question Approved",
          body: `Your question "${question.questionText.slice(0, 80)}..." has been approved. Rs. ${rewardResult.transaction.amount} has been credited to your wallet.`,
          data: { questionId, status: "approved" },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );

      return {
        success: true,
        action: "approved",
        questionId,
        rewardCredited: rewardResult.transaction.amount,
        newBalance: rewardResult.newBalance,
      };
    }

    if (dto.action === "reject") {
      // Reason is required for rejection
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException(
          "Rejection reason is required when rejecting a question",
        );
      }
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.REJECTED,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: dto.reason ?? null,
      });
      await this.analyticsCacheService
        .onQuestionRejected()
        .catch((err) =>
          this.logger.warn(
            `Redis cache update failed after rejection: ${err.message}`,
          ),
        );
      await this.notificationRepo.save(
        await this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_REJECTED,
          title: "Question Not Approved",
          body: `Your question "${question.questionText.slice(0, 80)}..." was not approved. Reason: ${dto.reason}`,
          data: { questionId, status: "rejected" },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
      return {
        success: true,
        action: "rejected",
        questionId,
        rejectionReason: dto.reason,
      };
    }

    if (dto.action === "hold") {
      // Held reason is required when putting a question on hold
      if (!dto.heldReason || !dto.heldReason.trim()) {
        throw new BadRequestException(
          "Held reason is required when holding a question",
        );
      }
      // Held status: question is put on hold for later re-review
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.HELD,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        heldReason: dto.heldReason ?? null,
      });
      await this.notificationRepo.save(
        await this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_HELD,
          title: "Question Under Review",
          body: `Your question "${question.questionText.slice(0, 80)}..." has been placed under review. Reason: ${dto.heldReason}`,
          data: { questionId, status: "held" },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
      return {
        success: true,
        action: "held",
        questionId,
        heldReason: dto.heldReason,
      };
    }

    // request_info — hold for more info from user
    await this.questionRepo.update(questionId, {
      status: QuestionStatus.HELD,
    });
    await this.notificationRepo.save(
      await this.notificationRepo.create({
        userId: question.userId,
        type: NotificationType.QUESTION_INFO_REQUESTED,
        title: "More Information Needed",
        body: `Your question "${question.questionText.slice(0, 80)}..." requires additional information.`,
        data: { questionId, status: "human_review" },
        triggerType: NotificationTriggerType.QUESTION,
      }),
    );
    return { success: true, action: "request_info", questionId };
  }
}

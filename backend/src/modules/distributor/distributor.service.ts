import {
  Inject,
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole, QuestionStatus, AuditAction, ActorType } from '../../shared/classes/enums';
import {
  IFinalQuestionRepository,
  IQuestionRepository,
  IAuditLogRepository,
  IUserRepository,
} from '../../shared/database/repositories';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { INDIAN_STATES } from '../../shared/constants/indian-states.constant';
import { mongoLike, toObjectIdOrNull } from '../../shared/database/abstractions/mongo-utils';

import { AssignStatesDto, ListApprovedQuestionsDto, ListDistributionsDto } from './dto';

/**
 * Build an `ObjectId` from a 24-char hex string. Throws `BadRequestException`
 * when the input is not a valid ObjectId — used for FK fields that MUST be
 * ObjectIds in Mongo (e.g. `final_questions.questionId`, `.distributorId`).
 */
function toObjectIdOrThrow(value: string, fieldName: string): Types.ObjectId {
  if (typeof value !== 'string' || value.length !== 24 || !Types.ObjectId.isValid(value)) {
    throw new BadRequestException(
      `Invalid ${fieldName}: expected a 24-character Mongo ObjectId string.`,
    );
  }
  return new Types.ObjectId(value);
}

@Injectable()
export class DistributorService {
  private readonly logger = new Logger(DistributorService.name);

  constructor(
    @Inject(REPOSITORY_TOKENS.FinalQuestion)
    private readonly finalQuestionRepo: IFinalQuestionRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
  ) {}

  // ── Approved-questions queue ─────────────────────────────────────────────

  async listApprovedQuestions(actorId: string, actorRole: UserRole, dto: ListApprovedQuestionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const sortBy = dto.sortBy ?? 'approvedAt';
    const sortOrder = (dto.sortOrder ?? 'DESC') === 'ASC' ? 1 : -1;

    const filter: Record<string, unknown> = { status: QuestionStatus.APPROVED };
    if (dto.search) filter.questionText = mongoLike(dto.search);

    const result = await this.questionRepo.findAndCount(filter, {
      pagination: { page, limit, sort: { [sortBy]: sortOrder } },
    });

    return {
      items: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.totalPages,
      actorId,
      actorRole,
    };
  }

  async getApprovedQuestion(questionId: string) {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new NotFoundException('Question not found.');

    const status = (question as unknown as { status: QuestionStatus }).status;
    if (status !== QuestionStatus.APPROVED) {
      throw new BadRequestException(
        `Question is no longer in approved status (current: ${status}).`,
      );
    }

    return question;
  }

  // ── Distribution operations ──────────────────────────────────────────────

  async assignStates(
    actorId: string,
    actorRole: UserRole,
    questionId: string,
    dto: AssignStatesDto,
  ) {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new NotFoundException('Question not found.');

    const status = (question as unknown as { status: QuestionStatus }).status;
    if (status !== QuestionStatus.APPROVED) {
      throw new BadRequestException(
        `Only approved questions can be distributed (current status: ${status}).`,
      );
    }

    // Convert FK string-ids to Mongo ObjectIds BEFORE checking existing
    // assignments and inserting, so:
    //   1. The schema-declared `Types.ObjectId` type is respected at write time.
    //   2. Invalid ids are rejected immediately with a clear 400 (rather than
    //      a generic Mongoose CastError during insert).
    const questionObjectId = toObjectIdOrThrow(questionId, 'referenceQuestionId');
    const distributorObjectId = toObjectIdOrThrow(actorId, 'distributorId');

    // Snapshot ALL Question fields onto each final_question row.
    // Each row in `final_questions` is self-contained — readers do NOT need
    // to $lookup the source question. See final-question.schema.ts for the
    // full field-naming rules.
    const snapshot = this.snapshotQuestion(question as unknown as Record<string, unknown>);

    // ── Step 1: Find or create the canonical reference doc ──────────────────
    // The reference doc is the "original question" written to final_questions.
    // Exactly one reference doc exists per (referenceQuestionId); each
    // state-specific row is a child of it (parentReferenceId: ObjectId).
    // Distribution of N states produces N+1 docs total (1 ref + N state rows).
    // The unique compound index on (referenceQuestionId, distributionState)
    // guarantees at most one reference doc per question because `null` is a
    // distinct value in Mongo's unique index.
    let referenceDoc: Awaited<ReturnType<typeof this.finalQuestionRepo.findReferenceByQuestionId>> | { _id: Types.ObjectId } | null =
      await this.finalQuestionRepo.findReferenceByQuestionId(questionId);
    let referenceDocId: Types.ObjectId;
    let referenceDocCreated = false;

    if (!referenceDoc) {
      try {
        const created = await this.finalQuestionRepo.create({
          referenceQuestionId: questionObjectId,
          distributionState: null,
          distributorId: distributorObjectId,
          notes: dto.notes ?? null,
          isActive: true,
          isReference: true,
          parentReferenceId: null,
          ...snapshot,
        } as never);
        referenceDoc = created as unknown as { _id: Types.ObjectId };
        referenceDocId = (referenceDoc as unknown as { _id: Types.ObjectId })._id;
        referenceDocCreated = true;

        await this.auditRepo.create({
          actorType: ActorType.DISTRIBUTOR,
          actorId,
          action: AuditAction.QUESTION_DISTRIBUTED,
          entityType: 'final_question',
          entityId: (referenceDoc as unknown as { id?: string }).id ?? questionId,
          metadata: {
            referenceQuestionId: questionId,
            isReference: true,
            distributionState: null,
            distributorRole: actorRole,
          },
        } as never);
      } catch (err) {
        // Race: a concurrent call already created the reference doc. The
        // unique index on (referenceQuestionId, distributionState: null)
        // throws E11000. Recover by re-reading the winning doc.
        const raceErr = err as { code?: number };
        if (raceErr && raceErr.code === 11000) {
          referenceDoc = await this.finalQuestionRepo.findReferenceByQuestionId(questionId);
          if (!referenceDoc) throw err; // genuine create failure
          referenceDocId = (referenceDoc as unknown as { _id: Types.ObjectId })._id;
        } else {
          throw err;
        }
      }
    } else {
      referenceDocId = (referenceDoc as unknown as { _id: Types.ObjectId })._id;
    }

    // ── Step 2: Create state-specific child docs (one per new state) ────────
    // `findByReferenceQuestionId` returns ALL docs for the question,
    // INCLUDING the reference doc (which has distributionState: null). We
    // therefore exclude nulls when building the existing-states set so that
    // subsequent checks (`existingStates.has(s)`) compare string-to-string.
    const alreadyAssigned = await this.finalQuestionRepo.findByReferenceQuestionId(questionId);
    const existingStates = new Set<string>(
      alreadyAssigned
        .map((r) => (r as unknown as { distributionState: string | null }).distributionState)
        .filter((s): s is string => typeof s === 'string'),
    );

    const toInsert = dto.states.filter((s) => !existingStates.has(s));
    const skipped = dto.states.filter((s) => existingStates.has(s));

    const inserted: unknown[] = [];
    for (const distributionState of toInsert) {
      const row = await this.finalQuestionRepo.create({
        referenceQuestionId: questionObjectId,
        distributionState,
        distributorId: distributorObjectId,
        notes: dto.notes ?? null,
        isActive: true,
        isReference: false,
        parentReferenceId: referenceDocId,
        ...snapshot,
      } as never);
      inserted.push(row);

      await this.auditRepo.create({
        actorType: ActorType.DISTRIBUTOR,
        actorId,
        action: AuditAction.QUESTION_DISTRIBUTED,
        entityType: 'final_question',
        entityId: (row as unknown as { id?: string }).id ?? questionId,
        metadata: {
          referenceQuestionId: questionId,
          distributionState,
          isReference: false,
          parentReferenceId: referenceDocId.toHexString(),
          distributorRole: actorRole,
        },
      } as never);
    }

    // Flip parent question status exactly once (idempotent).
    if (status === QuestionStatus.APPROVED) {
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.MOVED_TO_FINAL,
      } as never);

      await this.auditRepo.create({
        actorType: ActorType.DISTRIBUTOR,
        actorId,
        action: AuditAction.QUESTION_DISTRIBUTED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: QuestionStatus.APPROVED },
        newValue: { status: QuestionStatus.MOVED_TO_FINAL, assignedStates: dto.states },
      } as never);
    }

    return {
      referenceQuestionId: questionId,
      referenceDocId: referenceDocId.toHexString(),
      referenceDocCreated,
      insertedStates: toInsert,
      skippedStates: skipped,
      insertedCount: inserted.length,
      totalStates: INDIAN_STATES.length,
      questionStatus: QuestionStatus.MOVED_TO_FINAL,
    };
  }

  /**
   * Build the denormalized snapshot of a Question document for storage on
   * a `final_questions` row. Field-naming rules:
   *
   *   - `userId`, `language`, `domains`, `season`, `cropType`,
   *     `agroClimaticZone`, `state` (home), `district`, `block`,
   *     `questionText`, `embedding`, `mediaType`, `mediaUrls`, `deviceInfo`,
   *     `status`, `duplicateFlag`, `duplicateOfId`, `submittedAt`,
   *     `reviewedAt`, `reviewerId`, `rejectionReason`, `heldReason`,
   *     `approvalReason` — copied flat under their original field names.
   *   - `userId` and `reviewerId` are coerced from the source Question's
   *     string representation into Mongo `ObjectId` instances so they
   *     match the schema declaration and can be used in `$lookup` joins
   *     against the `users` collection. If the source value is not a valid
   *     24-char hex ObjectId the field is set to `null` and a warning is
   *     logged (defensive — this should never happen with healthy data).
   *   - `_id` / `id` are NOT copied — the FK is `referenceQuestionId` and
   *     carries that information already.
   */
  private snapshotQuestion(q: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    // Plain-copy fields that don't collide with final_question's own fields.
    const flatFields = [
      'language',
      'domains',
      'season',
      'cropType',
      'agroClimaticZone',
      'state', // source Question's HOME state — distinct from distributionState
      'district',
      'block',
      'questionText',
      'embedding',
      'mediaType',
      'mediaUrls',
      'deviceInfo',
      'status',
      'duplicateFlag',
      'duplicateOfId',
      'submittedAt',
      'reviewedAt',
      'rejectionReason',
      'heldReason',
      'approvalReason',
    ];
    for (const k of flatFields) {
      if (k in q) out[k] = q[k];
    }

    // userId / reviewerId are FKs to users._id — coerce the source string
    // into a proper Mongo ObjectId so the persisted row matches the schema
    // declaration and can be used in $lookup joins.
    if ('userId' in q) {
      const oid = toObjectIdOrNull(q.userId as string | Types.ObjectId | null);
      if (q.userId != null && oid == null) {
        this.logger.warn(
          `snapshotQuestion: source Question.userId is not a valid ObjectId hex string; persisting null. value=${JSON.stringify(q.userId)}`,
        );
      }
      out.userId = oid;
    }
    if ('reviewerId' in q) {
      const oid = toObjectIdOrNull(q.reviewerId as string | Types.ObjectId | null);
      if (q.reviewerId != null && oid == null) {
        this.logger.warn(
          `snapshotQuestion: source Question.reviewerId is not a valid ObjectId hex string; persisting null. value=${JSON.stringify(q.reviewerId)}`,
        );
      }
      out.reviewerId = oid;
    }

    return out;
  }

  async listDistributions(actorId: string, actorRole: UserRole, dto: ListDistributionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter: Record<string, unknown> = {};
    if (dto.distributionState) filter.distributionState = dto.distributionState;
    if (dto.search) filter.questionText = mongoLike(dto.search);

    const result = await this.finalQuestionRepo.findAndCount(filter, {
      pagination: { page, limit, sort: { createdAt: -1 } },
    });

    // Enrich each row with its distributor's display name so the UI doesn't
    // have to render a raw ObjectId. One bulk lookup per page instead of N
    // per-row round-trips. Missing user (deleted/legacy id) → `distributor`
    // stays `null` and the client falls back to the truncated id.
    //
    // NB: `final_questions.distributorId` is stored as ObjectId in Mongo, so
    // Mongoose hands us a `Types.ObjectId` instance here, NOT a plain string.
    // We must coerce via `String(...)` (which calls `ObjectId.toString()` and
    // returns the 24-char hex) before both the `findByIds` call and the
    // per-row Map lookup, otherwise the type guard `typeof id === 'string'`
    // silently drops every row and the lookup table ends up empty.
    const distinctDistributorIds = Array.from(
      new Set(
        result.data
          .map((row) => {
            const v = (row as unknown as { distributorId?: unknown }).distributorId;
            return v == null ? null : String(v);
          })
          .filter((id): id is string => id != null && id.length > 0),
      ),
    );
    const users = await this.userRepo.findByIds(distinctDistributorIds);
    const userById = new Map(users.map((u) => [u.id, u]));

    const items = result.data.map((row) => {
      const rawId = (row as unknown as { distributorId?: unknown }).distributorId;
      const idStr = rawId == null ? null : String(rawId);
      const u = idStr ? userById.get(idStr) : undefined;
      return {
        ...(row as unknown as Record<string, unknown>),
        distributor: u
          ? { id: u.id, name: u.name, username: u.username }
          : null,
      };
    });

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.totalPages,
      actorId,
      actorRole,
    };
  }

  async getDistributionsForQuestion(questionId: string) {
    const rows = await this.finalQuestionRepo.findByReferenceQuestionId(questionId);

    // The reference doc is part of the same query result now (it's stored with
    // distributionState: null + isReference: true). Separate it out so existing
    // callers continue to receive ONLY state-specific rows in `states` and
    // `entries`; the canonical reference is exposed in its own fields.
    const referenceDoc = rows.find(
      (r) => (r as unknown as { distributionState: string | null }).distributionState === null,
    ) ?? null;
    const stateRows = rows.filter(
      (r) => (r as unknown as { distributionState: string | null }).distributionState !== null,
    );

    return {
      questionId,
      states: stateRows.map(
        (r) => (r as unknown as { distributionState: string }).distributionState,
      ),
      entries: stateRows,
      referenceDocId: referenceDoc
        ? (referenceDoc as unknown as { id?: string }).id ?? null
        : null,
      referenceDoc,
    };
  }

  async getStats() {
    const counts = await this.finalQuestionRepo.countByDistributionState();
    return {
      indianStatesTotal: INDIAN_STATES.length,
      byState: counts,
    };
  }
}
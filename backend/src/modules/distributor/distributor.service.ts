import {
  Inject,
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
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
import { ConfigService } from '@nestjs/config';

/**
 * Reviewer ingestion endpoint. Called from `assignStates` after a question is
 * successfully distributed into `final_questions` so the reviewer backend
 * can generate embeddings asynchronously server-side.
 */


/**
 * The reviewer ingestion API typically returns a JSON body shaped like:
 *
 *     {
 *       "success": true,
 *       "message": "Successfully ingested N Question Collection question(s). Embeddings are being generated in the background.",
 *       "count": N,
 *       "questionIds": ["..."]
 *     }
 *
 * The reviewer team owns that schema and may change it without notice, so
 * we DO NOT validate it here. We just pass `res.data` through to the
 * caller under `reviewerResponse` (typed `unknown`). Callers that want to
 * read specific fields must narrow the value first.
 */

/**
 * Return shape of `assignStates`.
 *
 * The top-level fields (`success`, `message`, `count`, `questionIds`)
 * describe what *this* service did locally — they are stable, we
 * control them, and they are always populated. `success` reflects
 * the local distribution only (DB inserts), NOT the reviewer call.
 *
 * The `reviewerResponse` field carries the raw JSON body the reviewer
 * ingestion API returned via `res.data`. It is omitted (i.e. `undefined`)
 * in two cases:
 *   1. No rows were inserted (we don't call the reviewer in that case).
 *   2. The reviewer API failed (timeout, network error, non-2xx response).
 *      In that case the local distribution still succeeded — see the
 *      `message` field — and `reviewerResponse` will be `undefined` so
 *      the frontend can distinguish "reviewer not consulted" from
 *      "reviewer returned something".
 *
 * Exported so the controller's public `assignStates` method has a named
 * return type — without it TS reports TS4053 because the inferred return
 * shape is unnameable from outside this module.
 */
export interface AssignStatesResult {
  /** Whether the local distribution operation succeeded (DB inserts). */
  success: boolean;
  /**
   * Human-readable summary of what this service did. Reflects both
   * the local result and (when relevant) the reviewer ingestion outcome.
   */
  message: string;
  /** Number of `final_question` rows we created in our DB. */
  count: number;
  /** IDs of the `final_question` rows we created (our local Mongo IDs). */
  questionIds: string[];
  /**
   * Raw response body from the reviewer ingestion API (`res.data`).
   * Omitted (`undefined`) when no rows were inserted OR when the
   * reviewer call failed. Typed as `unknown` because we do not
   * validate the reviewer's response shape — see the docblock above
   * for the typical shape.
   */
}

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
  private readonly reviewerIngestUri: string;
  private readonly apiKey: string
  constructor(
    @Inject(REPOSITORY_TOKENS.FinalQuestion)
    private readonly finalQuestionRepo: IFinalQuestionRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    private readonly configService: ConfigService
  ) {
    this.reviewerIngestUri = this.configService.get<string>("reviewSystem.reviewerUri") || process.env.REVIEWER_INGEST_URL || "";
    this.apiKey = this.configService.get<string>("reviewSystem.apiKey") || process.env.REVIEW_SYSTEM_AUTH_KEY || ''
  }

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
  ): Promise<AssignStatesResult> {
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
    let existingReferenceDoc: Awaited<ReturnType<typeof this.finalQuestionRepo.findReferenceByQuestionId>> | null =
      await this.finalQuestionRepo.findReferenceByQuestionId(questionId);
    let referenceDocId: Types.ObjectId;
    let referenceDocCreated = false;

    if (!existingReferenceDoc) {
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
        // ASYMMETRY NOTE: `create()` returns the result of `docToEntity()`,
        // which renames the Mongoose `_id` (ObjectId) → `id` (string).
        // See MongoRepository.docToEntity(). The previous version cast
        // `created` as `{ _id: Types.ObjectId }` and accessed `._id`,
        // producing `undefined` at runtime — the audit metadata
        // `.toHexString()` then crashed. Read `.id` instead and convert
        // back to ObjectId.
        referenceDocId = new Types.ObjectId(
          (created as unknown as { id: string }).id,
        );
        referenceDocCreated = true;

        await this.auditRepo.create({
          actorType: ActorType.DISTRIBUTOR,
          actorId,
          action: AuditAction.QUESTION_DISTRIBUTED,
          entityType: 'final_question',
          entityId: (created as unknown as { id?: string }).id ?? questionId,
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
        // ASYMMETRY NOTE: `findReferenceByQuestionId` returns a RAW
        // Mongoose document (it does NOT go through `docToEntity`),
        // so the winning doc has `_id: Types.ObjectId` (not `id: string`).
        const raceErr = err as { code?: number };
        if (raceErr && raceErr.code === 11000) {
          const winner = await this.finalQuestionRepo.findReferenceByQuestionId(questionId);
          if (!winner) throw err; // genuine create failure
          referenceDocId = (winner as unknown as { _id: Types.ObjectId })._id;
        } else {
          throw err;
        }
      }
    } else {
      // Raw Mongoose document from `findReferenceByQuestionId` — `_id` is a real ObjectId.
      referenceDocId = (existingReferenceDoc as unknown as { _id: Types.ObjectId })._id;
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

    // ── Step 3: Forward the newly-distributed question to the reviewer
    // ingestion API ────────────────────────────────────────────────────────
    // The reviewer backend generates embeddings asynchronously server-side,
    // so we POST synchronously and surface the ingestion IDs it returns.
    //
    // Every row in `inserted` shares the same source-question snapshot
    // (questionText, state, district, cropType, season, domains); they
    // differ only in `distributionState`, which the reviewer API doesn't
    // care about. So a single ingestion request — built from the first
    // inserted row — is sufficient regardless of how many states were
    // assigned in this call.
    if (inserted.length === 0) {
      // All requested states were already distributed (no new rows).
      // No reviewer call is needed; return our local summary shape with
      // no `reviewerResponse` (we don't know what the reviewer would have
      // said since we didn't call it).
      return {
        success: true,
        message: 'No new state assignments to ingest.',
        count: 0,
        questionIds: [],
      };
    }

    const sample = inserted[0] as unknown as {
      questionText?: string | null;
      state?: string | null;
      district?: string | null;
      cropType?: string | null;
      season?: string | null;
      domains?: unknown;
    };

    const reviewerPayload = {
      question_collection_questions: [
        {
          question: sample.questionText ?? '',
          priority: 'medium' as const,
          details: {
            state: sample.state ?? null,
            district: sample.district ?? null,
            crop: sample.cropType ?? null,
            season: sample.season ?? null,
            domain: Array.isArray(sample.domains) ? sample.domains : [],
          },
        },
      ],
    };

    // ── Step 3: Forward the newly-distributed question to the reviewer
    // ingestion API ────────────────────────────────────────────────────────
    // The reviewer backend generates embeddings asynchronously server-side,
    // so we POST synchronously and surface the ingestion IDs it returns.
    //
    // **Reviewer ingestion is best-effort.** The user's primary intent is to
    // assign states (which is already committed in `final_questions` above).
    // If the reviewer API is unreachable, times out, or returns an error,
    // we MUST NOT fail the whole request — that would leave the user's DB
    // in a confusing state where rows are saved but the API returns 502.
    // Instead we log a warning, adjust the `message` to be clear about what
    // succeeded, and omit `reviewerResponse` from the return envelope.
    let reviewerResponseData;
    let reviewerIngestFailed = false;
    let reviewerFailureReason = 'unknown error';
    try {
      const res = await axios.post(
        this.reviewerIngestUri,
        reviewerPayload,
        {
          headers: { 'Content-Type': 'application/json',  'x-internal-api-key': this.apiKey },
          timeout: 30_000,
        },
      );
      // Pass `res.data` through verbatim. We don't validate the reviewer's
      // response shape (the reviewer team owns it), so this is `unknown`
      // and the caller can narrow if they need specific fields.
      reviewerResponseData = res.data;
    } catch (err) {
      reviewerIngestFailed = true;
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status) {
        reviewerFailureReason = `HTTP ${axiosErr.response.status}`;
      } else if (axiosErr.code) {
        reviewerFailureReason = `${axiosErr.code} (${axiosErr.message})`;
      } else {
        reviewerFailureReason = axiosErr.message || 'unknown error';
      }
      this.logger.warn(
        `[assignStates] Reviewer ingestion FAILED for questionId=${questionId} ` +
          `— local distribution still succeeded: ${reviewerFailureReason}` +
          (axiosErr.response?.data
            ? ` response=${JSON.stringify(axiosErr.response.data)}`
            : ''),
      );
      // Intentionally do NOT re-throw. The user's primary operation
      // (state assignment + `final_questions` inserts) has already
      // committed and must not be rolled back / failed by a downstream
      // reviewer-side outage. The question can be re-ingested into the
      // reviewer backend later via a separate retry job if needed.
    }

    if(reviewerIngestFailed){
      return {
        success: false,
        message: `Assigned ${inserted.length} question(s) locally; reviewer ingestion failed (${reviewerFailureReason}).`,
        count: inserted.length,
        questionIds: inserted
        .map((r) => (r as unknown as { id?: string }).id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
      }
    }

    return reviewerResponseData as AssignStatesResult;
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
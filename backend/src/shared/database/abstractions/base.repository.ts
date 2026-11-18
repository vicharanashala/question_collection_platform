import { ClientSession } from 'mongoose';

// ─── Pagination / Sort options ─────────────────────────────────────────────

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface FindAllOptions<T> {
  pagination?: PaginationOptions;
  /** Field names to include in the result (projection). `id` maps to `_id`. */
  select?: string[];
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Result of a bulk update operation. `affected` may be 0 when no rows match. */
export interface UpdateResult {
  affected?: number;
  raw?: unknown;
}

// ─── Query filter shorthand ─────────────────────────────────────────────────

/**
 * Mongo filter passed to a repository; an `id` key is queried as `_id`.
 * A `where` key is rejected at compile time so the old `{ where: { ... } }`
 * wrapper cannot silently become a filter on a field named "where".
 */
export type EntityFilter<T> = Record<string, unknown> & { where?: never };

// ─── Abstract base repository ───────────────────────────────────────────────

/**
 * BaseRepository<T> defines the CRUD contract implemented by MongoRepository<T>.
 * Services interact only with this interface.
 *
 * Entity-specific methods (e.g. findByMobile, findPendingByUserId) live in
 * dedicated repo classes that extend or compose this base.
 */
export abstract class BaseRepository<T extends object> {
  // ─── Standard CRUD ────────────────────────────────────────────────────────

  /**
   * Returns all documents matching `filter`.
   * Use `options.pagination` for cursor/skip-limit pagination.
   */
  abstract findAll(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<T[]>;

  /**
   * Returns a single document matching `filter`, or null.
   * Pass `session` to read within an active Mongo transaction.
   */
  abstract findOne(filter: EntityFilter<T>, session?: ClientSession, select?: string[]): Promise<T | null>;

  /**
   * Returns a document by its string id (uuid / ObjectId), or null.
   */
  abstract findById(id: string, select?: string[]): Promise<T | null>;

  /**
   * Creates and returns a new document.
   */
  abstract create(data: Partial<T>, session?: ClientSession): Promise<T>;

  /**
   * Updates a document by id and returns the updated document, or null.
   */
  abstract update(id: Object, data: Partial<T>, session?: ClientSession): Promise<T | null>;

  /**
   * Bulk-updates all documents matching `filter` with `data`.
   */
  abstract updateMany(filter: EntityFilter<T>, data: Partial<T>, session?: ClientSession): Promise<UpdateResult>;

  /**
   * Deletes a document by id. Returns true on success.
   */
  abstract delete(id: string): Promise<boolean>;

  /**
   * Counts documents matching `filter` (e.g. `{ status: 'approved' }`).
   * When called with no args returns total document count.
   */
  abstract count(filter?: EntityFilter<T>): Promise<number>;

  /**
   * Atomically decreases a numeric field on every document matching `filter`.
   */
  abstract decrement(filter: EntityFilter<T>, field: string, amount: number, session?: ClientSession): Promise<void>;

  /**
   * Increment a numeric counter field atomically.
   * Falls back to find+save when the underlying driver doesn't support it.
   */
  abstract increment(filter: EntityFilter<T>, field: string, amount: number, session?: ClientSession): Promise<void>;

  /**
   * Returns matching documents + total count in one round-trip.
   */
  abstract findAndCount(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<PaginatedResult<T>>;

  /**
   * Ad-hoc query by id — convenience alias.
   */
  abstract find(filter?: EntityFilter<T>): Promise<T[]>;

  /**
   * Persists (insert or update) a document. Returns the saved document.
   */
  abstract save(entity: Partial<T>, session?: ClientSession): Promise<T>;

}
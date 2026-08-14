import { ClientSession } from 'mongoose';

// ─── Pagination / Sort options ─────────────────────────────────────────────

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface FindAllOptions<T> {
  pagination?: PaginationOptions;
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

/** Flat key-value filter map — compatible with both Mongoose and TypeORM where clauses */
export type EntityFilter<T> = Record<string, unknown>;

// ─── Query builder interface ───────────────────────────────────────────────

/**
 * Chainable query builder contract shared by Postgres (TypeORM SelectQueryBuilder)
 * and Mongo (MongoQueryBuilder) implementations.
 *
 * All methods that modify the query return `this` to enable chaining.
 * Terminator methods (.getMany, .getOne, .getRawMany, .getRawOne) return Promises.
 */
export interface QueryBuilderInterface<T> {
  // Filtering
  where(key: string, params?: Record<string, unknown>): this;
  andWhere(key: string, params?: Record<string, unknown>): this;

  // Sorting
  orderBy(field: string, dir?: 'ASC' | 'DESC'): this;
  addOrderBy(field: string, dir?: 'ASC' | 'DESC'): this;

  // Grouping (Postgres-only; no-op on Mongo)
  groupBy(field: string): this;
  /**
   * Append an additional GROUP BY clause.
   * TypeORM: queryBuilder.addGroupBy('q.state')
   * PostgresRepository: delegates to TypeORM
   * MongoRepository: no-op
   */
  addGroupBy(field: string): this;

  // Pagination
  skip(n: number): this;
  take(n: number): this;
  limit(n: number): this;

  // Projection / Joins
  /**
   * Select an array of fields for the query result.
   * TypeORM: queryBuilder.select(['u.id', 'u.name'])
   * PostgresRepository: prefixes each with the query alias
   * MongoRepository: sets projection
   */
  select(columns: string[]): this;
  /**
   * Select a single field/expression with an optional alias.
   * TypeORM: queryBuilder.select('q.state', 'state')
   * PostgresRepository: delegates to TypeORM SelectQueryBuilder.select
   * MongoRepository: sets projection for that field
   */
  select(selection: string, alias?: string): this;

  /**
   * Add a field/aggregate to the SELECT clause without removing existing selects.
   * TypeORM: queryBuilder.addSelect(`COUNT(*)`, 'count')
   * PostgresRepository: delegates to TypeORM SelectQueryBuilder.addSelect
   * MongoRepository: appends to internal projection
   */
  addSelect(selection: string, alias?: string): this;

  leftJoinAndSelect(
    relation: string,
    alias: string,
    on?: string,
    params?: Record<string, unknown>,
  ): this;
  leftJoin(
    relation: string,
    alias: string,
    on?: string,
    params?: Record<string, unknown>,
  ): this;
  innerJoin(
    relation: string,
    alias: string,
    on?: string,
    params?: Record<string, unknown>,
  ): this;
  innerJoinAndSelect(
    relation: string,
    alias: string,
    on?: string,
    params?: Record<string, unknown>,
  ): this;

  // Terminators
  getMany(): Promise<T[]>;
  getOne(): Promise<T | null>;
  getRawMany<T = Record<string, unknown>>(): Promise<T[]>;
  getRawOne<T = Record<string, unknown>>(): Promise<T | null>;

  // ─── Additional query builder terminators ────────────────────────────────

  /**
   * Runs the query and returns both entity results and total count.
   * Default pagination (page/limit) is respected.
   */
  getManyAndCount(): Promise<[T[], number]>;
}

// ─── Abstract base repository ───────────────────────────────────────────────

/**
 * BaseRepository<T> defines the contract that both PostgresRepository<T> and
 * MongoRepository<T> must implement. Services interact only with this interface.
 *
 * All 13 entities share the same CRUD surface; entity-specific methods
 * (e.g. findByMobile, findPendingByUserId) live in dedicated repo classes
 * that extend or compose this base.
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
  abstract findOne(filter: EntityFilter<T>, session?: ClientSession): Promise<T | null>;

  /**
   * Returns a document by its string id (uuid / ObjectId), or null.
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * Creates and returns a new document.
   */
  abstract create(data: Partial<T>, session?: ClientSession): Promise<T>;

  /**
   * Updates a document by id and returns the updated document, or null.
   */
  abstract update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null>;

  /**
   * Bulk-updates all documents matching `filter` with `data`.
   */
  abstract updateMany(filter: EntityFilter<T>, data: Partial<T>, session?: ClientSession): Promise<UpdateResult>;

  /**
   * Deletes a document by id. Returns true on success.
   */
  abstract delete(id: string): Promise<boolean>;

  /**
   * Counts documents matching `filter`.
   * Supports plain filter objects (e.g. `{ status: 'approved' }`)
   * as well as TypeORM-style FindOptions wrappers `{ where: { status: 'approved' } }`
   * which are translated to MongoDB equivalents when DB=mongo.
   * When called with no args returns total document count.
   */
  abstract count(filter?: EntityFilter<T> | { where: EntityFilter<T> } | undefined): Promise<number>;

  /**
   * Bulk-update all documents matching `filter` with the given field value.
   * TypeORM: UPDATE ... SET field = field + amount WHERE ...
   * MongoDB:  { $inc: { field: amount } }
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

  // ─── Query builder (abstracted — each impl provides its own DSL) ─────────

  /**
   * Returns a chainable query builder scoped to `alias`.
   * - Postgres: returns TypeORM SelectQueryBuilder
   * - Mongo: returns a MongoQueryBuilder wrapper with chainable .where()/.sort()/.skip()/.limit()
   *
   * Callers should treat this opaquely and only call the standard .getMany() / .getRawMany()
   * / .getOne() / .getRawOne() / .skip() / .take() / .orderBy() / .where() methods.
   */
  abstract createQueryBuilder(alias: string): QueryBuilderInterface<T>;

  /** Returns a new instance (factory method) — useful for request-scoped repos */
}
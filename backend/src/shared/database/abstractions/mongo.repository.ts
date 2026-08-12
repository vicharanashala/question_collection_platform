import { Injectable, Logger } from '@nestjs/common';
import { Model, QueryOptions } from 'mongoose';
import {
  BaseRepository,
  EntityFilter,
  FindAllOptions,
  PaginatedResult,
} from './base.repository';
import {
  toSkipLimit,
  excludeFields,
  includeFields,
  toMongoFilter,
  translateValue,
} from './mongo-utils';

/**
 * MongoQueryBuilder<T> wraps a Mongoose Query with a chainable interface
 * that mirrors TypeORM's SelectQueryBuilder for simple cases.
 *
 * Supported chainable methods:
 *   .where(key: string, val?: unknown) | .where({ ... })
 *   .andWhere(key: string, val?: unknown)
 *   .orderBy(field: string, dir?: 'ASC' | 'DESC')
 *   .addOrderBy(field: string, dir?: 'ASC' | 'DESC')
 *   .skip(n: number) / .take(n: number) / .limit(n)
 *   .select(fields: string[])
 *   .leftJoinAndSelect(relation: string, alias: string)
 *   .leftJoin(relation: string, alias: string)
 *   .getMany(): Promise<T[]>
 *   .getOne(): Promise<T | null>
 *   .getRawMany(): Promise<Record<string, unknown>[]>
 *   .getRawOne(): Promise<Record<string, unknown> | null>
 *
 * LIMITATION: getRawMany/getRawOne on joined queries return raw mongo document
 * shape. For true raw SQL output, use aggregation pipelines instead.
 */
export class MongoQueryBuilder<T> {
  private _filter: Record<string, unknown> = {};
  private _sort: Record<string, 1 | -1> = {};
  private _skipVal?: number;
  private _limitVal?: number;
  private _selectVal?: Record<string, 0 | 1>;
  private _joins: Array<{ alias: string; field: string }> = [];

  constructor(private _model: Model<T>, private _alias: string) {}

  /** Strip TypeORM-style alias prefixes (e.g. "q.status" → "status") from a key or key path. */
  private stripAlias(key: string): string {
    return key.replace(/^[a-z_]+\./i, '');
  }

  /**
   * Parse a TypeORM-style condition string and substitute parameters.
   *
   * Handles:
   *   "alias.field = :param"         → { field: value }
   *   "alias.field IN (:...params)"  → { field: { $in: values } }
   *   "alias.field ILIKE :param"     → { field: { $regex: escaped_value, $options: 'i' } }
   *   "alias.field LIKE :param"      → { field: { $regex: escaped_value } }
   *
   * Returns { field, op, value } where field is stripped of alias prefix.
   */
  private parseCondition(
    key: string,
    params: Record<string, unknown>,
  ): { field: string; op: string; value: unknown; flags?: string; composite?: Record<string, unknown> } | null {
    const trimmedKey = key.trim();
    const field = this.stripAlias(trimmedKey);

    // BETWEEN :from AND :to → { field: { $gte: from, $lte: to } }
    const betweenMatch = trimmedKey.match(
      /^(?:[a-z_]+\.)?(\w+)\s+BETWEEN\s*:(\w+)\s+AND\s+:(\w+)/i,
    );
    if (betweenMatch) {
      const [, fromKey, toKey] = betweenMatch;
      const fromVal = params[fromKey];
      const toVal = params[toKey];
      if (fromVal !== undefined && toVal !== undefined) {
        const field = betweenMatch[1];
        return {
          field,
          op: '$composite',
          value: null,
          composite: {
            ...(fromVal instanceof Date ? { $gte: fromVal } : { $gte: fromVal }),
            ...(toVal instanceof Date ? { $lte: toVal } : { $lte: toVal }),
          },
        };
      }
      return null;
    }

    // >= :param → { field: { $gte: value } }
    const gteMatch = trimmedKey.match(/^(?:[a-z_]+\.)?(\w+)\s*>=\s*:(\w+)/i);
    if (gteMatch) {
      const paramName = gteMatch[2];
      const val = params[paramName];
      if (val !== undefined) {
        const field = gteMatch[1];
        return {
          field,
          op: '$composite',
          value: null,
          composite: { $gte: val instanceof Date ? val : new Date(val as string) },
        };
      }
      return null;
    }

    // <= :param → { field: { $lte: value } }
    const lteMatch = trimmedKey.match(/^(?:[a-z_]+\.)?(\w+)\s*<=\s*:(\w+)/i);
    if (lteMatch) {
      const paramName = lteMatch[2];
      const val = params[paramName];
      if (val !== undefined) {
        const field = lteMatch[1];
        return {
          field,
          op: '$composite',
          value: null,
          composite: { $lte: val instanceof Date ? val : new Date(val as string) },
        };
      }
      return null;
    }

    // IN (:...param) — spread array parameter
    // Note: TypeORM emits (:...paramName) with THREE dots, not two
    const inMatch = trimmedKey.match(/^(?:[a-z_]+\.)?(\w+)\s+IN\s*\(:\.\.\.(\w+)\)/i);
    if (inMatch) {
      const paramName = inMatch[2];
      const values = params[paramName];
      if (values !== undefined) {
        const field = inMatch[1];
        return { field, op: '$in' as const, value: Array.isArray(values) ? values : [values] };
      }
      return null;
    }

    // ILIKE / LIKE — case-insensitive / case-sensitive regex
    const likeMatch = trimmedKey.match(/^(?:[a-z_]+\.)?(\w+)\s+(?:ILIKE|LIKE)\s*:(\w+)/i);
    if (likeMatch) {
      const paramName = likeMatch[2];
      const raw = params[paramName];
      if (raw !== undefined) {
        const field = likeMatch[1];
        const escaped = String(raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = /ILIKE/i.test(trimmedKey) ? 'i' : '';
        return { field, op: '$regex', value: escaped, flags };
      }
      return null;
    }

    // = :param
    const eqMatch = trimmedKey.match(/^(?:[a-z_]+\.)?(\w+)\s*=\s*:(\w+)/i);
    if (eqMatch) {
      const paramName = eqMatch[2];
      const value = params[paramName];
      if (value !== undefined) {
        const field = eqMatch[1];
        return { field, op: '$eq', value };
      }
      return null;
    }

    return null;
  }

  where(key: string, val?: unknown): this {
    if (val !== undefined) {
      // Translate TypeORM operators (Between, LessThanOrEqual, Like, In, etc.)
      this._filter[this.stripAlias(key)] = translateValue(val);
    } else {
      // val is omitted — key is a plain filter object
      const nested = toMongoFilter(key);
      // Strip prefixes from all top-level keys in the nested filter too
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(nested)) {
        cleaned[this.stripAlias(k)] = v;
      }
      Object.assign(this._filter, cleaned);
    }
    return this;
  }

  andWhere(
    key: string,
    params?: Record<string, unknown> | unknown,
  ): this {
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      const parsed = this.parseCondition(key, params as Record<string, unknown>);
      if (parsed) {
        if (parsed.op === '$eq') {
          this._filter[parsed.field] = parsed.value;
        } else if (parsed.op === '$in') {
          this._filter[parsed.field] = { $in: parsed.value };
        } else if (parsed.op === '$regex') {
          this._filter[parsed.field] = parsed.flags
            ? { $regex: parsed.value, $options: parsed.flags }
            : { $regex: parsed.value };
        } else if (parsed.op === '$composite' && parsed.composite) {
          const existing = this._filter[parsed.field];
          if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            // Merge with existing filter on the same field (e.g., two calls with $gte and $lte)
            this._filter[parsed.field] = { ...existing as object, ...parsed.composite };
          } else {
            this._filter[parsed.field] = parsed.composite;
          }
        }
        return this;
      }
    }
    // Fallback: treat params as a plain value
    return this.where(key, params);
  }

  addSelect(_selection: string, _alias?: string): this {
    // MongoDB doesn't have ad-hoc field aliases in the same way as SQL.
    // For getRawMany() this is a no-op — raw docs include whatever fields exist.
    return this;
  }

  innerJoin(_relation: string, alias: string, _on?: string, _params?: Record<string, unknown>): this {
    this._joins.push({ alias, field: _relation.split('.')[1] ?? _relation });
    return this;
  }

  innerJoinAndSelect(_relation: string, alias: string, _on?: string, _params?: Record<string, unknown>): this {
    this._joins.push({ alias, field: _relation.split('.')[1] ?? _relation });
    return this;
  }

  orderBy(field: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    const cleanField = field.replace(/^[a-z_]+\./i, '');
    this._sort[cleanField] = dir === 'ASC' ? 1 : -1;
    return this;
  }

  addOrderBy(field: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    return this.orderBy(field, dir);
  }

  groupBy(_field: string): this {
    // MongoDB uses aggregation pipelines for grouping — no-op in query builder
    return this;
  }

  addGroupBy(_field: string): this {
    // MongoDB uses aggregation pipelines for grouping — no-op in query builder
    return this;
  }

  skip(n: number): this { this._skipVal = n; return this; }
  take(n: number): this { this._limitVal = n; return this; }
  limit(n: number): this { return this.take(n); }

  // select: overloads for array vs single-field forms
  select(columns: string[]): this;
  select(selection: string, alias?: string): this;
  select(columnsOrSelection: string | string[], _alias?: string): this {
    if (Array.isArray(columnsOrSelection)) {
      this._selectVal = includeFields(columnsOrSelection.map((c) => this.stripAlias(c)));
    } else {
      this._selectVal = includeFields([this.stripAlias(columnsOrSelection)]);
    }
    return this;
  }

  leftJoinAndSelect(_relation: string, alias: string, _on?: string, _params?: Record<string, unknown>): this {
    this._joins.push({ alias, field: _relation.split('.')[1] ?? _relation });
    return this;
  }

  leftJoin(_relation: string, alias: string, _on?: string, _params?: Record<string, unknown>): this {
    this._joins.push({ alias, field: _relation.split('.')[1] ?? _relation });
    return this;
  }

  private buildQuery(): Record<string, unknown> {
    return { ...this._filter };
  }

  private buildOpts(): QueryOptions<T> {
    const opts: QueryOptions<T> = {};
    if (Object.keys(this._sort).length) opts.sort = this._sort;
    if (this._skipVal != null) opts.skip = this._skipVal;
    if (this._limitVal != null) opts.limit = this._limitVal;
    if (this._selectVal) opts.projection = this._selectVal;
    return opts;
  }

  async getMany(): Promise<T[]> {
    return this._model.find(this.buildQuery() as Record<string, unknown>, this._selectVal ?? undefined, this.buildOpts()).exec() as Promise<T[]>;
  }

  async getOne(): Promise<T | null> {
    return this._model.findOne(this.buildQuery() as Record<string, unknown>, this._selectVal ?? undefined).sort(this._sort).exec() as Promise<T | null>;
  }

  async getRawMany<T = Record<string, unknown>>(): Promise<T[]> {
    const docs = await this._model.find(this.buildQuery() as Record<string, unknown>, undefined, this.buildOpts()).exec();
    return Array.from(docs).map((d) => {
      const obj = d as unknown as Record<string, unknown>;
      if ('_id' in obj && obj._id != null) {
        return { ...obj, id: String(obj._id), _id: undefined } as unknown as T;
      }
      return obj as unknown as T;
    });
  }

  async getRawOne<T = Record<string, unknown>>(): Promise<T | null> {
    const doc = await this._model.findOne(this.buildQuery() as Record<string, unknown>).sort(this._sort).exec();
    if (!doc) return null;
    const obj = doc.toObject() as Record<string, unknown>;
    if ('_id' in obj && obj._id != null) {
      return { ...obj, id: String(obj._id), _id: undefined } as unknown as Promise<T>;
    }
    return obj as unknown as Promise<T>;
  }

  async getManyAndCount(): Promise<[T[], number]> {
    const opts = this.buildOpts();
    const [docs, total] = await Promise.all([
      this._model.find(this.buildQuery() as Record<string, unknown>, undefined, opts).exec(),
      this._model.countDocuments(this.buildQuery() as Record<string, unknown>).exec(),
    ]);
    const data = docs.map((d) => {
      // Use toObject() to get a plain JS object before iterating — otherwise
      // non-enumerable internals like _doc (which holds the actual data) are missed.
      const obj = d.toObject() as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === '__v') continue;
        if (k === '_id') { out['id'] = String(v); }
        else { out[k] = v; }
      }
      return out as T;
    });
    return [data, total];
  }
}

/**
 * MongoRepository<T> wraps a Mongoose Model<T> and implements BaseRepository<T>.
 *
 * Subclasses pass their concrete Model type — no generic intersection needed.
 * The _id field is handled internally by Mongoose and does not need to be
 * part of the schema interface.
 */
@Injectable()
export class MongoRepository<T extends object> implements BaseRepository<T> {
  private readonly logger = new Logger(MongoRepository.name);
  constructor(protected readonly _model: Model<T>) {}

  protected get model_(): Model<T> {
    return this._model;
  }

  // ─── Additional base method ──────────────────────────────────────────────

  async find(
    filter: EntityFilter<T> = {},
    options?: FindAllOptions<T>,
  ): Promise<T[]> {
    return this.findAll(filter, options);
  }

  async increment(
    filter: EntityFilter<T>,
    field: string,
    amount: number,
  ): Promise<void> {
    await this._model.updateMany(toMongoFilter(this.translateIdField(filter)) as Record<string, unknown>, {
      $inc: { [field]: amount },
    } as Record<string, unknown>)
      .exec();
  }

  async decrement(
    filter: EntityFilter<T>,
    field: string,
    amount: number,
  ): Promise<void> {
    await this._model.updateMany(toMongoFilter(this.translateIdField(filter)) as Record<string, unknown>, {
      $inc: { [field]: -amount },
    } as Record<string, unknown>)
      .exec();
  }

  // ─── Standard CRUD ───────────────────────────────────────────────────────

  async findAll(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<T[]> {
    const mongoFilter_ = toMongoFilter(this.translateIdField(filter));
    const { skip, limit } = toSkipLimit(
      options?.pagination?.page,
      options?.pagination?.limit,
    );
    const sort = options?.pagination?.sort;
    const opts: QueryOptions<T> = {};
    if (skip != null) opts.skip = skip;
    if (limit != null) opts.limit = limit;
    if (sort) opts.sort = sort;

    const docs = await this._model
      .find(mongoFilter_, undefined, opts)
      .exec();
    return docs.map((d) => this.docToEntity(d));
  }

  /**
   * Translates `id` field to MongoDB's `_id` field.
   *
   * All UUIDs in this system are stored as plain string `_id` values in MongoDB
   * (not BSON ObjectId) — see save() which uses UUID as _id directly.
   * Therefore ALL `id` values in queries must be translated to `_id` for MongoDB.
   *
   * The distinction between "ObjectId" and "UUID" by character count is unreliable
   * (a UUID can be a 24-char hex string that looks like an ObjectId). The only
   * safe approach is: if `id` is present, always map it to `_id`.
   */
  private translateIdField(filter: EntityFilter<T>): EntityFilter<T> {
    // Handle { where: { id, ... } } wrapper from TypeORM-style repository calls
    if ('where' in filter && filter.where && typeof filter.where === 'object') {
      const where = filter.where as EntityFilter<T>;
      if ('id' in where) {
        const newWhere = { ...where } as Record<string, unknown>;
        newWhere['_id'] = newWhere.id;
        delete newWhere['id'];
        return { ...filter, where: newWhere };
      }
      return filter;
    }

    if (!('id' in filter)) return filter;
    const fixed = { ...filter };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixed as any)._id = fixed.id;
    delete (fixed as any).id;
    return fixed;
  }

  async findOne(filter: EntityFilter<T>): Promise<T | null> {
    const translated = this.translateIdField(filter);
    const doc = await this._model.findOne(toMongoFilter(translated)).exec();
    return doc ? this.docToEntity(doc) : null;
  }

  async findById(id: string): Promise<T | null> {
    const { Types } = await import('mongoose');
    // Use findById only for ObjectIds; for UUID strings use findOne on _id
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      const doc = await this._model.findById(id).exec();
      return doc ? this.docToEntity(doc) : null;
    }
    // UUID or other string — query by _id field
    const doc = await this._model.findOne({ _id: id } as Record<string, unknown>).exec();
    return doc ? this.docToEntity(doc) : null;
  }

  async create(data: Partial<T>): Promise<T> {
    const doc = new this._model(data as never);
    const saved = await doc.save();
    return this.docToEntity(saved);
  }

  async delete(id: string): Promise<boolean> {
    const { Types } = await import('mongoose');
    let result;
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      result = await this._model.findByIdAndDelete(id).exec();
    } else {
      result = await this._model.findOneAndDelete({ _id: id } as Record<string, unknown>).exec();
    }
    return result != null;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const { Types } = await import('mongoose');
    let filter: Record<string, unknown>;
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      filter = { _id: new Types.ObjectId(id) };
    } else {
      filter = { _id: id };
    }
    const conn = this._model.db;
    const result = await conn
      .collection(this._model.collection.name)
      .findOneAndUpdate(
        filter,
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
    return result ? (this.docToEntity(result) as T) : null;
  }

  async updateMany(filter: EntityFilter<T>, data: Partial<T>): Promise<{ affected?: number; raw?: unknown }> {
    const result = await this._model
      .updateMany(
        toMongoFilter(this.translateIdField(filter)) as Record<string, unknown>,
        data as Record<string, unknown>,
      )
      .exec();
    return { affected: result.modifiedCount, raw: result };
  }

  async count(
    filter?: EntityFilter<T> | { where: EntityFilter<T> },
  ): Promise<number> {
    if (!filter) return this._model.countDocuments().exec();
    const where = 'where' in filter ? filter.where : filter;
    return this._model.countDocuments(toMongoFilter(this.translateIdField({ where }))).exec();
  }

  async findAndCount(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const mongoFilter_ = toMongoFilter(this.translateIdField(filter));
    const { skip, limit } = toSkipLimit(
      options?.pagination?.page,
      options?.pagination?.limit,
    );
    const page = options?.pagination?.page ?? 1;
    const actualLimit = limit ?? 20;

    const [docs, total] = await Promise.all([
      this._model
        .find(mongoFilter_, undefined, {
          skip,
          limit: actualLimit,
          sort: options?.pagination?.sort,
        })
        .exec(),
      this._model.countDocuments(mongoFilter_).exec(),
    ]);

    return {
      data: docs.map((d) => this.docToEntity(d)),
      total,
      page,
      limit: actualLimit,
      totalPages: Math.ceil(total / actualLimit),
    };
  }

  async save(entity: Partial<T>): Promise<T> {
    const data = entity as Record<string, unknown>;
    const id = data.id ?? data._id;

    if (id) {
      const { Types } = await import('mongoose');
      const idStr = String(id);
      // When id is a UUID (not a 24-char ObjectId), use it as _id directly so queries
      // by entity `id` field will match the primary key in MongoDB
      const isObjectId = Types.ObjectId.isValid(idStr) && idStr.length === 24;
      const filter = isObjectId
        ? { _id: new Types.ObjectId(idStr) }
        : { _id: idStr }; // use UUID as _id
      const doc = await this._model
        .findOneAndUpdate(filter as Record<string, unknown>, { ...data, _id: idStr }, { returnDocument: 'after', upsert: true })
        .exec();
      if (!doc) throw new Error(`mongo.save upsert returned null for id=${id}`);
      return this.docToEntity(doc);
    }

    // No id — insert new
    const doc = new this._model(data as never);
    const saved = await doc.save();
    return this.docToEntity(saved);
  }

  // ─── Query builder ───────────────────────────────────────────────────────

  createQueryBuilder(alias: string): MongoQueryBuilder<T> {
    return new MongoQueryBuilder<T>(this._model, alias);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Convert a Mongoose document to entity shape:
   * - Rename _id → id (string)
   * - Remove __v
   */
  protected docToEntity(doc: unknown): T {
    // If passed a Mongoose document, use _doc which holds the actual plain data;
    // otherwise use the object as-is (supports plain objects from create()).
    const raw = doc as Record<string, unknown>;
    const obj = raw._doc ?? raw;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__v') continue;
      if (k === '_id') {
        out['id'] = String(v);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
}
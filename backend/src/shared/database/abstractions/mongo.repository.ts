import { Injectable, Logger } from '@nestjs/common';
import { ClientSession, Model, QueryOptions } from 'mongoose';
import {
  BaseRepository,
  EntityFilter,
  FindAllOptions,
  PaginatedResult,
} from './base.repository';
import { toSkipLimit, hideDeleted } from './mongo-utils';

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
    session?: ClientSession,
  ): Promise<void> {
    await this._model.updateMany(this.translateIdField(filter), {
      $inc: { [field]: amount },
    } as Record<string, unknown>)
      .session(session ?? null)
      .exec();
  }

  async decrement(
    filter: EntityFilter<T>,
    field: string,
    amount: number,
    session?: ClientSession,
  ): Promise<void> {
    await this._model.updateMany(this.translateIdField(filter), {
      $inc: { [field]: -amount },
    } as Record<string, unknown>)
      .session(session ?? null)
      .exec();
  }

  // ─── Standard CRUD ───────────────────────────────────────────────────────

  // Builds a Mongo projection from a field list; `id` maps to `_id`.
  // A `-` prefix excludes a field (e.g. ['-embedding']). Mongo does not allow
  // mixing inclusion and exclusion in one projection, so use one style per call.
  protected toProjection(select?: string[]): Record<string, 0 | 1> | undefined {
    if (!select?.length) return undefined;
    const projection: Record<string, 0 | 1> = {};
    for (const field of select) {
      if (field.startsWith('-')) projection[field.slice(1)] = 0;
      else projection[field === 'id' ? '_id' : field] = 1;
    }
    return projection;
  }

  async findAll(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<T[]> {
    const mongoFilter_ = this.translateIdField(filter);
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
      .find(mongoFilter_, this.toProjection(options?.select), opts)
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
    if (!('id' in filter)) return filter;
    const { id, ...rest } = filter;
    return { ...rest, _id: id };
  }

  async findOne(filter: EntityFilter<T>, session?: ClientSession, select?: string[]): Promise<T | null> {
    const translated = this.translateIdField(filter);
    const doc = await this._model
      .findOne(translated, this.toProjection(select))
      .session(session ?? null)
      .exec();
    return doc ? this.docToEntity(doc) : null;
  }

  async findById(id: string, select?: string[]): Promise<T | null> {
    const { Types } = await import('mongoose');
    const projection = this.toProjection(select);
    // Use findById only for ObjectIds; for UUID strings use findOne on _id
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      const doc = await this._model.findById(id, projection).exec();
      return doc ? this.docToEntity(doc) : null;
    }
    // UUID or other string — query by _id field
    const doc = await this._model.findOne({ _id: id } as Record<string, unknown>, projection).exec();
    return doc ? this.docToEntity(doc) : null;
  }

  async create(data: Partial<T>, session?: ClientSession): Promise<T> {
    const doc = new this._model(data as never);
    const saved = await doc.save({ session });
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

  // Updates one record by id. This goes to the driver directly, so soft deleted records are excluded here.
  async update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null> {
    const { Types } = await import('mongoose');
    let filter: Record<string, unknown>;
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      filter = { _id: new Types.ObjectId(id) };
    } else {
      filter = { _id: id };
    }
    if (this._model.schema.path('isDeleted')) filter = hideDeleted(filter);
    const conn = this._model.db;
    const result = await conn
      .collection(this._model.collection.name)
      .findOneAndUpdate(
        filter,
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after', session },
      );
    return result ? (this.docToEntity(result) as T) : null;
  }

  async updateMany(filter: EntityFilter<T>, data: Partial<T>, session?: ClientSession): Promise<{ affected?: number; raw?: unknown }> {
    const result = await this._model
      .updateMany(
        this.translateIdField(filter),
        data as Record<string, unknown>,
      )
      .session(session ?? null)
      .exec();
    return { affected: result.modifiedCount, raw: result };
  }

  async count(filter?: EntityFilter<T>): Promise<number> {
    if (!filter) return this._model.countDocuments().exec();
    return this._model.countDocuments(this.translateIdField(filter)).exec();
  }

  async findAndCount(
    filter: EntityFilter<T>,
    options?: FindAllOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const mongoFilter_ = this.translateIdField(filter);
    const { skip, limit } = toSkipLimit(
      options?.pagination?.page,
      options?.pagination?.limit,
    );
    const page = options?.pagination?.page ?? 1;
    const actualLimit = limit ?? 20;

    const [docs, total] = await Promise.all([
      this._model
        .find(mongoFilter_, this.toProjection(options?.select), {
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

  async save(entity: Partial<T>, session?: ClientSession): Promise<T> {
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
        .session(session ?? null)
        .exec();
      if (!doc) throw new Error(`mongo.save upsert returned null for id=${id}`);
      return this.docToEntity(doc);
    }

    // No id — insert new
    const doc = new this._model(data as never);
    const saved = await doc.save({ session });
    return this.docToEntity(saved);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Convert a Mongoose document to entity shape:
   * - Rename _id → id (string)
   * - Remove __v
   */
protected docToEntity(doc: unknown): T {
  if (!doc) return doc as T;
  const raw = doc as Record<string, unknown>;
  const obj = (raw._doc ?? raw) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__v') continue;
    out[k] = v; // keeps _id as the original ObjectId
  }
  if (obj._id !== undefined) {
    out['id'] = String(obj._id);
  }
  return out as T;
}

}
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { toObjectIdOrNull } from '../../../abstractions/mongo-utils';
import { IFinalQuestionRepository } from '../../IFinalQuestion.repository';
import { FinalQuestion } from '../../../entities';

@Injectable()
export class MongoFinalQuestionRepository
  extends MongoRepository<FinalQuestion>
  implements IFinalQuestionRepository
{
  constructor(@InjectModel('FinalQuestion') protected readonly _model: Model<FinalQuestion>) {
    super(_model);
  }

  /**
   * `referenceQuestionId` is stored as `Types.ObjectId` in Mongo (see
   * final-question.schema.ts). Convert the incoming 24-char hex string to
   * an `ObjectId` so the query actually matches. If the input is not a
   * valid ObjectId, return [] (no docs can match).
   */
  async findByReferenceQuestionId(referenceQuestionId: string): Promise<FinalQuestion[]> {
    const oid = toObjectIdOrNull(referenceQuestionId);
    if (!oid) return [];
    const filter: Record<string, unknown> = { referenceQuestionId: oid };
    return this._model
      .find(filter as Record<string, unknown>, undefined, { sort: { createdAt: -1 } })
      .exec() as Promise<FinalQuestion[]>;
  }

  async findByDistributionState(distributionState: string): Promise<FinalQuestion[]> {
    return this._model
      .find({ distributionState }, undefined, { sort: { createdAt: -1 } })
      .exec() as Promise<FinalQuestion[]>;
  }

  /**
   * `distributorId` is stored as `Types.ObjectId` in Mongo. Convert the
   * incoming 24-char hex string to an `ObjectId`. Invalid input → [].
   */
  async findByDistributorId(distributorId: string): Promise<FinalQuestion[]> {
    const oid = toObjectIdOrNull(distributorId);
    if (!oid) return [];
    const filter: Record<string, unknown> = { distributorId: oid };
    return this._model
      .find(filter as Record<string, unknown>, undefined, { sort: { createdAt: -1 } })
      .exec() as Promise<FinalQuestion[]>;
  }

  /**
   * Both `referenceQuestionId` (ObjectId) and `distributionState` (string)
   * are filter fields. Convert the FK to ObjectId before querying; invalid
   * input → null.
   */
  async findByReferenceQuestionAndDistributionState(
    referenceQuestionId: string,
    distributionState: string,
  ): Promise<FinalQuestion | null> {
    const oid = toObjectIdOrNull(referenceQuestionId);
    if (!oid) return null;
    const filter: Record<string, unknown> = { referenceQuestionId: oid, distributionState };
    return this._model
      .findOne(filter as Record<string, unknown>)
      .exec() as Promise<FinalQuestion | null>;
  }

  /**
   * Group ACTIVE distribution rows by their TARGET state (`distributionState`),
   * not by the asker's home state (`state`). The reference doc — which has
   * `distributionState: null, isReference: true` — represents the original
   * question, not a distribution to any state, so it's excluded by the
   * `$match: { distributionState: { $ne: null } }` stage. Without this filter,
   * the reference doc would create a `null` group and inflate the count by
   * one for every distributed question.
   *
   * Note: the previous implementation grouped by `$state` (the asker's home
   * state), which made the dashboard's "States covered" count collapse to
   * "1 of 32" whenever all rows came from a single asker — see
   * `.sessions/2026-08-08_15-50-00_fix-states-covered-count.md`.
   */
  async countByDistributionState(): Promise<Array<{ state: string; count: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: { isActive: true, distributionState: { $ne: null } } },
      { $group: { _id: '$distributionState', count: { $sum: 1 } } },
      { $project: { _id: 0, state: '$_id', count: 1 } },
      { $sort: { count: -1, state: 1 } },
    ];
    return this._model
      .aggregate(pipeline)
      .exec() as Promise<Array<{ state: string; count: number }>>;
  }

  /**
   * The canonical reference doc has `isReference: true` and `distributionState: null`.
   * There is at most one per `referenceQuestionId` (the unique compound index on
   * (referenceQuestionId, distributionState) guarantees this since `null` is a
   * distinct value in Mongo's unique index). Invalid ObjectId → null.
   */
  async findReferenceByQuestionId(referenceQuestionId: string): Promise<FinalQuestion | null> {
    const oid = toObjectIdOrNull(referenceQuestionId);
    if (!oid) return null;
    const filter: Record<string, unknown> = { referenceQuestionId: oid, isReference: true };
    return this._model
      .findOne(filter as Record<string, unknown>)
      .exec() as Promise<FinalQuestion | null>;
  }

  /**
   * All state-specific children whose `parentReferenceId` points at the given
   * reference doc id. Excludes the reference doc itself (which has
   * parentReferenceId: null). Invalid ObjectId → [].
   */
  async findStateDocsByParentId(parentReferenceId: string): Promise<FinalQuestion[]> {
    const oid = toObjectIdOrNull(parentReferenceId);
    if (!oid) return [];
    const filter: Record<string, unknown> = { parentReferenceId: oid, isReference: false };
    return this._model
      .find(filter as Record<string, unknown>, undefined, {
        sort: { distributionState: 1 },
      })
      .exec() as Promise<FinalQuestion[]>;
  }
}

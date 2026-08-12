import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IFaqRepository } from '../../IFaq.repository';
import { Faq } from '../../../entities';
import { FaqCategory } from '../../../../classes/enums';

@Injectable()
export class MongoFaqRepository
  extends MongoRepository<Faq>
  implements IFaqRepository
{
  constructor(@InjectModel('Faq') protected readonly _model: Model<Faq>) {
    super(_model);
  }

  async findByCategory(category: FaqCategory): Promise<Faq[]> {
    return this._model
      .find({ category }, undefined, { sort: { displayOrder: 1 } })
      .exec() as Promise<Faq[]>;
  }

  async findVisible(category?: FaqCategory): Promise<Faq[]> {
    const filter: Record<string, unknown> = { isVisible: true };
    if (category) filter.category = category;
    return this._model
      .find(filter, undefined, { sort: { displayOrder: 1, createdAt: 1 } })
      .exec() as Promise<Faq[]>;
  }

  async getStats(
    category?: FaqCategory,
  ): Promise<{ total: number; visible: number; hidden: number }> {
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    const [total, visible] = await Promise.all([
      this._model.countDocuments(filter).exec(),
      this._model.countDocuments({ ...filter, isVisible: true }).exec(),
    ]);
    return { total, visible, hidden: total - visible };
  }
}

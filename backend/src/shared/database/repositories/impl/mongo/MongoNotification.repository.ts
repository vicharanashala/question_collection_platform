import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { INotificationRepository } from '../../INotification.repository';
import { Notification } from '../../../entities';

@Injectable()
export class MongoNotificationRepository
  extends MongoRepository<Notification>
  implements INotificationRepository
{
  constructor(@InjectModel('Notification') protected readonly _model: Model<Notification>) {
    super(_model);
  }

  async findByUserId(userId: string, limit = 50): Promise<Notification[]> {
    return this._model
      .find({ userId }, undefined, { limit, sort: { createdAt: -1 } })
      .exec() as Promise<Notification[]>;
  }

  async markAllRead(userId: string): Promise<void> {
    await this._model.updateMany({ userId, isRead: false }, { $set: { isRead: true } }).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this._model.countDocuments({ userId, isRead: false }).exec();
  }
}
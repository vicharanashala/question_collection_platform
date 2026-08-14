import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

/**
 * Runs a unit of work inside a real MongoDB multi-document transaction
 * (requires a replica set — Atlas clusters always are one).
 *
 * Pass the `session` through to every repository call inside `fn` so all
 * writes commit or roll back together.
 */
@Injectable()
export class MongoTransactionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async runInTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }
}

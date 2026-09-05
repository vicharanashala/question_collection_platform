import { BaseRepository } from '../abstractions/base.repository';
import { AuditLog } from '../entities';
import { AuditAction, ActorType } from '../../classes/enums';

export interface AuditLogFilter {
  id?: string;
  actorId?: string;
  actorType?: ActorType;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  createdAt?: Date;
}

export interface IAuditLogRepository extends BaseRepository<AuditLog> {
  findByActorId(actorId: string, actorType: ActorType, limit?: number): Promise<AuditLog[]>;
  findByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  aggregateByAction(
    fromDate: Date,
    toDate: Date,
    actorTypes?: string[],
    granularity?: 'day' | 'week' | 'month',
  ): Promise<Array<{ date: string; action: string; count: number }>>;

  getRecentWithActorName(
  limit: number,
): Promise<Array<AuditLog & {
  actorName?: string;
}>>;
}
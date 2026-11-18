import { ActorType } from '../../classes/enums';

export interface AuditLog {
  id: string;

  actorType: ActorType;

  actorId: string | null;

  action: string;

  entityType: string | null;

  entityId: string | null;

  oldValue: Record<string, unknown> | null;

  newValue: Record<string, unknown> | null;

  metadata: Record<string, unknown> | null;

  createdAt: Date;
}
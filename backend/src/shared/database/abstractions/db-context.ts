/**
 * db-context.ts
 *
 * MongoDB-only context. Provides factory signatures for all 13 repository
 * implementations and resolves the MongoDB connection URI.
 */

import { ConfigService } from '@nestjs/config';

// ─── Per-entity repository factory signatures ───────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserRepoDeps {
  mongo: { model: any };
}
export interface WalletRepoDeps {
  mongo: { model: any };
}
export interface TransactionRepoDeps {
  mongo: { model: any };
}
export interface WithdrawalRequestRepoDeps {
  mongo: { model: any };
}
export interface UserPaymentDetailRepoDeps {
  mongo: { model: any };
}
export interface PaymentLogRepoDeps {
  mongo: { model: any };
}
export interface QuestionRepoDeps {
  mongo: { model: any };
}
export interface AuditLogRepoDeps {
  mongo: { model: any };
}
export interface AdminConfigRepoDeps {
  mongo: { model: any };
}
export interface NotificationRepoDeps {
  mongo: { model: any };
}
export interface ReportRepoDeps {
  mongo: { model: any };
}
export interface ReportReplyRepoDeps {
  mongo: { model: any };
}
export interface FaqRepoDeps {
  mongo: { model: any };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── MongoDB URI resolver ───────────────────────────────────────────────────

/**
 * Resolves the mongo URI from ConfigService.
 * Falls back to MONGODB_URL env var directly if config not available.
 */
export function resolveMongoUri(configService?: ConfigService): string {
  if (configService) {
    return (
      configService.get<string>('db.mongoUri') ??
      'mongodb://localhost:27017/question_platform'
    );
  }
  return process.env.MONGODB_URL ?? 'mongodb://localhost:27017/question_platform';
}
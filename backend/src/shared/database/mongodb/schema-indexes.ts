/**
 * Central registry of all MongoDB schema-level indexes.
 *
 * Every compound, text, TTL, unique and partial index is defined here so the
 * full index surface of the database can be reviewed in one place.
 * Single-field `index: true` flags remain on the @Prop definitions in each
 * schema file.
 */

import { AnveshanAnswerSchema } from './schemas/anveshan-answer.schema';
import { AppFeedbackSchema } from './schemas/app-feedback.schema';
import { AuditLogSchema } from './schemas/audit-log.schema';
import { FinalQuestionSchema } from './schemas/final-question.schema';
import { NotificationSchema } from './schemas/notification.schema';
import { QuestionSchema } from './schemas/question.schema';
import { ReportSchema } from './schemas/report.schema';
import { SessionSchema } from './schemas/session.schema';
import { UserSchema } from './schemas/user.schema';
import { WithdrawalRequestSchema } from './schemas/withdrawal-request.schema';

let applied = false;

// Attaches every schema-level index exactly once, before models are compiled.
export function applySchemaIndexes(): void {
  if (applied) return;
  applied = true;

  // User: only one active user per mobile number / username. Deleted users
  // keep their values without blocking them.
  UserSchema.index(
    { mobileNumber: 1 },
    {
      unique: true,
      partialFilterExpression: {
        isDeleted: false,
        mobileNumber: { $type: 'string' },
      },
    },
  );
  UserSchema.index(
    { username: 1 },
    {
      unique: true,
      partialFilterExpression: {
        isDeleted: false,
        username: { $type: 'string' },
      },
    },
  );

  // Question: text index for full-text search, compound indexes for common
  // query patterns.
  QuestionSchema.index({ questionText: 'text' });
  QuestionSchema.index({ userId: 1, submittedAt: -1 });
  QuestionSchema.index({ status: 1, submittedAt: -1 });

  // FinalQuestion: one row per (referenceQuestionId, distributionState) pair,
  // fast lookup of state docs for a reference doc, and asker/reviewer FKs used
  // by moderation dashboards and per-user activity feeds.
  FinalQuestionSchema.index({ referenceQuestionId: 1, distributionState: 1 }, { unique: true });
  FinalQuestionSchema.index({ parentReferenceId: 1 });
  FinalQuestionSchema.index({ userId: 1 });
  FinalQuestionSchema.index({ reviewerId: 1 });

  // AnveshanAnswer: per-user feed, plus a status index so the background score
  // check finds processing jobs without scanning every answer.
  AnveshanAnswerSchema.index({ userId: 1, answeredAt: -1 });
  AnveshanAnswerSchema.index({ 'score.status': 1, 'score.requestedAt': 1 });

  // AuditLog: filtered audit queries.
  AuditLogSchema.index({ createdAt: -1 });
  AuditLogSchema.index({ 'actor.actorType': 1, createdAt: -1 });
  AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });

  // AppFeedback: one feedback per user per context.
  AppFeedbackSchema.index({ userId: 1, context: 1 }, { unique: true });

  // Notification: per-user feeds and unread counts.
  NotificationSchema.index({ userId: 1, createdAt: -1 });
  NotificationSchema.index({ userId: 1, isRead: 1 });

  // Report: per-user history and triage ordering.
  ReportSchema.index({ userId: 1, createdAt: -1 });
  ReportSchema.index({ status: 1, priority: -1 });

  // Session TTL: Mongo deletes the doc once expiresAt passes. To keep
  // expired/revoked sessions for audit, use expireAfterSeconds: 60*60*24*7.
  SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // WithdrawalRequest: common query patterns, plus unique external orderId
  // when present.
  WithdrawalRequestSchema.index({ userId: 1, status: 1 });
  WithdrawalRequestSchema.index({ walletId: 1, createdAt: -1 });
  WithdrawalRequestSchema.index(
    { orderId: 1 },
    { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } },
  );
}

/**
 * repositories/index.ts
 *
 * Registry of all repository tokens + NestJS providers for the MongoDB
 * abstraction layer. PostgreSQL support has been removed.
 */

import { Provider } from '@nestjs/common';

// ─── Repository Interfaces ─────────────────────────────────────────────────

export { IUserRepository } from './user.repository.interface';
export { IWalletRepository, AdminWalletScope, AdminWalletRow, AdminWalletTotals } from './wallet.repository.interface';
export { ITransactionRepository } from './transaction.repository.interface';
export { IWithdrawalRequestRepository } from './withdrawal-request.repository.interface';
export { IUserPaymentDetailRepository } from './user-payment-detail.repository.interface';
export { IPaymentLogRepository } from './payment-log.repository.interface';
export { IQuestionRepository } from './question.repository.interface';
export { IAuditLogRepository } from './audit-log.repository.interface';
export { IAdminConfigRepository } from './admin-config.repository.interface';
export { INotificationRepository } from './notification.repository.interface';
export { IReportRepository } from './report.repository.interface';
export { IReportReplyRepository } from './report-reply.repository.interface';
export { IFaqRepository } from './faq.repository.interface';
export { IFinalQuestionRepository } from './final-question.repository.interface';
export { IAnveshanCandidateRepository } from './anvesh-candidate.repository.interface'
export { IAgriEntityRepository, UserAgriEntityTypeCount } from './agri-entity.repository.interface';
export { IAnveshanAnswerRepository } from './anveshan-answer.repository.interface';
export { IAppFeedbackRepository, FeedbackRatingSummary } from './app-feedback.repository.interface';
export { ISessionRepository } from './session.repository.interface'

// ─── Repository Tokens ────────────────────────────────────────────────────

export const REPOSITORY_TOKENS = {
  User:              'REPOSITORY_User',
  Wallet:            'REPOSITORY_Wallet',
  Transaction:       'REPOSITORY_Transaction',
  WithdrawalRequest: 'REPOSITORY_WithdrawalRequest',
  UserPaymentDetail: 'REPOSITORY_UserPaymentDetail',
  PaymentLog:        'REPOSITORY_PaymentLog',
  Question:          'REPOSITORY_Question',
  AuditLog:          'REPOSITORY_AuditLog',
  AdminConfig:       'REPOSITORY_AdminConfig',
  Notification:      'REPOSITORY_Notification',
  Report:            'REPOSITORY_Report',
  ReportReply:       'REPOSITORY_ReportReply',
  Faq:               'REPOSITORY_Faq',
  FinalQuestion:     'REPOSITORY_FinalQuestion',
  Candidate: 'REPOSITORY_AnveshanCandidate',
  AgriEntity:        'REPOSITORY_AgriEntity',
  AnveshanAnswer:    'REPOSITORY_AnveshanAnswer',
  AppFeedback:       'REPOSITORY_AppFeedback',
  Session:           'REPOSITORY_Session'
} as const;

// ─── Concrete implementations (MongoDB only) ──────────────────────────────

import { MongoUserRepository } from './impl/mongo/user.repository.mongo';
import { MongoWalletRepository } from './impl/mongo/wallet.repository.mongo';
import { MongoTransactionRepository } from './impl/mongo/transaction.repository.mongo';
import { MongoWithdrawalRequestRepository } from './impl/mongo/withdrawal-request.repository.mongo';
import { MongoUserPaymentDetailRepository } from './impl/mongo/user-payment-detail.repository.mongo';
import { MongoPaymentLogRepository } from './impl/mongo/payment-log.repository.mongo';
import { MongoQuestionRepository } from './impl/mongo/question.repository.mongo';
import { MongoAuditLogRepository } from './impl/mongo/audit-log.repository.mongo';
import { MongoAdminConfigRepository } from './impl/mongo/admin-config.repository.mongo';
import { MongoNotificationRepository } from './impl/mongo/notification.repository.mongo';
import { MongoReportRepository } from './impl/mongo/report.repository.mongo';
import { MongoReportReplyRepository } from './impl/mongo/report-reply.repository.mongo';
import { MongoFaqRepository } from './impl/mongo/faq.repository.mongo';
import { MongoFinalQuestionRepository } from './impl/mongo/final-question.repository.mongo';
import { MongoAnveshCandidateRepository } from './impl/mongo/anvesh-candidate.repository.mongo';
import { MongoAgriEntityRepository } from './impl/mongo/agri-entity.repository.mongo';
import { MongoAnveshanAnswerRepository } from './impl/mongo/anveshan-answer.repository.mongo';
import { MongoAppFeedbackRepository } from './impl/mongo/app-feedback.repository.mongo';
import { MongoSessionRepository } from './impl/mongo/session.repository.mongo';
// ─── Build Repository Providers ───────────────────────────────────────────

/**
 * buildRepositoryProviders()
 *
 * Returns a flat array of NestJS providers — one per entity — wired to the
 * MongoDB concrete implementation classes.
 */
export function buildRepositoryProviders(): Provider[] {
  return [
    { provide: REPOSITORY_TOKENS.User,              useClass: MongoUserRepository },
    { provide: REPOSITORY_TOKENS.Wallet,            useClass: MongoWalletRepository },
    { provide: REPOSITORY_TOKENS.Transaction,       useClass: MongoTransactionRepository },
    { provide: REPOSITORY_TOKENS.WithdrawalRequest, useClass: MongoWithdrawalRequestRepository },
    { provide: REPOSITORY_TOKENS.UserPaymentDetail, useClass: MongoUserPaymentDetailRepository },
    { provide: REPOSITORY_TOKENS.PaymentLog,        useClass: MongoPaymentLogRepository },
    { provide: REPOSITORY_TOKENS.Question,          useClass: MongoQuestionRepository },
    { provide: REPOSITORY_TOKENS.AuditLog,          useClass: MongoAuditLogRepository },
    { provide: REPOSITORY_TOKENS.AdminConfig,       useClass: MongoAdminConfigRepository },
    { provide: REPOSITORY_TOKENS.Notification,      useClass: MongoNotificationRepository },
    { provide: REPOSITORY_TOKENS.Report,            useClass: MongoReportRepository },
    { provide: REPOSITORY_TOKENS.ReportReply,       useClass: MongoReportReplyRepository },
    { provide: REPOSITORY_TOKENS.Faq,               useClass: MongoFaqRepository },
    { provide: REPOSITORY_TOKENS.FinalQuestion,     useClass: MongoFinalQuestionRepository },
    { provide: REPOSITORY_TOKENS.Candidate,          useClass: MongoAnveshCandidateRepository},
    { provide: REPOSITORY_TOKENS.AgriEntity,        useClass: MongoAgriEntityRepository },
    { provide: REPOSITORY_TOKENS.AnveshanAnswer,    useClass: MongoAnveshanAnswerRepository },
    { provide: REPOSITORY_TOKENS.AppFeedback,       useClass: MongoAppFeedbackRepository },
    { provide: REPOSITORY_TOKENS.Session,           useClass: MongoSessionRepository}
  ];
}
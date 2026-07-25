/**
 * repositories/index.ts
 *
 * Registry of all repository tokens + NestJS providers for the MongoDB
 * abstraction layer. PostgreSQL support has been removed.
 */

import { Provider } from '@nestjs/common';

// ─── Repository Interfaces ─────────────────────────────────────────────────

export { IUserRepository } from './IUser.repository';
export { IWalletRepository } from './IWallet.repository';
export { ITransactionRepository } from './ITransaction.repository';
export { IWithdrawalRequestRepository } from './IWithdrawalRequest.repository';
export { IUserPaymentDetailRepository } from './IUserPaymentDetail.repository';
export { IPaymentLogRepository } from './IPaymentLog.repository';
export { IQuestionRepository } from './IQuestion.repository';
export { IAuditLogRepository } from './IAuditLog.repository';
export { IAdminConfigRepository } from './IAdminConfig.repository';
export { INotificationRepository } from './INotification.repository';
export { IReportRepository } from './IReport.repository';
export { IReportReplyRepository } from './IReportReply.repository';
export { IFaqRepository } from './IFaq.repository';

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
} as const;

// ─── Concrete implementations (MongoDB only) ──────────────────────────────

import { MongoUserRepository } from './impl/mongo/MongoUser.repository';
import { MongoWalletRepository } from './impl/mongo/MongoWallet.repository';
import { MongoTransactionRepository } from './impl/mongo/MongoTransaction.repository';
import { MongoWithdrawalRequestRepository } from './impl/mongo/MongoWithdrawalRequest.repository';
import { MongoUserPaymentDetailRepository } from './impl/mongo/MongoUserPaymentDetail.repository';
import { MongoPaymentLogRepository } from './impl/mongo/MongoPaymentLog.repository';
import { MongoQuestionRepository } from './impl/mongo/MongoQuestion.repository';
import { MongoAuditLogRepository } from './impl/mongo/MongoAuditLog.repository';
import { MongoAdminConfigRepository } from './impl/mongo/MongoAdminConfig.repository';
import { MongoNotificationRepository } from './impl/mongo/MongoNotification.repository';
import { MongoReportRepository } from './impl/mongo/MongoReport.repository';
import { MongoReportReplyRepository } from './impl/mongo/MongoReportReply.repository';
import { MongoFaqRepository } from './impl/mongo/MongoFaq.repository';

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
  ];
}
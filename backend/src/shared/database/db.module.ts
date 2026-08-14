/**
 * db.module.ts
 *
 * Provides all 13 repository abstractions as NestJS providers.
 * Uses MongoDB/Mongoose exclusively (PostgreSQL support removed).
 *
 * Import this module in any feature module that needs database access.
 */

import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User,
  Wallet,
  Transaction,
  WithdrawalRequest,
  PaymentLog,
  Question,
  AuditLog,
  AdminConfig,
  Notification,
  UserPaymentDetail,
  Report,
  ReportReply,
  Faq,
  FinalQuestion,
} from './entities';
import { REPOSITORY_TOKENS, buildRepositoryProviders } from './repositories';
import { MongoTransactionService } from './mongodb/mongo-transaction.service';

// MongoDB schemas
import { UserSchema } from './mongodb/schemas/user.schema';
import { WalletSchema } from './mongodb/schemas/wallet.schema';
import { TransactionSchema } from './mongodb/schemas/transaction.schema';
import { WithdrawalRequestSchema } from './mongodb/schemas/withdrawal-request.schema';
import { UserPaymentDetailSchema } from './mongodb/schemas/user-payment-detail.schema';
import { PaymentLogSchema } from './mongodb/schemas/payment-log.schema';
import { QuestionSchema } from './mongodb/schemas/question.schema';
import { AuditLogSchema } from './mongodb/schemas/audit-log.schema';
import { AdminConfigSchema } from './mongodb/schemas/admin-config.schema';
import { NotificationSchema } from './mongodb/schemas/notification.schema';
import { ReportSchema } from './mongodb/schemas/report.schema';
import { ReportReplySchema } from './mongodb/schemas/report-reply.schema';
import { FaqSchema } from './mongodb/schemas/faq.schema';
import { FinalQuestionSchema } from './mongodb/schemas/final-question.schema';

const MONGO_SCHEMA_ENTRIES = [
  { name: 'User', schema: UserSchema },
  { name: 'Wallet', schema: WalletSchema },
  { name: 'Transaction', schema: TransactionSchema },
  { name: 'WithdrawalRequest', schema: WithdrawalRequestSchema },
  { name: 'UserPaymentDetail', schema: UserPaymentDetailSchema },
  { name: 'PaymentLog', schema: PaymentLogSchema },
  { name: 'Question', schema: QuestionSchema },
  { name: 'AuditLog', schema: AuditLogSchema },
  { name: 'AdminConfig', schema: AdminConfigSchema },
  { name: 'Notification', schema: NotificationSchema },
  { name: 'Report', schema: ReportSchema },
  { name: 'ReportReply', schema: ReportReplySchema },
  { name: 'Faq', schema: FaqSchema },
  { name: 'FinalQuestion', schema: FinalQuestionSchema },
];

@Global()
@Module({
  imports: [
    // Register all Mongoose models so MongoRepository constructors can inject them
    MongooseModule.forFeature(MONGO_SCHEMA_ENTRIES),
  ],
  providers: [
    ...buildRepositoryProviders(),
    MongoTransactionService,
  ],
  exports: [
    ...Object.values(REPOSITORY_TOKENS),
    MongoTransactionService,
  ],
})
export class DbModule {}
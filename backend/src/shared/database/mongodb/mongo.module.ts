import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User, UserSchema } from './schemas/user.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { WithdrawalRequest, WithdrawalRequestSchema } from './schemas/withdrawal-request.schema';
import { UserPaymentDetail, UserPaymentDetailSchema } from './schemas/user-payment-detail.schema';
import { PaymentLog, PaymentLogSchema } from './schemas/payment-log.schema';
import { Question, QuestionSchema } from './schemas/question.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { AdminConfig, AdminConfigSchema } from './schemas/admin-config.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Report, ReportSchema } from './schemas/report.schema';
import { ReportReply, ReportReplySchema } from './schemas/report-reply.schema';
import { Faq, FaqSchema } from './schemas/faq.schema';

const SCHEMAS = [
  { name: User.name, schema: UserSchema },
  { name: Wallet.name, schema: WalletSchema },
  { name: Transaction.name, schema: TransactionSchema },
  { name: WithdrawalRequest.name, schema: WithdrawalRequestSchema },
  { name: UserPaymentDetail.name, schema: UserPaymentDetailSchema },
  { name: PaymentLog.name, schema: PaymentLogSchema },
  { name: Question.name, schema: QuestionSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
  { name: AdminConfig.name, schema: AdminConfigSchema },
  { name: Notification.name, schema: NotificationSchema },
  { name: Report.name, schema: ReportSchema },
  { name: ReportReply.name, schema: ReportReplySchema },
  { name: Faq.name, schema: FaqSchema },
];

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('db.mongoUri') ?? 'mongodb://localhost:27017/question_platform';
        const user = configService.get<string>('db.mongoUser');
        const password = configService.get<string>('db.mongoPassword');

        const options: Record<string, unknown> = {
          serverSelectionTimeoutMS: 8_000,
          connectTimeoutMS: 8_000,
        };

        if (user && password) {
          // Inject credentials into URI if not already present
          try {
            const url = new URL(uri);
            if (!url.username) url.username = user;
            if (!url.password) url.password = password;
            const finalUri = url.toString();
            return { uri: finalUri, ...options };
          } catch {
            // URI parse failed — pass credentials as separate options
          }
          options.user = user;
          options.pass = password;
        }

        // For Atlas SRV connections, ensure authSource is set for SCRAM-SHA
        if (uri.includes('+srv://')) {
          try {
            const url = new URL(uri);
            if (!url.searchParams.has('authSource')) {
              url.searchParams.set('authSource', 'admin');
            }
            return { uri: url.toString(), ...options };
          } catch {
            // malformed URI — use as-is
          }
        }

        return { uri, ...options };
      },
    }),

    MongooseModule.forFeature(SCHEMAS),
  ],
  exports: [MongooseModule],
})
export class MongoDbModule {}
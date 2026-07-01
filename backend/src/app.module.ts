import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import {
  databaseConfig,
  jwtConfig,
  redisConfig,
  smsConfig,
  appConfig,
  questionConfig,
  gcpStorageConfig,
  llmConfig,
  gdbConfig,
  embedConfig,
} from './config/configuration';
import { paymentConfig } from './config/payment.config';
import { sarvamConfig } from './config/sarvam.config';
import { lgdConfig } from './config/lgd.config';
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
} from './database/entities';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { QuestionModule } from './question/question.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletsModule } from './wallets/wallets.module';
import { SpeechModule } from './speech/speech.module';
import { LgdModule } from './lgd/lgd.module';
import { PaymentModule } from './payment/payment.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, smsConfig, appConfig, questionConfig, gcpStorageConfig, llmConfig, gdbConfig, embedConfig, sarvamConfig, lgdConfig, paymentConfig],
      envFilePath: ['.env'],
    }),

    // Rate limiting — global throttle (disabled when THROTTLE_ENABLED=false, e.g. in dev)
    ...(process.env.THROTTLE_ENABLED !== 'false'
      ? [
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => [
              {
                ttl: 60_000, // 1 minute window
                limit: 100, // 100 requests per minute globally
                name: 'default',
              },
            ],
          }),
        ]
      : []),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host') ?? 'localhost',
        port: configService.get<number>('database.port') ?? 5432,
        username: configService.get<string>('database.username') ?? 'postgres',
        password: configService.get<string>('database.password') ?? 'postgres',
        database: configService.get<string>('database.database') ?? 'question_platform',
        entities: [
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
        ],
        migrations: [],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    // Feature modules
    AuthModule,
    UserModule,
    QuestionModule,
    AdminModule,
    NotificationsModule,
    WalletsModule,
    SpeechModule,
    LgdModule,
    PaymentModule,
    StorageModule,
    AiModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global rate-limit guard (skip in dev when THROTTLE_ENABLED=false)
    ...(process.env.THROTTLE_ENABLED !== 'false'
      ? [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]
      : []),
    // Global JWT auth guard (public routes opt out via @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
  Faq,
} from './shared/database/entities';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { QuestionModule } from './modules/question/question.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notification/notifications.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { SpeechModule } from './modules/speech/speech.module';
import { LgdModule } from './modules/lgd/lgd.module';
import { PaymentModule } from './modules/payment/payment.module';
import { StorageModule } from './modules/storage/storage.module';
import { AiModule } from './modules/ai/ai.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { JwtAuthGuard } from './shared/middleware/guards/jwt-auth.guard';
import { HealthController } from './modules/health/health.controller';
import { CacheModule } from './shared/database/cache/cache.module';
import { CacheInterceptor } from './shared/database/cache/interceptors/cache.interceptor';
import { CacheInvalidationInterceptor } from './shared/database/cache/interceptors/cache-invalidation.interceptor';
import { EndpointLoggerModule } from './shared/services/endpoint-logger/endpoint-logger.module';

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
          Faq,
        ],
        migrations: [],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    // Feature modules
    EndpointLoggerModule,
    CacheModule,
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
    FaqsModule,
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
    // Global cache interceptors
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheInvalidationInterceptor },
  ],
})
export class AppModule {}
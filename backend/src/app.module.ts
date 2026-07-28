import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import {
  dbConfig,
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
import { MongoDbModule } from './shared/database/mongodb/mongo.module';
import { DbModule } from './shared/database/db.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, jwtConfig, redisConfig, smsConfig, appConfig, questionConfig, gcpStorageConfig, llmConfig, gdbConfig, embedConfig, sarvamConfig, lgdConfig, paymentConfig],
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

    // MongoDB (always)
    MongoDbModule,

    // Database abstraction layer (all 13 repository providers)
    DbModule,

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
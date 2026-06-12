import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import {
  databaseConfig,
  jwtConfig,
  redisConfig,
  smsConfig,
  appConfig,
} from './config/configuration';
import {
  User,
  Wallet,
  Transaction,
  WithdrawalRequest,
  Question,
  AuditLog,
  AdminConfig,
  UserCropDetail,
} from './database/entities';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, smsConfig, appConfig],
      envFilePath: ['.env'],
    }),

    // Rate limiting — global throttle for OTP endpoints
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: 60_000,   // 1 minute window
          limit: 100,    // 100 requests per minute globally
          name: 'default',
        },
      ],
    }),

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
          Question,
          AuditLog,
          AdminConfig,
          UserCropDetail,
        ],
        migrations: [],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),

    // Feature modules
    AuthModule,
    UserModule,
  ],
  providers: [
    // Global rate-limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT auth guard (public routes opt out via @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
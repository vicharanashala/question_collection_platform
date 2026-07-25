import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { JwtStrategy } from '../../shared/middleware/guards/jwt.strategy';
import { AdminModule } from '../admin/admin.module';
import { CacheModule } from '../../shared/database/cache/cache.module';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [
    DbModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? 'change-me',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ?? '7d') as unknown as number,
        },
      }),
    }),
    AdminModule,
    CacheModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SmsService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
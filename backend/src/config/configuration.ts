import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'question_platform',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const smsConfig = registerAs('sms', () => ({
  provider: process.env.SMS_PROVIDER || 'mock',
  // Fast2SMS
  apiKey: process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '',
  senderId: process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || 'AGRIAPP',
  route: process.env.FAST2SMS_ROUTE || 'otp',
  // Shared / other providers
  apiSecret: process.env.SMS_API_SECRET || '',
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  otpRateLimit: process.env.OTP_RATE_LIMIT !== 'false', // defaults to true
  throttleEnabled: process.env.THROTTLE_ENABLED !== 'false', // defaults to true
}));

export const questionConfig = registerAs('question', () => ({
  dailyLimit: parseInt(process.env.QUESTION_DAILY_LIMIT || '20', 10),
  editWindowSec: parseInt(process.env.QUESTION_EDIT_WINDOW_SEC || '30', 10),
  videoMaxSizeMb: parseInt(process.env.QUESTION_VIDEO_MAX_SIZE_MB || '10', 10),
  videoMaxDurationSec: parseInt(process.env.QUESTION_VIDEO_MAX_DURATION_SEC || '10', 10),
}));
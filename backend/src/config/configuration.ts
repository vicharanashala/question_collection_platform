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
  redisEnabled: process.env.REDIS_ENABLED !== 'false', // defaults to true (prod), false in dev .env
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  tls: process.env.REDIS_TLS === 'true',
  // Rate limits (environment-specific, kept configurable)
  rateLimitOtpPerMin: parseInt(process.env.RATE_LIMIT_OTP_PER_MIN || '3', 10),
  rateLimitSubmissionPerMin: parseInt(process.env.RATE_LIMIT_SUBMISSION_PER_MIN || '10', 10),
  rateLimitLoginPerMin: parseInt(process.env.RATE_LIMIT_LOGIN_PER_MIN || '5', 10),
  rateLimitAdminPerMin: parseInt(process.env.RATE_LIMIT_ADMIN_PER_MIN || '100', 10),
  rateLimitPublicPerMin: parseInt(process.env.RATE_LIMIT_PUBLIC_PER_MIN || '60', 10),
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
  maxImageSizeMb: parseInt(process.env.QUESTION_IMAGE_MAX_SIZE_MB || '5', 10),
}));

export const gcpStorageConfig = registerAs('gcpStorage', () => ({
  projectId: process.env.GCP_PROJECT_ID || '',
  bucketName: process.env.GCP_BUCKET_NAME || '',
  keyFile: process.env.GCP_KEY_FILE || '',
}));

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const llmConfig = registerAs('llm', () => ({
  baseUrl: `${required('VM_SERVER_URL')}:${required('GEMMA_PORT')}/${required('GEMMA_VERSION')}`,
  apiKey: required('GEMMA_API_KEY'),
  model: required('GEMMA_MODEL'),
}));

export const gdbConfig = registerAs('gdb', () => ({
  baseUrl: `${required('VM_SERVER_URL')}:${required('GDB_PORT')}`,
  apiKey: required('GDB_API_KEY'),
}));

export const embedConfig = registerAs('embed', () => ({
  baseUrl: `${required('VM_SERVER_URL')}:${required('EMBED_PORT')}`,
}));
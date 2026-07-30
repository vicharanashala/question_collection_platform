import { registerAs } from '@nestjs/config';

export const dbConfig = registerAs('db', () => ({
  mongoUri: process.env.MONGODB_URL || 'mongodb://localhost:27017/question_platform',
  mongoUser: process.env.MONGODB_USER || process.env.MONGO_USER || '',
  mongoPassword: process.env.MONGODB_PASSWORD || process.env.MONGO_PASSWORD || '',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));

export const redisConfig = registerAs('redis', () => ({
  enabled: process.env.REDIS_ENABLED !== 'false', // defaults to true (opt-out via REDIS_ENABLED=false)
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  tls: process.env.REDIS_TLS === 'true',
  // Rate limits — set via env vars for each environment
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

// Optional env reader — returns the value or null if unset. Used for
// services that should not block startup when running in environments
// (e.g. staging) where the VM services may not be pre-configured.
function optional(key: string): string | undefined {
  const val = process.env[key];
  return val || undefined;
}

export const llmConfig = registerAs('llm', () => {
  const vm = optional('VM_SERVER_URL');
  const gPort = optional('GEMMA_PORT');
  const gVer = optional('GEMMA_VERSION');
  return {
    baseUrl: vm && gPort && gVer
      ? `${vm}:${gPort}/${gVer}`
      : 'http://localhost:8014/v1',
    apiKey: optional('GEMMA_API_KEY') ?? '',
    model: optional('GEMMA_MODEL') ?? '',
  };
});

export const gdbConfig = registerAs('gdb', () => {
  const vm = optional('VM_SERVER_URL');
  const port = optional('GDB_PORT');
  return {
    baseUrl: vm && port ? `${vm}:${port}` : 'http://localhost:8110',
    apiKey: optional('GDB_API_KEY') ?? '',
  };
});

export const embedConfig = registerAs('embed', () => {
  const vm = optional('VM_SERVER_URL');
  const port = optional('EMBED_PORT');
  return {
    baseUrl: vm && port ? `${vm}:${port}` : 'http://localhost:6001',
  };
});
import { registerAs } from "@nestjs/config";
import { getAppEnvironment, isDevelopment, isProduction, isStaging } from "./environment";

export const dbConfig = registerAs("db", () => ({
  mongoUri:
    process.env.MONGODB_URL || "mongodb://localhost:27017/question_platform",
  mongoUser: process.env.MONGODB_USER || process.env.MONGO_USER || "",
  mongoPassword:
    process.env.MONGODB_PASSWORD || process.env.MONGO_PASSWORD || "",
}));

export const jwtConfig = registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET || "change-me-in-production",
  expiresIn: process.env.JWT_EXPIRES_IN || "7d",
}));

export const redisConfig = registerAs("redis", () => ({
  enabled: process.env.REDIS_ENABLED !== "false", // defaults to true (opt-out via REDIS_ENABLED=false)
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  tls: process.env.REDIS_TLS === "true",
  // Rate limits — set via env vars for each environment
  rateLimitOtpPerMin: parseInt(process.env.RATE_LIMIT_OTP_PER_MIN || "3", 10),
  rateLimitSubmissionPerMin: parseInt(
    process.env.RATE_LIMIT_SUBMISSION_PER_MIN || "10",
    10,
  ),
  rateLimitLoginPerMin: parseInt(
    process.env.RATE_LIMIT_LOGIN_PER_MIN || "5",
    10,
  ),
  rateLimitAdminPerMin: parseInt(
    process.env.RATE_LIMIT_ADMIN_PER_MIN || "100",
    10,
  ),
  rateLimitPublicPerMin: parseInt(
    process.env.RATE_LIMIT_PUBLIC_PER_MIN || "60",
    10,
  ),
}));

export const smsConfig = registerAs("sms", () => ({
  provider: process.env.SMS_PROVIDER || "mock",
  // Fast2SMS
  apiKey: process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || "",
  senderId:
    process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || "AGRIAPP",
  route: process.env.FAST2SMS_ROUTE || "otp",
  // BSNL BRPS
  baseUrl: process.env.BRPS_BASE_URL || "https://bulksms.bsnl.in:5010",
  serviceId: process.env.BRPS_SERVICE_ID || "",
  username: process.env.BRPS_USERNAME || "",
  password: process.env.BRPS_PASSWORD || "",
  entityId: process.env.BRPS_ENTITY_ID || "",
  header: process.env.BRPS_HEADER || "ANNAMAI",
  templateId: process.env.BRPS_TEMPLATE_ID || "",
  tokenId: process.env.BRPS_TOKEN_ID || "1",
  ipWhitelist: process.env.BRPS_IP_WHITELIST || "",
  // Shared / other providers
  apiSecret: process.env.SMS_API_SECRET || "",
}));

export const appConfig = registerAs("app", () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  environment: getAppEnvironment(),
  isProduction: isProduction(),
  isStaging: isStaging(),
  isDevelopment: isDevelopment(),
  otpRateLimit: process.env.OTP_RATE_LIMIT !== "false", // defaults to true
  throttleEnabled: process.env.THROTTLE_ENABLED !== "false", // defaults to true
  // Comma-separated allowed browser origins. Empty means "same-origin only" in
  // production and "any origin" elsewhere — see main.ts.
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Skips OTP hash/expiry verification so local development does not need a real SMS
  // gateway. Can never be enabled in production — main.ts refuses to boot if it is.
  otpDevBypass: process.env.OTP_DEV_BYPASS === "true",
}));

export const questionConfig = registerAs("question", () => ({
  dailyLimit: parseInt(process.env.QUESTION_DAILY_LIMIT || "20", 10),

  videoMaxSizeMb: parseInt(process.env.QUESTION_VIDEO_MAX_SIZE_MB || "10", 10),
  videoMaxDurationSec: parseInt(
    process.env.QUESTION_VIDEO_MAX_DURATION_SEC || "10",
    10,
  ),
  maxImageSizeMb: parseInt(process.env.QUESTION_IMAGE_MAX_SIZE_MB || "5", 10),
}));

export const gcpStorageConfig = registerAs("gcpStorage", () => ({
  projectId: process.env.GCP_PROJECT_ID || "",
  bucketName: process.env.GCP_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || "",
  keyFile: process.env.GCP_KEY_FILE || "",
  emulatorHost: process.env.FIREBASE_STORAGE_EMULATOR_HOST || "",
  // Top-level folder inside the shared bucket, so staging and production objects
  // never mix: <bucket>/<prefix>/audios/... Defaults to the current environment.
  prefix: process.env.GCP_STORAGE_PREFIX || getAppEnvironment(),
  // Storage class applied to uploaded objects. Nearline has a 30-day minimum
  // billable duration, which suits write-once audio.
  storageClass: process.env.GCP_STORAGE_CLASS || "NEARLINE",
  // Lifetime of generated V4 signed URLs, in seconds. 7 days is the maximum
  // Google accepts for V4 signing.
  signedUrlTtlSeconds: parseInt(
    process.env.GCP_SIGNED_URL_TTL_SECONDS || String(7 * 24 * 60 * 60),
    10,
  ),
}));

export const reviewerConfig = registerAs("reviewerConfig", () => ({
  reviewerUri: process.env.REVIEWER_URI || "",
}));

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const llmConfig = registerAs("llm", () => ({
  baseUrl: `${required("VM_SERVER_URL")}:${required("GEMMA_PORT")}/${required("GEMMA_VERSION")}`,
  apiKey: required("GEMMA_API_KEY"),
  model: required("GEMMA_MODEL"),
}));

export const gdbConfig = registerAs("gdb", () => ({
  baseUrl: `${required("VM_SERVER_URL")}:${required("GDB_PORT")}`,
  apiKey: required("GDB_API_KEY"),
}));

export const embedConfig = registerAs("embed", () => ({
  baseUrl: `${required("VM_SERVER_URL")}:${required("EMBED_PORT")}`,
}));

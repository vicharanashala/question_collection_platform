// Deterministic environment for every test run. Runs before any module is imported,
// so values read at import time (such as the encryption key) pick these up.
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PAYMENT_DETAILS_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ANVESHAN_ANNADATHA_AUTH_KEY = 'test-api-key';
process.env.ANSWER_SCORING_ENABLED = 'false';
process.env.REDIS_ENABLED = 'false';

// Application metadata — build info, versioning, and environment constants.
// Values are injected at build/startup time.

export const APP_META = {
  name: 'question-collection-platform',
  version: process.env['APP_VERSION'] ?? '0.0.0',
  buildTime: process.env['BUILD_TIME'] ?? new Date().toISOString(),
  environment: process.env['NODE_ENV'] ?? 'development',
} as const;

export const API_VERSION = 'v1';
export const API_PREFIX = `api/${API_VERSION}`;

// Well-known header names used across the app
export const HEADER_NAMES = {
  REQUEST_ID: 'x-request-id',
  USER_ID: 'x-user-id',
  ROLE: 'x-user-role',
  LANGUAGE: 'accept-language',
  API_VERSION: 'x-api-version',
} as const;
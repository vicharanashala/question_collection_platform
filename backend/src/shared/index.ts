// Shared barrel — documents the canonical paths for cross-cutting concerns.
// Prefer importing from sub-paths directly to enable tree-shaking.
//
// Entities
export { User, Wallet, Transaction, Question, AuditLog, AdminConfig, Notification,
  UserPaymentDetail, Report, ReportReply, Faq, WithdrawalRequest, PaymentLog }
  from './database/entities';
export * from './database/entities/index';

// Enums & Exceptions
export * from './classes/enums';
export * from './classes/exceptions/user-status.exception';

// Guards & Decorators
export * from './middleware/guards/jwt-auth.guard';
export * from './middleware/guards/roles.guard';
export * from './middleware/decorators/public.decorator';
export * from './middleware/decorators/roles.decorator';

// Cache
export * from './database/cache/redis.service';
export * from './database/cache/session.service';
export * from './database/cache/cache.keys';

// Services
export * from './services/endpoint-logger/endpoint-logger.service';

// Utils
export * from './functions/utils/encryption.util';
export * from './middleware/validators/is-in-array.validator';
export * from './middleware/validators/max-question-chars.validator';
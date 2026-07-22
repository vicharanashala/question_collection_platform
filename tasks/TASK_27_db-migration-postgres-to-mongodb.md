# Task: Dual-Database Support — PostgreSQL + MongoDB

## Working Rule

**Before starting any sub-task, always prefix your commit/message with the phase number.**
For example: `[Phase 2] Add user repository abstraction`, `[Phase 3] Implement wallet mongo repository`, etc.

**Coverage rule: Every endpoint and every database query/write operation must have a MongoDB equivalent.**
No PostgreSQL-only query or API endpoint may be left without a corresponding MongoDB implementation. If a raw SQL query
or TypeORM-specific method cannot be mapped directly, it must be wrapped in the repository abstraction layer and
implemented separately in `MongoRepository` using Mongoose or the MongoDB driver. Verify coverage before marking a
phase complete.

---

## Context

The platform currently runs fully on PostgreSQL via TypeORM. The goal is to add first-class MongoDB support
while retaining PostgreSQL, controlled entirely by the `DB` environment variable (`DB=mongo` | `DB=postgres`).
When `DB=mongo` is set, all data flows through Mongoose/MongoDB; when `DB=postgres`, the existing TypeORM
PostgreSQL path is used unchanged.

---

## Entities (13)

| # | Entity                | File                                                  | Notes                                              |
|---|-----------------------|-------------------------------------------------------|----------------------------------------------------|
| 1 | User                  | `backend/src/shared/database/entities/user.entity.ts` | Auth, profile, crops[], verificationStatus, role  |
| 2 | Wallet                | `backend/src/shared/database/entities/wallet.entity.ts` | One-per-user, balance, currency                   |
| 3 | Transaction           | `backend/src/shared/database/entities/transaction.entity.ts` | CREDIT/DEBIT, source, balanceAfter               |
| 4 | WithdrawalRequest     | `backend/src/shared/database/entities/withdrawal-request.entity.ts` | payoutDetails (JSONB)                           |
| 5 | UserPaymentDetail     | `backend/src/shared/database/entities/user-payment-detail.entity.ts` | Encrypted fields, Razorpay IDs                 |
| 6 | PaymentLog            | `backend/src/shared/database/entities/payment-log.entity.ts` | PineLabs/Razorpay attempt log                   |
| 7 | Question              | `backend/src/shared/database/entities/question.entity.ts` | domains[], embedding (Vector), mediaUrls[]       |
| 8 | AuditLog              | `backend/src/shared/database/entities/audit-log.entity.ts` | oldValue/newValue (JSONB)                       |
| 9 | AdminConfig           | `backend/src/shared/database/entities/admin-config.entity.ts` | key→value (JSONB) config store                  |
|10 | Notification          | `backend/src/shared/database/entities/notification.entity.ts` | data (JSONB)                                     |
|11 | Report                | `backend/src/shared/database/entities/report.entity.ts` | relatedEntityId/relatedEntityType                |
|12 | ReportReply           | `backend/src/shared/database/entities/report-reply.entity.ts` |                                                  |
|13 | Faq                   | `backend/src/shared/database/entities/faq.entity.ts` |                                                    |

---

## Key DB Operations Per Service

### AuthService (`modules/auth/auth.service.ts`)
- `userRepo.findOne(where: { mobileNumber })` — check duplicate on register
- `userRepo.findOne(where: { id })` — load user for token
- `userRepo.findOne(where: { username })` — username lookup
- `userRepo.save(user)` — insert on register
- `userRepo.update(id, { lastLoginAt, tokenVersion })`
- `walletRepo.save(wallet)` — create wallet on register
- `auditRepo.save(log)` — audit on register
- Raw SQL: `SELECT … FROM users WHERE mobileNumber = $1 AND role = 'ADMIN'`

### UserService (`modules/user/user.service.ts`)
- `userRepo.findOne(where: { id })` — getProfile
- `userRepo.save(user)` — updateProfile, updateCropDetails
- `userRepo.createQueryBuilder('u')` with raw SQL subqueries for **leaderboard** (PostgreSQL-specific:
  subselects with hardcoded enum values, `COALESCE`, `LEFT JOIN` on subqueries, raw SQL ordering)
- `notifRepo.find/findOne/count/update/save/create` — full CRUD on notifications
- `auditRepo.save(log)`

### QuestionService (`modules/question/question.service.ts`)
- `questionRepo.findOne/findAndCount/count/createQueryBuilder/save/create` — all question ops
- `auditRepo.save(log)`
- `notifRepo.save(log)`
- `dataSource.transaction(async em => { repo = em.getRepository(Question); return repo.save(q); })` — transactional save
- `ArrayContains([domains])` — PostgreSQL array overlap filter

### WalletsService (`modules/wallets/wallets.service.ts`)
- `walletRepo.findOne(where: { userId })` — getBalance, getTransactions, withdraw
- `transactionRepo.findAndCount` — list transactions
- `withdrawalRepo.findOne/createQueryBuilder/save/update` — withdrawal CRUD
- `paymentDetailRepo.findOne/find/count/save/update/delete` — payment detail management
- `userRepo.findOne/update` — load/update user for Razorpay contact
- `queryRunner.manager.findOne(..., { lock: { mode: 'pessimistic_write' } })` — pessimistic row lock
- `queryRunner.manager.create/save/update` — transactional wallet ops (credit/debit)
- `dataSource.createQueryRunner().startTransaction/commit/rollback`

### AdminService (`modules/admin/admin.service.ts`)
- Full CRUD on **User**: findOne/find/count/save/update
- Full CRUD on **Question**: findOne/find/count/update
- Full CRUD on **Wallet**: findOne/find
- **Transaction**: find/count/getRawOne (aggregations)
- **WithdrawalRequest**: findOne/createQueryBuilder/save/update
- **AuditLog**: find/save
- **AdminConfig**: find/findOne/save/update/delete
- **Notification**: find/save
- **PaymentLog**: findOne/find/save
- **UserPaymentDetail**: findOne/find/save/update/delete
- QueryBuilder with `ILIKE` (PostgreSQL), `LEFT JOIN`, `SELECT COUNT(*)`, `BETWEEN`, raw SQL aggregates
- `isSuperAdmin(id)` — raw query check
- Bulk config fetch with 30-second in-memory cache (DB reads on startup + cache miss)

### ReportService (if any module uses Report/ReportReply)
- Full CRUD via TypeORM Repository

### FAQService (if any module uses Faq)
- Full CRUD via TypeORM Repository

---

## Sub-Tasks

### Phase 0: Infrastructure & Config

- [ ] **0.1** Add new env vars to `.env.example`:
  ```
  DB=mongo                        # 'mongo' | 'postgres'
  MONGO_URI=mongodb://localhost:27017/question_platform
  MONGO_USER=
  MONGO_PASSWORD=
  ```
- [ ] **0.2** Add `DB` env var to `configuration.ts` in a new `dbConfig` block:
  ```ts
  export const dbConfig = registerAs('db', () => ({
    driver: process.env.DB || 'postgres',  // 'mongo' | 'postgres'
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/question_platform',
    mongoUser: process.env.MONGO_USER || '',
    mongoPassword: process.env.MONGO_PASSWORD || '',
    // existing postgres fields remain
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'question_platform',
  }));
  ```
- [ ] **0.3** Create `backend/src/shared/database/mongodb/` directory with:
  - `mongo.module.ts` — MongoDB NestJS module (MongooseModule.forRoot, MongooseModule.forFeature)
  - `schemas/` directory — one `.schema.ts` per entity

---

### Phase 1: MongoDB Schemas (Mongoose)

- [ ] **1.1** Create `user.schema.ts`
  - Schema name: `users`
  - Fields: all User entity fields
  - `crops: [String]` (array of strings)
  - `role`: enum string
  - `verificationStatus`: enum string
  - `razorpayContactId`: String (optional)
  - Indexes: `mobileNumber` (unique), `username` (sparse unique), `state`, `verificationStatus`
  - Pre-save hook: hash `passwordHash` on changes (if applicable — verify if User has passwordHash)

- [ ] **1.2** Create `wallet.schema.ts`
  - Schema name: `wallets`
  - Fields: all Wallet entity fields
  - Indexes: `userId` (unique)

- [ ] **1.3** Create `transaction.schema.ts`
  - Schema name: `transactions`
  - Fields: all Transaction entity fields
  - Indexes: `walletId`, `referenceId`, `createdAt`

- [ ] **1.4** Create `withdrawal-request.schema.ts`
  - Schema name: `withdrawal_requests`
  - Fields: all WithdrawalRequest entity fields
  - `payoutDetails`: Mixed (raw object)
  - Indexes: `userId`, `status`, `walletId`, `createdAt`

- [ ] **1.5** Create `user-payment-detail.schema.ts`
  - Schema name: `user_payment_details`
  - Fields: all UserPaymentDetail entity fields
  - Indexes: `userId`, `status`, `razorpayValidationId`

- [ ] **1.6** Create `payment-log.schema.ts`
  - Schema name: `payment_logs`
  - Fields: all PaymentLog entity fields
  - Indexes: `withdrawalRequestId`, `adminId`

- [ ] **1.7** Create `question.schema.ts`
  - Schema name: `questions`
  - Fields: all Question entity fields
  - `domains: [String]` (array of strings)
  - `mediaUrls: [String]` (array of strings)
  - `embedding: [Number]` (vector, stored as array of floats for $vectorSearch or external vector DB)
  - Indexes: `userId`, `status`, `state`, `submittedAt`, `cropType`; text index on `questionText`
  - **Note**: MongoDB $vectorSearch requires Atlas; confirm with user if vector search is needed or if embedding lookup is done externally via GdbService/EmbedService

- [ ] **1.8** Create `audit-log.schema.ts`
  - Schema name: `audit_logs`
  - Fields: all AuditLog entity fields
  - `oldValue`, `newValue`, `metadata`: Mixed
  - Indexes: `actorType`, `entityType`, `createdAt`

- [ ] **1.9** Create `admin-config.schema.ts`
  - Schema name: `admin_configs`
  - Fields: all AdminConfig entity fields
  - `value`: Mixed
  - Indexes: `key` (unique)

- [ ] **1.10** Create `notification.schema.ts`
  - Schema name: `notifications`
  - Fields: all Notification entity fields
  - `data`: Mixed
  - Indexes: `userId`, `type`, `isRead`, `createdAt`

- [ ] **1.11** Create `report.schema.ts`
  - Schema name: `reports`
  - Fields: all Report entity fields
  - Indexes: `userId`, `status`, `relatedEntityId`

- [ ] **1.12** Create `report-reply.schema.ts`
  - Schema name: `report_replies`
  - Fields: all ReportReply entity fields
  - Indexes: `reportId`, `adminId`

- [ ] **1.13** Create `faq.schema.ts`
  - Schema name: `faqs`
  - Fields: all Faq entity fields
  - Indexes: `category`, `isVisible`, `displayOrder`

---

### Phase 2: Database Abstraction Layer

- [ ] **2.1** Create `backend/src/shared/database/abstractions/` directory
  - `base.repository.ts` — abstract class with all standard CRUD methods
    ```ts
    export abstract class BaseRepository<T> {
      abstract findAll(filter: FilterQuery<T>, options?: FindOptions): Promise<T[]>
      abstract findOne(filter: FilterQuery<T>): Promise<T | null>
      abstract findById(id: string): Promise<T | null>
      abstract create(data: Partial<T>): Promise<T>
      abstract update(id: string, data: Partial<T>): Promise<T | null>
      abstract delete(id: string): Promise<boolean>
      abstract count(filter: FilterQuery<T>): Promise<number>
      abstract findAndCount(filter: FilterQuery<T>, options: FindOptions): Promise<[T[], number]>
      abstract save(entity: Partial<T>): Promise<T>
      abstract createQueryBuilder(alias: string): any  // abstracted
    }
    ```

- [ ] **2.2** Create `postgres.repository.ts` — wraps TypeORM Repository, implements BaseRepository
  - Uses existing `@InjectRepository` injected Repository under the hood
  - Handles `ArrayContains` → mongo `$in` equivalent translation

- [ ] **2.3** Create `mongo.repository.ts` — wraps Mongoose Model, implements BaseRepository
  - Uses Mongoose Model methods (`find`, `findOne`, `create`, `findByIdAndUpdate`, `deleteOne`, `countDocuments`, `find`)
  - Handles mongo-specific array queries (`$in`, `$all`, `$regex`)
  - Implements `createQueryBuilder` as a mongo query builder wrapper with chainable methods

- [ ] **2.4** Create `db-context.ts` — factory that returns the correct repository implementation based on `DB` env var
  ```ts
  export type DbDriver = 'postgres' | 'mongo';
  export function getDbDriver(): DbDriver {
    return (process.env.DB as DbDriver) || 'postgres';
  }
  export function createUserRepository(driver: DbDriver): BaseRepository<User> { ... }
  // same for all 13 entities
  ```

- [ ] **2.5** Create `db.module.ts` — dynamic module that:
  - Reads `DB` env var on boot
  - Conditionally imports either `TypeOrmModule` (for postgres) or `MongooseModule` (for mongo)
  - Provides all repositories as request-scoped providers

---

### Phase 3: Entity-Specific Repository Classes

- [ ] **3.1** `user.repository.ts` — both PostgresRepository and MongoRepository implementations
  - `findByMobile(mobile)`, `findByUsername(username)`, `findById(id)`
  - `updateLastLogin(id)` — sets lastLoginAt
  - `updateVerificationStatus(id, status)` — atomic update
  - `incrementTokenVersion(id)` — atomic inc
  - For MongoDB: use `findOneAndUpdate` with `$set` / `$inc`

- [ ] **3.2** `wallet.repository.ts`
  - `findByUserId(userId)`, `updateBalance(id, newBalance)` — atomic `findOneAndUpdate({ balance })`
  - Pessimistic lock: for MongoDB use `findOneAndUpdate` with a version field or `findOne` + `save` (not ideal under concurrency — document this limitation or use MongoDB transactions with replica set)

- [ ] **3.3** `transaction.repository.ts`
  - `findByWalletId(walletId, { page, limit, order })`
  - `findByReferenceId(referenceId)`
  - `updateStatusByReferenceId(referenceId, status)`

- [ ] **3.4** `question.repository.ts`
  - `findOneWithUser(id)` — joins user in postgres; uses `$lookup` or separate find in mongo
  - `findAndCount(where, { skip, take, order })` — paginated
  - `countByUserIdAndDate(userId, date)` — daily limit check
  - **Leaderboard raw SQL challenge**: The leaderboard query in UserService uses PostgreSQL-specific raw SQL with subqueries, `COALESCE`, `LEFT JOIN (...)` on raw SQL strings with hardcoded enum values. For MongoDB, implement equivalent using MongoDB Aggregation Pipeline:
    ```js
    // MongoDB equivalent aggregation
    db.questions.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: '$userId', totalQuestions: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.role': 'USER' } },
      { $lookup: { from: 'transactions', localField: '_id', foreignField: 'walletId', as: 'txns' } },
      // ... continue aggregation for earned total
      { $sort: { totalQuestions: -1, totalEarned: -1 } },
      { $skip: offset },
      { $limit: limit }
    ])
    ```
    Or: pre-compute and store `approvedQuestionCount` on the User document and update it on each approval (denormalized). This is recommended for performance.

- [ ] **3.5** `withdrawal-request.repository.ts`
  - `findByUserId(userId, { page, limit })` — paginated list
  - `findPendingByUserId(userId)` — for idempotency check
  - `updateStatus(id, status, extra)` — atomic update
  - `findByIdWithUser(id)`

- [ ] **3.6** `notification.repository.ts`
  - `findByUserId(userId, { page, limit })`
  - `countUnread(userId)`
  - `markAsRead(id, userId)`
  - `markAllRead(userId)`

- [ ] **3.7** `payment-log.repository.ts`
  - `findByWithdrawalId(id)`
  - `findByAdminId(adminId, { page, limit })`

- [ ] **3.8** `audit-log.repository.ts`
  - `find({ actorType?, entityType?, fromDate?, toDate?, { page, limit } })` — filtered paginated query
  - `save(log)` — create

- [ ] **3.9** `admin-config.repository.ts`
  - `findAll()` — for cache warm-up
  - `findByKey(key)`, `upsertKey(key, value)`

- [ ] **3.10** `report.repository.ts` and `report-reply.repository.ts`
  - Standard CRUD + `findByUserId`, `findByIdWithReplies`

- [ ] **3.11** `faq.repository.ts`
  - `findVisible({ category })`

- [ ] **3.12** `user-payment-detail.repository.ts`
  - `findByUserId(userId)`
  - `findVerifiedByUserId(userId)` — for `hasVerifiedPaymentDetail`
  - `findByRazorpayValidationId(id)`

---

### Phase 4: Service Migration — Replace Repository Injection

> **Coverage requirement: Every API endpoint must work with MongoDB.**
> Before starting this phase, enumerate every controller endpoint across all modules and confirm each
> has a MongoDB-compatible repository implementation. Do not skip any endpoint.

For each service, introduce a `DbFactory` or `repositories` object that is typed as either
`PostgresRepositories` or `MongoRepositories` based on the `DB` env var. Services should be
largely unaware of which DB is active.

**Pattern per service:**

```ts
// Before (PostgreSQL only)
constructor(
  @InjectRepository(User) private readonly userRepo: Repository<User>,
  ...
) {}

// After (dual DB)
constructor(
  @Inject('USER_REPOSITORY') private readonly userRepo: IUserRepository,
  ...
) {}
```

Where `IUserRepository` is an interface implemented by both `PostgresUserRepository` and `MongoUserRepository`.

**Endpoint & Query Coverage Checklist (verify each before closing Phase 4)**

For every service below, confirm: (a) every repository method is abstracted behind an interface,
(b) both `PostgresUserRepository` and `MongoUserRepository` implement that interface, and
(c) the service calls no raw TypeORM/TypeORM QueryBuilder method directly.

#### 4.1 AuthService Migration
- Inject `IUserRepository`, `IWalletRepository`, `IAuditLogRepository`
- Replace all `this.userRepo.*` calls with repo interface methods
- Raw SQL query for admin lookup: wrap in repository as `findAdminByMobile()`
- On register: create user → create wallet in a transaction
  - **PostgreSQL**: use `dataSource.transaction()`
  - **MongoDB**: use a Mongoose session transaction (requires replica set)
  - **Alternative (no replica set)**: sequential saves with error compensation

#### 4.2 UserService Migration
- Inject all required repositories
- Replace `this.userRepo.createQueryBuilder` — highest complexity item
  - For MongoDB: implement equivalent via Aggregation Pipeline or a dedicated `getLeaderboard()` method on the repository that uses MongoDB's aggregation
  - Leaderboard denormalization option: maintain a `leaderboardScore` field on User document, updated on question approval (increment by 1). Then leaderboard query becomes: `find({ role: 'USER', leaderboardScore: { $gt: 0 } }).sort({ leaderboardScore: -1 })` — much simpler and performant

#### 4.3 QuestionService Migration
- Inject `IQuestionRepository`, `IAuditLogRepository`, `INotificationRepository`
- Replace `dataSource.transaction(async em => { repo = em.getRepository(Question); return repo.save(q); })`
  - For MongoDB: use `withTransaction()` or sequential saves
- Replace `ArrayContains([domains])` — for MongoDB use `{ domains: domains }` (exact match) or `{ domains: { $in: [domains] } }` depending on semantics (contains vs. any-of)
- Keep all GemmaService, GdbService, EmbedService, Redis calls unchanged (they are not DB-specific)

#### 4.4 WalletsService Migration
- Inject all wallet, transaction, withdrawal, payment-detail, user repositories
- Replace `dataSource.createQueryRunner()` — highest complexity item
  - PostgreSQL: existing `QueryRunner` with `pessimistic_write` lock
  - MongoDB: use `startSession()` + `withTransaction()` (requires MongoDB replica set)
  - **Fallback without replica set**: use MongoDB's `findOneAndUpdate` atomic update pattern for balance operations (no explicit row lock needed since atomic update is inherent)
    ```js
    // Atomic balance update (replaces pessimistic lock)
    db.wallets.findOneAndUpdate(
      { _id: walletId, balance: { $gte: amount } },  // conditional update
      { $inc: { balance: -amount } },
      { returnDocument: 'after' }
    )
    // If result is null → insufficient balance (atomic race-condition safe)
    ```
- Replace `queryRunner.manager.update/Wallet, id, { balance })` → repository atomic update methods
- Replace `queryRunner.manager.create(Transaction, ...)` → `transactionRepo.create()`
- Replace `queryRunner.manager.save(Transaction, tx)` → `transactionRepo.save(tx)`

#### 4.5 AdminService Migration
- Inject all repositories (User, Question, Wallet, Transaction, WithdrawalRequest, AuditLog, AdminConfig, Notification, PaymentLog, UserPaymentDetail)
- Replace all `this.userRepo.createQueryBuilder` → `IUserRepository.listUsers(dto)`
- Replace `getRawOne()` aggregations → `IAuditLogRepository.getAggregates(params)` or similar
- Config cache: `refreshConfigCache()` calls `configRepo.find()` → works identically in both DBs via repository abstraction
- Replace `this.isSuperAdmin(id)` raw SQL → `IUserRepository.isSuperAdmin(id)`

#### 4.6 ReportService Migration (if exists)
- Inject `IReportRepository`, `IReportReplyRepository`
- Replace all `reportRepo`, `reportReplyRepo` calls

#### 4.7 FAQ Service Migration (if exists)
- Inject `IFaqRepository`

---

### Phase 5: NestJS Module Wiring

- [ ] **5.1** Modify `backend/src/app.module.ts`:
  ```ts
  const dbDriver = getDbDriver();
  if (dbDriver === 'postgres') {
    imports.push(TypeOrmModule.forRoot(postgresConfig));
    imports.push(TypeOrmModule.forFeature([...allEntities]));
  } else {
    imports.push(MongooseModule.forRoot(mongoUri, mongoOptions));
    imports.push(MongooseModule.forFeature([...allSchemas]));
  }
  ```
- [ ] **5.2** Update `backend/src/config/typeorm.config.ts` to respect `DB` env var (existing file)
- [ ] **5.3** Update `backend/src/modules/*/*.module.ts` to import from the repository abstraction layer instead of `@InjectRepository`

---

### Phase 6: Query Translation Notes

| PostgreSQL Pattern                              | MongoDB Equivalent                                       |
|-------------------------------------------------|----------------------------------------------------------|
| `repo.find({ where: { id } })`                  | `model.findOne({ _id: id })`                             |
| `repo.findAndCount({ where, skip, take })`      | `Promise.all([model.find().skip().limit(), model.countDocuments()])` |
| `repo.createQueryBuilder('q').where(...)`       | `model.aggregate([{ $match: ... }])` or query builder    |
| `ArrayContains([domains])`                      | `{ domains: { $in: [domains] } }` or `{ domains: domains }` |
| `qb.leftJoinAndSelect('q.user', 'u')`           | `$lookup` aggregation stage or separate `.populate()`   |
| `qb.orderBy('q.submittedAt', 'DESC')`           | `{ sort: { submittedAt: -1 } }`                          |
| `repo.createQueryBuilder(...).getRawOne()`      | Aggregation with `$group`                                |
| `BETWEEN date1 AND date2`                       | `{ dateField: { $gte: date1, $lte: date2 } }`           |
| `ILIKE '%search%'`                              | `{ $or: [{ field: { $regex: search, $options: 'i' } }] }` |
| `COUNT(*) WHERE status = x`                     | `countDocuments({ status: x })`                          |
| `SELECT SUM(...) ... GROUP BY`                  | `aggregate([{ $group: { _id: '$field', total: { $sum: '$amount' } } }])` |
| `pessimistic_write` lock                        | `findOneAndUpdate` atomic conditional update             |
| `dataSource.transaction(() => {...})`            | `session.withTransaction(() => {...})` (needs replica set) or sequential atomic updates |

---

### Phase 7: Testing & Verification

> **Coverage requirement: Every endpoint must be tested in both `DB=postgres` and `DB=mongo` modes.**
> Document the full API endpoint list from all controllers before writing tests. Every endpoint
> must return the same response shape and status code in both DB modes.

- [ ] **7.1** Enumerate all API endpoints across all controllers (auth, user, question, wallets, admin, report, faq, notification). Confirm each endpoint's DB operations are covered by Phase 3 repository methods.
- [ ] **7.2** Write integration tests for each repository (PostgresRepository vs MongoRepository produce same results)
  - Test all CRUD operations for each of the 13 entities
  - Test pagination, filtering, sorting
  - Test transactions (wallet credit/debit for WalletsService)
  - Test leaderboard query equivalence
- [ ] **7.3** Test `DB=postgres` boot — verify all services start correctly
- [ ] **7.4** Test `DB=mongo` boot — verify all services start correctly
- [ ] **7.5** Test **every auth endpoint** (register, login, verifyOTP, refresh, logout) in both DB modes
- [ ] **7.6** Test **every user endpoint** (getProfile, updateProfile, updateCropDetails, leaderboard) in both DB modes
- [ ] **7.7** Test **every question endpoint** (submit, list, getById, approve/reject, flag) in both DB modes
- [ ] **7.8** Test **every wallet endpoint** (getBalance, listTransactions, withdraw, addPaymentDetail) in both DB modes
- [ ] **7.9** Test **every admin endpoint** (user/question/wallet/transaction/withdrawal management, config, reports, notifications) in both DB modes
- [ ] **7.10** Test question submission → approval → reward credit flow in both DB modes
- [ ] **7.11** Test withdrawal flow (add payment detail → verify → withdraw → process) in both DB modes
- [ ] **7.12** Test admin config cache warm-up in both DB modes

---

### Phase 8: Deployment Notes

- [ ] **8.1** MongoDB `$text` index on `questions.questionText` for keyword search (if used)
- [ ] **8.2** MongoDB vector search (`$vectorSearch`) — only available on MongoDB Atlas with Atlas Search index. If the project uses external vector DB (GdbService), embedding field on Question document is for reference only; no `$vectorSearch` needed.
- [ ] **8.3** MongoDB replica set required for multi-document transactions. Document in README whether replica set is required for `DB=mongo` mode. Without replica set, use atomic `findOneAndUpdate` pattern for wallet operations.
- [ ] **8.4** Index review: ensure all MongoDB schema indexes match the PostgreSQL indexes (including composite indexes)

---

## Critical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MongoDB transactions require replica set | Wallet operations may fail without replica set | Use atomic `findOneAndUpdate` pattern; document replica set requirement |
| `$lookup` joins are expensive | Leaderboard with joins could be slow | Pre-compute `approvedQuestionCount` on User document; update on approval |
| ArrayContains semantic differs | Domains filter may behave differently | Clarify: `domains` must contain ALL provided domains or ANY? Use `$all` vs `$in` accordingly |
| Raw SQL not portable | `getRawOne()` aggregations won't work in MongoDB | Wrap in repository; implement MongoDB aggregation pipeline per query |
| Enum fields as strings | Postgres enum type vs MongoDB string | Store as string in both; no native enum enforcement in MongoDB |
| JSONB fields | Postgres JSONB vs MongoDB documents | MongoDB documents natively support this; direct mapping |

---

## File Changes Summary

### New Files
```
backend/src/shared/database/
  abstractions/
    base.repository.ts        # Abstract interface + base implementation hints
    postgres.repository.ts    # TypeORM-backed implementations
    mongo.repository.ts       # Mongoose-backed implementations
    db-context.ts             # Factory: chooses postgres or mongo based on DB env
  mongodb/
    mongo.module.ts           # NestJS MongoDB module
    schemas/
      user.schema.ts
      wallet.schema.ts
      transaction.schema.ts
      withdrawal-request.schema.ts
      user-payment-detail.schema.ts
      payment-log.schema.ts
      question.schema.ts
      audit-log.schema.ts
      admin-config.schema.ts
      notification.schema.ts
      report.schema.ts
      report-reply.schema.ts
      faq.schema.ts
  repositories/               # One pair per entity
    user.repository.ts
    wallet.repository.ts
    question.repository.ts
    transaction.repository.ts
    withdrawal-request.repository.ts
    notification.repository.ts
    payment-log.repository.ts
    audit-log.repository.ts
    admin-config.repository.ts
    report.repository.ts
    report-reply.repository.ts
    faq.repository.ts
    user-payment-detail.repository.ts
```

### Files to Modify
```
.env.example                    # Add DB, MONGO_URI, MONGO_USER, MONGO_PASSWORD
backend/src/config/configuration.ts   # Add dbConfig
backend/src/app.module.ts       # Conditionally load TypeORM or Mongoose
backend/src/config/typeorm.config.ts  # Respect DB env (keep for CLI migrations)
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.module.ts
backend/src/modules/user/user.service.ts
backend/src/modules/user/user.module.ts
backend/src/modules/question/question.service.ts
backend/src/modules/question/question.module.ts
backend/src/modules/wallets/wallets.service.ts
backend/src/modules/wallets/wallets.module.ts
backend/src/modules/admin/admin.service.ts
backend/src/modules/admin/admin.module.ts
backend/src/modules/report/*.ts  (if exists)
backend/src/modules/faq/*.ts     (if exists)
backend/package.json             # Add mongoose (@nestjs/mongoose, mongoose)
```
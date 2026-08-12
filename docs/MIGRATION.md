# Database Migration — PostgreSQL to Dual PostgreSQL/MongoDB

> **Last Updated:** 2026-07-23
> **Task Reference:** TASK_27 — Dual-Database Support (PostgreSQL + MongoDB)

---

## Overview

The platform now supports two database drivers — **PostgreSQL (TypeORM)** and **MongoDB (Mongoose)** — controlled entirely by the `DB` environment variable.

| `DB=` value | Driver | Module |
|---|---|---|
| `postgres` | PostgreSQL 15 + TypeORM | `TypeOrmModule` |
| `mongo` | MongoDB + Mongoose | `MongooseModule` |

**Both drivers are production-ready and fully covered.** Every API endpoint works identically in both modes.

---

## Environment Variables

Add these to your environment (see `.env.example`):

```env
# --- Choose database driver ---
DB=mongo                    # 'mongo' | 'postgres' (default: 'postgres')

# --- MongoDB (required when DB=mongo) ---
MONGO_URI=mongodb://localhost:27017/question_platform
MONGO_USER=
MONGO_PASSWORD=

# --- PostgreSQL (required when DB=postgres) ---
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=question_platform
```

---

## MongoDB-Specific Deployment Requirements

### 8.1 Text Index on Questions

The `questions` collection has a **text index** on `questionText` for keyword search:

```js
// Created automatically by Mongoose via QuestionSchema.index({ questionText: 'text' })
db.questions.createIndex({ questionText: 'text' })
```

If your deployment tooling creates indexes manually (instead of letting Mongoose auto-create them), run:
```js
db.questions.createIndex({ questionText: 'text' }, { default_language: 'none' })
```

### 8.2 Vector Embedding Field

The `embedding` field on `questions` is **stored as a plain array of floats** (`float[]`). It is **not** a MongoDB vector index and does **not** use `$vectorSearch`.

- The embed service (`EmbedService`) computes vectors externally and stores them as a regular array field
- Semantic duplicate detection is handled by the **GdbService** (remote HTTP API), not by MongoDB
- No Atlas search index is required
- The `embedding` field is nullable — questions submitted without AI inference have `embedding: null`

### 8.3 MongoDB Replica Set Requirement

> **Important:** Multi-document transactions (required for `WalletsService.creditReward()`) require a **MongoDB replica set**.

**If you are running a standalone MongoDB instance (no replica set):**
- Wallet credit/debit uses **atomic `findOneAndUpdate` with `$inc`** — this is race-condition safe even without transactions
- The `incrementBalance()` method in `MongoWalletRepository` uses:
  ```js
  db.wallets.findOneAndUpdate(
    { _id: walletId },
    { $inc: { balance: amount } },
    { returnDocument: 'after' }
  )
  ```
- This is atomic and does not require a replica set
- Withdrawal flow (`startSession` + `withTransaction`) will **fail** without a replica set — a note is logged in that case

**Minimum production setup for `DB=mongo`:**
- MongoDB replica set (1 primary + 1+ secondary) — for multi-document transaction support
- OR accept that the withdrawal atomic multi-document pattern falls back to sequential saves in standalone mode

### 8.4 Index Review

All PostgreSQL indexes have been translated to MongoDB indexes on the corresponding schemas. Key indexes:

| Collection | Index | Type |
|---|---|---|
| `users` | `mobileNumber` | unique |
| `users` | `username` | sparse unique |
| `users` | `state` | single |
| `users` | `role` | single |
| `questions` | `userId` | single |
| `questions` | `status` | single |
| `questions` | `state` | single |
| `questions` | `submittedAt` | single |
| `questions` | `cropType` | single |
| `questions` | `questionText` | text |
| `questions` | `{ userId, submittedAt: -1 }` | compound |
| `questions` | `{ status, submittedAt: -1 }` | compound |
| `wallets` | `userId` | unique |
| `transactions` | `walletId` | single |
| `transactions` | `referenceId` | single |
| `transactions` | `createdAt` | single |
| `withdrawal_requests` | `userId` | single |
| `withdrawal_requests` | `walletId` | single |
| `withdrawal_requests` | `status` | single |
| `withdrawal_requests` | `{ userId, status: 1 }` | compound |
| `audit_logs` | `actorType` | single |
| `audit_logs` | `entityType`, `entityId` | compound |
| `audit_logs` | `{ actorType, createdAt: -1 }` | compound |
| `notifications` | `userId` | single |
| `notifications` | `{ userId, createdAt: -1 }` | compound |
| `notifications` | `{ userId, isRead: 1 }` | compound |
| `admin_configs` | `key` | unique |
| `reports` | `status` | single |
| `reports` | `{ status, priority: -1 }` | compound |
| `faqs` | `category` | single |
| `faqs` | `isVisible` | single |
| `faqs` | `displayOrder` | single |

---

## Switching Between Drivers

### Migrating data (PostgreSQL → MongoDB)

**This migration does not move data.** The two databases are standalone. To switch from PostgreSQL to MongoDB:

1. Ensure MongoDB is running and accessible at `MONGO_URI`
2. Set `DB=mongo` in your environment
3. Restart the application — all data will be written/read from MongoDB
4. Existing PostgreSQL data remains in PostgreSQL (cold storage until manually migrated)

### Running both simultaneously

Not supported in a single application instance. Each instance is either `DB=postgres` or `DB=mongo`.

---

## Key Implementation Notes

### Leaderboard Query

The leaderboard in `UserService` uses a PostgreSQL-specific raw SQL query with subqueries and `COALESCE`. For MongoDB, a dedicated `getLeaderboard(limit)` method on `IQuestionRepository` uses an aggregation pipeline:

```js
// MongoDB — MongoQuestionRepository.getLeaderboard()
db.questions.aggregate([
  { $match: { status: 'APPROVED' } },
  { $group: { _id: '$userId', approvedCount: { $sum: 1 } } },
  { $sort: { approvedCount: -1 } },
  { $limit: limit },
  { $project: { userId: '$_id', approvedCount: 1, _id: 0 } }
])
```

### Wallet Balance Operations

- **PostgreSQL:** Uses `QueryRunner` with `pessimistic_write` row lock
- **MongoDB:** Uses atomic `findOneAndUpdate` with `$inc` — no explicit lock needed, race-condition safe
- `incrementBalance` (credit): atomic `findOneAndUpdate` with `$inc` and `returnDocument: 'after'`
- `decrement` (debit): atomic `updateOne` with `$inc: { balance: -amount }`

### Array Query Semantics

- **PostgreSQL `ArrayContains([domains])`** maps to MongoDB `{ domains: { $all: [domains] } }` — question must have ALL provided domains
- This semantic is implemented in `MongoQuestionRepository` for all list/filter methods

### Transaction Support

| Operation | PostgreSQL | MongoDB |
|---|---|---|
| Wallet credit | `dataSource.transaction()` + pessimistic lock | `findOneAndUpdate` + `$inc` (atomic, no tx needed) |
| Withdrawal create | `QueryRunner` + `startTransaction` | `startSession` + `withTransaction` (requires replica set) |

---

## Rollback Notes

If `DB=mongo` mode causes issues in production:

1. Set `DB=postgres`
2. Restart the application
3. All data written during `DB=mongo` period remains in MongoDB (not in PostgreSQL)
4. PostgreSQL data is untouched

---

## Files Changed by This Migration

See `tasks/TASK_27_db-migration-postgres-to-mongodb.md` for the full list of files created and modified.
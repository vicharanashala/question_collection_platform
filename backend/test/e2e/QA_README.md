# Question Collection Platform — QA & E2E Test Infrastructure

## Overview

This document covers the end-to-end (e2e) test setup for the Question Collection Platform backend. Tests run against a real in-process NestJS application and a dedicated PostgreSQL test database. External AI services (Gemma, GDB, Sarvam) are mocked at the provider level so tests are deterministic and fast.

---

## Stack

| Tool | Purpose |
|---|---|
| Vitest | Test runner (matches Reviewer System pattern) |
| Supertest | HTTP assertions against in-process NestJS app |
| PostgreSQL 15 | Real test database (isolated, resets between runs) |
| Docker Compose | Spins up test PostgreSQL on port 5435 |
| NestJS TestingModule | Boots real app with mocked AI providers |

---

## Folder Structure

```
backend/
├── test/
│   └── e2e/
│       ├── setup.ts                          # Loads .env.test before all tests
│       ├── QuestionSubmit.e2e.test.ts        # Layer 1 — Question submit flows (10 tests)
│       └── helpers/
│           ├── app.helper.ts                 # createTestApp() — boots NestJS with mocks
│           ├── seed.helper.ts                # seedTestUsers(), cleanTestData()
│           └── auth.helper.ts                # getAuthToken(), getAuthHeaders()
├── .env.test                                 # Test environment variables
├── docker-compose.test.yml                   # PostgreSQL test container only
└── vitest.e2e.config.ts                      # Vitest config for e2e tests
```

---

## Setup (First Time)

### 1. Install dependencies

```bash
cd backend
pnpm install
```

### 2. Start test database

```bash
docker compose -f docker-compose.test.yml up -d
```

This starts a PostgreSQL 15 container on port 5435 with database `question_platform_test`.

> Redis is NOT needed — the app's RedisService falls back to an in-memory store automatically when Redis is unreachable.

### 3. Run tests

```bash
pnpm exec vitest run --config vitest.e2e.config.ts
```

---

## Test Users (Seeded Automatically)

| Mobile | Name | Role | Category |
|---|---|---|---|
| 9000000001 | Test Farmer | user | farmer |
| 9000000002 | Test Student | user | student |
| 9000000003 | Test Curator | curator | volunteer |
| 9000000004 | Test Finance | finance | volunteer |
| 9000000005 | Test Admin | admin | volunteer |
| 9000000006 | Test SuperAdmin | super_admin | volunteer |

All users are pre-verified and pre-consented. Wallets are created for each user with balance 0.

---

## OTP Test Bypass

In `src/auth/auth.service.ts`, when `NODE_ENV=test`, OTP `123456` is accepted without bcrypt verification. This allows tests to get auth tokens without a real SMS gateway.

**This bypass is active only when `NODE_ENV=test`.** It has no effect in development or production.

---

## Mocked Services

| Service | Mocked Method | Default Return |
|---|---|---|
| GemmaService | `inferCropAndDomains` | `{ crop: 'soybean', domains: ['crop_protection'], confidence: 0.95 }` |
| GdbService | `checkDuplicate` | `{ isDuplicate: false, ... }` |
| SarvamService | `transcribeChunk`, `transcribeFinal` | `{ text: 'test transcript', sequenceNumber: 0, error: null }` |

Per-test overrides use `vi.mocked(service.method).mockResolvedValueOnce(...)`.

---

## Test Files

### Layer 1 — QuestionSubmit.e2e.test.ts (23 tests ✅)

| # | Test | What it covers |
|---|---|---|
| 1 | Preview happy path | Full preview flow, valid response shape |
| 2 | Submit → PENDING | Confidence ≥ 0.9, correct status |
| 3 | Submit → HUMAN_REVIEW | Confidence < 0.9 routing |
| 4 | GDB duplicate → rejected | Duplicate detection flow |
| 5 | Missing auth → 401 | JWT guard |
| 6 | Text > 1000 chars → 400 | Validation |
| 7 | Image without URL → 400 | Media validation |
| 8 | Edit within 30s → 200 | Edit window open |
| 9 | Daily limit enforcement | 20th passes, 21st blocked |
| 10 | Get own questions only | Data isolation |
| 11 | Edit after window closes → 400 | Edit window expired |
| 12 | Non-owner edit → 403 | Ownership guard |
| 13 | GET /questions/:id by owner → 200 | Owner read access |
| 14 | GET /questions/:id non-owner non-approved → 403 | Non-owner read guard |
| 15 | GET /questions/:id approved → 200 any user | Approved questions are public |
| 16 | Pagination (page/limit) | Correct page size and totals |
| 17 | Status filter | Only matching-status questions returned |
| 18 | GET /questions/stats/me | dailyCount + remaining = dailyLimit |
| 19 | Submit video mediaType → 201 | Video media allowed |
| 20 | Missing required field (state) → 400 | Required field validation |
| 21 | Empty domains array → 400 | ArrayMinSize(1) validation |
| 22 | Preview with GDB duplicate in response | Duplicate flag surfaces in preview |
| 23 | Admin sees all users' questions | Role-based list scope |


---

## Planned Test Files

| File | Layer | Status |
|---|---|---|
| `QuestionSubmit.e2e.test.ts` | Layer 1 | ✅ Done |
| `AIPipeline.e2e.test.ts` | Layer 2 | 🔲 Pending |
| `WalletReward.e2e.test.ts` | Layer 3 | 🔲 Pending |
| `PaymentDetail.e2e.test.ts` | Layer 4 | 🔲 Pending |
| `AdminOps.e2e.test.ts` | Layer 5 | 🔲 Pending |
| `SpeechLGD.e2e.test.ts` | Layer 6 | 🔲 Pending |

---

## Known Failing Tests

**As of 2026-08-12**, `develop` was merged again and migrated the backend from
PostgreSQL/TypeORM to MongoDB/Mongoose. All 8 e2e suites were rewritten onto the new
repository abstraction (see `test_plan.md`'s "2026-08-12 — `develop` merge #2" section for the
full investigation). This superseded the 3 bugs previously listed here — the code paths they
lived in were rewritten as part of the migration, so their current status is unverified. **41
of 123 tests now fail**, every one attributed to one of ~9 confirmed real bugs surfaced by the
migration (not test-harness issues) — full detail and per-suite breakdowns are in
`test_plan.md`'s results table and each suite's own `.md` "Last run" section. Highlights:

| Bug | Impact |
|---|---|
| `WalletsService` methods call a TypeORM `DataSource` never provided in Mongo mode | Reward crediting and withdrawal create/cancel/reversal are completely non-functional |
| `@IsUUID`/`ParseUUIDPipe` validators reject real Mongo ObjectId strings | Withdraw and question-by-id endpoints always reject valid ids |
| Sparse-unique-null schema bugs (`username`, `verificationOrderId`, `orderId`) | A second payment detail (any user, any type) always 500s |
| `Between()`/`In()` FindOperator mistranslation in the Mongo query layer | Date-range and id-list filters silently match nothing |
| Raw SQL / TypeORM relation-joins never ported to Mongo | Leaderboard, most audit-log endpoints, fraud stats, admin wallet listings return empty or crash |

None of these are fixed, per team decision ("we are only testers").

---

## Running in Staging

On every deployment to staging, the following script should be triggered by GitHub Actions:

```bash
docker compose -f docker-compose.test.yml up -d
pnpm exec vitest run --config vitest.e2e.config.ts --reporter=json --outputFile=e2e-results.json
python report_results.py e2e-results.json --type=question-collection
docker compose -f docker-compose.test.yml down
```

---

## Troubleshooting

**Port 5435 already in use**
Change the port in `docker-compose.test.yml` and `DB_PORT` in `.env.test` to any free port.

**Missing env var error on startup**
Check `src/config/configuration.ts` for `required()` calls and add any missing keys to `.env.test`.

**Tests skipped (0 run)**
Usually means the NestJS app failed to boot. Check the error above the skipped list — it's always an env var or missing package.

**OTP bypass not working**
Confirm `NODE_ENV=test` is set in `.env.test` and that `.env.test` is being loaded by `vitest.e2e.config.ts`.


**UPDATED on 03/07/2026 - First version  

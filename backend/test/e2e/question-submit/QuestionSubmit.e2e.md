# Question Submit — E2E Test Documentation

**File:** `test/e2e/question-submit/QuestionSubmit.e2e.test.ts`

---

## What this covers

The full question lifecycle from a farmer's perspective: preview, submit, edit, read,
list, and daily-stats endpoints — exercised against the **real PostgreSQL DB** configured
in `.env` using the NestJS in-process harness.

| Method  | Endpoint                    | Purpose                                  |
|---------|-----------------------------|------------------------------------------|
| `POST`  | `/questions/preview`        | Enrich payload; check GDB before submit  |
| `POST`  | `/questions`                | Submit question; triggers AI pipeline    |
| `PATCH` | `/questions/:id`            | Always 403 — question editing was removed entirely (2026-07-24) |
| `GET`   | `/questions/:id`            | Read a single question                   |
| `GET`   | `/questions`                | List questions (paginated, filterable)   |
| `GET`   | `/questions/stats/me`       | Daily submission count + remaining quota |
| `POST`  | `/questions/:id/approve`    | Admin approval (used to set up T15)      |

---

## Strategy

**In-process NestJS server** — `createTestApp()` boots the full production DI container
against the real DB. External AI services (`GemmaService`, `GdbService`) are replaced with
`vi.fn()` doubles so every test is deterministic regardless of the AI server's state.

Three test users are seeded via `seedTestUsers()` and authenticated at `beforeAll` time:

| Token         | Mobile       | Role    | Purpose                           |
|---------------|--------------|---------|-----------------------------------|
| `farmerToken` | `9000000001` | FARMER  | primary submitter                 |
| `studentToken`| `9000000002` | STUDENT | non-owner, second submitter       |
| `adminToken`  | `9000000005` | ADMIN   | approve questions, see all users  |

`seedQuestion()` bypasses the API to insert questions directly into the DB — used
wherever a test needs a pre-existing question in a specific state (expired edit window,
specific status, etc.) without consuming the daily quota.

---

## Auth strategy

`JwtAuthGuard` is applied globally in production. `createTestApp()` boots the real guard,
so every authenticated request must carry a valid JWT (`Authorization: Bearer <token>`).
`getAuthToken()` logs in via OTP and returns a real short-lived JWT. `vi.clearAllMocks()`
in `beforeEach` resets Gemma/GDB call counts without clearing their default mock
implementations.

---

## Flow diagram

> **To preview locally:** install the VS Code extension
> **"Markdown Preview Mermaid Support"** then press `Ctrl+Shift+V`.
> Diagrams also render natively on GitHub.

```mermaid
flowchart TD
  classDef entry fill:#ede9fe,stroke:#7c3aed,color:#3b0764
  classDef ok    fill:#d1fae5,stroke:#059669,color:#064e3b
  classDef warn  fill:#fef9c3,stroke:#d97706,color:#78350f
  classDef err   fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
  classDef decide fill:#faf5ff,stroke:#7c3aed,color:#3b0764

  ROOT["QuestionSubmit E2E - 23 tests"]:::entry

  ROOT --> AUTH{"JWT present?"}:::decide
  AUTH -- "no token - T5" --> E401["401 Unauthorized"]:::err
  AUTH -- "valid JWT" --> ROUTES["Authenticated routes"]:::entry

  ROUTES --> PR1
  ROUTES --> PVAL
  ROUTES --> OWN1
  ROUTES --> OWN2
  ROUTES --> L1
  ROUTES --> S1

  subgraph PREVIEW ["1. POST /questions/preview"]
    PR1["T1: happy path - 200, cropType + domains"]:::ok
    PR2["T22: GDB isDuplicate=true - 200, duplicate in body"]:::warn
  end

  subgraph SUBMIT ["2. POST /questions"]
    PVAL{"payload valid?"}:::decide
    PVAL -- "T6: text over 1000 chars" --> PV400a["400"]:::err
    PVAL -- "T7: IMAGE, no mediaUrls" --> PV400b["400"]:::err
    PVAL -- "T20: state missing" --> PV400c["400"]:::err
    PVAL -- "T21: domains empty" --> PV400d["400"]:::err
    PVAL -- "valid" --> DLIM{"under daily limit?"}:::decide
    DLIM -- "T9: 21st submission" --> DL400["400 daily limit"]:::err
    DLIM -- "ok" --> AIPATH{"AI routing"}:::decide
    AIPATH -- "T2: conf=0.95, no dup" --> PEND["201 PENDING"]:::ok
    AIPATH -- "T3: conf=0.7" --> HRV["201 HUMAN_REVIEW"]:::warn
    AIPATH -- "T4: GDB duplicate" --> DUP["201 DUPLICATE"]:::warn
    AIPATH -- "T19: VIDEO + URL" --> VID["201"]:::ok
  end

  subgraph EDIT ["3. PATCH /questions/:id (editing removed entirely, 2026-07-24)"]
    OWN1{"owner?"}:::decide
    OWN1 -- "T12: student edits farmer Q" --> E403["403 Not your question"]:::err
    OWN1 -- "yes" --> ALWAYS["403 Question editing is no longer available"]:::err
    ALWAYS -.-> T8note["T8: even immediately after submit"]:::err
    ALWAYS -.-> T11note["T11: even with an expired old editWindowClosesAt"]:::err
  end

  subgraph READ ["4. GET /questions/:id"]
    OWN2{"owner?"}:::decide
    OWN2 -- "T13: own PENDING" --> R200["200"]:::ok
    OWN2 -- "no" --> APPR{"APPROVED?"}:::decide
    APPR -- "T14: PENDING" --> R403["403"]:::err
    APPR -- "T15: admin approved" --> R200b["200 APPROVED"]:::ok
  end

  subgraph LIST ["5. GET /questions"]
    L1["T10: student sees own only"]:::ok
    L2["T16: page=1 limit=2, total>=3"]:::ok
    L3["T17: status=human_review filter"]:::ok
    L4["T23: admin sees all users"]:::ok
  end

  subgraph STATS ["6. GET /questions/stats/me"]
    S1["T18: dailyCount + remainingToday + dailyLimit"]:::ok
  end
```

---

## Test cases (23 total)

### Preview (2 tests)

| #  | Test | Mock | Expected |
|----|------|------|----------|
| T1  | Preview — happy path | Gemma default | 200; `cropType` string, `domains` array |
| T22 | Preview — GDB duplicate flag reflected | GDB `isDuplicate=true`, score=0.97 | 200; `duplicate.isDuplicate=true`, `matchedQuestion` present |

### Submit — validation (4 tests)

| #  | Test | Expected |
|----|------|----------|
| T5  | Missing auth | 401 |
| T6  | `questionText` > 1000 chars | 400 |
| T7  | `mediaType=IMAGE`, `mediaUrls=[]` | 400 |
| T20 | Missing required field `state` | 400 |
| T21 | Empty `domains` array | 400 |

### Submit — AI routing (4 tests)

| #  | Test | Mock | Expected |
|----|------|------|----------|
| T2  | Happy path | Gemma confidence=0.95, GDB no dup | 201 · `PENDING` |
| T3  | Low confidence | Gemma confidence=0.7 | 201 · `HUMAN_REVIEW` |
| T4  | GDB duplicate detected | GDB `isDuplicate=true` | 201 · `DUPLICATE` |
| T19 | Valid video mediaType | studentToken, `mediaType=VIDEO` + URL | 201 |

### Submit — daily limit (1 test)

| #  | Test | Setup | Expected |
|----|------|-------|----------|
| T9  | Daily limit enforcement | Seed 19 questions → submit 20th (201) → submit 21st | 400 · message contains "daily limit" |

### Edit (3 tests) — editing removed entirely as of 2026-07-24, no longer window-dependent

**Corrected 2026-07-24:** `question.service.ts`'s `update()` now unconditionally throws
`ForbiddenException('Question editing is no longer available')` right after the ownership
check — the whole edit feature was removed (`feat: remove question edit window after
submission feature`), not just the 30s window. T8 and T11 previously asserted the old
window-based behavior (200 when open, 400 when expired); both now correctly expect 403
regardless of timing.

| #  | Test | Setup | Expected |
|----|------|-------|----------|
| T8  | Edit attempt immediately after submit | Submit via API, immediately PATCH | 403 (was 200) |
| T11 | Edit attempt with an old, already-expired `editWindowClosesAt` | `seedQuestion` with `editWindowClosesAt` in the past | 403 (was 400) |
| T12 | Non-owner edit | `seedQuestion` for farmer, PATCH with `studentToken` | 403 |

### Read single (3 tests)

| #  | Test | Setup | Expected |
|----|------|-------|----------|
| T13 | Owner reads own pending | `seedQuestion` for farmer | 200 · correct `id` + `questionText` |
| T14 | Non-owner reads non-approved | `seedQuestion` PENDING | 403 |
| T15 | Any user reads approved | `seedQuestion` → admin approves → student reads | 200 · `status=APPROVED` |

### List (4 tests)

| #  | Test | Expected |
|----|------|----------|
| T10 | Ownership isolation | `studentToken` list contains only student's own questions |
| T16 | Pagination | `?page=1&limit=2` → 2 items, `total≥3`, `pages≥2` |
| T17 | Status filter | `?status=human_review` → every item is `HUMAN_REVIEW` |
| T23 | Admin sees all | `adminToken` list contains farmer's seeded question |

### Stats (1 test)

| #  | Test | Expected |
|----|------|----------|
| T18 | Daily stats | `dailyCount`, `remainingToday`, `dailyLimit` present; `remainingToday = max(0, limit − count)` |

---

## Notable implementation details

- **`seedQuestion()`** inserts directly into the DB, bypassing the API daily-limit check.
  Used in T11, T12, T13, T14, T15, T16, T17, T23.
- **Daily limit test (T9)** wipes all of the farmer's questions first (`questionRepo.delete`)
  then seeds exactly 19, ensuring the 20th API call succeeds and the 21st hits 400 —
  regardless of how many submissions accumulated from previous runs.
- **Stats invariant (T18):** `dailyCount + remainingToday` can exceed `dailyLimit` when the
  same DB is used across multiple test runs on the same calendar day. The assertion uses
  `remainingToday === max(0, limit − count)` instead of the sum.
- **`vi.clearAllMocks()`** in `beforeEach` resets call counts but not `mockResolvedValue`
  implementations — the default Gemma/GDB stubs persist across tests; per-test overrides use
  `mockResolvedValueOnce`.

---

## Cleanup

`afterAll` calls `cleanTestData(dataSource)` which deletes all rows created by the test seed
users, then closes the NestJS application.

---

## Last run

**Date:** 2026-07-08 | **Result:** 23/23 passed | **Duration:** ~56 s

| #  | Test | Result |
|----|------|:------:|
| T1  | Preview — happy path | ✅ |
| T2  | Submit — happy path → PENDING | ✅ |
| T3  | Submit — low confidence → HUMAN_REVIEW | ✅ |
| T4  | Submit — GDB duplicate → DUPLICATE | ✅ |
| T5  | Submit — missing auth → 401 | ✅ |
| T6  | Submit — questionText > 1000 chars → 400 | ✅ |
| T7  | Submit — mediaType IMAGE no URLs → 400 | ✅ |
| T8  | Edit within 30 s → 200 | ✅ |
| T9  | Daily limit enforcement → 400 | ✅ |
| T10 | Get my questions — ownership isolation | ✅ |
| T11 | Edit after window closes → 400 | ✅ |
| T12 | Non-owner edit → 403 | ✅ |

**Update 2026-07-24:** after `develop` was merged, question editing was removed entirely
(commit `feat: remove question edit window after submission feature`). T8 and T11 above
reflect the *original* 2026-07-08 pre-merge behavior (edit window open/expired). Both were
updated to expect 403 unconditionally — see the "Edit" section above for detail. Also fixed at
the same time: the test environment had no real Redis instance until this date
(`docker-compose.test.yml` never provisioned one), which made every question submission 500
via the newly-merged `DuplicateDetectionService` → `RedisService.exists()` call (no
circuit-breaker on that method). Provisioning `redis-test` in `docker-compose.test.yml` fixed
this for the whole suite, not just this file. Full run after both fixes: 23/23 passing again.
| T13 | GET /:id — owner reads own pending → 200 | ✅ |
| T14 | GET /:id — non-owner reads non-approved → 403 | ✅ |
| T15 | GET /:id — approved visible to any user → 200 | ✅ |
| T16 | Pagination — correct page size and totals | ✅ |
| T17 | Status filter — only HUMAN_REVIEW returned | ✅ |
| T18 | GET /stats/me — daily count + remaining + limit | ✅ |
| T19 | Submit — video mediaType with URL → 201 | ✅ |
| T20 | Submit — missing state → 400 | ✅ |
| T21 | Submit — empty domains → 400 | ✅ |
| T22 | Preview — GDB duplicate flag reflected | ✅ |
| T23 | GET /questions — admin sees all users | ✅ |

**Update 2026-08-12:** `develop` migrated the backend from PostgreSQL/TypeORM to
MongoDB/Mongoose (see `test_plan.md`'s 2026-08-12 section). Rewrote `DataSource` usage onto
the repository abstraction; removed `editWindowClosesAt` from `seedQuestion()` and all seed
calls (confirmed the field no longer exists on the `Question` schema at all — flagged as an
unresolved TS diagnostic in the previous session, now resolved by deletion rather than
suppression); replaced `QuestionStatus.HUMAN_REVIEW` (removed — "streamline question review
process by removing AI and human review statuses") with `PENDING` in the low-confidence test
and `HELD` in the status-filter test; omitted `language` from all direct-seed question objects
(see `UserProfile.e2e.md` for the real MongoDB text-index bug this avoids); replaced a
`questionRepo.find({ where: { id: In(...) } })` ownership check with per-id `findById()` calls
(the repo abstraction has no bulk delete-by-filter, and `In()` hits the same FindOperator
mistranslation bug documented in `AdminAnalyticsAudit.e2e.md`).

**Result: 17/23 passing.** 6 tests fail on one real bug, not fixed: `question.controller.ts`
guards `PATCH /questions/:id`, `GET /questions/:id`, and 2 other `:id` routes with
`@Param('id', new ParseUUIDPipe())`. Every real question id in Mongo mode is a 24-char
ObjectId hex string, never a UUID, so `ParseUUIDPipe` always rejects it with 400 before the
request ever reaches the controller — regardless of what the test is actually trying to
exercise (edit-removed 403, ownership 403, read visibility). Same class of bug as
`WalletReward.e2e.md`'s `@IsUUID('4', ...)` finding on `paymentDetailId` — real ids throughout
this Mongo-migrated codebase are ObjectId strings, but several DTOs/route params still
validate against the old UUID format. Affects: both "Edit" tests, "Edit - non-owner", and all
3 "GET /questions/:id" tests.

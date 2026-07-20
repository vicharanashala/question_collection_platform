# AI Pipeline — E2E Test Documentation

**File:** `test/e2e/ai-pipeline/AIPipeline.e2e.test.ts`

---

## What this covers

The server-side AI pipeline exercised end-to-end: Gemma crop/domain inference, GDB semantic
duplicate detection, and the embedding service — verified through the **real HTTP layer**
against the live PostgreSQL DB. Tests confirm confidence thresholds, duplicate routing,
embedding failure tolerance, and admin config propagation.

| Method  | Endpoint                  | Purpose                                      |
|---------|---------------------------|----------------------------------------------|
| `POST`  | `/questions/preview`      | Preview enrichment via Gemma + GDB           |
| `POST`  | `/questions`              | Submit; triggers full AI pipeline            |
| `PATCH` | `/admin/config`           | Update duplicate similarity threshold        |
| `GET`   | `/admin/config`           | Read back updated config value               |

---

## Strategy

Same in-process NestJS harness as `QuestionSubmit`. Three AI service doubles are registered
in `createTestApp()` and returned for per-test override:

| Double          | Default stub                                              |
|-----------------|-----------------------------------------------------------|
| `GemmaService`  | `{ crop: 'soybean', domains: ['Insect - Pest Management'], confidence: 0.95 }` |
| `GdbService`    | `{ isDuplicate: false, … }`                               |
| `EmbedService`  | `[0.1, 0.2, 0.3]`                                         |

`beforeEach` resets all mocks and restores these defaults so every test starts clean.
Per-test overrides use `mockResolvedValueOnce`.

| Token         | Mobile       | Role    | Purpose                          |
|---------------|--------------|---------|----------------------------------|
| `farmerToken` | `9000000001` | USER    | primary submitter                |
| `adminToken`  | `9000000005` | ADMIN   | update config, access admin APIs |

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

  ROOT["AIPipeline E2E - 10 tests"]:::entry

  ROOT --> ROUTES["Authenticated routes"]:::entry

  ROUTES --> PV
  ROUTES --> CONF
  ROUTES --> ADM

  subgraph PREVIEW ["1. POST /questions/preview"]
    PV{"Gemma + GDB mocks"}:::decide
    PV -- "T1: unknown crop" --> PR_UNKNOWN["200 cropType=Unknown, domains=Others"]:::warn
    PV -- "T9: GDB duplicate" --> PR_DUP["200 isDuplicate=true, score present"]:::warn
    PV -- "T10: 2 domains" --> PR_MULTI["200 both domains in body"]:::ok
  end

  subgraph SUBMIT ["2. POST /questions"]
    CONF{"Gemma confidence"}:::decide
    CONF -- "T2: conf=0.9 exactly" --> PEND["201 PENDING at threshold"]:::ok
    CONF -- "T3: conf=0.899" --> HRV["201 HUMAN_REVIEW below threshold"]:::warn
    CONF -- "high conf" --> GDBD{"GDB result"}:::decide
    GDBD -- "T4: not dup, score=0.5" --> NOT_DUP["201 PENDING, duplicateFlag=false"]:::ok
    GDBD -- "T5: dup, score=0.95" --> DUP["201 DUPLICATE, id empty"]:::warn
    CONF -- "T6: embed null" --> EMBED_NULL["201 saved, embedding=null"]:::ok
    CONF -- "T7: 2 domains" --> MULTI_DOM["201 both domains persisted"]:::ok
  end

  subgraph CONFIG ["3. PATCH + GET /admin/config"]
    ADM["T8: set threshold=0.99, GET confirms, restore after"]:::ok
  end
```

---

## Test cases (10 total)

### Preview (3 tests)

| #   | Test | Mock | Expected |
|-----|------|------|----------|
| T1  | Gemma "Unknown" crop reflected in preview | Gemma `crop='Unknown'`, `confidence=0.4` | 200; `cropType='Unknown'`, `domains=['Others']` |
| T9  | GDB duplicate result surfaced in preview | GDB `isDuplicate=true`, score=0.97 | 200; `duplicate.isDuplicate=true`, `matchedQuestion` set |
| T10 | Multiple Gemma domains in preview | Gemma `domains=['Insect…','Disease…']` | 200; both domains present in response |

### Submit — confidence threshold (2 tests)

| #  | Test | Mock | Expected |
|----|------|------|----------|
| T2 | Confidence exactly 0.9 → PENDING | Gemma `confidence=0.9` | 201 · `PENDING` |
| T3 | Confidence 0.899 → HUMAN_REVIEW | Gemma `confidence=0.899` | 201 · `HUMAN_REVIEW` |

### Submit — GDB routing (2 tests)

| #  | Test | Mock | Expected |
|----|------|------|----------|
| T4 | GDB similarity below threshold → PENDING | GDB `isDuplicate=false`, score=0.5 | 201 · `PENDING`; `duplicateFlag=false` in DB |
| T5 | GDB detects duplicate → DUPLICATE | GDB `isDuplicate=true`, score=0.95 | 201 · `DUPLICATE`; `id=''`; `matchedQuestion` + `matchedAnswer` present |

### Submit — embedding tolerance (1 test)

| #  | Test | Mock | Expected |
|----|------|------|----------|
| T6 | Embedding returns null → question saves | `embed` mock returns `null` | 201; question row saved with `embedding=null` |

### Submit — domain storage (1 test)

| #  | Test | Expected |
|----|------|----------|
| T7 | Two domains in payload → both stored | `domains=['Insect - Pest Management','Disease Management']` in payload → both present on saved DB row |

### Admin config (1 test)

| #  | Test | Expected |
|----|------|----------|
| T8 | Threshold update persists | `PATCH duplicate_similarity_threshold=0.99` → `GET /admin/config` confirms value=0.99; restored to 0.9 after |

---

## Notable implementation details

- **Confidence boundary:** the service uses `confidence < 0.9` to route to `HUMAN_REVIEW`,
  so exactly `0.9` goes to `PENDING`. T2 and T3 pin both sides of that boundary.
- **DUPLICATE response shape:** when GDB flags a duplicate, the submit endpoint returns
  `{ id: '', status: 'DUPLICATE', duplicate: { isDuplicate, matchedQuestion, matchedAnswer, similarityScore } }`.
  No row is written to the DB (T5).
- **Embedding null tolerance:** `EmbedService.embed()` already returns `null` on any network
  failure. T6 forces this path explicitly; the question saves with `embedding: null`.
- **Config cache:** `AdminService` caches config for 30 s. T8 relies on the cache being
  invalidated immediately after `PATCH` (the service calls `configCache.delete(key)` after
  every update).
- **`beforeEach` mock reset:** `vi.clearAllMocks()` wipes call counts; default
  implementations are restored manually so they do not bleed between tests.

---

## Cleanup

`afterAll` calls `cleanTestData(dataSource)` (full `TRUNCATE … CASCADE`) then closes the app.

---

## Last run

**Date:** 2026-07-17 | **Result:** 1 failing (not investigated — see below)

**Known failure:** `Admin config - duplicate_similarity_threshold update persists`

```
AssertionError: expected undefined to be 0.99 // Object.is equality
- Expected: 0.99
+ Received: undefined
  at test/e2e/ai-pipeline/AIPipeline.e2e.test.ts:227:35
```

Reproduces identically standalone and inside the full suite run. Root cause not investigated —
flagged for a separate look.

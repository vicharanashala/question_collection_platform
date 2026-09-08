# AI Services

## Project
Agriculture Knowledge Collection Platform

---

## Overview

Three core AI services handle question validation at submission time. They run **server-side** (not on-device) and are called synchronously from the NestJS `question` module during the submit/preview flow. A fourth service (Sarvam AI) handles speech transcription, and a fifth (LGD) provides authoritative location data.

```
[Question submitted]
       │
       ▼
 GemmaService.inferCropAndDomains()
 (crop + domain inference, confidence score)
       │
       │ confidence ≥ 0.9 ?
       │
       ├── NO ───────────────────────────┐
       ▼                                 │
 GDBService.checkDuplicate()             │
 { questionText, crop, state }           │
       │                                 │
       │ isDuplicate (chosen_for_answer  │
       │  AND similarity ≥ threshold) ?  │
       │                          0.9    │
       ├── YES ──┐                       │
       ▼         │                       │
  [PENDING]     │                       │
  duplicate     │                       │
  notification  │                       │
  to user       │                       │
                │                       │
       NO ──────┘                       │
       │                                 │
       ▼                                 ▼
 [PENDING] ◄────────────────────────────┘
 (awaiting curator review)

 [HUMAN_REVIEW] ◄── confidence < 0.9
 (curator review queue)
```

The `approvalReason` and `rejectionReason` fields on questions are set from the admin-supplied `reason` in the review DTO (no separate LLM call).

---

## 1. Gemma Service

**Model:** Groq (OpenAI-compatible API) — configurable via `llm.model`, default `meta-llama/llama-4-maverick`. Compatible providers include Groq, Together AI, Cerebras, or any OpenAI-compatible endpoint. Set `llm.baseUrl` and `llm.apiKey` in `.env` to enable.

**File:** `backend/src/ai/gemma.service.ts`

**Purpose:** Classify the question's crop and agriculture domain(s), and return a confidence score.

**Method:**

```typescript
inferCropAndDomains(questionText: string): Promise<GemmaInferenceResult>
```

**`GemmaResult`:**

| Field | Type | Description |
|---|---|---|
| `crop` | `string` | Detected or estimated crop (from `CROPS` constant list) |
| `domains` | `string[]` | Agriculture domain codes (up to 3, e.g. `["crop_protection", "irrigation"]`) |
| `confidence` | `number` | Score 0.0 – 1.0 |

**Logic:**
- If `confidence ≥ 0.9` and not an exact duplicate: question is set to `PENDING` (awaiting curator review)
- If `confidence < 0.9`: question goes to human review queue (status → `HUMAN_REVIEW`)
- **No auto-approval** — all questions enter the review queue; a curator must approve to trigger reward credit
- Crop and domain inference are **separate LLM calls** with independent retry + fallback
- If the LLM call fails or returns malformed JSON after retries, crop falls back to `"Unknown"` and domains fall back to keyword-based `inferDomains()` from question constants
- JSON parsing uses a two-strategy approach: strip markdown code fences + parse, then regex-extract known fields from partial/truncated responses

---

## 2. GDB Service (Content Check + Duplicate Detection)

**Provider:** Remote GDB (Graph Database) service — HTTP API at `GDB_BASE_URL/v1/gdb/find-similar-questions`

**File:** `backend/src/modules/ai/gdb.service.ts`

**Purpose:** Run three checks in a single call before a question is saved — abusive-language safety, agriculture relevance, and duplicate detection.

**Method:**

```typescript
checkDuplicate(payload: { questionText: string; languageCode?: string }): Promise<DuplicateCheckResult>
```

**`DuplicateCheckResult`:**

| Field | Type | Description |
|---|---|---|
| `isDuplicate` | `boolean` | True when GDB already has this question (`is_present`) |
| `matchedQuestionId` | `string \| null` | DB UUID of the matched question (null if not found in our DB) |
| `matchedQuestion` | `string \| null` | Text of the matched question from GDB |
| `matchedAnswer` | `string \| null` | The stored answer text the farmer can read |
| `similarityScore` | `number \| null` | Always `null` — this endpoint returns no score |
| `matchedUserName` | `string \| null` | Our submitter's display name, else the GDB author |
| `rejection` | `QuestionRejection \| null` | Set when the query was blocked as abusive or non-agricultural |
| `rawResponse` | `SimilarQuestionResponse \| null` | Raw GDB response for auditing |

**How it works:**

1. Non-English text is translated to English via Sarvam (the GDB knowledge base is English-only). A translation failure falls back to the original text.
2. `POST /v1/gdb/find-similar-questions` is called with `{ question_text }`. No crop/state filter is applied by this endpoint.
3. GDB runs a safety + agriculture-relevance pre-check. If it fails, the response has `rejected: true` and a free-text `rejection_reason`.
4. Otherwise GDB runs exact + vector search with Gemma classification and returns `is_present` plus the matched question, answer, status and author.
5. The matched question is looked up in our DB by `present_question_text` to resolve our UUID and the original submitter's display name.
6. Network, non-JSON and non-2xx responses fail open (treated as not-duplicate) so a GDB outage never blocks a farmer.

**Rejected queries:** `rejection_reason` is English-only and embeds a truncated model fragment, so it is never shown to the user. `GdbService.classifyRejection` maps it to a `QuestionRejectionCategory` (`ABUSIVE` | `NOT_AGRICULTURE` | `OTHER`), and `QuestionService.assertNotRejected` throws:

```
HTTP 422 { error: 'QUESTION_REJECTED', category, reason, message }
```

The throw happens **before** any `Question` row is created, so a rejected query is not saved and does not consume a daily submission slot. Mobile (`QuestionRejectedModal`) and web (`PublicAskPage`) map `category` to a translated `question.rejected*` message.

**GDB response structure:**
```
query, is_present, present_status, present_question_id,
present_question_text, present_answer_text, present_sources[],
present_author, exact_match_found, total_candidates_found,
rejected, rejection_reason
```

> `admin_config.duplicate_similarity_threshold` no longer applies to this path — the endpoint returns no similarity score and decides matches itself.

---

## 4. Duplicate Detection Service

**File:** `backend/src/cache/duplicate-detection.service.ts`

**Purpose:** Exact-text duplicate check against the user's own recent questions (not GDB). Runs as a fast pre-filter before the semantic GDB check.

```typescript
checkExactDuplicate(userId: string, questionText: string): Promise<Question | null>
```

Returns the matched question if the same user submitted an identical (or near-identical) question within the last 30 days. If found, the question is flagged as a duplicate and the user is notified — but it is **not** auto-rejected; it enters the human review queue.

**Called at:**
- `POST /questions/preview` — fast pre-filter
- `POST /questions` (submit) — before calling GDBService

---

## 5. Embed Service

**Provider:** On-premise embedding service — called via HTTP at `{embed.baseUrl}/embed` (default: `http://100.100.108.44:6001`)

**File:** `backend/src/ai/embed.service.ts`

**Purpose:** Convert question text into a dense float vector for storage in `questions.embedding`.

**Method:**

```typescript
embed(text: string): Promise<number[] | null>
```

Returns the embedding vector as `number[]`. Returns `null` when the service is unreachable — callers handle this gracefully by storing `null` in the DB and logging a warning.

**Called at:**
- `POST /questions` (submit) — result stored in `questions.embedding`
- `POST /questions/preview` — **not persisted** (preview only)

**Request/response:**
```json
// POST {baseUrl}/embed
{ "text": "question text here" }

// Response
{ "embedding": [0.0123, -0.0456, ...] }
```

---

## 6. Sarvam AI Speech-to-Text

**Provider:** Sarvam AI API

**File:** `backend/src/speech/sarvam.service.ts`

**Controller:** `POST /speech/transcribe-chunk` and `POST /speech/transcribe-final`

**Purpose:** Transcribe audio recordings (voice questions) in 22 Indian languages.

**Supported language codes (Sarvam):**

`as-IN`, `bn-IN`, `brx-IN`, `doi-IN`, `gu-IN`, `hi-IN`, `kn-IN`, `ks-IN`, `kok-IN`, `mai-IN`, `ml-IN`, `mni-IN`, `mr-IN`, `ne-IN`, `or-IN`, `pa-IN`, `sa-IN`, `sat-IN`, `sd-IN`, `ta-IN`, `te-IN`, `ur-IN`, `en-IN`

**Flow (mobile):**

```
[User records voice question]
        │
        ▼
  Rolling chunks sent to POST /speech/transcribe-chunk
  (sequenceNumber increments per chunk)
        │
        ▼
  Transcript text accumulated in mobile UI
        │
        ▼
  [User stops recording]
        │
        ▼
  Final chunk sent to POST /speech/transcribe-final
        │
        ▼
  Full transcript used as questionText
```

**Audio constraints:**

| Setting | Value |
|---|---|
| Formats | MP4, MPEG, WEBM, OGG, AAC |
| Max file size | 10 MB (configurable via `max_audio_size_mb`) |

**Translation endpoint:** `POST /speech/translate` translates text between any two supported Indian languages (used for cross-language question enrichment).

---

## 7. LGD Service (Location Data)

**Provider:** Local Government Directory (LGD) API

**File:** `backend/src/lgd/lgd.service.ts`

**Controller:** `GET /lgd/states`, `GET /lgd/districts`, `GET /lgd/subdistricts`, `GET /lgd/villages`

**Purpose:** Authoritative district/block/village data for location dropdowns in the mobile app. LGD data is maintained by the Government of India and is the source of truth for Indian administrative divisions.

**No authentication required** — LGD endpoints are public.

**Caching:** LGD responses are cached in Redis with a 7-day TTL to avoid repeated upstream calls.

---

## 8. Question Preview Flow

The `/questions/preview` endpoint runs the full AI pipeline **without persisting** to the database. This allows the mobile app to show the user what the processed question looks like (derived crop, domain, season, agro-climatic zone) before they commit:

```
[User fills question form and taps "Preview"]
        │
        ▼
  POST /questions/preview
        │
        ▼
  GemmaService.inferCropAndDomains()
  → cropType, domains, confidence
        │
        ▼
  Season derivation (from current month)
        │
        ▼
  LgdService.getDistricts() → agroClimaticZone
        │
        ▼
  Exact duplicate check (text match on user's recent questions)
        │
        ▼
  Return: { valid, cropType, domains, season, agroClimaticZone, message }
```

If the user confirms the preview, the full `POST /questions` is called, which additionally:
- Stores the embedding in `questions.embedding`
- Persists to PostgreSQL
- Opens the 30-second edit window

---

*Last Updated: 2026-07-10*
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

## 2. GDB Service (Semantic Duplicate Detection)

**Provider:** Remote GDB (Graph Database) service — HTTP API at `GDB_BASE_URL/v1/gdb/search`

**File:** `backend/src/ai/gdb.service.ts`

**Purpose:** Detect semantically duplicate questions before submission by querying the GDB semantic search API.

**Method:**

```typescript
checkDuplicate(payload: { questionText: string; crop: string; state: string }): Promise<DuplicateCheckResult>
```

**`DuplicateCheckResult`:**

| Field | Type | Description |
|---|---|
| `isDuplicate` | `boolean` | True if a similar question was found above the threshold |
| `matchedQuestionId` | `string \| null` | DB UUID of the matched question (null if not found in our DB) |
| `matchedQuestion` | `string \| null` | Text of the matched question from GDB |
| `matchedAnswer` | `string \| null` | The stored answer text the farmer can read |
| `similarityScore` | `number \| null` | GDB similarity score of the top match |
| `rawResponse` | `GdbSearchResponse \| null` | Raw GDB response for auditing |

**How it works:**

1. On question submit, `POST /v1/gdb/search` is called with `{ rephrased_query, crop, state }`
2. GDB returns `classification_audit.evaluations[]` with per-candidate `similarity_score` and `chosen_for_answer`
3. **Primary filter:** `chosen_for_answer = true` **AND** `similarity_score >= threshold` (default 0.9)
4. **Fallback:** if no `chosen_for_answer=true` exists, use the highest `similarity_score` candidate above threshold
5. The matched question is looked up from our DB by `questionText` to get the UUID and stored answer
6. If `isDuplicate = true`: question's `duplicateFlag = true` and `duplicateOfId` are set; user receives an in-app notification

**Threshold:** Configurable via `admin_config.duplicate_similarity_threshold` (default `0.9`).

**GDB response structure:**
```
classification_audit.evaluations[]:
  - question_id: GDB's internal ID
  - retrieved_question: the question text
  - similarity_score: 0.0–1.0
  - chosen_for_answer: boolean (GDB's LLM-selected best match)
  - relevance_decision, reason, classification
```

---

## 3. Embed Service

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

## 5. Sarvam AI Speech-to-Text

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

## 6. LGD Service (Location Data)

**Provider:** Local Government Directory (LGD) API

**File:** `backend/src/lgd/lgd.service.ts`

**Controller:** `GET /lgd/states`, `GET /lgd/districts`, `GET /lgd/subdistricts`, `GET /lgd/villages`

**Purpose:** Authoritative district/block/village data for location dropdowns in the mobile app. LGD data is maintained by the Government of India and is the source of truth for Indian administrative divisions.

**No authentication required** — LGD endpoints are public.

**Caching:** LGD responses are cached in Redis with a 7-day TTL to avoid repeated upstream calls.

---

## 7. Question Preview Flow

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

*Last Updated: 2026-06-30*
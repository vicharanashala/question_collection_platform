# Task 21: Gemma (Modal) — AI Crop & Domain Inference

**Module:** AI / LLM Inference  
**Status:** Pending  
**Goal ID:** —  
**Started:** —  
**Completed:** —

---

## Context

We have a keyword-based `inferDomains()` function in `backend/src/question/constants/domains.ts` that does rule-based domain matching. It works for common cases but is brittle and doesn't handle:

1. **Crop inference** — there is no equivalent crop-classification logic at all; `CROPS` list exists in `mobile/src/utils/constants.ts` but the backend has no crop-detection mechanism.
2. **Ambiguous questions** — keyword matching fails on nuanced or indirect phrasing (e.g., "my plants look yellow" → likely nutrient deficiency, specific crop unknown).
3. **Multi-domain questions** — a single question may span multiple domains that don't share obvious keywords.

**Solution:** Integrate a Gemma 3 (or Gemma 2B) model hosted on Modal to handle classification. Modal handles infrastructure, GPU provisioning, and auto-scaling. The backend calls the Modal endpoint, passing in the question text and the fixed lists of crops and domains, and receives structured JSON back.

---

## Use Case

When a question is submitted (or previewed), the backend sends the raw question text to the Modal-hosted Gemma endpoint. Gemma returns:

```json
{
  "crop": "Wheat",
  "domains": ["Nutrient Management", "Disease Management"],
  "confidence": 0.87
}
```

The backend then:
- Pre-fills `cropType` and `domains` on the question (user can still override before final submission)
- Uses `aiConfidenceScore` if present on the Question entity (for routing decisions)
- Routes low-confidence submissions to human review (confidence < 0.9)

---

## Sub-Tasks

### Phase A: Modal — Deploy Gemma Endpoint (DO FIRST)

> Modal is the hosting platform. You set this up once; the backend just calls an HTTP endpoint.

#### 1. Modal Account & Setup
- [ ] Create a Modal account at [modal.com](https://modal.com) if not already done
- [ ] Install Modal CLI: `pip install modal` (or `npm install -g @modal-dev/modal` if using Node runtime)
- [ ] Authenticate: `modal setup`
- [ ] Create a Modal workspace (or use existing one)
- [ ] Add `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` to `backend/.env`
  ```
  MODAL_TOKEN_ID=your_token_id
  MODAL_TOKEN_SECRET=your_token_secret
  MODAL_API_URL=https://your-workspace.modal.run
  ```

#### 2. Write the Modal Inference Script
- [ ] Create `modal/gemma_classifier.py` (or `.sh` if using Modal's Node runtime)
- [ ] Pull the Gemma model from Hugging Face or Modal's model registry:
  - Recommended: `google/gemma-3-4b-it` or `google/gemma-3-1b-it` (4b if budget allows, 1b for cost savings)
  - Alternative: `mistralai/Mistral-7B-Instruct-v0.3` if Gemma is unavailable
  - Use Modal's `@modal.gpu` decorator for GPU allocation (e.g., `gpu="T4"` or `"A10G"`)
- [ ] Implement the classification prompt:

```
You are an agricultural AI assistant. Given a farmer's question, you must respond with ONLY valid JSON — no markdown, no explanation.

Question: "{question_text}"

Available crops (pick the most relevant one, or "Unknown" if none):
{crops_list}

Available domains (pick 1-3 most relevant):
{domains_list}

Respond with this exact JSON structure:
{{
  "crop": "CropName or Unknown",
  "domains": ["Domain1", "Domain2"],
  "confidence": 0.0-1.0
}}

Rules:
- crop must be a value from the crops list or "Unknown"
- domains must be 1-3 values from the domains list
- confidence is your certainty score (higher = more confident)
- Respond with ONLY the JSON object, no other text
```

#### 3. Create the Modal App + Endpoint
- [ ] Write a Modal app class with an `@app.function()` decorated inference function
- [ ] Add a web endpoint (`@app.wsgi()` or FastAPI route) so the backend can call it via HTTP POST
- [ ] Alternatively, use Modal's `modal run` with a long-running container — the backend calls `https://{workspace}.modal.app/classify`
- [ ] Implement input validation (question length, JSON parse check)
- [ ] Add retry logic: if Gemma returns malformed JSON, retry up to 2 times
- [ ] Implement a `/health` route on Modal that returns `{"status": "ok"}` for liveness checks
- [ ] Cold-start optimization: set `keep_warm=True` on the inference function or use Modal's warm-pool feature
- [ ] Set appropriate `timeout` (e.g., 60s) for inference calls

#### 4. Test the Modal Endpoint
- [ ] Deploy: `modal deploy gemma_classifier.py`
- [ ] Test with curl:
  ```bash
  curl -X POST https://your-workspace.modal.app/classify \
    -H "Content-Type: application/json" \
    -d '{"question_text": "My wheat leaves are turning yellow and curling", "crops": ["Wheat", "Rice", ...], "domains": ["Nutrient Management", ...]}'
  ```
- [ ] Verify the response is valid JSON with `crop`, `domains`, and `confidence` fields
- [ ] Test error cases: empty string, very long input, non-agricultural question
- [ ] Note the endpoint URL for the backend integration

---

### Phase B: Backend — Gemma Service Layer

#### 5. Add Gemma Config
- [ ] Add to `backend/src/config/configuration.ts`:
  ```typescript
  export const gemmaConfig = registerAs('gemma', () => ({
    modalApiUrl: process.env.GEMMA_MODAL_API_URL || '',
    modalApiKey: process.env.GEMMA_MODAL_API_KEY || '',
    timeoutMs: parseInt(process.env.GEMMA_TIMEOUT_MS || '30000', 10),
    enabled: process.env.GEMMA_ENABLED !== 'false',
  }));
  ```
- [ ] Import and register `gemmaConfig` in the `ConfigModule.forRoot` `load` array in `app.module.ts`
- [ ] Add to `backend/.env`:
  ```
  GEMMA_MODAL_API_URL=https://your-workspace.modal.app
  GEMMA_MODAL_API_KEY=your_api_key_if_needed
  GEMMA_TIMEOUT_MS=30000
  GEMMA_ENABLED=true
  ```
- [ ] Add to `backend/.env.example`

#### 6. Create Gemma Service
- [ ] Create `backend/src/ai/gemma.service.ts`
- [ ] Inject `ConfigService` to read gemma config values
- [ ] Implement `inferCropAndDomains(questionText: string): Promise<GemmaInferenceResult>`
  ```typescript
  interface GemmaInferenceResult {
    crop: string;       // from CROPS list or 'Unknown'
    domains: string[];  // 1-3 from DOMAINS list
    confidence: number; // 0.0-1.0
    rawResponse?: string; // store raw LLM output for debugging
  }
  ```
- [ ] The service calls the Modal endpoint with:
  ```json
  {
    "question_text": "...",
    "crops": ["Wheat", "Rice", ...],
    "domains": ["Nutrient Management", ...]
  }
  ```
- [ ] Parse the JSON response
- [ ] Validate that returned `crop` is in the CROPS list (if not, set to `'Unknown'`)
- [ ] Validate that returned `domains` are in the DOMAINS list (filter out invalid ones; fallback to `['Others']` if all invalid)
- [ ] Clip `confidence` to [0, 1]
- [ ] On failure (network error, non-JSON response, timeout): fall back to `inferDomains()` from `domains.ts` for domains, and `'Unknown'` for crop, with `confidence = 0.0`
- [ ] Add retry: up to 2 retries on failure, with 500ms delay between retries

#### 7. Create AI Module
- [ ] Create `backend/src/ai/ai.module.ts`
  ```typescript
  @Module({
    providers: [GemmaService],
    exports: [GemmaService],
  })
  export class AiModule {}
  ```
- [ ] Import `AiModule` in `app.module.ts`
- [ ] Import `HttpModule` (from `@nestjs/axios` or use built-in `HttpService`) in `AiModule` for the Modal HTTP calls

#### 8. Integrate into Question Service
- [ ] Inject `GemmaService` into `QuestionService`
- [ ] In `preview()`: call `gemmaService.inferCropAndDomains(dto.questionText)` and use the result instead of the keyword-based `inferDomains()`
  ```typescript
  const inferred = await this.gemmaService.inferCropAndDomains(dto.questionText);
  // Use inferred.crop, inferred.domains, inferred.confidence
  ```
- [ ] In `submit()`: always re-infer at submit time to capture the final question text state
- [ ] If `confidence < 0.9`, the question goes to `PENDING_REVIEW` (manual review queue) instead of auto-approving

---

### Phase C: Testing

#### 9. Unit Tests
- [ ] Write tests for `GemmaService` in `backend/src/ai/gemma.service.spec.ts`
  - Mock the HTTP call to Modal
  - Test: valid response → correct parsing
  - Test: malformed JSON → falls back to keyword inference
  - Test: network error → falls back gracefully
  - Test: crop not in list → defaults to 'Unknown'
  - Test: domains not in list → filters to valid only
  - Test: confidence clipping

#### 10. Integration Test
- [ ] Write an end-to-end test in `backend/src/question/question.service.spec.ts` (or a new `question.preview.e2e-spec.ts`) that:
  - Mocks the Gemma HTTP call to return known values
  - Calls `questionService.preview()` with a test question
  - Asserts the returned `cropType` and `domains` match the mocked Gemma response

#### 11. Manual Testing
- [ ] Start the backend: `cd backend && npm run start:dev`
- [ ] Send a test request:
  ```bash
  curl -X POST http://localhost:3000/api/v1/question/preview \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"questionText": "My tomato plants have yellow leaves and white spots on the fruits"}'
  ```
- [ ] Verify the response includes `cropType: "Tomato"` (or similar) and appropriate domains

---

## Constants Reference

### Crops (from `mobile/src/utils/constants.ts` — also expose via a shared constants file or copy to backend)

Full list of ~500 crops. Key ones for testing: `Wheat`, `Rice`, `Cotton`, `Sugarcane`, `Soybean`, `Maize`, `Groundnut`, `Mustard`, `Tomato`, `Potato`, `Onion`, `Garlic`, `Banana`, `Mango`.

### Domains (from `backend/src/question/constants/domains.ts`)

```
Agriculture Mechanization
Agricultural Schemes & Subsidies
Bio-Pesticides and Bio-Fertilizers
Crop Insurance
Cultural Practices
Cultural and Crop Management Practices
Climate, Weather & Stress Management
Credit, Loan & Insurance
Disease Management
Fertilizer Use and Availability
Field Preparation
Farm Tools & Mechanisation
Irrigation and Water Management
Insect–Pest Management
Market Prices, MSP & Marketing
Nutrient Management
Organic Farming
Organic and Natural Farming
Plant Protection
Post Harvest Preservation
Post-Harvest Management & Storage
Seeds
Seed and Variety Selection
Soil Health Card
Soil Testing
Soil Health and Nutrient Management
Sowing Time and Weather
Storage
Varieties
Water Management
Weed Management
Market Information
Others
```

---

## Technical Notes

### Why Modal?
- Zero cold-start infrastructure management
- Per-second billing (GPU seconds only when running)
- Automatic HTTPS, no need to manage TLS
- Secrets management built-in (`modal.secret`)
- Good for LLM serving where traffic may be bursty

### Model Choice
- **Gemma 3 4B** is a good balance of quality vs. cost. Gemma 3 1B is faster but less accurate.
- If Gemma is not available on Hugging Face, fall back to `mistralai/Mistral-7B-Instruct-v0.3`
- Use Modal's `huggingface_hub` integration or pull directly in the script

### Fallback Strategy
The keyword-based `inferDomains()` in `backend/src/question/constants/domains.ts` must remain as a fallback. Never hard-fail if Gemma is unavailable.

### Rate Limiting
- Modal has its own rate limits; implement exponential backoff on 429 responses
- Backend should timeout after `GEMMA_TIMEOUT_MS` (default 30s) and fall back gracefully

### Cost
- Modal GPU instances (T4): ~$0.00016/second
- A typical inference call: ~2-5 seconds → ~$0.0003-0.0008 per question
- At 1000 questions/day: ~$0.30-0.80/day

### Security
- Do NOT expose the Modal API key in frontend code
- Use a Modal secret for any credentials needed inside the Modal app
- The backend → Modal call should ideally use a shared secret header: `Authorization: Bearer <modal_api_key>`

---

## Files to Create/Modify

### Modal
| File | Action |
|---|---|
| `modal/gemma_classifier.py` | Create |
| `modal/requirements.txt` | Create (huggingface, modal, transformers, accelerate) |

### Backend Config
| File | Action |
|---|---|
| `backend/src/config/configuration.ts` | Add `gemmaConfig` |
| `backend/.env` | Add `GEMMA_MODAL_API_URL`, `GEMMA_MODAL_API_KEY`, `GEMMA_TIMEOUT_MS`, `GEMMA_ENABLED` |
| `backend/.env.example` | Add Gemma env vars |
| `backend/src/app.module.ts` | Import `AiModule`; add `gemmaConfig` to load array |

### Backend AI Module
| File | Action |
|---|---|
| `backend/src/ai/gemma.service.ts` | Create |
| `backend/src/ai/ai.module.ts` | Create |
| `backend/src/ai/dto/infer-crop-domain.dto.ts` | Create — request/response DTOs |

### Backend Integration
| File | Action |
|---|---|
| `backend/src/question/question.service.ts` | Inject `GemmaService`; call in `preview()` and `submit()` |
| `backend/src/question/question.module.ts` | Import `AiModule` |

### Tests
| File | Action |
|---|---|
| `backend/src/ai/gemma.service.spec.ts` | Create |
| `backend/src/question/question.service.spec.ts` | Add `preview()` integration test |

---

## Acceptance Criteria

1. **Modal endpoint responds in < 10s** for typical agricultural questions
2. **Crop inference:** When a question clearly relates to a crop (e.g., "my rice paddies have brown spots"), Gemma returns `"crop": "Rice"` (or matches an equivalent from the CROPS list)
3. **Domain inference:** Returns 1-3 relevant domains from the DOMAINS list
4. **Confidence score:** Returns a 0-1 score reflecting Gemma's certainty
5. **Fallback works:** If Modal is down or returns an error, `inferDomains()` keyword logic is used as fallback and `confidence = 0.0`
6. **No hard failures:** A Gemma error never crashes the question submission/preview flow
7. **Low-confidence routing:** Questions with `confidence < 0.9` go to manual review queue
8. **Env-var driven:** All Gemma/Modal config comes from env vars, no hardcoded URLs or keys
9. **Unit tests pass:** `gemma.service.spec.ts` passes with mocked HTTP calls
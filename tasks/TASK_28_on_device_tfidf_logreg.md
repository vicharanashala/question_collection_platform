# Task 28: On-Device TF-IDF + Logistic Regression Model

**Module:** AI / Mobile On-Device Inference  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

The current on-device AI validation (`mobile/src/utils/onDeviceAI.ts`) is entirely keyword-based:
- **Agriculture relevance:** exact keyword matching against a 500+ term Set
- **Duplicate detection:** Levenshtein string similarity against a locally-cached question list
- **Spam detection:** regex/pattern rules

This approach is brittle — it fails on synonyms, code-switched input, misspelled terms, and nuanced phrasing. It also gives no calibrated confidence scores.

**Goal:** Replace the validation pipeline with a TF-IDF + Logistic Regression (LogReg) classifier that runs entirely on-device (React Native / mobile), requires **no training at runtime**, and provides proper confidence scores for all three tasks.

---

## Key Constraints

1. **No training at runtime** — model is pre-trained and shipped as static assets (or hardcoded coefficients). The mobile app downloads new model assets on update; it never trains.
2. **Replace, not augment** — the existing keyword-based pipeline in `mobile/src/utils/onDeviceAI.ts` is removed entirely.
3. **Runs on mobile** — must work in React Native JS environment. Use a pure-JS / TS implementation (no native TensorFlow Lite bindings needed). Libraries like `natural` (Node/Native) are NOT available in RN. Implement TF-IDF + sigmoid manually or use lightweight equivalents.
4. **Three classification tasks** — each is a separate binary LogReg classifier: relevance, duplicate-semantic, spam
5. **Confidence threshold remains 90%** (`SIMILARITY_THRESHOLD` in `mobile/src/utils/constants.ts`) — questions below this confidence on any relevant stage are blocked

---

## Architecture

### Model Design

Each classifier: **TF-IDF vectorizer → Logistic Regression (binary)**

| Classifier | Input | Output |
|---|---|---|
| **Agriculture Relevance** | Raw question text | `pass: bool`, `confidence: 0-1` |
| **Semantic Duplicate** | `(current_question, cached_question)` concatenated with separator | `pass: bool`, `confidence: 0-1` |
| **Spam** | Raw question text | `pass: bool`, `confidence: 0-1` |

#### TF-IDF Details

- Vocabulary: ~5,000 agricultural terms + common Hindi transliterations
- IDF values: precomputed from a representative corpus snapshot
- n-grams: unigrams + bigrams (configurable via pre-trained config)
- Max features: ~8,000

#### Logistic Regression Details

- Weights and biases: pre-trained and stored as JSON arrays in model assets
- Sigmoid activation for probability output
- No gradient descent at runtime

#### Pre-trained Asset Files (shipped with the app bundle)

```
mobile/src/assets/ai/
  ├── relevance/
  │   ├── vocab.json           # { term: index }
  │   ├── idf.json             # { term: idf_value }
  │   ├── weights.json         # [w1, w2, ..., wn]
  │   └── bias.json            # float
  ├── duplicate/
  │   ├── vocab.json
  │   ├── idf.json
  │   ├── weights.json
  │   └── bias.json
  └── spam/
      ├── vocab.json
      ├── idf.json
      ├── weights.json
      └── bias.json
```

> **Note on pre-training:** Since training is not in scope for this task, pre-trained weights will be generated offline (in a separate script) using scikit-learn on a representative labeled dataset, then exported to JSON. The offline training script is out of scope but the model file format above is the target.

---

## Sub-Tasks

### Phase A: Mobile — TF-IDF + LogReg Inference Engine

#### 1. Create Inference Module
- [ ] Create `mobile/src/utils/tfidfLogReg.ts`
- [ ] Implement `class TfidfVectorizer`:
  - `fit(vocab: Record<string, number>, idf: Record<string, number>): void` — just stores pre-trained params, no fitting
  - `transform(text: string): number[]` — tokenises, looks up TF-IDF for each term, returns sparse vector as dense float array
  - Tokenisation: lowercase, strip punctuation, split on whitespace (no stemming/lemmatisation needed since IDF is pre-computed)
- [ ] Implement `class LogisticRegressionBinary`:
  - `load(weights: number[], bias: number): void`
  - `predictProba(vector: number[]): number` — sigmoid(dot(w, x) + b)
  - `predict(vector: number[]): boolean` — predictProba >= threshold
- [ ] Implement `class ClassifierPipeline`:
  - Holds a `TfidfVectorizer` + `LogisticRegressionBinary`
  - `predict(text: string): { pass: boolean, confidence: number }`
  - `loadModel(assetPath: string): Promise<void>` — loads vocab, idf, weights, bias from JSON

#### 2. Asset Loading
- [ ] Use React Native's `require()` or `import` to load JSON assets at module initialisation time (bundled with the app)
- [ ] OR use `fetch()` from `mobile/src/assets/ai/` if assets are served separately
- [ ] Lazy-load models on first use (not at app start) to keep cold start fast
- [ ] Handle missing/corrupt model files gracefully — fall back to keyword-based stub (the current `onDeviceAI.ts` logic), log error

#### 3. Replace onDeviceAI Pipeline
- [ ] Create `mobile/src/utils/onDeviceAIV2.ts` — new pipeline using TF-IDF + LogReg
- [ ] Keep the same `AIValidationResult` interface so `QuestionScreen.tsx` and `AIValidationBanner.tsx` need no changes
- [ ] Replace the import in `mobile/src/screens/Question/QuestionScreen.tsx` to use `onDeviceAIV2`
- [ ] The `runOnDeviceValidation()` function signature stays the same:
  ```typescript
  export async function runOnDeviceValidation(
    questionText: string,
    onDuplicateCacheMiss?: (id: string, text: string) => void
  ): Promise<AIValidationResult>
  ```

#### 4. Duplicate Detection Adaptation
- [ ] The duplicate classifier takes a **pair** of texts: `current_question [SEP] cached_question`
- [ ] The `[SEP]` token is a sentinel string that is absent from the vocabulary so it contributes 0 TF-IDF weight on both sides
- [ ] This lets the single duplicate classifier score any (question, candidate) pair without retraining

#### 5. Confidence Thresholds
- [ ] Each classifier has its own threshold:
  - **Relevance:** `>= 0.85` → pass, otherwise warn/block
  - **Duplicate:** `>= 0.80` → pass (no duplicate), `< 0.80` → flag as likely duplicate
  - **Spam:** `>= 0.90` → pass, otherwise warn/block
- [ ] All thresholds are configurable via `mobile/src/utils/constants.ts` (see `TFIDF_RELEVANCE_THRESHOLD`, `TFIDF_DUPLICATE_THRESHOLD`, `TFIDF_SPAM_THRESHOLD`)

#### 6. Caching Strategy (keep from current impl)
- [ ] Reuse existing `DUPLICATE_CACHE_KEY` AsyncStorage cache for previously submitted questions
- [ ] On app update, model version mismatch → force-clear cache and re-populate

---

### Phase B: Constants & Config

#### 7. Add TF-IDF Config Constants
- [ ] Add to `mobile/src/utils/constants.ts`:
  ```typescript
  export const TFIDF_RELEVANCE_THRESHOLD = 0.85;
  export const TFIDF_DUPLICATE_THRESHOLD = 0.80;
  export const TFIDF_SPAM_THRESHOLD      = 0.90;
  export const TFIDF_MODEL_VERSION       = '1.0.0';
  export const TFIDF_MAX_FEATURES        = 8000;
  export const TFIDF_NGRAMS              = [1, 2] as [1, 2];
  ```

#### 8. i18n Fallback Messages
- [ ] Add new reason keys to `mobile/src/i18n/resources.ts`:
  - `onDeviceAI.relevance.low` — "This question doesn't seem related to agriculture"
  - `onDeviceAI.spam.flagged` — "This question was flagged as potential spam"
  - `onDeviceAI.duplicate.flagged` — "A similar question may already exist"

---

### Phase C: Model Files (Placeholder / Stub)

> Since model weights are pre-trained offline, this task ships placeholder empty models so the code compiles. Real weights are generated by a separate offline training script (out of scope for this task).

#### 9. Create Placeholder Asset Files
- [ ] Create `mobile/src/assets/ai/relevance/vocab.json` — empty `{}`
- [ ] Create `mobile/src/assets/ai/relevance/idf.json` — empty `{}`
- [ ] Create `mobile/src/assets/ai/relevance/weights.json` — `[]`
- [ ] Create `mobile/src/assets/ai/relevance/bias.json` — `0`
- [ ] Repeat for `duplicate/` and `spam/` directories

---

### Phase D: Testing & Validation

#### 10. Unit Tests
- [ ] Test `TfidfVectorizer.transform()`:
  - Empty string → all zeros
  - Known term → correct TF-IDF value
  - Term not in vocab → skipped (0 contribution)
- [ ] Test `LogisticRegressionBinary.predictProba()`:
  - `w = [0, 0], b = 0` → sigmoid(0) = 0.5
  - Positive weighted sum → > 0.5
  - Negative weighted sum → < 0.5
- [ ] Test `ClassifierPipeline.predict()` with stub weights
- [ ] Test that `AIValidationResult` shape matches existing consumer expectations

#### 11. Integration Smoke Test
- [ ] Import and call `runOnDeviceValidation('My wheat crop has yellow leaves')` — should return a valid `AIValidationResult` with `ran: true`
- [ ] Test on browser (Expo web) — should gracefully skip with `ran: false` if model assets fail to load

---

## Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `mobile/src/utils/tfidfLogReg.ts` | Core inference engine |
| `mobile/src/utils/onDeviceAIV2.ts` | New validation pipeline (replaces `onDeviceAI.ts`) |
| `mobile/src/assets/ai/relevance/vocab.json` | Placeholder vocab |
| `mobile/src/assets/ai/relevance/idf.json` | Placeholder IDF |
| `mobile/src/assets/ai/relevance/weights.json` | Placeholder weights |
| `mobile/src/assets/ai/relevance/bias.json` | Placeholder bias |
| `mobile/src/assets/ai/duplicate/` | Same 4 placeholder files |
| `mobile/src/assets/ai/spam/` | Same 4 placeholder files |
| `mobile/src/utils/tfidfLogReg.spec.ts` | Unit tests |

### Modified Files
| File | Change |
|---|---|
| `mobile/src/screens/Question/QuestionScreen.tsx` | Swap import from `onDeviceAI` to `onDeviceAIV2` |
| `mobile/src/utils/constants.ts` | Add TF-IDF threshold + config constants |
| `mobile/src/i18n/resources.ts` | Add new i18n reason keys |
| `tasks/TASK_04_on_device_ai.md` | Mark as superseded / archived |

---

## Acceptance Criteria

1. **`tfidfLogReg.ts`** exports a working `ClassifierPipeline` that accepts text and returns `{ pass, confidence }`
2. **`onDeviceAIV2.ts`** implements `runOnDeviceValidation()` with the same signature as `onDeviceAI.ts`
3. **`QuestionScreen.tsx`** imports from `onDeviceAIV2` — no other changes needed in consumer components
4. **`AIValidationResult`** shape is unchanged — `AIValidationBanner` needs no updates
5. All three classifiers (relevance, duplicate, spam) are loaded from JSON asset files
6. If model assets fail to load, `runOnDeviceValidation()` returns `ran: false` and does not block submission
7. Confidence thresholds are driven by constants, not hardcoded
8. Placeholder model files exist for all three classifiers so the code compiles without real weights
9. Unit tests pass for the inference engine
10. No backend changes required — this is purely a mobile-side replacement

---

## Notes

- **Why not use TensorFlow Lite?** Too complex for this use case. TF-IDF + LogReg is a sparse linear model — pure JS matrix ops on a vocabulary of 8,000 are fast enough (< 50ms on modern devices).
- **Why not use `natural` or `compromise`?** Neither has reliable React Native support. Manual implementation is straightforward and has zero native dependencies.
- **Pre-training is out of scope.** The offline script to generate weights from labeled data is a separate task.
- **Fallback is the current keyword system** if model loading fails at runtime.
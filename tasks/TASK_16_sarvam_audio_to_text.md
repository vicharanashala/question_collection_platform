# Task 16: Sarvam Audio-to-Text & Translation Integration

**Module:** AI / Transcription / Translation  
**Status:** Pending  
**Goal ID:** —  
**Started:** —  
**Completed:** —

---

## Context

Sarvam AI provides speech-to-text (STT) and text-to-text translation APIs supporting 22 Indian languages. We need to integrate both into the question submission flow.

This task has two distinct pieces:

### Piece 1 — Audio to Text (STT)
- On the question submission screen, an audio button records the user's voice
- On click, it captures audio and sends it to the Sarvam STT API
- The transcribed text populates the text input field

### Piece 2 — Text Translation
- A reusable component that wraps any English text input
- Shows a translate button that translates the text into any of the 22 Indian languages based on user preference
- Translation is done via the Sarvam Translate API

**Important:** Work on `/mobile` folder first. Once mobile is completed and merged, ask the user before starting on `/web`.

**Note:** The 22 Indian languages (from Task 12): Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri (Meitei), Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, Urdu

---

## Sub-Tasks

### Phase A: Backend — Sarvam Service Layer (DO FIRST)

> Both mobile and web share the same backend. Build this once.

#### 1. Sarvam API Research & Setup
- [ ] Review Sarvam AI STT and Translate API documentation
- [ ] Obtain API key / credentials
- [ ] Identify endpoint URLs, supported languages, audio format requirements
- [ ] Document API request/response format in this task file
- [ ] Add Sarvam API credentials to `.env` (`SARVAM_API_KEY`, `SARVAM_STT_URL`, `SARVAM_TRANSLATE_URL`)

#### 2. Backend Transcription Service
- [ ] Create `backend/src/services/SarvamService.ts`
- [ ] `transcribeAudio(audioUrl: string, languageCode: string): Promise<TranscriptionResult>`
  - Accepts audio file URL and language code
  - Calls Sarvam STT endpoint
  - Handles errors, rate limiting (429), retries
  - Returns `{ text: string, confidence: number }`
- [ ] `translateText(text: string, fromLang: string, toLang: string): Promise<TranslationResult>`
  - Accepts English text and target language code
  - Calls Sarvam Translate endpoint
  - Returns `{ translatedText: string, confidence: number }`

#### 3. Backend API Routes
- [ ] `POST /api/speech/transcribe` — accepts `{ audioUrl, languageCode }`, returns transcription
- [ ] `POST /api/speech/translate` — accepts `{ text, toLanguage }`, returns translation
- [ ] Both routes validate input, handle errors, return proper HTTP status codes

---

### Phase B: Mobile (`/mobile`)

#### 4. Audio Recording Component
- [ ] Find or create an audio recording button on the question submission screen
- [ ] On press: start recording audio
- [ ] On release / second press: stop recording and upload audio
- [ ] Show a recording indicator (pulsing red dot or waveform)
- [ ] Call `POST /api/speech/transcribe` with the audio file
- [ ] On success, populate the question text input with the transcribed text
- [ ] On failure, show a toast/alert and allow manual text entry
- [ ] Support all 22 Indian languages — language selection should match the i18n language picker already in the app

#### 5. Reusable Translation Component — `<TranslatableText>`
- [ ] Create `mobile/src/components/TranslatableText.tsx`
- [ ] Props:
  - `value: string` — English text to translate
  - `onTranslatedText: (text: string) => void` — callback with translated text
  - `targetLanguage: string` — the user's preferred language
  - `placeholder?: string`
- [ ] UI:
  - Text input displaying the English `value`
  - A translate button (icon: `translate` or `🌐`)
  - On translate button press, call `POST /api/speech/translate`
  - Show loading spinner while translating
  - On success, call `onTranslatedText` with result
  - On error, show toast and keep original text
- [ ] Integrate `<TranslatableText>` into the question submission screen

#### 6. Language Preference Persistence
- [ ] Use the existing i18n/language preference store (from Task 12) to determine the target translation language
- [ ] If no preference is set, default to Hindi

---

### Phase C: Web (`/web`) — DO AFTER MOBILE IS COMPLETED

#### 7. Audio Recording Component (Web)
- [ ] Mirror the mobile audio recording behavior on the question submission screen
- [ ] Use browser MediaRecorder API for audio capture
- [ ] Same flow: record → upload → transcribe → populate text field

#### 8. Reusable Translation Component (Web)
- [ ] Create `web/src/components/TranslatableText.tsx`
- [ ] Same API and behavior as mobile version
- [ ] Use web-compatible UI patterns and styling

---

## Technical Notes

### Sarvam API expectations (to verify during research)
- STT: audio codec, sample rate, max file size
- Translate: character limit per request, batching strategy for long texts
- Rate limits: requests per minute, concurrent limit
- Auth: API key in header or body

### Audio recording
- Mobile: use `expo-av` or `react-native-audio-recorder-player`
- Web: use browser `MediaRecorder` API
- Format: MP3 or WAV (confirm with Sarvam requirements)

### Translation direction
- STT: input language → text (e.g., `hi-IN` audio → Hindi text)
- Translate: English text → target Indian language (e.g., English → Hindi)

### Error handling
- Transcription/translation failures should not block question submission
- Show user-friendly error messages in the app's current language
- Log failures server-side for debugging

---

## Files to Create/Modify

### Backend
| File | Action |
|---|---|
| `backend/src/services/SarvamService.ts` | Create |
| `backend/src/routes/speech.routes.ts` | Create |
| `backend/src/models/Question.ts` | Modify — add transcription fields |
| `.env.example` | Add Sarvam env vars |

### Mobile
| File | Action |
|---|---|
| `mobile/src/components/TranslatableText.tsx` | Create |
| `mobile/src/components/AudioRecorder.tsx` | Create |
| `mobile/src/screens/QuestionSubmissionScreen.tsx` | Modify — integrate audio + translatable text |
| `mobile/src/api/speech.ts` | Create — API client for speech endpoints |

### Web (after mobile)
| File | Action |
|---|---|
| `web/src/components/TranslatableText.tsx` | Create |
| `web/src/components/AudioRecorder.tsx` | Create |
| `web/src/pages/QuestionSubmissionPage.tsx` | Modify — integrate audio + translatable text |
| `web/src/api/speech.ts` | Create — API client for speech endpoints |

---

## Acceptance Criteria

1. **STT:** Tapping the audio button on the question submission screen records voice and populates the text field with transcribed text in the selected language.
2. **Translate:** The `TranslatableText` component accepts English text and a target language, calls the translation API, and returns the translated text via callback.
3. **Error resilience:** If transcription or translation fails, the user is notified and can still manually enter text.
4. **Language support:** Both features work with all 22 Indian languages.
5. **Reusable component:** `TranslatableText` is usable across any screen, not just question submission.
6. **API credentials** are stored in environment variables on the backend, never exposed to the client.
7. **Mobile is completed first.** Web work begins only after mobile is merged.
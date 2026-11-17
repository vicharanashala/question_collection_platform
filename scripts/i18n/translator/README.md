# Incremental i18n scanner + bulk translator

The translator runs the scanner, generates the approved input automatically, and sends strings in bulk by target language. You do not need to create or edit `approved-translations.json` yourself.

## Requirements

- Node.js 18+
- Run commands from the repository root
- `web/node_modules/typescript` must exist
- Backend must expose `POST /api/v1/speech/translate/bulk`
- The bulk endpoint must accept `x-api-key` and return `{ results: [{ key, status, translatedText, error? }] }`

## Environment

PowerShell:

```powershell
$env:I18N_BULK_TRANSLATE_URL="http://localhost:3000/api/v1/speech/translate/bulk"
$env:I18N_API_KEY="YOUR_BACKEND_AUTH_KEY"
```

`I18N_API_KEY` must match backend `ANVESHAN_ANNADATHA_AUTH_KEY`. The Sarvam provider key remains only in the backend.

Optional settings in `config.cjs`:

- `batchSize: 50` — number of source strings in each target-language request (backend example caps at 50).
- `requestConcurrency: 3` — number of bulk HTTP requests in flight from the CLI.
- `maxRetries: 3` — retry attempts for transient batch or item failures.

## One command: scan + generate + bulk translate

From the repository root:

```bash
node scripts/i18n/translator/index.cjs translate --base develop
```

This command:

1. Runs the incremental scanner.
2. Generates `scripts/i18n/reports/incremental-scan.json`.
3. Extracts high-confidence findings and generates `translator/generated/approved-translations.json`.
4. Keeps ambiguous findings and dynamic keys for manual review.
5. Groups source strings by target language and sends bulk requests to the backend.
6. Retries failed batches and then isolates failed items into singleton bulk requests.
7. Validates placeholders and writes `scripts/i18n/reports/translation-preview.json`.

For 100 strings and 22 target languages at batch size 50, the normal path makes 44 CLI-to-backend bulk requests, instead of 2,200 single-string requests. Retries can add requests.

## Backend endpoint is required

The existing `/speech/translate/internal` endpoint accepts one `text`, so it cannot receive the bulk payload. Register a separate API-key-protected controller using the example at `backend-examples/internal-speech-bulk.controller.example.ts`. Adapt import paths and register the controller in the appropriate NestJS module.

The example limits each request to 50 items and fans out to the existing `SarvamService.translateText()` with concurrency 5. It returns one result per key, including individual failures. This is bulk processing at the CLI/backend boundary; it does not claim Sarvam's upstream API has a native bulk endpoint.

If a global JWT guard is enabled, mark this route public using the project's existing `@Public()` decorator so the API-key guard is the authentication mechanism. Keep the existing JWT-protected endpoint unchanged.

## Apply translations

Review the preview first, then explicitly apply:

```bash
node scripts/i18n/translator/index.cjs translate --apply
```

This makes no translation API requests. It adds only missing values to `web/src/i18n/resources.ts`, never overwrites existing translations, and creates a timestamped backup.

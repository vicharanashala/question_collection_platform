# Incremental i18n scanner + bulk translator

The translator runs the scanner, generates the approved input automatically, and sends strings in bulk by target language. You do not need to create or edit `approved-translations.json` yourself.

## Requirements

- Node.js 18+
- Run commands from the repository root
- `web/node_modules/typescript` must exist
- Backend running with `ANVESHAN_ANNADATHA_AUTH_KEY` set (it serves `POST /api/v1/speech/translate/bulk`)

## Environment

macOS / Linux:

```bash
export I18N_BULK_TRANSLATE_URL="http://localhost:3000/api/v1/speech/translate/bulk"
export I18N_API_KEY="YOUR_BACKEND_AUTH_KEY"
```

Windows PowerShell:

```powershell
$env:I18N_BULK_TRANSLATE_URL="http://localhost:3000/api/v1/speech/translate/bulk"
$env:I18N_API_KEY="YOUR_BACKEND_AUTH_KEY"
```

`I18N_BULK_TRANSLATE_URL` is optional. Without it the URL is built from `I18N_API_BASE_URL` (default `http://localhost:3000/api/v1`).

`I18N_API_KEY` must match backend `ANVESHAN_ANNADATHA_AUTH_KEY`. The Sarvam provider key remains only in the backend.

Optional settings in `config.cjs`:

- `batchSize: 50` — number of source strings in each target-language request (the backend caps it at 50).
- `requestConcurrency: 3` — number of bulk HTTP requests in flight from the CLI.
- `maxRetries: 3` — retry attempts for transient batch or item failures.

## One command: scan + generate + bulk translate

From the repository root:

```bash
node scripts/i18n/translator/index.cjs translate --base origin/develop
```

Or from `web/`: `npm run i18n:translate`. Run `git fetch origin develop` first so the base is current.

This command:

1. Runs the incremental scanner.
2. Generates `scripts/i18n/reports/incremental-scan.json`.
3. Extracts high-confidence findings and generates `translator/generated/approved-translations.json`. Strings whose English text already exists in `resources.ts` are skipped and the existing key is printed so you can reuse it.
4. Keeps ambiguous findings and dynamic keys for manual review.
5. Groups source strings by target language and sends bulk requests to the backend.
6. Retries failed batches and then isolates failed items into singleton bulk requests. A 401, 403, 404 or 405 response stops the run, since it means the URL or key is wrong.
7. Validates placeholders and writes `scripts/i18n/reports/translation-preview.json`.

For 100 strings and 22 target languages at batch size 50, the normal path makes 44 CLI-to-backend bulk requests, instead of 2,200 single-string requests. Retries can add requests.

## Backend endpoint

`POST /api/v1/speech/translate/bulk` lives in `backend/src/modules/speech/speech.controller.ts`. It is marked `@Public()` so the global JWT guard is skipped, and `ApiKeyGuard` checks the `x-api-key` header instead.

It accepts up to 50 items per request and fans out to `SarvamService.translateText()` with concurrency 5. It returns `{ results: [{ key, status, translatedText, error? }] }`, with one result per key, including individual failures. Sarvam itself has no native bulk API; batching happens only between the CLI and the backend.

## Apply translations

Review the preview first, then explicitly apply:

```bash
node scripts/i18n/translator/index.cjs translate --apply
```

This makes no translation API requests. It adds only missing values to `web/src/i18n/resources.ts`, never overwrites existing translations, and saves a timestamped backup in `scripts/i18n/reports/` (git-ignored).

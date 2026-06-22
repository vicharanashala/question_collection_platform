# Task 20: GCP Bucket (Nearline) + Image Upload in Question Submission

**Module:** Storage + Question  
**Status:** Pending  
**Started:** 2026-06-22  
**Developer:** Claw

---

## Context

Users submitting questions need the ability to attach images (crop photo, disease photo, etc.). Images must be stored in GCP Cloud Storage (Nearline class) in production, with a mock/in-memory store for local development. Admin must be able to configure the maximum allowed image size; this limit is enforced at submission time.

---

## Scope

```
Backend
  ├── storage/                          (new module)
  │   ├── storage.module.ts
  │   ├── storage.service.ts            (interface / abstraction)
  │   ├── gcp-storage.service.ts        (production: real GCP Nearline)
  │   ├── mock-storage.service.ts       (development: in-memory Map)
  │   └── storage.provider.ts           (factory: selects impl by NODE_ENV)
  ├── question/
  │   ├── dto/submit-question.dto.ts    (+ image field)
  │   └── question.service.ts           (save image URLs from storage service)
  ├── admin/
  │   ├── admin-config/                 (seed max_image_size_mb default)
  │   └── admin.controller.ts           (ensure config CRUD covers new key)
  ├── common/
  │   └── enums.ts                      (+ MediaType.image if not present)
  └── database/migrations/
        └── <timestamp>-AddImageMaxSizeConfig.ts

Mobile
  ├── screens/Question/QuestionScreen.tsx
  │     (add image picker, preview, upload before submit)
  ├── utils/media.ts
  │     (image compression + size-check helper)
  └── api/client.ts
        (uploadImage utility + wire into questionApi)

Web
  ├── pages/settings/SettingsPage.tsx
  │     (+ max_image_size_mb card)
  └── types/index.ts
        (+ ConfigItem type coverage)
```

---

## Sub-Tasks

### 1. Backend: Storage Module
- [ ] `storage/` directory with `storage.module.ts`
- [ ] `StorageService` abstract base class (interface-style: `upload(file, folder) → string URL`)
- [ ] `MockStorageService` — `NODE_ENV !== 'production'`; stores `Buffer` in a `Map<string, Buffer>` keyed by path; returns `http://localhost:3000/static/{path}` URLs; implements `delete(path)` (no-op in mock)
- [ ] `GcpStorageService` — `NODE_ENV === 'production'`; uses `@google-cloud/storage`; uploads with `Storage` client; bucket name from `GCP_BUCKET_NAME` env var; Nearline set via storage class metadata; returns public URL; implements `delete(path)` via bucket file deletion
- [ ] `storage.provider.ts` — `Provider<StorageService>` that returns `MockStorageService` or `GcpStorageService` based on `process.env.NODE_ENV`
- [ ] Add `@google-cloud/storage` to `backend/package.json` (dev dependency, only loaded in prod path)

### 2. Backend: Configuration
- [ ] Add to `backend/.env`:
  ```
  GCP_PROJECT_ID=your-gcp-project-id
  GCP_BUCKET_NAME=your-bucket-nearline
  GCP_KEY_FILE=                      # path to service account JSON; omit for ADC
  ```
- [ ] Add `gcpStorageConfig` to `backend/src/config/configuration.ts`
- [ ] `StorageModule` imported globally in `AppModule`

### 3. Backend: Admin Config Seed
- [ ] Seed `max_image_size_mb` in the existing `AdminConfig` table (seed script or migration default: `5` MB)
- [ ] Admin can read/write this key just like other config values (existing CRUD already handles arbitrary keys)

### 4. Backend: Question Submission — Image Support
- [ ] `SubmitQuestionDto` (in `question/dto/submit-question.dto.ts`):
  - Rename/extend `mediaType` enum to include `'image'` (already has `'image'` via `'none' | 'image' | 'video' | 'audio'`)
  - Add optional `imageFile?: MultipartFile` field OR change `mediaUrls` to allow pre-uploaded URL (decide: client uploads image first → gets URL → submits question with URL)
  - **Decision: Two-step — client uploads image to `/storage/upload` first, gets back a URL string, then submits question with `mediaType: 'image'` and `mediaUrls: [url]` — same pattern as audio)
- [ ] New endpoint `POST /storage/upload` (in `storage.controller.ts`):
  - Accepts `multipart/form-data` with field `file`
  - Validates file type is image (`image/jpeg`, `image/png`, `image/webp`)
  - Validates file size against `max_image_size_mb` config (fetched from DB at startup, refreshed every 5 min)
  - Calls `storageService.upload(file, 'questions/images')`
  - Returns `{ url: string; sizeBytes: number }`
- [ ] `QuestionService.submit()`: when `mediaType === 'image'`, validate at least one `mediaUrls` entry exists

### 5. Backend: DB Migration
- [ ] Migration to insert default `max_image_size_mb = 5` into `admin_config` if not exists

### 6. Mobile: Image Picker UI
- [ ] In `QuestionScreen.tsx`:
  - Add an **"Add Image" button** (camera roll icon) above the text area
  - On tap: invoke `*ImagePicker.*launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })`
  - Show thumbnail preview of selected image with a remove (×) button
  - Before upload: check file size against `max_image_size_mb` fetched from `questionApi.getStats()` (add `maxImageSizeMb` to the stats response)
  - If over limit: show toast error `"Image must be smaller than X MB"`
  - On valid selection: upload via `storageApi.uploadImage(uri, filename)` (see below) before allowing submit
  - Show upload progress indicator on the thumbnail
  - Store uploaded URL in state; include in `preview()` and `submit()` payloads as `mediaUrls`
- [ ] `utils/media.ts`:
  - `compressImage(uri, maxWidthPx = 1280): Promise<string>` — resize and re-encode as JPEG to reduce size
  - `getImageSizeMB(uri): Promise<number>` — read file metadata

### 7. Mobile: API Client
- [ ] In `api/client.ts`:
  - `storageApi.uploadImage(uri, filename)` — multipart POST to `/storage/upload`; returns `{ url: string }`
  - Extend `questionApi.getStats()` response to include `maxImageSizeMb: number`
  - When calling `questionApi.preview()` / `questionApi.submit()`, include `mediaType: 'image'` and `mediaUrls: [uploadedUrl]` when an image is attached

### 8. Web: Admin Settings
- [ ] `pages/settings/SettingsPage.tsx`:
  - Add `max_image_size_mb` to `CONFIG_META`: `{ label: 'Max Image Size', suffix: ' MB' }`
  - Already handled by the generic config loop (no extra work if key is in DB)

### 9. Question Preview Screen (Mobile)
- [ ] `QuestionPreviewScreen.tsx` should display the attached image thumbnail when `mediaType === 'image'`

---

## API Contracts

### `POST /storage/upload`
**Auth:** JWT required  
**Content-Type:** `multipart/form-data`  
**Body:** `file` — image file  

**Response 200:**
```json
{ "url": "https://storage.googleapis.com/bucket/questions/images/uuid.jpg", "sizeBytes": 1234567 }
```

**Error 413:** `{ message: "Image exceeds maximum allowed size of X MB" }`  
**Error 400:** `{ message: "Only JPEG, PNG and WEBP images are supported" }`

### `GET /questions/stats/me`
**Response:**
```json
{
  "dailyCount": 3,
  "remainingToday": 17,
  "dailyLimit": 20,
  "maxQuestionChars": 1000,
  "maxImageSizeMb": 5
}
```

---

## Environment Behaviour

| `NODE_ENV` | Storage Service | Notes |
|---|---|---|
| `development` | `MockStorageService` | In-memory Map; serves uploaded bytes via `GET /static/{path}` static route |
| `production` | `GcpStorageService` | Real GCP Nearline bucket; public URLs returned |

---

## Validation Rules

| Field | Rule |
|---|---|
| Image type | Only `image/jpeg`, `image/png`, `image/webp` accepted |
| Image size | Must be ≤ `max_image_size_mb` MB (admin-configurable, default 5 MB) |
| Count | Max 1 image per question submission |
| `mediaUrls` with image | Must contain exactly 1 URL returned by `/storage/upload` |

---

## Notes

- The existing `mediaType` field already supports `'image'` — no schema change needed for `questions` table
- The static file serving for mock storage can reuse the existing `ServeStaticModule` or a simple Express static route
- GCP credentials: prefer Application Default Credentials (ADC) in production; `GCP_KEY_FILE` env var is optional override
- `max_image_size_mb` is fetched from DB at app startup and cached; a background refresh every 5 minutes avoids a DB hit per request
- Image compression on mobile (`compressImage`) reduces JPEG quality to 0.8 and max dimension to 1280px before upload, giving a soft cap well under the 5 MB default
# API Reference

## Project
Agriculture Knowledge Collection Platform

---

## Base URL

```
https://api.<domain>/v1
```

All endpoints require `Authorization: Bearer <accessToken>` unless marked **Public**.  
All request bodies are `application/json` unless noted.  
All responses are `application/json` unless noted.

---

## Authentication

**OTP Flow (mobile users):**

```
POST /auth/request-otp   → sends OTP to mobile number
POST /auth/verify-otp    → returns { accessToken, refreshToken, isRegistered }
POST /auth/register      → (first time) completes registration
POST /auth/refresh       → refresh access token
```

**Web/admin sessions:** issued a JWT on first successful `verify-otp` or `login`.  
Every subsequent login increments `users.token_version`, invalidating all prior tokens immediately.

**Roles:**

| Role | Description |
|---|---|
| `user` | Mobile app end user |
| `curator` | Read-only question review queue access |
| `finance` | User management + withdrawals + payout processing |
| `admin` | Full review + config + fraud + analytics |
| `super_admin` | Everything + wallet adjustment + unsuspend |

**Guard shorthand used in this doc:**

| Guard | Meaning |
|---|---|
| JWT | Requires valid access token |
| Roles | Requires one of the listed roles |

---

## 1. Auth Module — `/auth`

### `POST /auth/request-otp` — Public

Request OTP for a mobile number.

**Rate limit:** 3 requests per 15 minutes per mobile number.

```
{
  "mobileNumber": "9876543210"
}
```

**Response `200`:**
```
{ "message": "OTP sent successfully", "mobileNumber": "9876543210" }
```

---

### `POST /auth/verify-otp` — Public

Verify the OTP and receive auth tokens.

```
{
  "mobileNumber": "9876543210",
  "otp": "123456"
}
```

**Response `200`:**
```
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "isRegistered": true | false,
  "user": {               // included when isRegistered = true
    "id": "uuid",
    "mobileNumber": "9876543210",
    "name": "...",
    "role": "user"
  }
}
```

If `isRegistered = false`, the returned `accessToken` is a **short-lived registration token** — use it to call `POST /auth/register`.

---

### `POST /auth/register` — Public

Complete registration for a new user. Requires the registration token from `verify-otp`.

```
{
  "mobileNumber": "9876543210",
  "name": "Ramesh Kumar",
  "category": "farmer",              // farmer | fpo | student | volunteer | ngo
  "state": "Maharashtra",
  "district": "Pune",
  "languagePreference": "mr",        // ISO 639-1 language code
  "consentGiven": true,
  "profileData": { ... }             // category-specific fields
}
```

**Response `201`:**
```
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "id": "uuid", "mobileNumber": "...", ... }
}
```

---

### `POST /auth/refresh`

Exchange a refresh token for a new access token.

```
{ "refreshToken": "<jwt>" }
```

**Response `200`:**
```
{ "accessToken": "<jwt>", "refreshToken": "<jwt>" }
```

---

### `GET /auth/me` — JWT

Returns the authenticated user's public profile.

**Response `200`:**
```
{
  "user": {
    "id": "uuid",
    "mobileNumber": "9876543210",
    "name": "...",
    "role": "user",
    "category": "farmer",
    "state": "Maharashtra",
    "district": "Pune",
    "block": "...",
    "village": "...",
    "verificationStatus": "verified",
    "age": 35,
    "gender": "male",
    "farmSize": "2.5 acres",
    "crops": ["wheat", "soybean"],
    ...
  }
}
```

---

### `POST /auth/logout` — JWT

Invalidates the current session by incrementing `token_version`.

**Response `200`:**
```
{ "message": "Logged out successfully" }
```

---

## 2. User Module — `/users`

All endpoints require JWT.

### `GET /users/me` — JWT

Returns the authenticated user's full profile. Identical to `GET /auth/me`.

---

### `PATCH /users/me` — JWT

Update editable profile fields.

```
{
  "name": "Ramesh Kumar",
  "state": "Maharashtra",
  "district": "Nashik",
  "block": " Sinnar",
  "village": "...",
  "languagePreference": "mr",
  "farmSize": "3 acres",
  "cropType": "wheat",
  "organisationType": "FPC",
  "organizationName": "...",
  "organizationRole": "...",
  "organizationState": "...",
  "organizationDistrict": "...",
  "organizationBlock": "...",
  "organizationVillage": "..."
}
```

**Response `200`:** `{ "user": { ... } }`

---

### `GET /users/me/leaderboard` — JWT

Returns top users ranked by total earnings, with the caller's rank.

**Query params:** `limit` (default 10), `offset` (default 0)

**Response `200`:**
```
{
  "items": [
    { "userId": "uuid", "name": "...", "totalEarnings": 5000, "rank": 1 },
    ...
  ],
  "total": 1500,
  "limit": 10,
  "offset": 0,
  "userRank": { "rank": 42, "totalEarnings": 320 }
}
```

---

### `PATCH /users/me/crops` — JWT

Replace the user's crop list (full upsert).

```
{ "crops": ["wheat", "paddy", "soybean"] }
```

**Response `200`:** `{ "crops": ["wheat", "paddy", "soybean"] }`

---

### `GET /users/me/notifications` — JWT

Paginated notification list.

**Query params:** `page` (default 1), `limit` (default 20)

**Response `200`:**
```
{
  "items": [
    {
      "id": "uuid",
      "type": "question_approved",
      "title": "Question Approved",
      "body": "Your question has been approved! Rs.5 credited.",
      "data": { "questionId": "uuid", "amount": 5 },
      "read": false,
      "createdAt": "2026-06-29T..."
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "pages": 1,
  "unreadCount": 3
}
```

---

### `PATCH /users/me/notifications/read-all` — JWT

Mark all unread notifications as read.

**Response `200`:** `{ "success": true }`

---

### `PATCH /users/me/notifications/:id/read` — JWT

Mark a single notification as read.

**Response `200`:** `{ "success": true }`

---

## 3. Question Module — `/questions`

All endpoints require JWT.

### `POST /questions` — JWT

Submit a new question.

```
{
  "language": "mr",
  "domains": ["crop_protection", "irrigation"],
  "season": "kharif",
  "cropType": "soybean",
  "questionText": "मला सोयाबीन पिकात पांढरा विषाणू आल्यास काय करावे?",
  "mediaType": "none",                // none | image | video | audio
  "mediaUrls": ["https://storage...jpg"],
  "deviceInfo": { "model": "...", "os": "Android 14" }
}
```

**Validation rules:**
- `mediaUrls` required when `mediaType = image`
- `questionText` max 1000 chars (configurable)
- `deviceInfo` optional, stored as JSONB

**Response `201`:**
```
{
  "id": "uuid",
  "status": "PENDING",
  "submittedAt": "2026-06-29T...",
  "editWindowClosesAt": "2026-06-29T...+30s"
}
```

---

### `POST /questions/preview` — JWT

Validate and enrich a question without writing to the database. Used by the mobile app to show users a preview before submission.

```
{ same shape as POST /questions }
```

**Response `200`:**
```
{
  "valid": true,
  "cropType": "soybean",
  "domains": ["crop_protection"],
  "season": "kharif",
  "agroClimaticZone": "Western Plateau and Hills",
  "message": null
}
```

---

### `GET /questions` — JWT

List questions. Admin/curator/super_admin see all; regular users see only their own.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status |
| `language` | string | Filter by language code |
| `state` | string | Filter by state |
| `district` | string | Filter by district |
| `cropType` | string | Filter by crop |
| `domains` | string[] | Filter by domains (comma-separated) |
| `search` | string | Full-text search on `questionText` |
| `startDate` | ISO date | From date |
| `endDate` | ISO date | To date |
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |
| `sortBy` | string | `submittedAt` (default), `createdAt` |
| `sortOrder` | `ASC` \| `DESC` | Default DESC |

**Response `200`:**
```
{
  "items": [{ "id": "uuid", "questionText": "...", "status": "PENDING", ... }],
  "total": 342,
  "page": 1,
  "limit": 20,
  "pages": 18
}
```

---

### `GET /questions/:id` — JWT

Get a single question. Users can only fetch their own.

---

### `PATCH /questions/:id` — JWT

Update question text within the edit window (30 seconds after submission).

```
{ "questionText": "Updated question text..." }
```

**Response `200`:** Updated question object.

---

### `GET /questions/stats/me` — JWT

Returns the user's daily submission count and remaining quota.

**Response `200`:**
```
{
  "dailyCount": 3,
  "remainingToday": 17,
  "dailyLimit": 20,
  "editWindowSeconds": 30,
  "maxQuestionChars": 1000
}
```

---

### `POST /questions/:id/approve` — JWT + Roles(`admin`, `super_admin`)

Approve a question and credit the reward to the user's wallet.

**Body:** `{ "reason": "Agriculturally relevant and clear" }` (optional)

**Response `200`:**
```
{ "success": true, "rewarded": 5, "newBalance": 45 }
```

---

### `POST /questions/:id/reject` — JWT + Roles(`admin`, `super_admin`)

Reject a question.

**Body:** `{ "reason": "Not related to agriculture" }` (required)

**Response `200`:**
```
{ "success": true }
```

---

## 4. Wallet Module — `/wallets`

All endpoints require JWT.

### `GET /wallets/me` — JWT

Get the user's current wallet balance.

**Response `200`:**
```
{ "balance": "125.00", "currency": "INR", "userId": "uuid" }
```

---

### `GET /wallets/me/tier` — JWT

Get the user's current reward tier. The client provides the `approvedCount` (from its own tally).

**Query params:** `approvedCount` (integer, required)

**Response `200`:**
```
{
  "tier": 2,
  "rewardPerQuestion": 5,
  "nextTierAt": 251,
  "maxApproved": 250
}
```

**Reward tiers:**

| Tier | Approved count range | Reward per question |
|---|---|---|
| 1 | 1 – 25 | ₹1 |
| 2 | 26 – 250 | ₹5 |
| 3 | 251+ | ₹10 |

---

### `GET /wallets/me/config` — JWT

Returns wallet configuration needed by the mobile SDK.

**Response `200`:**
```
{ "razorpayKeyId": "rzp_test_...", "minWithdrawalAmount": 50 }
```

---

### `GET /wallets/me/transactions` — JWT

Paginated transaction history.

**Query params:** `page`, `limit`

**Response `200`:**
```
{
  "items": [
    {
      "id": "uuid",
      "type": "credit",
      "source": "reward",
      "amount": "5.00",
      "balanceAfter": "15.00",
      "referenceId": "question-uuid",
      "description": "Reward for approved question",
      "status": "completed",
      "createdAt": "2026-06-29T..."
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

---

### `POST /wallets/withdraw` — JWT

Request a withdrawal.

```
{
  "amount": 100,
  "payoutMethod": "upi",          // upi | bank_transfer
  "paymentDetailId": "uuid"       // must reference a verified payment detail
}
```

**Preconditions:**
- Balance ≥ amount
- Amount ≥ `min_withdrawal_amount` (default ₹50)
- No other pending/processing withdrawal for this user
- `paymentDetailId` must exist and have `status = verified`

**Response `201`:**
```
{
  "withdrawal": {
    "id": "uuid",
    "amount": "100.00",
    "status": "PENDING",
    "payoutMethod": "upi",
    ...
  },
  "transaction": { ... }
}
```

---

### `GET /wallets/me/withdrawals` — JWT

Paginated list of the user's own withdrawal requests.

---

### `GET /wallets/withdrawals/:id` — JWT

Get a specific withdrawal request (own only).

---

### `DELETE /wallets/withdrawals/:id` — JWT

Cancel a pending withdrawal (only if status = `PENDING`).

**Response `200`:**
```
{ "success": true }
```

---

### `POST /wallets/payment-details` — JWT

Add a new payment detail and initiate verification.

**UPI:**
```
{
  "payoutMethod": "upi",
  "upiId": "user@upi"
}
```

**Bank Transfer:**
```
{
  "payoutMethod": "bank_transfer",
  "accountNumber": "1234567890123",
  "ifsc": "SBIN0001234",
  "accountHolderName": "Ramesh Kumar"
}
```

Sensitive fields (full account number, IFSC, holder name) are stored **encrypted** (AES-256-GCM). Only the last 4 digits of the account number and a plain-text display IFSC are stored in plaintext.

**Response `201`:**
```
{
  "id": "uuid",
  "payoutMethod": "upi",
  "status": "in_progress",
  ...
}
```

Verification status updates asynchronously via Razorpay webhook (`fund_account.validated` / `fund_account.validation_failed`).

---

### `GET /wallets/payment-details` — JWT

List the user's payment details (masked — no sensitive data).

**Response `200`:**
```
{
  "items": [
    {
      "id": "uuid",
      "payoutMethod": "upi",
      "upiId": "us***@upi",
      "status": "verified",
      ...
    }
  ]
}
```

---

### `DELETE /wallets/payment-details/:id` — JWT

Delete a non-verified payment detail.

**Response `200`:** `{ "success": true }`

---

### `POST /wallets/payment-details/:id/auto-verify` — JWT

Dev-only: instantly mark a payment detail as verified (skips micro-transaction). Only works when `PINELABS_MOCK_VERIFICATION=true` on the server.

**Response `200`:**
```
{ "success": true, "status": "verified" }
```

---

## 5. Admin Module — `/admin`

All endpoints require JWT + roles as noted.

### 5.1 Users

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/users` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/users` | `finance`, `admin`, `super_admin` |
| `GET` | `/admin/users/:id` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/users/:id/suspend` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/users/:id/unsuspend` | `super_admin` |
| `POST` | `/admin/users/:id/verify` | `finance`, `admin`, `super_admin` |

**`POST /admin/users` — Create user (admin creates account without OTP)**

```
{
  "mobileNumber": "9876543210",
  "name": "...",
  "category": "farmer",
  "state": "Maharashtra",
  "district": "Pune",
  "role": "user",
  "verificationStatus": "verified"
}
```

**`POST /admin/users/:id/suspend`**

```
{ "action": "suspend", "reason": "Suspicious activity", "suspendedUntil": "2026-07-01T00:00:00Z" }
{ "action": "ban", "reason": "Repeated policy violations" }
```

**Query params for `GET /admin/users`:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Name or mobile number |
| `state` | string | Filter by state |
| `category` | string | Filter by category |
| `verificationStatus` | string | Filter by status |
| `role` | string | Filter by role |
| `page` | number | Default 1 |
| `limit` | number | Default 20 |
| `sortBy` | string | `createdAt` (default) |
| `sortOrder` | `ASC` \| `DESC` | Default DESC |

---

### 5.2 Questions

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/questions/queue` | `curator`, `finance`, `admin`, `super_admin` |
| `GET` | `/admin/questions/:id` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/questions/:id/review` | `curator`, `admin`, `super_admin` |
| `GET` | `/admin/questions/metrics` | `curator`, `finance`, `admin`, `super_admin` |

**`GET /admin/questions/queue`** — Human review queue (questions with `status = HUMAN_REVIEW`)

**Query params:** `language`, `state`, `cropType`, `domains`, `search`, `page`, `limit`, `sortBy`, `sortOrder`

**`POST /admin/questions/:id/review`**

```
{ "action": "approve", "reason": "Valid agriculture question" }
{ "action": "reject", "reason": "Not relevant to agriculture" }
{ "action": "hold", "reason": "Needs more information" }
```

- `approve` → credits reward to user, status → `APPROVED`
- `reject` → no reward, status → `REJECTED`, notification to user
- `hold` → status stays `HUMAN_REVIEW`, `heldReason` set

---

### 5.3 Configuration

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/config` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/config` | `finance`, `admin`, `super_admin` |
| `PATCH` | `/admin/config` | `finance`, `admin`, `super_admin` |

**`POST /admin/config`**

```
{ "key": "min_withdrawal_amount", "value": 100, "description": "Updated minimum" }
```

**`PATCH /admin/config`**

```
{ "key": "min_withdrawal_amount", "value": 100 }
```

---

### 5.4 Analytics

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/stats` | `curator`, `finance`, `admin`, `super_admin` |
| `GET` | `/admin/analytics/dashboard` | `curator`, `finance`, `admin`, `super_admin` |
| `GET` | `/admin/analytics/rewards` | `curator`, `admin`, `super_admin` |
| `GET` | `/admin/analytics/reward-logs` | `curator`, `admin`, `super_admin` |
| `GET` | `/admin/analytics/financial-summary` | `finance`, `admin`, `super_admin` |

**Query params (all analytics):** `startDate`, `endDate`, `state`

---

### 5.5 Fraud

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/fraud` | `finance`, `admin`, `super_admin` |

Returns fraud/violation statistics aggregated by user.

---

### 5.6 Wallets

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/wallets` | `finance`, `admin`, `super_admin` |
| `GET` | `/admin/wallets/user/:userId` | `finance`, `admin`, `super_admin` |
| `GET` | `/admin/wallets/user/:userId/transactions` | `finance`, `admin`, `super_admin` |
| `GET` | `/admin/wallets/user/:userId/withdrawals` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/wallets/adjust` | `super_admin` only |

**`POST /admin/wallets/adjust`**

```
{
  "userId": "uuid",
  "amount": 500,
  "type": "credit",        // credit | debit
  "reason": "Manual correction for missing reward"
}
```

Creates a transaction with `source = adjustment`.

---

### 5.7 Withdrawals

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/withdrawals` | `finance`, `admin`, `super_admin` |
| `GET` | `/admin/withdrawals/:id` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/withdrawals/:id/process` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/withdrawals/:id/retry` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/withdrawals/:id/retry-refund` | `finance`, `admin`, `super_admin` |
| `POST` | `/admin/withdrawals/:id/fail` | `finance`, `admin`, `super_admin` |
| `PATCH` | `/admin/withdrawals/:id/failure-reason` | `finance`, `admin`, `super_admin` |

**`GET /admin/withdrawals` — Query params:**

| Param | Type | Description |
|---|---|---|
| `status` | `PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED` \| `CANCELLED` | |
| `payoutMethod` | `upi` \| `bank_transfer` | |
| `startDate` | ISO date | |
| `endDate` | ISO date | |
| `search` | string | User name or mobile |
| `page` | number | |
| `limit` | number | |
| `sortBy` | `createdAt` | |
| `sortOrder` | `DESC` | |

**`POST /admin/withdrawals/:id/process`** — Approve and initiate payout.

```
{ "action": "approve" }
{ "action": "reject", "reason": "Account closed" }
```

**`POST /admin/withdrawals/:id/fail`**

```
{ "reason": "Bank account closed by customer" }
```

Marks PROCESSING withdrawal as FAILED and issues a refund to wallet.

---

### 5.8 Export

| Method | Path | Roles |
|---|---|---|
| `GET` | `/admin/export` | `finance`, `admin`, `super_admin` |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `dataType` | `users` \| `questions` \| `transactions` \| `withdrawals` | Required |
| `format` | `csv` \| `excel` | Default `csv` |
| `startDate` | ISO date | |
| `endDate` | ISO date | |
| `state` | string | |
| `status` | string | |

---

## 6. Analytics Module — `/analytics`

All require JWT + roles(`curator`, `finance`, `admin`, `super_admin`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/analytics/dashboard` | All dashboard stats + chart data |
| `GET` | `/analytics/users` | DAU, MAU, retention |
| `GET` | `/analytics/questions` | Volume by state, crop, domain |
| `GET` | `/analytics/rewards` | Reward totals and payout breakdown |

---

## 7. Export Module — `/export`

All require JWT + roles(`admin`, `super_admin`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/export/csv` | CSV export |
| `GET` | `/export/excel` | XLSX export |

**Query params:** same as `/admin/export` — `dataType`, `format`, `startDate`, `endDate`, `state`, `status`

---

## 8. Audit Logs — `/admin/audit-logs`

All require JWT.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/audit-logs` | Query audit logs with filters |
| `GET` | `/admin/audit-logs/stats` | Actor statistics |
| `GET` | `/admin/audit-logs/summary` | Summary with granularity |
| `GET` | `/admin/audit-logs/entity/:entityType/:entityId` | History of a specific entity |
| `GET` | `/admin/audit-logs/users-by-role` | List users by role (for filter dropdown) |

**`GET /admin/audit-logs` — Query params:**

| Param | Type | Description |
|---|---|---|
| `actorType` | `admin` \| `user` \| `system` | |
| `action` | string | e.g. `USER_LOGIN`, `QUESTION_APPROVED` |
| `entityType` | string | e.g. `question`, `user`, `wallet` |
| `startDate` | ISO date | |
| `endDate` | ISO date | |
| `page` | number | |
| `limit` | number | |

---

## 9. Speech Module — `/speech`

Requires JWT.

| Method | Path | Description |
|---|---|---|
| `POST` | `/speech/transcribe-chunk` | Stream audio chunk to Sarvam for rolling transcription |
| `POST` | `/speech/transcribe-final` | Final transcription when user stops recording |
| `POST` | `/speech/translate` | Translate text between Indian languages |

**`POST /speech/transcribe-chunk` — `multipart/form-data`**

| Field | Type | Description |
|---|---|---|
| `audio` | file | Audio file (MP4, MPEG, WEBM, OGG, AAC) |
| `languageCode` | string | Sarvam language code (e.g. `hi-IN`) |
| `sequenceNumber` | number | Chunk index for ordering |

**Response `200`:**
```
{ "sequenceNumber": 0, "text": "पूर्ण वाक्य", "error": null }
```

**`POST /speech/translate`**

```
{
  "text": "How to control pests in soybean?",
  "targetLanguage": "hi-IN",
  "sourceLanguage": "en-IN"       // optional, defaults to en-IN
}
```

Supported `targetLanguage` codes: `as-IN`, `bn-IN`, `brx-IN`, `doi-IN`, `gu-IN`, `hi-IN`, `kn-IN`, `ks-IN`, `kok-IN`, `mai-IN`, `ml-IN`, `mni-IN`, `mr-IN`, `ne-IN`, `or-IN`, `pa-IN`, `sa-IN`, `sat-IN`, `sd-IN`, `ta-IN`, `te-IN`, `ur-IN`, `en-IN`

---

## 10. LGD Module — `/lgd`

Public — no authentication required.

| Method | Path | Description |
|---|---|---|
| `GET` | `/lgd/states` | All Indian states |
| `GET` | `/lgd/districts?stateCode=...` | Districts for a state |
| `GET` | `/lgd/subdistricts?districtCode=...` | Subdistricts (blocks) for a district |
| `GET` | `/lgd/villages?blockCode=...` | Villages for a subdistrict |

**Response shape:**
```
{ "states": [{ "code": "27", "name": "Maharashtra" }, ...] }
```

---

## 11. Storage Module — `/storage`

Requires JWT.

| Method | Path | Content-Type | Description |
|---|---|---|---|
| `POST` | `/storage/upload` | `multipart/form-data` | Upload image (JPEG/PNG/WEBP) |
| `POST` | `/storage/upload/audio` | `multipart/form-data` | Upload audio recording |

**Upload limits:**

| Type | Max size | Default |
|---|---|---|
| Image | `max_image_size_mb` config | 5 MB |
| Audio | `max_audio_size_mb` config or env | 10 MB |

**Response `200`:**
```
{ "url": "https://storage.googleapis.com/...", "sizeBytes": 204800 }
```

---

## 12. Payment Webhooks

All are **Public** (signature-verified).

| Method | Path | Provider | Trigger |
|---|---|---|---|
| `POST` | `/payment/pinelabs-webhook` | PineLabs | Payment status update |
| `POST` | `/payment/razorpay-webhook` | Razorpay | Payout status, fund account validation |

**Razorpay webhook events handled:**
- `payout.processed` — marks withdrawal `COMPLETED`, saves UTR
- `payout.failed` — marks withdrawal `FAILED`, triggers refund
- `payout.reversed` — marks withdrawal `FAILED`, credits refund to wallet
- `fund_account.validated` — marks `UserPaymentDetail` `verified`
- `fund_account.validation_failed` — marks `UserPaymentDetail` `failed`

---

## 13. Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Liveness probe |
| `GET` | `/health/ready` | Public | Readiness probe (checks DB + Redis) |

---

## Common Error Responses

| Status | Meaning |
|---|---|
| `400` | Validation error — response includes field-level error messages |
| `401` | Missing or invalid JWT |
| `403` | Valid JWT but insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate mobile number) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

*Last Updated: 2026-06-30*
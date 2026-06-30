# Database Design Document

## Project
Agriculture Knowledge Collection Platform

---

# 1. Database Overview

All tables reside in a single **PostgreSQL 15** instance, managed by **TypeORM** in the NestJS backend. The database also stores semantic vectors (float8[]) in the `questions` table for duplicate detection.

| Schema / Table | Purpose |
|---|---|
| `users` | User profiles, authentication, roles, verification |
| `questions` | Question submissions, AI metadata, embeddings, review state |
| `wallets` | Per-user reward balance |
| `transactions` | Financial ledger (reward, withdrawal, refund, adjustment) |
| `withdrawal_requests` | Withdrawal records with payout tracking |
| `payment_logs` | Per-attempt payment processor log (PineLabs + Razorpay) |
| `user_payment_details` | UPI/bank payout details with Razorpay fund account state |
| `notifications` | In-app notification events |
| `audit_logs` | Immutable audit trail for all key system events |
| `admin_config` | Runtime configuration key/value store |

> **Tables not yet created** (as of 2026-06-30): `knowledge_repository`, `user_violations`, `daily_question_stats`, `reward_tier_summary`, `user_crop_details`. The knowledge repository use case is served directly from the `questions` table (filtered by `status = 'APPROVED'`). Fraud tracking and analytics are handled via `audit_logs` and direct queries.

---

# 2. Schema Definitions

## 2.1 Users Schema

**Table: `users`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Unique user identifier |
| `mobile_number` | VARCHAR(15) | UNIQUE, NOT NULL | Login identifier |
| `name` | VARCHAR(255) | NOT NULL | Full name |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'user' | `user`, `curator`, `finance`, `admin`, `super_admin` |
| `category` | VARCHAR(20) | | `farmer`, `fpo`, `student`, `volunteer`, `ngo` |
| `organisation_type` | VARCHAR(200) | | FPO/NGO sub-type (e.g., "FPC", "Society", "Trust") |
| `state` | VARCHAR(100) | NOT NULL | Registration state |
| `district` | VARCHAR(100) | NOT NULL | Registration district |
| `block` | VARCHAR(100) | | Block |
| `village` | VARCHAR(100) | | Village |
| `kvk` | VARCHAR(500) | | KVK (Krishi Vigyan Kendra) affiliation |
| `language_preference` | VARCHAR(50) | NOT NULL | Selected app language (e.g., `hi`, `ta`, `bn`) |
| `token_version` | INTEGER | DEFAULT 0 | Auto-incremented on each login; invalidates all prior refresh tokens |
| `otp_hash` | VARCHAR(255) | | bcrypt hash of the current OTP |
| `otp_expires_at` | TIMESTAMP | | OTP expiry time |
| `verification_status` | VARCHAR(30) | DEFAULT 'pending' | `pending`, `manual_review`, `verified`, `suspended`, `banned` |
| `suspended_at` | TIMESTAMP | | When suspension was applied |
| `suspended_until` | TIMESTAMP | | Suspension end time (null = indefinite) |
| `suspended_reason` | VARCHAR(500) | | Reason for suspension |
| `banned_at` | TIMESTAMP | | When ban was applied |
| `banned_reason` | VARCHAR(500) | | Reason for permanent ban |
| `profile_data` | JSONB | | Category-specific flexible fields |
| `age` | INTEGER | | User age |
| `gender` | VARCHAR(50) | | User gender |
| `farm_size` | VARCHAR(100) | | Farm size in acres (farmer only) |
| `season` | VARCHAR(50) | | Primary farming season (farmer/volunteer) |
| `crop_type` | VARCHAR(200) | | Primary crop (farmer/volunteer) |
| `course_name` | VARCHAR(255) | | Student course name |
| `college_name` | VARCHAR(255) | | Student college name |
| `university_name` | VARCHAR(255) | | Student university name |
| `organization_name` | VARCHAR(255) | | Org name (fpo/ngo/volunteer) |
| `organization_role` | VARCHAR(255) | | Role within org (fpo/ngo/volunteer) |
| `number_of_farmers` | INTEGER | | Farmers under FPO/NGO |
| `organization_state` | VARCHAR(100) | | Org address state |
| `organization_district` | VARCHAR(100) | | Org address district |
| `organization_block` | VARCHAR(100) | | Org address block |
| `organization_village` | VARCHAR(100) | | Org address village |
| `crops` | TEXT[] | DEFAULT '{}' | Array of crop names selected by user |
| `razorpay_contact_id` | VARCHAR(100) | | Razorpay Contact ID for this user |
| `expo_push_token` | VARCHAR(255) | | Expo push token for mobile notifications |
| `consent_given` | BOOLEAN | DEFAULT FALSE | Privacy consent flag |
| `consent_timestamp` | TIMESTAMP | | When consent was given |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |
| `last_login_at` | TIMESTAMP | | |

**Indexes:**
- `idx_users_mobile` on `mobile_number` (unique)
- `idx_users_role` on `role`
- `idx_users_state` on `state`
- `idx_users_category` on `category`
- `idx_users_verification_status` on `verification_status`
- `idx_users_organisation_type` on `organisation_type`

**Relationships:**
- OneToOne → `wallets`
- OneToMany → `questions`
- OneToMany → `withdrawal_requests`
- OneToMany → `notifications`

---

## 2.2 Questions Schema

**Table: `questions`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id | Submitting user |
| `language` | VARCHAR(50) | DEFAULT 'en' | Question language code |
| `domains` | VARCHAR(50)[] | DEFAULT '{}' | Array of agriculture domain codes (e.g., `["crop_protection", "irrigation"]`) |
| `season` | VARCHAR(50) | NOT NULL | `kharif`, `rabi`, `zaid`, `year_round` |
| `crop_type` | VARCHAR(255) | NOT NULL | |
| `agro_climatic_zone` | VARCHAR(255) | | |
| `state` | VARCHAR(100) | NOT NULL | |
| `district` | VARCHAR(100) | NOT NULL | |
| `block` | VARCHAR(100) | | |
| `question_text` | TEXT | NOT NULL | |
| `embedding` | FLOAT8[] | | Vector embedding of question text produced by the on-premise embedding service; stored at submit time; returned to GDB as part of the similarity check payload |
| `media_type` | VARCHAR(10) | DEFAULT 'none' | `none`, `image`, `video`, `audio` |
| `media_urls` | JSONB | | Array of GCP Cloud Storage URLs |
| `device_info` | JSONB | | Device model, OS version, app version |
| `status` | VARCHAR(20) | DEFAULT 'PENDING' | `PENDING`, `AI_REVIEW`, `HUMAN_REVIEW`, `APPROVED`, `REJECTED` |
| `duplicate_flag` | BOOLEAN | DEFAULT FALSE | Set by GDB when semantic duplicate found |
| `duplicate_of_id` | UUID | FK → questions.id | Reference to the duplicate source question |
| `edit_window_closes_at` | TIMESTAMP | | 30-second edit window after submission |
| `submitted_at` | TIMESTAMP | NOT NULL | |
| `reviewed_at` | TIMESTAMP | | When admin/curator reviewed |
| `reviewer_id` | UUID | FK → users.id | Admin/curator who reviewed |
| `rejection_reason` | VARCHAR(500) | | Admin-supplied rejection reason |
| `held_reason` | VARCHAR(500) | | Reason question was placed on hold |
| `approval_reason` | VARCHAR(500) | | LLM-generated or admin approval note |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

> **Note:** `status = 'HUMAN_REVIEW'` collects all questions that passed Gemma inference (confidence ≥ 0.9) but need curator decision — either because the GDB flagged a potential duplicate, or because they were manually escalated.

**Indexes:**
- `idx_questions_user_id` on `user_id`
- `idx_questions_status` on `status`
- `idx_questions_state` on `state`
- `idx_questions_crop_type` on `crop_type`
- `idx_questions_language` on `language`
- `idx_questions_domains` on `domains` (GIN)
- `idx_questions_submitted_at` on `submitted_at`
- `idx_questions_duplicate_of` on `duplicate_of_id`

---

## 2.3 Wallet Schema

**Table: `wallets`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id, UNIQUE | One wallet per user |
| `balance` | DECIMAL(12,2) | DEFAULT 0.00 | Current balance in INR |
| `currency` | VARCHAR(10) | DEFAULT 'INR' | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_wallets_user_id` on `user_id` (unique)

**Table: `transactions`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `wallet_id` | UUID | FK → wallets.id | |
| `type` | VARCHAR(20) | NOT NULL | `credit`, `debit` |
| `source` | VARCHAR(50) | NOT NULL | `reward`, `withdrawal`, `verification_charge`, `refund`, `adjustment` |
| `amount` | DECIMAL(12,2) | NOT NULL | Always positive; sign determined by `type` |
| `balance_after` | DECIMAL(12,2) | NOT NULL | Wallet balance immediately after transaction |
| `reference_id` | UUID | | Related question ID, withdrawal_request ID, or admin adjusted entity |
| `description` | VARCHAR(500) | | Human-readable description |
| `status` | VARCHAR(20) | NOT NULL | `pending`, `completed`, `failed`, `reversed` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

> `verification_charge` transactions record the ₹1 fee debited from the wallet when a PineLabs micro-transaction is used to verify bank account details.

**Indexes:**
- `idx_transactions_wallet_id` on `wallet_id`
- `idx_transactions_created_at` on `created_at`
- `idx_transactions_reference_id` on `reference_id`
- `idx_transactions_status` on `status`

---

## 2.4 Withdrawal Request Schema

**Table: `withdrawal_requests`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id | |
| `wallet_id` | UUID | FK → wallets.id | |
| `amount` | DECIMAL(12,2) | NOT NULL | Requested payout amount |
| `payout_method` | VARCHAR(20) | NOT NULL | `upi`, `bank_transfer` |
| `payout_details` | JSONB | NOT NULL | UPI address or bank account info (display fields only — sensitive fields in `user_payment_details`) |
| `status` | VARCHAR(20) | NOT NULL | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `pinelabs_transaction_id` | VARCHAR(100) | | PineLabs transaction ID for micro-verification |
| `order_id` | VARCHAR(100) | UNIQUE | Idempotency key for PineLabs |
| `razorpay_payout_id` | VARCHAR(100) | | Razorpay payout ID after payout initiated |
| `utr_number` | VARCHAR(100) | | UTR from Razorpay after payout confirmed |
| `processed_at` | TIMESTAMP | | When payout completed |
| `cancelled_at` | TIMESTAMP | | When withdrawal was cancelled |
| `failure_reason` | VARCHAR(500) | | Human-readable failure message |
| `retry_count` | INTEGER | DEFAULT 0 | Number of retry attempts |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_withdrawals_user_id` on `user_id`
- `idx_withdrawals_status` on `status`

---

## 2.5 Payment Detail Schema

**Table: `user_payment_details`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id | |
| `payout_method` | VARCHAR(20) | NOT NULL | `upi`, `bank_transfer` |
| `upi_id` | VARCHAR(100) | | UPI ID (plaintext for display) |
| `account_number_last4` | VARCHAR(4) | | Last 4 digits of bank account |
| `ifsc` | VARCHAR(11) | | IFSC code (plaintext for display) |
| `ifsc_encrypted` | VARCHAR(500) | | AES-256-GCM encrypted IFSC |
| `account_holder_name` | VARCHAR(500) | | Account holder name (plaintext) |
| `account_holder_name_encrypted` | VARCHAR(500) | | AES-256-GCM encrypted holder name |
| `bank_name` | VARCHAR(200) | | Bank name looked up from IFSC |
| `account_number_encrypted` | VARCHAR(500) | | AES-256-GCM encrypted full account number |
| `status` | VARCHAR(20) | DEFAULT 'pending' | `pending`, `in_progress`, `verified`, `failed` |
| `verification_order_id` | VARCHAR(100) | UNIQUE | PineLabs order ID used for micro-transaction verification (deprecated) |
| `withdrawal_request_id` | UUID | FK → withdrawal_requests.id | Withdrawal that triggered this verification |
| `verification_failed_reason` | VARCHAR(500) | | |
| `verified_at` | TIMESTAMP | | When verification succeeded |
| `razorpay_fund_account_id` | VARCHAR(100) | | Razorpay Fund Account ID — created once, reused for all payouts |
| `razorpay_payout_id` | VARCHAR(100) | | Most recent payout ID |
| `razorpay_payment_link_id` | VARCHAR(100) | | Deprecated — Razorpay payment link for verification |
| `razorpay_payment_link_url` | VARCHAR(500) | | Deprecated — short URL for payment link |
| `razorpay_validation_id` | VARCHAR(100) | | `fav_xxx` ID from fund account validation call |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_upd_user_id` on `user_id`
- `idx_upd_status` on `status`

---

## 2.6 Payment Log Schema

**Table: `payment_logs`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `withdrawal_request_id` | UUID | FK → withdrawal_requests.id | |
| `admin_id` | UUID | | Admin who initiated the attempt |
| `order_id` | VARCHAR(100) | NOT NULL | PineLabs idempotency key |
| `pinelabs_transaction_id` | VARCHAR(100) | | PineLabs transaction ID from API response |
| `razorpay_payout_id` | VARCHAR(100) | | Razorpay payout ID |
| `utr_number` | VARCHAR(100) | | UTR from Razorpay |
| `status` | VARCHAR(20) | NOT NULL | `initiated`, `success`, `failed`, `pending`, `reversed` |
| `error_code` | VARCHAR(50) | | PineLabs error code on failure |
| `error_message` | TEXT | | PineLabs error message on failure |
| `raw_response` | JSONB | | Raw API response for debugging |
| `attempted_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_payment_logs_withdrawal_id` on `withdrawal_request_id`

---

## 2.7 Notification Schema

**Table: `notifications`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users.id | Recipient |
| `type` | VARCHAR(50) | NOT NULL | `question_approved`, `question_rejected`, `withdrawal_processed`, `duplicate_detected`, etc. |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `body` | TEXT | NOT NULL | Notification body |
| `data` | JSONB | | Additional payload (question ID, amount, etc.) |
| `read` | BOOLEAN | DEFAULT FALSE | Read/unread flag |
| `trigger_type` | VARCHAR(50) | | What triggered this: `system`, `admin_action`, `user_action`, `scheduled` |
| `actor_type` | VARCHAR(20) | | `user`, `admin`, `system` |
| `actor_id` | UUID | | ID of the actor who caused this notification |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_notifications_user_id` on `user_id`
- `idx_notifications_user_read` on `(user_id, read)`
- `idx_notifications_type` on `type`

---

## 2.8 Audit Log Schema

**Table: `audit_logs`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `actor_type` | VARCHAR(20) | NOT NULL | `user`, `admin`, `system` |
| `actor_id` | UUID | | |
| `action` | VARCHAR(100) | NOT NULL | e.g., `USER_LOGIN`, `QUESTION_APPROVED`, `WALLET_ADJUSTED` |
| `entity_type` | VARCHAR(100) | | e.g., `question`, `user`, `wallet`, `withdrawal_request` |
| `entity_id` | UUID | | |
| `old_value` | JSONB | | Previous state |
| `new_value` | JSONB | | New state |
| `metadata` | JSONB | | IP address, user-agent, device info |
| `reason` | VARCHAR(500) | | Admin-supplied reason for the action |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_audit_actor` on `(actor_type, actor_id)`
- `idx_audit_entity` on `(entity_type, entity_id)`
- `idx_audit_action` on `action`
- `idx_audit_created_at` on `created_at`

---

## 2.9 Admin Config Schema

**Table: `admin_config`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `key` | VARCHAR(255) | UNIQUE, NOT NULL | Config key |
| `value` | JSONB | NOT NULL | Config value |
| `description` | VARCHAR(500) | | Human-readable description |
| `updated_by` | UUID | FK → users.id | Admin who last updated |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_admin_config_key` on `key` (unique)

**Current live config keys:**

| Key | Default | Description |
|---|---|---|
| `max_users_per_state` | 100 | Maximum registered users per state |
| `min_withdrawal_amount` | 50 | Minimum withdrawal threshold (INR) |
| `question_edit_window_seconds` | 30 | Edit window after submission |
| `daily_question_limit` | 20 | Max questions per user per day |
| `duplicate_similarity_threshold` | 0.9 | Semantic similarity threshold for GDB duplicate detection |
| `video_max_duration_seconds` | 10 | Maximum video duration |
| `video_max_size_mb` | 10 | Maximum video file size |
| `max_question_chars` | 1000 | Maximum question text length |
| `max_image_size_mb` | 5 | Maximum image file size |

---

# 3. Entity Relationship Diagram

```
users (1) ────── (1) wallets
  │                    │
  │                    └──── (1..N) transactions
  │                    └──── (1..N) withdrawal_requests
  │
  ├──── (1..N) questions
  │         │
  │         └── self-ref: duplicate_of_id
  │
  ├──── (1..N) notifications
  │
  └──── (1..N) user_payment_details
                    │
                    └──── (N..1) withdrawal_requests (via withdrawal_request_id)

withdrawal_requests (1) ──── (1..N) payment_logs
```

---

# 4. Key Design Decisions

| Decision | Rationale |
|---|---|
| UUID primary keys everywhere | Avoid enumeration attacks; enables distributed ID generation |
| DECIMAL(12,2) for all money | Avoids floating-point rounding errors in financial math |
| AES-256-GCM for sensitive payment fields | Account numbers, IFSC, holder names encrypted at rest; decrypted only in-memory during payout dispatch |
| JSONB for flexible fields | `profile_data`, `device_info`, `media_urls`, `payout_details`, `data` accommodate evolving schemas |
| `status` ENUM (string) rather than hard deletes | All state transitions go through audit_logs; questions and users are never physically deleted |
| Semantic vector in `questions.embedding` | Embedding stored at submit time; GDB is an external HTTP service that takes question text (not the embedding) as input |
| `user_payment_details` as separate table | Keeps payment PII isolated from `withdrawal_requests`; allows a single verified fund account to be reused across all future payouts |
| `payment_logs` per-attempt | PineLabs and Razorpay interactions are idempotent-keyed; each attempt is recorded for debugging and compliance |

---

# Version History

| Version | Date | Changes |
|---|---|---|
| 2.0 | 2026-06-30 | Added `user_payment_details`, `payment_logs`, `notifications` tables; updated `questions` schema (domains[], embedding, new status values); updated `users` schema (role, organisation_type, village, kvk, token_version, crops, razorpay_contact_id, expo_push_token, extended profile fields); updated `withdrawal_requests` (PineLabs/Razorpay fields, CANCELLED status); removed aspirational tables (knowledge_repository, user_violations, daily_question_stats, reward_tier_summary, user_crop_details) |
| 1.0 | 2026-06-11 | Initial document |

---

*Last Updated: 2026-06-30*
# Database Design Document

## Project
Agriculture Knowledge Collection Platform

---

# 1. Database Overview

| Schema / Table Group | Purpose |
|---|---|
| `users` | User profiles, authentication, verification |
| `questions` | Question submissions, metadata, validation |
| `wallets` | Reward balances |
| `transactions` | Financial transaction ledger |
| `knowledge_repository` | Approved questions for AI training |
| `audit_logs` | Key system event logging |
| `admin_config` | System configuration and limits |
| `user_violations` | Fraud and abuse tracking |
| `daily_question_stats` | Pre-aggregated analytics |

All tables reside in a single **PostgreSQL** instance. Object storage (AWS S3 or MinIO) is used for media files (images, videos, audio).

---

# 2. Schema Definitions

## 2.1 Users Schema

**Table: `users`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Unique user identifier |
| `mobile_number` | VARCHAR(15) | UNIQUE, NOT NULL | Login identifier |
| `name` | VARCHAR(255) | NOT NULL | Full name |
| `category` | ENUM | NOT NULL | `farmer`, `fpo`, `student`, `volunteer`, `ngo` |
| `state` | VARCHAR(100) | NOT NULL | Registration state |
| `district` | VARCHAR(100) | NOT NULL | Registration district |
| `block` | VARCHAR(100) | | Block (optional) |
| `language_preference` | VARCHAR(50) | NOT NULL | Selected app language |
| `otp_hash` | VARCHAR(255) | | Hashed OTP for verification |
| `otp_expires_at` | TIMESTAMP | | OTP expiration time |
| `verification_status` | ENUM | NOT NULL | `pending`, `manual_review`, `verified`, `suspended`, `banned` |
| `profile_data` | JSONB | | Category-specific fields (farm_size, university, etc.) |
| `consent_given` | BOOLEAN | NOT NULL, DEFAULT FALSE | Privacy consent flag |
| `consent_timestamp` | TIMESTAMP | | When consent was given |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | |
| `last_login_at` | TIMESTAMP | | |

**Indexes:**
- `idx_users_mobile` on `mobile_number`
- `idx_users_state` on `state`
- `idx_users_category` on `category`
- `idx_users_verification_status` on `verification_status`

**Table: `user_crop_details`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id | |
| `crop_name` | VARCHAR(255) | NOT NULL | |
| `season` | VARCHAR(50) | | `kharif`, `rabi`, `zaid`, `year_round` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_user_crops_user_id` on `user_id`

---

## 2.2 Questions Schema

**Table: `questions`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id | Submitting user |
| `language` | VARCHAR(50) | NOT NULL | Question language |
| `domain_category` | VARCHAR(100) | NOT NULL | e.g., crop_protection, spray, irrigation |
| `season` | VARCHAR(50) | NOT NULL | kharif, rabi, zaid, year_round |
| `crop_type` | VARCHAR(255) | NOT NULL | |
| `agro_climatic_zone` | VARCHAR(255) | | |
| `state` | VARCHAR(100) | NOT NULL | |
| `district` | VARCHAR(100) | NOT NULL | |
| `block` | VARCHAR(100) | | |
| `question_text` | TEXT | NOT NULL | |
| `media_type` | ENUM | | `none`, `image`, `video`, `audio` |
| `media_urls` | JSONB | | Array of stored media URLs |
| `device_info` | JSONB | | Device型号, OS版本等 |
| `status` | ENUM | NOT NULL | `pending`, `ai_review`, `human_review`, `approved`, `rejected` |
| `ai_confidence_score` | DECIMAL(5,2) | | 0.00 to 100.00 |
| `duplicate_flag` | BOOLEAN | DEFAULT FALSE | |
| `duplicate_of_id` | UUID | FK -> questions.id | Reference to duplicate source |
| `edit_window_closes_at` | TIMESTAMP | | 30-second edit window |
| `submitted_at` | TIMESTAMP | NOT NULL | |
| `reviewed_at` | TIMESTAMP | | |
| `reviewer_id` | UUID | | Admin who reviewed |
| `rejection_reason` | VARCHAR(500) | | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_questions_user_id` on `user_id`
- `idx_questions_status` on `status`
- `idx_questions_state` on `state`
- `idx_questions_crop_type` on `crop_type`
- `idx_questions_language` on `language`
- `idx_questions_domain_category` on `domain_category`
- `idx_questions_submitted_at` on `submitted_at`
- `idx_questions_duplicate_of` on `duplicate_of_id`

---

## 2.3 Wallet Schema

**Table: `wallets`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id, UNIQUE | One wallet per user |
| `balance` | DECIMAL(12,2) | NOT NULL, DEFAULT 0.00 | Current balance in paisa |
| `currency` | VARCHAR(10) | NOT NULL, DEFAULT 'INR' | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_wallets_user_id` on `user_id`

**Table: `transactions`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `wallet_id` | UUID | FK -> wallets.id | |
| `type` | ENUM | NOT NULL | `credit`, `debit` |
| `source` | ENUM | NOT NULL | `reward`, `withdrawal`, `refund`, `adjustment` |
| `amount` | DECIMAL(12,2) | NOT NULL | Always positive |
| `balance_after` | DECIMAL(12,2) | NOT NULL | Wallet balance after transaction |
| `reference_id` | UUID | | Related question ID or withdrawal ID |
| `description` | VARCHAR(500) | | Human-readable description |
| `status` | ENUM | NOT NULL | `pending`, `completed`, `failed`, `reversed` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_transactions_wallet_id` on `wallet_id`
- `idx_transactions_created_at` on `created_at`
- `idx_transactions_reference_id` on `reference_id`
- `idx_transactions_status` on `status`

**Table: `withdrawal_requests`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id | |
| `wallet_id` | UUID | FK -> wallets.id | |
| `amount` | DECIMAL(12,2) | NOT NULL | |
| `payout_method` | ENUM | NOT NULL | `upi`, `bank_transfer` |
| `payout_details` | JSONB | NOT NULL | UPI address or bank account info |
| `status` | ENUM | NOT NULL | `pending`, `processing`, `completed`, `failed` |
| `processed_at` | TIMESTAMP | | |
| `failure_reason` | VARCHAR(500) | | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_withdrawals_user_id` on `user_id`
- `idx_withdrawals_status` on `status`

---

## 2.4 Knowledge Repository Schema

**Table: `knowledge_repository`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `question_id` | UUID | FK -> questions.id, UNIQUE | One record per approved question |
| `user_id` | UUID | FK -> users.id | |
| `language` | VARCHAR(50) | NOT NULL | |
| `domain_category` | VARCHAR(100) | NOT NULL | |
| `crop_type` | VARCHAR(255) | NOT NULL | |
| `season` | VARCHAR(50) | NOT NULL | |
| `agro_climatic_zone` | VARCHAR(255) | | |
| `state` | VARCHAR(100) | NOT NULL | |
| `district` | VARCHAR(100) | NOT NULL | |
| `block` | VARCHAR(100) | | |
| `question_text` | TEXT | NOT NULL | |
| `media_urls` | JSONB | | |
| `device_info` | JSONB | | |
| `ai_confidence_score` | DECIMAL(5,2) | | |
| `approved_at` | TIMESTAMP | NOT NULL | |
| `vector_embedding` | VECTOR | | For semantic search (future) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_knowledge_language` on `language`
- `idx_knowledge_crop_type` on `crop_type`
- `idx_knowledge_state` on `state`
- `idx_knowledge_domain_category` on `domain_category`
- `idx_knowledge_season` on `season`

---

## 2.5 Analytics / Aggregation Tables

**Table: `daily_question_stats`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `date` | DATE | NOT NULL | |
| `state` | VARCHAR(100) | | |
| `crop_type` | VARCHAR(255) | | |
| `domain_category` | VARCHAR(100) | | |
| `total_submitted` | INTEGER | DEFAULT 0 | |
| `total_approved` | INTEGER | DEFAULT 0 | |
| `total_rejected` | INTEGER | DEFAULT 0 | |
| `unique_users` | INTEGER | DEFAULT 0 | |
| `total_rewarded` | DECIMAL(12,2) | DEFAULT 0 | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Unique Index:**
- `idx_daily_stats_date_state_crop_domain` on `(date, state, crop_type, domain_category)`

**Table: `reward_tier_summary`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id | |
| `tier` | INTEGER | NOT NULL | 1, 2, or 3 |
| `questions_in_tier` | INTEGER | DEFAULT 0 | Count of approved questions in this tier |
| `total_earned` | DECIMAL(12,2) | DEFAULT 0 | Total earned in this tier |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_reward_tier_user_id` on `user_id`

---

## 2.6 Audit Log Schema

**Table: `audit_logs`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `actor_type` | ENUM | NOT NULL | `user`, `admin`, `system` |
| `actor_id` | UUID | | |
| `action` | VARCHAR(100) | NOT NULL | e.g., question_submitted, user_suspended |
| `entity_type` | VARCHAR(100) | | e.g., question, user, wallet |
| `entity_id` | UUID | | |
| `old_value` | JSONB | | |
| `new_value` | JSONB | | |
| `metadata` | JSONB | | IP, device, user-agent |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_audit_actor` on `actor_type, actor_id`
- `idx_audit_entity` on `entity_type, entity_id`
- `idx_audit_action` on `action`
- `idx_audit_created_at` on `created_at`

---

## 2.7 Admin Configuration Schema

**Table: `admin_config`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `key` | VARCHAR(255) | UNIQUE, NOT NULL | Config key name |
| `value` | JSONB | NOT NULL | Config value |
| `description` | VARCHAR(500) | | |
| `updated_by` | UUID | FK -> users.id | Admin who last updated |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | |

**Predefined Config Keys:**
| Key | Default | Description |
|---|---|---|
| `max_users_per_state` | 100 | Maximum registered users per state |
| `min_withdrawal_amount` | 50.00 | Minimum withdrawal threshold |
| `question_edit_window_seconds` | 30 | Edit window after submission |
| `daily_question_limit` | 20 | Max questions per user per day |
| `ai_confidence_threshold` | 90.00 | Minimum AI confidence to auto-approve |
| `duplicate_similarity_threshold` | 0.90 | Semantic similarity threshold for duplicate detection |
| `video_max_duration_seconds` | 10 | Maximum video duration in seconds |
| `video_max_size_mb` | 10 | Maximum video file size in megabytes |

---

## 2.8 Fraud & Abuse Schema

**Table: `user_violations`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> users.id | |
| `violation_type` | ENUM | NOT NULL | `duplicate`, `spam`, `abuse` |
| `question_id` | UUID | FK -> questions.id | Related question |
| `penalty_applied` | ENUM | NOT NULL | `warning`, `suspension`, `ban` |
| `suspension_until` | TIMESTAMP | | If penalty is suspension |
| `resolved` | BOOLEAN | DEFAULT FALSE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_violations_user_id` on `user_id`
- `idx_violations_type` on `violation_type`

---

# 3. Entity Relationship Diagram (Summary)

```
users (1) ────── (1) wallets
  │                    │
  │                    └──── (1) transactions
  │                              │
  ├──── (1) questions ───────────────── (1) knowledge_repository
  │         │                           │
  │         └──── (1) user_violations   │
  │                                      │
  └──── (1) withdrawal_requests          │
                                             
users ──── (1) admin_config (updated_by)
```

---

# 4. ORM and Migrations

All database operations for NestJS services are managed via **TypeORM**. AI Validation Service (FastAPI) uses **SQLAlchemy** for database access.

- Entities are defined as TypeORM entity classes
- Migrations are managed via the TypeORM CLI
- Synchronize mode (`synchronize: true`) is disabled in production; migrations are run explicitly
- Seed data (default config values, initial admin user) managed via TypeORM seeds or a dedicated seed script

## 5. Key Database Design Decisions

## 5.1 UUID as Primary Key
All tables use UUID (`gen_random_uuid()`) as primary keys to:
- Avoid enumeration attacks
- Enable distributed generation
- Prevent information leakage from ID sequence

## 5.2 Soft Deletes
Questions and Users use `status` ENUM rather than hard deletes to maintain audit trail and prevent data loss from accidental deletion.

## 5.3 JSONB for Flexible Fields
`profile_data`, `device_info`, `media_urls`, `payout_details`, and config values use JSONB to accommodate:
- Varying category-specific profile fields
- Different device fingerprinting data
- Evolving payout method details
- Flexible configuration storage

## 5.4 Decimal for Currency
`DECIMAL(12,2)` used for all monetary fields to avoid floating-point rounding errors in financial calculations.

## 5.5 Read Replicas
Analytics queries should target read replicas. The `daily_question_stats` aggregation table is pre-computed to reduce load on the primary transactional database.

## 5.6 Vector Embeddings
The `knowledge_repository` table includes a `vector_embedding` column (VECTOR type) to support future semantic similarity searches on approved questions.

---

# Version
1.0

---

# Last Updated
2026-06-11
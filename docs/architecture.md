# Architecture Document

## Project
Agriculture Knowledge Collection Platform

---

## 1. Overview

The platform is a cloud-native application designed to collect, validate, and store agriculture-related questions at scale. It supports 22 Indian scheduled languages, multi-format question input (text, image, video, audio), AI-based validation with human review, a reward wallet system with multiple payout methods, and a full admin dashboard with analytics and export.

**Three client surfaces:**

| Surface | Technology | Purpose |
|---|---|---|
| Mobile App | React Native (Expo) | Farmers, FPOs, students, volunteers submit questions |
| Web Dashboard | React (Vite) | Admin/curator/finance team reviews and manages |
| Public Web | React (Vite) | — (future public question browse, not yet built) |

**Backend:** NestJS (Node.js/TypeScript) — single monolith deployed as a container, horizontally scalable.

---

## 2. System Architecture

```
                              ┌──────────────────────────────────────┐
                              │            Clients                   │
                              │                                      │
                              │  ┌────────────┐  ┌────────────────┐ │
                              │  │ Mobile App │  │ Admin Web      │ │
                              │  │ (Expo/     │  │ Dashboard      │ │
                              │  │  React     │  │ (React/Vite)   │ │
                              │  │  Native)   │  │                │ │
                              │  └────────────┘  └────────────────┘ │
                              │         │              │            │
                              └─────────│──────────────│────────────┘
                                        │ HTTPS / TLS   │
              ┌─────────────────────────┘                │
              │  API Gateway / Load Balancer             │
              │  (Rate Limiting, JWT Auth, Routing)      │
              └─────────────────────┬───────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────────────────┐
          │                    NestJS Backend                          │
          │                                                         │
          │  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │
          │  │ Auth     │ │ Question  │ │  Wallet   │ │  User    │  │
          │  │ Module   │ │  Module   │ │  Module   │ │  Module  │  │
          │  └──────────┘ └───────────┘ └───────────┘ └──────────┘  │
          │                                                         │
          │  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │
          │  │ Admin    │ │ Notifica- │ │  Speech   │ │  LGD     │  │
          │  │ Module   │ │  tions    │ │  Module   │ │  Module  │  │
          │  └──────────┘ └───────────┘ └───────────┘ └──────────┘  │
          │                                                         │
          │  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │
          │  │ Payment  │ │ Storage   │ │   AI      │ │  Health  │  │
          │  │ Module   │ │  Module   │ │  Module   │ │  Check   │  │
          │  └──────────┘ └───────────┘ └───────────┘ └──────────┘  │
          │                                                         │
          └──────────────────────────┬──────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────────┐
         │                           │                               │
         v                           v                               v
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
  │  PostgreSQL      │   │     Redis        │   │   External Services   │
  │  (Primary DB)    │   │  (Cache/Session) │   │                       │
  │                  │   │                  │   │  • SMS Gateway (OTP)  │
  │  users           │   │  • Config cache  │   │  • PineLabs           │
  │  questions       │   │  • Rate limit    │   │    (payment verify)   │
  │  wallets         │   │    counters      │   │  • Razorpay           │
  │  transactions    │   │                  │   │    (fund accounts +   │
  │  withdrawal_     │   │                  │   │    payouts)           │
  │    requests      │   │                  │   │  • GCP Cloud Storage  │
  │  payment_logs    │   │                  │   │    (media files)      │
  │  user_payment_   │   │                  │   │  • Sarvam AI          │
  │    details       │   │                  │   │    (speech-to-text)   │
  │  notifications   │   │                  │   │  • LGD Service        │
  │  audit_logs      │   │                  │   │    (district/block    │
  │  admin_config    │   │                  │   │    master data)       │
  └──────────────────┘   └──────────────────┘   └──────────────────────┘
```

---

## 3. NestJS Module Inventory

| Module | Entities | Key Responsibility |
|---|---|---|
| `auth` | — | OTP generation/verification, JWT issuance, token refresh |
| `user` | `User` | Registration, profile management, verification queue |
| `question` | `Question`, `AuditLog`, `Notification` | Submit, edit, preview, list, admin approve/reject |
| `wallets` | `Wallet`, `Transaction`, `WithdrawalRequest`, `UserPaymentDetail` | Balance, reward credit, withdrawal, payment detail management |
| `admin` | `User`, `Question`, `Wallet`, `Transaction`, `WithdrawalRequest`, `AuditLog`, `AdminConfig`, `Notification`, `PaymentLog`, `UserPaymentDetail` | User management, question review, fraud review, analytics, config, export |
| `notifications` | `Notification` | In-app notification CRUD, push token management |
| `speech` | — | Sarvam AI speech-to-text (audio question transcription) |
| `lgd` | — | Local Government Directory — district/block master data |
| `payment` | `PaymentLog`, `WithdrawalRequest` | PineLabs micro-transaction verification, Razorpay fund account + payout |
| `storage` | — | GCP Cloud Storage — signed URLs for media uploads |
| `ai` | — | Gemma (crop/domain inference), GDB (semantic duplicate check), Embed (text vectorization), LLM (audit reasoning) |
| `health` | — | Readiness/liveness probe |

---

## 4. AI Service Architecture

```
[Question Submit] ──► Gemma Service
                           │
                           │ inferCropAndDomains()
                           │ confidence score (0.0 – 1.0)
                           │
                    ┌──────┴────────┐
                    │ confidence ≥ 0.9? │
                    └──────┬────────┘
                       Yes  │  No
                            ▼
            ┌───────────────────────────┐
            │  GDB Service              │
            │  checkDuplicate()         │
            │  Semantic similarity      │
            │  against stored vectors   │
            │  threshold: 0.9           │
            └───────────────────────────┘
                            │
                  ┌─────────┴──────────┐
                  │ Similar question    │
                  │ found above 0.9?    │
                  └─────────┬──────────┘
                      Yes   │  No
                            ▼
                   [PENDING] ──► Admin review queue
                   [REJECTED] ─► duplicate notification

                    [APPROVED] ──► Reward credited
```

**AI Sub-services:**

| Service | Model/Approach | Purpose |
|---|---|---|
| `GemmaService` | Groq (OpenAI-compatible API) — default `meta-llama/llama-4-maverick` | Classify question crop + agriculture domain; return confidence score |
| `GdbService` | Remote GDB HTTP API (`POST /v1/gdb/search`) | Semantic duplicate detection using `chosen_for_answer` + similarity threshold |
| `EmbedService` | On-premise service (`http://100.100.108.44:6001`) | Produce float embedding vector for each question at submit time |
| Audit notes | None — `approvalReason`/`rejectionReason` set from admin-supplied `reason` in review DTO | — |

---

## 5. Payment & Payout Architecture

```
[User adds payment detail]
         │
         ▼
  Save UserPaymentDetail (status: in_progress)
         │
         ├────────────────────────────────────┐
         ▼                                    ▼
  [UPI]                             [Bank Transfer]
         │                                    │
         ▼                                    ▼
  Razorpay Fund Account ──► ValidateFundAccount()
  (vpa)                          │
                                   ├─────────────────────────────────┐
                                   ▼                                 ▼
                           [status=completed]              [webhook: fund_account.validated]
                                   │                        or fund_account.validation_failed
                                   ▼                                    │
                           Mark verified                      Process webhook
                                                                │
                                                   ┌────────────┴────────────┐
                                                   ▼                         ▼
                                           [success + verified]      [failed + status=failed]
```

```
[User requests withdrawal]
         │
         ▼
  1. Verify payment detail status = verified
  2. Pessimistic lock wallet, debit balance
  3. Create WithdrawalRequest (status: pending)
  4. Create Transaction (status: pending, source: withdrawal)
         │
         ▼
  [Admin approves]
         │
         ▼
  Razorpay Payout Service
  createPayout() ──► razorpay_payout_id set
         │
         ▼
  Payout processed ──► utr_number saved
  status → completed
  Transaction → completed
         │
         ▼
  [Payout reversed by bank]
         │
         ▼
  creditReversedWithdrawal()
  Credit refund to wallet
  Transaction source=refund, status=completed
```

---

## 6. Data Flow Summary

```
On Question Submit:
  1. JWT auth check
  2. Daily limit check (admin_config: daily_question_limit)
  3. Image media validation (URL required when mediaType=image)
  4. Exact duplicate check (question_text match)
  5. Gemma inference → crop, domains, confidence
  6. GDB semantic duplicate check (if confidence ≥ 0.9)
  7. Embed question text → store vector
  8. Derive season from current month, agro-climatic zone from state
  9. Persist in transaction
  10. Audit log
  11. If duplicate: notify user in-app

On Question Approve (admin):
  1. Fetch approved count for user
  2. Determine reward tier (1–25→₹1, 26–250→₹5, 251+→₹10)
  3. Pessimistic lock wallet, credit reward
  4. Transaction (source=reward, type=credit)
  5. Audit log
  6. Notification to user

On Withdrawal:
  1. Check min_withdrawal_amount
  2. Check balance ≥ amount
  3. Check no other pending withdrawal
  4. Verify payment detail status = verified
  5. Atomic: wallet debit + withdrawal_request create + transaction create
  6. On admin approve: initiate Razorpay payout
  7. On payout complete: mark withdrawal completed
  8. On payout reversed: credit wallet (source=refund)
```

---

## 7. Technology Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo SDK 53) |
| Web (Admin + future public) | React + Vite + TypeScript |
| Backend Framework | NestJS (Node.js) |
| Database | PostgreSQL 15 + TypeORM |
| Cache | Redis |
| Object Storage | GCP Cloud Storage |
| AI Inference | Groq (OpenAI-compatible API) — `meta-llama/llama-4-maverick` default |
| Semantic Duplicate Detection | GDB remote HTTP service (`POST /v1/gdb/search`) |
| Speech-to-Text | Sarvam AI |
| Location Data | LGD (Local Government Directory) API |
| Payment Verification | PineLabs micro-transaction |
| Payout Disbursement | RazorpayX |
| SMS/OTP | Configurable provider (Twilio / MSG91) |
| Container | Docker |
| Orchestration | Kubernetes (EKS) |
| CDN | GCP Cloud CDN |
| Monitoring | Prometheus + Grafana |

---

## 8. Security

| Concern | Implementation |
|---|---|
| Transport | TLS/HTTPS on all endpoints; certificate pinning on mobile |
| Authentication | JWT (short-lived access + refresh tokens); OTP for mobile users |
| Authorization | Role-Based Access Control: `user`, `curator`, `finance`, `admin`, `super_admin` |
| PII Encryption | Bank account numbers, IFSC, holder names encrypted at rest (AES-256-GCM) |
| Rate Limiting | NestJS Throttler — 100 req/min global; configurable per-route |
| Audit Logging | All state-changing operations logged to `audit_logs` table |
| Input Validation | DTOs with class-validator on all HTTP inputs |

---

## 9. Admin Dashboard Capabilities

| Section | Features |
|---|---|
| **Users** | List, search, filter by state/category/status, suspend, ban, view profile |
| **Reviews** | Question review queue (human-review bucket), approve, reject with reason, hold |
| **Fraud** | Violation history per user, issue warning, apply suspension, ban |
| **Analytics** | Daily volume, state-wise, crop-wise, domain-wise, reward & payout |
| **Withdrawals** | List all pending/processing/completed/rejected, approve, reject, retry failed |
| **Config** | View/edit all `admin_config` keys in the database |
| **Wallets** | View any user's wallet, adjust balance, view transaction history |
| **Audit Logs** | Full audit trail search and filter |
| **Export** | CSV and Excel export for users, questions, transactions, withdrawals |

---

## 10. Configurable Parameters

All tunable via the admin dashboard or directly in `admin_config` table:

| Key | Default | Description |
|---|---|---|
| `max_users_per_state` | 100 | Max registered users per state |
| `daily_question_limit` | 20 | Max questions per user per day |
| `question_edit_window_seconds` | 30 | Edit window after submission |
| `duplicate_similarity_threshold` | 0.9 | Semantic similarity threshold for duplicate detection |
| `video_max_duration_seconds` | 10 | Maximum video duration |
| `video_max_size_mb` | 10 | Maximum video file size |
| `max_question_chars` | 1000 | Maximum question text length |
| `max_image_size_mb` | 5 | Maximum image file size |
| `min_withdrawal_amount` | 50 | Minimum withdrawal threshold (INR) |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.0 | 2026-06-30 | Added NestJS module inventory, AI sub-services (Gemma/GDB/Embed/LLM), payment architecture (PineLabs + Razorpay), web dashboard, speech module, LGD module |
| 1.0 | 2026-06-11 | Initial document |

---

*Last Updated: 2026-06-30*
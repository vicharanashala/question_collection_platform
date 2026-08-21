# AnnaDatha — Question Collection Platform

A farmer-centric mobile and web platform that enables rural agricultural communities to submit questions via voice or text in their own language, earn rewards for contributions, and access a curated farming knowledge base.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Key Features](#3-key-features)
4. [Architecture](#4-architecture)
5. [Getting Started](#5-getting-started)
6. [Environment Variables](#6-environment-variables)
7. [Recent Changes](#7-recent-changes)
8. [License](#8-license)

---

## 1. Project Overview

AnnaDatha is a knowledge-collection platform designed for farmers who may not be comfortable with written English. Users submit questions by audio recording or typed text in their local language. Submitted questions enter a curator review workflow, and approved contributions are published to a FAQ knowledge repository. Users earn points for approved questions and may withdraw rewards through integrated payment gateways.

The platform comprises three distinct components:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend** | Node.js / NestJS · TypeORM · MongoDB · Redis | REST API, authentication, AI processing, payment orchestration, notifications |
| **Mobile (AnnaDatha)** | React Native (Expo) · i18n | Farmer-facing mobile application with 19 Indian language locales |
| **Web (Admin Dashboard)** | React · Vite · Tailwind CSS · Radix UI | Internal administration and curator review interface |

---

## 2. Repository Structure

```
question_collection_platform/
├── backend/                     # NestJS API server
│   └── src/
│       ├── modules/             # Feature modules
│       │   ├── admin/           # Role-based controls, curator workflow, audit logs
│       │   ├── ai/              # Server-side Gemma AI — question tagging and insights
│       │   ├── auth/            # JWT authentication and OTP (Fast2SMS) integration
│       │   ├── faqs/            # FAQ/knowledge repository management
│       │   ├── lgd/             # Local Government Directory integration
│       │   ├── notification/    # Push and in-app notification dispatch
│       │   ├── payment/         # Razorpay and PineLabs payment gateway integration
│       │   ├── question/        # Question submission, review workflow, fraud detection
│       │   ├── reports/         # Analytics and reporting module
│       │   ├── speech/          # Sarvam STT (speech-to-text) integration
│       │   ├── storage/         # GCP Cloud Storage for media uploads
│       │   ├── user/            # User profiles and account settings
│       │   └── wallets/         # Points ledger, rewards, and withdrawal management
│       ├── shared/              # Dependency injection, decorators, middleware, utilities
│       ├── config/              # TypeORM configuration and environment setup
│       ├── workers/             # Background job processors
│       └── utils/scripts/       # One-off migration and seed scripts
├── mobile/                      # React Native (Expo) mobile application
│   └── src/
│       ├── api/                 # Axios API client
│       ├── components/          # Reusable UI components
│       ├── context/             # React context (auth, theme, i18n)
│       ├── hooks/               # Custom React hooks
│       ├── i18n/                # 19 Indian language translation files
│       ├── navigation/          # React Navigation configuration
│       ├── screens/             # Application screens (Auth, Home, Question, Wallet, FAQ, Admin)
│       └── utils/               # Helpers and on-device AI inference engines
├── web/                         # Admin and curator dashboard
│   └── src/
│       ├── api/                 # API client
│       ├── components/          # Shadcn/Radix UI components and Recharts visualizations
│       ├── context/             # Authentication and theme context
│       ├── pages/               # Route pages (Dashboard, Questions, Users, Wallets, FAQs, Reviews)
│       └── types/               # TypeScript type definitions
├── tasks/                       # Feature definitions and planning documents
├── docs/                        # Architecture and API documentation
├── memory/                      # Agent daily session memory
└── .sessions/                   # Session transcripts for continuity
```

---

## 3. Key Features

### 3.1 Mobile Application (AnnaDatha)

- **Multi-language support** — 19 Indian languages: Assamese, Bengali, Bodo, Dogri, English, Gujarati, Hindi, Kannada, Konkani, Kashmiri, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Tamil, Telugu, and Urdu.
- **Voice input** — Audio recording for question submission; server-side Sarvam STT converts speech to text.
- **On-device AI validation** — Local inference via HuggingFace Transformers.js provides spam classification, agriculture relevance scoring, and duplicate detection at submission time.
- **Wallet and rewards** — Points accrue per approved question; withdrawals processed via Razorpay or PineLabs.
- **Theme support** — Full dark and light mode.
- **Push notifications** — Alerts for review status, payout events, and leaderboard updates.
- **FAQ knowledge base** — Searchable, categorized farming FAQ repository with embedded video guide.

### 3.2 Admin Dashboard (Web)

- **Questions queue** — Curators review, approve, reject, or flag submissions. Duplicate detection is performed inline during approval.
- **User management** — View and manage farmer accounts and curator roles.
- **Wallet operations** — Approve or reject withdrawal requests; view full transaction history.
- **Analytics** — Submission volumes, language distribution, approval rates, and fraud metrics displayed via Recharts.
- **Audit logs** — Immutable action history for all administrative operations.
- **FAQ management** — Create, curate, and publish knowledge articles.
- **Notification broadcast** — Send application-wide or targeted push notifications.
- **Role-based access control** — Granular permissions for Admin, Curator, and Finance roles.

### 3.3 Backend Services

- **Authentication** — JWT access and refresh tokens with OTP verification via Fast2SMS. Redis enforces rate limiting on authentication endpoints.
- **Fraud detection** — Pattern-based spam detection and Jaccard similarity duplicate detection (threshold 0.85, last 90 days of approved questions) run during the curator approval workflow.
- **AI pipeline** — Server-side Gemma for question tagging; on-device HuggingFace Transformers.js (spam, relevance, duplicate) in the mobile app.
- **Payment orchestration** — Razorpay and PineLabs gateways handle withdrawal disbursements.
- **Media storage** — GCP Cloud Storage for audio recordings and image uploads.
- **Caching** — Redis for session state, JWT blocklist, rate limit counters, and leaderboard scoreboards.

---

## 4. Architecture

### 4.1 Data Storage Strategy

PostgreSQL (via TypeORM) stores all structured relational data: user accounts, roles, wallet transactions, audit logs, and FAQ metadata. MongoDB stores semi-structured documents — questions and FAQs with variable schemas resulting from the curation process.

### 4.2 Duplicate Detection (Dual-Layer)

Duplicate detection operates at two independent layers:

1. **Backend — Jaccard similarity** (curator approve flow): When a curator clicks Approve, the backend tokenizes the question text (lowercase, strip punctuation, drop tokens shorter than 2 characters, sort), computes Jaccard similarity against the last 90 days of approved questions, and auto-holds the submission if the score is ≥ 0.85. Candidates are drawn from the most recent 200 approved questions, ordered descending.
2. **Mobile — Embedding similarity** (submission time): The on-device HuggingFace Transformers.js pipeline generates embeddings for the submitted question and compares them against cached embeddings of previously submitted questions. Due to WebAssembly unavailability in the React Native JavaScript runtime, this layer falls back to keyword-based similarity when embeddings cannot be computed.

### 4.3 AI Decision Authority

All AI-generated classifications — question relevance, spam scoring, duplicate flags — are advisory. Every piece of content published to the FAQ knowledge base has passed through human curator review.

### 4.4 Internationalization

The mobile application uses i18next with 19 locale files loaded lazily based on user preference. All user-facing strings are externalized; locale switching does not require a rebuild.

---

## 5. Getting Started

### 5.1 Prerequisites

| Dependency | Version |
|------------|---------|
| Node.js | 20+ |
| pnpm | 8+ |
| MongoDB | 7+ |
| Redis | 7+ |
| PostgreSQL | 16+ |
| GCP project | with Cloud Storage enabled |

### 5.2 Backend

```bash
cd backend
cp .env.example .env   # Populate all environment variables
pnpm install
pnpm build
pnpm start:dev
```

### 5.3 Mobile Application

```bash
cd mobile
npm install --legacy-peer-deps
npx expo prebuild --clean

# iOS
npx expo run:ios

# Android
npx expo run:android
```

For iOS development, open `ios/AnnaDatha.xcworkspace` in Xcode before running.

### 5.4 Web Dashboard

```bash
cd web
cp .env.example .env
pnpm install
pnpm dev
```

---

## 6. Environment Variables

### 6.1 Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `FAST2SMS_API_KEY` | Fast2SMS OTP service API key |
| `RAZORPAY_KEY_ID` | Razorpay key identifier |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `PINELABS_MERCHANT_ID` | PineLabs merchant identifier |
| `GCP_PROJECT_ID` | Google Cloud project identifier |
| `GCP_BUCKET_NAME` | GCP Cloud Storage bucket name |
| `SARVAM_API_KEY` | Sarvam AI speech-to-text API key |

### 6.2 Web (`.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_PUBLIC_FAQ_VIDEO_URL` | YouTube URL for the FAQ video guide section (optional) |

---

## 7. Recent Changes

The following is a curated summary of significant changes. Full session transcripts are available in `.sessions/`.

| Date | Area | Change |
|------|------|--------|
| 2026-08-11 | Web (Client) | `feedbackReminderDismissed` refactored from a plain Recoil `atom` to `atomWithLocalStorage`, persisting the dismissed state across page refreshes. The modal is also permanently suppressed when the backend signals that feedback is not required for a given conversation. |
| 2026-08-04 | Backend + Web | Duplicate detection integrated into the curator approval workflow. The backend auto-holds questions flagged as duplicates during approval and surfaces the existing question context via a `DuplicateFoundModal`. A standalone "Check Duplicate" button is available on all questions in the review queue. |
| 2026-08-01 | Mobile | On-device AI validation pipeline rewritten to use HuggingFace Transformers.js (`@xenova/transformers`), replacing the prior TF-IDF implementation. The new pipeline performs spam classification, agriculture relevance scoring, and embedding-based duplicate detection in three sequential stages. The submission screen displays a three-indicator validation feedback row and properly blocks the Continue button on validation failure. |
| 2026-08-01 | Mobile | Fixed `handlePreview()` in `QuestionScreen.tsx` to invoke `runOnDeviceValidation()` and render the validation state. |
| 2026-07-15 | Backend + Mobile + Web | FAQ video guide added across all three surfaces via a `VideoSection` component supporting click-to-play YouTube embeds with thumbnail fallback. A critical fix was applied: the `Faq` entity was missing from the TypeORM `entities` array in `app.module.ts`, preventing FAQ persistence. |
| 2026-07–Aug | Web | Batch UI improvements including: consolidation of login and registration into a single `LoginPage` with improved OTP handling and theme toggle; integration of `VideoSection` and enhanced footer messaging on `PublicHomePage`; free-text entry support for district, block, village, and KVK fields in `CompleteProfileWizard`; layout and responsiveness refinements across `CuratorDashboardPage`, `ReviewsPage`, `QuestionsPage`, `PublicQuestionsPage`, `UserDetailPage`, `UsersPage`, `WalletsPage`, and `WithdrawalsPage`; addition of `SignOutDialog`; removal of unused props from `Header` and `PublicHeader`; removal of language-selection from public navigation. |

---

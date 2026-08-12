# AnnaDatha — Question Collection Platform

A farmer-centric mobile and web platform that empowers rural agricultural communities to ask questions via voice or text in their own language, earn rewards for contributions, and access a curated knowledge base of farming Q&A.

---

## Project Overview

AnnaDatha is a knowledge-collection platform designed for farmers who may not be comfortable with written English. Users can:

- **Submit questions** by recording audio or typing in their local language
- **Browse and search** a curated FAQ/knowledge repository
- **Earn rewards** through a wallet and leaderboard system
- **Collaborate** with curators who review and approve submissions

The platform consists of three parts:

| Component | Tech Stack | Description |
|-----------|------------|-------------|
| **Backend** | Node.js / NestJS + TypeORM + MongoDB + Redis | REST API, auth, AI integration, payments, notifications |
| **Mobile (AnnaDatha)** | React Native (Expo) + i18n | Farmer-facing mobile app with 19 Indian language locales |
| **Web (Admin Dashboard)** | React + Vite + Tailwind + Radix UI | Internal admin/curator dashboard |

---

## Repository Structure

```
question_collection_platform/
├── backend/                  # NestJS API server
│   └── src/
│       ├── modules/          # Feature modules
│       │   ├── admin/        # Role-based admin controls & audit logs
│       │   ├── ai/           # Server-side AI (Gemma) for question tagging & insights
│       │   ├── auth/         # JWT authentication & OTP (Fast2SMS)
│       │   ├── faqs/         # FAQ/knowledge repository management
│       │   ├── lgd/          # Local Government Directory integration
│       │   ├── notification/ # Push & in-app notifications
│       │   ├── payment/      # Razorpay & PineLabs payment gateway integration
│       │   ├── question/     # Question submission, review, fraud detection
│       │   ├── reports/      # Analytics and reporting module
│       │   ├── speech/       # Sarvam STT (speech-to-text) integration
│       │   ├── storage/      # GCP Cloud Storage for media uploads
│       │   ├── user/         # User profile & settings
│       │   └── wallets/      # Points, rewards, withdrawals
│       ├── shared/           # DI, decorators, middleware, utilities
│       ├── config/           # TypeORM config, environment setup
│       ├── workers/          # Background job processors
│       └── utils/scripts/    # One-off migration and seed scripts
├── mobile/                   # React Native (Expo) mobile app
│   └── src/
│       ├── api/              # Axios API client
│       ├── components/       # Reusable UI components
│       ├── context/          # React context (auth, theme, i18n)
│       ├── hooks/            # Custom hooks
│       ├── i18n/             # 19 Indian language translations
│       ├── navigation/       # React Navigation setup
│       ├── screens/          # App screens (Auth, Home, Question, Wallet, etc.)
│       └── utils/            # Helpers
├── web/                      # Admin/curator dashboard (React + Vite)
│   └── src/
│       ├── api/              # API client
│       ├── components/       # Shadcn/Radix UI components + Recharts
│       ├── context/          # Auth, theme context
│       ├── pages/            # Route pages (dashboard, questions, users, wallets, etc.)
│       └── types/            # TypeScript types
├── tasks/                    # Feature task definitions (internal planning docs)
├── docs/                     # Architecture and API documentation
├── memory/                   # Agent daily session memory
└── .sessions/                # Session transcripts
```

---

## Key Features

### Mobile App (AnnaDatha)

- **Multi-language support** — 19 Indian languages (Assamese, Bengali, Bodo, Dogri, English, Gujarati, Hindi, Kannada, Konkani, Kashmiri, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Tamil, Telugu, Urdu)
- **Voice input** — Record audio questions; server-side Sarvam STT converts to text
- **On-device AI** — Gemma 3n local model provides instant question insights
- **Wallet & rewards** — Earn points per approved question; withdraw via Razorpay/PineLabs
- **Dark/Light mode** — Full theme support
- **Notifications** — Push notifications for review status, payouts, and leaderboard updates
- **FAQ browsing** — Searchable, categorized knowledge repository

### Admin Dashboard (Web)

- **Questions queue** — Review, approve, reject, or flag submissions
- **User management** — View/manage farmer and curator accounts
- **Wallet management** — Approve/reject withdrawal requests; view transactions
- **Analytics dashboard** — Submission volumes, language distribution, approval rates
- **Audit logs** — Full immutable action history for admin operations
- **FAQ management** — Curate and publish knowledge articles
- **Notification broadcast** — Send app-wide or targeted notifications
- **Role-based access** — Admin, Curator, Finance roles with granular permissions

### Backend Services

- **Authentication** — JWT + OTP (Fast2SMS) with Redis rate limiting
- **Fraud detection** — Pattern-based spam and duplicate detection
- **AI integration** — Gemma (server-side) and on-device for question tagging and insights
- **Payment gateways** — Razorpay and PineLabs for withdrawals
- **File storage** — GCP Cloud Storage for images and audio
- **Caching** — Redis for sessions, rate limits, and hot data

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- MongoDB 7+
- Redis 7+
- PostgreSQL 16+ (for TypeORM migrations)
- GCP project with Cloud Storage bucket

### Backend

```bash
cd backend
cp .env.example .env   # Fill in your environment variables
pnpm install
pnpm build
pnpm start:dev
```

### Mobile App

```bash
cd mobile
npm install --legacy-peer-deps
npx expo prebuild --clean
# Open ios/AnnaDatha.xcworkspace in Xcode and run, or:
npx expo run:ios
# Or for Android:
npx expo run:android
```

### Web Dashboard

```bash
cd web
cp .env.example .env   # Fill in your API URL
pnpm install
pnpm dev
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `FAST2SMS_API_KEY` | OTP service |
| `RAZORPAY_KEY_ID` | Razorpay credentials |
| `PINELABS_MERCHANT_ID` | PineLabs credentials |
| `GCP_PROJECT_ID` | Google Cloud project |
| `GCP_BUCKET_NAME` | Storage bucket name |
| `SARVAM_API_KEY` | Speech-to-text service |

### Web (`.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

---

## Architecture Notes

- **Backend** uses NestJS with a modular monorepo-style structure. Each domain (auth, question, wallet, etc.) is a standalone module. PostgreSQL stores structured relational data (users, transactions); MongoDB stores documents (questions, FAQs with variable schemas).
- **Redis** is used for session caching, JWT blocklist, rate limiting, and leaderboard scores.
- **AI decisions** are advisory — all content ultimately goes through human curator review.
- **i18n** in the mobile app uses i18next with 19 locales, loaded lazily per user preference.

---

## License

MIT

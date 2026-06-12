# Architecture Document

## Project
Agriculture Knowledge Collection Platform

---

# 1. Overview

The platform is a cloud-native mobile application designed to collect, validate, and store agriculture-related questions at scale. It supports multi-language input, AI-based validation, a reward wallet system, and an admin dashboard with analytics and export capabilities.

---

# 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Application                         │
│              React Native (Expo) + On-Device AI              │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │  Auth    │  │ Question │  │  Wallet  │  │ Profile  │   │
│   │ Module   │  │ Submission│ │  Module  │  │ Module   │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│   ┌──────────────────────────────────────────────────┐     │
│   │           On-Device AI Layer                      │     │
│   │  • Agriculture Relevance Detection                │     │
│   │  • Duplicate Detection (Exact + Semantic)         │     │
│   │  • Spam Flagging                                  │     │
│   └──────────────────────────────────────────────────┘     │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / TLS
                            v
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer              │
│                  (Rate Limiting, Auth, Routing)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        v                   v                    v
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  Auth        │  │  Question       │  │  Wallet          │
│  Service     │  │  Service        │  │  Service         │
│  (NestJS)    │  │  (NestJS)       │  │  (NestJS)        │
└──────────────┘  └─────────────────┘  └──────────────────┘
        │                   │                    │
        v                   v                    v
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
│  users | questions | wallets | transactions | knowledge_repo │
│  audit_logs | admin_config | user_violations | daily_stats   │
└──────────────────────────────────────────────────────────────┘
                              │
                              v
                    ┌─────────────────────┐
                    │  AI Validation      │
                    │  Service            │
                    │  (FastAPI + ML)     │
                    │  - Confidence Score │
                    │  - Duplicate Check  │
                    │  - Human Review Q   │
                    └─────────────────────┘
                              │
                    ┌─────────────────────┐
                    │  Knowledge          │
                    │  Repository         │
                    │  (PostgreSQL +      │
                    │   Object Storage)   │
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                           │
│            (React Native Web / Separate Admin App)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  User    │  │ Question │  │ Analytics│  │ Reward   │   │
│  │Management│  │  Review  │  │ Dashboards│ │ Payout   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

# 3. Component Architecture

## 3.1 Mobile Application

| Module | Responsibility |
|---|---|
| Auth Module | OTP-based login, registration, language selection |
| Question Submission Module | Multi-format question input (text, image, video, audio), metadata capture |
| On-Device AI Module | Pre-submission validation, duplicate detection, spam flagging |
| Wallet Module | Balance display, transaction history, withdrawal requests |
| Profile Module | Profile management, category-specific fields |

## 3.2 Backend Services

| Service | Responsibility | Implementation |
|---|---|---|
| Auth Service | OTP generation/verification, session management, token issuance | NestJS (Node.js) |
| Question Service | Question intake, metadata storage, routing to AI validation | NestJS (Node.js) |
| AI Validation Service | Server-side AI scoring, duplicate detection, human review queue | FastAPI (Python) |
| Wallet Service | Balance management, transaction logging, withdrawal processing | NestJS (Node.js) |
| User Service | User management, profile handling, state-level user limits | NestJS (Node.js) |
| Notification Service | Push notifications, withdrawal alerts, status updates | NestJS (Node.js) + FCM / SMS gateway |
| Analytics Service | Aggregation of metrics, dashboard data, export generation | NestJS (Node.js) |

Core backend services (Auth, Question, Wallet, User, Notification, Analytics) are implemented as **NestJS modules** in Node.js, organized by domain. AI Validation Service is implemented in **FastAPI (Python)** for optimal ML model serving and async inference performance. Shared concerns (database connection, authentication guard, logging) are implemented as NestJS shared modules or global modules. NestJS and FastAPI services communicate over HTTP or internal service calls.

## 3.3 Data Stores

| Store | Purpose | Type |
|---|---|---|
| User Database | User profiles, authentication records | Relational (PostgreSQL) |
| Question Database | Questions, metadata, validation scores | Relational (PostgreSQL) |
| Wallet Database | Balances, transactions | Relational (PostgreSQL) |
| Knowledge Repository | Approved questions for AI training, analytics | Data lake / Object storage |
| Cache | Session cache, rate limiting counters | Redis |
| Queue | Async job processing for AI validation, notifications | RabbitMQ / Kafka |

---

# 4. System Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      External Integrations                    │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        v                     v                     v
┌───────────────┐   ┌──────────────────┐  ┌──────────────────┐
│  SMS Gateway  │   │  UPI / Payment   │  │  Government /    │
│  (OTP Delivery)│   │  Gateway        │  │  NGO Systems     │
└───────────────┘   │  (Withdrawals)   │  │  (Future)        │
                    └──────────────────┘  └──────────────────┘
```

---

# 5. Security Architecture

## 5.1 Communication Security
- All external communication over **TLS/HTTPS**
- Certificate pinning on mobile clients
- API calls signed with short-lived JWT tokens

## 5.2 Authentication & Authorization
- Mobile OTP for user authentication
- Role-Based Access Control (RBAC) for admin operations
- Admin sessions managed separately with elevated privileges

## 5.3 Data Security
- User data encrypted at rest
- PII fields (mobile, bank details) encrypted
- Role-based visibility of user data

## 5.4 Audit Logging
- All key system events logged:
  - User registration
  - Question submission
  - Question approval/rejection
  - Reward credit
  - Withdrawal request
  - Admin actions (suspend, ban, configuration changes)
- Logs retained for compliance and fraud investigation

---

# 6. AI/ML Architecture

## 6.1 On-Device AI
- Lightweight model for agriculture relevance detection
- Local duplicate detection (exact match + on-device semantic)
- On duplicate detection: reject question immediately and send in-app notification to user
- Runs entirely on mobile device before submission

## 6.2 Server-Side AI (FastAPI)
- Full-scale ML model for confidence scoring
- Duplicate detection using semantic similarity (threshold: **0.9**)
- Routes low-confidence submissions to human review queue
- Served via FastAPI with async inference endpoints

## 6.3 Human Review Workflow
```
[Question] --> [AI Score >= 90%] --> [Auto-Approved]
                    |
                   No
                    |
                    v
            [Human Review Queue]
                    |
         /          |          \
        v           v           v
   [Approve]   [Reject]    [Request Info]
        |         |              |
        v         v              v
   [Reward +    [No Reward]  [Notify User]
    Add to Repo]
```

---

# 7. Scalability Architecture

- **Cloud-native**: Deployed on Kubernetes or equivalent container orchestration
- **Horizontal scaling**: All services stateless, scaled behind load balancer
- **Database sharding**: User and question data sharded by state/geography for performance
- **Read replicas**: Analytics queries run on read replicas to avoid impacting write performance
- **CDN**: Static assets, images, videos served through CDN
- **Caching**: Frequently accessed data (user profiles, analytics summaries) cached in Redis

---

# 8. Deployment Architecture

```
                    [CDN]
                      |
                      v
            ┌─────────────────┐
            │  Load Balancer  │
            │  (SSL Terminate)│
            └────────┬────────┘
                     │
     ┌───────────────┼───────────────┐
     v               v               v
┌─────────┐   ┌─────────────┐   ┌──────────┐
│  Auth   │   │  Question   │   │  Wallet  │
│ Service │   │  Service    │   │  Service │
│ (x2+)   │   │  (x2+)      │   │  (x2+)   │
└────┬────┘   └──────┬──────┘   └────┬─────┘
     │               │               │
     v               v               v
┌─────────┐   ┌─────────────┐   ┌──────────┐
│  Auth   │   │  Question   │   │  Wallet  │
│  DB     │   │  DB         │   │  DB      │
│(Primary │   │(Primary +   │   │(Primary  │
│ +Read   │   │ Read Replica│   │ +Read    │
│ Replica)│   │             │   │ Replica) │
└─────────┘   └─────────────┘   └──────────┘
```

---

# 9. Admin Dashboard Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Admin Dashboard                         │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ User Management│  │ Question Review│                  │
│  │ - View/Search  │  │ - AI flagged   │                  │
│  │ - Suspend/Ban  │  │ - Human queue  │                  │
│  │ - State Limits │  │ - Approve/Reject│                 │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ Analytics      │  │ Reward & Payout│                  │
│  │ - Daily Volume │  │ - Reward logs  │                  │
│  │ - State/Crop   │  │ - Withdrawals  │                  │
│  │ - Engagement   │  │ - Fraud flags  │                  │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  ┌────────────────────────────────────────┐              │
│  │ Export: CSV | Excel                    │              │
│  └────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

**Configurable Parameters from Admin Dashboard:**
- Max users per state (default: 100)
- Video: max duration (default: 10 seconds), max file size (default: 10 MB)
- Semantic similarity threshold for duplicate detection (default: 0.9)
- Min withdrawal amount (default: Rs. 50)
- AI confidence threshold (default: 90%)
- Daily question limit per user (default: 20)
- Edit window duration (default: 30 seconds)

---

# 10. Technology Stack Considerations

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) |
| Backend Framework | NestJS (Node.js) |
| AI/ML Service | FastAPI (Python) |
| Primary Database | PostgreSQL |
| ORM | TypeORM |
| API Gateway | Kong / AWS API Gateway / Nginx |
| Cache | Redis |
| Message Queue | RabbitMQ / Kafka |
| Object Storage | AWS S3 / MinIO |
| AI/ML Serving | FastAPI + PyTorch / TensorFlow |
| Container Orchestration | Kubernetes / AWS EKS |
| CDN | Cloudflare / AWS CloudFront |
| Analytics | PostgreSQL + Grafana / Metabase |
| Monitoring | Prometheus + Grafana |
| Logging | ELK Stack |

---

# Version
1.0

---

# Last Updated
2026-06-11
# Agriculture Knowledge Collection Platform

## Version

1.0

---

# Objective

Develop a mobile application that enables farmers, agriculture students, volunteers, and NGO partners to submit agriculture-related questions.

Approved questions are rewarded through a wallet system and stored in a centralized knowledge repository for AI model training, agricultural analytics, and government policy planning.

---

# Problem Statement

Agricultural knowledge is distributed across regions, languages, and communities. Valuable farmer questions are rarely collected in a structured manner.

The platform will:

- Incentivize users to contribute agriculture-related questions.
- Build a large-scale, centralized agricultural knowledge dataset.
- Generate labeled datasets for AI model training and analytics.
- Support government policy planning with structured agricultural insights.
- Provide future insights into agricultural trends across agro-climatic zones.

---

# Stakeholders

## External

- Farmers (Individual and FPO Members)
- Agriculture University Students
- Volunteers
- NGO Partners
- Government Agencies

## Internal

- Product Team
- Engineering Team
- Data Science Team
- Finance Team
- Admin Team

---

# User Roles

## User

Can:

- Register / Login
- Complete profile based on user category
- Submit Questions (text, image, video, audio)
- View Wallet Balance and Transaction History
- Request Withdrawal

## Admin

Can:

- Manage Users (view, suspend, ban)
- Configure maximum users per state
- Review Questions
- Monitor Rewards and Payouts
- Generate Reports
- Access All Analytics Dashboards
- Export Data (CSV, Excel)

---

# User Eligibility

## Who Can Register

- Individual Farmers and FPO (Farmer Producer Organization) Members
- Students from Agriculture Universities
- Volunteers and NGO Partners

## Verification

- Mobile OTP plus manual verification based on onboarding details

## Mandatory Profile Information

- Name
- Mobile Number
- State
- District
- Crop Details
- Category-specific fields:
  - Students: Course name, University name
  - Farmers: Farm size, crop type
  - Others: Organization name, role

---

# Language Support

All 22 Indian scheduled languages are supported from day one:

1. Assamese
2. Bengali
3. Bodo
4. Dogri
5. Gujarati
6. Hindi
7. Kannada
8. Kashmiri
9. Konkani
10. Maithili
11. Malayalam
12. Manipuri (Meitei)
13. Marathi
14. Nepali
15. Odia
16. Punjabi
17. Sanskrit
18. Santali
19. Sindhi
20. Tamil
21. Telugu
22. Urdu

---

# Features

## Authentication

- Mobile OTP Login
- User Registration with category-based profile
- Profile Management
- Language Selection (all regional languages)

## Question Submission

Supported Input Types:

- Text
- Image
- Video
- Audio

Constraints:

- Minimum question length: No restriction
- Daily submission limit: 20 questions per user per day
- Edit window: Allowed within a dynamic 30-second window after submission; no editing after this
- Video: Maximum duration of 10 seconds, maximum file size of 10 MB. Configurable from admin dashboard.

Metadata Captured Per Submission:

- User ID
- Language
- Timestamp
- Crop Type
- Device Information
- Agriculture Domain Category (e.g., crop protection, spray, irrigation)
- Season
- Agro-Climatic Zone
- State, District, Block (location)
- Additional metadata as applicable

## AI Validation

The system shall:

- Perform server-side AI-based agriculture relevance detection (Gemma model, GCP Vertex AI).
- Generate a confidence score; threshold 90% — above this, auto-approve; below, route to human review.
- Perform semantic duplicate detection using vector embeddings (ChromaDB, similarity threshold 0.9).
- Generate question text embeddings on submit (text-embeddings-004, GCP Vertex AI).
- Route low-confidence cases to the human review queue (admin/curator dashboard).
- Flag spam through audit log review by admins (no automatic spam detection).

## Reward System

### Reward Tiers (Per Approved Question)

| Questions Submitted | Reward Per Question |
|---|---|
| 1 – 25 | ₹1 |
| 26 – 250 | ₹5 |
| 251+ | ₹10 |

**Note:** Tier 3 applies to all approved questions beyond 250 (no upper cap).

### Reward Criteria

- Question must be approved (auto by Gemma confidence >= 0.9, or manually by a curator/admin).
- Reward is based on question quality, uniqueness, and final approval.
- No maximum daily reward limit (rewards are per approved question, unlimited per day).

### Wallet

- Rewards credited automatically upon approval.
- Display current balance.
- Maintain full transaction history.
- Minimum withdrawal amount: ₹50 (configurable).

### Payout Methods

- UPI
- Bank Transfer
- Internal wallet system for balance management

## Fraud Prevention

### Duplicate Submissions

- Rejected immediately on-device.
- Exact-match duplicate: rejected immediately at submit time.
- Semantic duplicate (GDB similarity >= 0.9): rejected, no reward, user notified in-app.
- Low-confidence (Gemma < 0.9) but not duplicate: routed to human review queue.

### Spam Submissions

- First occurrence: Warning issued.
- Repeat occurrence: Submission rejected.

### Abuse and Penalty System

- Progressive penalty model:
  - First violation: Warning
  - Continued violation: Temporary suspension

## Knowledge Repository

Store per submission:

- Question content (text, image, video, audio)
- User metadata
- Agriculture domain tags
- Agro-climatic zone
- Season
- Validation score and confidence level
- Language
- Location (State, District, Block)
- Device information
- Crop type

## Administration

- User management (view, configure, suspend)
- Maximum user limit per state: 100 (configurable from admin dashboard)
- Admin dashboard integrated with existing reviewer system
- Question analytics
- Reward and payout analytics
- Fraud monitoring
- All analytics dashboards (see Analytics section)

---

# Analytics

## Dashboards

- Daily question volume
- State-wise analytics
- Crop-wise analytics
- Reward and payout analytics
- User engagement analytics
- Domain category analytics
- Additional dashboards as required

## Data Export Formats

- CSV
- Excel

---

# Data Governance

## Data Ownership

- Organization owns all submitted data.

## Data Retention

- Data retained indefinitely.

## Location Data Collected

- State
- District
- Block

---

# Compliance

## User Consent

- Mandatory digital consent required during registration.

## Privacy Policy

- Privacy policy must be displayed and accepted at registration.

## Audit Logging

- Basic logging of key system events and user actions.

---

# Non-Functional Requirements

## Performance

- API response latency: < 2 seconds
- Platform must support up to 100,000 concurrent users

## Availability

- Target uptime: 99.9%

## Security

- Encrypted communication (TLS/HTTPS)
- Basic audit logging
- Role-based access control (RBAC)

## Scalability

- Cloud-native architecture
- Horizontal scaling support

---

# Success Metrics

- Total Registered Users
- Monthly Active Users (MAU)
- Total Approved Questions
- Dataset Growth Rate
- Cost Per Approved Question
- User Retention Rate
- State-wise Participation Rate
- Average Question Quality Score

---

# Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| OQ-001 | Define exact metadata taxonomy for agro-climatic zones and domain categories | Data Science Team | Open |
| OQ-002 | Define digital consent format and legal requirements per state | Legal / Product Team | Open |
| OQ-003 | Define human review SLA for server-side question validation | Operations Team | Open |
| OQ-004 | Define exact semantic similarity threshold for duplicate detection | Engineering / AI Team | Closed — 0.9 |
| OQ-005 | Define video file size and duration limits for submissions | Engineering Team | Closed — 10 seconds duration, 10 MB size; configurable from admin dashboard |
| OQ-006 | Confirm list of supported regional languages at launch | Product Team | Closed — All 22 scheduled languages |

---

# Final Approval

Product Owner:

---

Date:

---

Version: 1.0

---
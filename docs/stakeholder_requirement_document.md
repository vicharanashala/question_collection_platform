# Stakeholder Requirement Gathering Document

## Project
Agriculture Knowledge Collection Platform

---

# 1. Business Objectives

## What is the primary objective of the platform?

Collect agriculture-related questions for dataset creation and build a centralized knowledge repository for AI model training, agricultural analytics, and government policy planning.

## Who funds user rewards?

Government program.

## What is the expected value of collected data?

- AI model training
- Agricultural analytics and insights
- Government policy planning
- Creation of a centralized agricultural dataset

---

# 2. User Eligibility

## Who can register on the platform?

- Individual Farmers and FPO (Farmer Producer Organization) Members
- Students from Agriculture Universities
- Volunteers and NGO Partners

## How should users be verified?

Mobile OTP plus manual verification based on onboarding details.

## What profile information should be mandatory?

- Name
- Mobile Number
- State
- District
- Crop Details
- Category-specific fields:
  - Students: Course name, University name
  - Farmers: Farm size, crop type
  - Others (Volunteers/NGOs): Organization name, role

## Which languages should be supported at launch?

All 22 Indian scheduled languages supported from day one:

Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri (Meitei), Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu, Urdu.

---

# 3. Question Submission

## What types of questions should be supported?

Text, Image, Video, and Audio.

**Video Constraints:** Maximum duration of 10 seconds and maximum file size of 10 MB. Both values are configurable from the admin dashboard.

## What should be the minimum question length?

No restriction.

## What should be the daily submission limit per user?

20 questions per user per day.

## Can users edit submitted questions?

Allowed within a dynamic 30-second window after submission. No editing after this window closes.

---

# 4. Agriculture Validation

## How should agriculture relevance be determined?

- On-device: AI-based agriculture relevance detection
- Server-side: AI with human review for final approval
- Low-confidence cases routed for human review

## What confidence threshold should be used for AI classification?

90 percent.

## How should duplicate questions be handled?

Combination of exact match and semantic similarity detection, performed both on-device and server-side. Semantic similarity threshold: **0.9**.

---

# 5. Reward System

## What reward model should be used?

Reward based on question quality, uniqueness, and approval from server-side AI and human review.

## What should be the reward per approved question?

| Questions Submitted | Reward Per Question |
|---|---|
| 1 - 25 | Rs. 1 |
| 26 - 250 | Rs. 5 |
| 251 - 500 | Rs. 10 |

## What should be the maximum daily reward limit?

No maximum daily reward limit.

## What should be the minimum withdrawal amount?

Rs. 50 (configurable from admin dashboard).

## Which payout methods should be supported?

- UPI
- Bank Transfer
- Internal wallet system for balance management

---

# 6. Fraud Prevention

## How should duplicate submissions be handled?

- On-device: Rejected immediately
- Server-side: Rejected after review; no reward issued
- In-app notification sent to user upon duplicate detection

## How should spam submissions be handled?

- First occurrence: Warning issued
- Repeat occurrence: Submission rejected

## What penalty system should be applied for abuse?

Progressive penalty model:
1. First violation: Warning
2. Continued violation: Temporary suspension

---

# 7. Data Collection

## What location data should be collected?

State, District, and Block.

## What additional metadata should be stored?

- Crop type
- Language
- Device information
- Agriculture domain category (e.g., crop protection, spray, irrigation)
- Season
- Agro-climatic zone
- Additional metadata as applicable

## Who owns the submitted data?

The organization owns all submitted data.

## How long should data be retained?

Indefinitely.

---

# 8. Analytics

## Do we need to integrate the admin dashboard with the existing system?

Yes. The admin dashboard must integrate with the existing reviewer system.

## How many maximum number of users and on what basis?

Maximum 100 users per state. This number can be configured from the admin dashboard.

## What analytics dashboards are required?

- Daily question volume
- State-wise analytics
- Crop-wise analytics
- Reward and payout analytics
- User engagement analytics
- Domain category analytics
- Additional dashboards as required

## In what formats should data be exportable?

CSV and Excel.

---

# 9. Compliance

## Is user consent mandatory?

Yes. Mandatory digital consent required during registration.

## Is a privacy policy required?

Yes. Privacy policy must be displayed and accepted at registration.

## What level of audit logging is required?

Basic logging of key system events and user actions.

---

# 10. Non-Functional Requirements

| Requirement | Target |
|---|---|
| API Response Latency | < 2 seconds |
| Concurrent Users | Up to 100,000 |
| Availability / Uptime | 99.9% |
| Security | TLS/HTTPS, RBAC |
| Architecture | Cloud-native, horizontally scalable |

---

# Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| OQ-001 | Define exact metadata taxonomy for agro-climatic zones and domain categories | Data Science Team | Open |
| OQ-002 | Define digital consent format and legal requirements per state | Legal / Product Team | Open |
| OQ-003 | Define human review SLA for server-side question validation | Operations Team | Open |
| OQ-004 | Define exact semantic similarity threshold for duplicate detection | Engineering / AI Team | Closed — 0.9 |
| OQ-005 | Define video file size and duration limits for submissions | Engineering Team | Closed — 10 seconds, 10 MB; configurable from admin dashboard |
| OQ-006 | Confirm list of supported regional languages at launch | Product Team | Closed — All 22 scheduled languages |

---

# Final Approval

Product Owner:

---

Date:

---

# Version
1.0

# Last Updated
2026-06-11
# Task: Introduce Question Curator Role

**Status:** Implemented on branch `feat/question-curator-role`

## Summary

Introduced a new `curator` role with **read-only and review-access** focused solely on questions and their metrics. This role has **no write, create, update, or delete permissions** on any resource.

---

## What the curator role CAN do

- View/list questions (all questions or filtered views)
- Review individual question details
- View question **metrics** (`GET /admin/questions/metrics`): volume by day/state/crop, approval rates, avg AI confidence, avg review turnaround
- Submit review decisions on questions (`POST /admin/questions/:id/review`) — approve/reject/request_info
- View the review queue (`GET /admin/questions/queue`)
- View the admin analytics dashboard (`GET /admin/analytics/dashboard`)
- View question detail for review (`GET /admin/questions/:id`)

## What the curator role CANNOT do

- Create, edit, or delete any question
- Access user management endpoints (list users, suspend, verify)
- Access system configuration
- Access withdrawal processing
- Access fraud monitoring
- Access reward summaries or reward logs
- Export any data

---

## Changes Made

### 1. Enum additions (`src/common/enums/index.ts`)
```typescript
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  CURATOR = 'curator',   // NEW
}

export enum ActorType {
  USER = 'user',
  ADMIN = 'admin',
  CURATOR = 'curator',   // NEW — for audit trail differentiation
  SYSTEM = 'system',
}
```

### 2. AdminController restructuring (`src/admin/admin.controller.ts`)
- Class-level `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)` — curator can access the controller by default
- Restricted sections (Users, Config, Withdrawals, Fraud, Rewards) override with `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` — curator is blocked
- Question review and metrics endpoints have no override — curator gets access
- `reviewQuestion` now passes `reviewerRole` to the service for correct `ActorType` in audit logs

### 3. New question metrics endpoint (`src/admin/admin.controller.ts` + `src/admin/admin.service.ts`)
```
GET /admin/questions/metrics
```
Returns:
- Period summary (total, approved, rejected, pending, in_ai_review, in_human_review, duplicates, approval_rate, rejection_rate)
- Daily submission volume (total/approved/rejected per day)
- Top 10 crops by volume
- State breakdown
- Average AI confidence score
- Average review turnaround time (minutes)

### 4. `reviewQuestion` updated (`src/admin/admin.service.ts`)
- New `reviewerRole` parameter (defaults to `UserRole.ADMIN`)
- Uses `ActorType.CURATOR` in audit logs when reviewer is a curator
- All three actions (approve/reject/request_info) are now audited

---

## API Surface for Curator

| Method | Path | Access |
|--------|------|--------|
| GET | /admin/questions/queue | ✅ |
| GET | /admin/questions/:id | ✅ |
| POST | /admin/questions/:id/review | ✅ |
| GET | /admin/questions/metrics | ✅ |
| GET | /admin/analytics/dashboard | ✅ |
| GET | /admin/users/* | ❌ |
| GET | /admin/config | ❌ |
| GET | /admin/analytics/rewards | ❌ |
| GET | /admin/analytics/reward-logs | ❌ |
| GET | /admin/fraud | ❌ |
| GET | /admin/withdrawals | ❌ |
| GET | /admin/export | ❌ |

---

## Notes
- The curator role cannot perform any write operations on questions through the `QuestionController` (submit/patch routes) — those are user-role-gated via JWT only.
- Audit logs distinguish between admin and curator actions via `ActorType.CURATOR`.
- DB migration not needed — `CURATOR = 'curator'` is a new enum value, no column changes required (existing code already stores role as a string).
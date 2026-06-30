# Admin Operations

## Project
Agriculture Knowledge Collection Platform

---

## Overview

The admin dashboard is a React/Vite web application. Admin users are assigned roles that determine which operations they can perform. Actions are logged to `audit_logs` with actor, action, entity, old/new values, and a reason field.

**Roles and capabilities:**

| Capability | Curator | Finance | Admin | Super Admin |
|---|---|---|---|---|
| View question review queue | Yes | Yes | Yes | Yes |
| Review questions (approve/reject/hold) | Yes | — | Yes | Yes |
| View analytics dashboard | Yes | Yes | Yes | Yes |
| View questions metrics | Yes | — | Yes | Yes |
| View reward summary/logs | Yes | — | Yes | Yes |
| View users | — | Yes | Yes | Yes |
| Create users | — | Yes | Yes | Yes |
| Suspend / ban users | — | Yes | Yes | Yes |
| Unsuspend / unban | — | — | — | Yes |
| Verify users | — | Yes | Yes | Yes |
| View / process withdrawals | — | Yes | Yes | Yes |
| View wallets | — | Yes | Yes | Yes |
| Adjust wallet balance | — | — | — | Yes |
| View fraud stats | — | Yes | Yes | Yes |
| View / edit config | — | Yes | Yes | Yes |
| View audit logs | — | — | Yes | Yes |
| Export data | — | Yes | Yes | Yes |
| Retry failed withdrawal | — | Yes | Yes | Yes |
| Retry-with-refund failed withdrawal | — | Yes | Yes | Yes |
| Mark withdrawal as failed | — | Yes | Yes | Yes |
| Update failure reason | — | Yes | Yes | Yes |

---

## 1. User Management

### 1.1 Creating a User (Admin/Finance/Super Admin)

Admins can create user accounts directly without OTP verification — useful for offline registrations.

```
POST /admin/users
{
  "mobileNumber": "9876543210",
  "name": "Ramesh Kumar",
  "category": "farmer",
  "state": "Maharashtra",
  "district": "Pune",
  "role": "user",
  "verificationStatus": "verified"   // can pre-verify
}
```

A wallet is automatically created when the user first logs in (lazy creation on first auth).

### 1.2 Suspending a User

Suspension is temporary; the account is locked until `suspended_until` or until an admin unsuspends.

```
POST /admin/users/:id/suspend
{
  "action": "suspend",
  "reason": "Investigation for policy violation",
  "suspendedUntil": "2026-07-15T00:00:00Z"
}
```

**Effect:** User cannot log in or submit questions. `users.suspended_at`, `suspended_until`, `suspended_reason` are set.

### 1.3 Banning a User

Permanent account termination. Cannot be undone via suspend endpoint — only via `unsuspend` if not fully banned.

```
POST /admin/users/:id/suspend
{
  "action": "ban",
  "reason": "Repeated spam and abuse"
}
```

**Effect:** `users.banned_at` and `banned_reason` set. All tokens invalidated.

### 1.4 Unsuspending / Unbanning

```
POST /admin/users/:id/unsuspend
```

Only `super_admin` can unsuspend or unban. Clears `suspended_at`, `suspended_until`, `suspended_reason`, `banned_at`, `banned_reason`.

### 1.5 Verifying a User

Sets `verification_status = 'verified'` for the user.

```
POST /admin/users/:id/verify
```

Used when a user's offline/KYC documents were verified manually.

### 1.6 State-Level User Limits

The `max_users_per_state` config (default: 100) is enforced at **registration time** in the `user` module. When the limit is reached for a state, new registrations from that state are rejected with a `400` error.

---

## 2. Question Review

### 2.1 The Review Queue

Questions land in the human review queue (`status = HUMAN_REVIEW`) when:
- Gemma confidence < 0.9, OR
- GDB similarity score between 0.7 and 0.9 (suspected duplicate but below threshold)

The queue is accessible at `GET /admin/questions/queue` with filters for language, state, crop, domain, and search.

### 2.2 Review Actions

```
POST /admin/questions/:id/review
```

| action | Effect |
|---|---|
| `approve` | Status → `APPROVED`. Reward credited per tier. LLM generates approval note. |
| `reject` | Status → `REJECTED`. No reward. LLM generates rejection note. User notified. |
| `hold` | Status stays `HUMAN_REVIEW`. `heldReason` set. User notified. |

The curator or admin can supply a `reason` string which is passed to the LLM for note generation and stored in the audit log.

### 2.3 Curator Read-Only Views

Curators can:
- View the full review queue
- View individual question details
- View question metrics (volume, approval rate)

Curators **cannot** approve/reject/hold, view user financial data, or process withdrawals.

---

## 3. Withdrawal Management

### 3.1 Withdrawal Lifecycle

See [Payment Flow](./payment-flow.md) for the complete state machine.

### 3.2 Processing a Withdrawal

```
POST /admin/withdrawals/:id/process { action: "approve" }
```

- Sets `status → PROCESSING`
- Calls `RazorpayPayoutService.createPayout()`
- On success: webhook will later update to `COMPLETED` with UTR
- On failure: admin can retry or mark as failed

```
POST /admin/withdrawals/:id/process { action: "reject", reason: "..." }
```

- Sets `status → CANCELLED`
- Wallet is credited (source: `refund`)
- User notified

### 3.3 Retrying a Failed Withdrawal

```
POST /admin/withdrawals/:id/retry
```

Available when `status = FAILED` and `retry_count ≤ 3`. Resets to `PROCESSING` and re-attempts the payout.

```
POST /admin/withdrawals/:id/retry-refund
```

Available when the withdrawal was already refunded (e.g. second payout attempt failed and was refunded). Resets to `PROCESSING`, debits the refund transaction, re-attempts payout.

### 3.4 Marking as Failed Manually

```
POST /admin/withdrawals/:id/fail { "reason": "Bank account closed" }
```

Used when the admin knows the payout cannot succeed. Marks `PROCESSING` → `FAILED`, credits wallet, notifies user.

```
PATCH /admin/withdrawals/:id/failure-reason { "reason": "Updated: account closed" }
```

Allows updating the failure reason after the fact.

---

## 4. Wallet Management

### 4.1 Viewing Any Wallet

```
GET /admin/wallets/user/:userId
GET /admin/wallets/user/:userId/transactions
GET /admin/wallets/user/:userId/withdrawals
```

### 4.2 Wallet Adjustment (Super Admin only)

```
POST /admin/wallets/adjust
{
  "userId": "uuid",
  "amount": 500,
  "type": "credit",           // or "debit"
  "reason": "Correcting missed reward for Q3 batch"
}
```

Creates a transaction with `source = adjustment`. The full old/new values and admin reason are written to `audit_logs`.

### 4.3 Listing All Wallets

```
GET /admin/wallets?search=ramesh&state=maharashtra&sortBy=balance&sortOrder=DESC
```

Returns all wallets with user name and current balance, filterable and sortable.

---

## 5. Configuration Management

All runtime config is in `admin_config` table, editable from Settings page.

### 5.1 Viewing Config

```
GET /admin/config
```

Returns all config keys with their current values, descriptions, and last-updated timestamp.

### 5.2 Creating a New Config Key

```
POST /admin/config
{ "key": "custom_feature_flag", "value": true, "description": "Enables new flow" }
```

### 5.3 Updating a Config Value

```
PATCH /admin/config
{ "key": "min_withdrawal_amount", "value": 100 }
```

All config values are cached in-memory (30-second TTL). The service reads from cache first; a background refresh fetches from DB every 30 seconds.

### 5.4 Live Config Keys

| Key | Default | Description |
|---|---|---|
| `max_users_per_state` | 100 | Max registrations per state |
| `daily_question_limit` | 20 | Max questions per user per day |
| `question_edit_window_seconds` | 30 | Edit window after submit |
| `duplicate_similarity_threshold` | 0.9 | GDB similarity threshold |
| `video_max_duration_seconds` | 10 | Max video duration |
| `video_max_size_mb` | 10 | Max video file size |
| `max_question_chars` | 1000 | Max question text length |
| `max_image_size_mb` | 5 | Max image file size |
| `min_withdrawal_amount` | 50 | Min withdrawal amount (INR) |

---

## 6. Analytics & Reporting

### 6.1 Dashboard Stats

```
GET /admin/stats
GET /admin/analytics/dashboard
```

Returns:
- Total users, questions, approvals, rejections (for the date range)
- Daily volume trend (for chart)
- State-wise breakdown
- Domain-wise breakdown
- Reward totals

### 6.2 Question Metrics

```
GET /admin/questions/metrics
```

Volume + approval/rejection/human-review counts by day, state, crop, domain.

### 6.3 Reward Logs

```
GET /admin/analytics/reward-logs
```

Paginated list of all reward transactions with user info, question info, amount, tier at time of approval.

### 6.4 Reward Summary

```
GET /admin/analytics/rewards
```

Aggregated totals: total rewards credited, total questions approved, average reward per question, tier distribution.

### 6.5 Financial Summary (Finance/Admin)

```
GET /admin/analytics/financial-summary
```

Total withdrawn, total failed, total refunded, net payout outflow.

### 6.6 Fraud Stats

```
GET /admin/fraud
```

Per-user violation counts by type (duplicate, spam, abuse), suspensions, bans.

---

## 7. Audit Logging

Every state-changing admin action is recorded:

```
POST /admin/users/:id/suspend → audit_log { action: USER_SUSPENDED, entity: user }
POST /admin/questions/:id/review → audit_log { action: QUESTION_APPROVED/REJECTED }
POST /admin/wallets/adjust → audit_log { action: WALLET_ADJUSTED, old_value, new_value }
POST /admin/withdrawals/:id/process → audit_log { action: WITHDRAWAL_PROCESSED }
POST /admin/config → audit_log { action: CONFIG_UPDATED }
```

The audit log service supports:
- Filtering by actor, action, entity type, date range
- Entity history: all changes to a specific question/user/wallet
- Actor stats: count of actions per admin
- Summary with configurable granularity (daily/weekly/monthly)

---

## 8. Data Export

```
GET /admin/export?dataType=questions&format=csv&startDate=2026-06-01
GET /export/csv?dataType=transactions&state=Maharashtra
GET /export/excel?dataType=withdrawals&status=COMPLETED
```

| dataType | Columns |
|---|---|
| `users` | id, mobile, name, category, state, district, verificationStatus, createdAt |
| `questions` | id, userId, language, domains, season, cropType, status, submittedAt, reviewedAt |
| `transactions` | id, walletId, type, source, amount, balanceAfter, referenceId, status, createdAt |
| `withdrawals` | id, userId, amount, payoutMethod, status, utrNumber, processedAt, failureReason |

---

*Last Updated: 2026-06-30*
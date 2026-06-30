# Reward Policy

## Project
Agriculture Knowledge Collection Platform

---

## Overview

Users earn a reward for every approved question. The reward amount is determined by which **tier** the user is in at the time of approval, based on their cumulative count of approved questions.

---

## Reward Tiers

The tier is determined by the **total number of approved questions the user has ever had**, including the current one being approved.

| Tier | Approved questions (cumulative) | Reward per approved question |
|---|---|---|
| 1 | 1 – 25 | ₹1 |
| 2 | 26 – 250 | ₹5 |
| 3 | 251+ | ₹10 |

**Tier 3 has no upper cap.** All approved questions beyond 250 earn ₹10 each.

---

## Tier Transition Example

A user's question count and reward earned over time:

| Approval # | Total approved | Tier | Reward earned |
|---|---|---|---|
| 1 | 1 | 1 | ₹1 |
| 25 | 25 | 1 | ₹1 |
| 26 | 26 | 2 | ₹5 |
| 100 | 100 | 2 | ₹5 |
| 251 | 251 | 3 | ₹10 |
| 500 | 500 | 3 | ₹10 |
| 1000 | 1000 | 3 | ₹10 |

---

## Reward Credit Flow

```
[Question approved (auto or curator)]
        │
        ▼
  Count approved questions for user
  (before counting this one)
        │
        ▼
  Determine tier from count + 1:
  1–25  → Tier 1 → ₹1
  26–250 → Tier 2 → ₹5
  251+  → Tier 3 → ₹10
        │
        ▼
  Pessimistic lock wallet
  wallet.balance += reward
        │
        ▼
  Create Transaction:
  type=credit, source=reward,
  amount=<tier reward>,
  balance_after=<new balance>,
  reference_id=question.id,
  status=completed
        │
        ▼
  Create Notification:
  type=question_approved,
  title="Question Approved!",
  body="Your question has been approved. ₹X credited to your wallet."
```

---

## Tier Query (Client-Side)

The mobile app maintains a local count of approved questions to compute the tier locally. The `GET /wallets/me/tier?approvedCount=N` endpoint also returns the tier from the server:

```
GET /wallets/me/tier?approvedCount=42

Response:
{
  "tier": 2,
  "rewardPerQuestion": 5,
  "nextTierAt": 251,
  "maxApproved": 250
}
```

---

## What Qualifies for a Reward

A question earns a reward when:
1. It is approved — either automatically (Gemma confidence ≥ 0.9 and no semantic duplicate) or manually by a curator/admin
2. The `status` transitions to `APPROVED`

A question earns **no reward** when:
- It is rejected (wrong category, spam, abuse, duplicate)
- It is still in `HUMAN_REVIEW` queue
- It is in `PENDING` or `AI_REVIEW` state
- It is flagged as a semantic duplicate (`duplicateFlag = true`)

---

## Wallet Transaction Sources

The `transactions.source` field values:

| Source | Meaning |
|---|---|
| `reward` | Reward credit for an approved question |
| `withdrawal` | Debit when user initiates a withdrawal request |
| `refund` | Credit when a withdrawal fails or is cancelled |
| `adjustment` | Manual credit/debit by super_admin via wallet adjustment |
| `verification_charge` | Debit of ₹1 when PineLabs micro-transaction is used (deprecated) |

---

## Minimum Withdrawal

The minimum amount that can be withdrawn is defined by the `min_withdrawal_amount` config key (default: **₹50**). This is configurable by admins at runtime.

---

## No Maximum Reward Cap

There is no maximum amount a user can earn per day or in total. Each approved question earns the applicable tier rate indefinitely.

---

## Source Code Reference

The tier logic is defined as a constant in `backend/src/wallets/wallets.service.ts`:

```typescript
export const REWARD_TIERS = [
  { minApproved: 1,  maxApproved: 25,  reward: 1  },
  { minApproved: 26, maxApproved: 250, reward: 5  },
  { minApproved: 251, maxApproved: Infinity, reward: 10 },
];
```

---

*Last Updated: 2026-06-30*
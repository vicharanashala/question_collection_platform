# User Flow Document

## Project
Agriculture Knowledge Collection Platform

---

## 1. Authentication

### 1.1 New User Registration

```
[Open app] → [Enter mobile number] → [Tap "Send OTP"]
                                        │
                               ┌────────┴────────┐
                               │ OTP sent (3 req  │
                               │ per 15 min max)  │
                               └────────┬────────┘
                                        ▼
                               [Enter 6-digit OTP]
                                        │
                               ┌────────┴────────┐
                               │  Valid OTP?      │
                               │  (5 min expiry)  │
                               └────────┬────────┘
                                 No     │  Yes
                                 ▼      ▼
                          [Resend OTP]  [Check isRegistered flag]
                                          │
                                  ┌───────┴────────┐
                                  │ isRegistered   │
                                  │ true | false   │
                                  └───────┬────────┘
                                    false  │  true
                                     ┌─────┘  │
                                     ▼        ▼
                            [Consent screen]  [Main Dashboard]
                                     │
                                     ▼
                            [Accept privacy policy]
                                     │
                                     ▼
                            [Select category]
                           /    │    \      \
                          ▼     ▼     ▼      ▼
                      Farmer  FPO  Student  Volunteer / NGO
                          \    /    \       /
                           ▼    ▼    ▼      ▼
                    [Category-specific form]
                     (name, state, district, language,
                      farm_size/course/org details)
                                     │
                                     ▼
                            [Tap "Register"]
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │  POST /auth/register           │
                    │  (mobile, name, category,      │
                    │   state, district, consent)    │
                    └────────────────────────────────┘
                                     │
                                     ▼
                            [Wallet auto-created]
                                     │
                                     ▼
                           [Welcome + Dashboard]
```

### 1.2 Login (Returning User)

```
[Open app] → [Enter mobile] → [Send OTP] → [Enter OTP] → [Valid?]
                                                               │
                                                              Yes
                                                               │
                                                               ▼
                                              [JWT issued, Main Dashboard]
```

**Session invalidation:** Every login increments `users.token_version`, immediately revoking all previously issued tokens (useful for credential-theft response).

### 1.3 Logout

```
[Profile] → [Logout] → POST /auth/logout → token_version++
                                        →
                                 [Login screen]
```

---

## 2. Question Submission

### 2.1 Filling the Form

```
[Dashboard] → [Ask a Question] → [Select language]
  (22 languages: as, bn, brx, doi, gu, hi, kn, ks, kok, mai,
   ml, mni, mr, ne, or, pa, sa, sat, sd, ta, te, ur)
                                        │
                                        ▼
                              [Select domain(s)]
                            crop_protection, spray,
                            irrigation, fertilizer,
                            weed_management,
                            harvest_post_harvest,
                            livestock_poultry,
                            fisheries, apiary,
                            farm_machinery,
                            soil_management,
                            weather_pest_alert
                                        │
                                        ▼
                              [Select season]
                             kharif | rabi | zaid | year_round
                             (auto-derived from current month
                              but user can override)
                                        │
                                        ▼
                            [Select / confirm crop]
                                        │
                                        ▼
                          [Enter question text]
                          (max 1000 chars;
                           image: required when mediaType=image)
                                        │
                                        ▼
                            [Attach media (optional)]
                           none | image | video | audio
                                        │
                               ┌───────┴───────┐
                               ▼               ▼
                        [Video/Audio]      [Image]
                               │               │
                               ▼               ▼
                   Record via phone       Upload image
                   mic; max 10 MB,        (JPEG/PNG/WEBP;
                   max 10 seconds         max 5 MB)
                                        │
                                        ▼
                        [Tap "Preview"]
```

### 2.2 Preview

```
POST /questions/preview
        │
        ▼
  Gemma inference → cropType, domains, confidence
        │
        ▼
  GDB semantic duplicate check { questionText, crop, state }
  (runs at preview only — not persisted to DB)
        │
        │ isDuplicate = true ?
        ├─ YES → duplicate result included in response
        │        (matched question + answer shown to user)
        └─ NO → response.duplicate = null
        │
        ▼
  Season derived from current month
  (Kharif: Jun–Oct, Rabi: Nov–Mar, Zaid: Apr–May)
        │
        ▼
  AgroClimaticZone derived from state
        │
        ▼
  Response:
  {
    valid: true,
    cropType: "soybean",
    domains: ["crop_protection"],
    season: "kharif",
    agroClimaticZone: "Western Plateau and Hills",
    duplicate: {           // present only when GDB found a match
      isDuplicate: true,
      matchedQuestion: "...",
      matchedAnswer: "...",
      similarityScore: 0.94
    },
    message: null
  }
        │
        ▼
  [User reviews preview, edits if needed]
        │
   ┌────┴────┐
   ▼         ▼
 Confirm    Edit (text/domain/season/crop)
   │         │
   │         └── Returns to Preview
   │
   ▼
  [Tap "Submit"]
```

### 2.3 Submit

```
POST /questions
        │
        ▼
  1. JWT auth check
  2. Daily limit check (admin_config: daily_question_limit)
  3. Image media check (URL required when mediaType=image)
  4. Exact-duplicate check (text match on existing questions)
     → duplicate found → status: REJECTED, user notified immediately
        │
        ▼
  5. Gemma inference → confidence score
        │
        ▼
  [confidence ≥ 0.9 ?]
       Yes                               No
        │                                │
        ▼                                ▼
  [status: PENDING]           [status: HUMAN_REVIEW]
  (awaits curator              (curator review queue)
   review)
        │
        ▼
  6. EmbedService.embed()
     → stored in questions.embedding
        │
        ▼
  [Question saved]
  → editWindowClosesAt set (30s from now)
  → submittedAt set

Note: GDB semantic search only runs at preview time, not at submit.
      It is a pre-submission warning tool, not a gatekeeper.
      No question is auto-approved — all non-rejected questions
      enter the review queue (PENDING or HUMAN_REVIEW).
```

### 2.4 Edit Window

Immediately after submit, a **30-second edit window** opens:

```
[Submitted] → [Edit window active for 30s]
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   [User edits within 30s]    [No edit]
         │                         │
         ▼                         │
  PATCH /questions/:id           Done
  (validates updated text)        (question locked)
         │
         ▼
  [Question re-validated, edit window stays open]
```

After 30 seconds, the question is locked from editing.

### 2.5 Voice Questions

```
[Select language] → [Tap microphone]
        │
        ▼
  Rolling chunks → POST /speech/transcribe-chunk
  (per chunk: audio file + languageCode + sequenceNumber)
        │
        ▼
  Transcript accumulated in app UI
        │
        ▼
  [User stops] → POST /speech/transcribe-final
        │
        ▼
  Full transcript auto-filled into questionText
        │
        ▼
  Continue from Preview step
```

---

## 3. Reward System

### 3.1 Tier Structure

Questions are rewarded based on the **total approved question count** for the user, across all time:

| Tier | Approved questions | Reward per question |
|---|---|---|
| 1 | 1 – 25 | ₹1 |
| 2 | 26 – 250 | ₹5 |
| 3 | 251+ | ₹10 |

The tier is computed at approval time (not at submission time), so crossing a tier threshold retroactively applies the new rate to the approving question.

### 3.2 Reward Credit Flow

```
[Question approved by curator — POST /admin/questions/:id/review { action: "approve" }]
        │
        ▼
  Count approved questions for user
  (excluding this one, before saving)
        │
        ▼
  Determine tier:
  count 1–25  → tier 1 → ₹1
  count 26–250 → tier 2 → ₹5
  count 251+   → tier 3 → ₹10
        │
        ▼
  [Pessimistic lock wallet]
        │
        ▼
  wallet.balance += reward
        │
        ▼
  Create Transaction:
  type=credit, source=reward,
  amount=reward, balance_after=newBalance,
  reference_id=question.id, status=completed
        │
        ▼
  [In-app notification: "Question approved! ₹X credited"]
```

---

## 4. Payment Detail Management

### 4.1 Adding a Payment Detail

```
[Wallet] → [Manage Payment Methods] → [Add New]
        │
   ┌────┴─────────────────────────┐
   ▼                              ▼
 UPI                        Bank Transfer
   │                              │
   ▼                              ▼
[Enter UPI ID]           [Enter account number,
                           IFSC, holder name]
       │                        │
       ▼                        ▼
  POST /wallets/payment-details
  {
    payoutMethod: "upi",
    upiId: "user@upi"
  }
                           │
                           ▼
              POST /wallets/payment-details
              {
                payoutMethod: "bank_transfer",
                accountNumber: "...",
                ifsc: "SBIN0001234",
                accountHolderName: "..."
              }
        │
        ▼
  user_payment_detail created
  status = in_progress
        │
        ▼
  Razorpay Fund Account created
  POST /v1/fund_accounts
        │
        ▼
  Razorpay validation initiated
  POST /v1/fund_accounts/validations
        │
        ▼
  razorpayValidationId stored
  [Awaiting webhook]
        │
   ┌────┴───────────────────────────┐
   │    webhook: fund_account.      │
   │    validated OR                │
   │    fund_account.               │
   │    validation_failed           │
   └────┬───────────────────────────┘
        │
   ┌────┴────┐
   │ Success │ Fail
   │    │    │
   │    ▼    ▼
   │status  status = failed
   │=verified  verification_
   │verified_at  failed_reason
   │set       set
   │    │    │
   └────┴────┘
        │
        ▼
  [Detail available for withdrawal use]
```

### 4.2 Deleting a Payment Detail

Only non-verified details can be deleted:
```
[Wallet] → [Payment Methods] → [Delete icon]
        │
  [status = verified ?] ── Yes ──► [Delete blocked]
        │
       No
        │
        ▼
  DELETE /wallets/payment-details/:id
        │
        ▼
  [Detail removed]
```

---

## 5. Withdrawal Flow

```
[Wallet] → [Withdraw]
        │
        ▼
  Show: balance, min_withdrawal_amount (₹50),
        available payment details
        │
        ▼
  [Select payment detail] (must be verified)
  [Enter amount]
        │
        ▼
  [Balance ≥ amount?] ── No ──► [Show error]
        │
       Yes
        │
        ▼
  [No pending withdrawal exists?] ── No ──► [Show error]
        │
       Yes
        │
        ▼
  [Tap "Request Withdrawal"]
        │
        ▼
  POST /wallets/withdraw
        │
        ▼
  [Atomic transaction]
  • wallet.balance -= amount
  • withdrawal_request created (status: PENDING)
  • transaction: type=debit, source=withdrawal, status=pending
        │
        ▼
  [Withdrawal in admin queue]
        │
        ▼
  [User can cancel if still PENDING]
  DELETE /wallets/withdrawals/:id
```

### 5.1 Withdrawal States

```
PENDING ──── [Admin approves] ────► PROCESSING ──── [Razorpay payout success] ────► COMPLETED
   │                                       │                                        │
   │                                       │                                        ▼
   │                                       │                                   UTR saved
   │                                       │                                   processed_at set
   │                                       ▼
   │                               [Payout fails]
   │                                       │
   │                              ┌────────┴────────┐
   │                              ▼                 ▼
   │                        [retry_count≤3]   [retry_count>3]
   │                              │                 │
   │                              ▼                 ▼
   │                        Manual retry      Mark FAILED
   │                        via admin           │
   │                              │              ▼
   │                              │        Wallet CREDIT
   │                              │        source=refund
   │                              │        transaction.status=completed
   │                              │              │
   ▼                              │              ▼
[Cancelled by user]               │         User notified
withdrawal.cancelled_at set       │         via notification
wallet CREDIT (source=refund)
```

---

## 6. Admin Review Flows

### 6.1 Curator Review Queue

Questions enter the human-review queue when:
- Gemma confidence < 0.9

```
[Curator logs in to Web Dashboard]
        │
        ▼
  /admin/questions/queue
  (questions with status = HUMAN_REVIEW)
        │
        ▼
  [Select question] → View:
  - questionText, media (if any)
  - language, domain, crop, season
  - user profile
  - Gemma confidence score
        │
        ▼
  [Approve] ──► POST /admin/questions/:id/review { action: "approve", reason: "..." }
                 → reward credited
                 → status → APPROVED
                 → approvalReason set from reason field
        │
        ▼
  [Reject] ────► POST /admin/questions/:id/review { action: "reject", reason: "..." }
                 → no reward
                 → status → REJECTED
                 → rejectionReason set from reason field
                 → user notified
        │
        ▼
  [Hold] ──────► POST /admin/questions/:id/review { action: "hold", reason: "..." }
                 → status stays HUMAN_REVIEW
                 → heldReason set
                 → user notified
```

### 6.2 Withdrawal Processing (Finance/Admin)

```
[Finance/admin opens Withdrawals]
        │
        ▼
  /admin/withdrawals?status=PENDING
        │
        ▼
  [Select withdrawal] → View:
  - user profile + payment detail
  - amount, payout method
  - transaction history
        │
        ▼
  [Approve] ──► POST /admin/withdrawals/:id/process { action: "approve" }
                 → status → PROCESSING
                 → Razorpay payout initiated
                 │
                 ▼
          [Webhook: payout.processed]
                 │
                 ▼
          status → COMPLETED; UTR saved
        │
        ▼
  [Reject] ────► POST /admin/withdrawals/:id/process { action: "reject", reason: "..." }
                 → status → CANCELLED
                 → wallet CREDIT (source=refund)
                 → user notified
```

### 6.3 Wallet Adjustment (Super Admin only)

```
[Super admin opens Wallets] → [Select user] → [Adjust Balance]
        │
        ▼
  POST /admin/wallets/adjust
  { userId, amount, type: "credit" | "debit", reason: "..." }
        │
        ▼
  Transaction created (source: adjustment)
  [Recorded in audit_logs]
        │
        ▼
  [User notified of adjustment]
```

---

## 7. Web Dashboard Pages

The admin dashboard (`web/src/pages/`) has these views:

| Page | URL | Purpose |
|---|---|---|
| Dashboard | `/` | Stats overview, chart data |
| Users | `/users` | List/search/suspend/ban/verify users |
| Reviews | `/reviews` | Curator review queue |
| Questions | `/questions` | Full question list + status filters |
| Withdrawals | `/withdrawals` | Withdrawal queue + process |
| Wallets | `/wallets` | All wallets, balance, adjust |
| Audit Logs | `/audit-logs` | Full audit trail |
| Notifications | `/notifications` | View/manage system notifications |
| Settings | `/settings` | Edit admin_config values |
| Profile | `/profile` | Admin's own profile |

---

*Last Updated: 2026-06-30*
# Payment Flow

## Project
Agriculture Knowledge Collection Platform

---

## Overview

The platform supports two payout methods — **UPI** and **Bank Transfer** — and uses two payment providers:

| Provider | Purpose | Environment |
|---|---|---|
| **RazorpayX** | Fund account validation (verifying payment detail ownership) + disbursement payouts | Production |
| **PineLabs** | Legacy micro-transaction verification (deprecated) | Production |
| **Mock** | Both providers simulate success/failure responses | Development (`PINELABS_MOCK_VERIFICATION=true`) |

The active flow for new users is **Razorpay Fund Account validation** → **Razorpay Payout**.

---

## 1. Payment Detail Lifecycle

```
[User submits payout detail]
          │
          ▼
   Save to user_payment_details
   status = in_progress
          │
          ▼
  Is payoutMethod = upi AND
  PINELABS_MOCK_VERIFICATION = true ?
          │
     Yes  │  No (real flow)
      ┌───┘  │
      ▼      ▼
auto-verify   Razorpay Fund Account
(skip PineLabs)  create
      │              │
      │         POST /v1/fund_accounts
      │              │
      │         razorpayFundAccountId stored
      │              │
      │         POST /v1/fund_accounts/validations
      │              │
      │         razorpayValidationId stored
      │              │
      │         ┌────┴──────────┐
      │    [webhook]        [webhook]
      │    fund_account.    fund_account.
      │    validated        validation_failed
      │         │                  │
      │         ▼                  ▼
      │   status=verified    status=failed
      │   verified_at set    verification_
      │                       failed_reason set
      ▼                       ▼
  [Payment detail ready for withdrawal use]
```

**States of `user_payment_details.status`:**

| Status | Meaning |
|---|---|
| `pending` | Newly created, validation not started |
| `in_progress` | Razorpay fund account created, awaiting validation webhook |
| `verified` | Validation succeeded — detail can be used for withdrawal |
| `failed` | Validation failed — detail cannot be used |

---

## 2. Withdrawal Request Flow

```
[User requests withdrawal]
          │
          ▼
   Check preconditions:
   • Balance ≥ amount
   • Amount ≥ min_withdrawal_amount
   • No existing PENDING/PROCESSING withdrawal
   • paymentDetailId is verified
          │
         OK│not OK
      ┌────┘────┐
      ▼         ▼
  [Atomic transaction]  [Error returned]
  • Wallet DEBIT
  • withdrawal_request created (status: PENDING)
  • transaction created (type: debit, source: withdrawal, status: pending)
          │
          ▼
  [Withdrawal appears in admin queue]
```

---

## 3. Admin Payout Processing

When a FINANCE or ADMIN user approves a pending withdrawal:

```
[Admin calls POST /admin/withdrawals/:id/process { action: "approve" }]
          │
          ▼
  withdrawal.status = PROCESSING
  withdrawal.save()
          │
          ▼
  Fetch UserPaymentDetail
  (must be status = verified)
          │
          ▼
  RazorpayPayoutService.createPayout()
  POST /v1/payouts
  {
    account_number: decrypt(account_number_encrypted),
    fund_account_id: razorpayFundAccountId,
    amount: amount_in_paisa,
    currency: "INR",
    mode: "UPI" | "IMPS",
    purpose: "payout"
  }
          │
     ┌────┴────────────────────────┐
     │                              │
     ▼                              ▼
[Payout success]              [Payout failure]
     │                              │
     │                         withdrawal.status = FAILED
     │                         failure_reason set
     │                              │
     │                         ┌────┴────┐
     │                    retry_count>3?  retry_count≤3
     │                         │              │
     │                         ▼              ▼
     │                   [No auto-retry]  [retryWithdrawal()]
     │                                        │
     │                                        ▼
     │                               Re-attempt payout
     │                                        │
     │                            ┌───────────┴──────────┐
     │                            ▼                      ▼
     │                     [Success]              [Failed again]
     │                            │                      │
     │                            ▼            creditReversedWithdrawal()
     │                     withdrawal.status    wallet CRREDIT (source=refund)
     │                     = COMPLETED          transaction (source=refund)
     │                     utr_number saved
     │                     processed_at set
     │                     withdrawal.transaction
     │                     status → completed
     │                            │
     ▼                            │
[Notify user via in-app notification]  ──► status = FAILED
                                           (user notified)
```

---

## 4. Refund / Reversal Flow

When a payout is reversed by the bank or Razorpay:

```
[Razorpay sends payout.reversed webhook]
          │
          ▼
  creditReversedWithdrawal()
          │
          ├─ Wallet CREDIT (amount = withdrawal.amount)
          │   transaction: type=credit, source=refund, status=completed
          │
          ├─ withdrawal.status → FAILED
          │   failure_reason → "Payout reversed by bank"
          │
          └─ Notification to user: "Withdrawal of ₹X failed. Amount refunded to wallet."
```

---

## 5. PineLabs Micro-Transaction (Deprecated)

> **Deprecation note:** PineLabs micro-transaction verification (`verificationOrderId` column) is deprecated. The current flow uses Razorpay Fund Account validation instead. The PineLabs fields (`order_id`, `pinelabs_transaction_id`) and `verification_order_id` on `user_payment_details` are retained for backward compatibility with in-flight verifications.

**Old flow (retained for existing records):**

```
[User adds bank payment detail]
          │
          ▼
  Create withdrawal_request (status: pending)
  with withdrawal_request_id linked to user_payment_detail
          │
          ▼
  PinelabsService.initiatePayment()
  POST /epi/api/v1/order/processtxn
  order_id = withdrawal_request.orderId
          │
          ▼
  [PineLabs processes ₹1 micro-transaction]
  → Success: user_payment_detail.verified_at set, status → verified
  → Failure: verification_failed_reason set, status → failed
          │
          ▼
  withdrawal_request status updated
```

---

## 6. Payment Log

Every payment attempt — successful, failed, or retried — is recorded in `payment_logs`:

| Column | Description |
|---|---|
| `withdrawal_request_id` | Links to the withdrawal |
| `admin_id` | Who initiated (for retries) |
| `order_id` | PineLabs idempotency key |
| `pinelabs_transaction_id` | PineLabs transaction ID |
| `razorpay_payout_id` | Razorpay payout ID |
| `utr_number` | UTR from bank (Razorpay) |
| `status` | `initiated` \| `success` \| `failed` \| `pending` \| `reversed` |
| `error_code` | PineLabs error code |
| `error_message` | PineLabs error message |
| `raw_response` | Full API response as JSONB |

---

## 7. Key Constraints

| Rule | Value |
|---|---|
| Minimum withdrawal | `min_withdrawal_amount` (default ₹50) |
| One pending withdrawal per user | Enforced at request time |
| Payout method must be verified | Before withdrawal can be requested |
| Max retries per withdrawal | 3 (manual via `/admin/withdrawals/:id/retry`) |
| Refund on failure/reversal | Automatic wallet credit (source=`refund`) |

---

## 8. Webhook Endpoints

### PineLabs — `POST /payment/pinelabs-webhook`

Verifies `X-API-KEY` header against `PINELABS_WEBHOOK_API_KEY`. Updates `user_payment_details` and `withdrawal_requests` based on PineLabs status codes.

### Razorpay — `POST /payment/razorpay-webhook`

Verifies `Razorpay-Webhook-Signature` header. Handles:

| Event | Effect |
|---|---|
| `payout.processed` | `withdrawal.status → COMPLETED`, UTR saved |
| `payout.failed` | `withdrawal.status → FAILED`, failure_reason set |
| `payout.reversed` | `withdrawal.status → FAILED`, `creditReversedWithdrawal()` called |
| `fund_account.validated` | `user_payment_detail.status → verified` |
| `fund_account.validation_failed` | `user_payment_detail.status → failed` |

---

## 9. Data Encryption

Sensitive bank fields in `user_payment_details` are encrypted at rest using **AES-256-GCM**:

| Plaintext field | Encrypted column |
|---|---|
| Full account number | `account_number_encrypted` |
| IFSC code | `ifsc_encrypted` |
| Account holder name | `account_holder_name_encrypted` |

The `decrypt()` utility is called **only** in `RazorpayPayoutService.createPayout()` immediately before sending to the Razorpay API. Decrypted values are never logged or returned in API responses.

---

*Last Updated: 2026-06-30*
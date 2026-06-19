# Task: Integrate PineLabs Payment Gateway

## Branch
`feat/integrate-pinelabs-payment`

---

## Overview

Integrate PineLabs as the payment gateway to process user withdrawal requests (both UPI and bank transfer) with admin approval workflow.

---

## User Flow

### 1. Withdrawal Request Initiation

**Trigger:** User initiates a withdrawal request.

**Step 1.1 — Payment Method Selection**
- Prompt user to choose payment method: `UPI` or `Bank Transfer`
- Store selected method in the withdrawal request

**Step 1.2 — Payment Details Collection & Verification**

#### If UPI selected:
- Ask user for their UPI ID (e.g. `user@upi`)
- Validate UPI ID format (basic regex: `^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$`)
- Send a micro-transaction verification (₹1 verification charge)
  - On success: mark UPI ID as verified, store in user profile
  - On failure: reject and ask user to re-enter
- Store verified UPI ID against user account

#### If Bank Transfer selected:
- Ask user for the following details:
  - Bank Account Number
  - Confirm Bank Account Number
  - IFSC Code
  - Account Holder Name
  - Bank Name
- Validate:
  - Account numbers match and are numeric (9–18 digits)
  - IFSC code format (11 characters, 4 letters + 0 + 6 alphanumeric)
  - Account holder name is not empty
- Send a micro-transaction verification (₹1 verification charge)
  - On success: mark bank details as verified, store encrypted in user profile
  - On failure: reject and ask user to re-enter
- Store verified bank details against user account (encrypted)

**Step 1.3 — Withdrawal Amount**
- Ask for withdrawal amount
- Validate:
  - Minimum withdrawal amount (configurable, e.g. ₹100)
  - Maximum withdrawal amount (configurable, e.g. ₹50,000)
  - User has sufficient balance
  - No pending withdrawal requests already in queue

**Step 1.4 — Submit to Admin**
- Create withdrawal request record with status `PENDING_APPROVAL`
- Notify admin (in-app notification / dashboard badge)
- Show confirmation to user: "Withdrawal request submitted. You will be notified once processed."

---

## Admin Flow

### 2. Admin Withdrawal Dashboard

**Page:** `/admin/withdrawals` or existing admin panel withdrawals section

**Features:**
- List all withdrawal requests with filters:
  - Status: `Pending`, `Approved`, `Rejected`, `Processing`, `Completed`, `Failed`
  - Date range
  - Payment method: `UPI`, `Bank Transfer`
  - Amount range
- For each request, display:
  - User details (name, ID, balance)
  - Payment method (UPI / Bank Transfer)
  - UPI ID or masked bank account details
  - Withdrawal amount
  - Request timestamp
  - Current status

### 3. Admin Actions

**Approve Button:**
- Clicking approve triggers PineLabs payment API call
- Before triggering:
  - Double-check user balance hasn't changed
  - Check for any fraud flags
- Status changes: `PENDING_APPROVAL` → `PROCESSING`
- On PineLabs success: status → `COMPLETED`
- On PineLabs failure: status → `FAILED`, log error, notify user

**Reject Button:**
- Opens a modal to enter rejection reason (required)
- Status changes: `PENDING_APPROVAL` → `REJECTED`
- Funds are released back to user balance
- User receives notification with rejection reason

---

### 3.1 Admin Payment Failure & Retry Mechanism

**When a PineLabs payment fails for an approved withdrawal:**

- **Do NOT update any status** in the `withdrawal_requests` table (i.e., do not set to `FAILED`)
- **Do NOT increment or update** the `payment_failed_count` column (it must remain unchanged)
- **Do NOT change** `processed_at` or any other column in the withdrawal table
- Simply log the error in the `payment_logs` / audit table with:
  - `pinelabs_transaction_id`
  - `error_code`
  - `error_message`
  - `attempted_at`
  - `admin_id` who approved
- Admin dashboard should show the request as still `PROCESSING` (not `FAILED`)
- A "Retry" button must appear on the admin UI for `PROCESSING` withdrawals where the last attempt failed
- On retry:
  - Re-trigger the same PineLabs payment with the same `orderId` (idempotency key ensures no double-payout)
  - Append a new entry in the payment log
  - Status remains `PROCESSING`
  - `payment_failed_count` is still not updated (count is tracked only in payment_logs, not on the withdrawal record)
- After 3 consecutive failures:
  - Admin receives an alert
  - Status may optionally be moved to `FAILED` manually by admin (no auto-transition)
  - User balance is released back

> **Rule:** The withdrawal `status` and `payment_failed_count` fields are only modified by explicit admin actions (approve/reject), never auto-updated on payment failure.

---

## PineLabs Integration

### 4. API Setup

**Environments:**

| Environment | Base URL | Notes |
|---|---|---|
| Development / Testing | `https://api.preprod.pinelabs.com` | Use test merchant credentials |
| Production | `https://api.pinelabs.com` | Use live merchant credentials |

**Authentication:**
- Use OAuth 2.0 or API key-based auth as per PineLabs docs
- Store credentials in environment variables (never in code):
  - `PINELABS_MERCHANT_ID`
  - `PINELABS_API_KEY`
  - `PINELABS_SECRET_KEY`
  - `PINELABS_ENV` (`sandbox` | `production`)

### 5. Payment APIs to Implement

#### 5.1 UPI Payment
- Endpoint: Transfer funds to UPI ID
- Payload: `{ upiId, amount, orderId, remarks }`
- Handle async webhook for payment status

#### 5.2 Bank Transfer / NEFT / IMPS
- Endpoint: Bank account transfer
- Payload: `{ accountNumber, ifsc, amount, orderId, beneficiaryName }`
- Handle async webhook for payment status

#### 5.3 Balance Check (optional)
- Check PineLabs merchant balance before approving large withdrawals

#### 5.4 Transaction Status
- Webhook or polling to confirm payment success/failure

### 6. Idempotency
- Use unique `orderId` / `transactionRef` for every payment attempt
- Store transaction refs in DB to prevent duplicate payouts
- On failure, log PineLabs transaction ID and error message

---

## Data Models

### 7. New / Updated DB Schema

**Table: `withdrawal_requests`**
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
amount          DECIMAL(10,2)
payment_method  ENUM('UPI', 'BANK_TRANSFER')
status          ENUM('PENDING_APPROVAL', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED')
-- UPI
upi_id          VARCHAR(100) NULL
-- Bank
bank_account_number   VARCHAR(18) NULL
bank_ifsc            VARCHAR(11) NULL
bank_account_holder  VARCHAR(100) NULL
bank_name            VARCHAR(100) NULL
-- PineLabs
pinelabs_transaction_id  VARCHAR(100) NULL
order_id               VARCHAR(100) NULL
rejection_reason       TEXT NULL
created_at             TIMESTAMP
updated_at             TIMESTAMP
processed_at           TIMESTAMP NULL
```

**Table: `user_payment_details`**
```sql
id                  UUID PRIMARY KEY
user_id             UUID REFERENCES users(id) UNIQUE
payment_method      ENUM('UPI', 'BANK_TRANSFER')
is_verified         BOOLEAN DEFAULT FALSE
-- UPI
upi_id              VARCHAR(100) NULL
-- Bank
bank_account_number VARCHAR(18) NULL
bank_ifsc           VARCHAR(11) NULL
bank_account_holder VARCHAR(100) NULL
bank_name           VARCHAR(100) NULL
verified_at         TIMESTAMP NULL
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

---

## Configuration

### 8. Config File: `config/payment.ts` (or `config/payment.js`)

```ts
export const pinelabsConfig = {
  env: process.env.PINELABS_ENV || 'sandbox',
  merchantId: process.env.PINELABS_MERCHANT_ID,
  apiKey: process.env.PINELABS_API_KEY,
  secretKey: process.env.PINELABS_SECRET_KEY,
  baseUrl: process.env.PINELABS_ENV === 'production'
    ? 'https://api.pinelabs.com'
    : 'https://api.preprod.pinelabs.com',
  withdrawal: {
    minAmount: parseInt(process.env.WITHDRAWAL_MIN ?? '100'),
    maxAmount: parseInt(process.env.WITHDRAWAL_MAX ?? '50000'),
  },
};
```

---

## Verification

### 9. Micro-Transaction Verification Flow

1. User submits payment details
2. Backend initiates a ₹1 debit from user balance (hold/deduct)
3. Backend calls PineLabs to transfer ₹1 to user's UPI/bank
4. If PineLabs returns success → mark details verified
5. If PineLabs returns failure → refund ₹1 to user balance, show error

**Note:** For UPI verification, PineLabs may support a dedicated verification API — check docs. If not, use the ₹1 transfer method.

---

## Notifications

### 10. User Notifications

| Event | Channel | Message |
|---|---|---|
| Withdrawal submitted | In-app / Email | "Your withdrawal request for ₹{amount} has been submitted." |
| Withdrawal approved | In-app / Email / SMS | "Your withdrawal of ₹{amount} has been approved and is being processed." |
| Withdrawal rejected | In-app / Email | "Your withdrawal request for ₹{amount} was rejected. Reason: {reason}" |
| Withdrawal completed | In-app / Email / SMS | "₹{amount} has been sent to your {UPI/bank account}. Ref: {orderId}" |
| Withdrawal failed | In-app / Email | "Your withdrawal of ₹{amount} failed. Amount has been credited back. Error: {error}" |
| Payment details verification failed | In-app | "Payment verification failed. Please check your details and try again." |

### 11. Admin Notifications
- Dashboard badge/alert when new withdrawal request arrives
- Optional: Email/SMS for high-value withdrawal requests (configurable threshold)

---

## Error Handling

### 12. Error Scenarios

| Scenario | Handling |
|---|---|
| PineLabs API timeout | Mark as `FAILED`, retry up to 3 times with exponential backoff, notify user |
| Insufficient merchant balance | Show admin alert, do not approve |
| Duplicate transaction (idempotency) | Return existing transaction status |
| User balance changed before payout | Block payout, notify admin |
| Invalid UPI/bank details | Show user-friendly error, do not submit request |
| PineLabs webhook failure | Implement retry + manual reconciliation |

---

## Testing Checklist

- [ ] UPI verification — success path
- [ ] UPI verification — failure path (invalid UPI ID)
- [ ] Bank verification — success path
- [ ] Bank verification — failure path (wrong IFSC, account mismatch)
- [ ] Submit withdrawal request (UPI)
- [ ] Submit withdrawal request (Bank)
- [ ] Admin approves UPI withdrawal → PineLabs payout triggered
- [ ] Admin approves Bank withdrawal → PineLabs payout triggered
- [ ] Admin rejects withdrawal → status updates, balance returned
- [ ] Webhook updates transaction status
- [ ] Idempotency — same orderId does not trigger double payout
- [ ] Min/max amount validation
- [ ] Insufficient balance block
- [ ] Duplicate pending request block
- [ ] Environment switching (sandbox ↔ production via env var)

---

## File Structure

```
src/
  config/
    payment.ts              # PineLabs + withdrawal config
  controllers/
    withdrawalController.ts # Handle user withdrawal requests
    adminWithdrawalController.ts # Admin approve/reject actions
  services/
    withdrawalService.ts    # Core withdrawal logic
    pinelabsService.ts      # PineLabs API wrapper
    paymentVerificationService.ts # Micro-transaction verification
  models/
    withdrawalRequest.ts    # Withdrawal request model
    userPaymentDetails.ts   # User saved payment methods
  routes/
    withdrawalRoutes.ts
    adminWithdrawalRoutes.ts
  middleware/
    validateWithdrawal.ts   # Input validation middleware
  jobs/
    withdrawalProcessor.ts  # Async job for processing payouts
  notifications/
    withdrawalNotifier.ts   # User/admin notification triggers
config/
  payment.ts                # Environment-based config
tests/
  withdrawal.test.ts
  pinelabsService.test.ts
```

---

## Dependencies

- PineLabs SDK / REST API calls (axios or native fetch)
- Encryption library for storing bank details (e.g. `crypto` with AES-256)
- Job queue (Bull/BullMQ or similar) for async payout processing
- SMS/Email service integration for notifications

---

## Notes

- All monetary values stored as integers (paise) in DB; convert to decimal (rupees) only at API boundaries
- Bank account numbers and UPI IDs should be stored encrypted at rest
- Admin approval should be logged with admin ID, timestamp, and IP address for audit trail
- Set up PineLabs webhook URL: `POST /api/webhooks/pinelabs` for async payment status updates
- Coordinate with PineLabs team for sandbox/test merchant credentials before development
- Ensure PCI-DSS compliance for payment data handling

---

## Status

- [ ] Not started
- [ ] In progress
- [ ] Ready for review
- [ ] Merged
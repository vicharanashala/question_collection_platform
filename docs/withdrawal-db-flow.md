# Withdrawal Request — DB State Transitions

## Entity Relationship

```
users ──1:1── wallets ──1:N── transactions
              │
              └───1:N── withdrawal_requests
                            │
                            └───1:N── payment_logs
                            │
                            └─────N:1── user_payment_details
```

---

## Valid Withdrawal Statuses

`PENDING` → `PROCESSING` → `COMPLETED`
                               │
                               └──→ `FAILED` (payout rejected/reversed)
                                    → CANCELLED (admin rejected)

---

## Tables & State Transitions

### 1. `users`
| column | value |
|---|---|
| id | `a1b2c3d4-e5f6-4789-abcd-ef0123456789` |
| mobile_number | `9876543210` |
| name | `Ramesh Patil` |
| role | `user` |
| state | `Maharashtra` |
| district | `Pune` |
| verification_status | `verified` |
| created_at | `2025-11-10 08:30:00` |

---

### 2. `wallets`
| column | value |
|---|---|---|
| id | `w1x2y3z4-a5b6-4c7d-9e8f-1a2b3c4d5e6f` |
| user_id | `a1b2c3d4-e5f6-4789-abcd-ef0123456789` |
| balance | `2500.00` |
| currency | `INR` |
| created_at | `2025-11-10 08:30:15` |
| updated_at | `2026-06-19 11:18:00` |

---

### 3. `withdrawal_requests`

| column | PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED |
|---|---|---|---|---|---|
| id | `fcf843b6-a183-470b-845a-b304e641df97` | *(same)* | *(same)* | *(same)* | *(same)* |
| user_id | `a1b2c3d4-...` | *(same)* | *(same)* | *(same)* | *(same)* |
| wallet_id | `w1x2y3z4-...` | *(same)* | *(same)* | *(same)* | *(same)* |
| amount | `1500.00` | *(same)* | *(same)* | *(same)* | *(same)* |
| payout_method | `bank_transfer` | *(same)* | *(same)* | *(same)* | *(same)* |
| payout_details | `{"bank":"HDFC","account":"****4521","ifsc":"HDFC0001234"}` | *(same)* | *(same)* | *(same)* | *(same)* |
| status | `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED` | `CANCELLED` |
| razorpay_payout_id | `NULL` | set at approve | *(same)* | *(same)* | `NULL` |
| utr_number | `NULL` | `NULL` | set by webhook | `NULL` | `NULL` |
| processed_at | `NULL` | set at approve | set by webhook | set by fail/reversal | set at cancel |
| cancelled_at | `NULL` | `NULL` | `NULL` | `NULL` | set at cancel |
| failure_reason | `NULL` | `NULL` | `NULL` | set on fail/reversal | `NULL` |
| retry_count | `0` | *(same)* | *(same)* | incremented | `0` |
| created_at | `2026-06-19 16:40:00` | *(same)* | *(same)* | *(same)* | *(same)* |

---

### 4. `transactions`

#### On Withdrawal Request (created atomically with the withdrawal_request)
| column | value |
|---|---|
| id | `t_debit_001` |
| wallet_id | `w1x2y3z4-...` |
| type | `debit` |
| source | `withdrawal` |
| amount | `1500.00` |
| balance_after | `1000.00` |
| reference_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| description | `Withdrawal request initiated` |
| status | `pending` → `completed` (on COMPLETED) / `failed` (on FAIL/CANCEL) |
| created_at | `2026-06-19 16:40:00` |

#### On COMPLETED — no new transaction (debit already taken)

#### On FAILED (payout rejected by bank or Razorpay reversed):
A refund CREDIT is issued to the wallet:

| column | value |
|---|---|
| id | `t_refund_001` |
| wallet_id | `w1x2y3z4-...` |
| type | `credit` |
| source | `refund` |
| amount | `1500.00` |
| balance_after | `2500.00` |
| reference_id | `fcf843b6-...` |
| description | `Withdrawal failed: <failure_reason>` |
| status | `completed` |
| created_at | timestamp of fail webhook or admin action |

#### On CANCELLED (admin rejects before payout):
A refund CREDIT is issued immediately:

| column | value |
|---|---|
| id | `t_refund_002` |
| wallet_id | `w1x2y3z4-...` |
| type | `credit` |
| source | `refund` |
| amount | `1500.00` |
| balance_after | `2500.00` |
| reference_id | `fcf843b6-...` |
| description | `Withdrawal cancelled` |
| status | `completed` |
| created_at | timestamp of cancellation |

---

### 5. `payment_logs`

A `payment_log` row is created each time a payout is attempted (including retries):

| column | value |
|---|---|
| id | `pl_001` |
| withdrawal_request_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| admin_id | admin who approved | `NULL` on retry |
| order_id | `order_<uuid>` | PineLabs idempotency key |
| pinelabs_transaction_id | `NULL` | PineLabs-specific |
| razorpay_payout_id | set on payout call | `NULL` |
| utr_number | `NULL` | set on payout processed webhook |
| status | `initiated` | `success` / `failed` / `reversed` |
| error_code | `NULL` | set if failed |
| error_message | `NULL` | set if failed |
| raw_response | `NULL` | JSONB of API response |
| attempted_at | now | now |

---

### 6. `user_payment_details`

The source of truth for payout instrument. Not joined directly to `withdrawal_requests`; selected at withdrawal-request time.

| column | value |
|---|---|
| id | `upd_001` |
| user_id | `a1b2c3d4-...` |
| payout_method | `bank_transfer` |
| account_number_last4 | `4521` |
| ifsc | `HDFC0001234` (plaintext display) |
| ifsc_encrypted | `enc_...` |
| account_holder_name | `Ramesh Patil` (plaintext display) |
| account_holder_name_encrypted | `enc_...` |
| account_number_encrypted | `enc_...` (full account number) |
| bank_name | `HDFC Bank` (from IFSC lookup) |
| status | `verified` |
| razorpay_fund_account_id | `fa_...` |
| verified_at | timestamp |
| created_at | earlier |
| updated_at | now |

---

### 7. `audit_logs`

#### On Admin Approve (`POST /admin/withdrawals/:id/process { action: "approve" }`):
| column | value |
|---|---|
| id | `audit_001` |
| actor_type | `admin` |
| actor_id | `<admin_uuid>` |
| action | `WITHDRAWAL_PROCESSING` |
| entity_type | `withdrawal_request` |
| entity_id | `fcf843b6-...` |
| old_value | `{"status":"PENDING"}` |
| new_value | `{"status":"PROCESSING"}` |
| reason | admin-supplied reason (optional) |
| created_at | `2026-06-19 16:49:44` |

#### On Payout Processed (webhook `payout.processed`):
| column | value |
|---|---|
| id | `audit_002` |
| actor_type | `system` |
| action | `WITHDRAWAL_COMPLETED` |
| entity_type | `withdrawal_request` |
| entity_id | `fcf843b6-...` |
| old_value | `{"status":"PROCESSING","utr_number":null}` |
| new_value | `{"status":"COMPLETED","utr_number":"ABC123456789"}` |
| created_at | now |

#### On Payout Failed (webhook `payout.failed` or admin fail):
| column | value |
|---|---|
| id | `audit_003` |
| actor_type | `system` or `admin` |
| action | `WITHDRAWAL_FAILED` |
| entity_type | `withdrawal_request` |
| entity_id | `fcf843b6-...` |
| old_value | `{"status":"PROCESSING"}` |
| new_value | `{"status":"FAILED","failure_reason":"Bank account closed"}` |
| created_at | now |

#### On Payout Reversed (webhook `payout.reversed`):
| column | value |
|---|---|
| action | `WITHDRAWAL_REVERSED` |
| new_value | `{"status":"FAILED","failure_reason":"Payout reversed by bank","refund_credited":true}` |

#### On Admin Cancel (`action: "reject"`):
| column | value |
|---|---|
| action | `WITHDRAWAL_CANCELLED` |
| old_value | `{"status":"PENDING"}` |
| new_value | `{"status":"CANCELLED","failure_reason":"Invalid details"}` |

---

## Side Effects Summary

| Action | withdrawal_requests | wallet.balance | transactions (debit) | transactions (refund) | notifications |
|---|---|---|---|---|---|
| **Request withdrawal** | status=PENDING | unchanged (balance debited immediately) | type=debit, source=withdrawal, status=pending | — | — |
| **Admin approve** | status=PROCESSING, processed_at=now | unchanged | status=completed | — | `WITHDRAWAL_PROCESSING` |
| **Admin reject (cancel)** | status=CANCELLED, cancelled_at=now | +=amount | status=failed | +1 credit, source=refund, status=completed | `WITHDRAWAL_CANCELLED` |
| **Payout success** | status=COMPLETED, utr_number=set | unchanged | status=completed | — | `WITHDRAWAL_COMPLETED` |
| **Payout failed** | status=FAILED, failure_reason=set | unchanged (debit stands) | status=failed | — | `WITHDRAWAL_FAILED` |
| **Payout reversed** | status=FAILED | +=amount (refund) | status=failed | +1 credit, source=refund, status=completed | `WITHDRAWAL_FAILED` |
| **Admin mark fail** | status=FAILED, failure_reason=set | +=amount (refund) | status=failed | +1 credit, source=refund, status=completed | `WITHDRAWAL_FAILED` |
| **Retry** | retry_count++, status=PROCESSING | unchanged | unchanged | — | — |

---

## Notification Table

| Trigger | notification.type | Title | Body |
|---|---|---|---|
| Admin approve | `withdrawal_processed` | "Withdrawal Approved" | "Your withdrawal of Rs. {amount} has been approved and will be processed shortly." |
| Admin cancel | `withdrawal_cancelled` | "Withdrawal Cancelled" | "Your withdrawal of Rs. {amount} was cancelled. Reason: {reason}. Amount refunded to wallet." |
| Payout completed | `withdrawal_completed` | "Withdrawal Complete" | "Your withdrawal of Rs. {amount} is complete. UTR: {utr}." |
| Payout failed | `withdrawal_failed` | "Withdrawal Failed" | "Your withdrawal of Rs. {amount} failed. Reason: {reason}. Amount has been refunded to your wallet." |
| Payout reversed | `withdrawal_failed` | "Withdrawal Refunded" | "Your withdrawal of Rs. {amount} was reversed by the bank. Amount refunded to wallet." |

---

*Last Updated: 2026-06-30*
# Withdrawal Request — DB State on Approve / Reject

## Entity Relationship

```
users ──1:1── wallets ──1:N── transactions
              │
              └───1:N── withdrawal_requests
```

---

## Tables & Dummy Data

### 1. `users`
| column | value |
|---|---|
| id | `a1b2c3d4-e5f6-4789-abcd-ef0123456789` |
| mobile_number | `9876543210` |
| name | `Ramesh Patil` |
| role | `farmer` |
| state | `Maharashtra` |
| district | `Pune` |
| verification_status | `verified` |
| created_at | `2025-11-10 08:30:00` |

---

### 2. `wallets`
| column | value |
|---|---|
| id | `w1x2y3z4-a5b6-4c7d-9e8f-1a2b3c4d5e6f` |
| user_id | `a1b2c3d4-e5f6-4789-abcd-ef0123456789` |
| balance | `2500.00` |
| currency | `INR` |
| created_at | `2025-11-10 08:30:15` |
| updated_at | `2026-06-19 11:18:00` |

---

### 3. `withdrawal_requests`
| column | pending | approved (PROCESSING) | rejected (REJECTED) |
|---|---|---|---|
| id | `fcf843b6-a183-470b-845a-b304e641df97` | *(same)* | *(same)* |
| user_id | `a1b2c3d4-e5f6-4789-abcd-ef0123456789` | *(same)* | *(same)* |
| wallet_id | `w1x2y3z4-a5b6-4c7d-9e8f-1a2b3c4d5e6f` | *(same)* | *(same)* |
| amount | `1500.00` | *(same)* | *(same)* |
| payout_method | `bank_transfer` | *(same)* | *(same)* |
| payout_details | `{"bank":"HDFC","account":"****4521","ifsc":"HDFC0001234"}` | *(same)* | *(same)* |
| status | `pending` | `processing` | `rejected` |
| processed_at | `NULL` | `2026-06-19 16:49:44` | `2026-06-19 16:49:44` |
| failure_reason | `NULL` | `NULL` | `Invalid bank account details` |
| cancelled_at | `NULL` | `NULL` | `NULL` |
| created_at | `2026-06-19 16:40:00` | *(same)* | *(same)* |

---

### 4. `transactions`

#### On WITHDRAWAL REQUEST (initial debit — created when user requested)
| column | value |
|---|---|
| id | `t_debit_001` |
| wallet_id | `w1x2y3z4-a5b6-4c7d-9e8f-1a2b3c4d5e6f` |
| type | `debit` |
| source | `withdrawal` |
| amount | `1500.00` |
| balance_after | `1000.00` |
| reference_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| description | `Withdrawal request initiated` |
| rejection_reason | `NULL` |
| status | `pending` → `completed` (on approve) / `rejected` (on reject) |
| created_at | `2026-06-19 16:40:00` |

#### On APPROVE — no new transaction (balance already debited at request time)

#### On REJECT — refund CREDIT added:
| column | value |
|---|---|
| id | `t_refund_001` |
| wallet_id | `w1x2y3z4-a5b6-4c7d-9e8f-1a2b3c4d5e6f` |
| type | `credit` |
| source | `refund` |
| amount | `1500.00` |
| balance_after | `2500.00` |
| reference_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| description | `Withdrawal refunded: Invalid bank account details` |
| rejection_reason | `NULL` |
| status | `completed` |
| created_at | `2026-06-19 16:49:44` |

> `balance_after` on the refund = `wallets.balance` after the refund is applied.

---

### 5. `audit_logs`

#### On APPROVE:
| column | value |
|---|---|
| id | `audit_001` |
| actor_type | `admin` |
| actor_id | `admin_uuid_here` |
| action | `withdrawal_approved` |
| entity_type | `withdrawal_request` |
| entity_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| old_value | `{"status":"pending"}` |
| new_value | `{"status":"processing"}` |
| metadata | `NULL` |
| created_at | `2026-06-19 16:49:44` |

#### On REJECT:
| column | value |
|---|---|
| id | `audit_002` |
| actor_type | `admin` |
| actor_id | `admin_uuid_here` |
| action | `withdrawal_rejected` |
| entity_type | `withdrawal_request` |
| entity_id | `fcf843b6-a183-470b-845a-b304e641df97` |
| old_value | `{"status":"pending"}` |
| new_value | `{"status":"rejected","reason":"Invalid bank account details"}` |
| metadata | `NULL` |
| created_at | `2026-06-19 16:49:44` |

---

## Side Effects Summary

| Action | `withdrawal_requests` | `wallets.balance` | `transactions` (debit) | `transactions` (refund) | `audit_logs` |
|---|---|---|---|---|---|
| **Approve** | `status → processing`, `processed_at → now` | unchanged | `status → completed` | — | `withdrawal_approved` |
| **Reject** | `status → rejected`, `processed_at → now`, `failure_reason → <reason>` | `+= amount` (refund) | `status → rejected`, `rejection_reason → <reason>` | `+1 CREDIT / refund` | `withdrawal_rejected` |

---

## Notification Sent

| Action | `notifications` entry |
|---|---|
| Approve | `type: WITHDRAWAL_APPROVED`, `title: "Withdrawal Approved"`, body: "Your withdrawal of Rs. 1500 has been approved and will be processed shortly." |
| Reject | `type: WITHDRAWAL_REJECTED`, `title: "Withdrawal Rejected"`, body: "Your withdrawal of Rs. 1500 was rejected. Reason: <failure_reason>" |
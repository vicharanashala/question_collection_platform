# Task 7: Withdrawal System (UPI + Bank Transfer)

**Module:** Wallet  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From PRD:
- Minimum withdrawal: ₹50 (configurable)
- Payout methods: UPI, Bank Transfer
- Internal wallet system for balance management

---

## Sub-Tasks

### 1. Withdrawal Request
- [ ] Request withdrawal (amount, method, details)
- [ ] Validate minimum amount
- [ ] Validate sufficient balance
- [ ] Debit wallet immediately (status: pending)

### 2. UPI Withdrawal
- [ ] Capture UPI address
- [ ] Process via payment gateway (TBD integration)

### 3. Bank Transfer
- [ ] Capture bank account details
- [ ] Process via payment gateway (TBD integration)

### 4. Status Tracking
- [ ] Status: pending → processing → completed/failed
- [ ] Retry logic for failed withdrawals
- [ ] Failure reason capture

### 5. Database
- [ ] `withdrawal_requests` table
- [ ] Transaction record (debit)
- [ ] Status updates

---

## API Endpoints (TBD)

## Notes

TBD during implementation
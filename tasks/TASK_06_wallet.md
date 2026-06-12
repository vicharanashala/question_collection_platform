# Task 6: Reward Wallet System

**Module:** Wallet  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From PRD:
- Rewards credited automatically upon approval
- Display current balance
- Full transaction history

Reward Tiers (per approved question):
- 1–25 approved: ₹1 per question
- 26–250 approved: ₹5 per question
- 251–500 approved: ₹10 per question

No maximum daily reward limit.

---

## Sub-Tasks

### 1. Wallet Management
- [ ] Auto-create wallet on user registration
- [ ] Display balance
- [ ] Balance update on question approval

### 2. Reward Calculation
- [ ] Track approved question count per user
- [ ] Apply correct tier based on count
- [ ] Credit reward to wallet on approval
- [ ] Update transaction record

### 3. Transaction History
- [ ] List all transactions (credit/debit)
- [ ] Filter by type, date range
- [ ] Pagination

### 4. Reward Tier Tracking
- [ ] `reward_tier_summary` table management
- [ ] Tier progression logic

### 5. Database
- [ ] `wallets` table
- [ ] `transactions` table
- [ ] `reward_tier_summary` table

---

## API Endpoints (TBD)

## Notes

TBD during implementation
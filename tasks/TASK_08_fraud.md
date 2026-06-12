# Task 8: Fraud Detection (Duplicate + Spam)

**Module:** Security  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From PRD:
- Duplicate: rejected immediately (device) + in-app notification sent to user; rejected server-side (no reward)
- Spam: first occurrence = warning, repeat = submission rejected

Progressive Penalty Model:
- First violation: Warning
- Continued violation: Temporary suspension

---

## Sub-Tasks

### 1. Duplicate Detection
- [ ] On-device: exact match + semantic (see Task 4)
- [ ] Server-side: exact match check
- [ ] Server-side: semantic similarity check (threshold: 0.9)
- [ ] Set duplicate_of_id on duplicate questions
- [ ] Reject duplicate questions immediately (no reward)
- [ ] Send in-app notification to user on duplicate detection

### 2. Spam Detection
- [ ] Pattern-based spam detection
- [ ] First spam: warning (in-app notification)
- [ ] Repeat spam: reject submission
- [ ] Log spam event

### 3. Violation Tracking
- [ ] `user_violations` table
- [ ] Track violation type, question_id, penalty
- [ ] Warning issuance
- [ ] Suspension logic (duration TBD)

### 4. Fraud Dashboard (Admin)
- [ ] View duplicate submissions
- [ ] View spam flags
- [ ] View violation history per user

### 5. Database
- [ ] `user_violations` table
- [ ] Violation query endpoints

---

## API Endpoints (TBD)

## Notes

TBD during implementation
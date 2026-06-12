# Task 5: Server-Side AI Validation + Human Review

**Module:** AI  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From Architecture:
- Full-scale ML model for confidence scoring
- Semantic similarity (threshold: 0.9) for duplicate detection
- Routes low-confidence submissions to human review queue

Workflow:
- AI Score >= 90% → Auto-Approved
- AI Score < 90% → Human Review Queue
- Human: Approve, Reject, or Request Info

---

## Sub-Tasks

### 1. AI Validation Service
- [ ] Full-scale ML model integration
- [ ] Confidence scoring endpoint
- [ ] Semantic duplicate detection (similarity >= 0.9)
- [ ] Auto-approve if score >= 90%

### 2. Human Review Queue
- [ ] Queue interface for low-confidence questions
- [ ] Reviewer assignment
- [ ] Approve / Reject / Request Info actions
- [ ] Rejection reason capture

### 3. Duplicate Detection
- [ ] Server-side exact match check
- [ ] Server-side semantic similarity check
- [ ] Duplicate linking (set duplicate_of_id)

### 4. Notification
- [ ] Notify user if question needs more info
- [ ] Notify user on approval/rejection

### 5. Database
- [ ] Question status updates
- [ ] Reviewer assignment
- [ ] Audit log entries

---

## API Endpoints (TBD)

## Notes

TBD during implementation
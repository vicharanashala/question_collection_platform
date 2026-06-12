# Task 9: Admin Dashboard

**Module:** Admin  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From Architecture:
- User Management: view, configure, suspend
- Question Review: AI flagged, human queue, approve/reject
- Analytics Dashboards
- Reward & Payout: logs, withdrawals, fraud flags
- Export: CSV, Excel

Configurable Parameters (via admin dashboard):
- Max users per state (default: 100)
- Video: max duration (10s), max size (10MB)
- Semantic similarity threshold (default: 0.9)
- Min withdrawal amount (default: ₹50)
- AI confidence threshold (default: 90%)
- Daily question limit (default: 20)
- Edit window (default: 30s)

---

## Sub-Tasks

### 1. User Management
- [ ] List all users (filter by state, category, status)
- [ ] View user details
- [ ] Suspend / Ban user
- [ ] View user's questions and rewards

### 2. Question Review
- [ ] Human review queue
- [ ] Approve / Reject actions
- [ ] Request more info action
- [ ] View question with media

### 3. Configuration
- [ ] `admin_config` table CRUD
- [ ] Update all configurable parameters
- [ ] Config change audit log

### 4. Admin Dashboard Pages
- [ ] User management view
- [ ] Question review queue view
- [ ] Analytics overview
- [ ] Reward & payout view
- [ ] Fraud monitoring view

### 5. Data Export
- [ ] CSV export (all data types)
- [ ] Excel export
- [ ] Date range filter
- [ ] State filter
- [ ] Crop filter

---

## API Endpoints (TBD)

## Notes

TBD during implementation
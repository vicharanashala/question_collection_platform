# Task 11: Analytics + Export (CSV/Excel)

**Module:** Analytics  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From PRD:
- Daily question volume
- State-wise analytics
- Crop-wise analytics
- Reward and payout analytics
- User engagement analytics
- Domain category analytics
- Data export: CSV, Excel

From Database:
- `daily_question_stats` pre-aggregated table
- Read replicas for analytics queries

---

## Sub-Tasks

### 1. Analytics Dashboard Data
- [ ] Daily question volume (submitted, approved, rejected)
- [ ] State-wise breakdown
- [ ] Crop-type breakdown
- [ ] Domain category breakdown
- [ ] Reward and payout totals
- [ ] User engagement (DAU, MAU, retention)

### 2. Success Metrics
- [ ] Total registered users
- [ ] Monthly active users
- [ ] Total approved questions
- [ ] Dataset growth rate
- [ ] Cost per approved question
- [ ] State-wise participation rate
- [ ] Average question quality score

### 3. Pre-Aggregation
- [ ] `daily_question_stats` table updates
- [ ] Nightly aggregation job

### 4. Export
- [ ] CSV export (all data types)
- [ ] Excel export
- [ ] Date range filter
- [ ] State filter
- [ ] Crop filter

### 5. Performance
- [ ] Read replica routing for analytics
- [ ] Query optimization
- [ ] Caching (Redis)

---

## API Endpoints (TBD)

## Notes

TBD during implementation
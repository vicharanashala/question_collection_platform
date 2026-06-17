# Task 11: Analytics + Export (CSV/Excel)

**Module:** Analytics  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

This task covers analytics data and data export functionality. **Do NOT create a new Analytics page.** All analytics and export features must be integrated into the existing Admin Dashboard.

**Implementation order:** Implement all analytics and export features first for the **web admin panel (`/web` folder)**, then replicate the same features for the **mobile admin views (`/mobile` folder)**.

The web admin dashboard at `/dashboard` is the single place for all analytics views in the web app. The mobile admin section follows the same pattern.

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

### 1. Web Analytics — `/web` Dashboard (`/dashboard`)
**Complete all of the following in the `/web` folder before touching mobile.**

#### 1a. Analytics Stat Cards
- [ ] Add below the existing stat cards on the web dashboard:
  - Total Registered Users
  - Monthly Active Users (MAU)
  - Total Approved Questions
  - Dataset Growth Rate (month-over-month)
  - Cost per Approved Question
  - State-wise Participation Rate
  - Average Question Quality Score

#### 1b. Analytics Charts
- [ ] Add charts below stat cards (enhance the existing recent questions section):
  - Daily question volume (submitted, approved, rejected) — line chart
  - State-wise breakdown — bar chart
  - Crop-type breakdown — bar chart or pie chart
  - Domain category breakdown — bar chart
  - User engagement (DAU/MAU trend) — line chart
- [ ] State filter and date range filter controls above the charts
- [ ] All charts must be responsive and work in light/dark mode

#### 1c. Success Metrics Cards
- [ ] Display on dashboard as additional stat cards:
  - Total registered users
  - Monthly active users
  - Total approved questions
  - Dataset growth rate
  - Cost per approved question
  - State-wise participation rate
  - Average question quality score
- [ ] Numbers are pulled from analytics API endpoints

#### 1d. Data Export
- [ ] CSV export (all data types: users, questions, rewards)
- [ ] Excel export (.xlsx)
- [ ] Date range filter
- [ ] State filter
- [ ] Crop filter
- [ ] Export controls live on the dashboard page as a section/panel
- [ ] Download triggered from the browser (no server-side download page)

### 2. Mobile Analytics — `/mobile` Admin Dashboard
**After completing all web analytics tasks above, replicate the same in the mobile admin section.**

#### 2a. Analytics Stat Cards
- [ ] Same stat cards as web (Total Users, MAU, Approved Questions, Growth Rate, Cost per Approved Question, State Participation, Avg Quality Score)
- [ ] Adapted for mobile layout (cards may be in a scrollable row or vertical stack)

#### 2b. Analytics Charts
- [ ] Same chart types as web (line, bar, pie)
- [ ] Adapted for mobile screens (horizontal scroll or stacked layout)
- [ ] Filters (date range, state, crop) in a collapsible panel or modal

#### 2c. Success Metrics Cards
- [ ] Same metrics as web, displayed in a mobile-friendly card grid

#### 2d. Data Export
- [ ] CSV and Excel export buttons available on mobile dashboard
- [ ] Share sheet or file download on mobile (native behavior)

### 3. Pre-Aggregation (Backend — shared by web and mobile)
- [ ] `daily_question_stats` table updates via nightly job
- [ ] Read replica routing for analytics queries (if multiple DB replicas exist)
- [ ] Query optimization and Redis caching for common analytics queries

### 4. Performance
- [ ] Read replica routing for analytics
- [ ] Query optimization
- [ ] Caching (Redis) for dashboard analytics data

---

## Implementation Notes

- **No new pages.** All UI lives in the existing `/dashboard` page (Task 14) for web, and the existing mobile admin dashboard for mobile.
- **Web first, then mobile.** Complete every sub-task in `/web` before starting any sub-task in `/mobile`.
- The dashboard page should be extended with additional sections for analytics cards, charts, and export controls — not a separate route.
- Use the existing `StatCard` component pattern from Task 14.
- Use Recharts (already in Task 14 stack) for all web charts. Use react-native-svg-charts or Recharts adapted for React Native for mobile charts.
- Analytics API endpoints should be new backend endpoints; do not reuse existing CRUD endpoints.
- Chart data should be fetched via React Query or similar on the dashboard page.
- Mobile analytics should mirror web analytics feature-for-feature — same metrics, same chart types, same filters.
- **No dummy data.** All dashboard numbers, chart data, and metrics must come from real API calls. If any data is hardcoded, stubbed, or not yet connected to a real backend — it must be clearly labeled with a `DUMMY DATA` badge or comment directly in the UI so it is never mistaken for real data. Do not ship analytics widgets with realistic-looking fake numbers.

---

## API Endpoints (Backend — to be implemented)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | All dashboard stats + chart data in one call |
| GET | `/api/analytics/users` | User engagement metrics (DAU, MAU, retention) |
| GET | `/api/analytics/questions` | Question volume + breakdown (state, crop, domain) |
| GET | `/api/analytics/rewards` | Reward and payout totals |
| GET | `/api/export/csv` | Export CSV (query params: type, dateFrom, dateTo, state, crop) |
| GET | `/api/export/excel` | Export Excel (same query params as CSV) |

## Notes

TBD during implementation
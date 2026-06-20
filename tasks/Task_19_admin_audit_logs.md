# Task 19: Admin Audit Logs & Moderator Activity Visibility

**Module:** Admin Audit Logs  
**Status:** Pending  
**Developer:** —  
**Started:** —

---

## Context

The platform already writes audit log entries via `AdminService.logAudit()` to the `audit_logs` table, but admins have **no way to view or search these logs**, and there is **no visibility into individual moderator/curator performance**.

This task delivers:
1. A queryable backend API for audit logs with rich filters
2. A full **Audit Logs page** in the web admin panel with list view + stats/leaderboard view
3. Per-actor breakdowns so admins can see exactly which curator approved more questions, which admin cleared more withdrawals, which user manager suspended more users, etc.

---

## Related Tasks

- Task 9 (Admin Dashboard) — user management, withdrawals, config audit already exist in backend
- Task 14 (Web Admin UI) — web admin panel scaffold exists
- Task 11 (Analytics) — analytics patterns exist; audit stats build on similar patterns

---

## Deliverables

### 1. Backend: Audit Log Query API

#### 1a. New DTO: `query-audit-logs.dto.ts`

```ts
export class QueryAuditLogsDto {
  page = 1;
  limit = 50;                        // max 200
  actorId?: string;                  // filter by specific admin/curator
  actorType?: ActorType;             // ADMIN | CURATOR | USER | SYSTEM
  action?: AuditAction | AuditAction[];  // single or array
  entityType?: string;               // 'withdrawal_request' | 'user' | 'question' | 'admin_config'
  entityId?: string;                 // specific record ID
  fromDate?: string;                 // ISO date
  toDate?: string;
  search?: string;                   // searches action + entityType + metadata stringified
  sortBy?: 'createdAt' | 'action' | 'actorId';
  sortOrder?: 'ASC' | 'DESC';
}
```

#### 1b. New DTO: `audit-stats.dto.ts`

```ts
export class AuditStatsDto {
  fromDate?: string;
  toDate?: string;
  actorType?: ActorType;             // ADMIN | CURATOR (excluded actors are not counted)
  state?: string;                    // only meaningful for user/question actions
}
```

#### 1c. `AuditController` — new file `audit.controller.ts`

New controller with two route groups:

**Route Group 1 — Raw Log Search**

```
GET /api/admin/audit-logs
```

Returns paginated audit log entries. Joins the `user` table to include actor name/role when actorType is ADMIN or CURATOR.

Response shape:
```ts
{
  items: Array<{
    id: string;
    actorType: ActorType;
    actorId: string | null;
    actorName: string | null;       // joined from user table
    actorRole: string | null;        // joined from user table
    action: string;
    entityType: string | null;
    entityId: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;              // ISO string
  }>;
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

Query params: all fields from `QueryAuditLogsDto`.

**Route Group 2 — Actor Stats / Leaderboard**

```
GET /api/admin/audit-logs/stats
```

Returns per-actor breakdowns grouped by action category. This is the **moderator activity leaderboard**.

Response shape:
```ts
{
  fromDate: string | null;
  toDate: string | null;
  actors: Array<{
    actorId: string;
    actorName: string;
    actorRole: UserRole;           // ADMIN | CURATOR
    // Withdrawal actions
    withdrawalApproved: number;
    withdrawalRejected: number;
    withdrawalProcessed: number;
    withdrawalRetried: number;
    // User management actions
    userSuspended: number;
    userBanned: number;
    userUnsuspended: number;
    userUnbanned: number;
    userVerified: number;
    // Question review actions
    questionApproved: number;
    questionRejected: number;
    questionHeld: number;
    // Config changes
    configUpdated: number;
    // Total
    totalActions: number;
  }>;
  summary: {
    totalActions: number;
    uniqueActors: number;
    mostActiveActor: string | null;   // actorId
    mostActiveActorName: string | null;
  };
}
```

**Route Group 3 — Entity History**

```
GET /api/admin/audit-logs/entity/:entityType/:entityId
```

Returns the full audit trail for a specific entity (e.g., all history of withdrawal request X, or all status changes of user Y).

```ts
{
  entityType: string;
  entityId: string;
  entries: Array<{
    id: string;
    actorType: ActorType;
    actorId: string | null;
    actorName: string | null;
    action: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}
```

**Route Group 4 — Action Summary (time-series counts)**

```
GET /api/admin/audit-logs/summary
```

Returns daily time-series counts of each action category, for charting.

Query params: `fromDate`, `toDate`, `granularity` (`day` | `week` | `month`).

```ts
{
  granularity: 'day' | 'week' | 'month';
  series: Array<{
    date: string;                  // 'YYYY-MM-DD' for day, 'YYYY-Www' for week, 'YYYY-MM' for month
    withdrawals: number;
    userActions: number;
    questionReviews: number;
    configChanges: number;
    total: number;
  }>;
}
```

#### 1d. `AuditService` — new file `audit.service.ts`

Implement all query logic. Key points:

- Actor name/role join: LEFT JOIN `user` ON `audit_logs.actor_id = user.id` when `actor_type IN ('admin','curator')`
- Action categorisation via a helper map:
  ```ts
  const ACTION_CATEGORY: Record<string, 'withdrawal' | 'user' | 'question' | 'config' | 'auth'> = {
    [AuditAction.WITHDRAWAL_COMPLETED]: 'withdrawal',
    [AuditAction.WITHDRAWAL_REJECTED]: 'withdrawal',
    'withdrawal_approved': 'withdrawal',
    'withdrawal_retry': 'withdrawal',
    [AuditAction.USER_SUSPENDED]: 'user',
    [AuditAction.USER_BANNED]: 'user',
    [AuditAction.USER_UNSUSPENDED]: 'user',
    [AuditAction.USER_UNBANNED]: 'user',
    [AuditAction.USER_VERIFIED]: 'user',
    [AuditAction.QUESTION_APPROVED]: 'question',
    [AuditAction.QUESTION_REJECTED]: 'question',
    'question_held': 'question',
    [AuditAction.ADMIN_CONFIG_UPDATED]: 'config',
  };
  ```
- Entity history: query by `entityType + entityId`, ordered `createdAt ASC`
- Summary time-series: GROUP BY date truncation (`DATE_TRUNC` equivalent via TypeORM `format` or raw SQL)
- Indexes already exist on `audit_logs`: `idx_audit_actor`, `idx_audit_action`, `idx_audit_entity`, `idx_audit_created_at`

#### 1e. Admin Module Updates

- Import and register `AuditController` and `AuditService` in `admin.module.ts`
- Guard all routes with `JwtAuthGuard` + `RolesGuard` allowing `ADMIN` and `SUPER_ADMIN` only

---

### 2. Web Admin: Audit Logs Page

#### 2a. Route & Navigation

- New route: `/audit-logs` lazy-loaded
- Add nav item to `Sidebar.tsx`:
  ```
  Audit Logs  (Lucide `ScrollText` icon)
  Visible to: ADMIN, SUPER_ADMIN
  Active state: highlight when on route
  ```

#### 2b. `AuditLogsPage.tsx` — layout

Two-tab layout using existing `Tabs` component:

```
[Overview] [Activity]
```

**Overview Tab** — Stats/Leaderboard
- Stat cards row: Total Actions (all time filter range), Unique Actors, Top Performer
- "Moderator Activity" leaderboard table:
  - Columns: Actor Name | Role | Withdrawal Approved | Withdrawal Rejected | Questions Approved | Questions Rejected | Users Suspended | Config Changed | Total Actions
  - Sortable columns
  - Row click → filters Activity tab to that actor
  - Pagination (20 per page)
- Filters bar above table: Date range (from/to), Actor type (Admin/Curator/All)

**Activity Tab** — Raw Log Stream
- Filters bar:
  - Date range (from/to date inputs)
  - Actor type select (Admin | Curator | User | System | All)
  - Action type multi-select (grouped by category: Withdrawals, Users, Questions, Config, Auth)
  - Entity type select
  - Search input (searches action string + metadata JSON stringified)
  - "Clear Filters" button
- Results table:
  - Columns: Timestamp | Actor | Action | Entity Type | Entity ID | Changes (old→new diff) | Metadata badge
  - "Changes" column: renders `oldValue → newValue` as a concise inline diff, e.g. `status: pending → completed`
  - "Metadata" column: small expandable badge showing raw JSON if present
  - Row click: opens a side panel / slide-over showing the full entry detail (all fields)
  - Clicking Entity ID opens the relevant entity page in a new tab:
    - `withdrawal_request` → `/withdrawals?highlight=<entityId>`
    - `user` → `/users/<entityId>`
    - `question` → `/questions?highlight=<entityId>`
- Pagination (50 per page, max 200)
- Export button: downloads current filtered results as CSV

#### 2c. Reuse patterns from Task 14

- Use existing `DataTable` component
- Use existing `StatCard` component for overview stat cards
- Use existing `Badge` for action labels
- Use existing `Dialog` for the row-detail slide-over
- Use existing chart components (`AreaChartComponent`, `BarChartComponent`) to render the time-series from `summary` endpoint on the Overview tab

---

### 3. Entity History Quick Access

On the entity detail pages, add an "Audit History" collapsible section:

- **WithdrawalsPage** (`/withdrawals`) — click a row → `WithdrawalDetailModal` already exists; add an "Audit History" button in the modal that calls `GET /api/admin/audit-logs/entity/withdrawal_request/:id`
- **UserDetailPage** (`/users/:id`) — add an "Audit History" section below the user info showing recent audit entries for this user
- **QuestionsPage** (`/questions`) — question row detail shows audit history link

---

### 4. Filtering Strategy

All audit log queries must use the existing composite indexes on `audit_logs`:

| Common query pattern | Index used |
|---|---|
| `WHERE actor_id = ?` | `idx_audit_actor` |
| `WHERE action = ?` | `idx_audit_action` |
| `WHERE entity_type = ?` | `idx_audit_entity` |
| `WHERE created_at BETWEEN ? AND ?` | `idx_audit_created_at` |
| `WHERE actor_type = ? AND created_at BETWEEN ? AND ?` | `idx_audit_actor` + `idx_audit_created_at` |

For queries that filter on multiple non- indexed columns (e.g., actor type + entity type + date range), the service must:
1. Apply the most selective indexed filter first
2. Apply remaining filters in-memory if the result set is small (< 500 rows)
3. If result set is large, fall back to raw SQL with `CREATE INDEX CONCURRENTLY IF NOT EXISTS` for the specific filter combination (logged as a warning)

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/audit-logs` | Paginated log search with all filters |
| GET | `/api/admin/audit-logs/stats` | Per-actor activity leaderboard |
| GET | `/api/admin/audit-logs/entity/:entityType/:entityId` | Full audit trail for one entity |
| GET | `/api/admin/audit-logs/summary` | Time-series counts for charts |

---

## Implementation Order

1. Backend: `AuditService` + `AuditController` (DTOs, service, controller)
2. Register in `admin.module.ts`
3. Verify endpoints via `curl` or Postman before frontend work
4. Web: `AuditLogsPage` with tabs, filters, table, stats
5. Web: Sidebar nav link
6. Entity history sections on existing detail pages

---

## Tech Stack Notes

- **Backend:** NestJS, TypeORM, existing `AuditLog` entity
- **Web:** React 18, TypeScript, Tailwind, existing shadcn/ui-style components, Recharts, Lucide icons
- No new database migrations needed (schema already exists)
- All existing audit log entries written by `AdminService.logAudit()` are automatically queryable

---

## Acceptance Criteria

- [ ] `GET /api/admin/audit-logs` returns paginated results filtered by all DTO params
- [ ] `GET /api/admin/audit-logs/stats` returns per-actor breakdown with all action categories
- [ ] `GET /api/admin/audit-logs/entity/:type/:id` returns full history for one entity
- [ ] `GET /api/admin/audit-logs/summary` returns daily/weekly/monthly time-series data
- [ ] Web `/audit-logs` page loads with Overview tab showing leaderboard + stat cards
- [ ] Activity tab shows filterable, searchable raw log table
- [ ] CSV export works on Activity tab
- [ ] Sidebar has Audit Logs nav link (ADMIN/SUPER_ADMIN only)
- [ ] Entity history accessible from Withdrawals, User Detail, and Questions detail views
- [ ] All routes protected by JWT + role guard
- [ ] Zero TypeScript errors (`cd web && npx tsc --noEmit`)
- [ ] Web build passes clean (`cd web && npx vite build`)
# Task: Report Module — User Reporting + Admin Management + Reply Notifications

## Request

Implement a **Report Module** with three capabilities:

1. **User-facing report submission** — any authenticated user can report an issue (bug, question problem, payout issue, abuse, etc.) from the mobile app.
2. **Admin backend panel** — admins/curators/super_admins can view all reports, filter by status, and reply to a report.
3. **Notification on reply** — when an admin replies to a report, the original reporter receives an in-app notification (and Expo push notification if token is available).

---

## Files to Create

### Backend

| File | Purpose |
|------|---------|
| `backend/src/database/entities/report.entity.ts` | `Report` entity + `ReportReply` entity (or single entity with reply relation) |
| `backend/src/database/migrations/XXXXXXXXXXXX-AddReportAndReportReplyTables.ts` | Migration for both tables |
| `backend/src/reports/dto/index.ts` | All DTO exports |
| `backend/src/reports/dto/create-report.dto.ts` | `CreateReportDto` — title, description, category, relatedEntityId (optional) |
| `backend/src/reports/dto/reply-report.dto.ts` | `ReplyReportDto` — reply text |
| `backend/src/reports/dto/list-reports.dto.ts` | `ListReportsDto` — filter by status, category, pagination |
| `backend/src/reports/reports.controller.ts` | Endpoints below |
| `backend/src/reports/reports.service.ts` | Business logic |
| `backend/src/reports/reports.module.ts` | Module wiring |

### Backend Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/reports` | User | Submit a new report |
| `GET` | `/reports` | Admin/Curator | List reports with filters + pagination |
| `GET` | `/reports/:id` | Admin/Curator | Get single report with replies |
| `PATCH` | `/reports/:id/status` | Admin/Curator | Update report status (open → in_progress / resolved / closed) |
| `POST` | `/reports/:id/replies` | Admin/Curator | Add a reply to a report (triggers notification to reporter) |
| `GET` | `/reports/my` | User | Get current user's own reports |

---

## Data Model

### Report Entity

```ts
// status: open | in_progress | resolved | closed
// priority: low | medium | high | urgent
// category: bug | payout_issue | question_issue | abuse | feature_request | other
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ name: 'user_id', type: 'uuid' }) @Index()
  userId: string

  @Column({ type: 'varchar', length: 100 })
  title: string

  @Column({ type: 'text' })
  description: string

  @Column({ type: 'varchar', length: 50 })
  category: ReportCategory   // 'bug' | 'payout_issue' | 'question_issue' | 'abuse' | 'feature_request' | 'other'

  @Column({ type: 'varchar', length: 20, default: 'open' }) @Index()
  status: ReportStatus       // 'open' | 'in_progress' | 'resolved' | 'closed'

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: ReportPriority   // 'low' | 'medium' | 'high' | 'urgent'

  // Optional link to an existing entity (e.g. a question ID or withdrawal ID)
  @Column({ name: 'related_entity_id', type: 'uuid', nullable: true })
  relatedEntityId: string | null

  @Column({ name: 'related_entity_type', type: 'varchar', length: 50, nullable: true })
  relatedEntityType: string | null  // 'question' | 'withdrawal' | 'wallet'

  @ManyToOne(() => User, (u) => u.reports) @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(() => ReportReply, (r) => r.report)
  replies: ReportReply[]

  @CreateDateColumn() createdAt: Date
  @UpdateDateColumn() updatedAt: Date
}
```

### ReportReply Entity

```ts
@Entity('report_replies')
export class ReportReply {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ name: 'report_id', type: 'uuid' }) @Index()
  reportId: string

  @Column({ name: 'admin_id', type: 'uuid' }) @Index()
  adminId: string          // The admin/curator who replied

  @Column({ type: 'text' })
  message: string

  @ManyToOne(() => Report, (r) => r.replies) @JoinColumn({ name: 'report_id' })
  report: Report

  @ManyToOne(() => User) @JoinColumn({ name: 'admin_id' })
  admin: User

  @CreateDateColumn() createdAt: Date
}
```

---

## Implementation Details

### ReportsService — reply notification logic

When `addReply()` is called:

1. Persist the `ReportReply`.
2. Find the original report's `userId` (the reporter).
3. Create a `Notification` record for that user:
   - type: `NotificationType.REPORT_REPLY`
   - title: `"Your report has been replied to"`
   - body: First 100 chars of the reply message
   - data: `{ reportId, replyId }`
   - triggerType: `NotificationTriggerType.SYSTEM`
4. Send Expo push notification via `NotificationsService.sendToUser()`.
5. Update report `status` to `in_progress` if it was `open`.

### ReportsController

- `POST /reports` — any authenticated user.
- `GET /reports` — guards: roles `[admin, curator, super_admin]`. Supports query params: `status`, `category`, `page`, `limit`.
- `GET /reports/:id` — same roles. Returns report + all replies preloaded.
- `PATCH /reports/:id/status` — same roles. Body: `{ status }`.
- `POST /reports/:id/replies` — same roles. Body: `{ message }`.
- `GET /reports/my` — any authenticated user. Returns their own reports.

### Module wiring

- Import `TypeOrmModule.forFeature([Report, ReportReply, Notification])`.
- Import `NotificationsModule` to call `NotificationsService`.
- Import `UserModule` if needed for user lookups.

---

## Web Frontend (Admin Panel)

| File | Purpose |
|------|---------|
| `web/src/pages/reports/ReportsPage.tsx` | List all reports with filters (status, category) + pagination |
| `web/src/pages/reports/ReportDetailPage.tsx` | Single report view with reply thread + reply form |
| `web/src/api/reports.ts` | API client functions |
| Update `web/src/App.tsx` | Add routes for `/reports` and `/reports/:reportId` |
| Update `web/src/lib/roles.ts` | Add `reports: ['admin', 'curator', 'super_admin']` |
| Update `web/src/components/layout/Sidebar.tsx` | Add "Reports" nav link |

### ReportsPage features
- Filter bar: status dropdown (All / Open / In Progress / Resolved / Closed), category dropdown.
- Table columns: ID (truncated), Reporter name, Title, Category badge, Priority badge, Status badge, Created date, Actions (View button).
- Pagination: prev/next + page indicator.
- Clicking a row → navigate to `/reports/:reportId`.

### ReportDetailPage features
- Top: Report metadata (reporter, category, priority, status, created at).
- Middle: Full description.
- Bottom: Reply thread — admin replies on left (or right), chronological.
- Reply form at bottom: textarea + "Send Reply" button.
- Status update: dropdown to change status inline.

---

## Mobile Frontend (User Report Submission)

| File | Purpose |
|------|---------|
| `mobile/src/screens/Report/ReportScreen.tsx` | Form: title, category picker, description, optional related entity link |
| `mobile/src/api/reports.ts` | API client |
| Update `mobile/src/navigation/types.ts` | Add ReportStack param list |
| Update `mobile/src/navigation/AppNavigator.tsx` | Add Report screen to appropriate stack |
| Add translation keys in `mobile/src/i18n/resources.ts` | For report-related strings |

### ReportScreen features
- Title input (max 100 chars).
- Category picker: Bug, Payout Issue, Question Issue, Abuse, Feature Request, Other.
- Description textarea (required, max 2000 chars).
- Optional: show a "Related to" selector if the user is viewing a question/withdrawal context (pass `relatedEntityId` + `relatedEntityType`).
- Submit button → POST `/reports` → show success toast → navigate back.
- View "My Reports" link → goes to `MyReportsScreen` (reuse or extend an existing screen).

---

## Notifications — New Type

Add to `NotificationType` enum in `notification.entity.ts`:

```ts
REPORT_REPLY = 'report_reply'
```

This already has infrastructure via `NotificationsService`. The notification data payload should include `{ reportId }` so the mobile app can deep-link to the report detail.

---

## Acceptance Criteria

1. User can submit a report from mobile with category, title, and description.
2. Admins can see all reports in a paginated, filterable list in the web panel.
3. Admins can open a report, read the full description, and see the reply thread.
4. Admins can type and send a reply — which persists and updates status to `in_progress`.
5. The original reporter receives an in-app notification immediately after the reply is sent.
6. The reporter's device receives an Expo push notification if they have a push token.
7. Report status can be updated by admins at any time.
8. Users can view their own submitted reports (list + detail).
9. All actions are audited via the existing `AuditLog` system (audit.service.ts log call).

---

## Notes

- The `relatedEntityId` / `relatedEntityType` fields are optional — they allow linking a report to a specific question or withdrawal the user is frustrated about.
- Report replies are **admin-to-user only** (user cannot reply back in v1). The thread is read-only for the reporter.
- The web panel reply thread should show the admin's name + avatar next to each reply.
- Use existing `NotificationsService` from `backend/src/notifications/notifications.service.ts` — do not duplicate push logic.
- Seed/admin scripts are out of scope.
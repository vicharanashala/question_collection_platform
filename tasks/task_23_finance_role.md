# Task: Introduce Finance Admin Role

**Status:** Done  
**Module:** Backend (auth/roles) + Web Admin UI  
**Owner:** —  
**Created:** 2026-06-29

---

## Summary

Introduce a new `finance` role on the admin side — a user scoped purely to financial operations. They can view the financial dashboard, manage wallets, and handle withdrawal requests. They have **no access** to user management, content moderation, fraud monitoring, or system configuration.

---

## Scope

### What the finance role CAN do

| Area | Actions |
|------|---------|
| Dashboard | View financial summary stats (total payouts, withdrawal volume, wallet balances, etc.) |
| Wallets | List and search all wallets; view wallet detail (balance, transactions, adjustments) |
| Withdrawals | List, filter, and view withdrawal requests; approve or reject withdrawal requests |
| Analytics | View withdrawal and wallet-related analytics |

### What the finance role CANNOT do

- Access user management (list users, suspend, ban, verify)
- Access questions, reviews, or curator queue
- Access fraud monitoring
- Access reward summaries or reward logs
- Access audit logs
- Access system configuration
- Create, edit, or delete any user or content

---

## Backend Changes

### 1. Enum additions (`backend/src/common/enums/index.ts`)

Add to `UserRole`:
```typescript
FINANCE = 'finance'
```

Add to `ActorType` (for audit trail differentiation):
```typescript
FINANCE = 'finance'
```

### 2. Admin Controller — add finance role to finance-relevant endpoints

Finance-scoped endpoints should be annotated:
```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
```

Specifically:
- `GET /admin/analytics/financial-summary` — financial dashboard stats (new or existing)
- `GET /admin/wallets` — list/search wallets
- `GET /admin/wallets/:walletId` — wallet detail
- `POST /admin/wallets/:walletId/adjust` — balance adjustment (if wallet-adjust is admin-gated)
- `GET /admin/withdrawals` — list/filter withdrawals
- `GET /admin/withdrawals/:id` — withdrawal detail
- `POST /admin/withdrawals/:id/approve` — approve withdrawal
- `POST /admin/withdrawals/:id/reject` — reject withdrawal with reason

### 3. Restrict non-finance endpoints from finance role

Add explicit override decorators to lock down non-finance endpoints:
```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)  // no FINANCE
```
on: Users, Questions, Reviews, Fraud, Rewards, Audit Logs, Config.

### 4. Audit trail — use `ActorType.FINANCE`

Ensure withdrawal approve/reject actions and wallet adjustments performed by a finance user record `ActorType.FINANCE` in audit logs.

### 5. AdminService

- Add a `reviewerRole` parameter (similar to curator review pattern) to withdrawal approve/reject methods for correct `ActorType` in audit logs.
- If a financial-summary endpoint doesn't exist, create one returning: total paid out, pending withdrawals count and amount, total wallet balance, today's payout volume.

---

## Frontend Changes (Web Admin UI)

### 1. Role constant update (`web/src/lib/roles.ts`)

```typescript
export type Role = 'user' | 'curator' | 'finance' | 'admin' | 'super_admin'
```

Update `ROLE_HIERARCHY`:
```typescript
finance: 1,  // above curator, below admin
```

Add helper:
```typescript
export function isFinanceOrAbove(user: AuthUser | null | undefined): boolean {
  return user?.role === 'finance' || user?.role === 'admin' || user?.role === 'super_admin'
}
```

### 2. Sidebar — finance role navigation (`web/src/components/layout/Sidebar.tsx`)

Finance role sees only:
- Dashboard (financial summary view)
- Wallets
- Withdrawals
- (no Users, Questions, Reviews, Fraud, Rewards, Audit Logs, Settings)

Super admin and admin still see all items.

### 3. Dashboard page — finance variant (`web/src/pages/dashboard/DashboardPage.tsx`)

When role is `finance`, show financial stats instead of user/question metrics:
- Total Payouts (all time)
- Pending Withdrawals (count + amount)
- Total Wallet Balance
- Today's Payout Volume

If role is `admin`/`super_admin`/`curator`, keep existing stat cards.

### 4. New dedicated pages (or route guards)

Existing pages handle finance use cases, but must be gated:
- `/wallets` — accessible to finance, admin, super_admin
- `/withdrawals` — accessible to finance, admin, super_admin
- `/dashboard` — adapts content based on role

No new pages needed; reuse existing `WalletsPage`, `WithdrawalsPage`, and `DashboardPage` with role-conditional content.

---

## Pages / Components to Touch

| File | Change |
|------|--------|
| `backend/src/common/enums/index.ts` | Add `FINANCE` to `UserRole` and `ActorType` |
| `backend/src/admin/admin.controller.ts` | Add/remove `@Roles` decorators on affected endpoints |
| `backend/src/admin/admin.service.ts` | Add `reviewerRole` param to withdrawal actions; add financial-summary endpoint |
| `web/src/lib/roles.ts` | Add `finance` role, hierarchy, and helper |
| `web/src/components/layout/Sidebar.tsx` | Filter nav items by role |
| `web/src/pages/dashboard/DashboardPage.tsx` | Role-conditional stat cards |
| `web/src/App.tsx` | Ensure route guards are in place for finance role |

---

## DB Migration

No migration needed. `FINANCE = 'finance'` is a new enum string value stored in the existing `role` column.

---

## Acceptance Criteria

- [x] Finance user can log in and see only Dashboard, Wallets, Withdrawals in sidebar
- [x] Finance user cannot access `/users`, `/questions`, `/reviews`, `/audit-logs`, `/settings`
- [x] Finance user can view the financial dashboard stats
- [x] Finance user can list/search wallets and view wallet detail
- [x] Finance user can list/filter withdrawals and view withdrawal detail
- [x] Finance user can approve or reject a withdrawal (with reason)
- [x] Wallet balance adjustments by finance user are logged with `ActorType.FINANCE` (super_admin-only endpoint; adjustment still uses `ActorType.ADMIN` in that case)
- [x] Withdrawal approve/reject by finance user is logged with `ActorType.FINANCE`
- [x] Super admin can assign the `finance` role to a user (existing user management endpoints — role enum now includes `finance`)
- [x] TypeScript builds clean (`tsc --noEmit`) in both `backend` and `web`
- [x] Vite build passes clean in `web`

### Mobile (React Native)

- [x] `UserRole.FINANCE` added to `types/index.ts`
- [x] `isFinance` helper and `FinanceNavigator` added in `AppNavigator.tsx`
- [x] Finance role sees `FinanceDashboardScreen`, `FinanceWithdrawalsScreen`, `FinanceWalletsScreen`, `FinanceProfile`
- [x] Finance cannot navigate to admin screens (Users, Questions, AuditLogs, Config)
- [x] Finance can approve/reject pending withdrawals; retry/mark-failed stays admin/super_admin only
- [x] `FinanceWalletsScreen` — list/search/filter wallets + `WalletDetailModal` integration
- [x] `FinanceDashboardScreen` — financial summary with stats, daily payout mini-chart
- [x] `getFinancialSummary` and `getWallets` added to mobile `api/client.ts`

---

## Notes

- Follow the same pattern established by the `curator` role for decorator overrides and `ActorType` audit differentiation.
- The finance role has no write access to questions, users, or any non-financial resource.
- Finance role should not appear as an option when creating/editing users via the admin panel unless the current actor is `super_admin`.
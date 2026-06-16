# Task 14: Web Admin UI

**Module:** Web Admin UI  
**Status:** In Progress  
**Developer:** —  
**Started:** 2026-06-16

---

## Context

A full-featured React+Tailwind web admin panel for the question collection platform. Serves super admins, admins, and curators who need to manage users, moderate questions, review flagged content, and view analytics — from a desktop browser.

---

## Deliverables

### 1. Project Scaffolding
- [x] Vite + React 18 + TypeScript
- [x] Tailwind CSS + shadcn/ui component style
- [x] React Router v6 (lazy-loaded routes)
- [x] Vite build passes clean (`tsc --noEmit` zero errors)

### 2. Authentication
- [x] Login page (phone + OTP flow matching mobile API)
- [x] JWT token storage (localStorage)
- [x] Auth context with role-based guards
- [x] Auto-redirect to login on 401

### 3. Theme / Light-Dark Mode
- [x] CSS custom properties (HSL-based) on `:root` / `.dark`
- [x] Theme persisted in localStorage
- [x] Toggle in header
- [ ] System preference detection on first load

### 4. Layout
- [x] Fixed sidebar (collapsible on mobile)
- [x] Mobile hamburger + drawer (`MobileNav`)
- [x] Persistent header with user info + logout
- [x] Logout confirmation dialog (Header + Sidebar)

### 5. Dashboard Page (`/dashboard`)
- [x] Stat cards: Total Users, Verified Users, Pending Review, Today's Questions
- [x] Recent Questions table (last 5)
- [x] Quick actions: Approve/Reject recent questions

### 6. Users Page (`/users`)
- [x] Paginated user list with search
- [x] Filter by status (verified, pending, suspended, banned)
- [x] Role filter (super_admin only)
- [x] User avatar with initials fallback
- [x] Click to User Detail

### 7. User Detail Page (`/users/:id`)
- [x] Full user profile display
- [x] Questions submitted by user
- [x] Suspend / Ban action with reason + duration dialog
- [x] Unsuspend action
- [x] Role badge display

### 8. Questions Page (`/questions`)
- [x] Paginated question list with search
- [x] Filter by status (pending, ai_review, human_review, approved, rejected)
- [x] Domain category and crop type filters
- [x] Inline Approve / Reject buttons
- [x] Rejection reason display

### 9. Reviews Page (`/reviews`) — Curator Queue
- [x] Human review queue
- [x] Approve / Reject with reason
- [x] Question detail view
- [x] Status badge mapping

### 10. Profile Page (`/profile`)
- [x] Current user display
- [x] Role and status badges
- [x] Basic info display (read-only for now)

### 11. Global UI Polish
- [x] All buttons: proper dark mode text (no hardcoded `text-white` on non-solid variants)
- [x] `outline` button: transparent bg in dark mode, not `bg-background`
- [x] Dialog: `bg-card` surface with `text-card-foreground`
- [x] Dialog overlay: `bg-black/80` in dark mode
- [x] Input: `text-foreground` + `dark:bg-card`
- [x] Select: `dark:bg-card text-foreground` for all native dropdowns
- [x] Tabs active state: `bg-primary text-primary-foreground` (not `bg-background`)
- [x] Stat card icon containers: semantic color CSS vars (no hardcoded `bg-[hsl(...)]`)
- [x] Sidebar: dark-mode safe nav with correct opacity levels
- [x] Custom scrollbar styling
- [ ] Add User button visible to super_admin only on Users page
- [x] Add User dialog: name, mobile, role, category, state, district, block

### 12. Add User (super_admin only)
- [x] "Add User" button on UsersPage (top right, super_admin only)
- [x] Modal form: name, mobile number, role, category (for user role), state, district, block
- [x] Validation: required fields checked before submit
- [x] API call: `adminApi.createUser()`
- [x] List refreshes after successful creation

---

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v3 + CSS custom properties
- **Components:** shadcn/ui-inspired (custom, no npm dependency)
- **Charts:** Recharts
- **Routing:** React Router v6 (lazy)
- **Icons:** Lucide React
- **State:** React Context (AuthContext, ThemeContext, PrefetchContext)
- **API:** Axios with JWT interceptors

---

## Notes

- Build command: `cd web && npx vite build` — must pass with zero errors
- TypeScript: `cd web && npx tsc --noEmit` — must pass with zero errors
- All pages are lazy-loaded via `LazyRoute` wrapper
- Mobile nav is a drawer (not a sidebar) triggered by hamburger in header
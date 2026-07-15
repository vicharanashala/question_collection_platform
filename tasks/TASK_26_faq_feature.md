# Task 26: FAQ Feature

**Module:** FAQ  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From the stakeholder requirement: Users need access to frequently asked questions (FAQs) to self-serve answers about the platform. FAQs may include optional video content. Admins must be able to create, manage, and toggle visibility of FAQs from the admin panel. Hidden FAQs are not shown to end users.

---

## User-Facing Requirements

### Profile Actions Section
- [ ] Add "Help & FAQ" option in the profile actions section (alongside existing profile actions if any)
- [ ] "Help & FAQ" navigates to a dedicated FAQ list screen

### FAQ List Screen (User)
- [ ] Display all visible (non-hidden) FAQs in a clean list/accordion format
- [ ] Each FAQ item shows: Question (title) and Answer (expandable content)
- [ ] FAQs are sorted by creation order or a display_order field
- [ ] Empty state when no FAQs are available

### Admin-Facing Requirements

### FAQ Management Screen (Admin)
- [ ] List all FAQs (both visible and hidden) with status indicator
- [ ] "Add FAQ" button opens a form/dialog
- [ ] FAQ form fields:
  - Question (required, text)
  - Answer (required, textarea or rich text)
  - Visibility toggle (visible/hidden, default: visible)
- [ ] Inline hide/unhide toggle per FAQ item (no need for edit modal just to toggle visibility)
- [ ] Edit FAQ (open form pre-filled)
- [ ] Delete FAQ (with confirmation dialog)

---

## Database Schema

### `faqs` table
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | Primary key |
| question | VARCHAR(500) | NOT NULL | FAQ question/title |
| answer | TEXT | NOT NULL | FAQ answer content |
| is_visible | BOOLEAN | NOT NULL DEFAULT true | Visibility flag — hidden FAQs not shown to users |
| display_order | INTEGER | NOT NULL DEFAULT 0 | Sort order |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update timestamp |

### Migrations
- [ ] Migration: `YYYY-MM-DD_CreateFaqsTable` (add to backend/src/database/migrations/)

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /faqs | Public (or user auth) | List all visible FAQs (user-facing) |
| GET | /admin/faqs | Admin | List all FAQs (including hidden) |
| POST | /admin/faqs | Admin | Create a new FAQ |
| PATCH | /admin/faqs/:id | Admin | Update an FAQ (question, answer) |
| PATCH | /admin/faqs/:id/visibility | Admin | Toggle is_visible flag |
| DELETE | /admin/faqs/:id | Admin | Delete an FAQ |

---

## Web Frontend (`/web`)

### User-Facing FAQ Screen
- [ ] `web/src/pages/faqs/FaqListPage.tsx` — Public/user-facing FAQ list page
- [ ] Display all visible FAQs in a list or accordion format
- [ ] Each FAQ item shows: Question (title) and Answer (expandable/collapsible content)
- [ ] Empty state when no FAQs are available

### Admin-Facing Requirements (Web)

#### Admin Navigation
- [ ] Add "FAQ Management" sidebar link (visible to admin, super_admin roles)
- [ ] Route: `/admin/faqs` (or `/faqs` within the admin section)
- [ ] Add PAGE_ROLES entry for the FAQs page

#### App.tsx changes
- [ ] Add route `/faqs` (user-facing FAQ list, public or authenticated)
- [ ] Add route `/admin/faqs` (admin panel, admin/super_admin only)
- [ ] Add PAGE_ROLES entry for faqs page (user-facing) and admin faqs page (admin)

#### Admin FAQ Management Page
- [ ] `web/src/pages/faqs/FaqsPage.tsx` — Admin FAQ management list + add/edit dialog
- [ ] Accessible only to admin and super_admin roles

#### FAQ Table/List (Admin)
- [ ] Table with columns: Question, Status (Visible/Hidden badge), Actions
- [ ] Display all FAQs (both visible and hidden)
- [ ] "Add FAQ" button opens add/edit dialog
- [ ] Edit button per row opens pre-filled dialog
- [ ] Inline visibility toggle per row (switch or icon button)
- [ ] Delete button per row with confirmation dialog

#### Add/Edit FAQ Dialog
- [ ] Modal dialog with fields:
  - Question (required, text input)
  - Answer (required, textarea or rich text editor)
  - Visibility toggle (visible/hidden switch, default: visible)
- [ ] Validation: question and answer required before submit
- [ ] On submit: POST (create) or PATCH (edit) to respective API endpoints
- [ ] On successful save: close dialog, refresh list, show success toast

#### Inline Visibility Toggle
- [ ] Toggle switch or icon button per FAQ item in the table
- [ ] Calls `PATCH /admin/faqs/:id/visibility`
- [ ] Optimistic UI update + rollback on API failure

#### Delete FAQ
- [ ] Delete button per row triggers confirmation dialog
- [ ] Confirmation dialog: "Are you sure you want to delete this FAQ?"
- [ ] On confirm: remove from table, call DELETE `/admin/faqs/:id`, show success toast

---

## Mobile Frontend (`/mobile`)

### User FAQ Screen
- [ ] `mobile/src/app/(tabs)/faq.tsx` or `mobile/src/app/faq.tsx` — User-facing FAQ list
- [ ] Navigation entry: "Help & FAQ" in profile actions section

### Profile Actions
- [ ] Add "Help & FAQ" action item in the profile screen actions area

### FAQ List Item
- [ ] Accordion-style expansion for answer
- [ ] If the FAQ screen has a video section, render it alongside the answer (see Video Rendering below)
- [ ] Only visible FAQs are fetched/displayed

### Admin-Facing Requirements (Mobile)

#### Admin Navigation
- [ ] Add "FAQ Management" entry in the admin sidebar/bottom tabs (matching other admin section items like Users, Reports, etc.)
- [ ] Route: `/admin/faqs` (or nested under `(admin)/faqs`)

#### Admin FAQ Management Screen
- [ ] `mobile/src/app/(admin)/faqs/` — Admin FAQ management list screen (accessible to admin/super_admin roles only)
- [ ] Stack navigator or nested route under `(admin)` tab/layout
- [ ] Add route guard to restrict access to admin users

#### FAQ List (Admin)
- [ ] Display all FAQs (both visible and hidden) in a list or table format
- [ ] Show status indicator per item (Visible / Hidden badge)
- [ ] Floating action button (FAB) or header button for "Add FAQ"
- [ ] Pull-to-refresh to reload FAQ list

#### Add/Edit FAQ Form
- [ ] Bottom sheet or full-screen modal form
- [ ] Fields: Question (required, text input), Answer (required, multiline text area), Visibility toggle (visible/hidden switch)
- [ ] Validation: question and answer required before submit
- [ ] On submit: POST (create) or PATCH (edit) to respective API endpoints
- [ ] On successful save: close form, refresh list, show success toast

#### Inline Visibility Toggle
- [ ] Toggle switch or icon button per FAQ item to toggle visibility without opening edit form
- [ ] Calls `PATCH /admin/faqs/:id/visibility`
- [ ] Optimistic UI update + rollback on failure

#### Delete FAQ
- [ ] Swipe-to-delete or long-press menu with "Delete" option
- [ ] Confirmation alert/dialog before calling DELETE endpoint
- [ ] On confirm: remove from list with animation, call DELETE API

---

## Backend (NestJS — `/backend`)

### Module
- [ ] `backend/src/faqs/` module with controller, service, repository

### Service methods
- [ ] `findAllVisible()` — returns FAQs where is_visible = true
- [ ] `findAll()` (admin) — returns all FAQs
- [ ] `create(dto)` — creates FAQ
- [ ] `update(id, dto)` — updates FAQ fields
- [ ] `toggleVisibility(id)` — flips is_visible flag
- [ ] `delete(id)` — removes FAQ

### DTOs
- [ ] CreateFaqDto: question, answer, is_visible (optional, default true)
- [ ] UpdateFaqDto: all fields optional
- [ ] ToggleVisibilityDto: is_visible (boolean)

---

## Video Rendering

The video section is a standalone UI element rendered on the FAQ screen. It is independent of any individual FAQ record. No video URL or asset is stored in the backend.

### Mobile Video Rendering
- [ ] Dedicated video section rendered below the FAQ answer area
- [ ] YouTube URL played via WebView or InAppBrowser
- [ ] Video playback controls: play/pause, seek, fullscreen
- [ ] Video thumbnail shown before play
- [ ] Graceful fallback: if video fails to load, show a placeholder instead of crashing

### Web Video Rendering
- [ ] YouTube embed via iframe or embed component
- [ ] Video thumbnail/play button overlay before playback

---

## Tech Stack

- **Backend:** NestJS, TypeORM/Postgres
- **Web:** React + TypeScript + Vite (shadcn/ui-style components)
- **Mobile:** React Native (Expo), expo-av for video

---

## Notes

- Only admins (role: admin, super_admin) can access the admin FAQ management page
- All users (including unauthenticated if desired) can view visible FAQs
- Hidden FAQs are filtered out at the service layer for the public/user endpoint
- Consider adding `display_order` to allow manual reordering of FAQs in future (optional for v1)
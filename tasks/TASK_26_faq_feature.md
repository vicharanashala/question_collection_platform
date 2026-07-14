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
- [ ] If an FAQ has an associated video, display an inline video player or video thumbnail with play option
- [ ] FAQs are sorted by creation order or a display_order field
- [ ] Empty state when no FAQs are available

### Admin-Facing Requirements

### FAQ Management Screen (Admin)
- [ ] List all FAQs (both visible and hidden) with status indicator
- [ ] "Add FAQ" button opens a form/dialog
- [ ] FAQ form fields:
  - Question (required, text)
  - Answer (required, textarea or rich text)
  - Video URL (optional, URL field — supports YouTube, Vimeo, or hosted video links)
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
| video_url | VARCHAR(1000) | NULLABLE | Optional video URL |
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
| PATCH | /admin/faqs/:id | Admin | Update an FAQ (question, answer, video_url) |
| PATCH | /admin/faqs/:id/visibility | Admin | Toggle is_visible flag |
| DELETE | /admin/faqs/:id | Admin | Delete an FAQ |

---

## Web Frontend (Admin Panel — `/web`)

### New Pages
- [ ] `web/src/pages/faqs/FaqsPage.tsx` — Admin FAQ management list + add/edit dialog

### App.tsx changes
- [ ] Add route `/faqs` for admin panel (visible to admin, super_admin)
- [ ] Add PAGE_ROLES entry for faqs page

### Components
- [ ] FaqsPage: table/list of FAQs with columns: Question, Has Video, Status (Visible/Hidden), Actions
- [ ] Add/Edit FAQ dialog: question, answer (textarea), video_url (input), is_visible toggle
- [ ] Confirm delete dialog

---

## Mobile Frontend (`/mobile`)

### User FAQ Screen
- [ ] `mobile/src/app/(tabs)/faq.tsx` or `mobile/src/app/faq.tsx` — User-facing FAQ list
- [ ] Navigation entry: "Help & FAQ" in profile actions section

### Profile Actions
- [ ] Add "Help & FAQ" action item in the profile screen actions area

### FAQ List Item
- [ ] Accordion-style expansion for answer
- [ ] Video player (use expo-av or a webview for video URLs) shown when FAQ has video_url
- [ ] Only visible FAQs are fetched/displayed

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
- [ ] CreateFaqDto: question, answer, video_url (optional), is_visible (optional, default true)
- [ ] UpdateFaqDto: all fields optional
- [ ] ToggleVisibilityDto: is_visible (boolean)

---

## Video Support Notes

- Video URL field accepts direct URLs (MP4), YouTube, Vimeo links
- On mobile: use `expo-av` Video component for direct MP4 URLs; for YouTube/Vimeo, use InAppBrowser or WebView
- On web admin: video URL can be validated and previewed before saving
- Videos in FAQ list are shown as collapsible/expandable inline players or thumbnails

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
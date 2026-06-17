# Task 15: Push Notifications for Question Status Changes

**Module:** Notification  
**Status:** Pending  
**Goal ID:** 34bd1222-e70c-429d-9079-e17a8b57769a  
**Started:** —  
**Completed:** —

---

## Context

When a question is approved, rejected, or placed on hold by a curator or admin, the submitting user should receive a push notification informing them of the outcome and the reason.

This task covers:
- Sending push notifications to the user when their question status changes
- Notifications must include the reason (from `approval_reason` / `held_reason` fields in the database)
- Supporting all three statuses: **approved**, **rejected**, **hold**

**Trigger points** (to be identified in codebase):
- Question approved by curator/admin
- Question rejected by curator/admin
- Question placed on hold by curator/admin

**Note:** `approval_reason` and `held_reason` fields already exist in the database (see migrations `1781592000000-AddApprovalReason.js` and `1781591000000-AddHeldReason.js`).

---

## Sub-Tasks

### 1. Audit & Discovery
- [ ] Identify where question status transitions happen in the codebase (API routes, services, or controllers that handle approve/reject/hold actions)
- [ ] Identify or decide how user push notification tokens are stored (e.g., `User` model — does it have a `push_token` or `notification_token` field?)
- [ ] Check if any existing notification infrastructure is in place

### 2. Database / Storage
- [ ] Ensure `User` model has fields for storing push notification tokens (e.g., `fcm_token`, `apns_token`, or a separate `user_notification_tokens` table)
- [ ] Document the token storage approach in the task file once confirmed

### 3. Notification Service
- [ ] Create a `NotificationService` (or equivalent) that can send push notifications
- [ ] Support both FCM (Android/Web) and APNs (iOS) push notification protocols
- [ ] Include the following in the notification payload:
  - Title: e.g., "Your question has been approved" / "Your question was not approved" / "Your question has been placed on hold"
  - Body: includes the reason from `approval_reason` or `held_reason`
  - Data payload: question ID, status, reason (for deep-linking / in-app handling)
- [ ] Handle token expiry / invalid token cleanup gracefully

### 4. Integration
- [ ] Hook the notification dispatch into the question status transition logic (approve / reject / hold)
- [ ] Notifications should be sent asynchronously (do not block the API response)
- [ ] Failures in notification delivery should not fail or rollback the status change

### 5. In-App Notification Centre (optional stretch)
- [ ] Store notifications in the database so users can view their notification history
- [ ] API endpoint to fetch user notifications
- [ ] Mark notifications as read

---

## Technical Notes

- Push credentials (FCM server key, APNs certificates/keys) must be stored securely (environment variables / secrets manager, not in code)
- For development/testing, use Firebase Emulator Suite or APNs sandbox
- Consider using a queue (e.g., Bull, BullMQ, or similar) for sending notifications asynchronously if the volume warrants it

---

## Files to Create/Modify

| File | Action |
|---|---|
| `backend/src/services/NotificationService.ts` | Create |
| `backend/src/models/User.ts` | Modify — add push token fields |
| `backend/src/routes/...` (review/curator routes) | Modify — dispatch notification on status change |
| `backend/src/lib/push.ts` or similar | Create — FCM/APNs client wrapper |
| `.env.example` | Add push credential env vars |

---

## Acceptance Criteria

1. When a curator or admin **approves** a question, the submitting user receives a push notification with the approval reason.
2. When a curator or admin **rejects** a question, the submitting user receives a push notification with the rejection reason.
3. When a curator or admin **holds** a question, the submitting user receives a push notification with the hold reason.
4. The notification payload is structured appropriately for both FCM and APNs.
5. Notification delivery failures do not affect the status change operation.
6. Push tokens are stored and associated with the correct user.
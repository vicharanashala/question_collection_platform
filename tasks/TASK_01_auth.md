# Task 1: Authentication (OTP Login + Registration)

**Module:** Auth
**Status:** Completed
**Developer:** Claw
**Started:** 2026-06-12
**Completed:** 2026-06-12
**Completed:** -

---

## Context

From PRD:
- Mobile OTP Login
- User Registration with category-based profile
- Profile Management
- Language Selection (all regional languages)

From Architecture:
- OTP generation/verification, session management, token issuance
- Stateless JWT-based auth

---

## Sub-Tasks

### 1. Auth Module
- [x] OTP generation and SMS gateway integration
- [x] OTP verification endpoint
- [x] JWT token issuance on successful login
- [x] Mobile number registration with category selection
- [x] Language preference selection (22 Indian languages)

### 2. User Registration Fields
- [x] Name
- [x] Mobile Number
- [x] State, District, Block
- [x] Category: Farmer, FPO, Student, Volunteer, NGO
- [x] Category-specific fields:
  - Farmer: farm_size, crop_type
  - Student: course_name, university_name
  - FPO: organization_name, role
  - Volunteer/NGO: organization_name, role

### 3. Profile Management
- [x] View profile
- [x] Edit profile
- [x] Update crop details

### 4. Database Tables
- [x] `users` table (see database.md)
- [x] `user_crop_details` table (see database.md)

### 5. Security
- [x] Rate limiting on OTP requests
- [x] OTP expiry (5 minutes)
- [x] RBAC for protected routes

---

## API Endpoints (TBD from implementation)

## Notes

TBD during implementation
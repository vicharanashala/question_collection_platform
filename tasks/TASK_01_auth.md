# Task 1: Authentication (OTP Login + Registration)

**Module:** Auth  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

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
- [ ] OTP generation and SMS gateway integration
- [ ] OTP verification endpoint
- [ ] JWT token issuance on successful login
- [ ] Mobile number registration with category selection
- [ ] Language preference selection (22 Indian languages)

### 2. User Registration Fields
- [ ] Name
- [ ] Mobile Number
- [ ] State, District, Block
- [ ] Category: Farmer, FPO, Student, Volunteer, NGO
- [ ] Category-specific fields:
  - Farmer: farm_size, crop_type
  - Student: course_name, university_name
  - FPO: organization_name, role
  - Volunteer/NGO: organization_name, role

### 3. Profile Management
- [ ] View profile
- [ ] Edit profile
- [ ] Update crop details

### 4. Database Tables
- [ ] `users` table (see database.md)
- [ ] `user_crop_details` table (see database.md)

### 5. Security
- [ ] Rate limiting on OTP requests
- [ ] OTP expiry (5 minutes)
- [ ] RBAC for protected routes

---

## API Endpoints (TBD from implementation)

## Notes

TBD during implementation
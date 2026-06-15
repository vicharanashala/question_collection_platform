# Task 2: User Profile Management

**Module:** User
**Status:** Completed
**Developer:** Claw
**Started:** 2026-06-15
**Completed:** 2026-06-15

---

## Context

From PRD:
- Complete profile based on user category
- Mandatory profile fields vary by category
- Crop details management

---

## Sub-Tasks

### 1. Profile Management
- [x] View full profile
- [x] Edit profile (name, state, district, block)
- [x] Category-specific field editing

### 2. Crop Details
- [x] Add crop (name, season)
- [x] Edit crop
- [x] Remove crop
- [x] Seasons: kharif, rabi, zaid, year_round

### 3. Profile Completion
- [x] Progress indicator
- [x] Mandatory field validation
- [x] Verification status tracking

### 4. User Limits
- [ ] State-level user limit enforcement (max 100 per state, configurable)

---

## Implementation Notes

- `CropManagementScreen` — add/edit/delete crops with season picker modal
- `ProfileCompletionWidget` — adaptive progress bar with coloured pill chips for missing fields; adapts colour by completion % (green ≥75%, amber ≥40%, red <40%)
- `EditProfileScreen` — category-specific fields: Farmer/FPO (farmSize, cropType), Student (courseName, universityName), NGO/Volunteer (organisationName, memberRole)
- `ProfileScreen` — crops card navigates to CropManagement; season labels localized
- `PublicUser` type extended with `CropSeason` enum, category-specific fields, `ProfileCompletionStatus`
- `CropManagement` registered as modal screen in `RootStackParamList`
- All 23 locale files updated with new i18n keys (English fallback)
- `profile.edit` / `profile.editProfile` added to all locales (was showing raw key)

## API Endpoints (TBD)

## Notes

TBD during implementation
# Task 3: Question Submission

**Module:** Question  
**Status:** Completed  
**Developer:** Claw  
**Started:** 2026-06-13  
**Completed:** 2026-06-13

---

## Context

From PRD:
- Text, Image, Video, Audio submission
- Daily limit: 20 questions per user per day
- Edit window: 30 seconds after submission
- Video: max 10 seconds, max 10 MB (configurable)

Metadata captured:
- User ID, Language, Timestamp, Crop Type
- Domain Category (crop_protection, spray, irrigation, etc.)
- Season, Agro-Climatic Zone
- State, District, Block
- Device Information

---

## Sub-Tasks

### 1. Core Submission
- [x] Text question submission
- [x] Image upload (compress, store in object storage)
- [x] Video upload (duration check, size check, compress)
- [x] Audio upload
- [x] Media URL storage and retrieval

### 2. Metadata Capture
- [x] Auto-capture: user_id, language, timestamp, device_info
- [x] User-select: crop_type, domain_category, season, agro_climatic_zone
- [x] Auto-capture: state, district, block (from user profile)

### 3. Submission Limits
- [x] Daily limit enforcement (20/day, configurable)
- [x] Edit window (30 seconds, configurable)
- [x] Rate limiting

### 4. Database
- [x] `questions` table operations
- [x] Question status workflow: pending → ai_review → human_review → approved/rejected

---

## API Endpoints (TBD)

## Notes

TBD during implementation
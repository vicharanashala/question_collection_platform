# Task 3: Question Submission

**Module:** Question  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

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
- [ ] Text question submission
- [ ] Image upload (compress, store in object storage)
- [ ] Video upload (duration check, size check, compress)
- [ ] Audio upload
- [ ] Media URL storage and retrieval

### 2. Metadata Capture
- [ ] Auto-capture: user_id, language, timestamp, device_info
- [ ] User-select: crop_type, domain_category, season, agro_climatic_zone
- [ ] Auto-capture: state, district, block (from user profile)

### 3. Submission Limits
- [ ] Daily limit enforcement (20/day, configurable)
- [ ] Edit window (30 seconds, configurable)
- [ ] Rate limiting

### 4. Database
- [ ] `questions` table operations
- [ ] Question status workflow: pending → ai_review → human_review → approved/rejected

---

## API Endpoints (TBD)

## Notes

TBD during implementation
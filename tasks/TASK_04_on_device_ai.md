# Task 4: On-Device AI Validation

**Module:** AI  
**Status:** Pending  
**Developer:** —  
**Started:** —  
**Completed:** —

---

## Context

From Architecture:
- Lightweight model for agriculture relevance detection
- Local duplicate detection (exact match + on-device semantic)
- Runs entirely on mobile device before submission
- Confidence threshold: 90%

---

## Sub-Tasks

### 1. Agriculture Relevance Detection
- [ ] Integrate lightweight on-device ML model
- [ ] Score question relevance to agriculture
- [ ] Block submission if confidence < 90%

### 2. Duplicate Detection (On-Device)
- [ ] Exact match comparison against locally cached questions
- [ ] Semantic similarity check (on-device embedding)
- [ ] Duplicate flag, rejection, and in-app notification to user

### 3. Spam Detection
- [ ] Spam pattern detection on-device
- [ ] Flag and warn user

### 4. Pre-Submission Pipeline
- [ ] Run all three checks before allowing submission
- [ ] Show user clear feedback on rejection reasons
- [ ] Cache approved questions locally for duplicate comparison

---

## Model Requirements (TBD)

## Notes

TBD during implementation
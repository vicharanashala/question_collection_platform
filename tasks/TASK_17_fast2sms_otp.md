# Task 17: Fast2SMS OTP Integration

**Module:** Auth
**Status:** Pending
**Feature Branch:** feat/integrate-fast2sms

---

## Context

Fast2SMS is a bulk SMS service provider in India that offers a reliable and cost-effective way to send OTP and transactional SMS messages. We need to integrate Fast2SMS to replace or supplement our current SMS sending mechanism for OTP verification.

**Reference:** [Fast2SMS API Documentation](https://www.fast2sms.com/)

---

## Sub-Tasks

### 1. Fast2SMS Account Setup
- [ ] Create/verify Fast2SMS account with appropriate plan
- [ ] Obtain API key from Fast2SMS dashboard
- [ ] Configure sender ID and template IDs
- [ ] Add API key to environment variables

### 2. SMS Service Module
- [ ] Create `backend/services/smsService.js` for Fast2SMS integration
- [ ] Implement `sendOTP(phoneNumber, otp)` function
- [ ] Implement `sendBulkSMS(phoneNumbers, message)` function
- [ ] Add retry logic with exponential backoff
- [ ] Handle rate limiting (Fast2SMS free tier: 20 SMS/day)

### 3. Environment Configuration
- [ ] Add `FAST2SMS_API_KEY` to `.env.example`
- [ ] Add `FAST2SMS_SENDER_ID` to `.env.example`
- [ ] Add `FAST2SMS_ROUTE` to `.env.example`
- [ ] Document required env vars in README

### 4. Error Handling & Fallbacks
- [ ] Handle API errors gracefully (invalid key, insufficient credits, etc.)
- [ ] Log failed SMS attempts for debugging
- [ ] Implement fallback mechanism if Fast2SMS is unavailable
- [ ] Add monitoring for SMS delivery success rate

### 5. Testing
- [ ] Write unit tests for `smsService.js`
- [ ] Test OTP delivery to verify phone number format handling
- [ ] Test with actual SMS (verify delivery)
- [ ] Verify OTP expiry and retry logic

### 6. Documentation
- [ ] Document Fast2SMS setup process in `docs/sms-setup.md`
- [ ] Update `docs/architecture.md` with SMS service architecture

---

## API Reference

### Fast2SMS API Endpoint
```
POST https://www.fast2sms.com/dev/bulkV2
Headers:
  Authorization: {api_key}
  Content-Type: application/json
Body:
  {
    "route": "otp",
    "variables": "{BB}",
    "numbers": "9999999999",
    "flash": 0
  }
```

### Environment Variables Required
```env
FAST2SMS_API_KEY=your_api_key_here
FAST2SMS_SENDER_ID=MYFARM
FAST2SMS_ROUTE=otp
```

---

## Acceptance Criteria

1. OTP is successfully sent via Fast2SMS when user requests login
2. SMS service handles API errors without crashing the auth flow
3. All SMS-related configuration is environment-variable based
4. Unit tests cover core SMS service functionality
5. Setup documentation allows another developer to configure SMS from scratch

---

## Notes

- Fast2SMS free tier allows 20 SMS/day; production should use paid plan
- OTP message template must be registered with Fast2SMS to avoid delays
- Consider caching OTP in Redis for verification (may already exist in auth module)
- Keep SMS costs low by implementing OTP request rate limiting
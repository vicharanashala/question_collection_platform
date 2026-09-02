# BSNL Retail Push SMS (BRPS) — Implementation Guide

> Replacing **Fast2SMS** with **BSNL BRPS** as the SMS gateway.

---

## Table of Contents

1. [Overview](#1-overview)
2. [How BRPS Differs from Fast2SMS](#2-how-brps-differs-from-fast2sms)
3. [Project Changes](#3-project-changes)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
5. [Configuration](#5-configuration)
6. [DLT Registration Requirements](#6-dlt-registration-requirements)
7. [Testing](#7-testing)
8. [Rollback Plan](#8-rollback-plan)

---

## 1. Overview

**BSNL Retail Push SMS (BRPS)** is a DLT-compliant bulk SMS service from BSNL Kerala. It is a prepaid service requiring:

- Principal Entity (PE) registration on the BSNL DLT portal: https://www.ucc-bsnl.co.in/
- Account onboarding on the BRPS customer portal: https://bulksms.bsnl.in/
- Prepaid SMS pack purchase before sending

**BRPS Base URL:** `https://bulksms.bsnl.in:5010`

---

## 2. How BRPS Differs from Fast2SMS

| Aspect | Fast2SMS | BSNL BRPS |
|---|---|---|
| Auth method | API key in header | JWT bearer token (obtained via username/password) |
| Token validity | Permanent (until revoked) | 1 year from creation |
| Message format | Plain text via `/dev/bulkV2` | DLT-approved **template + variables** via Send SMS API |
| Variable handling | Not used | Template variables named as `{#var#}` → `{#Name#}` |
| DLT compliance | Managed by provider | Managed by customer (must register templates/headers) |
| IP whitelisting | Not required by default | Optional — up to 5 IPs per token |
| Multiple tokens | No concept | Up to 5 active tokens per account |
| Rate limiting | Per API plan | Per hourly SMS limit of opted plan + available balance |
| Message types | TXN, OTP, Promotional | TXN (transactional), SE (service explicit), SI (service implicit), PML (promotional) |
| Response | `{ returned: true, ... }` | `{ Error: null, Message_Id: "..." }` |

---

## 3. Project Changes

### Files to Create

| File | Purpose |
|---|---|
| `backend/src/modules/auth/sms-bsnl-brps.service.ts` | BRPS SMS implementation |
| `backend/src/modules/auth/brps-token.service.ts` | JWT token management (create, refresh, status) |

### Files to Modify

| File | Change |
|---|---|
| `backend/src/modules/auth/sms.service.ts` | Add `brps` case in `sendOtp()` switch; delegate to BRPS |
| `backend/src/config/configuration.ts` | Add BRPS-specific config vars |
| `backend/.env.example` | Add BRPS env var documentation |

---

## 4. Step-by-Step Implementation

### Step 1 — Environment Variables

Add these to `backend/.env` and `backend/.env.example`:

```env
# SMS Gateway
SMS_PROVIDER=brps   # switch from 'fast2sms' to 'brps'

# BRPS credentials (from bulksms.bsnl.in onboarding)
BRPS_SERVICE_ID=XXXXX
BRPS_USERNAME=your_username
BRPS_PASSWORD=your_password
BRPS_ENTITY_ID=1XXXXXXXXX       # Principal Entity ID from DLT portal
BRPS_HEADER=ANNAMAI             # Registered sender name (max 6 chars)
BRPS_TEMPLATE_ID=XXXXXXXX       # DLT-approved template ID for OTP

# Optional: BRPS API base URL (defaults to production)
BRPS_BASE_URL=https://bulksms.bsnl.in:5010

# Optional: Token management
BRPS_TOKEN_ID=1    # 1-5 (determines which slot to use for token)
# BRPS_IP_WHITELIST=   # comma-separated IPs, or leave empty for no restriction
```

### Step 2 — BRPS Token Service (`brps-token.service.ts`)

BRPS requires a **JWT token** before any SMS operation. Tokens last 1 year. The service should:

1. **Create token** on startup or when missing
2. **Check validity** before each SMS — refresh if expired
3. **Store token** in memory or Redis with expiry tracking

```typescript
// Key endpoints:
// POST /api/Create_New_API_Token   → create/refresh token
// POST /api/Get_Token_Status       → check if token is still valid
```

```typescript
// Request body for token creation:
{
  "Service_Id": "XXXXX",
  "Username": "your_username",
  "Password": "your_password",
  "Token_Id": "1",              // 1-5
  "IP_Addresses": null          // or ["1.2.3.4"] for IP restriction
}

// Response (JWT):
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 3 — BRPS SMS Service (`sms-bsnl-brps.service.ts`)

The main OTP sending method. BRPS uses **template-based sending** — you send variable values and the API constructs the message from the DLT-registered template.

```typescript
// OTP message template registered on DLT (example):
// "Annam AI: Your OTP is {#OTP#}. Valid for 1 minute. Do not share this code."

// Send SMS endpoint: POST /api/Send_SMS
// Request body:
{
  "Header": "ANNAMAI",
  "Target": "9876543210",
  "Is_Unicode": "0",
  "Is_Flash": "0",
  "Message_Type": "TXN",
  "Entity_Id": "1XXXXXXXXX",
  "Content_Template_Id": "XXXXXXXX",
  "Consent_Template_Id": "",
  "Template_Keys_and_Values": [
    { "Key": "OTP", "Value": "123456" }
  ]
}

// Response:
{
  "Error": null,
  "Message_Id": "XXXXXXXXXXXX"
}
```

> **Note on DLT Templates:** Before sending, the OTP template must be registered and approved on the BSNL DLT portal (`https://www.ucc-bsnl.co.in/`). Variables in the DLT template use `{#var#}` format — these must be **named** in BRPS (e.g., `{#OTP#}`) via the `Name_Content_Template_Variables` API before first use.

### Step 4 — Integrate into `sms.service.ts`

Add the `brps` case to the existing provider switch:

```typescript
case 'brps':
  await this.sendViaBrps(mobileNumber, otp);
  break;
```

```typescript
private async sendViaBrps(mobileNumber: string, otp: string): Promise<void> {
  const brpsToken = await this.brpsTokenService.getValidToken();
  const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');
  const header = this.configService.get<string>('sms.header') ?? 'ANNAMAI';
  const entityId = this.configService.get<string>('sms.entityId');
  const templateId = this.configService.get<string>('sms.templateId');
  const baseUrl = this.configService.get<string>('sms.baseUrl') ?? 'https://bulksms.bsnl.in:5010';

  try {
    const response = await axios.post(
      `${baseUrl}/api/Send_SMS`,
      {
        Header: header,
        Target: cleanNumber,
        Is_Unicode: '0',
        Is_Flash: '0',
        Message_Type: 'TXN',
        Entity_Id: entityId,
        Content_Template_Id: templateId,
        Consent_Template_Id: '',
        Template_Keys_and_Values: [{ Key: 'OTP', Value: otp }],
      },
      {
        headers: {
          Authorization: `Bearer ${brpsToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    );

    if (response.data?.Error) {
      throw new Error(`BRPS error: ${response.data.Error}`);
    }

    this.logger.log(`[BRPS] OTP sent to ${cleanNumber}, Message_Id: ${response.data?.Message_Id}`);
  } catch (err) {
    // See DLT error codes in Section 9 of BRPS API manual
    this.logger.error(`[BRPS] Failed to send OTP to ${cleanNumber}: ${err.message}`);
    throw err;
  }
}
```

### Step 5 — Token Management (`brps-token.service.ts`)

```typescript
@Injectable()
export class BrpsTokenService {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  async getValidToken(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }
    await this.refreshToken();
    return this.token!;
  }

  async refreshToken(): Promise<void> {
    const baseUrl = this.configService.get<string>('sms.baseUrl') ?? 'https://bulksms.bsnl.in:5010';
    const serviceId = this.configService.get<string>('sms.serviceId');
    const username = this.configService.get<string>('sms.username');
    const password = this.configService.get<string>('sms.password');
    const tokenId = this.configService.get<string>('sms.tokenId') ?? '1';
    const ipAddresses = this.configService.get<string>('sms.ipWhitelist') ?? null;

    const body: Record<string, unknown> = {
      Service_Id: serviceId,
      Username: username,
      Password: password,
      Token_Id: tokenId,
    };

    if (ipAddresses) {
      body.IP_Addresses = ipAddresses.split(',').map(ip => ip.trim());
    } else {
      body.IP_Addresses = null;
    }

    const response = await axios.post(`${baseUrl}/api/Create_New_API_Token`, body, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    this.token = response.data; // JWT string directly in response body
    // Token valid for 1 year — set expiry well before to be safe
    this.tokenExpiry = new Date(Date.now() + 364 * 24 * 60 * 60 * 1000); // 364 days
  }
}
```

---

## 5. Configuration

### `configuration.ts` — Add BRPS config block

```typescript
export const brpsConfig = registerAs("brps", () => ({
  baseUrl: process.env.BRPS_BASE_URL || 'https://bulksms.bsnl.in:5010',
  serviceId: process.env.BRPS_SERVICE_ID || '',
  username: process.env.BRPS_USERNAME || '',
  password: process.env.BRPS_PASSWORD || '',
  entityId: process.env.BRPS_ENTITY_ID || '',
  header: process.env.BRPS_HEADER || 'ANNAMAI',
  templateId: process.env.BRPS_TEMPLATE_ID || '',
  tokenId: process.env.BRPS_TOKEN_ID || '1',
  ipWhitelist: process.env.BRPS_IP_WHITELIST || '',
}));
```

> **Note:** The existing `smsConfig` already has a `provider` field. The `brps` config values should be merged into the SMS config namespace or kept separate and accessed directly in the BRPS service via `ConfigService`.

### `smsConfig` update

The existing `smsConfig` should be extended to include BRPS fields:

```typescript
export const smsConfig = registerAs("sms", () => ({
  provider: process.env.SMS_PROVIDER || "mock",
  // Fast2SMS (kept for fallback)
  apiKey: process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || "",
  senderId: process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || "AGRIAPP",
  route: process.env.FAST2SMS_ROUTE || "otp",
  // BRPS (new)
  baseUrl: process.env.BRPS_BASE_URL || 'https://bulksms.bsnl.in:5010',
  serviceId: process.env.BRPS_SERVICE_ID || '',
  username: process.env.BRPS_USERNAME || '',
  password: process.env.BRPS_PASSWORD || '',
  entityId: process.env.BRPS_ENTITY_ID || '',
  templateId: process.env.BRPS_TEMPLATE_ID || '',
  tokenId: process.env.BRPS_TOKEN_ID || '1',
  ipWhitelist: process.env.BRPS_IP_WHITELIST || '',
  // Shared
  apiSecret: process.env.SMS_API_SECRET || "",
}));
```

---

## 6. DLT Registration Requirements

BSNL BRPS requires compliance with **TCCCPR 2018** regulations. Before the service can send SMS:

### 6.1 Principal Entity Registration
1. Register at https://www.ucc-bsnl.co.in/ as a Principal Entity
2. Obtain the **Entity_ID** (used in all API calls)

### 6.2 Header (Sender Name) Registration
- Headers must be registered and approved in the DLT portal
- Max 6 characters (e.g., `ANNAMAI`)
- Used as `Header` in BRPS API calls

### 6.3 Content Template Registration
- Templates must be registered with the DLT portal
- Template variables use `{#var#}` format in DLT
- After registration, you must **name the variables** in BRPS via:
  ```
  POST /api/Name_Content_Template_Variables
  Body: {
    "Template_ID": "...",
    "Entity_ID": "...",
    "Template_Message_Named": "Dear {#Customer Name#}, Your OTP is {#OTP#}"
  }
  ```

### 6.4 OTP Template Example (for registration)

```
Dear Farmer, Your OTP for Annam AI verification is {#OTP#}.
This code is valid for 1 minute. Do not share it with anyone.
```

Variables: `{#OTP#}` → named as `OTP`

---

## 7. Testing

### 7.1 Token Creation
```bash
curl -X POST https://bulksms.bsnl.in:5010/api/Create_New_API_Token \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "Service_Id": "XXXXX",
    "Username": "your_username",
    "Password": "your_password",
    "Token_Id": "1",
    "IP_Addresses": null
  }'
```

### 7.2 Get Token Status
```bash
curl -X POST https://bulksms.bsnl.in:5010/api/Get_Token_Status \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"Token_Id": "1"}'
```

### 7.3 Get Content Template Details
```bash
curl -X POST https://bulksms.bsnl.in:5010/api/Get_Content_Template_Details \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"Content_Template_Id": "XXXXXXXX", "Content_Template_Name": ""}'
```

### 7.4 Send Test OTP
```bash
curl -X POST https://bulksms.bsnl.in:5010/api/Send_SMS \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "Header": "ANNAMAI",
    "Target": "9876543210",
    "Is_Unicode": "0",
    "Is_Flash": "0",
    "Message_Type": "TXN",
    "Entity_Id": "1XXXXXXXXX",
    "Content_Template_Id": "XXXXXXXX",
    "Consent_Template_Id": "",
    "Template_Keys_and_Values": [{"Key": "OTP", "Value": "123456"}]
  }'
```

### 7.5 Check Message Status
```bash
curl -X POST https://bulksms.bsnl.in:5010/api/Message_Status_Report \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"Message_id": "XXXXXXXXXXXX"}'
```

---

## 8. Rollback Plan

If BRPS is unavailable or misconfigured, switch back by setting:

```env
SMS_PROVIDER=fast2sms   # or 'mock' for dev
```

No code changes required — the existing Fast2SMS and mock providers are already implemented and the provider is resolved at runtime via `SMS_PROVIDER` env var.

---

## Appendix: DLT Error Codes Reference

| Code | Status | Description |
|---|---|---|
| 0 | SUCCESS | No error |
| 600 | ENTITY_NOT_FOUND | No record found with EID |
| 601 | ENTITY_NOT_REGISTERED | Entity not on platform |
| 602 | ENTITY_INACTIVE | Entity is inactive |
| 603 | ENTITY_BLACKLISTED | Entity blacklisted |
| 620 | HEADER_NOT_FOUND | Header not registered |
| 621 | HEADER_INACTIVE | Header is inactive |
| 623 | PEID_NOT_MATCHED_WITH_HEADER | PE ID doesn't match header |
| 630 | TEMPLATE_NOT_FOUND | Template not registered |
| 631 | TEMPLATE_INACTIVE | Template is inactive |
| 633 | TEMPLATE_NOT_MATCHED | Template content mismatch |
| 635 | TEMPLATE_VARIABLE_EXCEEDED_MAX_LENGTH | Variable value too long |
| 650 | PREFERENCE_NOT_MATCHED | Number blocked in preferences |
| 660 | CONSENT_FAILED | Consent not obtained |
| 670 | SCRUBBING_FAILED | General DLT scrubbing error |
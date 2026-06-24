# Task: Integrate Razorpay Payouts (Admin → User Disbursement)

## Branch
`feat/integrate-razorpay-payouts`

---

## Overview

This task integrates **Razorpay Payouts** as the disbursement engine for withdrawal requests. When an admin approves a withdrawal on the web admin panel, the platform pushes money to the user's UPI ID or bank account via Razorpay.

This is a **disbursement** integration (admin → user), NOT a collection/collection integration (user → admin). It serves as the **default payout provider**, replacing PineLabs logic for withdrawal execution, while keeping all PineLabs code intact for future use.

**Razorpay mode:** `payouts` (push payments), NOT Standard Checkout.

---

## Context: How Withdrawal Works Today

```
User wallet page
    └── User clicks "Withdraw Money"
            → WithdrawalRequest created (status: PENDING)
            → Transaction created (status: PENDING)

Admin withdrawls page (/wallets/withdrawals)
    └── Admin clicks "Approve"
            → Backend calls payment provider API
            → Provider pushes money to user's UPI/bank
            → DB updated: COMPLETED or FAILED
```

Today, this is handled by PineLabs. This task adds Razorpay as the default provider.

---

## User Flow

### 1. Admin Approves a Withdrawal

**Trigger:** Admin clicks "Approve" on a pending withdrawal request in the admin panel (`/wallets/withdrawals`).

**Step 1.1 — Fetch User Payment Details (Backend)**
- Load `UserPaymentDetail` for the requesting user
- Validate that payment details exist and are verified

**Step 1.2 — Initiate Razorpay Payout (Backend)**
- Backend calls Razorpay Payouts API to push money to the user's UPI/bank account
- Returns a `payout_id` and `status`
- Uses `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (server-side only)

**Step 1.3 — Handle Payout Response (Backend)**
- On `SUCCESS`: mark WithdrawalRequest as `COMPLETED`, set `razorpay_payout_id`
- On `FAILED`: mark WithdrawalRequest as `FAILED`, store error from Razorpay
- On `PROCESSING`: keep as `PROCESSING` — Razorpay is async, webhook will confirm final status

**Step 1.4 — Webhook (Optional, for async confirmation)**
- Razorpay can call a webhook on payout status change
- Endpoint: `POST /api/v1/razorpay/webhook`
- Recommended but not required for basic flow

---

## Implementation Steps

### Step 1 — Environment Setup

**File: `backend/.env`** (already has RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

```env
RAZORPAY_KEY_ID=rzp_test_T5L7ZaENPys403
RAZORPAY_KEY_SECRET=hZfeFe…wYnf
RAZORPAY_ENV=sandbox           # 'sandbox' for test, 'production' for live
```

> The Razorpay Payouts sandbox requires a funded test balance. Create a Razorpay dashboard account at https://dashboard.razorpay.com/app/keys and use the test keys above. Fund a test balance to send payouts.

---

### Step 2 — Razorpay Payouts API — Quick Reference

**Endpoint:** `POST https://api.razorpay.com/v1/payouts`

**Key payload fields:**

```json
{
  "account_number": "RAZORPAY_ACCOUNT_NUMBER",
  "amount": 10000,
  "currency": "INR",
  "mode": "UPI",
  "purpose": "refund",
  "fund_account": {
    "account_type": "vpa",
    "vpa": { "address": "user@upi" }
  },
  "reference_id": "withdrawal_req_abc123",
  "narration": "Withdrawal payout"
}
```

**`mode` options:** `UPI`, `IMPS`, `NEFT`, `RTGS`, `BANK_TRANSFER`

**`account_type` options:** `vpa` (for UPI), `bank_account` (for IMPS/NEFT/RTGS)

**Payout statuses:** `pending` → `processing` → `success` / `failed` / `rejected`

> Full docs: https://razorpay.com/docs/payouts/

---

### Step 3 — Backend: Update Payment Config

**File: `src/config/payment.config.ts`**

The `razorpay` block was added in Step 1 of the previous task attempt. Verify it contains:

```typescript
razorpay: {
  env: process.env.RAZORPAY_ENV ?? 'sandbox',
  keyId: process.env.RAZORPAY_KEY_ID ?? '',
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
},
```

---

### Step 4 — Backend: Fund Account (Create if not exists)

Before sending a payout, Razorpay requires a "fund account" linked to the recipient (user's UPI or bank). This only needs to be created once per user.

**File: `src/payment/razorpay-payout.service.ts`**

```typescript
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface FundAccountVPA {
  account_type: 'vpa';
  vpa: { address: string };
}

interface FundAccountBank {
  account_type: 'bank_account';
  bank_account: {
    account_number: string;
    ifsc: string;
    name: string;
  };
}

type FundAccount = FundAccountVPA | FundAccountBank;

interface CreateFundAccountResult {
  fundAccountId: string;
  active: boolean;
}

interface InitiatePayoutResult {
  payoutId: string;
  status: 'pending' | 'processing';
}

@Injectable()
export class RazorpayPayoutService {
  private readonly logger = new Logger(RazorpayPayoutService.name);
  private readonly baseUrl: string;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly accountNumber: string; // Your Razorpay account number

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('payment.razorpay.env') ?? 'sandbox';
    this.baseUrl = env === 'production'
      ? 'https://api.razorpay.com/v1'
      : 'https://api.razorpay.com/v1';
    this.keyId = this.configService.get<string>('payment.razorpay.keyId') ?? '';
    this.keySecret = this.configService.get<string>('payment.razorpay.keySecret') ?? '';
    // Your Razorpay Business Account number (found in Dashboard → Settings → API Keys)
    this.accountNumber = this.configService.get<string>('payment.razorpay.accountNumber') ?? '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  /**
   * Create or retrieve a Razorpay Fund Account for a user.
   * Once created, the same fund_account_id can be reused for future payouts.
   *
   * @param userId  Used as idempotency key to avoid duplicate fund accounts
   * @param vpa     UPI ID string (e.g. "user@upi")
   */
  async createFundAccount(params: {
    userId: string;
    vpa?: string;
    bankAccount?: {
      accountNumber: string;
      ifsc: string;
      accountHolderName: string;
    };
  }): Promise<CreateFundAccountResult> {
    const { userId, vpa, bankAccount } = params;

    const fundAccountPayload: FundAccount =
      vpa
        ? { account_type: 'vpa', vpa: { address: vpa } }
        : {
            account_type: 'bank_account',
            bank_account: {
              account_number: bankAccount!.accountNumber,
              ifsc: bankAccount!.ifsc,
              name: bankAccount!.accountHolderName,
            },
          };

    try {
      const response = await axios.post(
        `${this.baseUrl}/fund_accounts`,
        {
          ...fundAccountPayload,
          customer_id: userId,  // used as idempotency key
        },
        {
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        fundAccountId: response.data.id,
        active: response.data.active,
      };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to create fund account';
      this.logger.error(`[Razorpay] createFundAccount failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Initiate a payout to a fund account.
   *
   * @param params
   * @param params.fundAccountId  Razorpay fund_account ID
   * @param params.amount         Amount in paise
   * @param params.referenceId    Your internal reference (e.g. withdrawal request ID)
   * @param params.mode           Payment mode: UPI, IMPS, NEFT, RTGS
   * @param params.narration      Shown on user's bank statement
   */
  async initiatePayout(params: {
    fundAccountId: string;
    amount: number;
    referenceId: string;
    mode?: 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'BANK_TRANSFER';
    narration?: string;
  }): Promise<InitiatePayoutResult> {
    const {
      fundAccountId,
      amount,
      referenceId,
      mode = 'UPI',
      narration = 'Withdrawal payout',
    } = params;

    this.logger.log(
      `[Razorpay] Initiating payout: fundAccount=${fundAccountId} amount=${amount} mode=${mode} ref=${referenceId}`,
    );

    try {
      const response = await axios.post(
        `${this.baseUrl}/payouts`,
        {
          account_number: this.accountNumber,
          fund_account_id: fundAccountId,
          amount,
          currency: 'INR',
          mode,
          purpose: 'refund',
          reference_id: referenceId,
          narration,
        },
        {
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `[Razorpay] Payout created: id=${response.data.id} status=${response.data.status}`,
      );

      return {
        payoutId: response.data.id,
        status: response.data.status,
      };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to initiate payout';
      this.logger.error(`[Razorpay] initiatePayout failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Check the current status of an existing payout.
   * Use this to poll after initiating a payout, or to verify before acting on a webhook.
   */
  async getPayoutStatus(payoutId: string): Promise<string> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payouts/${payoutId}`,
        {
          headers: { Authorization: this.authHeader() },
        },
      );
      return response.data.status;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to fetch payout status';
      this.logger.error(`[Razorpay] getPayoutStatus failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }
}
```

---

### Step 5 — Backend: Withdrawals Approval Uses Razorpay

When the admin approves a withdrawal, the flow must use `RazorpayPayoutService` instead of `PinelabsService`.

**File: `src/wallets/wallets.service.ts`** (or wherever `approve` logic lives)

The exact location depends on where the admin approve endpoint is. Likely in:
- `src/admin/admin.controller.ts` or
- `src/wallets/wallets.controller.ts`

The approve handler should:

```typescript
async approveWithdrawal(withdrawalId: string, adminId: string) {
  const withdrawal = await this.withdrawalRepo.findOne({
    where: { id: withdrawalId },
    relations: ['user', 'user.paymentDetails'],
  });

  // Get user's payment details
  const paymentDetail = await this.paymentDetailRepo.findOne({
    where: { userId: withdrawal.userId },
    order: { createdAt: 'DESC' },
  });

  if (!paymentDetail) throw new BadRequestException('No payment details found for user');

  // ── Step 1: Create fund account in Razorpay ─────────────────────────
  let fundAccountId = paymentDetail.razorpayFundAccountId;

  if (!fundAccountId) {
    const fundAccount = await this.razorpayPayoutService.createFundAccount({
      userId: withdrawal.userId,
      vpa: paymentDetail.upiId ?? undefined,
      bankAccount: paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
        ? {
            accountNumber: this.decrypt(paymentDetail.accountNumberEncrypted),
            ifsc: paymentDetail.ifsc,
            accountHolderName: paymentDetail.accountHolderName ?? '',
          }
        : undefined,
    });

    fundAccountId = fundAccount.fundAccountId;

    // Persist for future use
    await this.paymentDetailRepo.update(paymentDetail.id, {
      razorpayFundAccountId: fundAccountId,
    });
  }

  // ── Step 2: Initiate payout ─────────────────────────────────────────
  const payout = await this.razorpayPayoutService.initiatePayout({
    fundAccountId,
    amount: Math.round(withdrawal.amount * 100), // convert rupees → paise
    referenceId: `wd_${withdrawal.id}`,
    mode: paymentDetail.payoutMethod === PayoutMethod.UPI ? 'UPI' : 'IMPS',
    narration: 'Withdrawal payout',
  });

  // ── Step 3: Update withdrawal record ────────────────────────────────
  await this.withdrawalRepo.update(withdrawalId, {
    status: payout.status === 'pending' || payout.status === 'processing'
      ? WithdrawalStatus.PROCESSING
      : payout.status === 'success'
      ? WithdrawalStatus.COMPLETED
      : WithdrawalStatus.FAILED,
    razorpayPayoutId: payout.payoutId,
    processedAt: payout.status === 'success' ? new Date() : null,
  });

  // ── Step 4: Log payment attempt ─────────────────────────────────────
  const log = this.paymentLogRepo.create({
    withdrawalRequestId: withdrawalId,
    adminId,
    orderId: payout.payoutId,
    razorpayPayoutId: payout.payoutId,
    status: payout.status === 'success' ? PaymentLogStatus.SUCCESS : PaymentLogStatus.PENDING,
    rawResponse: { payout },
  });
  await this.paymentLogRepo.save(log);
}
```

---

### Step 6 — Backend: Webhook for Async Payout Confirmation

Razorpay payouts are asynchronous. A webhook confirms the final status.

**File: `src/payment/razorpay-webhook.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WithdrawalRequest, PaymentLog } from '../database/entities';
import { WithdrawalStatus, PaymentLogStatus } from '../common/enums';
import { RazorpayPayoutService } from './razorpay-payout.service';

@Controller('api/v1/razorpay/webhook')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly razorpayPayoutService: RazorpayPayoutService,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: Record<string, unknown>) {
    const event = String(body.event ?? '');

    if (event !== 'payout.money_transfer_success') {
      return { received: true };
    }

    const payload = body.payload?.payout as {
      entity?: { id?: string; status?: string; reference_id?: string };
    };
    const payoutId = payload?.entity?.id ?? '';
    const status = payload?.entity?.status ?? '';
    const referenceId = payload?.entity?.reference_id ?? '';

    this.logger.log(`[Razorpay Webhook] payoutId=${payoutId} status=${status} ref=${referenceId}`);

    if (!referenceId) {
      return { received: true };
    }

    // Parse withdrawal ID from reference_id (format: wd_<withdrawalId>)
    const withdrawalId = referenceId.replace('wd_', '');

    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) {
      this.logger.warn(`[Webhook] Withdrawal not found: ${withdrawalId}`);
      return { received: true };
    }

    const finalStatus =
      status === 'processed' || status === 'completed' ? WithdrawalStatus.COMPLETED
      : status === 'failed' || status === 'rejected' ? WithdrawalStatus.FAILED
      : withdrawal.status;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt: finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
    });

    const log = this.paymentLogRepo.create({
      withdrawalRequestId: withdrawalId,
      orderId: payoutId,
      razorpayPayoutId: payoutId,
      status: finalStatus === WithdrawalStatus.COMPLETED ? PaymentLogStatus.SUCCESS : PaymentLogStatus.FAILED,
      rawResponse: body,
    });
    await this.paymentLogRepo.save(log);

    return { received: true };
  }
}
```

Register in `PaymentModule`:

```typescript
controllers: [
  PaymentWebhookController,        // existing PineLabs webhook
  RazorpayWebhookController,       // new Razorpay webhook
],
providers: [PinelabsService, RazorpayPayoutService],
```

---

### Step 7 — Payment Module Update

**File: `src/payment/payment.module.ts`**

Add `RazorpayPayoutService` and `RazorpayWebhookController`:

```typescript
import { RazorpayPayoutService } from './razorpay-payout.service';
import { RazorpayWebhookController } from './razorpay-webhook.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([...])],
  controllers: [
    PaymentWebhookController,
    RazorpayWebhookController,
  ],
  providers: [
    PinelabsService,
    RazorpayPayoutService,   // ← add
  ],
  exports: [PinelabsService, RazorpayPayoutService],
})
export class PaymentModule {}
```

Also ensure `RazorpayPayoutService` is exported so `WalletsModule` or `AdminModule` can inject it.

---

### Step 8 — Add `razorpayFundAccountId` to Payment Detail Entity

**File: `src/database/entities/user-payment-detail.entity.ts`**

```typescript
/** Razorpay fund_account ID — created once per user, reused for all future payouts */
@Column({ name: 'razorpay_fund_account_id', type: 'varchar', length: 100, nullable: true })
razorpayFundAccountId: string | null;

/** Razorpay payout ID for the most recent payout */
@Column({ name: 'razorpay_payout_id', type: 'varchar', length: 100, nullable: true })
razorpayPayoutId: string | null;
```

---

### Step 9 — Backend: New Env Var

**File: `backend/.env`** — add:

```env
# Your Razorpay Business Account number (found in Dashboard → Settings → API Keys)
# This is NOT the key_id — it's your account identifier like "789123456789012"
RAZORPAY_ACCOUNT_NUMBER=your_razorpay_account_number
```

**File: `backend/.env.example`** — add:

```env
RAZORPAY_ACCOUNT_NUMBER=<YOUR_RAZORPAY_ACCOUNT_NUMBER>
```

Also update `src/config/payment.config.ts`:

```typescript
razorpay: {
  env: process.env.RAZORPAY_ENV ?? 'sandbox',
  keyId: process.env.RAZORPAY_KEY_ID ?? '',
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  accountNumber: process.env.RAZORPAY_ACCOUNT_NUMBER ?? '',  // ← add
},
```

---

## Data Flow Summary

```
Admin clicks "Approve"
    │
    ├─► WalletsService / AdminService
    │       │
    │       ├─► RazorpayPayoutService.createFundAccount(userId, upiId)
    │       │       └─► POST /fund_accounts → razorpay_fund_account_id
    │       │
    │       ├─► RazorpayPayoutService.initiatePayout(fundAccountId, amount)
    │       │       └─► POST /payouts → payout_id, status=pending
    │       │
    │       ├─► DB: WithdrawalRequest updated (PROCESSING / COMPLETED)
    │       └─► DB: PaymentLog created
    │
    └─► (Later) Razorpay webhook → final status confirmed
            └─► DB: WithdrawalRequest FINAL status set
```

---

## File Structure

```
src/
  payment/
    razorpay-payout.service.ts       # Fund account + payout logic
    razorpay-webhook.controller.ts   # Webhook for async confirmation
    razorpay.controller.ts           # [keep from prev task — remove if not needed]
    razorpay.service.ts              # [keep from prev task — remove if not needed]
    payment-webhook.controller.ts    # [existing — PineLabs, keep]
    payment.module.ts                # add new controller + service

  wallets/
    wallets.service.ts               # approval logic → use RazorpayPayoutService

  database/entities/
    user-payment-detail.entity.ts    # + razorpayFundAccountId, razorpayPayoutId
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| No payment details for user | Return `400` — "No payment details found for user" |
| Fund account creation fails | Return `500` — log error, do not mark withdrawal as processed |
| Payout initiation fails | Return `500` — log error, withdrawal stays `PENDING` |
| Payout `failed` / `rejected` | Mark withdrawal `FAILED` — admin must manually review |
| Payout async (status=pending) | Mark `PROCESSING` — webhook will update later |
| Webhook signature invalid | Log and ignore |
| Amount mismatch (Razorpay vs DB) | Log warning, mark FAILED — investigate |

---

## Testing Checklist

- [ ] `RAZORPAY_ACCOUNT_NUMBER` set in `.env`
- [ ] `POST /fund_accounts` creates a fund account for a test UPI
- [ ] `POST /payouts` successfully pushes money to test UPI
- [ ] Withdrawal status updates to `PROCESSING` after payout initiated
- [ ] Withdrawal status updates to `COMPLETED` when payout succeeds
- [ ] Payout fails gracefully when UPI is invalid (no crash, DB stays consistent)
- [ ] Webhook correctly updates withdrawal to `COMPLETED` / `FAILED`
- [ ] `RAZORPAY_KEY_SECRET` not present in any frontend bundle
- [ ] PineLabs code paths remain untouched

---

## How to Test (Sandbox)

1. Create a Razorpay dashboard account: https://dashboard.razorpay.com
2. Go to **Settings → API Keys** → copy test `key_id` and `key_secret`
3. Go to **Settings → Account Number** — note your test account number
4. **Fund your test balance:** Dashboard → Funding → add test money
5. Start the backend with `.env` pointing to test credentials
6. Create a test user with a UPI ID (e.g. `success@razorpay`)
7. Submit a withdrawal request as that user
8. As admin, approve the withdrawal — check Razorpay dashboard for payout status

**Razorpay test UPI handles for sandbox:**
- `success@razorpay` — always succeeds
- `failure@razorpay` — always fails
- `twosteps@razorpay` — requires additional verification

---

## Notes

- **PineLabs code stays intact** — this task only adds Razorpay as an alternative. A config flag can switch between providers in the future.
- **Fund account is reusable** — once created per user, reuse `fund_account_id` for all future payouts. Store it on `UserPaymentDetail`.
- **Razorpay payouts are async** — always expect a `PROCESSING` state immediately after initiation. The webhook or polling confirms the final status.
- **`RAZORPAY_ACCOUNT_NUMBER`** is your business account identifier, not an API key. Found in Dashboard → Settings → Account & Settings → API Keys tab.
- **Minimum payout amount:** ₹1 (100 paise) for UPI, higher for other modes.
- Razorpay webhook docs: https://razorpay.com/docs/payouts/payout-workflows/webhooks/

---

## Status

- [ ] Not started
- [x] In progress (task spec updated)
- [ ] Ready for review
- [ ] Merged
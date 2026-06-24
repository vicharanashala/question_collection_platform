# Task: Integrate Razorpay Standard Web Checkout

## Branch
`feat/integrate-razorpay-checkout`

---

## Overview

Integrate Razorpay Standard Web Checkout into the existing codebase to process payments via a hosted modal. Covers backend order creation, frontend checkout flow, and server-side signature verification.

---

## User Flow

### 1. Payment Initiation

**Trigger:** User clicks a "Pay Now" button on the frontend.

**Step 1.1 — Create Order (Backend)**
- Frontend calls `POST /api/create-order` with the amount
- Backend validates amount (minimum ₹1 / 100 paise)
- Backend calls Razorpay API to create an order
- Returns `{ order_id, amount, currency }` to frontend

**Step 1.2 — Open Razorpay Modal (Frontend)**
- Frontend receives `order_id` and opens Razorpay checkout modal
- User completes payment inside the modal (card / UPI / netbanking / wallet)
- On success: Razorpay returns `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`
- On failure / dismiss: show appropriate error message to user

**Step 1.3 — Verify Payment (Backend)**
- Frontend sends all three values to `POST /api/verify-payment`
- Backend computes HMAC-SHA256 signature and compares
- On match: mark payment as successful, return `200`
- On mismatch: return `400`, do NOT mark as paid

---

## Implementation Steps

### Step 1 — Install Dependencies

```bash
npm install razorpay
```

Add `.env` to `.gitignore` if not already present:

```bash
echo ".env" >> .gitignore
```

---

### Step 2 — Environment Setup

**File: `.env`**

```env
# Razorpay credentials — NEVER commit this file
RAZORPAY_KEY_ID=rzp_test_T5L7ZaENPys403
RAZORPAY_KEY_SECRET=hZfeFeBrhdPi7wRK5B4xwYnf

# Frontend-exposed key (pick one based on your framework)
# Next.js:
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_T5L7ZaENPys403
# Vite:
# VITE_RAZORPAY_KEY_ID=rzp_test_T5L7ZaENPys403
# CRA:
# REACT_APP_RAZORPAY_KEY_ID=rzp_test_T5L7ZaENPys403
```

> ⚠️ `RAZORPAY_KEY_SECRET` must **never** be exposed to the frontend. Only `KEY_ID` gets a public prefix.

---

### Step 3 — Backend: Create Order

**File: `src/controllers/razorpayController.ts`**

```typescript
import Razorpay from 'razorpay';
import { Request, Response } from 'express';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// POST /api/create-order
export async function createOrder(req: Request, res: Response) {
  const { amount, currency = 'INR', receipt } = req.body;

  if (!amount || typeof amount !== 'number' || amount < 100) {
    return res.status(400).json({
      error: 'Invalid amount. Minimum is 100 paise (₹1).',
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount,           // in paise
      currency,
      receipt: receipt ?? `receipt_${Date.now()}`,
    });

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err: any) {
    if (err?.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed.' });
    }
    console.error('[Razorpay] Create order error:', err);
    return res.status(500).json({ error: 'Failed to create Razorpay order.' });
  }
}

// POST /api/verify-payment
export async function verifyPayment(req: Request, res: Response) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required payment fields.' });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  // Signature matched — safe to mark payment as successful in your DB here

  return res.status(200).json({
    success: true,
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
  });
}
```

---

### Step 4 — Backend: Routes

**File: `src/routes/razorpayRoutes.ts`**

```typescript
import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/razorpayController';

const router = Router();

router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);

export default router;
```

**Register in your main app file (`src/app.ts` or `src/index.ts`):**

```typescript
import razorpayRoutes from './routes/razorpayRoutes';

app.use('/api', razorpayRoutes);
```

---

### Step 5 — Frontend: Checkout Button

**File: `src/components/RazorpayCheckout.tsx`**

```tsx
import { useEffect } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutProps {
  amount: number;        // in paise
  description?: string;
  onSuccess?: (data: { payment_id: string; order_id: string }) => void;
  onFailure?: (error: string) => void;
}

export function RazorpayCheckout({
  amount,
  description = 'Payment',
  onSuccess,
  onFailure,
}: RazorpayCheckoutProps) {
  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePayment = async () => {
    try {
      // Step 1 — Create order
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        onFailure?.(err.error ?? 'Failed to create order.');
        return;
      }

      const { order_id, amount: orderAmount, currency } = await orderRes.json();

      // Step 2 — Open Razorpay modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // or VITE_ / REACT_APP_ variant
        amount: orderAmount,
        currency,
        name: 'Your App Name',
        description,
        order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // Step 3 — Verify payment
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });

          if (verifyRes.ok) {
            const data = await verifyRes.json();
            onSuccess?.({
              payment_id: data.payment_id,
              order_id: data.order_id,
            });
          } else {
            const err = await verifyRes.json();
            onFailure?.(err.error ?? 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            onFailure?.('Payment cancelled by user.');
          },
        },
        prefill: {
          // Optional: pre-fill user details if available
          // name: currentUser.name,
          // email: currentUser.email,
          // contact: currentUser.phone,
        },
        theme: {
          color: '#6366F1', // match your brand colour
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (response: any) => {
        onFailure?.(
          response.error?.description ?? 'Payment failed. Please try again.'
        );
      });

      rzp.open();
    } catch (err) {
      console.error('[Razorpay] Checkout error:', err);
      onFailure?.('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <button
      onClick={handlePayment}
      className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
    >
      Pay ₹{(amount / 100).toFixed(2)}
    </button>
  );
}
```

**Usage example:**

```tsx
<RazorpayCheckout
  amount={49900}  // ₹499.00 in paise
  description="Premium plan subscription"
  onSuccess={({ payment_id, order_id }) => {
    console.log('Payment successful:', payment_id, order_id);
    // redirect or update UI
  }}
  onFailure={(error) => {
    console.error('Payment failed:', error);
    // show toast/alert
  }}
/>
```

---

## File Structure

```
src/
  controllers/
    razorpayController.ts   # createOrder + verifyPayment handlers
  routes/
    razorpayRoutes.ts       # POST /api/create-order, POST /api/verify-payment
  components/
    RazorpayCheckout.tsx    # Frontend checkout button + modal logic
.env                        # Credentials (never commit)
.gitignore                  # Ensure .env is listed
```

---

## Data Models

No new database tables are required for the base integration. If you want to persist payment records, add to your existing orders/transactions table:

```sql
-- Add to your existing relevant table, e.g. orders or transactions
razorpay_order_id    VARCHAR(100) NULL
razorpay_payment_id  VARCHAR(100) NULL
payment_status       ENUM('PENDING', 'PAID', 'FAILED') DEFAULT 'PENDING'
paid_at              TIMESTAMP NULL
```

Only update `payment_status` to `PAID` **after** signature verification passes on the backend.

---

## Configuration

**File: `src/config/razorpay.ts`**

```typescript
export const razorpayConfig = {
  keyId: process.env.RAZORPAY_KEY_ID!,
  keySecret: process.env.RAZORPAY_KEY_SECRET!,
  minAmountPaise: 100,   // ₹1 minimum
  currency: 'INR',
};
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Amount < 100 paise | Return `400`, reject before calling Razorpay API |
| Razorpay auth failure | Return `401`, log error |
| Razorpay API timeout / 5xx | Return `500`, surface error to user |
| Signature mismatch on verify | Return `400`, do NOT mark payment as paid |
| Missing fields on verify | Return `400` |
| User dismisses modal | Trigger `ondismiss` callback, show cancellation message |
| `payment.failed` event | Surface Razorpay error description to user |

---

## Notifications

| Event | Channel | Message |
|---|---|---|
| Order created | — | (internal only, no user-facing message) |
| Payment successful | In-app / Email | "Payment of ₹{amount} successful. Ref: {payment_id}" |
| Payment failed | In-app | "Payment failed: {reason}. Please try again." |
| Signature mismatch | In-app | "Payment could not be verified. Please contact support." |
| User cancelled | In-app | "Payment was cancelled." |

---

## Testing Checklist

- [ ] `.env` created with both keys, added to `.gitignore`
- [ ] `POST /api/create-order` returns valid `order_id`
- [ ] Razorpay modal opens on button click
- [ ] Successful payment with Razorpay test card (`4111 1111 1111 1111`, any future expiry, any CVV)
- [ ] `POST /api/verify-payment` returns `200` on valid signature
- [ ] Signature mismatch returns `400` and does not mark as paid
- [ ] Modal dismiss triggers `ondismiss` callback
- [ ] `payment.failed` event handled and shown to user
- [ ] Amount below 100 paise rejected with `400`
- [ ] `RAZORPAY_KEY_SECRET` not present in any frontend bundle (inspect network tab / build output)
- [ ] Switch to production keys via `RAZORPAY_KEY_ID` env var — no code change required

---

## How to Test

1. Start your backend server (`npm run dev` or equivalent)
2. Ensure `.env` is loaded (e.g. via `dotenv`)
3. Open the page containing `<RazorpayCheckout />`
4. Click **Pay** — Razorpay modal should open
5. Use test card: `4111 1111 1111 1111`, expiry `12/26`, CVV `123`, OTP `1234`
6. On success, check your server logs for the verified `payment_id`

---

## Notes

- All monetary values passed to Razorpay must be in **paise** (integer); convert to rupees only for display
- `RAZORPAY_KEY_SECRET` must never appear in frontend code or be returned from any API response
- Razorpay webhook (`POST /api/webhooks/razorpay`) can be set up separately for async payment status confirmation — recommended for production
- Razorpay test credentials (`rzp_test_*`) only work in sandbox; swap to live keys (`rzp_live_*`) for production via environment variable only
- Refer to official docs for webhook setup: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

---

## Status

- [ ] Not started
- [ ] In progress
- [ ] Ready for review
- [ ] Merged
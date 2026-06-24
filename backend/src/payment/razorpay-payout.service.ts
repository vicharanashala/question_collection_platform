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

export interface CreateFundAccountResult {
  fundAccountId: string;
  contactId: string;
  active: boolean;
}

export interface CreateContactResult {
  contactId: string;
  active: boolean;
}

export interface InitiatePayoutResult {
  payoutId: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'rejected';
}

export interface CreatePaymentLinkResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
  status: string;
}

@Injectable()
export class RazorpayPayoutService {
  private readonly logger = new Logger(RazorpayPayoutService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly apiKey: string;
  private readonly secret: string;
  private readonly accountNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('payment.razorpay.apiKey') ?? '';
    this.secret = this.configService.get<string>('payment.razorpay.secret') ?? '';
    this.accountNumber = this.configService.get<string>('payment.razorpay.accountNumber') ?? '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:${this.secret}`).toString('base64')}`;
  }

  /**
   * Create or reuse a RazorpayX Contact for a user.
   * Uses userId as idempotency key so calling multiple times is safe.
   *
   * @param userId   Used as idempotency key and to look up user phone/name
   * @param phone    User's mobile number (used as contact phone)
   * @param name     User's display name
   */
  async createContact(params: {
    userId: string;
    phone: string;
    name: string;
  }): Promise<CreateContactResult> {
    const { userId, phone, name } = params;

    try {
      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        {
          name,
          contact: phone.replace(/\D/g, ''), // strip non-digits
          type: 'customer',
        },
        {
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
            'X-Goa-Idempotency-Key': `contact_${userId}`,
          },
        },
      );

      this.logger.log(
        `[Razorpay] Contact created: id=${response.data.id} active=${response.data.active}`,
      );

      return {
        contactId: response.data.id,
        active: response.data.active,
      };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string; code?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to create contact';
      this.logger.error(`[Razorpay] createContact failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Create a Razorpay Fund Account for a user.
   * Once created, the same fund_account_id can be reused for future payouts.
   * Uses userId as idempotency key to avoid duplicate fund accounts.
   *
   * @param userId  Used as idempotency key to avoid duplicate fund accounts
   * @param vpa     UPI ID string (e.g. "user@upi")
   * @param bankAccount  Bank account details (if not UPI)
   */
  async createFundAccount(params: {
    userId: string;
    phone: string;
    name: string;
    existingContactId?: string;
    vpa?: string;
    bankAccount?: {
      accountNumber: string;
      ifsc: string;
      accountHolderName: string;
    };
  }): Promise<CreateFundAccountResult> {
    const { userId, phone, name, existingContactId, vpa, bankAccount } = params;

    // Use persisted contact ID if available, otherwise create a new one (idempotent)
    let contactId = existingContactId;
    if (!contactId) {
      const contact = await this.createContact({ userId, phone, name });
      contactId = contact.contactId;
    }

    const fundAccountPayload = {
      contact_id: contactId,
      ...(vpa
        ? { account_type: 'vpa', vpa: { address: vpa } }
        : {
            account_type: 'bank_account',
            bank_account: {
              account_number: bankAccount!.accountNumber,
              ifsc: bankAccount!.ifsc,
              name: bankAccount!.accountHolderName,
            },
          }),
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/fund_accounts`,
        fundAccountPayload,
        {
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
            'X-Goa-Idempotency-Key': `fa_${userId}`,
          },
        },
      );

      this.logger.log(
        `[Razorpay] Fund account created: id=${response.data.id} active=${response.data.active}`,
      );

      return {
        fundAccountId: response.data.id,
        contactId,
        active: response.data.active,
      };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string; code?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to create fund account';
      this.logger.error(`[Razorpay] createFundAccount failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Initiate a payout to a fund account.
   *
   * @param params.fundAccountId  Razorpay fund_account ID
   * @param params.amount         Amount in paise
   * @param params.referenceId    Your internal reference (e.g. withdrawal request ID)
   * @param params.mode           Payment mode: UPI, IMPS, NEFT, RTGS, BANK_TRANSFER
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
          purpose: 'payout',
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
      const error = err as { response?: { data?: { error?: { description?: string; code?: string } } } };
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
      const response = await axios.get(`${this.baseUrl}/payouts/${payoutId}`, {
        headers: { Authorization: this.authHeader() },
      });
      return response.data.status;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to fetch payout status';
      this.logger.error(`[Razorpay] getPayoutStatus failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Fetch a Razorpay payment by ID.
   * Used to verify a SDK payment before marking a payment detail as verified.
   */
  async getRazorpayPayment(paymentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
  } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${paymentId}`, {
        headers: { Authorization: this.authHeader() },
      });
      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        method: response.data.method,
      };
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      // 404 means payment not found
      if (error?.response?.status === 404) {
        return null;
      }
      const msg = err as { response?: { data?: { error?: { description?: string } } } };
      this.logger.error(`[Razorpay] getRazorpayPayment failed: ${msg?.response?.data?.error?.description ?? err}`);
      return null;
    }
  }

  /**
   * Create a Razorpay Payment Link for ₹1 verification collection.
   * The user pays ₹1 to us via this link, confirming ownership of their UPI/bank account.
   *
   * @param params.paymentDetailId  Our internal payment detail ID (used as idempotency key)
   * @param params.description      Shown on the payment page
   * @param params.userEmail        User's email (optional — Razorpay will prompt if missing)
   * @param params.userPhone        User's phone number
   */
  async createPaymentLink(params: {
    paymentDetailId: string;
    description: string;
    userEmail?: string;
    userPhone: string;
  }): Promise<CreatePaymentLinkResult> {
    const { paymentDetailId, description, userEmail, userPhone } = params;

    this.logger.log(`[Razorpay] Creating payment link | detailId=${paymentDetailId}`);

    const payload: Record<string, unknown> = {
      amount: 100, // ₹1 in paise
      currency: 'INR',
      description,
      notify: {
        sms: true,
        email: !!userEmail,
      },
      reminder_enable: true,
      options: {
        method: {
          // Explicitly include all available payment methods so UPI shows up on the link.
          // Razorpay uses dashboard defaults if this is omitted, and UPI may not be enabled there.
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
        },
      },
      notes: {
        payment_detail_id: paymentDetailId,
        purpose: 'verification',
      },
    };

    if (userEmail) {
      (payload as Record<string, unknown>).customer = {
        name: 'User',
        email: userEmail,
        contact: userPhone,
      };
    } else {
      (payload as Record<string, unknown>).customer = {
        contact: userPhone,
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payment_links`,
        payload,
        {
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
            'X-Goa-Idempotency-Key': `pl_${paymentDetailId}`,
          },
        },
      );

      const data = response.data as {
        id?: string;
        short_url?: string;
        status?: string;
        [key: string]: unknown;
      };

      this.logger.log(
        `[Razorpay] Payment link created | id=${data.id} | url=${data.short_url} | status=${data.status}`,
      );

      return {
        paymentLinkId: String(data.id ?? ''),
        paymentLinkUrl: String(data.short_url ?? ''),
        status: String(data.status ?? ''),
      };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { description?: string; code?: string } } } };
      const message = error?.response?.data?.error?.description ?? 'Failed to create payment link';
      this.logger.error(`[Razorpay] createPaymentLink failed: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }
}
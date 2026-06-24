import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PayoutMethod } from '../common/enums';
import { decrypt } from '../common/utils/encryption.util';

export interface PayoutResult {
  success: boolean;
  pinelabsTransactionId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawResponse: Record<string, unknown>;
}

export interface CardPaymentResult {
  success: boolean;
  orderId: string | null;
  challengeUrl: string | null;
  paymentId: string | null;
  status: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawResponse: Record<string, unknown>;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  expires_at?: string; // ISO-8601 timestamp, e.g. "2026-06-20T11:29:48.778Z"
}

@Injectable()
export class PinelabsService {
  private readonly logger = new Logger(PinelabsService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly mockVerification: boolean;

  // Cached access token (PineLabs tokens are valid for 1 hour per docs)
  private accessToken: string | null = null;
  private accessTokenExpiry = 0;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('payment.pinelabs.baseUrl') ?? '';
    this.clientId = this.configService.get<string>('payment.pinelabs.clientId') ?? '';
    this.clientSecret = this.configService.get<string>('payment.pinelabs.clientSecret') ?? '';
    // Optional — only needed when webhook signature verification is enabled
    this.secretKey = this.configService.get<string>('payment.pinelabs.webhookSecret') ?? '';
    this.mockVerification = this.configService.get<boolean>('payment.pinelabs.mockVerification') ?? false;
  }

  /**
   * Generate a request ID for PineLabs API calls.
   * Per docs: every request must carry a unique Request-ID header.
   */
  private generateRequestId(): string {
    return uuidv4();
  }

  /**
   * Generate a RFC-3339 timestamp for the Request-Timestamp header.
   */
  private generateRequestTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get a valid OAuth access token, using the cached value if still valid.
   * Token endpoint: POST {baseUrl}/api/auth/v1/token
   * Body: { client_id, client_secret, grant_type: "client_credentials" }
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiry) {
      return this.accessToken;
    }

    this.logger.log('[Pinelabs] Fetching new OAuth access token');

    const response = await axios.post<TokenResponse>(
      `${this.baseUrl}/api/auth/v1/token`,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Request-ID': this.generateRequestId(),
          'Request-Timestamp': this.generateRequestTimestamp(),
        },
        timeout: 15_000,
      },
    );

    const rawResponse = response.data as unknown as Record<string, unknown>;
    this.logger.debug('[Pinelabs] OAuth raw response: ' + JSON.stringify(rawResponse));
    const data = rawResponse;
    const tokenData = (data['data'] ?? data) as unknown as TokenResponse;
    this.accessToken = tokenData.access_token;

    // Prefer expires_at (ISO timestamp) over expires_in (seconds)
    if (tokenData.expires_at) {
      this.accessTokenExpiry = new Date(tokenData.expires_at).getTime() - 5 * 60 * 1000;
    } else if (tokenData.expires_in != null) {
      this.accessTokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;
    } else {
      // No expiry info — treat as already expired to force refresh every call
      this.accessTokenExpiry = 0;
    }

    this.logger.log('[Pinelabs] OAuth token obtained, expires_at=' + (tokenData.expires_at ?? 'n/a') + ', expires_in=' + (tokenData.expires_in ?? 'n/a'));
    return this.accessToken;
  }

  /**
   * Build the common headers required for all authenticated API calls.
   * Includes OAuth Bearer token, Request-ID, Request-Timestamp, and Content-Type.
   */
  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      'Request-ID': this.generateRequestId(),
      'Request-Timestamp': this.generateRequestTimestamp(),
      'Authorization': `Bearer ${token}`,
      'accept': 'application/json',
    };
    this.logger.debug('[Pinelabs] Auth headers for payout request | Authorization=Bearer ' + (token ? token.slice(0, 20) + '...' : 'EMPTY'));
    return headers;
  }

  /**
   * Invalidate the cached access token (e.g., after a 401).
   * Forces the next call to fetch a fresh token.
   */
  private invalidateToken(): void {
    this.accessToken = null;
    this.accessTokenExpiry = 0;
  }

  // ─── Order Management ───────────────────────────────────────────────────────

  /**
   * Generate a unique order ID for withdrawal payouts.
   * Format: PL_<withdrawalId>_<uuid>
   */
  generateOrderId(withdrawalId: string): string {
    return `PL_${withdrawalId.replace(/-/g, '')}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  }

  /**
   * Generate a unique order ID for verification micro-transactions.
   * Format: VF_<paymentDetailId>_<uuid>
   * Uses VF_ prefix to clearly separate from withdrawal payouts in webhooks.
   */
  generateVerificationOrderId(paymentDetailId: string): string {
    return `VF_${paymentDetailId.replace(/-/g, '')}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  }

  /**
   * Parse order ID to identify payout type.
   * Returns: 'verification' | 'withdrawal' | 'unknown'
   */
  parseOrderIdType(orderId: string): 'verification' | 'withdrawal' | 'unknown' {
    if (orderId.startsWith('VF_')) return 'verification';
    if (orderId.startsWith('PL_')) return 'withdrawal';
    return 'unknown';
  }

  // ─── Card Tokenization Flow ─────────────────────────────────────────────────

  /**
   * Step 1 of the documented tokenization flow: Create Order.
   * POST {baseUrl}/api/pay/v1/orders
   *
   * Returns the order_id which is used in subsequent Create Payment call.
   */
  async createOrder(params: {
    merchantOrderReference: string;
    amount: number; // in paise (integer)
    currency?: string;
    customer?: {
      customerId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      mobileNumber?: string;
      countryCode?: string;
    };
    callbackUrl?: string;
    failureCallbackUrl?: string;
    notes?: string;
  }): Promise<{ orderId: string; merchantOrderReference: string; status: string; rawResponse: Record<string, unknown> }> {
    try {
      this.logger.log(`[Pinelabs] Creating order | merchantRef=${params.merchantOrderReference} | amount=${params.amount}`);

      const headers = await this.buildAuthHeaders();
      const response = await axios.post(
        `${this.baseUrl}/api/pay/v1/orders`,
        {
          merchant_order_reference: params.merchantOrderReference,
          order_amount: {
            value: params.amount,
            currency: params.currency ?? 'INR',
          },
          pre_auth: false,
          notes: params.notes,
          callback_url: params.callbackUrl,
          failure_callback_url: params.failureCallbackUrl,
          purchase_details: params.customer
            ? {
                customer: {
                  customer_id: params.customer.customerId,
                  email_id: params.customer.email,
                  first_name: params.customer.firstName,
                  last_name: params.customer.lastName,
                  mobile_number: params.customer.mobileNumber,
                  country_code: params.customer.countryCode,
                },
              }
            : undefined,
        },
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;
      const orderData = (data['data'] as Record<string, unknown>) ?? data;

      this.logger.log(`[Pinelabs] Order created | orderId=${orderData['order_id']} | status=${orderData['status']}`);

      return {
        orderId: String(orderData['order_id'] ?? ''),
        merchantOrderReference: String(orderData['merchant_order_reference'] ?? ''),
        status: String(orderData['status'] ?? ''),
        rawResponse: data,
      };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const rawResponse = (axiosErr.response?.data ?? axiosErr.message) as Record<string, unknown>;
      this.logger.error(`[Pinelabs] CreateOrder failed: ${axiosErr.message}`);
      throw new Error(`CreateOrder failed: ${axiosErr.message}`);
    }
  }

  /**
   * Step 2 of the documented tokenization flow: Create Payment against an existing order.
   * POST {baseUrl}/api/pay/v1/orders/{order_id}/payments
   *
   * For saving a new card: include card_number, cvv, expiry in card_details with save=true.
   * For using a saved token: include token_id and token_txn_type in card_token_details.
   *
   * Returns a challenge_url if 3DS / authentication is required.
   */
  async createPayment(params: {
    orderId: string;
    paymentAmount: number; // in paise (integer)
    currency?: string;
    // New card fields
    cardNumber?: string;
    cvv?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cardName?: string;
    saveCard?: boolean;
    // Saved token fields
    tokenId?: string;
    tokenTxnType?: 'NETWORK_TOKEN' | 'ALT_TOKEN';
    // External token fields
    externalToken?: {
      token: string;
      cryptogram: string;
      last4Digit?: string;
      name?: string;
      expiryMonth?: string;
      expiryYear?: string;
    };
    merchantPaymentReference?: string;
  }): Promise<{
    paymentId: string | null;
    challengeUrl: string | null;
    status: string | null;
    cardData: Record<string, unknown> | null;
    rawResponse: Record<string, unknown>;
  }> {
    try {
      this.logger.log(`[Pinelabs] Creating payment | orderId=${params.orderId} | amount=${params.paymentAmount}`);

      const headers = await this.buildAuthHeaders();

      // Build payment option based on which fields are provided
      let paymentOption: Record<string, unknown> = {};

      if (params.tokenId) {
        // Using a saved PineLabs token
        paymentOption = {
          card_token_details: {
            token_id: params.tokenId,
            cvv: params.cvv,
            token_txn_type: params.tokenTxnType ?? 'NETWORK_TOKEN',
          },
        };
      } else if (params.externalToken) {
        // Token created on another PA/PG (ALT_TOKEN flow)
        paymentOption = {
          card_token_details: {
            name: params.externalToken.name,
            last4_digit: params.externalToken.last4Digit,
            cvv: params.externalToken.cryptogram, // cryptogram used as CVV substitute
            expiry_month: params.externalToken.expiryMonth,
            expiry_year: params.externalToken.expiryYear,
            token: params.externalToken.token,
            cryptogram: params.externalToken.cryptogram,
            token_txn_type: 'ALT_TOKEN',
          },
        };
      } else if (params.cardNumber) {
        // Saving a new card for the first time
        paymentOption = {
          card_details: {
            save: params.saveCard ?? true,
            name: params.cardName,
            card_number: params.cardNumber,
            cvv: params.cvv,
            expiry_month: params.expiryMonth,
            expiry_year: params.expiryYear,
          },
        };
      }

      const payload: Record<string, unknown> = {
        payments: [
          {
            payment_method: 'CARD',
            payment_amount: {
              value: params.paymentAmount,
              currency: params.currency ?? 'INR',
            },
            payment_option: paymentOption,
          },
        ],
      };

      // Only set merchant_payment_reference on the payment object (for external tokens)
      if (params.merchantPaymentReference) {
        const payments = payload.payments as Array<Record<string, unknown>>;
        payments[0]['merchant_payment_reference'] = params.merchantPaymentReference;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/pay/v1/orders/${params.orderId}/payments`,
        payload,
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;
      const orderData = (data['data'] ?? data) as Record<string, unknown>;
      const payments = (orderData['payments'] as Array<Record<string, unknown>>) ?? [];
      const payment = payments[0] ?? {};

      const challengeUrl = orderData['challenge_url'] as string | null ?? null;
      const cardData = (payment['payment_option'] as Record<string, unknown>)?.['card_data'] as Record<string, unknown> | null ?? null;

      this.logger.log(
        `[Pinelabs] Payment created | orderId=${params.orderId} | paymentId=${payment['id']} | status=${payment['status']} | challengeUrl=${challengeUrl ? 'yes' : 'none'}`,
      );

      return {
        paymentId: payment['id'] ? String(payment['id']) : null,
        challengeUrl,
        status: payment['status'] ? String(payment['status']) : null,
        cardData,
        rawResponse: data,
      };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const rawResponse = (axiosErr.response?.data ?? axiosErr.message) as Record<string, unknown>;
      this.logger.error(`[Pinelabs] CreatePayment failed: ${axiosErr.message}`);
      throw new Error(`CreatePayment failed: ${axiosErr.message}`);
    }
  }

  /**
   * Step 3 of the documented tokenization flow: Capture Order.
   * PUT {baseUrl}/api/pay/v1/orders/{order_id}/capture
   *
   * Called after the webhook confirms the order status is AUTHORIZED.
   * Completes the payment and updates order status to PROCESSED.
   */
  async captureOrder(params: {
    orderId: string;
    captureAmount: number; // in paise (integer)
    merchantCaptureReference?: string;
  }): Promise<{ status: string; rawResponse: Record<string, unknown> }> {
    try {
      this.logger.log(`[Pinelabs] Capturing order | orderId=${params.orderId} | amount=${params.captureAmount}`);

      const headers = await this.buildAuthHeaders();
      const response = await axios.put(
        `${this.baseUrl}/api/pay/v1/orders/${params.orderId}/capture`,
        {
          merchant_capture_reference: params.merchantCaptureReference ?? `capture_${params.orderId}`,
          capture_amount: {
            value: params.captureAmount,
            currency: 'INR',
          },
        },
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;
      const orderData = (data['data'] ?? data) as Record<string, unknown>;

      this.logger.log(`[Pinelabs] Order captured | orderId=${params.orderId} | status=${orderData['status']}`);

      return {
        status: String(orderData['status'] ?? ''),
        rawResponse: data,
      };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      this.logger.error(`[Pinelabs] CaptureOrder failed: ${axiosErr.message}`);
      throw new Error(`CaptureOrder failed: ${axiosErr.message}`);
    }
  }

  /**
   * Cancel an order that is in AUTHORIZED or PROCESSING state.
   * PUT {baseUrl}/api/pay/v1/orders/{order_id}/cancel
   */
  async cancelOrder(orderId: string): Promise<{ status: string; rawResponse: Record<string, unknown> }> {
    try {
      this.logger.log(`[Pinelabs] Cancelling order | orderId=${orderId}`);

      const headers = await this.buildAuthHeaders();
      const response = await axios.put(
        `${this.baseUrl}/api/pay/v1/orders/${orderId}/cancel`,
        {},
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;
      const orderData = (data['data'] ?? data) as Record<string, unknown>;

      this.logger.log(`[Pinelabs] Order cancelled | orderId=${orderId} | status=${orderData['status']}`);

      return {
        status: String(orderData['status'] ?? ''),
        rawResponse: data,
      };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      this.logger.error(`[Pinelabs] CancelOrder failed: ${axiosErr.message}`);
      throw new Error(`CancelOrder failed: ${axiosErr.message}`);
    }
  }

  // ─── Payout APIs (UPI / Bank Transfer) ─────────────────────────────────────

  /**
   * Execute a UPI payout.
   * Uses same orderId for retries (idempotency handled by PineLabs).
   * Note: This uses the Payout API variant. If PineLabs returns a challenge_url
   * (user authentication required), caller should redirect user there.
   */
  /**
   * Execute a UPI payout via the v3 Payouts API.
   * Endpoint: POST {baseUrl}/payouts/v3/payments/banks
   * Schema per OpenAPI spec: clientReferenceId, payeeName, amount, mode, remarks, vpa
   */
  async payoutUpi(params: {
    clientReferenceId: string;
    payeeName: string;
    upiId: string;
    amount: number; // in paise (integer)
    remarks?: string;
  }): Promise<PayoutResult> {
    try {
      this.logger.log(
        `[Pinelabs] Initiating UPI payout | clientRef=${params.clientReferenceId} | amount=${params.amount} | upi=${params.upiId}`,
      );

      const headers = await this.buildAuthHeaders();
      const requestBody = {
        clientReferenceId: params.clientReferenceId,
        payeeName: params.payeeName,
        amount: { value: params.amount, currency: 'INR' },
        mode: 'UPI',
        vpa: params.upiId,
        remarks: (params.remarks ?? `Withdrawal payout ${params.clientReferenceId}`).slice(0, 50),
      };
      this.logger.debug('[Pinelabs] UPI payout request | url=' + `${this.baseUrl}/payouts/v3/payments/banks` + ' | body=' + JSON.stringify(requestBody));

      const response = await axios.post(
        `${this.baseUrl}/payouts/v3/payments/banks`,
        requestBody,
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;

      if (this.isSuccessResponse(data)) {
        this.logger.log(
          `[Pinelabs] UPI payout success | clientRef=${params.clientReferenceId} | paymentRef=${data['paymentReferenceId'] ?? data['requestReferenceId']}`,
        );
        return {
          success: true,
          pinelabsTransactionId: String(data['paymentReferenceId'] ?? data['requestReferenceId'] ?? ''),
          errorCode: null,
          errorMessage: null,
          rawResponse: data,
        };
      } else {
        const errorCode = String(data['errorCode'] ?? data['error_code'] ?? 'UNKNOWN');
        const errorMessage = String(data['errorMessage'] ?? data['error_message'] ?? 'Payout failed');
        this.logger.warn(`[Pinelabs] UPI payout failed | clientRef=${params.clientReferenceId} | code=${errorCode} | msg=${errorMessage}`);
        return {
          success: false,
          pinelabsTransactionId: null,
          errorCode,
          errorMessage,
          rawResponse: data,
        };
      }
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const statusCode = axiosErr.response?.status;
      if (statusCode === 401) {
        this.invalidateToken();
      }
      const rawResponse = (axiosErr.response?.data ?? {}) as Record<string, unknown>;
      const errorCode = String(
        (axiosErr.response?.data as Record<string, unknown>)?.['errorCode']
        ?? (axiosErr.response?.data as Record<string, unknown>)?.['error_code']
        ?? 'NETWORK_ERROR',
      );
      const errorMessage = String(
        (axiosErr.response?.data as Record<string, unknown>)?.['errorMessage']
        ?? (axiosErr.response?.data as Record<string, unknown>)?.['error_message']
        ?? axiosErr.message,
      );
      this.logger.error(`[Pinelabs] UPI payout error | clientRef=${params.clientReferenceId} | status=${statusCode} | code=${errorCode} | msg=${errorMessage}`);
      return {
        success: false,
        pinelabsTransactionId: null,
        errorCode,
        errorMessage,
        rawResponse,
      };
    }
  }

  /**
   * Execute a bank transfer (IMPS/NEFT/RTGS) payout via the v3 Payouts API.
   * Endpoint: POST {baseUrl}/payouts/v3/payments/banks
   * Schema per OpenAPI spec: clientReferenceId, payeeName, accountNumber, branchCode, amount, mode, remarks
   * Uses same clientReferenceId for retries (idempotency handled by PineLabs).
   */
  async payoutBank(params: {
    clientReferenceId: string;
    payeeName: string;
    accountNumber: string;
    ifsc: string;
    amount: number; // in paise (integer)
    remarks?: string;
  }): Promise<PayoutResult> {
    try {
      this.logger.log(
        `[Pinelabs] Initiating bank payout | clientRef=${params.clientReferenceId} | amount=${params.amount} | account=${params.accountNumber.slice(-4).padStart(params.accountNumber.length, '*')}`,
      );

      const headers = await this.buildAuthHeaders();

      const response = await axios.post(
        `${this.baseUrl}/payouts/v3/payments/banks`,
        {
          clientReferenceId: params.clientReferenceId,
          payeeName: params.payeeName,
          accountNumber: params.accountNumber,
          branchCode: params.ifsc,
          amount: {
            value: params.amount,
            currency: 'INR',
          },
          mode: 'IMPS',
          remarks: (params.remarks ?? `Withdrawal payout ${params.clientReferenceId}`).slice(0, 50),
        },
        { headers, timeout: 30_000 },
      );

      const data = response.data as Record<string, unknown>;

      if (this.isSuccessResponse(data)) {
        this.logger.log(
          `[Pinelabs] Bank payout success | clientRef=${params.clientReferenceId} | paymentRef=${data['paymentReferenceId'] ?? data['requestReferenceId']}`,
        );
        return {
          success: true,
          pinelabsTransactionId: String(data['paymentReferenceId'] ?? data['requestReferenceId'] ?? ''),
          errorCode: null,
          errorMessage: null,
          rawResponse: data,
        };
      } else {
        const errorCode = String(data['errorCode'] ?? data['error_code'] ?? 'UNKNOWN');
        const errorMessage = String(data['errorMessage'] ?? data['error_message'] ?? 'Payout failed');
        this.logger.warn(`[Pinelabs] Bank payout failed | clientRef=${params.clientReferenceId} | code=${errorCode} | msg=${errorMessage}`);
        return {
          success: false,
          pinelabsTransactionId: null,
          errorCode,
          errorMessage,
          rawResponse: data,
        };
      }
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      const statusCode = axiosErr.response?.status;
      if (statusCode === 401) {
        this.invalidateToken();
      }
      const rawResponse = (axiosErr.response?.data ?? {}) as Record<string, unknown>;
      const errorCode = String(
        (axiosErr.response?.data as Record<string, unknown>)?.['errorCode']
        ?? (axiosErr.response?.data as Record<string, unknown>)?.['error_code']
        ?? 'NETWORK_ERROR',
      );
      const errorMessage = String(
        (axiosErr.response?.data as Record<string, unknown>)?.['errorMessage']
        ?? (axiosErr.response?.data as Record<string, unknown>)?.['error_message']
        ?? axiosErr.message,
      );
      this.logger.error(`[Pinelabs] Bank payout error | clientRef=${params.clientReferenceId} | status=${statusCode} | code=${errorCode} | msg=${errorMessage}`);
      return {
        success: false,
        pinelabsTransactionId: null,
        errorCode,
        errorMessage,
        rawResponse,
      };
    }
  }

  /**
   * Dispatch a payout based on payment method.
   * For bank payouts, payoutDetails may contain accountNumberEncrypted (AES-256-GCM).
   * In that case, decrypt it before sending to PineLabs.
   *
   * Required schema fields per OpenAPI spec:
   *   UPI  : clientReferenceId, payeeName, amount, mode, remarks, vpa
   *   IMPS : clientReferenceId, payeeName, accountNumber, branchCode, amount, mode, remarks
   *
   * Returns same shape as payoutUpi/payoutBank.
   */
  async dispatchPayout(params: {
    clientReferenceId: string;
    payeeName: string;
    paymentMethod: PayoutMethod;
    amount: number;
    payoutDetails: Record<string, unknown>;
  }): Promise<PayoutResult> {
    if (params.paymentMethod === PayoutMethod.UPI) {
      return this.payoutUpi({
        clientReferenceId: params.clientReferenceId,
        payeeName: params.payeeName,
        upiId: String(params.payoutDetails['upiId'] ?? params.payoutDetails['vpa'] ?? ''),
        amount: params.amount,
        remarks: `Withdrawal ${params.clientReferenceId}`,
      });
    } else {
      // Account number may be encrypted (when fetched from UserPaymentDetail record)
      let accountNumber = String(params.payoutDetails['accountNumber'] ?? params.payoutDetails['account_number'] ?? '');
      const encAccount = params.payoutDetails['accountNumberEncrypted'];
      if (encAccount && typeof encAccount === 'string' && encAccount.includes(':')) {
        try {
          accountNumber = decrypt(encAccount as string);
        } catch {
          this.logger.warn(`[Pinelabs] Failed to decrypt accountNumber for clientRef=${params.clientReferenceId}`);
        }
      }

      let ifsc = String(params.payoutDetails['ifsc'] ?? params.payoutDetails['ifscCode'] ?? '');
      const encIfsc = params.payoutDetails['ifscEncrypted'];
      if (encIfsc && typeof encIfsc === 'string' && encIfsc.includes(':')) {
        try {
          ifsc = decrypt(encIfsc as string);
        } catch {
          this.logger.warn(`[Pinelabs] Failed to decrypt ifsc for clientRef=${params.clientReferenceId}`);
        }
      }

      let payeeName = String(params.payoutDetails['accountHolderName'] ?? params.payoutDetails['account_holder_name'] ?? params.payeeName);
      const encHolderName = params.payoutDetails['accountHolderNameEncrypted'];
      if (encHolderName && typeof encHolderName === 'string' && encHolderName.includes(':')) {
        try {
          payeeName = decrypt(encHolderName as string);
        } catch {
          this.logger.warn(`[Pinelabs] Failed to decrypt accountHolderName for clientRef=${params.clientReferenceId}`);
        }
      }

      return this.payoutBank({
        clientReferenceId: params.clientReferenceId,
        payeeName,
        accountNumber,
        ifsc,
        amount: params.amount,
        remarks: `Withdrawal ${params.clientReferenceId}`,
      });
    }
  }

  /**
   * Dispatch a ₹1 verification micro-transaction.
   * Uses generateVerificationOrderId() for idempotency.
   */
  async dispatchVerificationPayout(params: {
    clientReferenceId: string;
    payeeName?: string;
    paymentMethod: PayoutMethod;
    payoutDetails: Record<string, unknown>;
  }): Promise<PayoutResult> {
    this.logger.log(`[Pinelabs] Verification payout | clientRef=${params.clientReferenceId} | method=${params.paymentMethod}`);
    return this.dispatchPayout({
      clientReferenceId: params.clientReferenceId,
      payeeName: params.payeeName ?? 'Customer',
      paymentMethod: params.paymentMethod,
      amount: 1, // ₹1 in paise
      payoutDetails: params.payoutDetails,
    });
  }

  // ─── Transaction Status ─────────────────────────────────────────────────────

  /**
   * Check payout status by clientReferenceId.
   * Endpoint: GET {baseUrl}/payouts/v3/payments?clientReferenceId={clientReferenceId}
   * Per spec: returns an array of payouts; status values: SCHEDULED | PENDING | PROCESSING | PROCESSED | SUCCESS | FAILED.
   */
  async getTransactionStatus(clientReferenceId: string): Promise<{ status: string; rawResponse: Record<string, unknown> }> {
    try {
      const headers = await this.buildAuthHeaders();
      const response = await axios.get(`${this.baseUrl}/payouts/v3/payments`, {
        headers,
        params: { clientReferenceId },
        timeout: 15_000,
      });
      const data = response.data as Record<string, unknown>;
      // Per spec: response is { data: Payout[], requestReferenceId, ... }
      const payouts = (data['data'] as Array<Record<string, unknown>>) ?? [];
      const payout = payouts[0];
      const status = payout ? String(payout['status'] ?? 'unknown') : 'not_found';
      this.logger.log(`[Pinelabs] Status check | clientRef=${clientReferenceId} | status=${status}`);
      return { status, rawResponse: data };
    } catch (err) {
      const axiosErr = err as AxiosError<Record<string, unknown>>;
      this.logger.error(`[Pinelabs] Status check error | clientRef=${clientReferenceId} | ${axiosErr.message}`);
      return { status: 'error', rawResponse: {} };
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Verify the signature of a payment callback from PineLabs.
   * Per docs: SHA-256 HMAC of the sorted key=value pairs joined by &.
   * Keys: order_id, status, error_code (if present), error_message (if present).
   */
  verifyPaymentSignature(params: {
    orderId: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
    receivedSignature: string;
  }): boolean {
    // Skip verification if no secret key is configured
    if (!this.secretKey) {
      this.logger.debug('[Pinelabs] Skipping webhook signature verification — no secretKey configured');
      return true;
    }

    try {
      // Build sorted key-value string per docs
      const parts: string[] = [
        `order_id=${params.orderId}`,
        `status=${params.status}`,
      ];
      if (params.errorCode) parts.push(`error_code=${params.errorCode}`);
      if (params.errorMessage) parts.push(`error_message=${params.errorMessage}`);

      // HMAC-SHA256 of the concatenated string using secretKey (hex-encoded)
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(parts.join('&'));
      const expectedSignature = hmac.digest('hex');

      return expectedSignature === params.receivedSignature;
    } catch (err) {
      this.logger.error(`[Pinelabs] Signature verification error: ${(err as Error).message}`);
      return false;
    }
  }

  private isSuccessResponse(data: Record<string, unknown>): boolean {
    const status = String(data['status'] ?? '').toLowerCase();
    return status === 'success' || status === 'completed' || status === 'accepted';
  }
}
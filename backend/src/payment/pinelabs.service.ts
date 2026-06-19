import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
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

@Injectable()
export class PinelabsService {
  private readonly logger = new Logger(PinelabsService.name);
  private readonly client: AxiosInstance;
  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('payment.pinelabs.baseUrl') ?? '';
    this.merchantId = this.configService.get<string>('payment.pinelabs.merchantId') ?? '';
    this.apiKey = this.configService.get<string>('payment.pinelabs.apiKey') ?? '';
    this.secretKey = this.configService.get<string>('payment.pinelabs.secretKey') ?? '';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        'X-Merchant-Id': this.merchantId,
      },
    });
  }

  /**
   * Generates a unique order ID for withdrawal payouts.
   * Format: PL_<withdrawalId>_<uuid>
   */
  generateOrderId(withdrawalId: string): string {
    return `PL_${withdrawalId.replace(/-/g, '')}_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  }

  /**
   * Generates a unique order ID for verification micro-transactions.
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

  /**
   * Execute a UPI payout.
   * Uses same orderId for retries (idempotency handled by PineLabs).
   */
  async payoutUpi(params: {
    orderId: string;
    upiId: string;
    amount: number; // in rupees (float)
    remarks?: string;
  }): Promise<PayoutResult> {
    try {
      this.logger.log(`[Pinelabs] Initiating UPI payout | orderId=${params.orderId} | amount=₹${params.amount} | upi=${params.upiId}`);

      const response = await this.client.post('/v1/payouts/upi', {
        order_id: params.orderId,
        upi_id: params.upiId,
        amount: params.amount,
        remarks: params.remarks ?? `Withdrawal payout ${params.orderId}`,
      });

      const data = response.data as Record<string, unknown>;

      if (this.isSuccessResponse(data)) {
        this.logger.log(`[Pinelabs] UPI payout success | orderId=${params.orderId} | txnId=${data.transaction_id}`);
        return {
          success: true,
          pinelabsTransactionId: String(data.transaction_id ?? ''),
          errorCode: null,
          errorMessage: null,
          rawResponse: data,
        };
      } else {
        const errorCode = String(data.error_code ?? 'UNKNOWN');
        const errorMessage = String(data.error_message ?? 'Payout failed');
        this.logger.warn(`[Pinelabs] UPI payout failed | orderId=${params.orderId} | code=${errorCode} | msg=${errorMessage}`);
        return {
          success: false,
          pinelabsTransactionId: null,
          errorCode,
          errorMessage,
          rawResponse: data,
        };
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[Pinelabs] UPI payout error | orderId=${params.orderId} | ${error.message}`);
      return {
        success: false,
        pinelabsTransactionId: null,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error.message,
        rawResponse: {},
      };
    }
  }

  /**
   * Execute a bank transfer (NEFT/IMPS) payout.
   * Uses same orderId for retries (idempotency handled by PineLabs).
   */
  async payoutBank(params: {
    orderId: string;
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
    amount: number; // in rupees (float)
    remarks?: string;
  }): Promise<PayoutResult> {
    try {
      this.logger.log(`[Pinelabs] Initiating bank payout | orderId=${params.orderId} | amount=₹${params.amount} | account=${params.accountNumber.slice(-4).padStart(params.accountNumber.length, '*')}`);

      const response = await this.client.post('/v1/payouts/bank', {
        order_id: params.orderId,
        account_number: params.accountNumber,
        ifsc_code: params.ifsc,
        beneficiary_name: params.beneficiaryName,
        amount: params.amount,
        remarks: params.remarks ?? `Withdrawal payout ${params.orderId}`,
      });

      const data = response.data as Record<string, unknown>;

      if (this.isSuccessResponse(data)) {
        this.logger.log(`[Pinelabs] Bank payout success | orderId=${params.orderId} | txnId=${data.transaction_id}`);
        return {
          success: true,
          pinelabsTransactionId: String(data.transaction_id ?? ''),
          errorCode: null,
          errorMessage: null,
          rawResponse: data,
        };
      } else {
        const errorCode = String(data.error_code ?? 'UNKNOWN');
        const errorMessage = String(data.error_message ?? 'Payout failed');
        this.logger.warn(`[Pinelabs] Bank payout failed | orderId=${params.orderId} | code=${errorCode} | msg=${errorMessage}`);
        return {
          success: false,
          pinelabsTransactionId: null,
          errorCode,
          errorMessage,
          rawResponse: data,
        };
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[Pinelabs] Bank payout error | orderId=${params.orderId} | ${error.message}`);
      return {
        success: false,
        pinelabsTransactionId: null,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error.message,
        rawResponse: {},
      };
    }
  }

  /**
   * Dispatch a payout based on payment method.
   * For bank payouts, payoutDetails may contain accountNumberEncrypted (AES-256-GCM).
   * In that case, decrypt it before sending to PineLabs.
   * Returns same shape as payoutUpi/payoutBank.
   */
  async dispatchPayout(params: {
    orderId: string;
    paymentMethod: PayoutMethod;
    amount: number;
    payoutDetails: Record<string, unknown>;
  }): Promise<PayoutResult> {
    if (params.paymentMethod === PayoutMethod.UPI) {
      return this.payoutUpi({
        orderId: params.orderId,
        upiId: String(params.payoutDetails['upiId'] ?? params.payoutDetails['upi_id'] ?? ''),
        amount: params.amount,
        remarks: `Withdrawal payout for order ${params.orderId}`,
      });
    } else {
      // Account number may be encrypted (when fetched from UserPaymentDetail record)
      let accountNumber = String(params.payoutDetails['accountNumber'] ?? params.payoutDetails['account_number'] ?? '');
      const encrypted = params.payoutDetails['accountNumberEncrypted'];
      if (encrypted && typeof encrypted === 'string' && encrypted.includes(':')) {
        try {
          accountNumber = decrypt(encrypted);
        } catch {
          this.logger.warn(`[Pinelabs] Failed to decrypt accountNumber for orderId=${params.orderId}`);
        }
      }
      return this.payoutBank({
        orderId: params.orderId,
        accountNumber,
        ifsc: String(params.payoutDetails['ifsc'] ?? params.payoutDetails['ifscCode'] ?? ''),
        beneficiaryName: String(params.payoutDetails['accountHolderName'] ?? params.payoutDetails['account_holder_name'] ?? ''),
        amount: params.amount,
        remarks: `Withdrawal payout for order ${params.orderId}`,
      });
    }
  }

  /**
   * Dispatch a ₹1 verification micro-transaction.
   * Uses generateVerificationOrderId() for idempotency.
   */
  async dispatchVerificationPayout(params: {
    orderId: string;
    paymentMethod: PayoutMethod;
    payoutDetails: Record<string, unknown>;
  }): Promise<PayoutResult> {
    this.logger.log(`[Pinelabs] Verification payout | orderId=${params.orderId} | method=${params.paymentMethod}`);
    return this.dispatchPayout({
      orderId: params.orderId,
      paymentMethod: params.paymentMethod,
      amount: 1,
      payoutDetails: params.payoutDetails,
    });
  }

  /**
   * Check transaction status by order ID.
   */
  async getTransactionStatus(orderId: string): Promise<{ status: string; rawResponse: Record<string, unknown> }> {
    try {
      const response = await this.client.get(`/v1/payouts/${orderId}/status`);
      return {
        status: String(response.data['status'] ?? 'unknown'),
        rawResponse: response.data as Record<string, unknown>,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`[Pinelabs] Status check error | orderId=${orderId} | ${error.message}`);
      return { status: 'error', rawResponse: {} };
    }
  }

  private isSuccessResponse(data: Record<string, unknown>): boolean {
    // PineLabs returns `status` field; treat nonfailure codes as success.
    // Adjust based on actual PineLabs API contract.
    const status = String(data['status'] ?? '').toLowerCase();
    return status === 'success' || status === 'completed' || status === 'accepted';
  }
}
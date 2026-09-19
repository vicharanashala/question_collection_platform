import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { HttpStatusCode } from 'axios';
import { BrpsTokenService } from './brps-token.service';

/**
 * BSNL Retail Push SMS (BRPS) implementation.
 *
 * BRPS uses DLT-compliant template-based sending. Before sending:
 *   - Register Principal Entity, Header, and Content Template on the BSNL DLT portal
 *   - Name template variables via POST /api/Name_Content_Template_Variables
 *
 * Approved OTP template (DLT id 1477178833116832510):
 *   "Your One-Time Password (OTP) for {#var#} ANNAM {#var#} is {#var#}.
 *    This OTP is valid for {#var#} minutes. Please do not share this OTP
 *    with anyone.\nANNAM.AI"
 *
 * Renders as: "... for login ANNAM web app is 123456. This OTP is valid for
 * 5 minutes. ..."
 */
// Must match the OTP expiry enforced in AuthService.
const OTP_VALIDITY_MINUTES = 5;

@Injectable()
export class SmsBsnlBrpsService {
  private readonly logger = new Logger(SmsBsnlBrpsService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BrpsTokenService))
    private readonly tokenService: BrpsTokenService,
  ) {}

  /**
   * Send an OTP SMS via BSNL BRPS.
   * Retries once with a fresh token when BRPS rejects the cached one (401), which
   * happens when another instance or environment creates a new token in the same slot.
   *
   * @param mobileNumber  Full or local Indian number (e.g. "+919876543210" or "9876543210")
   * @param otp           6-digit OTP string
   */
  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');

    try {
      const token = await this.tokenService.getValidToken();
      try {
        await this.postSendSms(token, cleanNumber, otp);
      } catch (err) {
        if (!axios.isAxiosError(err) || err.response?.status !== HttpStatusCode.Unauthorized) {
          throw err;
        }
        this.logger.warn('[BRPS] Token rejected (401), refreshing and retrying once');
        this.tokenService.invalidateToken(token);
        const freshToken = await this.tokenService.getValidToken();
        await this.postSendSms(freshToken, cleanNumber, otp);
      }
    } catch (err) {
      // Rethrow a plain error so the raw axios object (which includes the bearer token) is never logged.
      const detail = this.describeError(err);
      this.logger.error(`[BRPS] Failed to send OTP to ${cleanNumber}: ${detail}`);
      throw new Error(`BRPS send failed: ${detail}`);
    }
  }

  // Calls the BRPS Send_SMS endpoint with the approved OTP template and checks the response body for errors.
  private async postSendSms(token: string, cleanNumber: string, otp: string): Promise<void> {
    const header = this.configService.get<string>('sms.header') ?? 'ANNAMAI';
    const entityId = this.configService.get<string>('sms.entityId') ?? '';
    const templateId = this.configService.get<string>('sms.templateId') ?? '';
    const baseUrl =
      this.configService.get<string>('sms.baseUrl') || 'https://bulksms.bsnl.in:5010';

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
        // Keys must match the names registered on the BRPS portal; BRPS
        // substitutes by name, not by position.
        Template_Keys_and_Values: [
          { Key: 'Purpose', Value: 'login in to' },
          { Key: 'Platform', Value: 'AnnaDatha' },
          { Key: 'OTP', Value: otp },
          { Key: 'Validity', Value: String(OTP_VALIDITY_MINUTES) },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        timeout: 20_000,
      },
    );

    const data = response.data as { Error: string | null; Message_Id?: string };

    if (data.Error) {
      throw new Error(`BRPS API error: ${data.Error}`);
    }

    this.logger.log(
      `[BRPS] OTP sent to ${cleanNumber}, Message_Id: ${data.Message_Id ?? 'unknown'}`,
    );
  }

  // Builds a short, secret-free description of a failure for logs and rethrown errors.
  private describeError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? err.code ?? 'no response';
      const body = err.response?.data ? ` ${JSON.stringify(err.response.data)}` : '';
      return `HTTP ${status}${body}`;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
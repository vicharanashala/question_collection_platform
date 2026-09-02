import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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
   *
   * @param mobileNumber  Full or local Indian number (e.g. "+919876543210" or "9876543210")
   * @param otp           6-digit OTP string
   */
  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    const token = await this.tokenService.getValidToken();
    const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');

    const header = this.configService.get<string>('sms.header') ?? 'ANNAMAI';
    const entityId = this.configService.get<string>('sms.entityId') ?? '';
    const templateId = this.configService.get<string>('sms.templateId') ?? '';
    const baseUrl =
      this.configService.get<string>('sms.baseUrl') || 'https://bulksms.bsnl.in:5010';

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
    } catch (err) {
      const error = err as { response?: { data?: unknown }; message?: string };
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.error(`[BRPS] Failed to send OTP to ${cleanNumber}: ${detail}`);
      throw err;
    }
  }
}
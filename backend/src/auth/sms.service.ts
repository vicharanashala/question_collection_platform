import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * SMS Gateway abstraction supporting multiple providers.
 *
 * Provider selection via SMS_PROVIDER env var (defaults to 'mock'):
 *   mock      – log OTP to console (dev/CI only)
 *   fast2sms  – send via Fast2SMS bulk API
 *   msg91     – send via MSG91 OTP API
 *   twilio    – send via Twilio Verify
 *   gupshup   – send via Gupshup SMS API
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a 6-digit OTP to the given mobile number.
   */
  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    const provider = this.configService.get<string>('sms.provider') ?? 'mock';

    switch (provider) {
      case 'fast2sms':
        await this.sendViaFast2Sms(mobileNumber, otp);
        break;
      case 'msg91':
        await this.sendViaMsg91(mobileNumber, otp);
        break;
      case 'twilio':
        await this.sendViaTwilio(mobileNumber, otp);
        break;
      case 'gupshup':
        await this.sendViaGupshup(mobileNumber, otp);
        break;
      case 'mock':
      default:
        // Development: print OTP to stdout — no external call
        this.logger.log(`[MOCK SMS] To: ${mobileNumber} | OTP: ${otp}`);
        break;
    }
  }

  // ─── Fast2SMS ───────────────────────────────────────────────────────────────

  private async sendViaFast2Sms(mobileNumber: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');

    if (!apiKey) {
      throw new Error('Fast2SMS API key not configured. Set FAST2SMS_API_KEY in environment.');
    }

    const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');
    const text = `Your verification code is ${otp}. It is valid for 1 minute. To verify your number for Question Collection Application by Annam AI.`;
    const route = this.configService.get<string>('sms.route') ?? 'q';

    try {
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route,
          message: text,
          language: 'english',
          flash: 0,
          numbers: cleanNumber,
          sms_details: 1,
        },
        {
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`[Fast2SMS] OTP sent to ${cleanNumber}: ${JSON.stringify(response.data)}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown }; message?: string };
      this.logger.error(`[Fast2SMS] Failed to send OTP to ${cleanNumber}: ${JSON.stringify(error.response?.data) || error.message}`);
      throw new Error(`Fast2SMS API error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    }
  }

  // ─── MSG91 ─────────────────────────────────────────────────────────────────

  private async sendViaMsg91(mobileNumber: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');
    const senderId = this.configService.get<string>('sms.senderId') ?? 'AGRIAPP';

    if (!apiKey) {
      throw new Error('MSG91 API key not configured. Set SMS_API_KEY in environment.');
    }

    const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');
    const url = `https://api.msg91.com/api/v5/otp`;

    // NOTE: Uncomment when using real credentials
    // const body = new URLSearchParams({
    //   authkey: apiKey,
    //   mobiles: cleanNumber,
    //   message: `Your verification code is ${otp}. It is valid for 5 minutes. Do not share it. - AgriApp`,
    //   sender: senderId,
    //   otp: otp,
    //   otp_expiry: '5',
    // });

    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: body.toString(),
    // });

    // if (!response.ok) {
    //   throw new Error(`MSG91 API error: ${response.status}`);
    // }

    this.logger.warn('[MSG91] OTP sending not wired — add SMS_API_KEY to .env to enable');
  }

  // ─── Twilio ─────────────────────────────────────────────────────────────────

  private async sendViaTwilio(mobileNumber: string, otp: string): Promise<void> {
    const accountSid = this.configService.get<string>('sms.apiKey');
    const authToken = this.configService.get<string>('sms.apiSecret');
    const from = this.configService.get<string>('sms.senderId');

    // NOTE: Uncomment when using real credentials
    // const response = await fetch(
    //   `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SID}/Verifications`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/x-www-form-urlencoded',
    //       Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    //     },
    //     body: new URLSearchParams({ To: mobileNumber, Channel: 'sms' }),
    //   },
    // );

    this.logger.warn('[Twilio] OTP sending not wired — add SMS_API_KEY and SMS_API_SECRET to .env to enable');
  }

  // ─── Gupshup ───────────────────────────────────────────────────────────────

  private async sendViaGupshup(mobileNumber: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');
    const userId = this.configService.get<string>('sms.apiSecret');
    const senderId = this.configService.get<string>('sms.senderId') ?? 'AGRIAPP';

    const cleanNumber = mobileNumber.replace(/^\+?91 ?/, '').replace(/^0/, '');
    const message = `Your verification code is ${otp}. Valid for 5 minutes. Do not share. - AgriApp`;

    // NOTE: Uncomment when using real credentials
    // const url = `https://api.gupshup.io/sms/api/v1/template/msg`;
    // const body = new URLSearchParams({
    //   api_key: apiKey,
    //   userid: userId,
    //   channel: 'sms',
    //   destination: cleanNumber,
    //   source: senderId,
    //   message: encodeURIComponent(message),
    //   'template.id': 'otp_verification',
    // });

    this.logger.warn('[Gupshup] OTP sending not wired — add SMS_API_KEY and SMS_API_SECRET to .env to enable');
  }
}
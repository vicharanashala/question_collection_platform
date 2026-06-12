import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS Gateway abstraction.
 * Currently uses a mock provider that logs OTPs to console/stdout.
 * Swap `sendOtp` implementation for a real provider (MSG91, Twilio, Gupshup, etc.)
 * by setting SMS_PROVIDER=msg91|twilio|gupshup in environment.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a 6-digit OTP to the given mobile number.
   * In production, replace this with your SMS provider's SDK.
   */
  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    const provider = this.configService.get<string>('sms.provider') ?? 'mock';

    switch (provider) {
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

  private async sendViaMsg91(mobileNumber: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');
    const senderId = this.configService.get<string>('sms.senderId') ?? 'AGRIAPP';

    const cleanNumber = mobileNumber.replace(/^\+91/, '');
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

    this.logger.warn('[MSG91] OTP sending not wired — add API key to .env to enable');
  }

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

    this.logger.warn('[Twilio] OTP sending not wired — add credentials to .env to enable');
  }

  private async sendViaGupshup(mobileNumber: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');
    const userId = this.configService.get<string>('sms.apiSecret');
    const senderId = this.configService.get<string>('sms.senderId') ?? 'AGRIAPP';

    const cleanNumber = mobileNumber.replace(/^\+91/, '');
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

    this.logger.warn('[Gupshup] OTP sending not wired — add credentials to .env to enable');
  }
}
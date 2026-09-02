import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class BrpsTokenService {
  private readonly logger = new Logger(BrpsTokenService.name);

  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Return a valid BRPS JWT token, refreshing if expired or missing.
   */
  async getValidToken(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }
    await this.refreshToken();
    return this.token!;
  }

  /**
   * Create or refresh the BRPS JWT token.
   * Tokens are valid for 1 year; we refresh proactively 1 day early.
   */
  async refreshToken(): Promise<void> {
    const baseUrl =
      this.configService.get<string>('sms.baseUrl') || 'https://bulksms.bsnl.in:5010';
    const serviceId = this.configService.get<string>('sms.serviceId') ?? '';
    const username = this.configService.get<string>('sms.username') ?? '';
    const password = this.configService.get<string>('sms.password') ?? '';
    const tokenId = this.configService.get<string>('sms.tokenId') ?? '1';
    const ipWhitelist = this.configService.get<string>('sms.ipWhitelist') ?? '';

    const body: Record<string, unknown> = {
      Service_Id: serviceId,
      Username: username,
      Password: password,
      Token_Id: tokenId,
    };

    if (ipWhitelist) {
      body.IP_Addresses = ipWhitelist.split(',').map((ip) => ip.trim());
    } else {
      body.IP_Addresses = null;
    }

    try {
      const response = await axios.post(`${baseUrl}/api/Create_New_API_Token`, body, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 15_000,
      });

      // BRPS returns the JWT string directly in the response body
      this.token = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      // Proactively refresh ~1 day before the 1-year expiry
      this.tokenExpiry = new Date(Date.now() + 363 * 24 * 60 * 60 * 1000);

      this.logger.log(`[BRPS] Token refreshed, expires: ${this.tokenExpiry.toISOString()}`);
    } catch (err) {
      const error = err as { response?: { data?: unknown }; message?: string };
      this.logger.error(
        `[BRPS] Token refresh failed: ${JSON.stringify(error.response?.data) || error.message}`,
      );
      throw new Error(
        `BRPS token refresh failed: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`,
      );
    }
  }

  /**
   * Check the current token's validity via the Get_Token_Status API.
   */
  async isTokenValid(): Promise<boolean> {
    if (!this.token) return false;

    const baseUrl =
      this.configService.get<string>('sms.baseUrl') || 'https://bulksms.bsnl.in:5010';
    const tokenId = this.configService.get<string>('sms.tokenId') ?? '1';

    try {
      const response = await axios.post(
        `${baseUrl}/api/Get_Token_Status`,
        { Token_Id: tokenId },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10_000,
        },
      );

      const data = response.data as Record<string, unknown>;
      // Truthy "status" field indicates the token is live
      return !!data['status'];
    } catch {
      return false;
    }
  }
}
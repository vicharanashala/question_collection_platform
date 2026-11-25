import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";

// Zoho Mail SMTP over SSL.
const ZOHO_SSL_PORT = 465;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly sender: string;

  // Builds one Zoho SMTP transporter from the email config and reuses it for every message.
  constructor(configService: ConfigService) {
    this.sender = configService.getOrThrow<string>("email.user");
    if (!this.sender) {
      this.logger.warn("EMAIL_USER is not set, so email OTPs cannot be sent.");
    }
    this.transporter = createTransport({
      host: configService.getOrThrow<string>("email.host"),
      port: ZOHO_SSL_PORT,
      secure: true,
      auth: {
        user: this.sender,
        pass: configService.getOrThrow<string>("email.password"),
      },
    });
  }

  // Sends a plain-text email. Delivery errors go to the caller, which logs them.
  async sendSyncEmailToUser(
    email: string,
    subject: string,
    body: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `AnnaDatha <${this.sender}>`,
      to: email,
      subject,
      text: body,
    });
  }
}

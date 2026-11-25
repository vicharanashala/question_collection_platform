import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import { join } from "path";
import { createTransport, type Transporter } from "nodemailer";
import { EMAIL_LOGO_CID } from "./templates/otp-email.template";

// Zoho Mail SMTP over SSL.
const ZOHO_SSL_PORT = 465;

// Shipped in backend/public, which the Docker image copies next to dist.
const LOGO_PATH = join(process.cwd(), "public", "email", "annam-logo.png");

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly sender: string;
  private readonly hasLogo = existsSync(LOGO_PATH);

  // Builds one Zoho SMTP transporter from the email config and reuses it for every message.
  constructor(configService: ConfigService) {
    this.sender = configService.getOrThrow<string>("email.user");
    if (!this.sender) {
      this.logger.warn("EMAIL_USER is not set, so email OTPs cannot be sent.");
    }
    if (!this.hasLogo) {
      this.logger.warn(
        `Email logo not found at ${LOGO_PATH}; HTML emails will show its alt text.`,
      );
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

  // Sends an email with a plain-text body and an optional HTML version that shows the
  // Annam logo. Delivery errors go to the caller, which logs them.
  async sendSyncEmailToUser(
    email: string,
    subject: string,
    body: string,
    html?: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: `AnnaDatha <${this.sender}>`,
      to: email,
      subject,
      text: body,
      ...(html && {
        html,
        attachments: this.hasLogo
          ? [
              {
                filename: "annam-logo.png",
                path: LOGO_PATH,
                cid: EMAIL_LOGO_CID,
              },
            ]
          : [],
      }),
    });
  }
}

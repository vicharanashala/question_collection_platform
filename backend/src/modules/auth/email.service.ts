import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly configService: ConfigService) {}

  async sendSyncEmailToUser(
    email: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host:
        this.configService.get<string>("email.host") || process.env.EMAIL_HOST,
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user:
          this.configService.get<string>("email.user") ||
          process.env.EMAIL_USER,
        pass:
          this.configService.get<string>("email.password") ||
          process.env.EMAIL_PASSWORD,
      },
    });

    try {
      await transporter.verify();
      console.log("Server is ready to take our messages");
    } catch (err) {
      console.error("Verification failed:", err);
    }

    try {
      await transporter.sendMail({
        from: `AnnaDatha <${this.configService.get<string>("email.user") || process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        text: body,
      });
      console.log("Email sent successfully");
    } catch (err) {
      console.error("Error sending email:", err);
      throw new Error("Failed to send email");
    }
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { EMAIL_LOGO_CID, EMAIL_LOGO_PNG_BASE64 } from "./email-logo";
import { buildPasswordResetEmail } from "./password-reset-email";

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly logo = Buffer.from(EMAIL_LOGO_PNG_BASE64, "base64");
  private transporter!: Transporter;
  private mailFrom!: string;
  private appBaseUrl!: string;

  onModuleInit(): void {
    const apiKey = process.env["RESEND_API_KEY"];
    const mailFromAddr = process.env["MAIL_FROM"];
    const mailFromName = process.env["MAIL_FROM_NAME"] ?? "OpenPRA";

    if (!apiKey) throw new Error("RESEND_API_KEY is required but not set");
    if (!mailFromAddr) throw new Error("MAIL_FROM is required but not set");

    this.mailFrom = `"${mailFromName}" <${mailFromAddr}>`;
    this.appBaseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:4201";
    this.transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: apiKey },
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const message = buildPasswordResetEmail(resetUrl, this.appBaseUrl);

    try {
      await this.transporter.sendMail({
        from: this.mailFrom,
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: [
          {
            filename: "openpra-logo.png",
            content: this.logo,
            contentType: "image/png",
            contentDisposition: "inline",
            cid: EMAIL_LOGO_CID,
          },
        ],
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }
}

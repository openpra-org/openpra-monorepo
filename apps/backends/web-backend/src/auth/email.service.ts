import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private mailFrom!: string;

  onModuleInit(): void {
    const apiKey = process.env["RESEND_API_KEY"];
    const mailFromAddr = process.env["MAIL_FROM"];
    const mailFromName = process.env["MAIL_FROM_NAME"] ?? "OpenPRA";

    if (!apiKey) throw new Error("RESEND_API_KEY is required but not set");
    if (!mailFromAddr) throw new Error("MAIL_FROM is required but not set");

    this.mailFrom = `"${mailFromName}" <${mailFromAddr}>`;
    this.transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: apiKey },
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const subject = "Reset your OpenPRA password";
    const text = [
      "Hi,",
      "",
      "We received a request to reset the password for your OpenPRA account.",
      "Open the link below to set a new password. The link is valid for 1 hour.",
      "",
      resetUrl,
      "",
      "If you didn't request this, you can safely ignore this email.",
      "",
      "— OpenPRA",
    ].join("\n");

    try {
      await this.transporter.sendMail({
        from: this.mailFrom,
        to: email,
        subject,
        text,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }
}

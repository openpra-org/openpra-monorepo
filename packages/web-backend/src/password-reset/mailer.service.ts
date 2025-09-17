import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from "nodemailer";

/**
 * Service responsible for sending password reset emails using Nodemailer.
 */
@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly sender: string;

  constructor() {
    this.sender = process.env.GMAIL_USERNAME ?? "";

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: this.sender,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

 /**
 * Sends an email using the configured transporter.
 *
 * @param to - Recipient's email address
 * @param subject - Subject line of the email
 * @param text - Plain text version of the email content (for clients that don't support HTML)
 * @param html - HTML version of the email content
 * @throws InternalServerErrorException if the email fails to send
 */
    async sendMail(
    to: string,
    subject: string,
    text: string,
    html: string
    ): Promise<void> {
    const mailOptions: nodemailer.SendMailOptions = {
        from: this.sender,
        to,
        subject,
        text,
        html,
    };

    try {
        await this.transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending email:", error);
        throw new InternalServerErrorException("Failed to send email");
    }
    }

}

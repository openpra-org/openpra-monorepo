import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: "",
        pass: "",
      },
    });

    this.from = "";
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Password Reset Request',
        html: `
          <p>You requested a password reset. Click below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>This link will expire in 15 minutes.</p>
        `,
      });
    } catch (error) {
      console.error('[Mail Error]', error);
      throw new InternalServerErrorException('Failed to send reset email');
    }
  }
}

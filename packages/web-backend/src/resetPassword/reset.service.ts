import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { CollabService } from "../collab/collab.service";
import { ResetTokenService } from "./reset-token.service";
import { MailService } from "../mail/mail.service";

@Injectable()
export class ResetPasswordService {
  constructor(
    private readonly collabService: CollabService,
    private readonly resetTokenService: ResetTokenService,
    private readonly mailService: MailService
  ) {}

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.collabService.findUserByEmail(email);

    // Don't reveal whether user exists
    if (!user) return;

    const token = await this.resetTokenService.generateResetToken(email);
    const baseURL = process.env.BASE_URL ?? "http://localhost:4200";
    const resetLink = `${baseURL}/reset-password?token=${token}`;

    await this.mailService.sendPasswordResetEmail(email, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { email } = await this.resetTokenService.verifyResetToken(token);

    const user = await this.collabService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.collabService.updateUserPasswordByEmail(email, hashedPassword);
  }
}

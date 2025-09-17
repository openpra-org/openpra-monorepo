import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ThrottlerGuard } from "@nestjs/throttler";

import { PasswordResetService } from "./passwordreset.service";
import { MailerService } from "./mailer.service";

/**
 * Controller for handling password reset flow.
 */
@Controller()
export class PasswordResetController {
  private readonly FRONTEND_URL = "http://localhost:4200";

  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Renders the password reset request page (placeholder).
   */
  @Get()
  renderEmailRequestForm(): string {
    return `Password Reset Form`;
  }

  /**
   * Handles the password reset request: validates email, creates a reset token,
   * stores it, and sends an email with the reset link.
   *
   * @param email - The email of the user requesting password reset
   * @returns Always returns a generic success message for security reasons
   */
  @UseGuards(ThrottlerGuard)
  @Post()
  async validatePasswordResetRequest(@Body("email") email: string): Promise<{ message: string }> {
    console.log("Validating password reset request for:", email);

    const isValid = await this.passwordResetService.validateEmail(email);
    console.log("Email valid:", isValid);

    if (isValid) {
      const { status, token } = await this.passwordResetService.addPasswordResetEntry(email);
      if (status) {
        console.log("Password reset token created. Sending email...");
        const resetLink = `${process.env.BACKEND_URL}/api/password-reset/create-new-password/?token=${token}`;
        const text = `You requested a password reset. Click the link to reset your password: ${resetLink}`;
        const subject = "Password Reset Instructions";
        const html = `
        <p>Hello,</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>If you did not request this, you can ignore this email.</p>
        `;
        await this.mailerService.sendMail(email, subject, text, html);
      } else {
        console.error("Failed to store password reset token in DB");
      }
    } else {
      console.log("Email not found, but response is masked");
    }

    return {
      message: "If an account with that email exists, instructions have been sent.",
    };
  }

  /**
   * Validates the password reset token from the query and redirects user accordingly.
   *
   * @param token - Password reset token from query
   * @param res - Express response used for redirection
   */
  @Get("/create-new-password")
  async renderCreateNewPasswordForm(
    @Query("token") token: string,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.passwordResetService.getUserByToken(token);

    const successURL = `${this.FRONTEND_URL}/create-new-password?token=${encodeURIComponent(token)}`;
    const failureURL = `${this.FRONTEND_URL}/error`;

    console.log("Token verification:", user ? "Success" : "Failure");

    return res.redirect(user ? successURL : failureURL);
  }

  /**
   * Resets the user password using the token, and cleans up the reset entry. 
   * Sends a notification to the user about the reset.
   *
   * @param password - New password provided by user
   * @param token - Password reset token
   * @returns Confirmation message
   */
  @Post("/create-new-password")
  async createNewPassword(
    @Body("password") password: string,
    @Body("token") token: string,
  ): Promise<{ message: string }> {
    if (!token || !password) {
      throw new HttpException("Token and password are required", HttpStatus.BAD_REQUEST);
    }

    const user = await this.passwordResetService.getUserByToken(token);

    if (!user) {
      throw new HttpException("Invalid or expired token", HttpStatus.BAD_REQUEST);
    }

    const updated = await this.passwordResetService.updatePassword(user.email, password);
    if (!updated) {
      throw new HttpException("Failed to update password", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const deleted = await this.passwordResetService.deleteEntry(user.email);
    if (!deleted) {
      throw new HttpException("Failed to clean up password reset entry", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const subject = 'Password Reset Request Successful'
    const text = 'Your password has been successfully reset!'
    const html =         `<p>Hello,</p>
        <p>Your password has been reset.</p>
        <p>If you did not request this, please contact us immediately!.</p>
        `
    await this.mailerService.sendMail(user.email, subject, text, html);
    
    return {
      message: "Password reset successful, redirecting to login page",
    };
  }
}

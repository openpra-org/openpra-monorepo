import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { MailerService } from "@nestjs-modules/mailer";
import { CollabService } from "../collab/collab.service";
import { User } from "../collab/schemas/user.schema";
import { ResetPasswordDto } from "../collab/dtos/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly collabService: CollabService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * @param {string} username
   * @param {string} password
   * @description
   * 1. The Local Strategy (AuthGuard('local')) sends the User credentials to loginUser() method.
   * 2. The loginUser() method checks if the User exists in the database using the CollabService.loginUser() method.
   * 3. If the User exists, then the password is verified as well.
   * @returns A mongoose document of the user | 401 HTTP status
   */
  async loginUser(username: string, password: string): Promise<User> {
    const user = await this.collabService.loginUser(username);
    if (user) {
      const validUser = await argon2.verify(user.password, password);
      if (validUser) {
        return user;
      } else {
        throw new UnauthorizedException("Password does not match");
      }
    } else {
      throw new UnauthorizedException("User does not exist");
    }
  }

  /**
   * @param user User object extracted from the request headers
   * @description
   * 1. After the Local Strategy verifies the User credentials, the User object is sent to getJwtToken() method.
   * 2. The userID, username, and email is extracted from the User object. Then a JWT is generated against these data.
   * @returns JWT token
   */
  async getJwtToken(user: User) {
    const payload = {
      user_id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    };
    await this.collabService.updateLastLogin(user.id);
    return {
      token: this.jwtService.sign(payload),
    };
  }

  async updateJwtToken(refreshToken: string) {
    try {
      // Verify the refresh token
      const decodedToken = this.jwtService.verify(refreshToken);
      // Check if the token is valid and not expired
      if (decodedToken?.user_id) {
        // Create a new access token with a new expiration time (e.g., 15 minutes)
        const payload = {
          user_id: decodedToken.user_id,
          username: decodedToken.username,
          email: decodedToken.email,
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: "24h" });

        // You can also update the last login here if needed
        await this.collabService.updateLastLogin(decodedToken.user_id);

        return {
          token: accessToken,
        };
      } else {
        // Token is not valid or expired, handle the error
        throw new Error("Invalid or expired refresh token");
      }
    } catch (err) {
      // Handle verification or any other errors that may occur
      throw new Error("Error verifying the refresh token");
    }
  }

  /**
   * Simple function that checks if the password is correct or not (Used for verification purposes)
   * @param username - username of the user
   * @param password - password of the user
   */
  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.collabService.loginUser(username);
    try {
      await argon2.verify(user.password, password);
      return true;
    } catch (e) {
      return false;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.collabService.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const token = this.jwtService.sign({ email }, { expiresIn: "1h" });
    await this.collabService.saveForgotPasswordToken(user.id, token);

    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const resetLink = `http://localhost:4200/reset-password?token=${token}`;
    const htmlContent = `
      <html>
        <body>
          <h1>Password Reset</h1>
          <p>Hello,</p>
          <p>You have requested to reset your password. Please click the link below to reset your password:</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>If you did not request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        </body>
      </html>
    `;

    await this.mailerService.sendMail({
      to: email,
      subject: "Password Reset",
      html: htmlContent,
    });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;
    const decodedToken = this.jwtService.verify(token);
    const user = await this.collabService.getUserByEmail(decodedToken.email);

    if (!user || user.forgotPasswordToken !== token) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.collabService.updateUserPassword(user.id, hashedPassword);
    await this.collabService.clearForgotPasswordToken(user.id);
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const decodedToken = this.jwtService.verify(token);
      const user = await this.collabService.getUserByEmail(decodedToken.email);

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (user.forgotPasswordToken !== token) {
        throw new UnauthorizedException("Invalid token");
      }

      await this.collabService.verifyUserEmail(user.id);
    } catch (error) {
      if (error) {
        throw new UnauthorizedException("Invalid token");
      }
      throw error;
    }
  }
}

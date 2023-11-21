import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { CollabService } from "../collab/collab.service";
import { User } from "../collab/schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    private collabService: CollabService,
    private jwtService: JwtService,
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
  async getJwtToken(user: any) {
    const payload = {
      user_id: user.id,
      username: user.username,
      email: user.email,
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
      if (decodedToken && decodedToken.user_id) {
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
}

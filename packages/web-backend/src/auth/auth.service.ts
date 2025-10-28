import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { CollabService } from "../collab/collab.service";
import { User } from "../collab/schemas/user.schema";

/**
 * Service for user authentication and JWT token management.
 * Handles credential verification and token issuance/refresh.
 * @public
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly collabService: CollabService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticates a user by username and password.
   *
   * 1. The Local Strategy (AuthGuard('local')) sends the User credentials to loginUser() method.
   * 2. The loginUser() method checks if the User exists in the database using the CollabService.loginUser() method.
   * 3. If the User exists, then the password is verified as well.
   *
   * @param username - Username string
   * @param password - Password string
   * @returns A mongoose document of the user or throws 401 HTTP status
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
   * Generates a JWT token for the authenticated user.
   *
   * 1. After the Local Strategy verifies the User credentials, the User object is sent to getJwtToken() method.
   * 2. The userID, username, and email are extracted from the User object. Then a JWT is generated against these data.
   *
   * @param user - User object extracted from the request headers
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
      interface TokenPayload {
        user_id?: unknown;
        username?: unknown;
        email?: unknown;
      }
      const decodedToken = this.jwtService.verify<TokenPayload>(refreshToken);
      // Check if the token is valid and not expired
      const userId =
        typeof decodedToken?.user_id === "number" ? decodedToken.user_id
        : typeof decodedToken?.user_id === "string" ? Number(decodedToken.user_id)
        : undefined;
      if (typeof userId === "number" && Number.isFinite(userId)) {
        // Create a new access token with a new expiration time (e.g., 15 minutes)
        const payload = {
          user_id: userId,
          username: typeof decodedToken.username === "string" ? decodedToken.username : undefined,
          email: typeof decodedToken.email === "string" ? decodedToken.email : undefined,
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: "24h" });

        // You can also update the last login here if needed
        await this.collabService.updateLastLogin(userId);

        return {
          token: accessToken,
        };
      } else {
        // Token is not valid or expired, handle the error
        throw new Error("Invalid or expired refresh token");
      }
    } catch {
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
      const match = await argon2.verify(user.password, password);
      return match;
    } catch {
      return false;
    }
  }
}

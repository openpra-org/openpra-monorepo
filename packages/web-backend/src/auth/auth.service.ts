import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { CollabService } from "../collab/collab.service";
import { User } from "../collab/schemas/user.schema";
@Injectable()
export class AuthService {
  constructor(
    private readonly collabService: CollabService,
    private readonly jwtService: JwtService,
  ) {}
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
      interface TokenPayload {
        user_id?: unknown;
        username?: unknown;
        email?: unknown;
      }
      const decodedToken = this.jwtService.verify<TokenPayload>(refreshToken);
      const userId =
        typeof decodedToken?.user_id === "number" ? decodedToken.user_id
        : typeof decodedToken?.user_id === "string" ? Number(decodedToken.user_id)
        : undefined;
      if (typeof userId === "number" && Number.isFinite(userId)) {
        const payload = {
          user_id: userId,
          username: typeof decodedToken.username === "string" ? decodedToken.username : undefined,
          email: typeof decodedToken.email === "string" ? decodedToken.email : undefined,
        };
        const accessToken = this.jwtService.sign(payload, { expiresIn: "24h" });
        await this.collabService.updateLastLogin(userId);
        return {
          token: accessToken,
        };
      } else {
        throw new Error("Invalid or expired refresh token");
      }
    } catch {
      throw new Error("Error verifying the refresh token");
    }
  }
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

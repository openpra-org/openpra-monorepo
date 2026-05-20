import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "crypto";
import type {
  LoginRequest,
  LoginResponse,
  LoginTwoFactorRequest,
  SignupRequest,
  SignupResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from "interfaces-shared-types";
import { User, type UserDocument } from "../users/user.schema";
import { EmailService } from "./email.service";
import { TwoFactorService } from "./twoFactor.service";
import { OrgsService } from "../orgs/orgs.service";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const TFA_CHALLENGE_TTL = "5m";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly orgsService: OrgsService,
  ) {}

  async checkAvailability(username?: string, email?: string): Promise<{ usernameAvailable?: boolean; emailAvailable?: boolean }> {
    const out: { usernameAvailable?: boolean; emailAvailable?: boolean } = {};
    const trimmedUsername = username?.trim() ?? "";
    if (trimmedUsername.length > 0) {
      const existing = await this.userModel.findOne({ username: trimmedUsername }).lean();
      out.usernameAvailable = existing === null;
    }
    const trimmedEmail = email?.trim().toLowerCase() ?? "";
    if (trimmedEmail.length > 0) {
      const existing = await this.userModel.findOne({ email: trimmedEmail }).lean();
      out.emailAvailable = existing === null;
    }
    return out;
  }

  async signup(payload: SignupRequest): Promise<SignupResponse> {
    const email = payload.email.toLowerCase();
    const existing = await this.userModel
      .findOne({ $or: [{ username: payload.username }, { email }] })
      .lean();
    if (existing) {
      if (existing.username === payload.username) throw new ConflictException("Username already taken");
      throw new ConflictException("Email already registered");
    }
    const passwordHash = await argon2.hash(payload.password);
    const resolved = await this.orgsService.findOrCreate(payload.organization, payload.username);
    const created = await this.userModel.create({
      username: payload.username,
      email,
      fullName: payload.fullName,
      organization: resolved?.name ?? "",
      organizationId: resolved?.id ?? null,
      passwordHash,
      roles: ["member-role"],
    });
    return {
      id: String(created._id),
      username: created.username,
      email: created.email,
    };
  }

  async login(payload: LoginRequest): Promise<LoginResponse> {
    const identifier = payload.identifier.toLowerCase();
    const user = await this.userModel.findOne({
      $or: [{ username: payload.identifier }, { email: identifier }],
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const valid = await argon2.verify(user.passwordHash, payload.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");
    if (user.twoFactor?.enabled) {
      const challengeToken = await this.jwtService.signAsync(
        { sub: String(user._id), tfaPending: true },
        { expiresIn: TFA_CHALLENGE_TTL },
      );
      return { twoFactorRequired: true, challengeToken };
    }
    const token = await this.signToken(user);
    return { token };
  }

  async loginTwoFactor(payload: LoginTwoFactorRequest): Promise<LoginResponse> {
    let claims: { sub: string; tfaPending?: boolean };
    try {
      claims = await this.jwtService.verifyAsync(payload.challengeToken);
    } catch {
      throw new UnauthorizedException("Two-factor session expired, sign in again");
    }
    if (claims.tfaPending !== true) throw new UnauthorizedException("Invalid two-factor session");
    const user = await this.userModel.findById(claims.sub);
    if (!user || !user.twoFactor?.enabled || user.twoFactor.secret === null) {
      throw new UnauthorizedException("Invalid two-factor session");
    }
    const secret = this.twoFactorService.decrypt(user.twoFactor.secret);
    let ok = await this.twoFactorService.verifyTotp(secret, payload.code);
    if (!ok) {
      const index = await this.twoFactorService.findBackupCodeIndex(user.twoFactor.backupCodes, payload.code);
      if (index >= 0) {
        ok = true;
        user.twoFactor.backupCodes.splice(index, 1);
        user.markModified("twoFactor");
        await user.save();
      }
    }
    if (!ok) throw new UnauthorizedException("Invalid authentication code");
    const token = await this.signToken(user);
    return { token };
  }

  private async signToken(user: UserDocument): Promise<string> {
    return this.jwtService.signAsync({
      sub: String(user._id),
      username: user.username,
      email: user.email,
      roles: user.roles,
    });
  }

  async forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const identifier = payload.identifier.toLowerCase();
    const user = await this.userModel.findOne({
      $or: [{ username: payload.identifier }, { email: identifier }],
    });
    if (user) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      user.resetTokenHash = tokenHash;
      user.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      const baseUrl = process.env["APP_BASE_URL"] ?? "http://localhost:4201";
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      void this.emailService.sendPasswordResetEmail(user.email, resetUrl);
    }
    return { detail: "If the account exists, a reset link has been sent." };
  }

  async resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const tokenHash = createHash("sha256").update(payload.token).digest("hex");
    const user = await this.userModel.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) throw new UnauthorizedException("Reset link is invalid or has expired");
    user.passwordHash = await argon2.hash(payload.newPassword);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();
    return { detail: "Password updated successfully." };
  }
}

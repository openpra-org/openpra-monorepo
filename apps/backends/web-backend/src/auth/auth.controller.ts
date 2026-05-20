import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  type AvailabilityResponse,
  type LoginRequest,
  type LoginResponse,
  type LoginTwoFactorRequest,
  type SignupRequest,
  type SignupResponse,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  LoginRequestSchema,
  LoginTwoFactorRequestSchema,
  SignupRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { AuthService, type OAuthResult } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signup(@Body(new ZodValidationPipe(SignupRequestSchema)) body: SignupRequest): Promise<SignupResponse> {
    return this.authService.signup(body);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  @Post("login/2fa")
  @HttpCode(HttpStatus.OK)
  loginTwoFactor(
    @Body(new ZodValidationPipe(LoginTwoFactorRequestSchema)) body: LoginTwoFactorRequest,
  ): Promise<LoginResponse> {
    return this.authService.loginTwoFactor(body);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) body: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(body);
  }

  @Get("availability")
  @HttpCode(HttpStatus.OK)
  availability(
    @Query("username") username?: string,
    @Query("email") email?: string,
  ): Promise<AvailabilityResponse> {
    return this.authService.checkAvailability(username, email);
  }

  @Get("oauth/:provider/start")
  async oauthStart(
    @Param("provider") provider: string,
    @Res() res: Response,
    @Query("intent") intent?: string,
    @Query("token") token?: string,
  ): Promise<void> {
    try {
      const url = await this.authService.oauthStart(provider, intent ?? "login", token);
      res.redirect(url);
    } catch {
      res.redirect(`${this.frontendBase()}/oauth/callback#error=provider_unavailable&provider=${encodeURIComponent(provider)}`);
    }
  }

  @Get("oauth/:provider/callback")
  async oauthCallback(
    @Param("provider") provider: string,
    @Res() res: Response,
    @Query("code") code?: string,
    @Query("state") state?: string,
  ): Promise<void> {
    const base = this.frontendBase();
    if (code === undefined || state === undefined) {
      res.redirect(`${base}/oauth/callback#error=oauth_failed`);
      return;
    }
    try {
      const result = await this.authService.oauthCallback(provider, code, state);
      res.redirect(`${base}/oauth/callback#${this.resultFragment(result, provider)}`);
    } catch {
      res.redirect(`${base}/oauth/callback#error=oauth_failed`);
    }
  }

  private frontendBase(): string {
    return process.env["APP_BASE_URL"] ?? "http://localhost:4201";
  }

  private resultFragment(result: OAuthResult, provider: string): string {
    if (result.kind === "token") return `token=${encodeURIComponent(result.token)}`;
    if (result.kind === "twofa") return `challenge=${encodeURIComponent(result.challengeToken)}`;
    if (result.kind === "linked") return `linked=${encodeURIComponent(result.provider)}`;
    return `error=${encodeURIComponent(result.error)}&provider=${encodeURIComponent(provider)}`;
  }
}

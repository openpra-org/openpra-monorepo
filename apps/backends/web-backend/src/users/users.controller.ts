import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from "@nestjs/common";
import {
  type ChangeEmailRequest,
  type ChangeEmailResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type ChangeUsernameRequest,
  type ChangeUsernameResponse,
  type MyProfileResponse,
  type NotificationPrefs,
  type UpdateNotificationPrefsRequest,
  type UpdateUserProfileRequest,
  ChangeEmailRequestSchema,
  ChangePasswordRequestSchema,
  ChangeUsernameRequestSchema,
  UpdateNotificationPrefsRequestSchema,
  UpdateUserProfileRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: AuthenticatedRequest): Promise<MyProfileResponse> {
    const username = req.user!.username;
    const [profile, projectCount] = await Promise.all([
      this.usersService.getMyProfile(username),
      this.usersService.getMyProjectCount(username),
    ]);
    return { profile, projectCount };
  }

  @Patch("me")
  @HttpCode(HttpStatus.OK)
  async patchMe(
    @Body(new ZodValidationPipe(UpdateUserProfileRequestSchema)) body: UpdateUserProfileRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<MyProfileResponse> {
    const username = req.user!.username;
    const profile = await this.usersService.updateMyProfile(username, body);
    const projectCount = await this.usersService.getMyProjectCount(username);
    return { profile, projectCount };
  }

  @Patch("me/email")
  @HttpCode(HttpStatus.OK)
  changeEmail(
    @Body(new ZodValidationPipe(ChangeEmailRequestSchema)) body: ChangeEmailRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChangeEmailResponse> {
    return this.usersService.changeEmail(req.user!.username, body);
  }

  @Patch("me/username")
  @HttpCode(HttpStatus.OK)
  changeUsername(
    @Body(new ZodValidationPipe(ChangeUsernameRequestSchema)) body: ChangeUsernameRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChangeUsernameResponse> {
    return this.usersService.changeUsername(req.user!.username, body);
  }

  @Patch("me/password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChangePasswordResponse> {
    await this.usersService.changePassword(req.user!.username, body);
    return { detail: "Password updated" };
  }

  @Get("me/prefs/notifications")
  @HttpCode(HttpStatus.OK)
  getNotificationPrefs(@Req() req: AuthenticatedRequest): Promise<NotificationPrefs> {
    return this.usersService.getNotificationPrefs(req.user!.username);
  }

  @Patch("me/prefs/notifications")
  @HttpCode(HttpStatus.OK)
  updateNotificationPrefs(
    @Body(new ZodValidationPipe(UpdateNotificationPrefsRequestSchema)) body: UpdateNotificationPrefsRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationPrefs> {
    return this.usersService.updateNotificationPrefs(req.user!.username, body);
  }

  @Delete("me")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema.pick({ currentPassword: true }))) body: { currentPassword: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.usersService.deleteMyAccount(req.user!.username, body.currentPassword);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import {
  type ChangeEmailRequest,
  type ChangeEmailResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type ChangeUsernameRequest,
  type ChangeUsernameResponse,
  type MyProfileResponse,
  type NotificationPrefs,
  type PublicUserProfile,
  type SessionListResponse,
  type TwoFactorDisableRequest,
  type TwoFactorDisableResponse,
  type TwoFactorEnableRequest,
  type TwoFactorEnableResponse,
  type TwoFactorSetupResponse,
  type UpdateNotificationPrefsRequest,
  type UpdateUserProfileRequest,
  type UserProfile,
  type UserSearchResponse,
  ChangeEmailRequestSchema,
  ChangePasswordRequestSchema,
  ChangeUsernameRequestSchema,
  TwoFactorDisableRequestSchema,
  TwoFactorEnableRequestSchema,
  UpdateNotificationPrefsRequestSchema,
  UpdateUserProfileRequestSchema,
} from "interfaces-shared-types";
import { ZodValidationPipe } from "../pipe/zod-validation.pipe";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";
import { SessionsService } from "../sessions/sessions.service";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const COVER_MAX_BYTES = 10 * 1024 * 1024;

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {}

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

  @Get("search")
  @HttpCode(HttpStatus.OK)
  search(@Req() req: AuthenticatedRequest, @Query("q") q?: string): Promise<UserSearchResponse> {
    return this.usersService.searchUsers(q ?? "", req.user!.username);
  }

  @Get(":username")
  @HttpCode(HttpStatus.OK)
  getPublic(@Param("username") username: string): Promise<PublicUserProfile> {
    return this.usersService.getPublicProfile(username);
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
    return this.usersService.changeEmail(req.user!.username, body, req.user!.jti);
  }

  @Patch("me/username")
  @HttpCode(HttpStatus.OK)
  changeUsername(
    @Body(new ZodValidationPipe(ChangeUsernameRequestSchema)) body: ChangeUsernameRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChangeUsernameResponse> {
    return this.usersService.changeUsername(req.user!.username, body, req.user!.jti);
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

  @Post("me/2fa/setup")
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(@Req() req: AuthenticatedRequest): Promise<TwoFactorSetupResponse> {
    return this.usersService.beginTwoFactorSetup(req.user!.username);
  }

  @Post("me/2fa/enable")
  @HttpCode(HttpStatus.OK)
  enableTwoFactor(
    @Body(new ZodValidationPipe(TwoFactorEnableRequestSchema)) body: TwoFactorEnableRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<TwoFactorEnableResponse> {
    return this.usersService.enableTwoFactor(req.user!.username, body.code);
  }

  @Post("me/2fa/disable")
  @HttpCode(HttpStatus.OK)
  disableTwoFactor(
    @Body(new ZodValidationPipe(TwoFactorDisableRequestSchema)) body: TwoFactorDisableRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<TwoFactorDisableResponse> {
    return this.usersService.disableTwoFactor(req.user!.username, body.code);
  }

  @Delete("me/connections/:provider")
  @HttpCode(HttpStatus.OK)
  disconnectProvider(
    @Param("provider") provider: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserProfile> {
    return this.usersService.disconnectProvider(req.user!.username, provider);
  }

  @Get("me/export")
  async exportData(@Req() req: AuthenticatedRequest, @Res() res: Response): Promise<void> {
    const username = req.user!.username;
    const data = await this.usersService.exportMyData(username);
    const filename = `openpra-export-${username}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Get("me/sessions")
  @HttpCode(HttpStatus.OK)
  async listSessions(@Req() req: AuthenticatedRequest): Promise<SessionListResponse> {
    const sessions = await this.sessionsService.listForUser(req.user!.sub, req.user!.jti);
    return { sessions };
  }

  @Delete("me/sessions/:id")
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param("id") id: string, @Req() req: AuthenticatedRequest): Promise<SessionListResponse> {
    await this.sessionsService.revokeOne(req.user!.sub, id);
    const sessions = await this.sessionsService.listForUser(req.user!.sub, req.user!.jti);
    return { sessions };
  }

  @Delete("me/sessions")
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(@Req() req: AuthenticatedRequest): Promise<SessionListResponse> {
    await this.sessionsService.revokeOthers(req.user!.sub, req.user!.jti);
    const sessions = await this.sessionsService.listForUser(req.user!.sub, req.user!.jti);
    return { sessions };
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

  @Post("me/avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: AVATAR_MAX_BYTES },
  }))
  async uploadAvatar(
    @UploadedFile() file: UploadedImage | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserProfile> {
    if (file === undefined) throw new BadRequestException("Expected a 'file' field in multipart body");
    return this.usersService.setAvatar(req.user!.username, file);
  }

  @Delete("me/avatar")
  @HttpCode(HttpStatus.OK)
  async deleteAvatar(@Req() req: AuthenticatedRequest): Promise<UserProfile> {
    return this.usersService.clearAvatar(req.user!.username);
  }

  @Post("me/cover")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: COVER_MAX_BYTES },
  }))
  async uploadCover(
    @UploadedFile() file: UploadedImage | undefined,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserProfile> {
    if (file === undefined) throw new BadRequestException("Expected a 'file' field in multipart body");
    return this.usersService.setCover(req.user!.username, file);
  }

  @Delete("me/cover")
  @HttpCode(HttpStatus.OK)
  async deleteCover(@Req() req: AuthenticatedRequest): Promise<UserProfile> {
    return this.usersService.clearCover(req.user!.username);
  }
}

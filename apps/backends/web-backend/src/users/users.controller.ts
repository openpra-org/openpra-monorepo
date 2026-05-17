import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from "@nestjs/common";
import {
  type MyProfileResponse,
  type UpdateUserProfileRequest,
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
}

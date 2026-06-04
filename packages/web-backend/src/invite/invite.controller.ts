import {
  HttpStatus,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Delete,
  UseFilters,
  UseGuards,
  HttpException,
} from "@nestjs/common";
import { InvitedUserDetailsDto, InvitedUserDto, InviteIdDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { InvalidTokenFilter } from "../filters/invalid-token.filter";
import { InviteService } from "./invite.service";
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}
  @Post("/invite/")
  async generateInvitationLink(
    @Body()
    body: InvitedUserDto,
  ): Promise<InviteIdDto> {
    const invitedUser = await this.inviteService.generateUserInvite(body);
    return { id: invitedUser.id };
  }
  @Put("/invite/")
  async updateInvite(
    @Body()
    body: InvitedUserDetailsDto,
  ): Promise<InvitedUserDto> {
    return this.inviteService.updateInvite(body);
  }
  @Public()
  @Post("/verify-invite/")
  async verifyInvitationLink(
    @Body()
    body: InviteIdDto,
  ): Promise<InvitedUserDto> {
    const invitedUser = await this.inviteService.verifyUserInvite(body.id);
    if (invitedUser === null) {
      throw new HttpException("Invite id either invalid or expired", HttpStatus.GONE);
    }
    return {
      email: invitedUser.email,
      username: invitedUser.username,
      firstname: invitedUser.firstName,
      lastname: invitedUser.lastName,
    };
  }
  @Get("/invites/")
  async getAllInvites(): Promise<InvitedUserDetailsDto[]> {
    return this.inviteService.getAllInvitedUsers();
  }
  @Delete("/invite/:id")
  async deleteInvite(
    @Param("id")
    id: string,
  ): Promise<boolean> {
    return this.inviteService.deleteInviteById(id);
  }
  @Get("/invite/:id")
  async getInvite(
    @Param("id")
    id: string,
  ): Promise<InvitedUserDetailsDto> {
    return this.inviteService.getInviteById(id);
  }
}

import { Controller, HttpStatus, UseGuards, HttpException } from "@nestjs/common";
import {
  InvitedUserDetailsDto,
  InvitedUserDto,
  InviteIdDto,
} from "packages/shared-types/src/lib/types/userInvites/InvitedUser";
import { TypedBody, TypedParam, TypedRoute } from "@nestia/core";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { Public } from "../guards/public.guard";
import { InviteService } from "./invite.service";
import { InvitedUser } from "./schemas/invite.schema";

@Controller()
@UseGuards(JwtAuthGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  /**
   * This endpoint will generate an invitation id for a user
   * @param body - The InvitedUserDto object
   * @example - Sample Request body
   * {
   *   "firstname" : "xyz"
   *   "lastname" : "abc"
   *   "email" : "abcxyz@gmail.com"
   *   "username" : "xyzabc"
   * }
   */
  @TypedRoute.Post("/invite/")
  public async generateInvitationLink(@TypedBody() body: InvitedUserDto): Promise<InviteIdDto> {
    const invitedUser = await this.inviteService.generateUserInvite(body);
    return { id: invitedUser.id };
  }

  /**
   * This endpoint will update an invite
   * @param body - InvitedUserDetailsDto object
   */
  @TypedRoute.Put("/invite/")
  public async updateInvite(@TypedBody() body: InvitedUserDetailsDto): Promise<InvitedUser | null> {
    return this.inviteService.updateInvite(body);
  }

  /**
   * This public endpoint will check if an invite id is correct and not expired.
   * @returns - InvitedUserDto object or null
   * @param body - InviteIDDto object
   * @example - Sample Request
   * {
   *   "id" : "abcde-fghij-klmnon-asdnj"
   * }
   */
  @Public()
  @TypedRoute.Post("/verify-invite/")
  public async verifyInvitationLink(@TypedBody() body: InviteIdDto): Promise<InvitedUserDto> {
    const invitedUser = await this.inviteService.verifyUserInvite(String(body.id));
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

  /**
   * This endpoint will return all the invites that were generated
   */
  @TypedRoute.Get("/invites/")
  public async getAllInvites(): Promise<InvitedUserDetailsDto[]> {
    return this.inviteService.getAllInvitedUsers();
  }

  /**
   * This endpoint will delete invitedUser by id
   */
  @TypedRoute.Delete("/invite/:id")
  public async deleteInvite(@TypedParam("id") id: string): Promise<boolean> {
    return this.inviteService.deleteInviteById(id);
  }

  /**
   * This endpoint will get invitedUser by id
   */
  @TypedRoute.Get("/invite/:id")
  public async getInvite(@TypedParam("id") id: string): Promise<InvitedUserDetailsDto | null> {
    return this.inviteService.getInviteById(id);
  }
}

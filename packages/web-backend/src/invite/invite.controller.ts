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
} from '@nestjs/common';
import {
  InvitedUserDetailsDto,
  InvitedUserDto,
  InviteIdDto,
} from 'shared-types/src/lib/types/userInvites/InvitedUser';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../guards/public.guard';
import { InvalidTokenFilter } from '../filters/invalid-token.filter';
import { InviteService } from './invite.service';

/**
 * Controller for user invitation management.
 * Exposes endpoints to create, verify, update, fetch and delete invites.
 * @public
 */
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(InvalidTokenFilter)
export class InviteController {
  /**
   * Construct the controller with the invite service dependency.
   * @param inviteService - Service that manages invite persistence and validation.
   */
  constructor(private readonly inviteService: InviteService) {}

  /**
   * This endpoint will generate an invitation id for a user
   * @param body - The InvitedUserDto object
   * @returns An object containing the generated invite id.
   * @example - Sample request body
   * ```json
   * {
   *   "firstname": "xyz",
   *   "lastname": "abc",
   *   "email": "abcxyz\@gmail.com",
   *   "username": "xyzabc"
   * }
   * ```
   */
  @Post('/invite/')
  async generateInvitationLink(
    @Body() body: InvitedUserDto,
  ): Promise<InviteIdDto> {
    const invitedUser = await this.inviteService.generateUserInvite(body);
    return { id: invitedUser.id };
  }

  /**
   * This endpoint will update an invite
   * @param body - InvitedUserDetailsDto object
   * @returns The updated invite payload.
   */
  @Put('/invite/')
  async updateInvite(
    @Body() body: InvitedUserDetailsDto,
  ): Promise<InvitedUserDto> {
    return this.inviteService.updateInvite(body);
  }

  /**
   * This public endpoint will check if an invite id is correct and not expired.
   * @returns - InvitedUserDto object or throws when invalid/expired.
   * @param body - InviteIDDto object
   * @example - Sample request
   * ```json
   * {
   *   "id": "abcde-fghij-klmnon-asdnj"
   * }
   * ```
   */
  @Public()
  @Post('/verify-invite/')
  async verifyInvitationLink(
    @Body() body: InviteIdDto,
  ): Promise<InvitedUserDto> {
    const invitedUser = await this.inviteService.verifyUserInvite(body.id);
    if (invitedUser === null) {
      throw new HttpException(
        'Invite id either invalid or expired',
        HttpStatus.GONE,
      );
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
   * @returns An array of invite details.
   */
  @Get('/invites/')
  async getAllInvites(): Promise<InvitedUserDetailsDto[]> {
    return this.inviteService.getAllInvitedUsers();
  }

  /**
   * This endpoint will delete invitedUser by id
   * @param id - The invite id to delete.
   * @returns true when deleted successfully; false otherwise.
   */
  @Delete('/invite/:id')
  async deleteInvite(@Param('id') id: string): Promise<boolean> {
    return this.inviteService.deleteInviteById(id);
  }

  /**
   * This endpoint will get invitedUser by id
   * @param id - The invite id to fetch.
   * @returns The invited user details when found.
   */
  @Get('/invite/:id')
  async getInvite(@Param('id') id: string): Promise<InvitedUserDetailsDto> {
    return this.inviteService.getInviteById(id);
  }
}

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InvitedUserDetailsDto, InvitedUserDto } from "shared-types/src/lib/types/userInvites/InvitedUser";

import { InvitedUser, InvitedUserDocument } from "./schemas/invite.schema";

/**
 * Service for managing user invitations.
 * Persists invites, verifies validity, and supports CRUD.
 * @public
 */
@Injectable()
export class InviteService {
  /**
   * Instantiate the invite service.
   *
   * @param invitedUserModel - Mongoose model for `InvitedUser` documents.
   */
  constructor(
    @InjectModel(InvitedUser.name)
    private readonly invitedUserModel: Model<InvitedUserDocument>,
  ) {}

  /**
   * This function will generate a new user invite and save in database
   * @param body - InvitedUserDto object
   * @example - InvitedUserDto object:
   *\{
   *   firstname: "xyzabc",
   *   lastname: "lkjhg",
   *   username: "sampleusername",
   *   email: "sampleemail\@gmail.com",
   * \}
   */
  async generateUserInvite(body: InvitedUserDto): Promise<InvitedUser> {
    const newInvitedUser: InvitedUserDocument = new this.invitedUserModel();
    newInvitedUser.id = crypto.randomUUID();
    newInvitedUser.email = body.email;
    newInvitedUser.username = body.username;
    newInvitedUser.firstName = body.firstname;
    newInvitedUser.lastName = body.lastname;
    newInvitedUser.expiry = body.expiry;
    newInvitedUser.numberOfInvites = body.numberOfInvites;
    return newInvitedUser.save();
  }

  /**
   * This function will check if an invited user is valid or not
   * @param guid - The guid of the invited user
   * @returns InvitedUser | null - If the guid is valid and not expired will return InvitedUser object else returns null
   */
  async verifyUserInvite(guid: string): Promise<InvitedUser | null> {
    const invitedUser = await this.invitedUserModel.findOne({ id: guid });
    if (invitedUser === null) {
      return null;
    }
    if (new Date() > invitedUser.expiry || invitedUser.numberOfInvites < 1) {
      await this.invitedUserModel.findOneAndDelete({ id: guid });
      return null;
    }
    return invitedUser;
  }

  /**
   * A function to decrement invite count and return the invited user
   * @param user - The InvitedUserDetailsDto object for update
   */
  async updateInvite(user: InvitedUserDetailsDto): Promise<InvitedUser | null> {
    const updatedUser: InvitedUser = {
      id: user.id,
      numberOfInvites: user.numberOfInvites,
      email: user.email,
      expiry: user.expiry,
      firstName: user.firstname,
      lastName: user.lastname,
      username: user.username,
    };
    return this.invitedUserModel.findOneAndUpdate({ id: updatedUser.id }, updatedUser, { new: true });
  }

  /**
   * This function will return all invited users
   */
  async getAllInvitedUsers(): Promise<InvitedUserDetailsDto[]> {
    const invitedUsers: InvitedUser[] = (await this.invitedUserModel.find()) as unknown as InvitedUser[];
    const mappedUsers: InvitedUserDetailsDto[] = invitedUsers.map((x: InvitedUser) => ({
      id: x.id,
      username: x.username,
      email: x.email,
      firstName: x.firstName,
      lastname: x.lastName,
      expiry: x.expiry,
      numberOfInvites: x.numberOfInvites,
    }));
    return mappedUsers;
  }

  /**
   * Delete a user invite by id
   * @param id - Id of the invited user
   */
  async deleteInviteById(id: string): Promise<boolean> {
    const invitedUser = await this.invitedUserModel.findOne({ id: id });
    if (invitedUser === null) {
      return false;
    }
    await this.invitedUserModel.deleteOne({ id: id });
    return true;
  }

  /**
   * Get a user invite by id
   * @param id - Id of the invited user
   */
  async getInviteById(id: string): Promise<InvitedUserDetailsDto> {
    return this.invitedUserModel.findOne({ id: id });
  }
}

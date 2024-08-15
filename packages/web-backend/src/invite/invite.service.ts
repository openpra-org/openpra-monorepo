import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InvitedUserDetailsDto, InvitedUserDto } from "packages/shared-types/src/lib/types/userInvites/InvitedUser";
import { InvitedUser, InvitedUserDocument } from "./schemas/invite.schema";

@Injectable()
export class InviteService {
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
  public async generateUserInvite(body: InvitedUserDto): Promise<InvitedUser> {
    const newInvitedUser: InvitedUserDocument = new this.invitedUserModel();
    newInvitedUser.id = crypto.randomUUID();
    newInvitedUser.email = String(body.email);
    newInvitedUser.username = String(body.username);
    newInvitedUser.firstName = String(body.firstname);
    newInvitedUser.lastName = String(body.lastname);
    newInvitedUser.expiry = body.expiry;
    newInvitedUser.numberOfInvites = Number(body.numberOfInvites);
    return newInvitedUser.save();
  }

  /**
   * This function will check if an invited user is valid or not
   * @param guid - The guid of the invited user
   * @returns InvitedUser | null - If the guid is valid and not expired will return InvitedUser object else returns null
   */
  public async verifyUserInvite(guid: string): Promise<InvitedUser | null> {
    const invitedUser = await this.invitedUserModel.findOne({ id: guid });
    if (!invitedUser || !invitedUser.expiry || !invitedUser.numberOfInvites) {
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
  public async updateInvite(user: InvitedUserDetailsDto): Promise<InvitedUser | null> {
    const updatedUser: InvitedUser = {
      id: String(user.id),
      numberOfInvites: Number(user.numberOfInvites),
      email: String(user.email),
      expiry: user.expiry,
      firstName: String(user.firstname),
      lastName: String(user.lastname),
      username: String(user.username),
    };
    return this.invitedUserModel.findOneAndUpdate({ id: updatedUser.id }, updatedUser, { new: true });
  }

  /**
   * This function will return all invited users
   */
  public async getAllInvitedUsers(): Promise<InvitedUserDetailsDto[]> {
    const invitedUsers = await this.invitedUserModel.find();
    return invitedUsers.map((x) => ({
      id: String(x.id),
      username: x.username,
      email: x.email,
      firstName: x.firstName,
      lastname: x.lastName,
      expiry: x.expiry,
      numberOfInvites: x.numberOfInvites,
    }));
  }

  /**
   * Delete a user invite by id
   * @param id - Id of the invited user
   */
  public async deleteInviteById(id: string): Promise<boolean> {
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
  public async getInviteById(id: string): Promise<InvitedUserDetailsDto | null> {
    return this.invitedUserModel.findOne({ id: id });
  }
}

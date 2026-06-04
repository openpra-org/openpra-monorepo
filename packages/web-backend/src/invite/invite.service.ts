import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InvitedUserDetailsDto, InvitedUserDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { InvitedUser, InvitedUserDocument } from "./schemas/invite.schema";
@Injectable()
export class InviteService {
  constructor(
    @InjectModel(InvitedUser.name)
    private readonly invitedUserModel: Model<InvitedUserDocument>,
  ) {}
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
  async deleteInviteById(id: string): Promise<boolean> {
    const invitedUser = await this.invitedUserModel.findOne({ id: id });
    if (invitedUser === null) {
      return false;
    }
    await this.invitedUserModel.deleteOne({ id: id });
    return true;
  }
  async getInviteById(id: string): Promise<InvitedUserDetailsDto> {
    return this.invitedUserModel.findOne({ id: id });
  }
}

import { ApiManager } from "../ApiManager";
import { InvitedUserDetailsDto, InvitedUserDto } from "shared-types/src/lib/types/userInvites/InvitedUser";
import { SignUpProps } from "../AuthTypes";
const ApiEndpoint = "/api";
const InviteEndpoint = `${ApiEndpoint}/invite-user`;
export class UserInviteApi {
  static inviteUser(userData: SignUpProps, expiry: number, numberOfInvites: number): Promise<Response> {
    const invitedUserDto: InvitedUserDto = {
      firstname: userData.firstName,
      lastname: userData.lastName,
      username: userData.username,
      email: userData.email,
      expiry: new Date(new Date().getTime() + expiry),
      numberOfInvites: numberOfInvites,
    };
    return ApiManager.post(`${InviteEndpoint}/invite`, JSON.stringify(invitedUserDto));
  }
  static verifyInvite(inviteId: string): Promise<Response> {
    return ApiManager.post(`${InviteEndpoint}/verify-invite`, JSON.stringify({ id: inviteId }));
  }
  static getAllInvites(): Promise<Response> {
    return ApiManager.getWithOptions(`${InviteEndpoint}/invites/`);
  }
  static deleteInviteById(id: string): Promise<Response> {
    return ApiManager.delete(`${InviteEndpoint}/invite/${id}`);
  }
  static async updateInvite(id: string): Promise<Response> {
    const result = await ApiManager.getWithOptions(`${InviteEndpoint}/invite/${id}`);
    const userToUpdate: InvitedUserDetailsDto = (await result.json()) as InvitedUserDetailsDto;
    if (userToUpdate.numberOfInvites) {
      userToUpdate.numberOfInvites -= 1;
      if (userToUpdate.numberOfInvites === 0) {
        return this.deleteInviteById(id);
      }
    }
    return ApiManager.put(`${InviteEndpoint}/invite/`, JSON.stringify(userToUpdate));
  }
}

import ApiManager from "../ApiManager";
import {
  InvitedUserDetailsDto,
  InvitedUserDto,
} from "../../types/userInvites/InvitedUser";
import { SignUpProps } from "../AuthTypes";

const ApiEndpoint = "/api";
const InviteEndpoint = `${ApiEndpoint}/invite-user`;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class UserInviteApi {
  /**
   * This function calls the backend api to invite a user
   * @param userData - SignUpProps for the user to invite
   * @param expiry - The number of milliseconds after which invite expires
   * @param numberOfInvites - The total number of invites
   */
  static inviteUser(
    userData: SignUpProps,
    expiry: number,
    numberOfInvites: number,
  ): Promise<Response> {
    const invitedUserDto: InvitedUserDto = {
      firstname: userData.firstName,
      lastname: userData.lastName,
      username: userData.username,
      email: userData.email,
      expiry: new Date(new Date().getTime() + expiry),
      numberOfInvites: numberOfInvites,
    };
    return ApiManager.post(
      `${InviteEndpoint}/invite`,
      JSON.stringify(invitedUserDto),
    );
  }

  /**
   * Verifies weather an invite id is valid or not
   * @param inviteId - The invite id to validate
   * @returns Response - The response object will contain the user object
   */
  static verifyInvite(inviteId: string): Promise<Response> {
    return ApiManager.post(
      `${InviteEndpoint}/verify-invite`,
      JSON.stringify({ id: inviteId }),
    );
  }

  /**
   * Gets all the invited user
   * @returns Response
   */
  static getAllInvites(): Promise<Response> {
    return ApiManager.getWithOptions(`${InviteEndpoint}/invites/`);
  }

  /**
   * Delete an invited user by id
   * @param id - The id of the invite
   */
  static deleteInviteById(id: string): Promise<Response> {
    return ApiManager.delete(`${InviteEndpoint}/invite/${id}`);
  }

  /**
   *
   * @param id - Id of the user whose count to decrement
   */
  static async updateInvite(id: string): Promise<Response> {
    const result = await ApiManager.getWithOptions(
      `${InviteEndpoint}/invite/${id}`,
    );
    const userToUpdate: InvitedUserDetailsDto =
      (await result.json()) as InvitedUserDetailsDto;
    if (userToUpdate.numberOfInvites) {
      userToUpdate.numberOfInvites -= 1;
      if (userToUpdate.numberOfInvites === 0) {
        return this.deleteInviteById(id);
      }
    }
    return ApiManager.put(
      `${InviteEndpoint}/invite/`,
      JSON.stringify(userToUpdate),
    );
  }
}

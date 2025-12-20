/**
 * Payload for creating or updating an invited user.
 */
class InvitedUserDto {
  /** Optional first name of the invitee */
  firstname?: string;
  /** Optional last name of the invitee */
  lastname?: string;
  /** Desired username for the invitee */
  username?: string;
  /** Email address to send the invitation to */
  email?: string;
  /** Number of invitations this user can issue (if applicable) */
  numberOfInvites?: number;
  /** Optional expiration date of the invitation */
  expiry?: Date;
}

/**
 * Additional fields returned when looking up an invitation.
 */
class InvitedUserDetail {
  /** Invitation identifier */
  id?: string;
  /** Invitation expiration date */
  expiryDate?: Date;
}

/**
 * DTO carrying only an invitation id.
 */
class InviteIdDto {
  /** Invitation identifier */
  id?: string;
}

/**
 * Combined DTO representing all invite fields available to clients.
 */
type InvitedUserDetailsDto = InvitedUserDto & InvitedUserDetail;

export { InvitedUserDto, InviteIdDto, InvitedUserDetailsDto };

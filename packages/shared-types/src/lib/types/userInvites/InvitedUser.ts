class InvitedUserDto {
  firstname?: string;
  lastname?: string;
  username?: string;
  email?: string;
  numberOfInvites?: number;
  expiry?: Date;
}

class InvitedUserDetail {
  id?: string;
  expiryDate?: Date;
}

class InviteIdDto {
  id?: string;
}

type InvitedUserDetailsDto = InvitedUserDto & InvitedUserDetail;

export { InvitedUserDto, InviteIdDto, InvitedUserDetailsDto };

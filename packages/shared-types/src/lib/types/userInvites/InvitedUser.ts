export class InvitedUserDto {
  firstname?: string;
  lastname?: string;
  username?: string;
  email?: string;
  numberOfInvites?: number;
  expiry?: Date;
}

export class InvitedUserDetail {
  id?: string;
  expiryDate?: Date;
}

export class InviteIdDto {
  id?: string;
}

export type InvitedUserDetailsDto = InvitedUserDto & InvitedUserDetail;

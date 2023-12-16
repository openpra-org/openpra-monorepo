import { JwtPayload } from "jwt-decode";

export type AuthTokenAdditionals = {
  user_id?: number;
  username?: string;
  email?: string;
  orig_iat?: number;
};

type AuthToken = JwtPayload & AuthTokenAdditionals;

export const EMPTY_TOKEN: AuthToken = {};

export default AuthToken;

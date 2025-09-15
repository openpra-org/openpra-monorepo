import { JwtPayload } from "jwt-decode";
import { CollabRole } from "../data/predefiniedRoles";

export interface AuthTokenAdditionals {
  user_id?: number;
  username?: string;
  email?: string;
  orig_iat?: number;
  roles?: string[];
}

type AuthToken = JwtPayload & AuthTokenAdditionals;

export const EMPTY_TOKEN: AuthToken = { roles: [CollabRole] };

export { AuthToken };

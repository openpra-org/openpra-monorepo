/** Minimal JWT payload shape (standard claims only). */
interface BaseJwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

/** Additional claims supported by OpenPRA tokens. */
export interface AuthTokenAdditionals {
  user_id?: number;
  username?: string;
  email?: string;
  orig_iat?: number;
  roles?: string[];
}

/**
 * OpenPRA authentication token claims (standard + OpenPRA additions).
 * This is the decoded JWT payload used by clients and services.
 */
type AuthToken = BaseJwtPayload & AuthTokenAdditionals;

/** Default token with a basic role. Keep generic to avoid runtime dependencies. */
export const EMPTY_TOKEN: AuthToken = { roles: ["member"] };

export { AuthToken };

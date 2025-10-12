// Minimal JWT payload shape to avoid depending on external libraries in types-only package
interface BaseJwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface AuthTokenAdditionals {
  user_id?: number;
  username?: string;
  email?: string;
  orig_iat?: number;
  roles?: string[];
}

type AuthToken = BaseJwtPayload & AuthTokenAdditionals;

// Default token with a basic role. Keep generic to avoid runtime dependencies.
export const EMPTY_TOKEN: AuthToken = { roles: ["member"] };

export { AuthToken };

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
export declare const EMPTY_TOKEN: AuthToken;
export { AuthToken };

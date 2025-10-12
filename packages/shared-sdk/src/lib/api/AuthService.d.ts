import { AuthToken } from "shared-types/src/lib/types/AuthToken";
declare class AuthService {
    static hasTokenExpired(token: string | null): boolean;
    static getTokenTimer(token: string | null): number;
    static setEncodedToken(idToken: string | null): void;
    static getEncodedToken(): string | null;
    static logout(): boolean;
    static getProfile(): AuthToken;
    static getRole(): string[];
}
export { AuthService };

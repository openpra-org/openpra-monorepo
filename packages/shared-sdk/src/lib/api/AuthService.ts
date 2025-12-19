import { jwtDecode } from "jwt-decode";
import { AuthToken, EMPTY_TOKEN } from "shared-types";
import { emitAuthEvent } from "./AuthEvents";
import { MemberRole } from "../data/predefiniedRoles";

/**
 * Stateless helpers for working with JWT-based authentication in the browser.
 * Handles token storage, expiration checks, user profile parsing, and auth events.
 * @public
 */
export class AuthService {
  /**
   * Determine whether a JWT is expired or unusable.
   *
   * @param token - Encoded JWT string or null.
   * @returns true if missing/invalid/expired; false otherwise.
   */
  static hasTokenExpired(token: string | null): boolean {
    // if token is null, it has certainly expired
    if (!token || token === "undefined") {
      return true;
    }
    try {
      const payload: AuthToken | null = jwtDecode<AuthToken>(token) as AuthToken | null;
      if (payload === null) {
        return true;
      }
      if (!payload.exp) {
        return true;
      }
      return Date.now() / 1000 > payload.exp;
    } catch (_err) {
      return true;
    }
  }

  /**
   * Get remaining lifetime of a JWT (in seconds) for re-auth scheduling.
   *
   * @param token - Encoded JWT string or null.
   * @returns Seconds until expiration, or -1 if invalid or missing.
   */
  static getTokenTimer(token: string | null): number {
    // if token is null, it has certainly expired
    if (!token || token === "undefined") {
      return -1;
    }
    try {
      const payload: AuthToken | null = jwtDecode<AuthToken>(token) as AuthToken | null;
      if (payload === null) {
        return -1;
      }
      if (!payload.exp) {
        return -1;
      }
      return payload.exp - Date.now() / 1000;
    } catch (_err) {
      return -1;
    }
  }

  /**
   * Persist an encoded JWT and emit a login auth event.
   *
   * @param idToken - Encoded JWT string to store; ignored if null/empty.
   */
  static setEncodedToken(idToken: string | null): void {
    if (idToken) {
      localStorage.setItem("id_token", idToken);
      // Notify subscribers that a login occurred
      try {
        const decoded = jwtDecode<AuthToken>(idToken);
        emitAuthEvent({ type: "login", user: decoded });
      } catch (_e) {
        emitAuthEvent({ type: "login" });
      }
    }
  }

  static getEncodedToken(): string | null {
    const idToken = localStorage.getItem("id_token");
    return idToken === "undefined" ? null : idToken;
  }

  static logout(): boolean {
    localStorage.removeItem("id_token");
    emitAuthEvent({ type: "logout", user: null });
    return AuthService.getEncodedToken() === null;
  }

  static getProfile(): AuthToken {
    try {
      const encodedToken = AuthService.getEncodedToken();
      if (!encodedToken) {
        return EMPTY_TOKEN;
      }
      return jwtDecode<AuthToken>(encodedToken);
    } catch (_e) {
      return EMPTY_TOKEN;
    }
  }

  /**
   * This function gets the user role from token
   */
  static getRole(): string[] {
    try {
      const encodedToken = AuthService.getEncodedToken();
      if (!encodedToken) {
        return [MemberRole];
      }
      const decodedToken = jwtDecode<AuthToken>(encodedToken);
      if (!decodedToken.exp) {
        return [MemberRole];
      }
      return decodedToken.roles ?? [MemberRole];
    } catch (_e) {
      // Something bad happened
      throw new Error("The user is not logged in or token expired");
    }
  }
}

import { jwtDecode } from "jwt-decode";
import { AuthToken, EMPTY_TOKEN } from "../types/AuthToken";
import { MemberRole } from "../data/predefiniedRoles";

class AuthService {
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
    } catch (err) {
      return true;
    }
  }

  //gets the actual timer of the token for reauth purposes
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
    } catch (err) {
      return -1;
    }
  }

  static setEncodedToken(idToken: string | null): void {
    if (idToken) {
      localStorage.setItem("id_token", idToken);
    }
  }

  static getEncodedToken(): string | null {
    const idToken = localStorage.getItem("id_token");
    return idToken === "undefined" ? null : idToken;
  }

  static logout(): boolean {
    localStorage.removeItem("id_token");
    return AuthService.getEncodedToken() === null;
  }

  static getProfile(): AuthToken {
    try {
      const encodedToken = AuthService.getEncodedToken();
      if (!encodedToken) {
        return EMPTY_TOKEN;
      }
      return jwtDecode<AuthToken>(encodedToken);
    } catch (e) {
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
    } catch (e) {
      // Something bad happened
      throw new Error("The user is not logged in or token expired");
    }
  }
}

export { AuthService };

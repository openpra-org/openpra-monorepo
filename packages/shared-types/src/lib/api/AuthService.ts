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

  // Store the ID token in session storage.
  static setEncodedToken(idToken: string | null): void {
    if (idToken) {
      sessionStorage.setItem("id_token", idToken);
    }
  }

  // Retrieve the ID token from session storage.
  static getEncodedToken(): string | null {
    const idToken = sessionStorage.getItem("id_token");
    return idToken === "undefined" ? null : idToken;
  }

  // Store access token in session storage.
  static setAccessToken(accessToken: string | null): void {
    if (accessToken) {
      sessionStorage.setItem("access_token", accessToken);
    }
  }

  // Retrieve access token from session storage.
  static getAccessToken(): string | null {
    const accessToken = sessionStorage.getItem("access_token");
    return accessToken === "undefined" ? null : accessToken;
  }

  // Clear tokens from session storage on logout.
  static logout(): boolean {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("id_token");
    return AuthService.getEncodedToken() === null && AuthService.getAccessToken() === null;
  }

  static mapToAuthToken(jwtPayload: any): AuthToken {
    const isOidcResponse = jwtPayload.sub && jwtPayload.groupNames !== undefined;
    if (isOidcResponse) {
      return {
        sub: jwtPayload.sub,
        iat: jwtPayload.iat,
        exp: jwtPayload.exp,
        user_id: jwtPayload.sub,
        username: jwtPayload.preferred_username,
        email: jwtPayload.email,
        orig_iat: jwtPayload.auth_time,
        roles: jwtPayload.groupNames,
      };
    } else {
      // For standard JWT response, return the payload directly
      return jwtPayload as AuthToken;
    }
  }

  // Decode the ID token to extract user profile data.
  static getProfile(): AuthToken {
    try {
      const idToken = AuthService.getEncodedToken();
      if (!idToken) {
        return EMPTY_TOKEN;
      }
      return AuthService.mapToAuthToken(jwtDecode<any>(idToken));
    } catch (e) {
      return EMPTY_TOKEN;
    }
  }

  // Retrieve user roles from the ID token.
  static getRole(): string[] {
    try {
      const idToken = AuthService.getEncodedToken();
      if (!idToken) {
        return [MemberRole];
      }
      const decodedToken = jwtDecode<AuthToken>(idToken);
      if (!decodedToken.exp) {
        return [MemberRole];
      }
      return decodedToken.roles ?? [MemberRole];
    } catch (e) {
      throw new Error("The user is not logged in or token expired");
    }
  }
}

export { AuthService };

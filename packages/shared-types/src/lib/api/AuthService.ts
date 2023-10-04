import jwtDecode from 'jwt-decode';
import AuthToken, { EMPTY_TOKEN } from "../types/AuthToken";

class AuthService {
  static hasTokenExpired(token: string | null) {
    // if token is null, it has certainly expired
    if (!token || token === 'undefined') {
      return true;
    }
    try {
      const payload: AuthToken = jwtDecode<AuthToken>(token);
      if (!payload || !payload.exp) {
        return true;
      }
      return (Date.now() / 1000) > payload.exp;
    } catch (err) {
      return true;
    }
  }

  //gets the actual timer of the token for reauth purposes
  static getTokenTimer(token: string | null): number {
    // if token is null, it has certainly expired
    if (!token || token === 'undefined') {
      return -1;
    }
    try {
      const payload: AuthToken = jwtDecode<AuthToken>(token);
      if (!payload || !payload.exp) {
        return -1;
      }
      return (payload.exp - (Date.now() / 1000));
    } catch (err) {
      return -1;
    }
  }

  static setEncodedToken(idToken: string | null) {
    if (idToken) {
      localStorage.setItem('id_token', idToken);
    }
  }

  static getEncodedToken() {
    const idToken = localStorage.getItem('id_token');
    return (idToken === 'undefined') ? null : idToken;
  }

  static logout() {
    localStorage.removeItem('id_token');
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
}

export default AuthService;


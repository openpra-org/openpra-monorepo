import jwtDecode from 'jwt-decode';
import AuthToken, { EMPTY_TOKEN } from "../Types/AuthToken";

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


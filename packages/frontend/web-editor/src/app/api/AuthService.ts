import decode from 'jwt-decode';

export interface AuthToken {
  user_id: number,
  username: string,
  exp: number,
  email: string,
  orig_iat: number,
}

const EMPTY_TOKEN: AuthToken = {
  email: null, exp: null, orig_iat: null, username: null,
  user_id: null
};

class AuthService {
  static hasTokenExpired(token: any) {
    // if token is null, it has certainly expired
    if (token === null || token === 'undefined') {
      return true;
    }
    try {
      return (Date.now() / 1000) > decode(token).exp;
    } catch (err) {
      return true;
    }
  }

  static setToken(idToken: any) {
    localStorage.setItem('id_token', idToken);
  }

  static getToken() {
    const idToken = localStorage.getItem('id_token');
    return (idToken === 'undefined') ? null : idToken;
  }

  static logout() {
    localStorage.removeItem('id_token');
    return AuthService.getToken() === null;
  }

  static getProfile(): AuthToken {
    try {
      return decode(AuthService.getToken());
    } catch (e) {
      return EMPTY_TOKEN;
    }
  }
}

export default AuthService;


import axios from "axios";
import { AuthToken } from "../types/AuthToken";
import { AuthService } from "./AuthService";
import { SignUpCredentials, SignUpCredentialsWithRole, TokenResponse } from "./AuthTypes";
import { MemberResult, Members } from "./Members";

const API_ENDPOINT = "/api";

const collabEndpoint = `${API_ENDPOINT}/collab`;
const authEndpoint = `${API_ENDPOINT}/auth`;
const userPreferencesEndpoint = `${collabEndpoint}/user`;

const OPTION_CACHE = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached

const OIDC_CONFIG = {
  issuer: "https://hub.openpra.org/hub",
  authorizationEndpoint: "https://hub.openpra.org/hub/api/rest/oauth2/auth",
  tokenEndpoint: "https://hub.openpra.org/hub/api/rest/oauth2/token",
  userinfoEndpoint: "https://hub.openpra.org/hub/api/rest/oauth2/userinfo",
  clientId: "da279c72-26ea-49d9-8ec6-ab3ef5584752",
  clientSecret: "RG5vQUr9bfUv",
  grantType: "authorization_code",
  redirectUri: "http://localhost:4200/callback",
  scopes: ["openid", "profile", "email"],
};

export class ApiManager {
  static API_ENDPOINT = API_ENDPOINT;

  static LOGIN_URL = `${authEndpoint}/token-obtain/`;

  static async signInWithOIDC(): Promise<void> {
    // eslint-disable-next-line no-console
    console.log("Calling OIDC Provider");
    const authUrl = `${OIDC_CONFIG.authorizationEndpoint}?client_id=${
      OIDC_CONFIG.clientId
    }&redirect_uri=${encodeURIComponent(OIDC_CONFIG.redirectUri)}&response_type=code&scope=${OIDC_CONFIG.scopes.join(
      " ",
    )}`;
    window.location.href = authUrl;
  }

  static async fetchUserInfo(): Promise<void> {
    const accessToken = AuthService.getAccessToken();
    if (!accessToken) return;

    try {
      const response = await axios.get(OIDC_CONFIG.userinfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("User Info:", response.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  }

  static async handleCallback(code: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append("client_id", OIDC_CONFIG.clientId);
      params.append("client_secret", OIDC_CONFIG.clientSecret);
      params.append("code", code);
      params.append("grant_type", OIDC_CONFIG.grantType);
      params.append("redirect_uri", OIDC_CONFIG.redirectUri);
      const response = await axios.post<TokenResponse>(OIDC_CONFIG.tokenEndpoint, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token: accessToken = null, id_token: idToken = null } = response.data;
      AuthService.setAccessToken(accessToken);
      AuthService.setEncodedToken(idToken);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
    }
  }

  /* base GET request */
  static async getWithOptions(url: string): Promise<Response> {
    return fetch(url, {
      method: "GET", // *GET, POST, PUT, DELETE, etc.
      headers: {
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    });
  }

  static logout(): boolean {
    return AuthService.logout();
  }

  static login(creds: any) {
    return fetch(ApiManager.LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(creds),
    })
      .then((res) => res.json())
      .then((data: { token: string | null }) => {
        AuthService.setEncodedToken(data.token);
      });
  }

  /**
   * Attempts to sign a user in using username and password.
   *
   * @param username - The user's username
   * @param password - The user's password
   * Returns a promise of a non-null User object (newly signed in)
   * @throws - A possible authentication error
   */
  static async signInWithUsernameAndPassword(username: string, password: string): Promise<void> {
    return fetch(ApiManager.LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    })
      .then((response) => {
        if (response.ok) {
          return response;
        }
        throw new Error(response.statusText);
      })
      .then((res: Response) => res.json())
      .then((data: Record<string, string>) => {
        AuthService.setEncodedToken(data.token);
      });
  }

  signInWithUsernameAndPassword(username: any, password: any) {
    return ApiManager.signInWithUsernameAndPassword(username, password);
  }

  static signup(data: SignUpCredentialsWithRole) {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data))
      .then((response) => {
        if (response.ok) {
          return ApiManager.signInWithUsernameAndPassword(data.username, data.password);
        }
        if (response.status >= 400) {
          throw new Error(response.statusText);
        }
      })
      .catch((reason: string) => {
        throw new Error(reason);
      });
  }

  static async signupWithoutSignIn(data: SignUpCredentials): Promise<void> {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data))
      .then((response) => {
        if (response.ok) {
          return;
        }
        if (response.status >= 400) {
          throw new Error(response.statusText);
        }
      })
      .catch((reason: string) => {
        throw new Error(reason);
      });
  }

  signup(username: string, email: string, firstName: string, lastName: string, password: string, roles: string[]) {
    const data: SignUpCredentialsWithRole = {
      username,
      email,
      firstName,
      lastName,
      password,
      roles,
    };
    return ApiManager.signup(data);
  }

  static checkStatus(response: any) {
    // raises an error in case response status is not a success
    if (response.status >= 200 && response.status < 300) {
      // Success status lies between 200 to 300
      return response;
    }
    throw new Error(response.statusText);
  }

  static isLoggedIn(): boolean {
    // Checks if there is a saved token and it's still valid
    const token = AuthService.getEncodedToken(); // Getting token from localstorage
    if (AuthService.hasTokenExpired(token)) this.logout();
    return token !== null && !AuthService.hasTokenExpired(token);
  }

  static getTokenTimer(): number {
    // Checks if there is a saved token and it's still valid
    const token = AuthService.getEncodedToken(); // Getting token from localstorage
    return AuthService.getTokenTimer(token);
  }

  static getCurrentUser(): AuthToken {
    return AuthService.getProfile();
  }

  /**
   * Get the list of users.
   */
  //TODO: Check if this works!
  static async getUsers(): Promise<Members> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/`).then(
      (response: Response) => response.json() as Promise<Members>,
    );
  }

  /**
   * Get list of users for a role
   * @param roleId - The roleId
   */
  static async getUsersWithRole(roleId: string): Promise<Members> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user?role=${roleId}`).then(
      (response: Response) => response.json() as Promise<Members>,
    );
  }

  static post(url: string, data: BodyInit): Promise<Response> {
    // const accessToken = AuthService.getAccessToken();
    // const idToken = AuthService.getEncodedToken();
    return fetch(url, {
      method: "POST",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
    });
  }

  static put<DataType>(url: string, data: DataType): Promise<Response> {
    return fetch(url, {
      method: "PUT",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data as BodyInit, // body data type must match "Content-Type" header
    });
  }

  static delete(url: RequestInfo | URL | string): Promise<Response> {
    return fetch(url, {
      method: "DELETE",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    });
  }

  /**
   * Use this function to get a particular user using their id as reference
   *
   * @param id - id of the user
   */
  static async getUserById(id: string): Promise<MemberResult> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/${id}/`).then(
      (res: Response) => res.json() as Promise<MemberResult>,
    );
  }

  /**
   *
   * @param id - Id of the user which is to be updated
   * @param data - The fields to be updated
   */
  static updateUser<DataType>(id: string | number, data: DataType): Promise<Response> {
    return ApiManager.put(`${collabEndpoint}/user/${id}/`, data);
  }

  /**
   * This endpoint will check if a user's email is unique
   * @param email - Email of the user
   */
  static async isValidEmail(email: string): Promise<boolean> {
    const result = await ApiManager.post(`${collabEndpoint}/validateEmail`, email);
    return Boolean(await result.json());
  }

  /**
   * This endpoint will check if user's username is unique
   * @param username - Username of user
   */
  static async isValidUsername(username: string): Promise<boolean> {
    const result = await ApiManager.post(`${collabEndpoint}/validateUsername`, username);
    return Boolean(await result.json());
  }

  /**
   * This function will return true if the password for the given username is correct
   * @param username - The username which we want to check
   * @param password - The password for the user
   */
  static verifyPassword(username: string, password: string): Promise<Response> {
    const data = {
      username: username,
      password: password,
    };
    return ApiManager.post(`${authEndpoint}/verify-password`, JSON.stringify(data));
  }
}

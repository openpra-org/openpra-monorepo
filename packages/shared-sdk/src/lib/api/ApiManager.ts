import { AuthToken } from "shared-types";
import { AuthService } from "./AuthService";
import { SignUpCredentials, SignUpCredentialsWithRole, SignUpPropsWithRole } from "./AuthTypes";
import { MemberResult, Members } from "./Members";
import { EmailValidationForm, UsernameValidationForm } from "./FormValidation";
const API_ENDPOINT = "/api";
const collabEndpoint = `${API_ENDPOINT}/collab`;
const authEndpoint = `${API_ENDPOINT}/auth`;
const userPreferencesEndpoint = `${collabEndpoint}/user`;
const OPTION_CACHE = "no-cache";
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z|a-z]{2,}$/;
export class ApiManager {
  static API_ENDPOINT = API_ENDPOINT;
  static LOGIN_URL = `${authEndpoint}/token-obtain/`;
  static async getWithOptions(url: string): Promise<Response> {
    return fetch(url, {
      method: "GET",
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
      .then((res: Response) => res.json())
      .then((data: Record<string, unknown>) => {
        const token = typeof data["token"] === "string" ? (data["token"] as string) : null;
        AuthService.setEncodedToken(token);
      });
  }
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
      .then((data: Record<string, unknown>) => {
        const token = typeof data["token"] === "string" ? (data["token"] as string) : null;
        AuthService.setEncodedToken(token);
        return;
      });
  }
  signInWithUsernameAndPassword(username: string, password: string): Promise<void> {
    return ApiManager.signInWithUsernameAndPassword(username, password);
  }
  static signup(data: SignUpCredentialsWithRole) {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data))
      .then((response: Response) => {
        if (response.ok) {
          return ApiManager.signInWithUsernameAndPassword(data.username, data.password);
        }
        if (response.status >= 400) {
          throw new Error(response.statusText);
        }
        return;
      })
      .catch((reason: string) => {
        throw new Error(reason);
      });
  }
  static async signupWithoutSignIn(data: SignUpCredentials): Promise<void> {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data))
      .then((response: Response) => {
        if (response.ok) {
          return;
        }
        if (response.status >= 400) {
          throw new Error(response.statusText);
        }
        return;
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
  static checkStatus(response: Pick<Response, "status" | "statusText">): Pick<Response, "status" | "statusText"> {
    if (response.status >= 200 && response.status < 300) {
      return response;
    }
    throw new Error(response.statusText);
  }
  static isLoggedIn(): boolean {
    const token = AuthService.getEncodedToken();
    if (AuthService.hasTokenExpired(token)) this.logout();
    return token !== null && !AuthService.hasTokenExpired(token);
  }
  static getTokenTimer(): number {
    const token = AuthService.getEncodedToken();
    return AuthService.getTokenTimer(token);
  }
  static getCurrentUser(): AuthToken {
    return AuthService.getProfile();
  }
  static async getUsers(): Promise<Members> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/`).then(
      (response: Response) => response.json() as Promise<Members>,
    );
  }
  static async getUsersWithRole(roleId: string): Promise<Members> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user?role=${roleId}`).then(
      (response: Response) => response.json() as Promise<Members>,
    );
  }
  static post(url: string, data: BodyInit): Promise<Response> {
    return fetch(url, {
      method: "POST",
      cache: OPTION_CACHE,
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data,
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
      body: data as BodyInit,
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
  static async getUserById(id: string): Promise<MemberResult> {
    return ApiManager.getWithOptions(`${collabEndpoint}/user/${id}/`).then(
      (res: Response) => res.json() as Promise<MemberResult>,
    );
  }
  static updateUser<DataType>(id: string | number, data: DataType): Promise<Response> {
    return ApiManager.put(`${collabEndpoint}/user/${id}/`, data);
  }
  static async isValidEmail(email: string): Promise<boolean> {
    const result = await ApiManager.post(`${collabEndpoint}/validateEmail`, email);
    return Boolean(await result.json());
  }
  static async isValidUsername(username: string): Promise<boolean> {
    const result = await ApiManager.post(`${collabEndpoint}/validateUsername`, username);
    return Boolean(await result.json());
  }
  static verifyPassword(username: string, password: string): Promise<Response> {
    const data = {
      username: username,
      password: password,
    };
    return ApiManager.post(`${authEndpoint}/verify-password`, JSON.stringify(data));
  }
  static validUserName = (signup: SignUpPropsWithRole): Promise<boolean> => {
    const usernameValidation: UsernameValidationForm = {
      username: signup.username,
    };
    return ApiManager.isValidUsername(JSON.stringify(usernameValidation))
      .then((isValidUsername: boolean) => {
        return isValidUsername;
      })
      .catch((_error: unknown) => {
        return false;
      });
  };
  static checkUserName = (
    onValidationComplete: (isValid: boolean) => void,
  ): ((signup: SignUpPropsWithRole) => void) => {
    let timer: NodeJS.Timeout | null = null;
    return function (signup: SignUpPropsWithRole): void {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        ApiManager.validUserName(signup)
          .then((isValid) => {
            onValidationComplete(isValid);
          })
          .catch((_error: unknown) => {
            onValidationComplete(false);
          });
      }, 400);
    };
  };
  static isValidEmailFormat(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }
  static validEmail = (signup: SignUpPropsWithRole): Promise<boolean> => {
    if (!ApiManager.isValidEmailFormat(signup.email)) {
      return Promise.resolve(false);
    }
    const emailValidation: EmailValidationForm = {
      email: signup.email,
    };
    return ApiManager.isValidEmail(JSON.stringify(emailValidation))
      .then((isValidEmail: boolean) => {
        return isValidEmail;
      })
      .catch((_error: unknown) => {
        console.error("Error validating email:", _error);
        return false;
      });
  };
  static checkEmail = (onValidationComplete: (isValid: boolean) => void): ((signup: SignUpPropsWithRole) => void) => {
    let timer: NodeJS.Timeout | null = null;
    return function (signup: SignUpPropsWithRole): void {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (!ApiManager.isValidEmailFormat(signup.email)) {
          onValidationComplete(false);
          return;
        }
        ApiManager.validEmail(signup)
          .then((isValid) => {
            onValidationComplete(isValid);
          })
          .catch((_error: unknown) => {
            console.error("Error in email validation:", _error);
            onValidationComplete(false);
          });
      }, 700);
    };
  };
}

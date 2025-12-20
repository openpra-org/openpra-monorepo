import { AuthToken } from 'shared-types';
import { AuthService } from './AuthService';
import {
  SignUpCredentials,
  SignUpCredentialsWithRole,
  SignUpPropsWithRole,
} from './AuthTypes';
import { MemberResult, Members } from './Members';
import { EmailValidationForm, UsernameValidationForm } from './FormValidation';

const API_ENDPOINT = '/api';

const collabEndpoint = `${API_ENDPOINT}/collab`;
const authEndpoint = `${API_ENDPOINT}/auth`;
const userPreferencesEndpoint = `${collabEndpoint}/user`;

const OPTION_CACHE = 'no-cache'; // *default, no-cache, reload, force-cache, only-if-cached

// Regex for basic email validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z|a-z]{2,}$/;

/**
 * High-level helper for calling backend auth, collab, and user preference APIs.
 * Wraps fetch calls with JWT handling via AuthService.
 * @public
 */
export class ApiManager {
  static API_ENDPOINT = API_ENDPOINT;

  static LOGIN_URL = `${authEndpoint}/token-obtain/`;

  /**
   * Perform an authenticated GET request with the current JWT.
   *
   * @param url - Absolute or relative URL to request.
   * @returns The raw fetch Response; callers can inspect ok/status or parse JSON.
   */
  static async getWithOptions(url: string): Promise<Response> {
    return fetch(url, {
      method: 'GET', // *GET, POST, PUT, DELETE, etc.
      headers: {
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
    });
  }

  static logout(): boolean {
    return AuthService.logout();
  }

  /**
   * Exchange credentials for a JWT and persist it via AuthService.
   *
   * @param creds - Arbitrary credential payload to POST to the token endpoint.
   * @returns Promise that resolves after token is parsed and stored.
   */
  static login(creds: any) {
    return fetch(ApiManager.LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(creds),
    })
      .then((res: Response) => res.json())
      .then((data: Record<string, unknown>) => {
        const token =
          typeof data['token'] === 'string' ? (data['token'] as string) : null;
        AuthService.setEncodedToken(token);
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
  static async signInWithUsernameAndPassword(
    username: string,
    password: string,
  ): Promise<void> {
    return fetch(ApiManager.LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
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
        const token =
          typeof data['token'] === 'string' ? (data['token'] as string) : null;
        AuthService.setEncodedToken(token);
        return;
      });
  }

  /**
   * Instance wrapper for {@link ApiManager.signInWithUsernameAndPassword}.
   *
   * @param username - Username for the account to authenticate
   * @param password - Password for the account to authenticate
   * @returns A promise that resolves when the JWT is obtained and stored
   * @throws Error if the server returns an error status
   */
  signInWithUsernameAndPassword(
    username: string,
    password: string,
  ): Promise<void> {
    return ApiManager.signInWithUsernameAndPassword(username, password);
  }

  /**
   * Create a new user account and, on success, automatically sign in the user.
   *
   * @param data - Signup credentials including username, password, profile fields, and roles
   * @returns A promise that resolves once the signup request completes and sign-in is attempted
   * @throws Error if the server returns an error status
   */
  static signup(data: SignUpCredentialsWithRole) {
    return ApiManager.post(`${userPreferencesEndpoint}/`, JSON.stringify(data))
      .then((response: Response) => {
        if (response.ok) {
          return ApiManager.signInWithUsernameAndPassword(
            data.username,
            data.password,
          );
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

  /**
   * Create a new user account without automatically signing in.
   *
   * @param data - Signup credentials including username, password, and profile fields
   * @returns A promise that resolves when the account has been created
   * @throws Error if the server returns an error status
   */
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

  /**
   * Convenience wrapper to construct signup payload and delegate to static {@link ApiManager.signup}.
   *
   * @param username - Desired unique username
   * @param email - Email address of the user
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param password - Password for the account
   * @param roles - One or more roles to assign to the user
   * @returns A promise that resolves once the signup request completes and sign-in is attempted
   */
  signup(
    username: string,
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    roles: string[],
  ) {
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

  /**
   * Validate an HTTP response status, throwing on non-2xx.
   *
   * @param response - A minimal Response-like object providing status and statusText
   * @returns The same response when status is within the 2xx range
   * @throws Error when the status is outside 200-299
   */
  static checkStatus(
    response: Pick<Response, 'status' | 'statusText'>,
  ): Pick<Response, 'status' | 'statusText'> {
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
    return ApiManager.getWithOptions(
      `${collabEndpoint}/user?role=${roleId}`,
    ).then((response: Response) => response.json() as Promise<Members>);
  }

  /**
   * Authenticated POST request helper.
   *
   * @param url - Endpoint to POST to.
   * @param data - Request body; should match the declared Content-Type.
   * @returns Raw Response from fetch.
   */
  static post(url: string, data: BodyInit): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data, // body data type must match "Content-Type" header
    });
  }

  /**
   * Authenticated PUT request helper.
   *
   * @param url - Endpoint to PUT to.
   * @param data - Request body; will be JSON-serialized.
   * @returns Raw Response from fetch.
   */
  static put<DataType>(url: string, data: DataType): Promise<Response> {
    return fetch(url, {
      method: 'PUT',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${AuthService.getEncodedToken()}`,
      },
      body: data as BodyInit, // body data type must match "Content-Type" header
    });
  }

  /**
   * Authenticated DELETE request helper.
   *
   * @param url - Endpoint to DELETE.
   * @returns Raw Response from fetch.
   */
  static delete(url: RequestInfo | URL | string): Promise<Response> {
    return fetch(url, {
      method: 'DELETE',
      cache: OPTION_CACHE,
      headers: {
        'Content-Type': 'application/json',
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
  static updateUser<DataType>(
    id: string | number,
    data: DataType,
  ): Promise<Response> {
    return ApiManager.put(`${collabEndpoint}/user/${id}/`, data);
  }

  /**
   * This endpoint will check if a user's email is unique
   * @param email - Email of the user
   */
  static async isValidEmail(email: string): Promise<boolean> {
    const result = await ApiManager.post(
      `${collabEndpoint}/validateEmail`,
      email,
    );
    return Boolean(await result.json());
  }

  /**
   * This endpoint will check if user's username is unique
   * @param username - Username of user
   */
  static async isValidUsername(username: string): Promise<boolean> {
    const result = await ApiManager.post(
      `${collabEndpoint}/validateUsername`,
      username,
    );
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
    return ApiManager.post(
      `${authEndpoint}/verify-password`,
      JSON.stringify(data),
    );
  }

  /**
   * This function validates the username for a signup attempt
   * @param signup - The signup data containing the username to validate
   * @returns A Promise that resolves to true if the username is valid, false otherwise
   */
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

  /**
   * This function creates a debounced username checker
   * @param onValidationComplete - Callback function to be called with the validation result
   * @returns A function that takes signup data and initiates a debounced username validation
   */
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

  /**
   * This static function checks if an email address has a valid format
   * @param email - The email address to validate
   * @returns true if the email format is valid, false otherwise
   */
  static isValidEmailFormat(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  /**
   * This function validates the email for a signup attempt
   * @param signup - The signup data containing the email to validate
   * @returns A Promise that resolves to true if the email is valid, false otherwise
   */
  static validEmail = (signup: SignUpPropsWithRole): Promise<boolean> => {
    // Check the email format
    if (!ApiManager.isValidEmailFormat(signup.email)) {
      return Promise.resolve(false);
    }

    // If the format is valid, check with the backend
    const emailValidation: EmailValidationForm = {
      email: signup.email,
    };

    return ApiManager.isValidEmail(JSON.stringify(emailValidation))
      .then((isValidEmail: boolean) => {
        return isValidEmail;
      })
      .catch((_error: unknown) => {
        console.error('Error validating email:', _error);
        return false;
      });
  };

  /**
   * This function creates a debounced email checker
   * @param onValidationComplete - Callback function to be called with the validation result
   * @returns A function that takes signup data and initiates a debounced email validation
   */
  static checkEmail = (
    onValidationComplete: (isValid: boolean) => void,
  ): ((signup: SignUpPropsWithRole) => void) => {
    let timer: NodeJS.Timeout | null = null;

    return function (signup: SignUpPropsWithRole): void {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        // First, check the email format
        if (!ApiManager.isValidEmailFormat(signup.email)) {
          onValidationComplete(false);
          return;
        }

        // If the format is valid, proceed with backend validation
        ApiManager.validEmail(signup)
          .then((isValid) => {
            onValidationComplete(isValid);
          })
          .catch((_error: unknown) => {
            console.error('Error in email validation:', _error);
            onValidationComplete(false);
          });
      }, 700);
    };
  };
}

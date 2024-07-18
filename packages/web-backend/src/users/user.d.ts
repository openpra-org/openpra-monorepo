/**
 * JSON schema for a User Model
 */
export interface UserSchema {
  /**
   * Username.
   */
  username?: string;
  /**
   * Password.
   */
  password?: string;
  role?: Role;
}
/**
 * User's role.
 */
export interface Role {
  action: string | string[];
  subject: string | string[];
  fields?: unknown;
  conditionals?: unknown;
  inverted?: boolean;
  reason?: string;
}

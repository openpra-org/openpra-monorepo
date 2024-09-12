/**
 * Defines the structure for login credentials.
 * @typeParam Type - The type of the username and password.
 */
export interface LoginCredentials<Type> {
  /** The username of the user. */
  username: Type;
  /** The password of the user. */
  password: Type;
}

/**
 * Defines the structure for sign-up credentials, extending `LoginCredentials`.
 * @typeParam Type - The type of the properties.
 */
export type SignUpCredentialsGeneric<Type> = {
  /** The email address of the user. */
  email: Type;
  /** The first name of the user. */
  firstName: Type;
  /** The last name of the user. */
  lastName: Type;
} & LoginCredentials<Type>;

/**
 * Extends `SignUpCredentialsGeneric` with roles, specifying user roles.
 * @typeParam Type - The type of the properties excluding roles.
 */
export type SignUpCredentialsGenericWithRole<Type> = {
  /** An array of roles assigned to the user. */
  roles: string[];
} & SignUpCredentialsGeneric<Type>;

/**
 * Extends `SignUpCredentialsGeneric` with a password confirmation field.
 * @typeParam Type - The type of the properties including the password confirmation.
 */
export type SignUpPropsGeneric<Type> = {
  /** The password confirmation field. */
  passConfirm: Type;
} & SignUpCredentialsGeneric<Type>;

/**
 * Extends `SignUpPropsGeneric` with roles, specifying user roles.
 * @typeParam Type - The type of the properties excluding roles.
 */
export type SignUpWithRole<Type> = {
  /** An array of roles assigned to the user. */
  roles: string[];
} & SignUpPropsGeneric<Type>;

/**
 * A specialized version of `SignUpPropsGeneric` for string types.
 */
export type SignUpProps = SignUpPropsGeneric<string>;

/**
 * A specialized version of `SignUpWithRole` for string types.
 */
export type SignUpPropsWithRole = SignUpWithRole<string>;

/**
 * A specialized version of `SignUpPropsGeneric` for boolean types, typically used for error states.
 */
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;

/**
 * A specialized version of `SignUpCredentialsGeneric` for string types.
 */
export type SignUpCredentials = SignUpCredentialsGeneric<string>;

/**
 * A specialized version of `SignUpCredentialsGenericWithRole` for string types.
 */
export type SignUpCredentialsWithRole = SignUpCredentialsGenericWithRole<string>;

/**
 * A specialized version of `LoginCredentials` for string types.
 */
export type LoginProps = LoginCredentials<string>;

/**
 * A specialized version of `LoginCredentials` for boolean types, typically used for error states.
 */
export type LoginErrorProps = LoginCredentials<boolean>;

/** Credentials tuple (username/password). */
export interface LoginCredentials<Type> {
  username: Type;
  password: Type;
}

/** Base signup credentials shape (email, name, password). */
export type SignUpCredentialsGeneric<Type> = {
  email: Type; //email type
  firstName: Type;
  lastName: Type;
} & LoginCredentials<Type>;

/** Signup credentials including one or more role identifiers. */
export type SignUpCredentialsGenericWithRole<Type> = {
  roles: string[];
} & SignUpCredentialsGeneric<Type>;

/** Signup payload including password confirmation. */
export type SignUpPropsGeneric<Type> = {
  passConfirm: Type;
} & SignUpCredentialsGeneric<Type>;

/** Signup payload including password confirmation and roles. */
export type SignUpWithRole<Type> = {
  roles: string[];
} & SignUpPropsGeneric<Type>;

/** Signup payload for string fields. */
export type SignUpProps = SignUpPropsGeneric<string>;
/** Signup payload for string fields including roles. */
export type SignUpPropsWithRole = SignUpWithRole<string>;
/** Signup payload validation/error flags. */
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;
/** Signup credentials payload for string fields. */
export type SignUpCredentials = SignUpCredentialsGeneric<string>;
/** Signup credentials payload with roles for string fields. */
export type SignUpCredentialsWithRole =
  SignUpCredentialsGenericWithRole<string>;

/** Login payload for string fields. */
export type LoginProps = LoginCredentials<string>;
/** Login payload validation/error flags. */
export type LoginErrorProps = LoginCredentials<boolean>;

export interface LoginCredentials<Type> {
  username: Type;
  password: Type;
}

export type SignUpCredentialsGeneric<Type> = {
  email: Type; //email type
  firstName: Type;
  lastName: Type;
} & LoginCredentials<Type>;

export type SignUpCredentialsGenericWithRole<Type> = {
  roles: string[];
} & SignUpCredentialsGeneric<Type>;

export type SignUpPropsGeneric<Type> = {
  passConfirm: Type;
} & SignUpCredentialsGeneric<Type>;

export type SignUpWithRole<Type> = {
  roles: string[];
} & SignUpPropsGeneric<Type>;

export type SignUpProps = SignUpPropsGeneric<string>;
export type SignUpPropsWithRole = SignUpWithRole<string>;
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;
export type SignUpCredentials = SignUpCredentialsGeneric<string>;
export type SignUpCredentialsWithRole =
  SignUpCredentialsGenericWithRole<string>;

export type LoginProps = LoginCredentials<string>;
export type LoginErrorProps = LoginCredentials<boolean>;

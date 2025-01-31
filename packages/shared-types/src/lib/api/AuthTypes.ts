export interface LoginCredentials<Type> {
  username: Type;
  password?: Type;
}

export type SignUpCredentialsGeneric<Type> = {
  email: Type; //email type
  firstName: Type;
  lastName: Type;
} & LoginCredentials<Type>;

export type SignUpCredentialsGenericWithRole<Type> = {
  roles: string[];
} & SignUpCredentialsGeneric<Type>;

export type SignUpCredentialsForOIDC<Type> = {
  id: string;
} & SignUpCredentialsGenericWithRole<Type>;

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
export type SignUpCredentialsWithRole = SignUpCredentialsGenericWithRole<string>;
export type SignUpCredentialsOIDC = SignUpCredentialsForOIDC<string>;
export type LoginProps = LoginCredentials<string>;
export type LoginErrorProps = LoginCredentials<boolean>;

export interface TokenResponse {
  access_token: string;
  id_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface ResponseData {
  sub: string;
  name: string;
  preferred_username: string;
  profile: string;
  picture: string;
  email: string;
  email_lowercased: string;
  email_verified: boolean;
  groups: {
    id: string;
    name: string;
  }[];
  groupNames: string[];
  permissions: string[];
}

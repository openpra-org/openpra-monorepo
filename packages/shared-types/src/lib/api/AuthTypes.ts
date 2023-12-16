export type LoginCredentials<Type> = {
  username: Type;
  password: Type;
};

export type SignUpCredentialsGeneric<Type> = {
  email: Type; //email type
  firstName: Type;
  lastName: Type;
} & LoginCredentials<Type>;

export type SignUpPropsGeneric<Type> = {
  passConfirm: Type;
} & SignUpCredentialsGeneric<Type>;

export type SignUpProps = SignUpPropsGeneric<string>;
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;
export type SignUpCredentials = SignUpCredentialsGeneric<string>;

export type LoginProps = LoginCredentials<string>;
export type LoginErrorProps = LoginCredentials<boolean>;

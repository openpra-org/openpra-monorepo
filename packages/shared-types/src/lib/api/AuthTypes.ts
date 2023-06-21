export interface LoginCredentials<Type> {
    username: Type,
    password: Type,
}

export interface SignUpCredentialsGeneric<Type> extends LoginCredentials<Type> {
    email: Type, //email type
    firstName: Type,
    lastName: Type,
}

export interface SignUpPropsGeneric<Type> extends SignUpCredentialsGeneric<Type>{
    passConfirm: Type;
}

export type SignUpProps = SignUpPropsGeneric<string>;
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;
export type SignUpCredentials = SignUpCredentialsGeneric<string>;

export type LoginProps = LoginCredentials<string>
export type LoginErrorProps = LoginCredentials<boolean>
export interface LoginCredentials<Type> {
    username: Type,
    password: Type,
}

export interface SignUpCredentials<Type> extends LoginCredentials<Type> {
    email: Type, //email type
    firstName: Type,
    lastName: Type,
}

export interface SignUpPropsGeneric<Type> extends SignUpCredentials<Type>{
    passConfirm: Type;
}

export type SignUpProps = SignUpPropsGeneric<string>;
export type SignUpErrorProps = SignUpPropsGeneric<boolean>;

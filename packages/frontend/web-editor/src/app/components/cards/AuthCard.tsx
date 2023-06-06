import React from "react";
import { useState, useEffect } from "react";
import {EuiTabbedContent, EuiFieldText, EuiForm, EuiText, EuiLink, EuiButton, EuiBottomBar, EuiSelect, EuiFormRow, EuiFieldPassword, EuiCard, EuiSpacer} from "@elastic/eui";

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';
import ApiManager from "../../api/ApiManager";
import {SignUpErrorProps, SignUpProps} from "../../../types/AuthTypes";



function LoginForm() {

    const [login, setLogin] = useState({user: '', pass: ''});
    const [error, setError] = useState({user: false, pass: false});

    function handleLogin() {
        console.log('Login');
    }

    //Corrects the isInvalid when a user types something in a blank input field
    useEffect(() => {
        if(login.username && error.username) {
            setError({
                ...error,
                user: false
            })
        }
        if(login.password && error.password) {
            setError({
                ...error,
                pass: false
            })
        }
    }, [login])

    function validateLogin(e: React.FormEvent<HTMLFormElement>): void {
        e.preventDefault()

        //need errorCheck in the later if statement due to how states and renders work
        let errorCheck = error;
        errorCheck = {
            user: (!login.username),
            pass: (!login.password)
        }

        setError({
            user: (!login.username),
            pass: (!login.password)
        })

        //makes sure all input fields are not empty
        if(!errorCheck.username && !errorCheck.password) {
            handleLogin()
        }
    }

    return (
        <EuiForm component="form" onSubmit={validateLogin}>
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Username"
                    isInvalid={error.username}
                    value={login.username}
                    onChange={(e) => setLogin({
                        ...login,
                        user: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    type="dual"
                    placeholder="Password"
                    isInvalid={error.password}
                    value={login.password}
                    onChange={(e) => setLogin({
                        ...login,
                        pass: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiButton type="submit">
                    Login
                </EuiButton>
            </EuiFormRow>
        </EuiForm>
    );
}

function SignupForm() {

    const defaultProps: SignUpProps = {
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        passConfirm: '',
    }
    const defaultErrorProps: SignUpErrorProps = {
        username: false,
        email: false,
        firstName: false,
        lastName: false,
        password: false,
        passConfirm: false,
    }
    const [signup, setSignup] = useState(defaultProps)
    const [error, setError] = useState(defaultErrorProps)

    let passError = '';


    function handleSignup() {
        ApiManager.signup(signup);
        console.log('signup')
    }

    //Corrects the isInvalid when a user types something in a blank input field
    useEffect(() => {
        if(signup.firstName && error.firstName) {
            setError({
                ...error,
                firstName: false
            })
        }
        if(signup.lastName && error.lastName) {
            setError({
                ...error,
                lastName: false
            })
        }
        if(signup.email && error.email) {
            setError({
                ...error,
                email: false
            })
        }
        if(signup.username && error.username) {
            setError({
                ...error,
                username: false
            })
        }
        if(signup.password && error.password) {
            setError({
                ...error,
                password: false
            })
        }
        if(signup.passConfirm && error.passConfirm) {
            setError({
                ...error,
                passConfirm: false
            })
        }
    }, [signup])

    function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
        e.preventDefault()

        const confirmPasswords = (signup.password === signup.passConfirm);
        console.log(confirmPasswords);

        //need errorCheck in the later if statement due to how states and renders work
        let errorCheck = error;
        errorCheck = {
            firstName: (!signup.firstName),
            lastName: (!signup.lastName),
            email: (!signup.email),
            username: (!signup.username),
            password: (!signup.password),
            passConfirm: (!signup.passConfirm || !confirmPasswords)
        }

        setError({
            firstName: (!signup.firstName),
            lastName: (!signup.lastName),
            email: (!signup.email),
            username: (!signup.username),
            password: (!signup.password),
            passConfirm: (!signup.passConfirm || !confirmPasswords)
        })

        passError = (!confirmPasswords ? 'Passwords do not match' : '');
        console.log(passError);

        //makes sure all input fields are not empty and that both passwords match
        if(
            !errorCheck.firstName && !errorCheck.lastName && !errorCheck.email && !errorCheck.username &&
            !errorCheck.password && !errorCheck.passConfirm && confirmPasswords
        ) {
            handleSignup()
        }
    }

    return (
        <EuiForm component="form" onSubmit={validateSignup} error={passError}>
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="First name"
                    isInvalid={error.firstName}
                    value={signup.firstName}
                    onChange={(e) => setSignup({
                        ...signup,
                        first: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Last name"
                    isInvalid={error.lastName}
                    value={signup.lastName}
                    onChange={(e) => setSignup({
                        ...signup,
                        last: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Email"
                    isInvalid={error.email}
                    value={signup.email}
                    onChange={(e) => setSignup({
                        ...signup,
                        email: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Username"
                    isInvalid={error.username}
                    value={signup.username}
                    onChange={(e) => setSignup({
                        ...signup,
                        user: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    type="dual"
                    placeholder="Password"
                    isInvalid={error.password}
                    value={signup.password}
                    onChange={(e) => setSignup({
                        ...signup,
                        pass: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow isInvalid={error.passConfirm} error={passError}>
                <EuiFieldPassword
                    type="dual"
                    placeholder="Confirm Password"
                    isInvalid={error.passConfirm}
                    value={signup.passConfirm}
                    onChange={(e) => setSignup({
                        ...signup,
                        passConfirm: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiButton type="submit">
                    Sign Up
                </EuiButton>
            </EuiFormRow>
        </EuiForm>
    );
}

const tabs = [
    {
        id: 'signup',
        name: 'Sign Up',
        content: (
            <SignupForm />
        )
    },
    {
        id: 'login',
        name: 'Login',
        content: (
            <LoginForm />
        )
    }
];

export function AuthCardContent() {
    return (
        <EuiTabbedContent
            tabs={tabs}
            expand={true}
            initialSelectedTab={tabs[0]}
        />
    )
}

export default function AuthCard() {
    return (
        <EuiCard
            style={{ width: 320}}
            title={`OpenPRA App`}
            icon={<img src={OpenPRALogo} alt="OpenPRA Logo" />}
            isDisabled={false}
            hasBorder
            description="Build: v0.0.1"
            footer={<AuthCardContent />}
            />
    )
}

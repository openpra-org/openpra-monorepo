import React from "react";
import { useState, useEffect } from "react";
import {EuiTabbedContent, EuiFieldText, EuiForm, EuiText, EuiLink, EuiButton, EuiBottomBar, EuiSelect, EuiFormRow, EuiFieldPassword, EuiCard, EuiSpacer} from "@elastic/eui";

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';



function LoginForm() {

    const [login, setLogin] =
        useState({user: '', pass: ''});
    const [error, setError] =
        useState({user: false, pass: false});

    function handleLogin() {
        console.log('Login');
    }

    //Corrects the isInvalid when a user types something in a blank input field
    useEffect(() => {
        if(login.user && error.user) {
            setError({
                ...error,
                user: false
            })
        }
        if(login.pass && error.pass) {
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
            user: (!login.user),
            pass: (!login.pass)
        }

        setError({
            user: (!login.user),
            pass: (!login.pass)
        })

        //makes sure all input fields are not empty
        if(!errorCheck.user && !errorCheck.pass) {
            handleLogin()
        }
    }

    return (
        <EuiForm component="form" onSubmit={validateLogin}>
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Username"
                    isInvalid={error.user}
                    value={login.user}
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
                    isInvalid={error.pass}
                    value={login.pass}
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

    const [signup, setSignup] =
        useState({first: '', last: '', email: '', user: '', pass: '', passConfirm: ''})
    const [error, setError] =
        useState({first: false, last: false, email: false, user: false, pass: false, passConfirm: false})
    let passError = '';


    function handleSignup() {
        console.log('signup')
    }

    //Corrects the isInvalid when a user types something in a blank input field
    useEffect(() => {
        if(signup.first && error.first) {
            setError({
                ...error,
                first: false
            })
        }
        if(signup.last && error.last) {
            setError({
                ...error,
                last: false
            })
        }
        if(signup.email && error.email) {
            setError({
                ...error,
                email: false
            })
        }
        if(signup.user && error.user) {
            setError({
                ...error,
                user: false
            })
        }
        if(signup.pass && error.pass) {
            setError({
                ...error,
                pass: false
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

        const confirmPasswords = (signup.pass === signup.passConfirm);
        console.log(confirmPasswords);

        //need errorCheck in the later if statement due to how states and renders work
        let errorCheck = error;
        errorCheck = {
            first: (!signup.first),
            last: (!signup.last),
            email: (!signup.email),
            user: (!signup.user),
            pass: (!signup.pass),
            passConfirm: (!signup.passConfirm || !confirmPasswords)
        }

        setError({
            first: (!signup.first),
            last: (!signup.last),
            email: (!signup.email),
            user: (!signup.user),
            pass: (!signup.pass),
            passConfirm: (!signup.passConfirm || !confirmPasswords)
        })

        passError = (!confirmPasswords ? 'Passwords do not match' : '');
        console.log(passError);

        //makes sure all input fields are not empty and that both passwords match
        if(
            !errorCheck.first && !errorCheck.last && !errorCheck.email && !errorCheck.user &&
            !errorCheck.pass && !errorCheck.passConfirm && confirmPasswords
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
                    isInvalid={error.first}
                    value={signup.first}
                    onChange={(e) => setSignup({
                        ...signup,
                        first: e.target.value
                    })}
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    placeholder="Last name"
                    isInvalid={error.last}
                    value={signup.last}
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
                    isInvalid={error.user}
                    value={signup.user}
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
                    isInvalid={error.pass}
                    value={signup.pass}
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

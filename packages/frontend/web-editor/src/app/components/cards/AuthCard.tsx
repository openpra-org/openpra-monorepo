import React from "react";
import { useState, useEffect } from "react";
import {EuiTabbedContent, EuiFieldText, EuiForm, EuiText, EuiLink, EuiButton, EuiBottomBar, EuiSelect, EuiFormRow, EuiFieldPassword, EuiCard} from "@elastic/eui";

import OpenPRALogo from '../../../assets/images/logos/OpenPRA_vs_0.1x.png';



function LoginForm() {

    const [login, setLogin] =
        useState({user: '', pass: ''});
    const [error, setError] =
        useState({user: false, pass: false});

    function handleLogin() {
        console.log('Login');
    }

    //Corrects the isInvalid when a user types something in the input field
    useEffect(() => {
        if(login.user && error.user == true) {
            setError({
                ...error,
                user: false
            })
        }
        if(login.pass && error.pass == true) {
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
            user: (!login.user ? true: false),
            pass: (!login.pass ? true: false)
        }

        setError({
            user: (!login.user ? true: false),
            pass: (!login.pass ? true: false)
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
                    placeholder="Password"
                    isInvalid={error.pass}
                    type="dual"
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
    return (
        <EuiForm component="form">
            <br/>
            <EuiFormRow>
                <EuiFieldText
                    name="firstName"
                    placeholder="First name"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="lastName"
                    placeholder="Last name"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="email"
                    placeholder="Email"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldText
                    name="signUsername"
                    placeholder="Username"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    name="signPassword"
                    placeholder="Password"
                    type="dual"
                />
            </EuiFormRow>
            <EuiFormRow>
                <EuiFieldPassword
                    name="signPasswordConfirm"
                    placeholder="Confirm Password"
                    type="dual"
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

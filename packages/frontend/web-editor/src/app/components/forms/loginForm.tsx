import React from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
    EuiFieldText,
    EuiForm,
    EuiButton,
    EuiFormRow,
    EuiFieldPassword
} from "@elastic/eui";
import { LoginProps, LoginErrorProps } from "shared-types/src/lib/api/AuthTypes";
import ApiManager from "shared-types/src/lib/api/ApiManager";

export default function LoginForm() {
    console.log("LoginForm(), 1");
    const DefaultProps: LoginProps = {
        username: '',
        password: '',
    }
    const DefaultErrorProps: LoginErrorProps = {
        username: false,
        password: false,
    }

    const [login, setLogin] = useState(DefaultProps);
    const [error, setError] = useState(DefaultErrorProps);
    const [ redirectToHomepage, setRedirectToHomepage ] = useState(false);

    function handleLogin() {
        console.log("handleLogin(), 9");
        const { username, password } = login;
        ApiManager.signInWithUsernameAndPassword(username, password)
            .then(() => {
                if(ApiManager.isLoggedIn()) {
                    setRedirectToHomepage(true)
                }
            })
    }

    //Corrects the isInvalid when a user types something in a blank input field
    useEffect(() => {
        if(login.username && error.username) {
            setError({
                ...error,
                username: false
            })
        }
        if(login.password && error.password) {
            setError({
                ...error,
                password: false
            })
        }
    }, [login])

    function validateLogin(e: React.FormEvent<HTMLFormElement>): void {
        e.preventDefault()

        //need errorCheck in the later if statement due to how states and renders work
        const errorCheck = {
            username: (!login.username),
            password: (!login.password)
        }

        setError({
            username: (!login.username),
            password: (!login.password)
        })

        //makes sure all input fields are not empty
        if(!errorCheck.username && !errorCheck.password) {
            handleLogin()
        }
    }

    if(redirectToHomepage) {
        return (
            <Navigate to="models" replace={true} />
        );
    } else {
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
                            username: e.target.value
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
                            password: e.target.value
                        })}
                    />
                </EuiFormRow>
                <EuiFormRow>
                    <EuiButton
                      fullWidth
                      type="submit">
                        Login
                    </EuiButton>
                </EuiFormRow>
            </EuiForm>
        );
    }
}

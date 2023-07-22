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
    const [invalid, setInvalid] = useState(false);
    const [ redirectToHomepage, setRedirectToHomepage ] = useState(false);


    //if (error.username == true || error.password == true) {
    const    errors = [
            'invalid username or password',
        ]
    //}

    function handleLogin() {
        setInvalid(false)
        const { username, password } = login;
        ApiManager.signInWithUsernameAndPassword(username, password, handleLoginError)
            .then(() => {
                if(ApiManager.isLoggedIn()) {
                    setRedirectToHomepage(true)
                } else {
                    setInvalid(true)
                }
            })
    }

    //Used as a callback to print errors hooray
    function handleLoginError() {
        setError({
            ...error,
            password: true
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
            <Navigate to="internal-events" replace={true} />
        );
    } else {
        return (
            <EuiForm component="form" onSubmit={validateLogin}>
                <br/>
                <EuiFormRow isInvalid={error.username} error='Invalid Username'>
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
                <EuiFormRow isInvalid={error.password} error='Invalid Password'>
                    <EuiFieldPassword
                        type="dual"
                        placeholder="Password"
                        value={login.password}
                        isInvalid={error.password}
                        onChange={(e) => setLogin({
                            ...login,
                            password: e.target.value
                        })}
                    />
                </EuiFormRow>
                <EuiFormRow isInvalid={invalid} error="Invalid username or password">
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

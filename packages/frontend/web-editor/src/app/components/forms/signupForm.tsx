import React from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  EuiFieldText,
  EuiForm,
  EuiButton,
  EuiFormRow,
  EuiFieldPassword,
} from "@elastic/eui";
import {
  SignUpErrorProps,
  SignUpProps,
} from "shared-types/src/lib/api/AuthTypes";
import ApiManager from "shared-types/src/lib/api/ApiManager";

export default function SignupForm() {
  const defaultProps: SignUpProps = {
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    passConfirm: "",
  };
  const defaultErrorProps: SignUpErrorProps = {
    username: false,
    email: false,
    firstName: false,
    lastName: false,
    password: false,
    passConfirm: false,
  };
  const [signup, setSignup] = useState(defaultProps);
  const [error, setError] = useState(defaultErrorProps);
  const [redirectToHomepage, setRedirectToHomepage] = useState(
    ApiManager.isLoggedIn(),
  );

  let passError = "";

  function handleSignup() {
    const { passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
          setRedirectToHomepage(true);
        }
      })
      .catch((signInError) => {

        if (signInError.message.includes("Internal Server Error")) {
          setError({
            ...error,
            username: true,
          });
        } else {
          setError({
            ...error,
            email: true,
          });
        }
      });
  }

  //Corrects the isInvalid when a user types something in a blank input field
  useEffect(() => {
    if (signup.firstName && error.firstName) {
      setError({
        ...error,
        firstName: false,
      });
    }
    if (signup.lastName && error.lastName) {
      setError({
        ...error,
        lastName: false,
      });
    }
    if (signup.email && error.email) {
      setError({
        ...error,
        email: false,
      });
    }
    if (signup.username && error.username) {
      setError({
        ...error,
        username: false,
      });
    }
    if (signup.password && error.password) {
      setError({
        ...error,
        password: false,
      });
    }
    if (signup.passConfirm && error.passConfirm) {
      setError({
        ...error,
        passConfirm: false,
      });
    }
  }, [signup]);

  function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();

    const confirmPasswords = signup.password === signup.passConfirm;

    //need errorCheck in the later if statement due to how states and renders work
    const errorCheck = {
      firstName: !signup.firstName,
      lastName: !signup.lastName,
      email: !signup.email,
      username: !signup.username,
      password: !signup.password,
      passConfirm: !signup.passConfirm || !confirmPasswords,
    };

    setError({
      firstName: !signup.firstName,
      lastName: !signup.lastName,
      email: !signup.email,
      username: !signup.username,
      password: !signup.password,
      passConfirm: !signup.passConfirm || !confirmPasswords,
    });

    passError = !confirmPasswords ? "Passwords do not match" : "";

    //makes sure all input fields are not empty and that both passwords match
    if (
      !errorCheck.firstName &&
      !errorCheck.lastName &&
      !errorCheck.email &&
      !errorCheck.username &&
      !errorCheck.password &&
      !errorCheck.passConfirm &&
      confirmPasswords
    ) {
      handleSignup();
    }
  }

  if (redirectToHomepage) {
    return <Navigate to="internal-events" replace={true} />;
  } else {
    return (
      <EuiForm component="form" onSubmit={validateSignup} error={passError}>
        <br />
        <EuiFormRow
          isInvalid={error.firstName}
          error="First name is empty"
        >
          <EuiFieldText
            placeholder="First name"
            isInvalid={error.firstName}
            value={signup.firstName}
            onChange={(e) => {
              setSignup({
                ...signup,
                firstName: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={error.lastName}
          error="Last name is empty">
          <EuiFieldText
            placeholder="Last name"
            isInvalid={error.lastName}
            value={signup.lastName}
            onChange={(e) => {
              setSignup({
                ...signup,
                lastName: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow isInvalid={error.email} error="Invalid Email">
          <EuiFieldText
            placeholder="Email"
            isInvalid={error.email}
            value={signup.email}
            onChange={(e) => {
              setSignup({
                ...signup,
                email: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow isInvalid={error.username} error="Invalid Username">
          <EuiFieldText
            placeholder="Username"
            isInvalid={error.username}
            value={signup.username}
            onChange={(e) => {
              setSignup({
                ...signup,
                username: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow>
          <EuiFieldPassword
            type="dual"
            placeholder="Password"
            isInvalid={error.password}
            value={signup.password}
            onChange={(e) => {
              setSignup({
                ...signup,
                password: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={error.passConfirm}
          error="Passwords do not match"
        >
          <EuiFieldPassword
            type="dual"
            placeholder="Confirm Password"
            isInvalid={error.passConfirm}
            value={signup.passConfirm}
            onChange={(e) => {
              setSignup({
                ...signup,
                passConfirm: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow>
          <EuiButton fullWidth type="submit">
            Sign Up
          </EuiButton>
        </EuiFormRow>
      </EuiForm>
    );
  }
}

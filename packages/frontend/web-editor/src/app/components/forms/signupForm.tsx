import React from "react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  EuiFieldText,
  EuiForm,
  EuiButton,
  EuiFormRow,
  EuiFieldPassword,
} from "@elastic/eui";
import { SignUpProps } from "shared-types/src/lib/api/AuthTypes";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { PasswordForm } from "./passwordForm";

function SignupForm(): JSX.Element {
  const defaultProps: SignUpProps = {
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    passConfirm: "",
  };

  const [signup, setSignup] = useState(defaultProps);
  const [signupButtonClicked, setSignupButtonClicked] = useState(false);
  const [isValidUsername, setIsValidUsername] = useState(true);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [redirectToHomepage, setRedirectToHomepage] = useState(
    ApiManager.isLoggedIn(),
  );

  function handleSignup(): void {
    const { passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
          setRedirectToHomepage(true);
        }
      })
      .catch((signInError) => {
        if (signInError.message === "Conflict") {
          setIsValidUsername(false);
        } else if (signInError.message === "Bad Request") {
          setIsValidEmail(false);
        }
      });
  }

  function isPasswordMatching(): boolean {
    return signup.password === signup.passConfirm;
  }

  function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSignupButtonClicked(true);
    if (isPasswordMatching()) {
      handleSignup();
    }
  }

  if (redirectToHomepage) {
    return <Navigate to="internal-events" replace={true} />;
  } else {
    return (
      <EuiForm component="form" onSubmit={validateSignup}>
        <br />
        <EuiFormRow
          isInvalid={!signup.firstName && signupButtonClicked}
          error="First name is empty"
        >
          <EuiFieldText
            placeholder="First name"
            isInvalid={!signup.firstName && signupButtonClicked}
            value={signup.firstName}
            onChange={(e): void => {
              setSignup({
                ...signup,
                firstName: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={!signup.lastName && signupButtonClicked}
          error="Last name is empty"
        >
          <EuiFieldText
            placeholder="Last name"
            isInvalid={!signup.lastName && signupButtonClicked}
            value={signup.lastName}
            onChange={(e): void => {
              setSignup({
                ...signup,
                lastName: e.target.value,
              });
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={(!isValidEmail || !signup.email) && signupButtonClicked}
          helpText={
            (!isValidEmail || !signup.email) && signupButtonClicked
              ? ""
              : "Eg. xyz@ncsu.edu"
          }
          error="Email invalid or already exists!"
        >
          <EuiFieldText
            placeholder="Email"
            isInvalid={(!isValidEmail || !signup.email) && signupButtonClicked}
            value={signup.email}
            onChange={(e): void => {
              setSignup({
                ...signup,
                email: e.target.value,
              });
              setIsValidEmail(true);
            }}
          />
        </EuiFormRow>
        <EuiFormRow
          isInvalid={
            (!isValidUsername || !signup.username) && signupButtonClicked
          }
          error="Username already exists!"
        >
          <EuiFieldText
            placeholder="Username"
            isInvalid={
              (!isValidUsername || !signup.username) && signupButtonClicked
            }
            value={signup.username}
            onChange={(e): void => {
              setSignup({
                ...signup,
                username: e.target.value,
              });
              setIsValidUsername(true);
            }}
          />
        </EuiFormRow>
        <PasswordForm
          signup={signup}
          setSignup={setSignup}
          signupButtonClicked={signupButtonClicked}
        />
        <EuiFormRow>
          <EuiButton fullWidth type="submit">
            Sign Up
          </EuiButton>
        </EuiFormRow>
      </EuiForm>
    );
  }
}

export { SignupForm };

import { EuiFieldText, EuiFormRow } from "@elastic/eui";
import React, { ReactElement } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";

/**
 * Properties for the UsernameForm component.
 */
export interface UsernameFormProps {
  /** The current sign-up state object. */
  signup: SignUpPropsWithRole;
  /** Function to update the sign-up state object. */
  setSignup: (signup: SignUpPropsWithRole) => void;
  /** Indicates if the signup button has been clicked. */
  signupButtonClicked: boolean;
  /** Indicates if the email is valid. */
  isValidEmail: boolean;
  /** Function to set the email validity state. */
  setIsValidEmail: (val: boolean) => void;
  /** Indicates if the username is valid. */
  isValidUsername: boolean;
  /** Function to set the username validity state. */
  setIsValidUsername: (val: boolean) => void;
  /** If true, empty form fields will be validated; otherwise, they will not. */
  checkEmpty: boolean;
}

/**
 * Renders a form with fields for first name, last name, email, and username.
 * @param props - The properties for the UsernameForm.
 * @returns A ReactElement representing the form.
 */
export const UsernameForm = ({
  signup,
  setSignup,
  signupButtonClicked,
  isValidEmail,
  setIsValidEmail,
  isValidUsername,
  setIsValidUsername,
  checkEmpty,
}: UsernameFormProps): ReactElement => (
  <>
    <EuiFormRow
      isInvalid={!signup.firstName && checkEmpty && signupButtonClicked}
      error="First name is empty"
    >
      <EuiFieldText
        placeholder="First name"
        isInvalid={!signup.firstName && checkEmpty && signupButtonClicked}
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
      isInvalid={!signup.lastName && checkEmpty && signupButtonClicked}
      error="Last name is empty"
    >
      <EuiFieldText
        placeholder="Last name"
        isInvalid={!signup.lastName && checkEmpty && signupButtonClicked}
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
      isInvalid={(!isValidEmail || (!signup.email && checkEmpty)) && signupButtonClicked}
      error="Email invalid or already exists!"
    >
      <EuiFieldText
        placeholder="Email"
        isInvalid={(!isValidEmail || (!signup.email && checkEmpty)) && signupButtonClicked}
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
      isInvalid={(!isValidUsername || (!signup.username && checkEmpty)) && signupButtonClicked}
      error="Username already exists!"
    >
      <EuiFieldText
        placeholder="Username"
        isInvalid={(!isValidUsername || (!signup.username && checkEmpty)) && signupButtonClicked}
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
  </>
);

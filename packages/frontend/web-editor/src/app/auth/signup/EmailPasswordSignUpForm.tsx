import { EuiButton, EuiForm, EuiFormRow } from "@elastic/eui";
import React, { ReactElement } from "react";
import { useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { MatchPasswordsFieldText } from "./MatchPasswordsFieldText";
import { EmailFieldText } from "./EmailFieldText";

/**
 * The main signup Form component
 * @param handleSignup - This function will be called when user clicks on the button in the form
 * @param signup - The state object which holds the user object
 * @param setSignup - The function which will change the state object
 * @param buttonText - The text which should be shown on the button
 */
const EmailPasswordSignUpForm = ({
  handleSignup,
  signup,
  setSignup,
  buttonText,
}: {
  handleSignup: () => void;
  signup: SignUpPropsWithRole;
  setSignup: (signupProps: SignUpPropsWithRole) => void;
  buttonText: string;
}): ReactElement => {
  const [signupButtonClicked, setSignupButtonClicked] = useState(false);
  const [isValidUsername, setIsValidUsername] = useState(true);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const { addToast } = UseToastContext();

  /**
   * This function will validate form validation
   * @param e - The form component
   */
  function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
    const emailValidation: EmailValidationForm = {
      email: signup.email,
    };
    const usernameValidation: UsernameValidationForm = {
      username: signup.username,
    };
    e.preventDefault();
    setSignupButtonClicked(true);
    // Check if email is valid, if email is valid check if username is valid, if valid handle sign up
    ApiManager.isValidEmail(JSON.stringify(emailValidation))
      .then((isValidEmail: boolean) => {
        setIsValidEmail(isValidEmail);
        if (isValidEmail) {
          ApiManager.isValidUsername(JSON.stringify(usernameValidation))
            .then((isValidUsername: boolean) => {
              setIsValidUsername(isValidUsername);
              if (isValidUsername) {
                if (signup.password === signup.passConfirm) {
                  handleSignup();
                }
              }
            })
            .catch((_) => {
              addToast({
                id: GenerateUUID(),
                color: "danger",
                text: "Something went wrong while validating username",
              });
            });
        }
      })
      .catch((_) => {
        addToast({
          id: GenerateUUID(),
          color: "danger",
          text: "Something went wrong while validating email",
        });
      });
  }

  return (
    <EuiForm
      component="form"
      fullWidth
      isInvalid
      invalidCallout="above"
      error={
        <>
          <div>error</div>
          <div>error</div>
        </>
      }
      onSubmit={validateSignup}
    >
      <br />
      {/*<UsernameForm*/}
      {/*  signup={signup}*/}
      {/*  setSignup={setSignup}*/}
      {/*  signupButtonClicked={signupButtonClicked}*/}
      {/*  isValidEmail={isValidEmail}*/}
      {/*  setIsValidEmail={setIsValidEmail}*/}
      {/*  isValidUsername={isValidUsername}*/}
      {/*  setIsValidUsername={setIsValidUsername}*/}
      {/*  checkEmpty={true}*/}
      {/*/>*/}
      <EmailFieldText />
      <MatchPasswordsFieldText
        signup={signup}
        setSignup={setSignup}
        signupButtonClicked={signupButtonClicked}
      />
      <EuiFormRow>
        <EuiButton
          fullWidth
          type="submit"
          disabled
        >
          {buttonText}
        </EuiButton>
      </EuiFormRow>
    </EuiForm>
  );
};

export { EmailPasswordSignUpForm };

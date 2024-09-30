import { EuiForm, EuiFormRow, EuiButton, EuiFlexGroup, EuiFlexItem, EuiText } from "@elastic/eui";
import React, { useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { PasswordForm } from "./passwordForm";
import { UsernameForm } from "./usernameForm";

/**
 * The main signup Form component
 * @param handleSignup - This function will be called when user clicks on the button in the form
 * @param signup - The state object which holds the user object
 * @param setSignup - The function which will change the state object
 * @param buttonText - The text which should be shown on the button
 */
const SignUpForm = ({
  handleSignup,
  signup,
  setSignup,
  buttonText,
}: {
  handleSignup: () => void;
  signup: SignUpPropsWithRole;
  setSignup: (signupProps: SignUpPropsWithRole) => void;
  buttonText: string;
}): JSX.Element => {
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

  function handleOpenPRAHubSignup() {
    console.log("OpenPRA Hub signup button clicked");
  }

  return (
    <EuiForm
      component="form"
      onSubmit={validateSignup}
    >
      <br />
      <UsernameForm
        signup={signup}
        setSignup={setSignup}
        signupButtonClicked={signupButtonClicked}
        isValidEmail={isValidEmail}
        setIsValidEmail={setIsValidEmail}
        isValidUsername={isValidUsername}
        setIsValidUsername={setIsValidUsername}
        buttonText={buttonText}
        checkEmpty={true}
      />
      <PasswordForm
        signup={signup}
        setSignup={setSignup}
        signupButtonClicked={signupButtonClicked}
      />
      <EuiFormRow>
        <EuiButton
          fullWidth
          type="submit"
        >
          {buttonText}
        </EuiButton>
      </EuiFormRow>
      <EuiFlexGroup
        gutterSize="none"
        alignItems="center"
      >
        <EuiFlexItem>
          <hr style={{ border: "none", borderTop: "1px solid #d3dae6", margin: "1" }} />
        </EuiFlexItem>
        <EuiFlexItem
          grow={false}
          style={{ padding: "0 20px" }}
        >
          <EuiText size="s">OR</EuiText>
        </EuiFlexItem>
        <EuiFlexItem>
          <hr style={{ border: "none", borderTop: "1px solid #d3dae6", margin: "0" }} />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiFormRow>
        <EuiButton
          fullWidth
          size="m"
          onClick={handleOpenPRAHubSignup}
        >
          <EuiFlexGroup
            justifyContent="center"
            alignItems="center"
            gutterSize="xs"
          >
            <EuiFlexItem grow={false}>
              <img
                src="https://hub.openpra.org/hub/auth/favicon.ico"
                alt="OpenPRA Hub"
                style={{ width: "20px", height: "20px", marginRight: "5px" }}
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>Sign up using OpenPRA Hub</EuiFlexItem>
          </EuiFlexGroup>
        </EuiButton>
      </EuiFormRow>
    </EuiForm>
  );
};

export { SignUpForm };

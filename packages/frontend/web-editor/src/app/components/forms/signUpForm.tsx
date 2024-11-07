import { EuiButton, EuiForm, EuiFormRow } from "@elastic/eui";
import React, { useEffect, useMemo } from "react";
import { useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { checkEmail, checkUserName } from "../../../utils/authUtils";
import { PasswordForm } from "./passwordForm";
import { UsernameForm } from "./usernameForm";

/**
 * The main signup Form component
 * @param handleSignup - This function will be called when user clicks on the button in the form
 * @param signup - The state object which holds the user object
 * @param setSignup - The function which will change the state object
 * @param buttonText - The text which should be shown on the button.
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

  const debouncedCheckUserName = useMemo(
    () =>
      checkUserName((validationResult) => {
        setIsValidUsername(validationResult);
      }),
    [],
  );

  const debouncedCheckEmail = useMemo(
    () =>
      checkEmail((validationResult) => {
        setIsValidEmail(validationResult);
      }),
    [],
  );

  useEffect(() => {
    debouncedCheckUserName(signup);
  }, [signup.username, debouncedCheckUserName]);

  useEffect(() => {
    if (signup.email.length === 0 && !signupButtonClicked) {
      setIsValidEmail(true);
      return;
    }
    debouncedCheckEmail(signup);
  }, [signup.email, debouncedCheckEmail]);

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
    </EuiForm>
  );
};

export { SignUpForm };

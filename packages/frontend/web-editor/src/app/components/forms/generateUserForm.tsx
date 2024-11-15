import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiForm, EuiFormRow, EuiSelect, EuiText } from "@elastic/eui";
import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EuiSelectOption } from "@elastic/eui/src/components/form/select/select";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { UsernameForm } from "./usernameForm";

/**
 * This is a user form for inviting a new User to the app
 * @param buttonText - The button text
 * @param handleSignup - The function to be called when user clicks on the button
 * @param signup - The user data object (must be a state variable)
 * @param setSignup - The function to update the user data object (must be a state update function)
 * @param options - The options for expiry drop down
 * @param expiry - The expiry value state
 * @param onValueChange - State update function for expiry value
 */
const GenerateUserForm = ({
  buttonText,
  handleSignup,
  signup,
  setSignup,
  options,
  expiry,
  onValueChange,
}: {
  buttonText: string;
  handleSignup: () => void;
  signup: SignUpPropsWithRole;
  setSignup: (val: SignUpPropsWithRole) => void;
  options: EuiSelectOption[];
  expiry: number;
  onValueChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element => {
  const [signupButtonClicked, setSignupButtonClicked] = useState(false);
  const [isValidUsername, setIsValidUsername] = useState(true);
  const [isValidEmail, setIsValidEmail] = useState(true);
  const { addToast } = UseToastContext();

  function validateDetails(e: React.FormEvent<HTMLFormElement>): void {
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
                handleSignup();
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

  type CheckEmailFunction = (callback: (validationResult: boolean) => void) => (signup: SignUpPropsWithRole) => void;
  type CheckUserNameFunction = (callback: (validationResult: boolean) => void) => (signup: SignUpPropsWithRole) => void;

  const debouncedCheckUserName: (signup: SignUpPropsWithRole) => void = useMemo(() => {
    const checkUserName: CheckUserNameFunction = ApiManager.checkUserName;
    return checkUserName((validationResult: boolean) => {
      setIsValidUsername(validationResult);
    });
  }, []);

  const debouncedCheckEmail = useMemo(() => {
    const checkEmail: CheckEmailFunction = ApiManager.checkEmail;
    return checkEmail((validationResult: boolean) => {
      setIsValidEmail(validationResult);
    });
  }, []);

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
      onSubmit={validateDetails}
    >
      <UsernameForm
        signup={signup}
        setSignup={setSignup}
        signupButtonClicked={signupButtonClicked}
        isValidEmail={isValidEmail}
        setIsValidEmail={setIsValidEmail}
        isValidUsername={isValidUsername}
        setIsValidUsername={setIsValidUsername}
        buttonText={buttonText}
        checkEmpty={false}
      />
      <EuiFormRow>
        <EuiFlexGroup alignItems={"center"}>
          <EuiFlexItem grow={false}>
            <EuiText
              size={"s"}
              textAlign={"center"}
            >
              Expires in:{" "}
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={true}>
            <EuiSelect
              id={"SelectId"}
              options={options}
              value={expiry}
              onChange={onValueChange}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFormRow>
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

export { GenerateUserForm };

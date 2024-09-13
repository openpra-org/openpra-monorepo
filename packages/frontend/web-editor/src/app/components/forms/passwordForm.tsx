import { EuiFieldPassword, EuiFormRow } from "@elastic/eui";
import React, { ReactElement } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";

const PasswordForm = ({
  signup,
  setSignup,
  signupButtonClicked,
}: {
  signup: SignUpPropsWithRole;
  setSignup: (signup: SignUpPropsWithRole) => void;
  signupButtonClicked: boolean;
}): ReactElement => (
  <>
    <EuiFormRow>
      <EuiFieldPassword
        type="dual"
        placeholder="Password"
        isInvalid={!signup.password && signupButtonClicked}
        value={signup.password}
        onChange={(e): void => {
          setSignup({
            ...signup,
            password: e.target.value,
          });
        }}
      />
    </EuiFormRow>
    <EuiFormRow
      isInvalid={!(signup.passConfirm === signup.password) && signupButtonClicked}
      error="Passwords do not match"
    >
      <EuiFieldPassword
        type="dual"
        placeholder="Confirm Password"
        isInvalid={!(signup.passConfirm === signup.password) && signupButtonClicked}
        value={signup.passConfirm}
        onChange={(e): void => {
          setSignup({
            ...signup,
            passConfirm: e.target.value,
          });
        }}
      />
    </EuiFormRow>
  </>
);

export { PasswordForm };

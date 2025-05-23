import { EuiFieldPassword, EuiFormRow } from "@elastic/eui";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";

const PasswordForm = ({
  signup,
  setSignup,
  signupButtonClicked,
}: {
  signup: SignUpPropsWithRole;
  setSignup: (signup: SignUpPropsWithRole) => void;
  signupButtonClicked: boolean;
}): JSX.Element => (
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
      isInvalid={
        (!(signup.passConfirm === signup.password) && signup.passConfirm.length > 0) ||
        (!signup.passConfirm && signupButtonClicked)
      }
      error="Passwords do not match"
    >
      <EuiFieldPassword
        type="dual"
        placeholder="Confirm Password"
        isInvalid={!(signup.passConfirm === signup.password) && signup.passConfirm.length > 0}
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

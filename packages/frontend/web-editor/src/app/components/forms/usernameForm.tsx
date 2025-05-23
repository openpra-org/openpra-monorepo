import { EuiFieldText, EuiFormRow } from "@elastic/eui";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";

/**
 * This is form with the following details: Firstname, Lastname, Email and Username
 * @param signup - The SignUpProps state object
 * @param setSignup - The function to update singup state object
 * @param signupButtonClicked - The function callback when signup is clicked
 * @param isValidEmail - boolean state object to check if email is valid
 * @param setIsValidEmail - isValidEmail state object update function
 * @param isValidUsername - boolean state object to check if username is valid
 * @param setIsValidUsername - isValidUsername state object update function
 * @param checkEmpty - If true, will add empty form field validation else will not check empty fields
 */
const UsernameForm = ({
  signup,
  setSignup,
  signupButtonClicked,
  isValidEmail,
  setIsValidEmail,
  isValidUsername,
  setIsValidUsername,
  checkEmpty,
}: {
  signup: SignUpPropsWithRole;
  setSignup: (signup: SignUpPropsWithRole) => void;
  signupButtonClicked: boolean;
  isValidEmail: boolean;
  setIsValidEmail: (val: boolean) => void;
  isValidUsername: boolean;
  setIsValidUsername: (val: boolean) => void;
  buttonText: string;
  checkEmpty: boolean;
}): JSX.Element => (
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
      isInvalid={!isValidEmail || (!signup.email && checkEmpty && signupButtonClicked)}
      helpText={(!isValidEmail || (!signup.email && checkEmpty)) && signupButtonClicked ? "" : "Eg. xyz@ncsu.edu"}
      error="Email invalid or already exists!"
    >
      <EuiFieldText
        placeholder="Email"
        isInvalid={!isValidEmail || (!signup.email && checkEmpty && signupButtonClicked)}
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
      isInvalid={!isValidUsername || (!signup.username && checkEmpty && signupButtonClicked)}
      error={`Username ${isValidUsername ? "is invalid!" : "already exists!"}`}
    >
      <EuiFieldText
        placeholder="Username"
        isInvalid={!isValidUsername || (!signup.username && checkEmpty && signupButtonClicked)}
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

export { UsernameForm };

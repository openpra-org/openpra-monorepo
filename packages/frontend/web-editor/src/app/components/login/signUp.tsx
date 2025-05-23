import { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { AuthService } from "shared-types/src/lib/api/AuthService";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { MemberRole } from "shared-types/src/lib/data/predefiniedRoles";

import { GenerateUUID } from "../../../utils/treeUtils";
import { UpdateAbility } from "../../casl/ability";
import { AbilityContext } from "../../providers/abilityProvider";
import { UseToastContext } from "../../providers/toastProvider";
import { SignUpForm } from "../forms/signUpForm";

const DefaultSignupProps: SignUpPropsWithRole = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  passConfirm: "",
  roles: [MemberRole],
};

/**
 * This is a wrapper component for the SignUp Form. Mainly because we want to decouple the form for reuse
 */
const SignUp = (): JSX.Element => {
  const [signup, setSignup] = useState<SignUpPropsWithRole>(DefaultSignupProps);
  const { addToast } = UseToastContext();
  const ability = useContext(AbilityContext);
  const [redirectToHomepage, setRedirectToHomepage] = useState(
    ApiManager.isLoggedIn(),
  );

  /**
   * The function to call when user clicks on signup
   */
  function handleSignup(): void {
    const { passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
          UpdateAbility(ability, AuthService.getRole());
          setRedirectToHomepage(true);
        }
      })
      .catch((signInError: { message: string }) => {
        // Send a toast message saying there was an error while logging in
        addToast({
          id: GenerateUUID(),
          color: "danger",
          text: `Error while signing in: ${signInError.message}`,
        });
      });
  }

  if (redirectToHomepage) {
    return (
      <Navigate
        to="/internal-events"
        replace
      />
    );
  } else {
    return (
      <SignUpForm
        handleSignup={handleSignup}
        signup={signup}
        setSignup={setSignup}
        buttonText={"Sign Up"}
      />
    );
  }
};

export { DefaultSignupProps, SignUp };

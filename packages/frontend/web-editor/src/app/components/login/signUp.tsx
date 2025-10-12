import React, { useContext } from "react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { SignUpPropsWithRole } from "shared-sdk/lib/api/AuthTypes";
import { ApiManager } from "shared-sdk/lib/api/ApiManager";
import { AuthService } from "shared-sdk/lib/api/AuthService";
import { MemberRole } from "shared-sdk/lib/data/predefiniedRoles";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { SignUpForm } from "../forms/signUpForm";
import { UpdateAbility } from "../../casl/ability";
import { AbilityContext } from "../../providers/abilityProvider";

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
function SignUp(): JSX.Element {
  const [signup, setSignup] = useState<SignUpPropsWithRole>(DefaultSignupProps);
  const { addToast } = UseToastContext();
  const ability = useContext(AbilityContext);
  const [redirectToHomepage, setRedirectToHomepage] = useState(ApiManager.isLoggedIn());

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
        replace={true}
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
}

export { SignUp, DefaultSignupProps };

import React from "react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { SignUpProps } from "shared-types/src/lib/api/AuthTypes";
import ApiManager from "shared-types/src/lib/api/ApiManager";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { SignUpForm } from "../forms/signUpForm";

const DefaultProps: SignUpProps = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  passConfirm: "",
};

/**
 * This is a wrapper component for the SignUp Form. Mainly because we want to decouple the form for reuse
 */
function SignUp(): JSX.Element {
  const [signup, setSignup] = useState(DefaultProps);
  const { addToast } = UseToastContext();

  const [redirectToHomepage, setRedirectToHomepage] = useState(ApiManager.isLoggedIn());

  /**
   * The function to call when user clicks on signup
   */
  function handleSignup(): void {
    const { passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
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
        buttonText={"Sign In"}
      />
    );
  }
}

export { SignUp, DefaultProps };

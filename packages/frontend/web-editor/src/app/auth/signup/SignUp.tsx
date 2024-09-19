import React, { ReactElement } from "react";
import { useState } from "react";
import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { AuthService } from "shared-types/src/lib/api/AuthService";
import { MemberRole } from "shared-types/src/lib/data/predefiniedRoles";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";
import { UpdateAbility } from "../../providers/ability/Ability";
import { UseAbilityContext } from "../../providers/ability/AbilityProvider";
import { EmailPasswordSignUpForm } from "./EmailPasswordSignUpForm";

const DefaultSignupProps: SignUpPropsWithRole = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  passConfirm: "",
  roles: [MemberRole],
};

function SignUp(): ReactElement {
  const [signup, setSignup] = useState<SignUpPropsWithRole>(DefaultSignupProps);
  const { addToast } = UseToastContext();
  const ability = UseAbilityContext();

  function handleSignup(): void {
    const { passConfirm, ...signupData } = signup;
    ApiManager.signup(signupData)
      .then(() => {
        if (ApiManager.isLoggedIn()) {
          void UpdateAbility(ability, AuthService.getRole());
        }
      })
      .catch((signInError: unknown) => {
        const text = signInError instanceof Error ? signInError.message : "Unknown error while signing in";
        if (signInError instanceof Error)
          // Send a toast message saying there was an error while logging in
          addToast({
            id: GenerateUUID(),
            color: "danger",
            text: text,
          });
      });
  }
  console.log(signup);

  return (
    <EmailPasswordSignUpForm
      handleSignup={handleSignup}
      signup={signup}
      setSignup={setSignup}
      buttonText={"Sign Up"}
    />
  );
}

export { SignUp, DefaultSignupProps };

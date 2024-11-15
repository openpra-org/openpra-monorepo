import { SignUpPropsWithRole } from "shared-types/src/lib/api/AuthTypes";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { EmailValidationForm, UsernameValidationForm } from "shared-types/src/lib/api/FormValidation";

// Regex for basic email validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Z|a-z]{2,}$/;

const validUserName = (signup: SignUpPropsWithRole): Promise<boolean> => {
  const usernameValidation: UsernameValidationForm = {
    username: signup.username,
  };
  return ApiManager.isValidUsername(JSON.stringify(usernameValidation))
    .then((isValidUsername: boolean) => {
      return isValidUsername;
    })
    .catch((error: unknown) => {
      return false;
    });
};

export const checkUserName = (
  onValidationComplete: (isValid: boolean) => void,
): ((signup: SignUpPropsWithRole) => void) => {
  let timer: NodeJS.Timeout | null = null;

  return function (signup: SignUpPropsWithRole): void {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      validUserName(signup)
        .then((isValid) => {
          onValidationComplete(isValid);
        })
        .catch((error: unknown) => {
          onValidationComplete(false);
        });
    }, 400);
  };
};

function isValidEmailFormat(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

const validEmail = (signup: SignUpPropsWithRole): Promise<boolean> => {
  // Check the email format
  if (!isValidEmailFormat(signup.email)) {
    return Promise.resolve(false);
  }

  // If the format is valid, check with the backend
  const emailValidation: EmailValidationForm = {
    email: signup.email,
  };

  return ApiManager.isValidEmail(JSON.stringify(emailValidation))
    .then((isValidEmail: boolean) => {
      return isValidEmail;
    })
    .catch((error: unknown) => {
      console.error("Error validating email:", error);
      return false;
    });
};

// Debounced function for email validation
export const checkEmail = (
  onValidationComplete: (isValid: boolean) => void,
): ((signup: SignUpPropsWithRole) => void) => {
  let timer: NodeJS.Timeout | null = null;

  return function (signup: SignUpPropsWithRole): void {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      // First, check the email format
      if (!isValidEmailFormat(signup.email)) {
        onValidationComplete(false);
        return;
      }

      // If the format is valid, proceed with backend validation
      validEmail(signup)
        .then((isValid) => {
          onValidationComplete(isValid);
        })
        .catch((error: unknown) => {
          console.error("Error in email validation:", error);
          onValidationComplete(false);
        });
    }, 700);
  };
};

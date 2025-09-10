import { useState } from "react";
import {
  EuiPageTemplate,
  EuiFieldText,
  EuiButton,
  EuiForm,
  EuiFormRow,
} from "@elastic/eui";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";

const ForgotPasswordPage = (): JSX.Element => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = UseToastContext();

  const handleSubmit = (): void => {
    if (!email.includes("@ncsu.edu")) {
      addToast({
        id: GenerateUUID(),
        color: "danger",
        text: "Please enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    ApiManager.requestPasswordReset(email)
      .then(() => {
        addToast({
          id: GenerateUUID(),
          color: "success",
          text: "If your email exists, a reset link has been sent.",
        });
        setEmail("");
      })
      .catch(() => {
        addToast({
          id: GenerateUUID(),
          color: "danger",
          text: "Failed to send reset email.",
        });
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <EuiPageTemplate panelled={true}>
      <EuiPageTemplate.EmptyPrompt title={<span>Forgot Password</span>}>
        <EuiForm component="form">
          <EuiFormRow label="Email">
            <EuiFieldText
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isInvalid={false}
            />
          </EuiFormRow>
          <EuiButton
            onClick={handleSubmit}
            isLoading={isSubmitting}
            fill
            isDisabled={!email}
          >
            Send Reset Link
          </EuiButton>
        </EuiForm>
      </EuiPageTemplate.EmptyPrompt>
    </EuiPageTemplate>
  );
};

export { ForgotPasswordPage };

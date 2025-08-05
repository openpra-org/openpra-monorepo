import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  EuiPageTemplate,
  EuiFieldPassword,
  EuiButton,
  EuiForm,
  EuiFormRow,
  EuiSkeletonLoading,
} from "@elastic/eui";
import { GenericModal } from "../../components/modals/genericModal";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { UseToastContext } from "../../providers/toastProvider";
import { GenerateUUID } from "../../../utils/treeUtils";

const ResetPasswordPage = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const navigate = useNavigate();
  const { addToast } = UseToastContext();

  useEffect(() => {
    if (!token || token.length < 10) {
      setIsExpired(true);
    }
  }, [token]);

  const handleSubmit = (): void => {
    if (newPassword.length < 6) {
      addToast({
        id: GenerateUUID(),
        color: "danger",
        text: "Password must be at least 8 characters.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast({
        id: GenerateUUID(),
        color: "danger",
        text: "Passwords do not match.",
      });
      return;
    }

    setIsSubmitting(true);
    ApiManager.resetPassword(token, newPassword)
      .then(() => {
        addToast({
          id: GenerateUUID(),
          color: "success",
          text: "Password has been reset. Redirecting to login...",
        });
        setTimeout(() => navigate("/"), 1500);
      })
      .catch((err: { message: string }) => {
        addToast({
          id: GenerateUUID(),
          color: "danger",
          text: `Error resetting password: ${err.message}`,
        });
        setIsExpired(true);
        setIsSubmitting(false);
      });
  };

  const getModal = (): JSX.Element => {
    if (isExpired) {
      return (
        <EuiPageTemplate panelled={true}>
          <EuiPageTemplate.EmptyPrompt title={<span>Reset link is invalid or expired</span>} />
        </EuiPageTemplate>
      );
    }

    return (
      <EuiPageTemplate panelled={true}>
        <EuiPageTemplate.EmptyPrompt title={<span>Reset your password</span>}>
          <EuiForm component="form">
            <EuiFormRow label="New Password">
              <EuiFieldPassword
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="dual"
              />
            </EuiFormRow>
            <EuiFormRow label="Confirm Password">
              <EuiFieldPassword
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="dual"
              />
            </EuiFormRow>
            <EuiButton
              onClick={handleSubmit}
              isLoading={isSubmitting}
              fill
              isDisabled={!newPassword || !confirmPassword}
            >
              Reset Password
            </EuiButton>
          </EuiForm>
        </EuiPageTemplate.EmptyPrompt>
      </EuiPageTemplate>
    );
  };

  return (
    <EuiSkeletonLoading
      isLoading={isSubmitting}
      loadingContent={
        <GenericModal
          title="Resetting..."
          body={<p>Please wait while we reset your password.</p>}
          onClose={(): void => undefined}
          modalFormId="reset-pw-modal"
          onSubmit={(): Promise<void> => Promise.resolve()}
          showButtons={false}
        />
      }
      loadedContent={getModal()}
    />
  );
};

export { ResetPasswordPage };

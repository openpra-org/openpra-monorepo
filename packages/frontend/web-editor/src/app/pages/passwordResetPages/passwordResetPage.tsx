import {
  EuiFlexGroup,
  EuiFlexItem,
  useEuiPaddingCSS,
  useEuiTheme,
  EuiCallOut,
  EuiSpacer,
} from "@elastic/eui";
import React, { useState } from "react";
import { EnterEmailForm } from "../../components/forms/enterEmailForm";
import { ApiManager } from "packages/shared-types/src/lib/api/ApiManager";

function PasswordResetPage(): JSX.Element {
  const [emailSent, setEmailSent] = useState(false);
  const [formData, setFormData] = useState({ email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { euiTheme } = useEuiTheme();
  const textCss = [useEuiPaddingCSS("horizontal").m];
  const flexGroupStyles = {
    height: "100vh",
    maxWidth: euiTheme.breakpoint.xl,
    marginInline: "auto",
    paddingBlockStart: 48,
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmailSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim()) {
      setError("Email address is required.");
      return;
    }

    setLoading(true);

    try {
      await ApiManager.getResetPasswordInstructions(formData.email);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      setEmailSent(true);
    } catch (err) {
      console.error("Failed to send reset email", err);
      setError("Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <EuiFlexGroup
      style={flexGroupStyles}
      direction="column"
      alignItems="center"
      gutterSize="none"
    >
      <EuiFlexItem css={textCss}>
        {!emailSent ? (
          <EnterEmailForm
            email={formData.email}
            onChange={handleInputChange}
            onSubmit={handleEmailSubmit}
            loading={loading}
            error={error}
          />
        ) : (
          <EuiCallOut
            title="Check your email"
            color="success"
            iconType="email"
          >
            <p>
              We've sent an email to <strong>{formData.email}</strong> with
              instructions to reset your password. Please check your inbox and
              follow the link to continue.
            </p>
            <EuiSpacer size="s" />
          </EuiCallOut>
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export { PasswordResetPage };

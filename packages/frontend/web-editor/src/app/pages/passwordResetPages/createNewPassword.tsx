import {
  EuiFlexGroup,
  EuiFlexItem,
  useEuiPaddingCSS,
  useEuiTheme,
  EuiCallOut,
  EuiSpacer,
} from "@elastic/eui";
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SetNewPasswordForm } from "../../components/forms/setNewPasswordForm";
import { ApiManager } from "packages/shared-types/src/lib/api/ApiManager";

function CreateNewPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
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

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token.");
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    const { password, confirmPassword } = formData;
    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await ApiManager.resetPasswordWithToken(token, formData.password);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "An unexpected error occurred.");
      } else {
        setSuccess(true);
        setTimeout(() => navigate("/"), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Network error—please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <EuiFlexGroup style={flexGroupStyles} direction="column" alignItems="center" gutterSize="none">
        <EuiFlexItem css={textCss}>
          <EuiCallOut title="Invalid Link" color="danger" iconType="alert">
            <p>The reset link is invalid or missing a token.</p>
          </EuiCallOut>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  return (
    <EuiFlexGroup style={flexGroupStyles} direction="column" alignItems="center" gutterSize="none">
      <EuiFlexItem css={textCss}>
        {!success ? (
          <SetNewPasswordForm
            formData={formData}
            onChange={handleInputChange}
            onSubmit={handlePasswordSubmit}
            loading={loading}
            error={error}
          />
        ) : (
          <EuiCallOut title="Success!" color="success" iconType="check">
            <p>Your password has been reset. Redirecting to login...</p>
            <EuiSpacer size="s" />
          </EuiCallOut>
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export { CreateNewPasswordPage };

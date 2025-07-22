import {
  EuiHideFor,
  EuiFlexGroup,
  EuiFlexItem,
  useEuiPaddingCSS,
  useEuiTheme,
  EuiCallOut, 
  EuiSpacer,  
  EuiButton,
} from "@elastic/eui";
import React, { useState } from "react";

import { EnterEmailForm } from "../components/forms/enterEmailForm";
import { VerifyOtpForm } from "../components/forms/verifyOtpForm";
import { SetNewPasswordForm } from "../components/forms/setNewPasswordForm";

type ResetStep = "enterEmail" | "verifyOtp" | "setNewPassword" | "success";

function PasswordResetPage(): JSX.Element {
  const [currentStep, setCurrentStep] = useState<ResetStep>("enterEmail");
  const [formData, setFormData] = useState({
    username: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });
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

  const handleEmailSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!formData.username.trim()) {
      setError("Email address is required.");
      return;
    }
    setLoading(true);
    // FAKE API CALL
    setTimeout(() => {
      setLoading(false);
      setCurrentStep("verifyOtp");
    }, 1500);
  };

  const handleOtpVerify = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    console.log("OTP ERROR STATUS", error)
    if (formData.otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }
    setLoading(true);
    // FAKE API CALL
    setTimeout(() => {
      setLoading(false);
      if (formData.otp === "123456") {
        setCurrentStep("setNewPassword");
      } else {
        setError("Invalid OTP. Please try again.");
        console.log("OTP ERROR STATUS", error)
      }
    }, 1500);
  };

  const handlePasswordResetSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!formData.password || !formData.confirmPassword) {
      setError("Both password fields are required.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    // FAKE API CALL
    setTimeout(() => {
      setLoading(false);
      setCurrentStep("success");
    }, 1500);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "enterEmail":
        return (
          <EnterEmailForm
            email={formData.username}
            onChange={handleInputChange}
            onSubmit={handleEmailSubmit}
            loading={loading}
            error={error}
          />
        );
      case "verifyOtp":
        return (
          <VerifyOtpForm
            email={formData.username}
            otp={formData.otp}
            onChange={handleInputChange}
            onSubmit={handleOtpVerify}
            loading={loading}
            error={error}
          />
        );
      case "setNewPassword":
        return (
          <SetNewPasswordForm
            formData={formData}
            onChange={handleInputChange}
            onSubmit={handlePasswordResetSubmit}
            loading={loading}
            error={error}
          />
        );
      case "success":
        return (
          <EuiCallOut title="Success!" color="success" iconType="check">
            <p>Your password has been successfully reset. You can now log in with your new password.</p>
            <EuiSpacer size="s" />
            <EuiButton href="/">Go to Login</EuiButton>
          </EuiCallOut>
        );
      default:
        return null;
    }
  };

  return (
    <EuiFlexGroup
      style={flexGroupStyles}
      direction="column"
      alignItems="center"
      gutterSize="none"
    >
      <EuiHideFor sizes={["xs", "s"]}>
        <EuiFlexItem css={textCss}>{renderCurrentStep()}</EuiFlexItem>
      </EuiHideFor>
    </EuiFlexGroup>
  );
}

export { PasswordResetPage };
import React from 'react';
import {
  EuiText,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiCallOut, 
} from "@elastic/eui";

interface Props {
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const VerifyOtpForm: React.FC<Props> = ({
  email,
  otp,
  loading,
  error,
  onChange,
  onSubmit,
}) => (
  <>
    <EuiText>
      <h1>Check Your Email</h1>
      <p>
        We've sent a 6-digit verification code to <strong>{email}</strong>.
        Please enter it below.
      </p>
    </EuiText>

    <EuiSpacer />

    <EuiForm component="form" onSubmit={onSubmit}>
      <EuiFormRow label="Verification Code">
        <EuiFieldText
          placeholder="123456"
          name="otp"
          value={otp}
          onChange={onChange}
          maxLength={6}
          required
        />
      </EuiFormRow>

      {error && (
        <>
          <EuiSpacer size="s" />
          <EuiCallOut color="danger" title="Error">
            {error}
          </EuiCallOut>
        </>
      )}

      <EuiSpacer />

      <EuiButton fullWidth type="submit" fill isLoading={loading}>
        Verify Code
      </EuiButton>
    </EuiForm>
  </>
);

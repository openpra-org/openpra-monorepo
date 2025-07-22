import React from 'react';
import {
  EuiText,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldPassword,
  EuiButton,
  EuiCallOut,
} from '@elastic/eui';

interface Props {
  formData: {
    password: string;
    confirmPassword: string;
  };
  loading: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SetNewPasswordForm: React.FC<Props> = ({ formData, loading, error, onChange, onSubmit }) => (
  <>
    <EuiText>
      <h1>Set a New Password</h1>
      <p>Create a new secure password for your account.</p>
    </EuiText>
    <EuiSpacer />
    <EuiForm component="form" onSubmit={onSubmit}>
      {error && (
        <>
          <EuiCallOut title="Error" color="danger" iconType="alert">
            {error}
          </EuiCallOut>
          <EuiSpacer />
        </>
      )}
      <EuiFormRow label="New Password">
        <EuiFieldPassword
          placeholder="Enter new password"
          name="password"
          value={formData.password}
          onChange={onChange}
          required
        />
      </EuiFormRow>
      <EuiFormRow label="Confirm New Password">
        <EuiFieldPassword
          placeholder="Confirm new password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={onChange}
          required
        />
      </EuiFormRow>
      <EuiSpacer />
      <EuiButton fullWidth type="submit" fill isLoading={loading}>
        Reset Password
      </EuiButton>
    </EuiForm>
  </>
);
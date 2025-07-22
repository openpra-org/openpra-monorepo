import React from 'react';
import {
  EuiText,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
} from '@elastic/eui';

interface Props {
  email: string;
  loading: boolean;
  error: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EnterEmailForm: React.FC<Props> = ({ email, loading, error, onChange, onSubmit }) => (
  <>
    <EuiText>
      <h1>Forgot Your Password?</h1>
      <p>No worries! Enter your email address below and we'll send you a code to reset your password.</p>
    </EuiText>
    <EuiSpacer />
    <EuiForm component="form" onSubmit={onSubmit}>
      <EuiFormRow label="Email Address" isInvalid={!!error} error={error}>
        <EuiFieldText
          placeholder="name@example.com"
          name="username"
          value={email}
          onChange={onChange}
          isInvalid={!!error}
          required
          icon="email"
        />
      </EuiFormRow>
      <EuiSpacer />
      <EuiButton fullWidth type="submit" fill isLoading={loading}>
        Send Reset Code
      </EuiButton>
    </EuiForm>
  </>
);
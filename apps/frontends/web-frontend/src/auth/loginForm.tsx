import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { type LoginRequest, LoginRequestSchema } from "interfaces-shared-types";
import { ForgotPassword } from "./forgotPassword";
import { oauthStartUrl } from "./authApi";
import { GoogleIcon, GitHubIcon } from "../welcome/icons";
import { UpdateRole } from "../role/role";
import { RoleContext } from "../role/roleProvider";
import { useAuth, getRoles } from "./AuthContext";
import { OpenPraBrand } from "../design-system/OpenPraBrand";
import { getCampaignAttribution } from "../analytics/analytics";
import "./css/loginForm.css";

interface LoginFieldErrors {
  identifier?: string;
  password?: string;
}

function LoginForm({ onSwitchToSignup }: { onSwitchToSignup?: () => void }): JSX.Element {
  const [credentials, setCredentials] = useState<LoginRequest>({ identifier: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [invalid, setInvalid] = useState(false);
  const [redirectToHomepage, setRedirectToHomepage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const role = useContext(RoleContext);
  const { login, completeTwoFactor } = useAuth();

  useEffect(() => {
    if (credentials.identifier && fieldErrors.identifier) setFieldErrors((e) => ({ ...e, identifier: undefined }));
    if (credentials.password && fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
  }, [credentials, fieldErrors]);

  async function handleLogin(): Promise<void> {
    setInvalid(false);
    try {
      const result = await login(credentials);
      if (result.status === "twoFactorRequired") {
        setChallengeToken(result.challengeToken);
        return;
      }
      UpdateRole(role, getRoles());
      setRedirectToHomepage(true);
    } catch {
      setInvalid(true);
    }
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (challengeToken === null || code.trim().length === 0) return;
    setCodeInvalid(false);
    setVerifying(true);
    try {
      await completeTwoFactor(challengeToken, code.trim());
      UpdateRole(role, getRoles());
      setRedirectToHomepage(true);
    } catch {
      setCodeInvalid(true);
    } finally {
      setVerifying(false);
    }
  }

  function cancelTwoFactor(): void {
    setChallengeToken(null);
    setCode("");
    setCodeInvalid(false);
  }

  function validateLogin(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const result = LoginRequestSchema.safeParse(credentials);
    if (!result.success) {
      const errs: LoginFieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === "identifier" || key === "password") errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    void handleLogin();
  }

  if (redirectToHomepage) return <Navigate to="/" replace />;

  if (challengeToken !== null) {
    return (
      <div>
        <div className="login-form__header">
          <div className="login-form__logo-wrap">
            <OpenPraBrand variant="header" surface="light" className="login-form__logo-img" />
          </div>
          <h1 className="login-form__title">Two-step verification</h1>
          <p className="login-form__subtitle">Enter the code from your authenticator app</p>
        </div>

        <form onSubmit={(e) => { void handleVerifyCode(e); }} noValidate>
          <div className="login-form__field">
            <label className="login-form__label" htmlFor="login-2fa-code">Authentication code</label>
            <input
              id="login-2fa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => { setCode(e.target.value); if (codeInvalid) setCodeInvalid(false); }}
              className={`login-form__input${codeInvalid ? " login-form__input--error" : ""}`}
              autoFocus
            />
            <p className="login-form__hint">6-digit code, or one of your backup codes</p>
          </div>

          {codeInvalid && <p className="login-form__invalid-msg">Invalid authentication code</p>}

          <button type="submit" className="login-form__submit-btn" disabled={verifying || code.trim().length === 0}>
            {verifying ? "Verifying…" : "Verify"}
          </button>

          <p className="login-form__switch-row">
            <button type="button" onClick={cancelTwoFactor} className="login-form__switch-btn">
              Back to sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <>
    {showForgotPassword && <ForgotPassword onClose={() => { setShowForgotPassword(false); }} />}
    <div>
      <div className="login-form__header">
        <div className="login-form__logo-wrap">
          <OpenPraBrand variant="header" surface="light" className="login-form__logo-img" />
        </div>
        <h1 className="login-form__title">Welcome back</h1>
        <p className="login-form__subtitle">Sign in to continue your analysis</p>
      </div>

      <form onSubmit={validateLogin} noValidate>
        <div className="login-form__field">
          <label className="login-form__label" htmlFor="login-identifier">Username / Email</label>
          <input
            id="login-identifier"
            type="text"
            value={credentials.identifier}
            onChange={(e) => { setCredentials({ ...credentials, identifier: e.target.value }); }}
            className={`login-form__input${fieldErrors.identifier ? " login-form__input--error" : ""}`}
            autoComplete="username"
          />
          {fieldErrors.identifier && <p className="login-form__error-msg">{fieldErrors.identifier}</p>}
        </div>

        <div className="login-form__field login-form__field--password">
          <div className="login-form__password-header">
            <label className="login-form__label--inline" htmlFor="login-password">Password</label>
            <button type="button" className="login-form__forgot-btn" onClick={() => { setShowForgotPassword(true); }}>Forgot password?</button>
          </div>
          <div className="login-form__input-wrap">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={credentials.password}
              onChange={(e) => { setCredentials({ ...credentials, password: e.target.value }); }}
              className={`login-form__input login-form__input--with-toggle${fieldErrors.password ? " login-form__input--error" : ""}`}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => { setShowPassword((v) => !v); }}
              className="login-form__toggle-btn"
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
          {fieldErrors.password && <p className="login-form__error-msg">{fieldErrors.password}</p>}
        </div>

        {invalid && <p className="login-form__invalid-msg">Invalid username or password</p>}

        <button type="submit" className="login-form__submit-btn">Log In</button>

        <div className="login-form__divider"><span>or</span></div>
        <button
          type="button"
          className="login-form__oauth-btn"
          onClick={() => { window.location.href = oauthStartUrl("google", "login", undefined, getCampaignAttribution()); }}
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <button
          type="button"
          className="login-form__oauth-btn"
          onClick={() => { window.location.href = oauthStartUrl("github", "login", undefined, getCampaignAttribution()); }}
        >
          <GitHubIcon />
          Continue with GitHub
        </button>

        {onSwitchToSignup !== undefined && (
          <p className="login-form__switch-row">
            {"Don't have an account? "}
            <button type="button" onClick={onSwitchToSignup} className="login-form__switch-btn">
              Sign up for access
            </button>
          </p>
        )}
      </form>
    </div>
    </>
  );
}

export { LoginForm };

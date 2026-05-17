import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { type LoginRequest, LoginRequestSchema } from "interfaces-shared-types";
import { ForgotPassword } from "./forgotPassword";
import { UpdateRole } from "../role/role";
import { RoleContext } from "../role/roleProvider";
import { useAuth, getRoles } from "./AuthContext";
import logo from "../assets/Logo.png";
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

  const role = useContext(RoleContext);
  const { login } = useAuth();

  useEffect(() => {
    if (credentials.identifier && fieldErrors.identifier) setFieldErrors((e) => ({ ...e, identifier: undefined }));
    if (credentials.password && fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
  }, [credentials, fieldErrors]);

  async function handleLogin(): Promise<void> {
    setInvalid(false);
    try {
      await login(credentials);
      UpdateRole(role, getRoles());
      setRedirectToHomepage(true);
    } catch {
      setInvalid(true);
    }
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

  return (
    <>
    {showForgotPassword && <ForgotPassword onClose={() => { setShowForgotPassword(false); }} />}
    <div>
      <div className="login-form__header">
        <div className="login-form__logo-wrap">
          <img src={logo} alt="OpenPRA" className="login-form__logo-img" />
        </div>
        <h1 className="login-form__title">Welcome back</h1>
        <p className="login-form__subtitle">Sign in to continue your analysis</p>
      </div>

      <form onSubmit={validateLogin} noValidate>
        <div className="login-form__field">
          <label className="login-form__label">Username / Email</label>
          <input
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
            <label className="login-form__label--inline">Password</label>
            <button type="button" className="login-form__forgot-btn" onClick={() => { setShowForgotPassword(true); }}>Forgot password?</button>
          </div>
          <div className="login-form__input-wrap">
            <input
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

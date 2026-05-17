import React, { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import { type SignupRequest, SignupRequestSchema } from "interfaces-shared-types";
import { signUp } from "./authApi";
import { UpdateRole } from "../role/role";
import { RoleContext } from "../role/roleProvider";
import { useToast } from "../toast/toastProvider";
import { getRoles } from "./AuthContext";
import logo from "../assets/Logo.png";
import "./css/signUpForm.css";

const defaultSignup: SignupRequest = {
  fullName: "",
  email: "",
  organization: "",
  username: "",
  password: "",
};

type SignupFieldErrors = Partial<Record<keyof SignupRequest, string>>;

function SignUpForm({ onSwitchToLogin }: { onSwitchToLogin?: () => void }): JSX.Element {
  const [signup, setSignup] = useState<SignupRequest>(defaultSignup);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [redirectToHomepage, setRedirectToHomepage] = useState(false);

  const role = useContext(RoleContext);
  const { addToast } = useToast();

  function updateField<K extends keyof SignupRequest>(key: K, value: SignupRequest[K]): void {
    setSignup((s) => ({ ...s, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const result = SignupRequestSchema.safeParse(signup);
    if (!result.success) {
      const errs: SignupFieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof SignupRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    signUp(result.data)
      .then(() => {
        UpdateRole(role, getRoles());
        setRedirectToHomepage(true);
      })
      .catch((err: unknown) => {
        const message = (err as { message?: string }).message ?? "Sign up failed";
        addToast({ id: crypto.randomUUID(), type: "danger", message });
      });
  }

  if (redirectToHomepage) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="signup-form__header">
        <div className="signup-form__logo-wrap">
          <img src={logo} alt="OpenPRA" className="signup-form__logo-img" />
        </div>
        <h1 className="signup-form__title">Create your account</h1>
        <p className="signup-form__subtitle">Sign up to start analyzing</p>
      </div>

      <form onSubmit={validateSignup} noValidate>
        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="signup-fullname">Full name</label>
          <input
            id="signup-fullname"
            type="text"
            value={signup.fullName}
            onChange={(e) => { updateField("fullName", e.target.value); }}
            className={`signup-form__input${fieldErrors.fullName ? " signup-form__input--error" : ""}`}
            autoComplete="name"
          />
          {fieldErrors.fullName && <p className="signup-form__error-msg">{fieldErrors.fullName}</p>}
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={signup.email}
            onChange={(e) => { updateField("email", e.target.value); }}
            className={`signup-form__input${fieldErrors.email ? " signup-form__input--error" : ""}`}
            autoComplete="email"
          />
          {fieldErrors.email && <p className="signup-form__error-msg">{fieldErrors.email}</p>}
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="signup-organization">Organization</label>
          <input
            id="signup-organization"
            type="text"
            value={signup.organization}
            onChange={(e) => { updateField("organization", e.target.value); }}
            className="signup-form__input"
            autoComplete="organization"
          />
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="signup-username">Username</label>
          <p className="signup-form__hint">At least 3 characters</p>
          <input
            id="signup-username"
            type="text"
            value={signup.username}
            onChange={(e) => { updateField("username", e.target.value); }}
            className={`signup-form__input${fieldErrors.username ? " signup-form__input--error" : ""}`}
            autoComplete="username"
          />
          {fieldErrors.username && <p className="signup-form__error-msg">{fieldErrors.username}</p>}
        </div>

        <div className="signup-form__field">
          <label className="signup-form__label" htmlFor="signup-password">Password</label>
          <p className="signup-form__hint">At least 8 characters</p>
          <div className="signup-form__input-wrap">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={signup.password}
              onChange={(e) => { updateField("password", e.target.value); }}
              className={`signup-form__input signup-form__input--with-toggle${fieldErrors.password ? " signup-form__input--error" : ""}`}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => { setShowPassword((v) => !v); }} className="signup-form__toggle-btn">
              {showPassword ? "hide" : "show"}
            </button>
          </div>
          {fieldErrors.password && <p className="signup-form__error-msg">{fieldErrors.password}</p>}
        </div>

        <button type="submit" className="signup-form__submit-btn">Sign Up</button>

        {onSwitchToLogin !== undefined && (
          <p className="signup-form__switch-row">
            {"Already have an account? "}
            <button type="button" onClick={onSwitchToLogin} className="signup-form__switch-btn">
              Log in
            </button>
          </p>
        )}
      </form>
    </div>
  );
}

export { SignUpForm };

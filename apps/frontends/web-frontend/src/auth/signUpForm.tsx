import React, { useContext, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { type SignupRequest, SignupRequestSchema } from "interfaces-shared-types";
import { checkAvailability, signUp, oauthStartUrl } from "./authApi";
import { GoogleIcon, GitHubIcon } from "../welcome/icons";
import { UpdateRole } from "../role/role";
import { RoleContext } from "../role/roleProvider";
import { useToast } from "../toast/toastProvider";
import { getRoles, useAuth } from "./AuthContext";
import logo from "../assets/Triplet.png";
import "./css/signUpForm.css";
import { clearCampaignAttribution, getCampaignAttribution } from "../analytics/analytics";

const defaultSignup: SignupRequest = {
  fullName: "",
  email: "",
  organization: "",
  username: "",
  password: "",
};

type SignupFieldErrors = Partial<Record<keyof SignupRequest, string>>;

const AVAILABILITY_DEBOUNCE_MS = 400;

function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length === 0 || domain.length < 3) return false;
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

function SignUpForm({ onSwitchToLogin }: { onSwitchToLogin?: () => void }): JSX.Element {
  const [signup, setSignup] = useState<SignupRequest>(defaultSignup);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [redirectToHomepage, setRedirectToHomepage] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const usernameTokenRef = useRef(0);
  const emailTokenRef = useRef(0);

  const role = useContext(RoleContext);
  const { addToast } = useToast();
  const { login } = useAuth();

  function updateField<K extends keyof SignupRequest>(key: K, value: SignupRequest[K]): void {
    setSignup((s) => ({ ...s, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: undefined }));
    if (key === "username") setUsernameTaken(false);
    if (key === "email") setEmailTaken(false);
  }

  useEffect(() => {
    const candidate = signup.username.trim();
    if (candidate.length < 3) {
      setUsernameTaken(false);
      return;
    }
    const token = ++usernameTokenRef.current;
    const timer = window.setTimeout(() => {
      checkAvailability({ username: candidate })
        .then((res) => {
          if (token !== usernameTokenRef.current) return;
          setUsernameTaken(res.usernameAvailable === false);
        })
        .catch(() => { /* network blip — silent for inline UX */ });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); };
  }, [signup.username]);

  useEffect(() => {
    const candidate = signup.email.trim();
    if (!looksLikeEmail(candidate)) {
      setEmailTaken(false);
      return;
    }
    const token = ++emailTokenRef.current;
    const timer = window.setTimeout(() => {
      checkAvailability({ email: candidate })
        .then((res) => {
          if (token !== emailTokenRef.current) return;
          setEmailTaken(res.emailAvailable === false);
        })
        .catch(() => { /* network blip — silent for inline UX */ });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); };
  }, [signup.email]);

  function validateSignup(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const attribution = getCampaignAttribution();
    const result = SignupRequestSchema.safeParse({
      ...signup,
      ...(attribution === null ? {} : { campaignToken: attribution.token, visitorId: attribution.visitorId }),
    });
    if (!result.success) {
      const errs: SignupFieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof SignupRequest;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    if (usernameTaken || emailTaken) return;
    const { username, password } = result.data;
    signUp(result.data)
      .then(() => login({ identifier: username, password }))
      .then(() => {
        clearCampaignAttribution();
        UpdateRole(role, getRoles());
        setRedirectToHomepage(true);
      })
      .catch((err: unknown) => {
        const message = (err as { message?: string }).message ?? "Sign up failed";
        addToast({ id: crypto.randomUUID(), type: "danger", message });
      });
  }

  if (redirectToHomepage) return <Navigate to="/" replace />;

  const usernameError = fieldErrors.username ?? (usernameTaken ? "Username already taken" : undefined);
  const emailError = fieldErrors.email ?? (emailTaken ? "Email already registered" : undefined);

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
            className={`signup-form__input${emailError ? " signup-form__input--error" : ""}`}
            autoComplete="email"
          />
          {emailError && <p className="signup-form__error-msg">{emailError}</p>}
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
            className={`signup-form__input${usernameError ? " signup-form__input--error" : ""}`}
            autoComplete="username"
          />
          {usernameError && <p className="signup-form__error-msg">{usernameError}</p>}
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

        <button type="submit" className="signup-form__submit-btn" disabled={usernameTaken || emailTaken}>
          Sign Up
        </button>

        <div className="signup-form__divider"><span>or</span></div>
        <button
          type="button"
          className="signup-form__oauth-btn"
          onClick={() => { window.location.href = oauthStartUrl("google", "signup", undefined, getCampaignAttribution()); }}
        >
          <GoogleIcon />
          Sign up with Google
        </button>
        <button
          type="button"
          className="signup-form__oauth-btn"
          onClick={() => { window.location.href = oauthStartUrl("github", "signup", undefined, getCampaignAttribution()); }}
        >
          <GitHubIcon />
          Sign up with GitHub
        </button>

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

import React, { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { type ResetPasswordRequest, ResetPasswordRequestSchema } from "interfaces-shared-types";
import { resetPassword } from "./authApi";
import logo from "../assets/Logo.png";
import "./css/resetPassword.css";

function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [redirect, setRedirect] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const payload: ResetPasswordRequest = { token, newPassword };
    const result = ResetPasswordRequestSchema.safeParse(payload);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setError(null);
    setSubmitting(true);
    resetPassword(result.data)
      .then(() => { setDone(true); })
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? "Reset failed. The link may have expired.");
      })
      .finally(() => { setSubmitting(false); });
  }

  if (redirect) return <Navigate to="/" replace />;

  return (
    <div className="reset-password__page">
      <div className="reset-password__bg" />
      <div className="reset-password__card">
        {done ? (
          <div className="reset-password__confirmation">
            <div className="reset-password__check-icon">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="reset-password__confirm-title">Password updated</h2>
            <p className="reset-password__confirm-text">Your password has been reset. You can now log in.</p>
            <button type="button" onClick={() => { setRedirect(true); }} className="reset-password__submit-btn">
              Continue to login
            </button>
          </div>
        ) : (
          <>
            <div className="reset-password__header">
              <div className="reset-password__logo-wrap">
                <img src={logo} alt="OpenPRA" className="reset-password__logo-img" />
              </div>
              <h1 className="reset-password__title">Set a new password</h1>
              <p className="reset-password__subtitle">Choose a strong password you haven&apos;t used before.</p>
            </div>

            {!token && <p className="reset-password__invalid-msg">Invalid or missing reset token.</p>}

            <form onSubmit={handleSubmit} noValidate>
              <label className="reset-password__label">New password</label>
              <div className="reset-password__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (error) setError(null); }}
                  className={`reset-password__input reset-password__input--with-toggle${error ? " reset-password__input--error" : ""}`}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" onClick={() => { setShowPassword((v) => !v); }} className="reset-password__toggle-btn">
                  {showPassword ? "hide" : "show"}
                </button>
              </div>
              {error && <p className="reset-password__error-msg">{error}</p>}

              <button type="submit" className="reset-password__submit-btn" disabled={submitting || !token}>
                {submitting ? "Updating..." : "Update password"}
              </button>
            </form>

            <p className="reset-password__back-row">
              <button type="button" onClick={() => { setRedirect(true); }} className="reset-password__back-btn">
                Back to login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export { ResetPasswordPage };

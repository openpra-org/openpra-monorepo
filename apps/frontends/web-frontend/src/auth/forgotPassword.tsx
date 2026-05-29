import React, { useState } from "react";
import { type ForgotPasswordRequest, ForgotPasswordRequestSchema } from "interfaces-shared-types";
import { forgotPassword } from "./authApi";
import logo from "../assets/Triplet.png";
import "./css/forgotPassword.css";

interface ForgotPasswordProps {
  onClose: () => void;
}

function ForgotPassword({ onClose }: ForgotPasswordProps): JSX.Element {
  const [payload, setPayload] = useState<ForgotPasswordRequest>({ identifier: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const result = ForgotPasswordRequestSchema.safeParse(payload);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setError(null);
    setSubmitting(true);
    forgotPassword(result.data)
      .then(() => { setSubmitted(true); })
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? "Something went wrong");
      })
      .finally(() => { setSubmitting(false); });
  }

  return (
    <div className="forgot-password__overlay" onClick={onClose}>
      <div className="forgot-password__card" onClick={(e) => { e.stopPropagation(); }}>
        {submitted ? (
          <div className="forgot-password__confirmation">
            <div className="forgot-password__check-icon">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="forgot-password__confirm-title">Check your inbox</h2>
            <p className="forgot-password__confirm-text">
              If <strong>{payload.identifier}</strong> is registered, a password reset link is on its way.
            </p>
            <button type="button" onClick={onClose} className="forgot-password__submit-btn">
              Back to login
            </button>
          </div>
        ) : (
          <>
            <div className="forgot-password__header">
              <div className="forgot-password__logo-wrap">
                <img src={logo} alt="OpenPRA" className="forgot-password__logo-img" />
              </div>
              <h2 className="forgot-password__title">Reset your password</h2>
              <p className="forgot-password__subtitle">
                Enter your username or email and we&apos;ll send a reset link to the associated address.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <label className="forgot-password__label" htmlFor="forgot-identifier">Username / Email</label>
              <input
                id="forgot-identifier"
                type="text"
                value={payload.identifier}
                onChange={(e) => { setPayload({ identifier: e.target.value }); if (error) setError(null); }}
                className={`forgot-password__input${error ? " forgot-password__input--error" : ""}`}
                autoComplete="username"
                autoFocus
              />
              {error && <p className="forgot-password__error-msg">{error}</p>}

              <button type="submit" className="forgot-password__submit-btn" disabled={submitting}>
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="forgot-password__back-row">
              <button type="button" onClick={onClose} className="forgot-password__back-btn">
                Back to login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export { ForgotPassword };

import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { type ChangePasswordRequest, ChangePasswordRequestSchema } from "interfaces-shared-types";
import { CloseIcon, EyeIcon, EyeOffIcon } from "../welcome/icons";

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function passwordStrengthBands(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  let hasLower = false;
  let hasUpper = false;
  let hasDigit = false;
  let hasSymbol = false;
  for (const ch of pw) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) hasDigit = true;
    else if (code >= 65 && code <= 90) hasUpper = true;
    else if (code >= 97 && code <= 122) hasLower = true;
    else hasSymbol = true;
  }
  if (hasLower && hasUpper) score++;
  if (hasDigit) score++;
  if (hasSymbol) score++;
  return Math.min(5, score);
}

const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];

function ChangePasswordModal({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: ChangePasswordRequest) => void;
  pending: boolean;
}): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => { inputRef.current?.focus(); }, 50);
    return () => { window.clearTimeout(id); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onCancel, pending]);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    const candidate = { currentPassword, newPassword };
    const parsed = ChangePasswordRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "currentPassword" && !next.currentPassword) next.currentPassword = issue.message;
        if (key === "newPassword" && !next.newPassword) next.newPassword = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  const inputType = showPasswords ? "text" : "password";
  const strength = passwordStrengthBands(newPassword);

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="cp-title">Change password</h2>
            <p className="modal__sub">At least 8 characters. Mix cases, digits, and symbols for a stronger score.</p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            aria-label="Close"
            disabled={pending}
          >
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label className="field__label" htmlFor="cp-current">Current password</label>
              <input
                ref={inputRef}
                id="cp-current"
                type={inputType}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); if (errors.currentPassword) setErrors({ ...errors, currentPassword: undefined }); }}
                className={`field__input${errors.currentPassword ? " field__input--error" : ""}`}
                autoComplete="current-password"
                disabled={pending}
              />
              {errors.currentPassword && <div className="field__error">{errors.currentPassword}</div>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cp-new">New password</label>
              <input
                id="cp-new"
                type={inputType}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (errors.newPassword) setErrors({ ...errors, newPassword: undefined }); }}
                className={`field__input${errors.newPassword ? " field__input--error" : ""}`}
                autoComplete="new-password"
                disabled={pending}
              />
              {errors.newPassword && <div className="field__error">{errors.newPassword}</div>}
              {newPassword.length > 0 && (
                <div className={`st__strength st__strength--${strength}`}>
                  <div className="st__strength-bar">
                    <div className="st__strength-fill" style={{ width: `${(strength / 5) * 100}%` }} />
                  </div>
                  <span className="st__strength-label">{STRENGTH_LABELS[strength]}</span>
                </div>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cp-confirm">Confirm new password</label>
              <input
                id="cp-confirm"
                type={inputType}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined }); }}
                className={`field__input${errors.confirmPassword ? " field__input--error" : ""}`}
                autoComplete="new-password"
                disabled={pending}
              />
              {errors.confirmPassword && <div className="field__error">{errors.confirmPassword}</div>}
            </div>
            <button
              type="button"
              className="st__show-passwords"
              onClick={() => { setShowPasswords((v) => !v); }}
            >
              {showPasswords ? <EyeOffIcon /> : <EyeIcon />}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Updating…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { ChangePasswordModal };

import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { type ChangeEmailRequest, ChangeEmailRequestSchema } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";

interface FieldErrors {
  newEmail?: string;
  currentPassword?: string;
}

function ChangeEmailModal({
  currentEmail,
  onCancel,
  onSubmit,
  pending,
}: {
  currentEmail: string;
  onCancel: () => void;
  onSubmit: (payload: ChangeEmailRequest) => void;
  pending: boolean;
}): JSX.Element {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
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
    const candidate = { newEmail: newEmail.trim(), currentPassword };
    const parsed = ChangeEmailRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "newEmail" && !next.newEmail) next.newEmail = issue.message;
        if (key === "currentPassword" && !next.currentPassword) next.currentPassword = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ce-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="ce-title">Change sign-in email</h2>
            <p className="modal__sub">Your new email replaces the one you use to sign in.</p>
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
              <label className="field__label" htmlFor="ce-current">Current email</label>
              <input
                id="ce-current"
                type="email"
                value={currentEmail}
                className="field__input field__input--locked"
                readOnly
                disabled
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ce-new">New email</label>
              <input
                ref={inputRef}
                id="ce-new"
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); if (errors.newEmail) setErrors({ ...errors, newEmail: undefined }); }}
                className={`field__input${errors.newEmail ? " field__input--error" : ""}`}
                autoComplete="email"
                disabled={pending}
              />
              {errors.newEmail && <div className="field__error">{errors.newEmail}</div>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ce-pw">Current password</label>
              <input
                id="ce-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); if (errors.currentPassword) setErrors({ ...errors, currentPassword: undefined }); }}
                className={`field__input${errors.currentPassword ? " field__input--error" : ""}`}
                autoComplete="current-password"
                disabled={pending}
              />
              {errors.currentPassword && <div className="field__error">{errors.currentPassword}</div>}
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Updating…" : "Change email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { ChangeEmailModal };

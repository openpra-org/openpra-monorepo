import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { type ChangeUsernameRequest, ChangeUsernameRequestSchema } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";

function isUsernameCharValid(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return true;
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  if (ch === "_" || ch === "-") return true;
  return false;
}

function ChangeUsernameModal({
  currentUsername,
  onCancel,
  onSubmit,
  pending,
}: {
  currentUsername: string;
  onCancel: () => void;
  onSubmit: (payload: ChangeUsernameRequest) => void;
  pending: boolean;
}): JSX.Element {
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
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
    const candidate = { newUsername: newUsername.trim() };
    const parsed = ChangeUsernameRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? "Invalid username");
      return;
    }
    const allValid = Array.from(parsed.data.newUsername).every(isUsernameCharValid);
    if (!allValid) {
      setError("Letters, digits, '_' or '-' only");
      return;
    }
    if (parsed.data.newUsername === currentUsername) {
      setError("That is already your username");
      return;
    }
    setError("");
    onSubmit(parsed.data);
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cu-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="cu-title">Change username</h2>
            <p className="modal__sub">Letters, digits, underscore, and hyphen. 3 to 32 characters.</p>
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
              <label className="field__label" htmlFor="cu-current">Current</label>
              <input id="cu-current" type="text" value={`@${currentUsername}`} className="field__input field__input--locked" readOnly disabled />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cu-new">New username</label>
              <input
                ref={inputRef}
                id="cu-new"
                type="text"
                value={newUsername}
                onChange={(e) => { setNewUsername(e.target.value); if (error) setError(""); }}
                className={`field__input${error ? " field__input--error" : ""}`}
                autoComplete="off"
                disabled={pending}
              />
              {error && <div className="field__error">{error}</div>}
              {!error && newUsername.trim().length >= 3 && (
                <div className="field__hint">openpra.org/@{newUsername.trim()}</div>
              )}
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Updating…" : "Change username"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { ChangeUsernameModal };

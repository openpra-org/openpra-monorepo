import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { CloseIcon } from "../welcome/icons";

const CONFIRM_TOKEN = "DELETE";

function DeleteAccountModal({
  onCancel,
  onConfirm,
  pending,
  hasPassword,
}: {
  onCancel: () => void;
  onConfirm: (currentPassword: string) => void;
  pending: boolean;
  hasPassword: boolean;
}): JSX.Element {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
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

  const canDelete = confirmText === CONFIRM_TOKEN && (!hasPassword || password.length > 0) && !pending;

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!canDelete) return;
    onConfirm(hasPassword ? password : "");
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="da-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title st__danger-title" id="da-title">Delete account</h2>
            <p className="modal__sub">This action is permanent. There is no recovery.</p>
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
            <div className="st__danger-box">
              <p className="st__danger-line"><strong>Your data will be deleted:</strong></p>
              <ul className="st__danger-list">
                <li>Your user account and profile</li>
                <li>All projects you own (collaborators lose access)</li>
                <li>Teams you admin pass to another member, or are deleted if you're the only one</li>
                <li>Your memberships in other teams</li>
              </ul>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="da-confirm">Type <code>{CONFIRM_TOKEN}</code> to confirm</label>
              <input
                ref={inputRef}
                id="da-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); }}
                className="field__input"
                autoComplete="off"
                disabled={pending}
              />
            </div>
            {hasPassword && (
              <div className="field">
                <label className="field__label" htmlFor="da-pw">Current password</label>
                <input
                  id="da-pw"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  className="field__input"
                  autoComplete="current-password"
                  disabled={pending}
                />
              </div>
            )}
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn--danger" disabled={!canDelete}>
              {pending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { DeleteAccountModal };

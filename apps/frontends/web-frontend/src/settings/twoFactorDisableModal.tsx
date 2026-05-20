import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { CloseIcon } from "../welcome/icons";

function TwoFactorDisableModal({
  onCancel,
  onConfirm,
  pending,
}: {
  onCancel: () => void;
  onConfirm: (code: string) => void;
  pending: boolean;
}): JSX.Element {
  const [code, setCode] = useState("");
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
    if (code.trim().length === 0 || pending) return;
    onConfirm(code.trim());
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="tfd-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="tfd-title">Disable two-factor authentication</h2>
            <p className="modal__sub">Enter a current code or a backup code to confirm.</p>
          </div>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close" disabled={pending}>
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label className="field__label" htmlFor="tfd-code">Authentication code</label>
              <input
                ref={inputRef}
                id="tfd-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => { setCode(e.target.value); }}
                className="field__input"
                disabled={pending}
              />
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn--danger" disabled={pending || code.trim().length === 0}>
              {pending ? "Disabling…" : "Disable"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { TwoFactorDisableModal };

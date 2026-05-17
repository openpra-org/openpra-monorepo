import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { CloseIcon } from "../welcome/icons";

function RenameModal({
  initialName,
  onCancel,
  onSubmit,
  pending,
}: {
  initialName: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  pending: boolean;
}): JSX.Element {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
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
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError("Project name must be at least 3 characters");
      return;
    }
    if (trimmed === initialName.trim()) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="rn-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="rn-title">Rename project</h2>
            <p className="modal__sub">Give this analysis a new name. At least 3 characters.</p>
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
              <label className="field__label" htmlFor="rn-name">Project name</label>
              <input
                ref={inputRef}
                id="rn-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                className={`field__input${error ? " field__input--error" : ""}`}
                autoComplete="off"
                disabled={pending}
              />
              {error && <div className="field__error">{error}</div>}
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { RenameModal };

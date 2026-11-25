import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { type ProjectWorkbooksResult, CreateProjectWorkbooksRequestSchema } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";
import { createProjectWorkbooks } from "../workbooks/workbookApi";

function LinkedWorkbooksModal({
  projectId,
  onCancel,
  onCreated,
}: {
  projectId: string;
  onCancel: () => void;
  onCreated: (workbookName: string, result: ProjectWorkbooksResult) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
    const parsed = CreateProjectWorkbooksRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Workbook name is required");
      return;
    }
    const request = parsed.data;
    setPending(true);
    createProjectWorkbooks(projectId, request)
      .then((result) => { onCreated(request.name, result); })
      .catch((err: Error) => {
        setError(err.message.length > 0 ? err.message : "Could not create the workbooks");
        setPending(false);
      });
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lw-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="lw-title">New workbook</h2>
          </div>
          <button type="button" className="modal__close" onClick={onCancel} aria-label="Close" disabled={pending}>
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label className="field__label" htmlFor="lw-name">Workbook name</label>
              <div className="field__hint">Every technical element gets a workbook with this name, linked to each other.</div>
              <input
                ref={inputRef}
                id="lw-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
                className={`field__input${error ? " field__input--error" : ""}`}
                autoComplete="off"
                aria-required="true"
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
              {pending ? "Creating…" : "Create workbook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { LinkedWorkbooksModal };

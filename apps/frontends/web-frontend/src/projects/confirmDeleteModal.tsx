import { JSX, useEffect } from "react";
import { type Project } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";
import "./css/confirmDeleteModal.css";

function ConfirmDeleteModal({
  project,
  onCancel,
  onConfirm,
  pending,
}: {
  project: Project;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onCancel, pending]);

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="cd-title">Delete &quot;{project.name}&quot;?</h2>
            <p className="modal__sub">
              This will permanently delete the project and its analysis data. This action cannot be undone.
            </p>
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
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDeleteModal };

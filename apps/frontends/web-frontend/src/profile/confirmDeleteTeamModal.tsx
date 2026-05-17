import { JSX, useEffect } from "react";
import { type Team } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";

function ConfirmDeleteTeamModal({
  team,
  onCancel,
  onConfirm,
  pending,
}: {
  team: Team;
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
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="dt-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="dt-title">Delete &quot;{team.name}&quot;?</h2>
            <p className="modal__sub">
              All {team.memberCount} member{team.memberCount === 1 ? "" : "s"} will lose access. Pending invitations and join requests are dropped. This cannot be undone.
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
            {pending ? "Deleting…" : "Delete team"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDeleteTeamModal };

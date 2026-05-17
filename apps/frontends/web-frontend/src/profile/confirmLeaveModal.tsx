import { JSX, useEffect } from "react";
import { type Team } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";

function ConfirmLeaveModal({
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

  const isPending = team.role === "pending";
  const title = isPending ? `Cancel your request to "${team.name}"?` : `Leave "${team.name}"?`;
  const body = isPending
    ? "Your pending join request will be withdrawn. You can request again later."
    : "You'll lose access to the team's shared analyses. The admin can re-invite you any time.";
  const confirmLabel = isPending ? "Cancel request" : "Leave team";

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="cl-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="cl-title">{title}</h2>
            <p className="modal__sub">{body}</p>
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
            Keep membership
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmLeaveModal };

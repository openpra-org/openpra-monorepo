import { type JSX } from "react";
import { type RevisionedSaveStatus } from "./useRevisionedMefPatch";

const SAVE_STATUS_LABELS: Record<RevisionedSaveStatus, string> = {
  saving: "Saving",
  saved: "Saved",
  failed: "Save failed",
};

function WorkbookSaveIndicator({
  status = "saved",
  workbookVersion,
}: {
  status?: RevisionedSaveStatus;
  workbookVersion: string;
}): JSX.Element {
  return (
    <span
      className={`poshd__save-pill poshd__save-pill--${status}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="poshd__save-pill-dot" />
      {SAVE_STATUS_LABELS[status]} · v{workbookVersion}
    </span>
  );
}

export { WorkbookSaveIndicator };

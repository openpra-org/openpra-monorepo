import { JSX } from "react";
import { ArchiveIcon } from "../welcome/icons";
import "./css/archivedToggle.css";

function ArchivedToggle({
  showArchived,
  setShowArchived,
  count,
}: {
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  count: number;
}): JSX.Element {
  const disabled = count === 0 && !showArchived;
  const title = count === 0
    ? "No archived projects"
    : (showArchived ? "Hide archived projects" : "Show archived projects");

  return (
    <button
      type="button"
      className={`ap__archive-toggle${showArchived ? " ap__archive-toggle--active" : ""}`}
      onClick={() => { setShowArchived(!showArchived); }}
      aria-pressed={showArchived}
      title={title}
      disabled={disabled}
    >
      <ArchiveIcon />
      <span>Archived</span>
      {count > 0 && <span className="ap__archive-toggle-count">{count}</span>}
    </button>
  );
}

export { ArchivedToggle };

import { JSX, KeyboardEvent } from "react";
import { type Project } from "interfaces-shared-types";
import { formatRelative } from "./formatRelative";
import "./css/sharedProjectCard.css";

function SharedProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }): JSX.Element {
  function handleKey(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  const pct = Math.round(project.progress * 100);

  return (
    <article
      className="shared__card"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <div className="shared__card-head">
        <h3 className="shared__card-title">{project.name}</h3>
        <span className="chip chip--soft">{project.modeLabel}</span>
      </div>
      <div className="shared__card-body">
        <div className="shared__owner">
          <span className="shared__owner-av">{project.ownerInitials}</span>
          {project.ownerFullName}
        </div>
        <div className="shared__mini-bar">
          <div className="shared__mini-track">
            <div className="shared__mini-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="shared__pct">{pct}%</span>
        </div>
        <div className="shared__card-foot">
          <span>Edited {formatRelative(project.updatedAt)}</span>
          <span className="shared__open">Open →</span>
        </div>
      </div>
    </article>
  );
}

export { SharedProjectCard };

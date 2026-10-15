import { JSX } from "react";
import { type Project } from "interfaces-shared-types";
import { ArrowRightIcon, ClockIcon, UsersIcon } from "./icons";
import { formatRelative } from "./formatRelative";
import "./css/recentProjectCard.css";

function RecentProjectCard({
  project,
  onContinue,
}: {
  project: Project;
  onContinue: () => void;
}): JSX.Element {
  return (
    <article className="recent">
      <div className="recent__chips">
        <span className="chip chip--mode">{project.modeLabel}</span>
        <span className="chip chip--soft">
          <ClockIcon /> Edited {formatRelative(project.updatedAt)}
        </span>
        <span className="chip chip--soft">
          <UsersIcon /> {project.sharedUsers.length} collaborator{project.sharedUsers.length === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="recent__title">{project.name}</h2>

      <div className="recent__actions">
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          Continue analysis <ArrowRightIcon />
        </button>
      </div>
    </article>
  );
}

export { RecentProjectCard };

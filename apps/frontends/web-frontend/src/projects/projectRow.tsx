import { JSX, KeyboardEvent } from "react";
import { type Project } from "interfaces-shared-types";
import { PinIcon, UsersIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { KebabMenu } from "./kebabMenu";
import type { ProjectCardProps } from "./projectCard";

function ProjectRow(props: ProjectCardProps): JSX.Element {
  const { project, onOpen } = props;
  const pct = Math.round(project.progress * 100);

  function handleKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      className={`ap__tr pcard--${project.state}`}
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
    >
      <div className="ap__td ap__td--name" role="cell">
        {project.pinned && (
          <span className="pcard__pin pcard__pin--row" title="Pinned"><PinIcon /></span>
        )}
        <div className="ap__td-name-wrap">
          <div className="ap__td-name">{project.name}</div>
          {project.state === "baseline" && (
            <span className="chip chip--success chip--xs">Baseline</span>
          )}
          {project.state === "archived" && (
            <span className="chip chip--muted chip--xs">Archived</span>
          )}
        </div>
      </div>
      <div className="ap__td" role="cell">
        <span className="chip chip--mode chip--xs">{project.modeLabel}</span>
        {project.sharedTeams.map((s) => (
          <span key={s.teamId} className="chip chip--team chip--xs" title={`Shared with team ${s.teamName} (${s.role})`}>
            <UsersIcon /> {s.teamName}
          </span>
        ))}
      </div>
      <div className="ap__td ap__td--progress" role="cell">
        <div className="ap__td-progress">
          <div className="ap__td-progress-bar">
            <div className="ap__td-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="ap__td-pct">{pct}%</span>
        </div>
      </div>
      <div className="ap__td" role="cell">{project.sharedUsers.length}</div>
      <div className="ap__td ap__td--muted" role="cell">
        {formatRelative(project.updatedAt)}
      </div>
      <div className="ap__td ap__td--actions" role="cell">
        <KebabMenu {...props} />
      </div>
    </div>
  );
}

export { ProjectRow };

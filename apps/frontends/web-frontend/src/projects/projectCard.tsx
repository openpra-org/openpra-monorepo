import { JSX, KeyboardEvent } from "react";
import { type Project } from "interfaces-shared-types";
import { ClockIcon, PinIcon, UsersIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { KebabMenu } from "./kebabMenu";
import "./css/projectCard.css";

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}

function ProjectCard(props: ProjectCardProps): JSX.Element {
  const { project, onOpen, readOnly } = props;

  function handleKey(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <article
      className={`pcard pcard--${project.state}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={handleKey}
    >
      <div className="pcard__top">
        <div className="pcard__chips">
          <span className="chip chip--mode">{project.modeLabel}</span>
          {project.myRole === "editor" && (
            <span className="chip chip--role">Editor</span>
          )}
          {project.myRole === "viewer" && (
            <span className="chip chip--role-view">View only</span>
          )}
          {project.sharedTeams.map((s) => (
            <span key={s.teamId} className="chip chip--team" title={`Shared with team ${s.teamName} (${s.role})`}>
              <UsersIcon /> {s.teamName}
            </span>
          ))}
          {project.state === "archived" && <span className="chip chip--muted">Archived</span>}
        </div>
        {readOnly !== true && <KebabMenu {...props} />}
      </div>

      <h3 className="pcard__title">
        {project.pinned && (
          <span className="pcard__pin" title="Pinned"><PinIcon /></span>
        )}
        {project.name}
      </h3>

      <div className="pcard__foot">
        <span className="pcard__foot-item">
          <ClockIcon /> Edited {formatRelative(project.updatedAt)}
        </span>
        <span className="pcard__foot-item">
          <UsersIcon /> {project.sharedUsers.length}
        </span>
      </div>
    </article>
  );
}

export { ProjectCard };
export type { ProjectCardProps };

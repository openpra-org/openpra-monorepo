import { JSX, KeyboardEvent } from "react";
import { type Project, elementsForMode } from "interfaces-shared-types";
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
}

function ProjectCard(props: ProjectCardProps): JSX.Element {
  const { project, onOpen } = props;
  const elements = elementsForMode(project.mode);
  const atBaseline = elements.filter((e) => project.status[e.code] === "baseline").length;
  const pct = Math.round(project.progress * 100);

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
          {project.state === "baseline" && <span className="chip chip--success">Baseline</span>}
          {project.state === "archived" && <span className="chip chip--muted">Archived</span>}
        </div>
        <KebabMenu {...props} />
      </div>

      <h3 className="pcard__title">
        {project.pinned && (
          <span className="pcard__pin" title="Pinned"><PinIcon /></span>
        )}
        {project.name}
      </h3>

      <div className="pcard__progress">
        <div className="pcard__progress-head">
          <span className="pcard__progress-label">
            {atBaseline} of {elements.length} elements at baseline
          </span>
          <span className="pcard__progress-pct">{pct}%</span>
        </div>
        <div
          className="pcard__progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="pcard__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="pcard__dots" aria-label="Technical element status">
        {elements.map((e) => {
          const status = project.status[e.code] ?? "not-started";
          return (
            <span
              key={e.code}
              className={`pcard__dot pcard__dot--${status}`}
              title={`${e.code} · ${e.name}`}
            />
          );
        })}
      </div>

      <div className="pcard__foot">
        <span className="pcard__foot-item">
          <ClockIcon /> Edited {formatRelative(project.updatedAt)}
        </span>
        <span className="pcard__foot-item">
          <UsersIcon /> {project.collaborators.length}
        </span>
      </div>
    </article>
  );
}

export { ProjectCard };
export type { ProjectCardProps };

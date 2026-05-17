import { JSX } from "react";
import { type Project, elementsForMode } from "interfaces-shared-types";
import { ArrowRightIcon, ClockIcon, UsersIcon } from "./icons";
import { formatRelative } from "./formatRelative";
import "./css/recentProjectCard.css";

function RecentProjectCard({
  project,
  onContinue,
  onViewAll,
}: {
  project: Project;
  onContinue: () => void;
  onViewAll: () => void;
}): JSX.Element {
  const elements = elementsForMode(project.mode);
  const atBaseline = elements.filter((e) => project.status[e.code] === "baseline").length;
  const pct = Math.round(project.progress * 100);

  return (
    <article className="recent">
      <div className="recent__head">
        <div className="recent__head-l">
          <div className="recent__chips">
            <span className="chip chip--mode">{project.modeLabel}</span>
            <span className="chip chip--soft">
              <ClockIcon /> Edited {formatRelative(project.updatedAt)}
            </span>
            <span className="chip chip--soft">
              <UsersIcon /> {project.collaborators.length} collaborators
            </span>
          </div>
          <h2 className="recent__title">{project.name}</h2>
        </div>
      </div>

      <div className="progress" aria-label="Overall progress">
        <div className="progress__head">
          <span className="progress__label">Overall progress</span>
          <span className="progress__pct">{pct}%</span>
        </div>
        <div
          className="progress__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="elements">
        <div className="elements__head">
          <span className="elements__title">
            Technical elements · {atBaseline} of {elements.length} at baseline
          </span>
          <span className="elements__legend">
            <span><span className="elements__legend-dot elements__legend-dot--baseline" />Baseline</span>
            <span><span className="elements__legend-dot elements__legend-dot--in-progress" />In progress</span>
            <span><span className="elements__legend-dot elements__legend-dot--not-started" />Not started</span>
          </span>
        </div>
        <div className="elements__list">
          {elements.map((e) => {
            const status = project.status[e.code] ?? "not-started";
            return (
              <div
                key={e.code}
                className={`element element--${status}`}
                title={`${e.name} · ${status.replace("-", " ")}`}
              >
                <span className="element__dot" />
                <span className="element__code">{e.code}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="recent__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={onContinue}>
          Continue analysis <ArrowRightIcon />
        </button>
        <button type="button" className="btn btn--link" onClick={onViewAll}>
          View all projects
        </button>
      </div>
    </article>
  );
}

export { RecentProjectCard };

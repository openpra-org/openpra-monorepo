import { JSX } from "react";
import { type Project } from "interfaces-shared-types";
import { ArrowLeftIcon, ClockIcon, SettingsIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { KebabMenu } from "./kebabMenu";

interface ProjectHeaderProps {
  project: Project;
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function ProjectHeader(props: ProjectHeaderProps): JSX.Element {
  const { project, onBack, onOpenHistory, onOpenSettings } = props;
  return (
    <div className="phead">
      <button type="button" className="phead__back" onClick={onBack}>
        <ArrowLeftIcon /> All projects
      </button>
      <div className="phead__row">
        <div className="phead__title-block">
          <h1 className="phead__title">{project.name}</h1>
          <div className="phead__meta">
            <span className="chip chip--mode">{project.modeLabel}</span>
            <span className="phead__sep" aria-hidden="true">·</span>
            <span className="phead__version">v{project.version}</span>
            <span className="phead__sep" aria-hidden="true">·</span>
            <span>Edited {formatRelative(project.updatedAt)}</span>
          </div>
        </div>
        <div className="phead__actions">
          <button type="button" className="btn btn--ghost btn--sm phead__history-btn" onClick={onOpenHistory}>
            <ClockIcon /> History
          </button>
          <button type="button" className="btn btn--ghost btn--sm phead__history-btn" onClick={onOpenSettings}>
            <SettingsIcon /> Settings
          </button>
          <KebabMenu
            project={project}
            onOpen={onBack}
            onTogglePin={props.onTogglePin}
            onRename={props.onRename}
            onDuplicate={props.onDuplicate}
            onShare={props.onShare}
            onToggleArchive={props.onToggleArchive}
            onDelete={props.onDelete}
          />
        </div>
      </div>
    </div>
  );
}

export { ProjectHeader };
export type { ProjectHeaderProps };

import { JSX, useMemo, useState } from "react";
import { type Project, type Workbook, elementsForMode } from "interfaces-shared-types";
import { ArrowLeftIcon, ClockIcon, FolderIcon, SettingsIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { LegacyElementPane } from "../workbooks/legacyElementPane";
import { KebabMenu } from "./kebabMenu";
import { elementVisualStatus } from "./elementRow";

interface ActiveElement {
  code: string;
  name: string;
}

function WorkspaceLegacy({
  project,
  onBack,
  onOpenHistory,
  onOpenSettings,
  onOpenWorkbook,
  onError,
  onTogglePin,
  onRename,
  onDuplicate,
  onShare,
  onToggleArchive,
  onDelete,
}: {
  project: Project;
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenWorkbook: (workbook: Workbook) => void;
  onError: (message: string) => void;
  onTogglePin: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}): JSX.Element {
  const elements = useMemo(() => elementsForMode(project.mode), [project.mode]);
  const readOnly = project.myRole === "viewer";

  const defaultActive = useMemo<ActiveElement | null>(
    () => (elements.length > 0 ? { code: elements[0].code, name: elements[0].name } : null),
    [elements],
  );
  const [active, setActive] = useState<ActiveElement | null>(defaultActive);

  return (
    <div className="lgl">
      <aside className="lgl__rail" aria-label="Technical elements">
        <div className="lgl__rail-head">
          <span className="lgl__rail-eyebrow">Technical elements</span>
          <span className="lgl__rail-count">{elements.length}</span>
        </div>
        <nav className="lgl__nav">
          {elements.map((el) => {
            const vstatus = elementVisualStatus(project.status[el.code]);
            const isActive = active !== null && active.code === el.code;
            return (
              <button
                type="button"
                key={el.code}
                className={`lgl__elhead${isActive ? " lgl__elhead--active" : ""}`}
                onClick={() => { setActive({ code: el.code, name: el.name }); }}
              >
                <span className={`lgl__elhead-code lgl__elhead-code--${vstatus}`}>{el.code}</span>
                <span className="lgl__elhead-name">{el.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="lgl__pane" aria-label="Workbooks">
        <div className="lgl__pane-head">
          <button type="button" className="phead__back" onClick={onBack}>
            <ArrowLeftIcon /> All projects
          </button>
          <div className="lgl__pane-title-row">
            <div className="lgl__pane-title-block">
              <h1 className="lgl__pane-title">{project.name}</h1>
              <div className="lgl__pane-meta">
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
                onTogglePin={onTogglePin}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onShare={onShare}
                onToggleArchive={onToggleArchive}
                onDelete={onDelete}
              />
            </div>
          </div>
        </div>

        {active !== null ? (
          <LegacyElementPane
            projectId={project.id}
            element={active}
            readOnly={readOnly}
            onOpenWorkbook={onOpenWorkbook}
            onError={onError}
          />
        ) : (
          <div className="lgl__pane-empty">
            <FolderIcon />
            <p>Pick a technical element from the left to see its workbooks.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export { WorkspaceLegacy };

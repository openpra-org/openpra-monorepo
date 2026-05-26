import { JSX, useMemo, useState } from "react";
import { type Project, type ToolId, type Workbook, elementsForMode, toolsForElement } from "interfaces-shared-types";
import { ArrowLeftIcon, ClockIcon, FolderIcon, SettingsIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import { LegacyToolPane } from "../workbooks/legacyToolPane";
import { KebabMenu } from "./kebabMenu";
import { elementVisualStatus } from "./elementRow";

function ChevronIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

interface ActiveTool {
  element: { code: string; name: string };
  tool: { id: ToolId; name: string };
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

  const defaultActive = useMemo<ActiveTool | null>(() => {
    for (const el of elements) {
      const tools = toolsForElement(el.code);
      if (tools.length > 0) {
        return { element: { code: el.code, name: el.name }, tool: { id: tools[0].id, name: tools[0].name } };
      }
    }
    return null;
  }, [elements]);

  const [active, setActive] = useState<ActiveTool | null>(defaultActive);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    defaultActive !== null ? { [defaultActive.element.code]: true } : {},
  );

  function toggle(code: string): void {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  }

  return (
    <div className="lgl">
      <aside className="lgl__rail" aria-label="Technical elements and tools">
        <div className="lgl__rail-head">
          <span className="lgl__rail-eyebrow">Technical elements</span>
          <span className="lgl__rail-count">{elements.length}</span>
        </div>
        <nav className="lgl__nav">
          {elements.map((el) => {
            const tools = toolsForElement(el.code);
            const open = expanded[el.code] === true;
            const vstatus = elementVisualStatus(project.status[el.code]);
            return (
              <div className={`lgl__elgroup lgl__elgroup--${vstatus}`} key={el.code}>
                <button type="button" className="lgl__elhead" onClick={() => { toggle(el.code); }} aria-expanded={open}>
                  <span className={`lgl__elhead-chev${open ? " lgl__elhead-chev--open" : ""}`}><ChevronIcon /></span>
                  <span className={`lgl__elhead-code lgl__elhead-code--${vstatus}`}>{el.code}</span>
                  <span className="lgl__elhead-name">{el.name}</span>
                </button>
                {open && (
                  <ul className="lgl__tools">
                    {tools.length > 0 ? (
                      tools.map((tool) => {
                        const isActive = active !== null && active.tool.id === tool.id;
                        return (
                          <li key={tool.id}>
                            <button
                              type="button"
                              className={`lgl__tool${isActive ? " lgl__tool--active" : ""}`}
                              onClick={() => { setActive({ element: { code: el.code, name: el.name }, tool: { id: tool.id, name: tool.name } }); }}
                            >
                              <span className="lgl__tool-dot" aria-hidden="true" />
                              <span className="lgl__tool-name">{tool.name}</span>
                            </button>
                          </li>
                        );
                      })
                    ) : (
                      <li className="lgl__tools-empty">No tools yet</li>
                    )}
                  </ul>
                )}
              </div>
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
          <LegacyToolPane
            projectId={project.id}
            element={active.element}
            tool={active.tool}
            readOnly={readOnly}
            onOpenWorkbook={onOpenWorkbook}
            onError={onError}
          />
        ) : (
          <div className="lgl__pane-empty">
            <FolderIcon />
            <p>Pick a tool from the left to see its workbooks.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export { WorkspaceLegacy };

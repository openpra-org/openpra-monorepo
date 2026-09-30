import { useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { SyDiagramView, capturePointer, useElementSize } from "./SyDiagramCanvas";
import { withoutDiagram } from "./syDiagrams";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syDiagrams.css";

type FaultTreeView = "tree" | "diagram";

const VIEW_KEY = "sy.faultTreeView";
const ZOOM_STEPS = [1, 1.5, 2, 3, 4];
const FIT_INSET = 24;
const VIEWS: readonly { id: FaultTreeView; label: string }[] = [
  { id: "tree", label: "Fault tree" },
  { id: "diagram", label: "Diagram" },
];

function readView(): FaultTreeView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "diagram" ? "diagram" : "tree";
  } catch {
    return "tree";
  }
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function writeView(view: FaultTreeView): void {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    return;
  }
}

function ViewSwitch({ view, onChange }: { view: FaultTreeView; onChange: (view: FaultTreeView) => void }): JSX.Element {
  const group = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = VIEWS.findIndex((option) => option.id === view);
    const next = event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length;
    const target = VIEWS[next];
    if (target === undefined) return;
    onChange(target.id);
    group.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  return (
    <div ref={group} className="sy-ft-switch" role="radiogroup" aria-label="Fault tree view" onKeyDown={onKeyDown}>
      {VIEWS.map((option) => {
        const active = option.id === view;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={`sy-ft-switch__option${active ? " sy-ft-switch__option--active" : ""}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DiagramPanel({ systemId, onAddDiagram, onEditDiagram }: {
  systemId: string;
  onAddDiagram?: () => void;
  onEditDiagram?: (diagramId: string) => void;
}): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const diagrams = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId)?.diagrams ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const view = useRef<HTMLDivElement>(null);
  const box = useElementSize(view);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const focus = useRef({ x: 0.5, y: 0.5 });
  const diagram = diagrams.find((candidate) => candidate.uuid === selectedId) ?? diagrams[0];
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const zoomed = zoom > 1;

  useLayoutEffect(() => {
    const element = view.current;
    const figure = element?.querySelector("canvas");
    if (element === null || figure === null || figure === undefined) return;
    element.scrollLeft = figure.offsetLeft + focus.current.x * figure.offsetWidth - element.clientWidth / 2;
    element.scrollTop = figure.offsetTop + focus.current.y * figure.offsetHeight - element.clientHeight / 2;
  }, [zoom]);

  function zoomTo(next: number): void {
    const element = view.current;
    const figure = element?.querySelector("canvas");
    if (element !== null && figure !== null && figure !== undefined && figure.offsetWidth > 0 && figure.offsetHeight > 0) {
      focus.current = {
        x: unit((element.scrollLeft + element.clientWidth / 2 - figure.offsetLeft) / figure.offsetWidth),
        y: unit((element.scrollTop + element.clientHeight / 2 - figure.offsetTop) / figure.offsetHeight),
      };
    }
    setZoom(next);
  }

  function select(diagramId: string): void {
    focus.current = { x: 0.5, y: 0.5 };
    setSelectedId(diagramId);
    setZoom(1);
  }

  function remove(diagramId: string): void {
    if (!editable) return;
    focus.current = { x: 0.5, y: 0.5 };
    setSelectedId(null);
    setZoom(1);
    mutateSy((draft) => withoutDiagram(draft, systemId, diagramId));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || !zoomed) return;
    capturePointer(event);
    drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const start = drag.current;
    if (start === null) return;
    event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
    event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
  }

  return (
    <section className="sy-ft-diagrams" aria-label="Diagrams">
      {diagrams.length === 0 ? (
        <div className="sy-ft-diagrams__empty">
          <p>No diagrams for this system yet.</p>
          {onAddDiagram !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onAddDiagram}>Add diagram</button>}
        </div>
      ) : (
        <>
          <div className="sy-ft-diagrams__bar">
            {diagrams.length > 1 ? (
              <select className="posfield__select" aria-label="Diagram" value={diagram?.uuid ?? ""} onChange={(event) => select(event.target.value)}>
                {diagrams.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{candidate.title}</option>)}
              </select>
            ) : <strong className="sy-ft-diagrams__title">{diagram?.title}</strong>}
            <div className="sy-ft-diagrams__tools">
              {editable && diagram !== undefined && (
                <div className="sy-ft-diagrams__actions">
                  {onAddDiagram !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onAddDiagram}>Add diagram</button>}
                  {onEditDiagram !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Edit ${diagram.title}`} onClick={() => onEditDiagram(diagram.uuid)}>Edit</button>}
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${diagram.title}`} onClick={() => remove(diagram.uuid)}>Remove</button>
                </div>
              )}
              <div className="sy-ft-diagrams__zoom">
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => zoomTo(ZOOM_STEPS[Math.max(0, zoomIndex - 1)] ?? 1)}>−</button>
                <span className="sy-diagram-status">{Math.round(zoom * 100)}%</span>
                <button type="button" className="posnav__btn posnav__btn--sm" aria-label="Zoom in" disabled={zoomIndex >= ZOOM_STEPS.length - 1} onClick={() => zoomTo(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)] ?? 1)}>+</button>
                <button type="button" className="posnav__btn posnav__btn--sm" disabled={!zoomed} onClick={() => zoomTo(1)}>Fit</button>
              </div>
            </div>
          </div>
          <div
            ref={view}
            className={`sy-ft-diagrams__view${zoomed ? " sy-ft-diagrams__view--zoomed" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            {diagram !== undefined && box.width > FIT_INSET && box.height > FIT_INSET && (
              <SyDiagramView diagram={diagram} width={Math.floor((box.width - FIT_INSET) * zoom)} height={Math.floor((box.height - FIT_INSET) * zoom)} />
            )}
          </div>
          {diagram !== undefined && <p className="sy-diagram-status">{diagram.filename}, page {diagram.page}</p>}
        </>
      )}
    </section>
  );
}

function SyFaultTreeDiagrams({ systemId, onAddDiagram, onEditDiagram, children }: {
  systemId: string;
  onAddDiagram?: () => void;
  onEditDiagram?: (diagramId: string) => void;
  children: ReactNode;
}): JSX.Element {
  const [view, setView] = useState<FaultTreeView>(readView);

  function change(next: FaultTreeView): void {
    setView(next);
    writeView(next);
  }

  return (
    <div className="sy-ft-wrap">
      <div className="sy-ft-wrap__bar">
        <ViewSwitch view={view} onChange={change} />
      </div>
      <div className="sy-ft-wrap__editor" hidden={view === "diagram"}>{children}</div>
      {view === "diagram" && <DiagramPanel systemId={systemId} onAddDiagram={onAddDiagram} onEditDiagram={onEditDiagram} />}
    </div>
  );
}

export { SyFaultTreeDiagrams };

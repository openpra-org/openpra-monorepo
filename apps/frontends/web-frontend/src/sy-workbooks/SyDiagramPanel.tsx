import { useLayoutEffect, useRef, type JSX, type PointerEvent } from "react";
import { z } from "zod";
import { jsonView, useWorkbookView, useWorkbookViewSlot } from "../workbooks/workbookViewMemory";
import { SyDiagramView, capturePointer, useElementSize } from "./SyDiagramCanvas";
import { withoutDiagram } from "./syDiagrams";
import { useSyWorkbook } from "./syWorkbookContext";
import "./css/syDiagrams.css";

const ZOOM_STEPS = [1, 1.5, 2, 3, 4];
const FIT_INSET = 24;

interface DiagramChoice {
  diagramId: string | null;
  zoom: number;
}

interface DiagramFocus {
  x: number;
  y: number;
}

const FIRST_DIAGRAM: DiagramChoice = { diagramId: null, zoom: 1 };
const CENTER: DiagramFocus = { x: 0.5, y: 0.5 };
const CHOICE_VIEW = jsonView<DiagramChoice>(z.object({
  diagramId: z.string().nullable(),
  zoom: z.number().refine((value) => ZOOM_STEPS.includes(value)),
}));
const FOCUS_VIEW = jsonView<DiagramFocus>(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }));

function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function SyDiagramPanel({ systemId, onAddDiagram, onEditDiagram }: {
  systemId: string;
  onAddDiagram?: () => void;
  onEditDiagram?: (diagramId: string) => void;
}): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const diagrams = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId)?.diagrams ?? [];
  const [choice, setChoice] = useWorkbookView<DiagramChoice>(`diagram:${systemId}`, FIRST_DIAGRAM, CHOICE_VIEW);
  const focusSlot = useWorkbookViewSlot<DiagramFocus>(`diagram.focus:${systemId}`, FOCUS_VIEW);
  const view = useRef<HTMLDivElement>(null);
  const box = useElementSize(view);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const focus = useRef<DiagramFocus>(focusSlot.read() ?? CENTER);
  const zoom = choice.zoom;
  const diagram = diagrams.find((candidate) => candidate.uuid === choice.diagramId) ?? diagrams[0];
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const zoomed = zoom > 1;

  useLayoutEffect(() => {
    const element = view.current;
    const figure = element?.querySelector("canvas");
    if (element === null || figure === null || figure === undefined) return;
    element.scrollLeft = figure.offsetLeft + focus.current.x * figure.offsetWidth - element.clientWidth / 2;
    element.scrollTop = figure.offsetTop + focus.current.y * figure.offsetHeight - element.clientHeight / 2;
  }, [zoom, box.width, box.height]);

  function remember(): void {
    const element = view.current;
    const figure = element?.querySelector("canvas");
    if (element === null || figure === null || figure === undefined || figure.offsetWidth <= 0 || figure.offsetHeight <= 0) return;
    focus.current = {
      x: unit((element.scrollLeft + element.clientWidth / 2 - figure.offsetLeft) / figure.offsetWidth),
      y: unit((element.scrollTop + element.clientHeight / 2 - figure.offsetTop) / figure.offsetHeight),
    };
    focusSlot.write(focus.current);
  }

  function recenter(): void {
    focus.current = CENTER;
    focusSlot.write(CENTER);
  }

  function zoomTo(next: number): void {
    remember();
    setChoice((current) => ({ ...current, zoom: next }));
  }

  function select(diagramId: string): void {
    recenter();
    setChoice({ diagramId, zoom: 1 });
  }

  function remove(diagramId: string): void {
    if (!editable) return;
    recenter();
    setChoice(FIRST_DIAGRAM);
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
            onScroll={remember}
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

export { SyDiagramPanel };

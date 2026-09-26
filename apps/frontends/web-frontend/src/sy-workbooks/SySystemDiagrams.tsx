import { useRef, useState, type JSX } from "react";
import { ReviewTitle } from "./syShared";
import { SyDiagramView, useElementWidth } from "./SyDiagramCanvas";
import { withoutDiagram } from "./syDiagrams";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";
import "./css/syDiagrams.css";

function SySystemDiagrams({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element | null {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const figure = useRef<HTMLDivElement>(null);
  const width = useElementWidth(figure);
  const system = sy.systemDefinitions.find((candidate) => candidate.uuid === systemId);
  if (system === undefined) return null;
  const diagrams = system.diagrams ?? [];
  const viewing = diagrams.find((diagram) => diagram.uuid === viewingId);

  function remove(diagramId: string): void {
    if (!editable) return;
    if (viewingId === diagramId) setViewingId(null);
    mutateSy((draft) => withoutDiagram(draft, systemId, diagramId));
  }

  return (
    <section className="sy-review-section" aria-label="Diagrams">
      <ReviewTitle title="Diagrams" sr="SY-A8">
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => openDrawer({ kind: "diagram", id: systemId })}>Add diagram</button>}
      </ReviewTitle>
      {diagrams.length === 0 ? <p className="sy-review-empty">No diagrams yet.</p> : (
        <table className="sy-review-table" aria-label="Diagrams">
          <thead><tr><th scope="col">Diagram</th><th scope="col">Source</th><th scope="col" className={`sy-review-edit ${editable ? "sy-review-edit--trio" : "sy-review-edit--pair"}`} aria-label="Actions" /></tr></thead>
          <tbody>
            {diagrams.map((diagram) => {
              const open = diagram.uuid === viewingId;
              return (
                <tr key={diagram.uuid}>
                  <td><span className="sy-review-name">{diagram.title}</span></td>
                  <td><span>{diagram.filename}</span><span className="sy-review-sub">Page {diagram.page}</span></td>
                  <td className={`sy-review-edit ${editable ? "sy-review-edit--trio" : "sy-review-edit--pair"}`}>
                    <div className="sy-review-row-actions">
                      <button type="button" className="posnav__btn posnav__btn--sm" aria-pressed={open} aria-label={`${open ? "Hide" : "View"} ${diagram.title}`} onClick={() => setViewingId(open ? null : diagram.uuid)}>{open ? "Hide" : "View"}</button>
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Edit ${diagram.title}`} onClick={() => openDrawer({ kind: "diagram", id: systemId, diagramId: diagram.uuid })}>Edit</button>}
                      {editable && <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`Remove ${diagram.title}`} onClick={() => remove(diagram.uuid)}>Remove</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div ref={figure} className="sy-diagram-figure-slot">
        {viewing !== undefined && width > 0 && (
          <figure className="sy-diagram-figure">
            <SyDiagramView diagram={viewing} width={width - 24} />
            <figcaption>{viewing.title} · {viewing.filename}, page {viewing.page}</figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

export { SySystemDiagrams };

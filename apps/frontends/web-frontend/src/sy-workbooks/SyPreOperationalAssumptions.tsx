import type { JSX } from "react";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { SYProvenanceChip } from "./syShared";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

function SyPreOperationalAssumptions({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element | null {
  const { sy, editable, mutateSy } = useSyWorkbook();
  if (sy.plantStage !== "PRE_OPERATIONAL") return null;
  const firstSystem = sy.systemDefinitions[0]?.uuid;
  const rows = (sy.preOperationalAssumptions ?? []).filter((item) =>
    item.affectedElementIds.includes(systemId) || (item.affectedElementIds.length === 0 && systemId === firstSystem));
  function add(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({ ...draft, preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), {
      uuid, assumptionId: uuid, description: "", influenceOnDefinition: "", status: "OPEN" as const,
      limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [systemId],
    }] }));
    openDrawer({ kind: "assum", id: uuid });
  }
  const actionLabel = editable ? "Edit" : "View";
  return <section className="sy-review-section" aria-label="Pre-operational assumptions">
    <div className="sy-review-title"><h3>Pre-operational assumptions</h3>
      <div className="sy-review-actions"><SYProvenanceChip>SY-A33</SYProvenanceChip>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add assumption</button>}</div>
    </div>
    {rows.length === 0 ? <p className="sy-review-empty">No pre-operational assumption recorded for this system.</p> :
      <table className="sy-review-table" aria-label="Pre-operational assumptions"><thead><tr><th scope="col">Assumption</th><th scope="col">Area</th><th scope="col">Status</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.uuid}>
          <td>{item.description || <span className="sy-review-none">Not recorded</span>}</td>
          <td>{item.influenceOnDefinition || <span className="sy-review-none">Not recorded</span>}</td>
          <td>{item.status}</td>
          <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} assumption`} onClick={() => openDrawer({ kind: "assum", id: item.uuid })}>{actionLabel}</button></td>
        </tr>)}</tbody></table>}
  </section>;
}

export { SyPreOperationalAssumptions };

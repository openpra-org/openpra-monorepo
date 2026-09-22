import type { JSX } from "react";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { SYIcon } from "./syIcons";
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
  return <section className="poscard">
    <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Pre-operational assumptions" level={3} />
      <div className="posrow" style={{ gap: 8, alignItems: "center" }}><SYProvenanceChip>SY-A33</SYProvenanceChip>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}><SYIcon.Plus /> Add assumption</button>}</div>
    </div>
    <p className="poscard__sub">Track assumptions about this system until plant information can confirm them.</p>
    {rows.length === 0 ? <p className="possubtle">No pre-operational assumption recorded for this system.</p> :
      <div className="postable-wrap"><table className="postable"><thead><tr><th>Assumption</th><th>Area</th><th>Status</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "assum", id: item.uuid })}>
          <td>{item.description || "Unspecified"}</td><td>{item.influenceOnDefinition || "—"}</td><td>{item.status}</td>
        </tr>)}</tbody></table></div>}
  </section>;
}

export { SyPreOperationalAssumptions };

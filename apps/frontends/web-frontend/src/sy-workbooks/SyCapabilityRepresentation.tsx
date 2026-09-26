import type { JSX } from "react";
import { NotRecorded, ReviewLines, SYProvenanceChip } from "./syShared";
import { useSyWorkbook } from "./syWorkbookContext";
import type { SyDrawerContext } from "./syScreens";

function SyCapabilityRepresentation({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy } = useSyWorkbook();
  const rows = (sy.overCapacityConsiderations ?? []).filter((item) => item.system === systemId);
  function add(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({ ...draft, overCapacityConsiderations: [...(draft.overCapacityConsiderations ?? []), {
      uuid, system: systemId, potentialExceedanceScenarios: [], treatment: "CONSERVATIVE" as const,
      justificationForCapability: "", implementsSrs: [{ sr: "SY-A29", hlr: "A" as const }],
    }] }));
    openDrawer({ kind: "oc", id: uuid });
  }
  const actionLabel = editable ? "Edit" : "View";
  return <section className="sy-review-section" aria-label="Capacity limits">
    <div className="sy-review-title"><h3>Capacity limits</h3>
      <div className="sy-review-actions"><SYProvenanceChip>SY-A29</SYProvenanceChip>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}>Add limit</button>}</div>
    </div>
    {rows.length === 0 ? <p className="sy-review-empty">No capacity limit recorded for this system.</p> : <table className="sy-review-table" aria-label="Capacity limits">
      <thead><tr><th scope="col">Exceedance scenario</th><th scope="col">Treatment</th><th scope="col">Justification</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
      <tbody>{rows.map((item) => {
        const realistic = item.treatment === "REALISTIC_JUSTIFIED";
        const justification = item.justificationForCapability ?? "";
        return <tr key={item.uuid}>
          <td><ReviewLines items={item.potentialExceedanceScenarios} /></td>
          <td>{realistic ? "Realistic (CC-II)" : "Conservative (CC-I)"}</td>
          <td>{justification.length > 0 ? justification : <NotRecorded />}</td>
          <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} capacity limit`} onClick={() => openDrawer({ kind: "oc", id: item.uuid })}>{actionLabel}</button></td>
        </tr>;
      })}</tbody>
    </table>}
  </section>;
}

export { SyCapabilityRepresentation };

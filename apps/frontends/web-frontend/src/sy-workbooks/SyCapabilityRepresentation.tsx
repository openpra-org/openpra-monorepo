import type { JSX } from "react";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { SYIcon } from "./syIcons";
import { SYProvenanceChip } from "./syShared";
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
  return <section className="poscard">
    <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Capability representation" level={3} />
      <div className="posrow" style={{ gap: 8, alignItems: "center" }}><SYProvenanceChip>SY-A29</SYProvenanceChip>
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={add}><SYIcon.Plus /> Add consideration</button>}</div>
    </div>
    <p className="poscard__sub">Record how the selected system is modeled when a rated capability might be exceeded.</p>
    {rows.length === 0 ? <p className="possubtle">No capability consideration recorded for this system.</p> : <div className="syoc">{rows.map((item) => {
      const realistic = item.treatment === "REALISTIC_JUSTIFIED";
      return <button type="button" key={item.uuid} className="syoc__row" onClick={() => openDrawer({ kind: "oc", id: item.uuid })} style={{ cursor: "pointer", width: "100%", textAlign: "left" }}>
        <div><div className="syoc__scn">{item.potentialExceedanceScenarios[0] ?? "Scenario not specified"}</div><div className="syoc__basis">{item.justificationForCapability ?? ""}</div></div>
        <span className={`syd-method syd-method--${realistic ? "realistic" : "conservative"}`}>{realistic ? "Realistic (CC-II)" : "Conservative (CC-I)"}</span>
      </button>;
    })}</div>}
  </section>;
}

export { SyCapabilityRepresentation };

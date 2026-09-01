import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { SYIcon } from "./syIcons";
import { Badge, SYProvenanceChip, type BadgeKind } from "./syShared";
import {
  SCREENING_CRITERIA,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  ccfParams,
  ccfModelCheck,
  toExp,
  CONFIRM_METHODS,
  FAILURE_MODE_LABELS,
  SY_METHODOLOGY_TOC,
  DEP_KIND,
  type CapabilityCategory,
} from "./syViewData";
import { type CcScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { generateSyReport } from "./syDocx";
import { type SyDrawerContext } from "./syScreens";
import { type SystemBasicEvent } from "interfaces-mef-types/sy/systems-analysis";
import { systemFaultTreeBasicEventIds, systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { failureRateToProbability } from "interfaces-mef-types/modeling";

function DepsScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const supportIds = new Set(sy.systemDependencies.map((d) => d.supportingSystem));
  const supportCols = sy.systemDefinitions.filter((s) => editable || supportIds.has(s.uuid)).map((s) => s.uuid);
  const short = shortOf;
  function cellFor(rowId: string, colId: string): string | null {
    const dep = sy.systemDependencies.find((d) => d.dependentSystem === rowId && d.supportingSystem === colId);
    return dep?.details ?? null;
  }
  function cycleDep(rowId: string, colId: string): void {
    if (!editable || rowId === colId) return;
    const kinds = ["power", "signal", "cooling"];
    mutateSy((draft) => {
      const existing = draft.systemDependencies.find((d) => d.dependentSystem === rowId && d.supportingSystem === colId);
      if (existing === undefined) {
        return {
          ...draft,
          systemDependencies: [...draft.systemDependencies, { uuid: crypto.randomUUID(), description: `${rowId} depends on ${colId}`, dependentSystem: rowId, supportingSystem: colId, type: "FUNCTIONAL", details: kinds[0], implementsSrs: [{ sr: "SY-B5", hlr: "B" as const }] }],
        };
      }
      const idx = kinds.indexOf(existing.details ?? "");
      const next = idx >= 0 && idx < kinds.length - 1 ? kinds[idx + 1] : null;
      if (next === null) {
        return { ...draft, systemDependencies: draft.systemDependencies.filter((d) => d.uuid !== existing.uuid) };
      }
      return { ...draft, systemDependencies: draft.systemDependencies.map((d) => (d.uuid === existing.uuid ? { ...d, details: next, description: `${rowId} depends on ${colId}` } : d)) };
    });
  }
  const loops: { id: string; a: string; b: string; ab: string; ba: string; resolution: string | null }[] = [];
  sy.systemDependencies.forEach((d) => {
    const back = sy.systemDependencies.find((x) => x.dependentSystem === d.supportingSystem && x.supportingSystem === d.dependentSystem);
    if (back === undefined) return;
    const a = d.dependentSystem < d.supportingSystem ? d.dependentSystem : d.supportingSystem;
    const b = a === d.dependentSystem ? d.supportingSystem : d.dependentSystem;
    const id = `${a}+${b}`;
    if (loops.some((l) => l.id === id)) return;
    const fwd = a === d.dependentSystem ? d : back;
    const rev = a === d.dependentSystem ? back : d;
    const res = sy.systemLogicModels.flatMap((m) => m.logicLoopResolutions ?? []).find((r) => r.loopId === id);
    loops.push({ id, a, b, ab: fwd.details ?? "", ba: rev.details ?? "", resolution: res === undefined || res.resolution.length === 0 ? null : res.resolution });
  });
  function addSsc(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      supportSystemSuccessCriteria: [...(draft.supportSystemSuccessCriteria ?? []), {
        uuid, systemReference: supportCols[0] ?? draft.systemDefinitions[0]?.uuid ?? "", successCriteria: "", criteriaType: "CONSERVATIVE" as const, supportedSystems: [], implementsSrs: [{ sr: "SY-B7", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ssc", id: uuid });
  }
  function addSpc(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      environmentalDesignBasisConsiderations: [...(draft.environmentalDesignBasisConsiderations ?? []), {
        uuid, systemReference: draft.systemDefinitions[0]?.uuid ?? "", components: [], eventSequences: [], environmentalConditions: "", dependentFailuresIncluded: false, implementsSrs: [{ sr: "SY-B8", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "spc", id: uuid });
  }
  function addInv(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      depletionModels: [...(draft.depletionModels ?? []), {
        uuid, resourceType: "other" as const, description: "", initialQuantity: 0, consumptionRate: 0, units: "hours", associatedSystem: draft.systemDefinitions[0]?.uuid ?? "", missionTimeSupported: false, implementsSrs: [{ sr: "SY-B12", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "inv", id: uuid });
  }
  function addDic(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      digitalInstrumentationAndControl: [...(draft.digitalInstrumentationAndControl ?? []), {
        uuid, name: "", systemReference: draft.systemDefinitions[0]?.uuid ?? "", description: "", methodology: "", failureModes: [], specialConsiderations: [], implementsSrs: [{ sr: "SY-B11", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "dic", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Support dependency matrix" level={3} />
          <SYProvenanceChip>SY-B5 · SY-B6 · SY-B10</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Each row depends on the marked support systems. Click a cell to cycle it between power, signal, cooling and none.</p>
        <div className="sydep">
          <table className="sydep__table">
            <thead>
              <tr>
                <th className="sydep__corner">System</th>
                {supportCols.map((id) => <th key={id} className="sydep__colhead">{short(id)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sy.systemDefinitions.map((row) => (
                <tr key={row.uuid}>
                  <td className="sydep__rowhead">{row.name}</td>
                  {supportCols.map((cid) => {
                    const dep = cellFor(row.uuid, cid);
                    const self = row.uuid === cid;
                    const k = dep !== null ? DEP_KIND[dep] ?? { label: dep, cls: "" } : null;
                    return (
                      <td key={cid} className="sydep__cell" onClick={() => cycleDep(row.uuid, cid)} style={editable && !self ? { cursor: "pointer" } : undefined}>
                        {self ? <span className="sydep__self">—</span>
                          : k !== null ? <span className={`sydep__dep ${k.cls}`}>{k.label}</span>
                          : <span className="sydep__none" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loops.map((l) => (
          <div key={l.id} className="syloop" onClick={() => openDrawer({ kind: "loop", id: l.id })} style={{ cursor: "pointer" }}>
            <div style={{ flex: 1 }}>
              <div className="syloop__head">Logic loop. {short(l.a)} needs {short(l.b)} for {l.ab}, {short(l.b)} needs {short(l.a)} for {l.ba}.</div>
              <div className="syloop__res">{l.resolution ?? "No resolution recorded yet."}</div>
            </div>
            <span className="sylight"><span className={`sylight__dot sylight__dot--${l.resolution !== null ? "s" : "f"}`} /> {l.resolution !== null ? "Resolved" : "Unresolved"}</span>
          </div>
        ))}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Support success criteria" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B7 · SY-B9 · SY-B13</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSsc}><SYIcon.Plus /> Add criterion</button>}
          </div>
        </div>
        <p className="poscard__sub">Conservative criteria at CC-I, or realistic ones for the risk-significant support systems. Click a card to edit it.</p>
        <div className="scsys">
          {(sy.supportSystemSuccessCriteria ?? []).map((n) => {
            const def = sy.systemDefinitions.find((s) => s.uuid === n.systemReference);
            return (
              <div key={n.uuid} className="scsys__card" onClick={() => openDrawer({ kind: "ssc", id: n.uuid })} style={{ cursor: "pointer" }}>
                <div className="scsys__head">
                  <span className="scsys__name">{def?.name ?? n.systemReference}</span>
                  <span className={`syd-method syd-method--${n.criteriaType.toLowerCase()}`} style={{ marginLeft: "auto" }}>{n.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</span>
                </div>
                <div className="scsys__dep" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>{n.successCriteria}</div>
                <div className="scsys__cap" style={{ marginTop: 8 }}>
                  <span className="scsys__cap-k">Supports</span>
                  <span className="scsys__cap-v" style={{ fontFamily: "inherit", fontWeight: 600 }}>{n.supportedSystems.map((x) => short(x)).join(", ")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Spatial and environmental couplings" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B8 · SY-B14</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSpc}><SYIcon.Plus /> Add coupling</button>}
          </div>
        </div>
        <p className="poscard__sub">Two trains in one room are not two independent coin flips, so shared space enters the model. Click a card to edit it.</p>
        <div className="syspc">
          {(sy.environmentalDesignBasisConsiderations ?? []).map((c) => (
            <div key={c.uuid} className="syspc__card" onClick={() => openDrawer({ kind: "spc", id: c.uuid })} style={{ cursor: "pointer" }}>
              <div className="syspc__head">
                <span className="syspc__name">{short(c.systemReference)}</span>
                <span className="sylight" style={{ marginLeft: "auto" }}><span className={`sylight__dot sylight__dot--${c.dependentFailuresIncluded === true ? "s" : "f"}`} /> {c.dependentFailuresIncluded === true ? "In the model" : "Not in the model"}</span>
              </div>
              <div className="syspc__affects">
                {c.components.map((a) => <span key={a} className="syspc__affects-tag">{a}</span>)}
              </div>
              <div className="syspc__hazard">{c.environmentalConditions}</div>
              <div className="syspc__affects">
                {c.eventSequences.map((q) => <span key={q} className="poschip posmono">{q}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Depletable inventories" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B12</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addInv}><SYIcon.Plus /> Add inventory</button>}
          </div>
        </div>
        <p className="poscard__sub">Each inventory is checked against the mission time, the way component times are in Success Criteria. Click a row to edit it.</p>
        <div className="syinv">
          {(sy.depletionModels ?? []).map((d) => {
            const def = sy.systemDefinitions.find((s) => s.uuid === d.associatedSystem);
            const mission = def?.missionTimeHours ?? 24;
            const cap = d.initialQuantity;
            const passive = cap <= 0;
            const span = Math.max(mission, cap);
            const cP = passive ? 100 : Math.max(5, (cap / span) * 100);
            const mP = Math.max(5, (mission / span) * 100);
            const supports = d.missionTimeSupported === true;
            const unit = d.units === "hours" ? "h" : d.units;
            return (
              <div key={d.uuid} className="syinv__row" onClick={() => openDrawer({ kind: "inv", id: d.uuid })} style={{ cursor: "pointer" }}>
                <div className="syinv__lead">
                  <div>
                    <div className="syinv__name">{d.description ?? d.resourceType}</div>
                    <div className="syinv__note">{short(d.associatedSystem ?? "")}</div>
                  </div>
                </div>
                <div className="syinv__gauge">
                  <div className="syinv__bars">
                    <div className="syinv__bar">
                      <span className="syinv__bar-k">Capacity</span>
                      <div className="syinv__track"><div className={`syinv__fill syinv__fill--cap${supports ? "" : " syinv__fill--short"}`} style={{ width: `${cP}%` }} /></div>
                      <span className="syinv__bar-v posmono">{passive ? "Passive" : `${cap} ${unit}`}</span>
                    </div>
                    <div className="syinv__bar">
                      <span className="syinv__bar-k">Mission</span>
                      <div className="syinv__track"><div className="syinv__fill syinv__fill--mission" style={{ width: `${mP}%` }} /></div>
                      <span className="syinv__bar-v posmono">{mission} h</span>
                    </div>
                  </div>
                  <div className="syinv__verdict">
                    <span className="sylight"><span className={`sylight__dot sylight__dot--${supports ? "s" : "f"}`} /> {supports ? "Supports the mission time" : "Falls short of the mission time"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Digital I&C and software" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B11</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDic}><SYIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">For digital actuation this requirement is load-bearing, since software is a shared cause across systems. Click a record to edit it.</p>
        <div className="sydigs">
          {(sy.digitalInstrumentationAndControl ?? []).map((d) => {
            const def = sy.systemDefinitions.find((s) => s.uuid === d.systemReference);
            return (
              <div key={d.uuid} className="sydig" onClick={() => openDrawer({ kind: "dic", id: d.uuid })} style={{ cursor: "pointer" }}>
                <div className="sydig__head">
                  <div>
                    <div className="sydig__name">{d.name}</div>
                    <div className="sydig__sys">{def?.name ?? d.systemReference}</div>
                  </div>
                </div>
                <div className="sydig__modes">
                  {(d.failureModes ?? []).map((m) => <span key={m} className="sydig__mode">{m}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function IntegrityScreen({ stage, openDrawer }: { stage: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const isOp = stage === "operational";
  function addConfirm(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      systemConfirmationRecords: [...(draft.systemConfirmationRecords ?? []), {
        uuid, systemReference: draft.systemDefinitions[0]?.uuid ?? "", method: "DESIGN_REVIEW" as const, date: "", personnelRoles: [], findings: "", implementsSrs: [{ sr: isOp ? "SY-A5" : "SY-A6", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "confirm", id: uuid });
  }
  const events = sy.systemBasicEvents;
  const modeRows = Array.from(new Set(events.map((e) => e.failureMode ?? ""))).filter((m) => m.length > 0).map((mode) => {
    const of = events.filter((e) => e.failureMode === mode);
    return { mode, label: FAILURE_MODE_LABELS[mode] ?? mode, count: of.length, example: of[0]?.uuid ?? "" };
  });
  const gates = sy.systemLogicModels.flatMap((model) => model.gates.map(({ id }) => id));
  const transfers = sy.systemLogicModels.flatMap((model) =>
    model.leafNodes.flatMap((leaf) => leaf.kind === "TRANSFER_REFERENCE" ? [leaf.id] : []),
  );
  const otherRows = [
    { label: "Logic gate", count: gates.length, example: gates[0] ?? "" },
    { label: "Transfer gate", count: transfers.length, example: transfers[0] ?? "" },
    { label: "Common cause group", count: sy.commonCauseFailureGroups.length, example: sy.commonCauseFailureGroups[0]?.uuid ?? "" },
    { label: "Human failure event", count: sy.humanFailureEventIntegrations.length, example: sy.humanFailureEventIntegrations[0]?.uuid ?? "" },
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Plant-fidelity confirmation" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>{isOp ? "SY-A5" : "SY-A6"}</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addConfirm}><SYIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">{isOp ? "Confirm the model through staff discussions and, at CC-II, plant investigations and walkdowns." : "Confirm the model matches the design intent, with walkdowns deferred to the as-built plant."} Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>System</th><th>Method</th><th>Finding</th><th>Date</th></tr></thead>
          <tbody>
            {(sy.systemConfirmationRecords ?? []).map((c) => {
              return (
                <tr key={c.uuid} onClick={() => openDrawer({ kind: "confirm", id: c.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{c.systemReference !== undefined ? shortOf(c.systemReference) : "—"}</td>
                  <td><span className="syd-method syd-method--review">{CONFIRM_METHODS[c.method] ?? c.method}</span></td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{c.findings}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{c.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Nomenclature" level={3} />
          <SYProvenanceChip>SY-A30</SYProvenanceChip>
        </div>
        <p className="poscard__sub">One designator per component failure mode across every system, counted live from the logic models.</p>
        <table className="postable">
          <thead><tr><th>Identifier</th><th>In the model</th><th>Example</th></tr></thead>
          <tbody>
            {modeRows.map((r) => (
              <tr key={r.mode}>
                <td style={{ fontWeight: 600 }}>{r.label}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.count}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.example}</td>
              </tr>
            ))}
            {otherRows.map((r) => (
              <tr key={r.label}>
                <td style={{ fontWeight: 600 }}>{r.label}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.count}</td>
                <td className="posmono" style={{ fontSize: 11 }}>{r.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UncertScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  function addOc(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      overCapacityConsiderations: [...(draft.overCapacityConsiderations ?? []), {
        uuid, system: draft.systemDefinitions[0]?.uuid ?? "", potentialExceedanceScenarios: [], treatment: "CONSERVATIVE" as const, justificationForCapability: "", implementsSrs: [{ sr: "SY-A29", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "oc", id: uuid });
  }
  function addUnc(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateSy((draft) => {
      const list = draft.uncertaintyAnalyses ?? [];
      const entry = { uncertaintyId: id, description: "", impact: "", isQuantified: false, treatmentApproach: "" };
      if (list.length === 0) {
        return { ...draft, uncertaintyAnalyses: [{ uuid: crypto.randomUUID(), system: draft.systemDefinitions[0]?.uuid ?? "", propagationMethod: "LATIN_HYPERCUBE" as const, modelUncertainties: [entry], parameterUncertainties: [], implementsSrs: [{ sr: "SY-B16", hlr: "B" as const }] }] };
      }
      return { ...draft, uncertaintyAnalyses: list.map((u, i) => (i === 0 ? { ...u, modelUncertainties: [...u.modelUncertainties, entry] } : u)) };
    });
    openDrawer({ kind: "unc", id });
  }
  function addAssum(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      preOperationalAssumptions: [...(draft.preOperationalAssumptions ?? []), {
        uuid, assumptionId: uuid, description: "", influenceOnDefinition: "", status: "OPEN" as const, limitations: [], riskImpact: ImportanceLevel.MEDIUM, closureBasis: "", plannedClosureActions: [], affectedElementIds: [],
      }],
    }));
    openDrawer({ kind: "assum", id: uuid });
  }
  function addSens(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      sensitivityStudies: [...(draft.sensitivityStudies ?? []), { uuid, name: "", description: "", variedParameters: [], parameterRanges: {} }],
    }));
    openDrawer({ kind: "sens", id: uuid });
  }
  const register = [
    ...(sy.uncertaintyAnalyses ?? []).flatMap((u) => u.modelUncertainties.map((m) => ({ id: m.uncertaintyId, kind: "unc" as const, type: "Uncertainty", tone: "progress" as BadgeKind | undefined, item: m.description, detail: m.impact, ok: m.isQuantified, status: m.isQuantified ? "Quantified" : "Open" }))),
    ...(sy.preOperationalAssumptions ?? []).map((a) => ({ id: a.uuid, kind: "assum" as const, type: "Pre-op", tone: "warn" as BadgeKind | undefined, item: a.influenceOnDefinition, detail: a.description, ok: a.status === "CLOSED", status: a.status === "CLOSED" ? "Closed" : a.status === "IN_PROGRESS" ? "In progress" : "Open" })),
    ...(sy.sensitivityStudies ?? []).map((st) => ({ id: st.uuid, kind: "sens" as const, type: "Sensitivity", tone: undefined as BadgeKind | undefined, item: (st.name ?? "").length > 0 ? st.name ?? "" : st.description, detail: st.results ?? "", ok: (st.results ?? "").length > 0, status: (st.results ?? "").length > 0 ? "Run" : "Pending" })),
  ];
  const repairRows = sy.systemLogicModels.map((m) => {
    const modelEvents = systemLogicModelBasicEvents(sy, m);
    const credited = modelEvents.filter((b) => b.repairModeled === true);
    const justified = credited.every((b) => (b.repairJustification ?? "").length > 0);
    return { id: m.uuid, system: m.systemReference, events: modelEvents.length, credited: credited.length, ok: credited.length === 0 || justified };
  });
  const totalEvents = repairRows.reduce((acc, r) => acc + r.events, 0);
  const totalCredited = repairRows.reduce((acc, r) => acc + r.credited, 0);
  const allOk = repairRows.every((r) => r.ok);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Capability representation" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A29</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addOc}><SYIcon.Plus /> Add consideration</button>}
          </div>
        </div>
        <p className="poscard__sub">Conservative when a rated capability might be exceeded, realistic only with supporting analysis or data. Click a row to edit it.</p>
        <div className="syoc">
          {(sy.overCapacityConsiderations ?? []).map((o) => {
            const def = sy.systemDefinitions.find((x) => x.uuid === o.system);
            const realistic = o.treatment === "REALISTIC_JUSTIFIED";
            return (
              <div key={o.uuid} className="syoc__row" onClick={() => openDrawer({ kind: "oc", id: o.uuid })} style={{ cursor: "pointer" }}>
                <div>
                  <div className="syoc__sys">{def?.name ?? o.system}</div>
                  <div className="syoc__scn">{o.potentialExceedanceScenarios[0] ?? ""}</div>
                  <div className="syoc__basis">{o.justificationForCapability ?? ""}</div>
                </div>
                <span className={`syd-method syd-method--${realistic ? "realistic" : "conservative"}`}>
                  {realistic ? "Realistic (CC-II)" : "Conservative (CC-I)"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Repair credit" level={3} />
          <SYProvenanceChip>SY-A31</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Repair of hardware faults is not credited unless data or analysis supports it. {totalCredited === 0 ? `No repair is credited for any of the ${totalEvents} basic events.` : `${totalCredited} of ${totalEvents} basic events credit repair.`}</p>
        <span className="sylight">
          <span className={`sylight__dot sylight__dot--${allOk ? "s" : "f"}`} />
          <span>{totalCredited === 0 ? "No repair credited anywhere in the model" : allOk ? "All repair credit carries a justification" : "Repair credited without a justification"}</span>
        </span>
        {totalCredited > 0 && (
          <table className="postable">
            <thead><tr><th>System</th><th>Basic events</th><th>Repair credited</th><th>Status</th></tr></thead>
            <tbody>
              {repairRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{shortOf(r.system)}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{r.events}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{r.credited}</td>
                  <td><span className="sylight"><span className={`sylight__dot sylight__dot--${r.ok ? "s" : "f"}`} /> {r.ok ? "Consistent" : "Unjustified credit"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Open items register" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A32 · A33 · B16</SYProvenanceChip>
            {editable && (
              <>
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUnc}><SYIcon.Plus /> Add uncertainty</button>
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssum}><SYIcon.Plus /> Add assumption</button>
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSens}><SYIcon.Plus /> Add study</button>
              </>
            )}
          </div>
        </div>
        <p className="poscard__sub">Model uncertainties, pre-operational assumptions and sensitivity studies, each carried to closure. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Type</th><th>Item</th><th>Detail</th><th>Status</th></tr></thead>
          <tbody>
            {register.map((r) => (
              <tr key={r.id} onClick={() => openDrawer({ kind: r.kind, id: r.id })} style={{ cursor: "pointer" }}>
                <td><Badge kind={r.tone}>{r.type}</Badge></td>
                <td style={{ fontWeight: 600 }}>{r.item}</td>
                <td className="possubtle" style={{ fontSize: 12 }}>{r.detail}</td>
                <td><span className="sylight"><span className={`sylight__dot sylight__dot--${r.ok ? "s" : "f"}`} /> {r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { sy } = useSyWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(sy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sy.name} — SY Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{sy.name}</h1>
        <h2>Systems Analysis Methodology</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {SY_METHODOLOGY_TOC.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="SY" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>
        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="SY" title="Hand-off to internal review" level={3} className="posgen__readout-h" />
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>. Producing the draft locks Steps 1 to 7 and advances the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <SYIcon.Send /> Submit draft to internal review
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateSyReport(sy, "methodology", "", ready); }}><SYIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><SYIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerContent({ context, onClose }: { context: SyDrawerContext; onClose: () => void }): JSX.Element | null {
  const {
    sy,
    editable,
    mutateSy,
    shortOf,
    controlledParameters,
    controlledHumanFailures,
  } = useSyWorkbook();

  if (context.kind === "exclusion") {
    const def = sy.systemDefinitions.find((x) => x.uuid === context.id);
    if (def === undefined) return null;
    const patch = (fields: Partial<typeof def>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        systemDefinitions: draft.systemDefinitions.map((x) => (x.uuid === def.uuid ? { ...x, ...fields } : x)),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Exclusions and diversion paths · SY-A17, A18</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Left out, with why it does not defeat the criterion</label>
              {editable
                ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={(def.justificationForExclusionOfComponents ?? []).join(" ")} onChange={(e) => patch({ justificationForExclusionOfComponents: e.target.value.length === 0 ? undefined : [e.target.value] })} />
                : <div>{(def.justificationForExclusionOfComponents ?? []).join(" ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Diversion path modeled</label>
              {editable
                ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={def.flowDiversionConsiderations?.[0] ?? ""} onChange={(e) => patch({ flowDiversionConsiderations: e.target.value.length === 0 ? undefined : [e.target.value] })} />
                : <div>{def.flowDiversionConsiderations?.[0] ?? "—"}</div>}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "unavail") {
    const u = (sy.simultaneousUnavailabilityEvents ?? []).find((x) => x.uuid === context.id);
    if (u === undefined) return null;
    const patch = (fields: Partial<typeof u>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        simultaneousUnavailabilityEvents: (draft.simultaneousUnavailabilityEvents ?? []).map((x) => (x.uuid === u.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        simultaneousUnavailabilityEvents: (draft.simultaneousUnavailabilityEvents ?? []).filter((x) => x.uuid !== u.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Simultaneous unavailability · SY-A27</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Planned activity</label>
              {editable ? <WorkbookInput className="posfield__input" value={u.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{u.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Components (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={u.componentIds.join(", ")} onChange={(e) => patch({ componentIds: e.target.value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) })} /> : <div>{u.componentIds.join(", ")}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">DA parameter</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={u.dataAnalysisRef ?? ""} onChange={(e) => patch({ dataAnalysisRef: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{u.dataAnalysisRef ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Basis</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={u.plannedActivityBasis} onChange={(e) => patch({ plannedActivityBasis: e.target.value })} /> : <div>{u.plannedActivityBasis}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove record</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "screening") {
    const c = (sy.componentScreeningJustifications ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        componentScreeningJustifications: (draft.componentScreeningJustifications ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        componentScreeningJustifications: (draft.componentScreeningJustifications ?? []).filter((x) => x.uuid !== c.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Screening justification · SY-A20</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Component</label>
              {editable ? <WorkbookInput className="posfield__input" value={c.componentId} onChange={(e) => patch({ componentId: e.target.value })} /> : <div>{c.componentId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={c.systemReference} onChange={(e) => patch({ systemReference: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{shortOf(c.systemReference)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Screening criterion</label>
              {editable ? (
                <select className="posfield__select" value={c.screeningCriterion} onChange={(e) => patch({ screeningCriterion: e.target.value === "b" ? "b" : "a" })}>
                  {SCREENING_CRITERIA.map((sc) => <option key={sc.code} value={sc.code}>Criterion {sc.code}: {sc.label}</option>)}
                </select>
              ) : <div>Criterion {c.screeningCriterion}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Quantitative justification</label>
              {editable
                ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={c.quantitativeJustification} onChange={(e) => patch({ quantitativeJustification: e.target.value })} />
                : <div>{c.quantitativeJustification}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove component</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "system") {
    const sysDef = sy.systemDefinitions.find((s) => s.uuid === context.id);
    if (sysDef === undefined) return null;
    const logic = sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
    const sfRefs = sy.systemToSafetyFunctionMappings.find((m) => m.systemReference === sysDef.uuid)?.safetyFunctions ?? [];
    return (
      <>
        <div className="posdrawer__head">
          <div>
            <div className="posdrawer__cap">System · {shortOf(sysDef.uuid)}</div>
            <WorkbookSectionHeading workbook="SY" title={sysDef.name} cueKey="System model" description="Defines the credited safety functions, success criterion, model representation, and logic boundary for the selected system." level={2} className="posdrawer__title" />
            <p className="posdrawer__sub">{sfRefs.length > 0 ? `${sfRefs.join(", ")} · ` : ""}{logic?.modelRepresentation ?? "System-level"}</p>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="sytop" style={{ margin: 0 }}>
            <span className="sytop__icon"><SYIcon.Target /></span>
            <div>
              <div className="sytop__cap">Top event</div>
              <div className="sytop__text">{sysDef.description ?? sysDef.name}</div>
              {sysDef.successCriterion !== undefined && <div className="sytop__crit">{sysDef.successCriterion}</div>}
            </div>
          </div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Mission time</label><div className="posmono">{sysDef.missionTimeHours !== undefined ? `${sysDef.missionTimeHours} h` : "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Modeled components</label><div className="posmono">{Object.keys(sysDef.modeledComponentsAndFailures).length}</div></div>
            <div className="posfield"><label className="posfield__label">Basic events</label><div className="posmono">{logic === undefined ? 0 : systemLogicModelBasicEvents(sy, logic).length}</div></div>
          </div>
          <div>
            <WorkbookCueLabel workbook="SY" title="Model boundary" className="essec" />
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>{sysDef.boundaries.map((b, i) => <span key={i} className="poschip">{b}</span>)}</div>
          </div>
        </div>
      </>
    );
  }

  if (context.kind === "ccf") {
    const g = sy.commonCauseFailureGroups.find((x) => x.uuid === context.id);
    if (g === undefined) return null;
    const patch = (fields: Partial<typeof g>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        commonCauseFailureGroups: draft.commonCauseFailureGroups.map((x) => (x.uuid === g.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        commonCauseFailureGroups: draft.commonCauseFailureGroups.filter((x) => x.uuid !== g.uuid),
      }));
    };
    const owner = g.affectedSystems[0] ?? "";
    const couples = g.affectedSystems.slice(1);
    const shared = g.sharedCauseFactors ?? {};
    const otherList = Array.isArray(shared.otherFactors) ? shared.otherFactors : [];
    const beta = g.modelSpecificParameters?.betaFactorParameters;
    const alpha = g.modelSpecificParameters?.alphaFactorParameters;
    const qt = beta?.totalFailureProbability ?? alpha?.totalFailureProbability ?? 0;
    const par = ccfParams(g);
    const check = ccfModelCheck(g, sy);
    const num = (v: string): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const setModelType = (v: string): void => {
      if (v === "ALPHA_FACTOR") {
        patch({ modelType: v, modelSpecificParameters: { alphaFactorParameters: { alphaFactors: alpha?.alphaFactors ?? { alpha1: 0.95, alpha2: 0.035, alpha3: 0.015 }, totalFailureProbability: qt } } });
      } else {
        patch({ modelType: "BETA_FACTOR", modelSpecificParameters: { betaFactorParameters: { beta: beta?.beta ?? 0.05, totalFailureProbability: qt } } });
      }
    };
    const setQt = (v: number): void => {
      if (alpha !== undefined) {
        patch({ modelSpecificParameters: { alphaFactorParameters: { ...alpha, totalFailureProbability: v } } });
      } else {
        patch({ modelSpecificParameters: { betaFactorParameters: { beta: beta?.beta ?? 0, totalFailureProbability: v } } });
      }
    };
    const toggleShared = (key: "hardwareDesign" | "manufacturer" | "maintenance" | "installation" | "environment"): void => {
      patch({ sharedCauseFactors: { ...shared, [key]: shared[key] === true ? undefined : true } });
    };
    const toggleCouple = (id: string): void => {
      const next = couples.includes(id) ? couples.filter((c) => c !== id) : [...couples, id];
      patch({ affectedSystems: [owner, ...next] });
    };
    const csv = (values: string[]): string => values.join(", ");
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Common cause group · SY-B1 to B4</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" value={g.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{g.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={owner} onChange={(e) => patch({ affectedSystems: [e.target.value, ...couples.filter((c) => c !== e.target.value)] })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === owner)?.name ?? owner}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Scope</label>
              {editable ? (
                <select className="posfield__select" value={g.scope} onChange={(e) => patch({ scope: e.target.value === "INTERSYSTEM" ? "INTERSYSTEM" : "INTRASYSTEM" })}>
                  <option value="INTRASYSTEM">Within one system</option>
                  <option value="INTERSYSTEM">Across systems</option>
                </select>
              ) : <div>{g.scope === "INTRASYSTEM" ? "Within one system" : "Across systems"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Model</label>
              {editable ? (
                <select className="posfield__select" value={alpha !== undefined ? "ALPHA_FACTOR" : "BETA_FACTOR"} onChange={(e) => setModelType(e.target.value)}>
                  <option value="BETA_FACTOR">Beta factor</option>
                  <option value="ALPHA_FACTOR">Alpha factor</option>
                </select>
              ) : <div>{CCF_MODELS[g.modelType]?.label ?? g.modelType}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Total failure probability</label>
              {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={qt} onChange={(e) => setQt(num(e.target.value))} /> : <div className="posmono">{qt}</div>}
            </div>
            {alpha === undefined ? (
              <div className="posfield"><label className="posfield__label">Beta</label>
                {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={beta?.beta ?? 0} onChange={(e) => patch({ modelSpecificParameters: { betaFactorParameters: { beta: num(e.target.value), totalFailureProbability: qt } } })} /> : <div className="posmono">{beta?.beta ?? 0}</div>}
              </div>
            ) : (
              Object.keys(alpha.alphaFactors).sort().map((k) => (
                <div key={k} className="posfield"><label className="posfield__label">Alpha {k.startsWith("alpha") ? k.slice(5) : k}</label>
                  {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={alpha.alphaFactors[k] ?? 0} onChange={(e) => patch({ modelSpecificParameters: { alphaFactorParameters: { alphaFactors: { ...alpha.alphaFactors, [k]: num(e.target.value) }, totalFailureProbability: qt } } })} /> : <div className="posmono">{alpha.alphaFactors[k] ?? 0}</div>}
                </div>
              ))
            )}
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Components (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={csv(g.affectedComponents)} onChange={(e) => patch({ affectedComponents: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(g.affectedComponents)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Model events (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={csv((g.members?.basicEvents ?? []).map((b) => b.id))} onChange={(e) => patch({ members: { basicEvents: parseCsv(e.target.value).map((id) => ({ id })) } })} /> : <div className="posmono">{csv((g.members?.basicEvents ?? []).map((b) => b.id))}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Shared causes</label>
              <div className="sycause">
                {(["hardwareDesign", "manufacturer", "maintenance", "installation", "environment"] as const).map((k) => (
                  <label key={k} className="sycause__opt">
                    <WorkbookInput type="checkbox" checked={shared[k] === true} disabled={!editable} onChange={() => toggleShared(k)} />
                    {SHARED_CAUSE_LABELS[k] ?? k}
                  </label>
                ))}
              </div>
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Other shared causes (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={csv(otherList)} onChange={(e) => patch({ sharedCauseFactors: { ...shared, otherFactors: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined } })} /> : <div>{otherList.length > 0 ? csv(otherList) : "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Couples</label>
              <div className="sycause">
                {sy.systemDefinitions.filter((d) => d.uuid !== owner).map((d) => (
                  <label key={d.uuid} className="sycause__opt">
                    <WorkbookInput type="checkbox" checked={couples.includes(d.uuid)} disabled={!editable} onChange={() => toggleCouple(d.uuid)} />
                    {shortOf(d.uuid)}
                  </label>
                ))}
              </div>
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Grouping basis (SY-B3)</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={g.description} onChange={(e) => patch({ description: e.target.value, groupSelectionBasis: e.target.value })} /> : <div>{g.description}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Defenses (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={csv(g.defenseMechanisms ?? [])} onChange={(e) => patch({ defenseMechanisms: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{csv(g.defenseMechanisms ?? [])}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">DA parameter</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={g.dataAnalysisCCFParameterRef ?? ""} onChange={(e) => patch({ dataAnalysisCCFParameterRef: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div className="posmono">{g.dataAnalysisCCFParameterRef ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Parameter source</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={g.dataSources?.[0]?.reference ?? ""} onChange={(e) => patch({ dataSources: e.target.value.length === 0 ? undefined : [{ reference: e.target.value, description: g.dataSources?.[0]?.description ?? "Generic common cause parameters.", dataType: g.dataSources?.[0]?.dataType ?? "generic" }] })} /> : <div className="posmono">{g.dataSources?.[0]?.reference ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Risk significance</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={g.riskSignificanceJustification ?? ""} onChange={(e) => patch({ riskSignificanceJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{g.riskSignificanceJustification ?? "—"}</div>}
            </div>
          </div>
          {par !== null && (
            <span className="sylight">
              <span className={`sylight__dot sylight__dot--${check.ok ? "s" : "f"}`} />
              <span>Group probability {toExp(par.expected)}{check.eventId === null ? " · no common cause event found in the model" : ` · ${check.eventId} in the model at ${check.eventProb === null ? "—" : toExp(check.eventProb)}`}</span>
            </span>
          )}
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove group</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "ssc") {
    const n = (sy.supportSystemSuccessCriteria ?? []).find((x) => x.uuid === context.id);
    if (n === undefined) return null;
    const patch = (fields: Partial<typeof n>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        supportSystemSuccessCriteria: (draft.supportSystemSuccessCriteria ?? []).map((x) => (x.uuid === n.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        supportSystemSuccessCriteria: (draft.supportSystemSuccessCriteria ?? []).filter((x) => x.uuid !== n.uuid),
      }));
    };
    const toggleSupported = (id: string): void => {
      patch({ supportedSystems: n.supportedSystems.includes(id) ? n.supportedSystems.filter((x) => x !== id) : [...n.supportedSystems, id] });
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Support success criteria · SY-B7, B9</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={n.systemReference} onChange={(e) => patch({ systemReference: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === n.systemReference)?.name ?? n.systemReference}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Criteria type</label>
              {editable ? (
                <select className="posfield__select" value={n.criteriaType} onChange={(e) => patch({ criteriaType: e.target.value === "REALISTIC" ? "REALISTIC" : "CONSERVATIVE" })}>
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="REALISTIC">Realistic</option>
                </select>
              ) : <div>{n.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Success criterion</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={n.successCriteria} onChange={(e) => patch({ successCriteria: e.target.value })} /> : <div>{n.successCriteria}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Supports</label>
              <div className="sycause">
                {sy.systemDefinitions.filter((d) => d.uuid !== n.systemReference).map((d) => (
                  <label key={d.uuid} className="sycause__opt">
                    <WorkbookInput type="checkbox" checked={n.supportedSystems.includes(d.uuid)} disabled={!editable} onChange={() => toggleSupported(d.uuid)} />
                    {shortOf(d.uuid)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove criterion</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "spc") {
    const c = (sy.environmentalDesignBasisConsiderations ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        environmentalDesignBasisConsiderations: (draft.environmentalDesignBasisConsiderations ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        environmentalDesignBasisConsiderations: (draft.environmentalDesignBasisConsiderations ?? []).filter((x) => x.uuid !== c.uuid),
      }));
    };
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Spatial and environmental coupling · SY-B8, B14</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={c.systemReference} onChange={(e) => patch({ systemReference: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === c.systemReference)?.name ?? c.systemReference}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">In the model</label>
              {editable ? (
                <select className="posfield__select" value={c.dependentFailuresIncluded === true ? "yes" : "no"} onChange={(e) => patch({ dependentFailuresIncluded: e.target.value === "yes" })}>
                  <option value="yes">Dependent failure included</option>
                  <option value="no">Not included yet</option>
                </select>
              ) : <div>{c.dependentFailuresIncluded === true ? "Dependent failure included" : "Not included yet"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Components (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={c.components.join(", ")} onChange={(e) => patch({ components: parseCsv(e.target.value) })} /> : <div className="posmono">{c.components.join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Event sequences (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={c.eventSequences.join(", ")} onChange={(e) => patch({ eventSequences: parseCsv(e.target.value) })} /> : <div className="posmono">{c.eventSequences.join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Shared space and conditions</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={c.environmentalConditions} onChange={(e) => patch({ environmentalConditions: e.target.value })} /> : <div>{c.environmentalConditions}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove coupling</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "inv") {
    const d = (sy.depletionModels ?? []).find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    const mission = sy.systemDefinitions.find((x) => x.uuid === d.associatedSystem)?.missionTimeHours ?? 24;
    const patch = (fields: Partial<typeof d>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        depletionModels: (draft.depletionModels ?? []).map((x) => (x.uuid === d.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        depletionModels: (draft.depletionModels ?? []).filter((x) => x.uuid !== d.uuid),
      }));
    };
    const num = (v: string): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const rateFor = (cap: number): number => (cap > 0 && mission > 0 ? Number((cap / mission).toFixed(3)) : 0);
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Depletable inventory · SY-B12</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Resource</label>
              {editable ? <WorkbookInput className="posfield__input" value={d.description ?? ""} onChange={(e) => patch({ description: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{d.description ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Type</label>
              {editable ? (
                <select className="posfield__select" value={d.resourceType} onChange={(e) => { const v = e.target.value; patch({ resourceType: v === "fuel" || v === "coolant" || v === "battery" || v === "air" ? v : "other" }); }}>
                  <option value="fuel">Fuel</option>
                  <option value="coolant">Coolant</option>
                  <option value="battery">Battery</option>
                  <option value="air">Air</option>
                  <option value="other">Other</option>
                </select>
              ) : <div>{d.resourceType}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={d.associatedSystem ?? ""} onChange={(e) => { const m = sy.systemDefinitions.find((x) => x.uuid === e.target.value)?.missionTimeHours ?? 24; patch({ associatedSystem: e.target.value, consumptionRate: d.initialQuantity > 0 && m > 0 ? Number((d.initialQuantity / m).toFixed(3)) : 0 }); }}>
                  {sy.systemDefinitions.map((x) => <option key={x.uuid} value={x.uuid}>{shortOf(x.uuid)}: {x.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((x) => x.uuid === d.associatedSystem)?.name ?? d.associatedSystem ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Capacity ({d.units})</label>
              {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={d.initialQuantity} onChange={(e) => patch({ initialQuantity: num(e.target.value), consumptionRate: rateFor(num(e.target.value)) })} /> : <div className="posmono">{d.initialQuantity}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Supports the mission time</label>
              {editable ? (
                <select className="posfield__select" value={d.missionTimeSupported === true ? "yes" : "no"} onChange={(e) => patch({ missionTimeSupported: e.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : <div>{d.missionTimeSupported === true ? "Yes" : "No"}</div>}
            </div>
          </div>
          <span className="sylight">
            <span className={`sylight__dot sylight__dot--${d.missionTimeSupported === true ? "s" : "f"}`} />
            <span>Checked against the {mission} h mission of the associated system.</span>
          </span>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove inventory</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "dic") {
    const d = (sy.digitalInstrumentationAndControl ?? []).find((x) => x.uuid === context.id);
    if (d === undefined) return null;
    const patch = (fields: Partial<typeof d>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        digitalInstrumentationAndControl: (draft.digitalInstrumentationAndControl ?? []).map((x) => (x.uuid === d.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        digitalInstrumentationAndControl: (draft.digitalInstrumentationAndControl ?? []).filter((x) => x.uuid !== d.uuid),
      }));
    };
    const parseCsv = (v: string): string[] => v.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Digital I&C and software · SY-B11</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" value={d.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{d.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={d.systemReference} onChange={(e) => patch({ systemReference: e.target.value })}>
                  {sy.systemDefinitions.map((x) => <option key={x.uuid} value={x.uuid}>{shortOf(x.uuid)}: {x.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((x) => x.uuid === d.systemReference)?.name ?? d.systemReference}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Description</label>
              {editable ? <WorkbookInput className="posfield__input" value={d.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{d.description}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Method</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={d.methodology} onChange={(e) => patch({ methodology: e.target.value })} /> : <div>{d.methodology}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Failure modes (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={(d.failureModes ?? []).join(", ")} onChange={(e) => patch({ failureModes: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{(d.failureModes ?? []).join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Special considerations (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={(d.specialConsiderations ?? []).join(", ")} onChange={(e) => patch({ specialConsiderations: parseCsv(e.target.value).length > 0 ? parseCsv(e.target.value) : undefined })} /> : <div>{(d.specialConsiderations ?? []).join(", ")}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove record</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "loop") {
    const loopId = context.id;
    const parts = loopId.split("+");
    const a = parts[0] ?? "";
    const b = parts[1] ?? "";
    const fwd = sy.systemDependencies.find((x) => x.dependentSystem === a && x.supportingSystem === b);
    const rev = sy.systemDependencies.find((x) => x.dependentSystem === b && x.supportingSystem === a);
    const res = sy.systemLogicModels.flatMap((m) => m.logicLoopResolutions ?? []).find((r) => r.loopId === loopId);
    const resolution = res?.resolution ?? "";
    const setResolution = (v: string): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        systemLogicModels: draft.systemLogicModels.map((m) => {
          const cleaned = (m.logicLoopResolutions ?? []).filter((r) => r.loopId !== loopId);
          if (m.systemReference === a && v.length > 0) return { ...m, logicLoopResolutions: [...cleaned, { loopId, resolution: v }] };
          return { ...m, logicLoopResolutions: cleaned.length === 0 ? undefined : cleaned };
        }),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Logic loop · SY-B10</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">{shortOf(a)} needs {shortOf(b)}</label><div>{fwd?.details ?? "—"}</div></div>
            <div className="posfield"><label className="posfield__label">{shortOf(b)} needs {shortOf(a)}</label><div>{rev?.details ?? "—"}</div></div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Resolution</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={resolution} onChange={(e) => setResolution(e.target.value)} /> : <div>{resolution.length > 0 ? resolution : "—"}</div>}
            </div>
          </div>
          <span className="sylight">
            <span className={`sylight__dot sylight__dot--${resolution.length > 0 ? "s" : "f"}`} />
            <span>{resolution.length > 0 ? "The loop is broken and the assumption is recorded." : "Record how the loop is broken in the model."}</span>
          </span>
        </div>
      </>
    );
  }

  if (context.kind === "confirm") {
    const c = (sy.systemConfirmationRecords ?? []).find((x) => x.uuid === context.id);
    if (c === undefined) return null;
    const patch = (fields: Partial<typeof c>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        systemConfirmationRecords: (draft.systemConfirmationRecords ?? []).map((x) => (x.uuid === c.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        systemConfirmationRecords: (draft.systemConfirmationRecords ?? []).filter((x) => x.uuid !== c.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Plant-fidelity confirmation · SY-A5, A6</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={c.systemReference ?? ""} onChange={(e) => patch({ systemReference: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === c.systemReference)?.name ?? c.systemReference ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Method</label>
              {editable ? (
                <select className="posfield__select" value={c.method} onChange={(e) => { const v = e.target.value; patch({ method: v === "DISCUSSIONS" || v === "PLANT_INVESTIGATION" || v === "WALKDOWN" ? v : "DESIGN_REVIEW" }); }}>
                  {Object.entries(CONFIRM_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : <div>{CONFIRM_METHODS[c.method] ?? c.method}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Date</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={c.date} onChange={(e) => patch({ date: e.target.value })} /> : <div className="posmono">{c.date}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Personnel (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={c.personnelRoles.join(", ")} onChange={(e) => patch({ personnelRoles: e.target.value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) })} /> : <div>{c.personnelRoles.join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Findings</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={c.findings} onChange={(e) => patch({ findings: e.target.value })} /> : <div>{c.findings}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove record</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "oc") {
    const o = (sy.overCapacityConsiderations ?? []).find((x) => x.uuid === context.id);
    if (o === undefined) return null;
    const patch = (fields: Partial<typeof o>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        overCapacityConsiderations: (draft.overCapacityConsiderations ?? []).map((x) => (x.uuid === o.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        overCapacityConsiderations: (draft.overCapacityConsiderations ?? []).filter((x) => x.uuid !== o.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Capability representation · SY-A29</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={o.system} onChange={(e) => patch({ system: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === o.system)?.name ?? o.system}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Treatment</label>
              {editable ? (
                <select className="posfield__select" value={o.treatment} onChange={(e) => patch({ treatment: e.target.value === "REALISTIC_JUSTIFIED" ? "REALISTIC_JUSTIFIED" : "CONSERVATIVE" })}>
                  <option value="CONSERVATIVE">Conservative (CC-I)</option>
                  <option value="REALISTIC_JUSTIFIED">Realistic (CC-II)</option>
                </select>
              ) : <div>{o.treatment === "REALISTIC_JUSTIFIED" ? "Realistic (CC-II)" : "Conservative (CC-I)"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Exceedance scenario</label>
              {editable ? <WorkbookInput className="posfield__input" value={o.potentialExceedanceScenarios[0] ?? ""} onChange={(e) => patch({ potentialExceedanceScenarios: e.target.value.length === 0 ? [] : [e.target.value] })} /> : <div>{o.potentialExceedanceScenarios[0] ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Justification</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} value={o.justificationForCapability ?? ""} onChange={(e) => patch({ justificationForCapability: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{o.justificationForCapability ?? "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove consideration</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "unc") {
    const m = (sy.uncertaintyAnalyses ?? []).flatMap((u) => u.modelUncertainties).find((x) => x.uncertaintyId === context.id);
    if (m === undefined) return null;
    const patch = (fields: Partial<typeof m>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        uncertaintyAnalyses: (draft.uncertaintyAnalyses ?? []).map((u) => ({ ...u, modelUncertainties: u.modelUncertainties.map((x) => (x.uncertaintyId === m.uncertaintyId ? { ...x, ...fields } : x)) })),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        uncertaintyAnalyses: (draft.uncertaintyAnalyses ?? []).map((u) => ({ ...u, modelUncertainties: u.modelUncertainties.filter((x) => x.uncertaintyId !== m.uncertaintyId) })),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Model uncertainty · SY-B16</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Uncertainty</label>
              {editable ? <WorkbookInput className="posfield__input" value={m.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{m.description}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Impact</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={m.impact} onChange={(e) => patch({ impact: e.target.value })} /> : <div>{m.impact}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Quantified</label>
              {editable ? (
                <select className="posfield__select" value={m.isQuantified ? "yes" : "no"} onChange={(e) => patch({ isQuantified: e.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : <div>{m.isQuantified ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Treatment</label>
              {editable ? <WorkbookInput className="posfield__input" value={m.treatmentApproach} onChange={(e) => patch({ treatmentApproach: e.target.value })} /> : <div>{m.treatmentApproach}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove uncertainty</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "assum") {
    const a = (sy.preOperationalAssumptions ?? []).find((x) => x.uuid === context.id);
    if (a === undefined) return null;
    const patch = (fields: Partial<typeof a>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).map((x) => (x.uuid === a.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        preOperationalAssumptions: (draft.preOperationalAssumptions ?? []).filter((x) => x.uuid !== a.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Pre-operational assumption · SY-A33</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Area</label>
              {editable ? <WorkbookInput className="posfield__input" value={a.influenceOnDefinition} onChange={(e) => patch({ influenceOnDefinition: e.target.value })} /> : <div>{a.influenceOnDefinition}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Assumption</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{a.description}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Risk impact</label>
              {editable ? (
                <select className="posfield__select" value={a.riskImpact} onChange={(e) => patch({ riskImpact: e.target.value === "HIGH" ? ImportanceLevel.HIGH : e.target.value === "LOW" ? ImportanceLevel.LOW : ImportanceLevel.MEDIUM })}>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              ) : <div>{a.riskImpact}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Status</label>
              {editable ? (
                <select className="posfield__select" value={a.status} onChange={(e) => { const v = e.target.value; patch({ status: v === "CLOSED" || v === "IN_PROGRESS" ? v : "OPEN" }); }}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="CLOSED">Closed</option>
                </select>
              ) : <div>{a.status === "CLOSED" ? "Closed" : a.status === "IN_PROGRESS" ? "In progress" : "Open"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Closure basis</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={a.closureBasis} onChange={(e) => patch({ closureBasis: e.target.value })} /> : <div>{a.closureBasis}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove assumption</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "sens") {
    const st = (sy.sensitivityStudies ?? []).find((x) => x.uuid === context.id);
    if (st === undefined) return null;
    const patch = (fields: Partial<typeof st>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        sensitivityStudies: (draft.sensitivityStudies ?? []).map((x) => (x.uuid === st.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        sensitivityStudies: (draft.sensitivityStudies ?? []).filter((x) => x.uuid !== st.uuid),
      }));
    };
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Sensitivity study · SY-A32</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" value={st.name ?? ""} onChange={(e) => patch({ name: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{st.name ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">What is swept</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={st.description} onChange={(e) => patch({ description: e.target.value })} /> : <div>{st.description}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Varied parameters (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input" value={st.variedParameters.join(", ")} onChange={(e) => patch({ variedParameters: e.target.value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) })} /> : <div>{st.variedParameters.join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Results</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={st.results ?? ""} onChange={(e) => patch({ results: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{st.results ?? "—"}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove study</button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (context.kind === "be") {
    const be: SystemBasicEvent | undefined = sy.systemBasicEvents.find((event) => event.uuid === context.id);
    if (be === undefined) return null;
    const ownerRef = sy.systemLogicModels.find((model) => systemFaultTreeBasicEventIds(model).includes(be.uuid))?.systemReference;
    const beId = be.uuid;
    const patch = (beFields: Partial<SystemBasicEvent>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        systemBasicEvents: draft.systemBasicEvents.map((event) => (event.uuid === beId ? { ...event, ...beFields } : event)),
      }));
    };
    const num = (v: string): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const prob = be.probability ?? 0;
    const rateBasis = be.quantificationBasis?.kind === "FAILURE_RATE" ? be.quantificationBasis : undefined;
    const compatibleParameters = controlledParameters.filter((option) =>
      rateBasis === undefined ? option.parameterType !== "FREQUENCY" : option.parameterType === "FREQUENCY",
    );
    const selectedParameterKey = be.controlledDataSource?.referenceType !== "WORKBOOK_PARAMETER"
      ? ""
      : JSON.stringify([be.controlledDataSource.workbookId, be.controlledDataSource.entityId]);
    const selectedParameter = compatibleParameters.find((option) =>
      JSON.stringify([option.workbookId, option.parameterId]) === selectedParameterKey,
    );
    const selectedHumanFailureKey = be.controlledDataSource?.referenceType !== "HUMAN_FAILURE_EVENT"
      ? ""
      : JSON.stringify([
          be.controlledDataSource.workbookId,
          be.controlledDataSource.entityId,
          be.controlledDataSource.quantificationId,
        ]);
    const selectedHumanFailure = controlledHumanFailures.find((option) =>
      JSON.stringify([
        option.workbookId,
        option.humanFailureEventId,
        option.quantificationId,
      ]) === selectedHumanFailureKey,
    );
    const resolvedRateBasis = rateBasis === undefined || selectedParameter === undefined
      ? rateBasis
      : { ...rateBasis, failureRate: { ...rateBasis.failureRate, value: selectedParameter.value } };
    const displayedProbability = resolvedRateBasis === undefined
      ? (selectedParameter?.value ?? selectedHumanFailure?.value ?? prob)
      : failureRateToProbability(resolvedRateBasis);
    const isHumanError = be.failureMode === "HUMAN_ERROR";
    const repairOk = be.repairModeled !== true || (be.repairJustification ?? "").length > 0;
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Basic event · {ownerRef === undefined ? "Workbook catalogue" : shortOf(ownerRef)}</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
            <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" value={be.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{be.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Identifier</label><div className="posmono">{be.uuid}</div></div>
            <div className="posfield"><label className="posfield__label">Failure mode</label>
              {editable ? (
                <select
                  className="posfield__select"
                  value={be.failureMode ?? ""}
                  onChange={(e) => patch({
                    failureMode: e.target.value,
                    controlledDataSource: undefined,
                    dataAnalysisBasicEventRef: undefined,
                  })}
                >
                  {Object.entries(FAILURE_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : <div>{FAILURE_MODE_LABELS[be.failureMode ?? ""] ?? be.failureMode ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">{rateBasis === undefined ? "Probability" : "Mission probability"}{be.controlledDataSource === undefined ? "" : " (controlled)"}</label>
              {editable && be.controlledDataSource === undefined && rateBasis === undefined ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" value={prob} onChange={(e) => patch({ probability: num(e.target.value), quantificationBasis: { kind: "PROBABILITY" } })} /> : <div className="posmono">{toExp(displayedProbability)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">{isHumanError ? "Human Reliability event and HEP" : "Data Analysis parameter"}</label>
              {editable && isHumanError ? (
                <select
                  aria-label="Human Reliability event and HEP"
                  className="posfield__select"
                  value={selectedHumanFailureKey}
                  onChange={(event) => {
                    const option = controlledHumanFailures.find((candidate) =>
                      JSON.stringify([
                        candidate.workbookId,
                        candidate.humanFailureEventId,
                        candidate.quantificationId,
                      ]) === event.target.value,
                    );
                    if (option === undefined) {
                      patch({ controlledDataSource: undefined });
                      return;
                    }
                    patch({
                      probability: option.value,
                      quantificationBasis: { kind: "PROBABILITY" },
                      controlledDataSource: {
                        referenceType: "HUMAN_FAILURE_EVENT",
                        workbookId: option.workbookId,
                        entityId: option.humanFailureEventId,
                        quantificationId: option.quantificationId,
                      },
                      dataAnalysisBasicEventRef: undefined,
                    });
                  }}
                >
                  <option value="">Select an HRA event and HEP</option>
                  {selectedHumanFailure === undefined && selectedHumanFailureKey.length > 0 && (
                    <option value={selectedHumanFailureKey}>Unavailable linked HRA quantification</option>
                  )}
                  {controlledHumanFailures.map((option) => {
                    const key = JSON.stringify([
                      option.workbookId,
                      option.humanFailureEventId,
                      option.quantificationId,
                    ]);
                    return <option key={key} value={key}>{option.workbookName} · {option.humanFailureEventName} · {option.methodology} · {toExp(option.value)}</option>;
                  })}
                </select>
              ) : editable ? (
                <select
                  aria-label="Data Analysis parameter"
                  className="posfield__select"
                  value={selectedParameterKey}
                  onChange={(event) => {
                    const option = compatibleParameters.find((candidate) =>
                      JSON.stringify([candidate.workbookId, candidate.parameterId]) === event.target.value,
                    );
                    if (option === undefined) {
                      patch({ controlledDataSource: undefined, dataAnalysisBasicEventRef: undefined });
                      return;
                    }
                    const nextBasis = rateBasis === undefined
                      ? { kind: "PROBABILITY" as const }
                      : { ...rateBasis, failureRate: { ...rateBasis.failureRate, value: option.value } };
                    patch({
                      probability: nextBasis.kind === "FAILURE_RATE" ? failureRateToProbability(nextBasis) : option.value,
                      quantificationBasis: nextBasis,
                      controlledDataSource: {
                        referenceType: "WORKBOOK_PARAMETER",
                        workbookId: option.workbookId,
                        entityId: option.parameterId,
                      },
                      dataAnalysisBasicEventRef: undefined,
                    });
                  }}
                >
                  <option value="">{rateBasis === undefined ? "Manual probability" : "Manual failure rate"}</option>
                  {selectedParameter === undefined && selectedParameterKey.length > 0 && (
                    <option value={selectedParameterKey}>Unavailable linked parameter</option>
                  )}
                  {compatibleParameters.map((option) => {
                    const key = JSON.stringify([option.workbookId, option.parameterId]);
                    return <option key={key} value={key}>{option.workbookName} · {option.parameterName} · {toExp(option.value)}</option>;
                  })}
                </select>
              ) : isHumanError ? (
                <div>{selectedHumanFailure === undefined
                  ? be.controlledDataSource === undefined ? "No HRA quantification selected" : "Unavailable linked HRA quantification"
                  : `${selectedHumanFailure.workbookName} · ${selectedHumanFailure.humanFailureEventName} · ${selectedHumanFailure.methodology}`}</div>
              ) : (
                <div>{selectedParameter === undefined
                  ? be.controlledDataSource === undefined ? "Manual probability" : "Unavailable linked parameter"
                  : `${selectedParameter.workbookName} · ${selectedParameter.parameterName}`}</div>
              )}
            </div>
            <div className="posfield"><label className="posfield__label">Repair credited</label>
              {editable ? (
                <select className="posfield__select" value={be.repairModeled === true ? "yes" : "no"} onChange={(e) => patch({ repairModeled: e.target.value === "yes" })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              ) : <div>{be.repairModeled === true ? "Yes" : "No"}</div>}
            </div>
            {be.repairModeled === true && (
              <>
                <div className="posfield"><label className="posfield__label">Mean time to repair (h)</label>
                  {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={be.meanTimeToRepair ?? 0} onChange={(e) => patch({ meanTimeToRepair: num(e.target.value) })} /> : <div className="posmono">{be.meanTimeToRepair ?? "—"}</div>}
                </div>
                <div className="posfield posfield-grid--span2"><label className="posfield__label">Repair justification (SY-A31)</label>
                  {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={be.repairJustification ?? ""} onChange={(e) => patch({ repairJustification: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{be.repairJustification ?? "—"}</div>}
                </div>
              </>
            )}
          </div>
          <span className="sylight">
            <span className={`sylight__dot sylight__dot--${repairOk ? "s" : "f"}`} />
            <span>{be.repairModeled !== true ? "No repair credited, the fault is carried as a standing failure." : repairOk ? "Repair credit carries a justification." : "Repair credited without a justification (SY-A31)."}</span>
          </span>
        </div>
      </>
    );
  }

  if (context.kind === "hfe") {
    const h = sy.humanFailureEventIntegrations.find((x) => x.uuid === context.id);
    if (h === undefined) return null;
    const patch = (fields: Partial<typeof h>): void => {
      if (!editable) return;
      mutateSy((draft) => ({
        ...draft,
        humanFailureEventIntegrations: draft.humanFailureEventIntegrations.map((x) => (x.uuid === h.uuid ? { ...x, ...fields } : x)),
      }));
    };
    const remove = (): void => {
      if (!editable) return;
      onClose();
      mutateSy((draft) => ({
        ...draft,
        humanFailureEventIntegrations: draft.humanFailureEventIntegrations.filter((x) => x.uuid !== h.uuid),
      }));
    };
    const selectedHumanFailureKey = h.hfeSource === undefined
      ? ""
      : JSON.stringify([
          h.hfeSource.workbookId,
          h.hfeSource.entityId,
          h.hfeSource.quantificationId,
        ]);
    const selectedHumanFailure = controlledHumanFailures.find((option) =>
      JSON.stringify([
        option.workbookId,
        option.humanFailureEventId,
        option.quantificationId,
      ]) === selectedHumanFailureKey,
    );
    return (
      <>
        <div className="posdrawer__head posdrawer__head--bare">
          <div>
            <div className="posdrawer__cap">Human failure event · SY-A21, A23</div>
          </div>
          <button type="button" className="posdrawer__close" onClick={onClose}><SYIcon.Close /></button>
        </div>
        <div className="posdrawer__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Task</label>
              {editable ? <WorkbookTextarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} value={h.taskDescription} onChange={(e) => patch({ taskDescription: e.target.value })} /> : <div>{h.taskDescription}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={h.system} onChange={(e) => patch({ system: e.target.value })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === h.system)?.name ?? h.system}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Type</label>
              {editable ? (
                <select className="posfield__select" value={h.hfeType} onChange={(e) => patch({ hfeType: e.target.value === "POST_INITIATOR" ? "POST_INITIATOR" : "PRE_INITIATOR" })}>
                  <option value="PRE_INITIATOR">Pre-initiator</option>
                  <option value="POST_INITIATOR">Post-initiator</option>
                </select>
              ) : <div>{h.hfeType === "PRE_INITIATOR" ? "Pre-initiator" : "Post-initiator"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Test & maintenance</label>
              {editable ? (
                <select className="posfield__select" value={h.isTestMaintenance ? "yes" : "no"} onChange={(e) => patch({ isTestMaintenance: e.target.value === "yes" })}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : <div>{h.isTestMaintenance ? "Yes" : "No"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Human Reliability event and HEP</label>
              {editable ? (
                <select
                  aria-label="Integrated Human Reliability event and HEP"
                  className="posfield__select"
                  value={selectedHumanFailureKey}
                  onChange={(event) => {
                    const option = controlledHumanFailures.find((candidate) =>
                      JSON.stringify([
                        candidate.workbookId,
                        candidate.humanFailureEventId,
                        candidate.quantificationId,
                      ]) === event.target.value,
                    );
                    if (option === undefined) {
                      patch({ hfeReference: "", hfeSource: undefined });
                      return;
                    }
                    patch({
                      hfeReference: option.humanFailureEventId,
                      hfeSource: {
                        referenceType: "HUMAN_FAILURE_EVENT",
                        workbookId: option.workbookId,
                        entityId: option.humanFailureEventId,
                        quantificationId: option.quantificationId,
                      },
                      hfeType: option.hfeTiming === "PRE_INITIATOR" ? "PRE_INITIATOR" : "POST_INITIATOR",
                      ...(h.taskDescription.length === 0
                        ? { taskDescription: option.humanFailureEventName }
                        : {}),
                    });
                  }}
                >
                  <option value="">Select an HRA event and HEP</option>
                  {selectedHumanFailure === undefined && selectedHumanFailureKey.length > 0 && (
                    <option value={selectedHumanFailureKey}>Unavailable linked HRA quantification</option>
                  )}
                  {controlledHumanFailures.map((option) => {
                    const key = JSON.stringify([
                      option.workbookId,
                      option.humanFailureEventId,
                      option.quantificationId,
                    ]);
                    return <option key={key} value={key}>{option.workbookName} · {option.humanFailureEventName} · {option.methodology} · {toExp(option.value)}</option>;
                  })}
                </select>
              ) : <div>{selectedHumanFailure === undefined ? h.hfeReference || "—" : `${selectedHumanFailure.humanFailureEventName} · ${selectedHumanFailure.methodology} · ${toExp(selectedHumanFailure.value)}`}</div>}
            </div>
          </div>
          {editable && (
            <div className="posrow" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}><SYIcon.Close /> Remove event</button>
            </div>
          )}
        </div>
      </>
    );
  }

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><div className="syempty"><div className="syempty__title">{label}</div><p className="syempty__hint">This step is not part of the current workbook view.</p></div></div>;
}

export { DepsScreen, IntegrityScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };

import { stringifyJson } from "interfaces-shared-types/json";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useState } from "react";
import { SYIcon } from "./syIcons";
import { DialogHead, NotRecorded, ReviewLines, ReviewTitle, SYProvenanceChip } from "./syShared";
import { SystemDialogContent, isSystemDialogKind } from "./SySystemDialogs";
import { EventDialogContent, isEventDialogKind } from "./SyEventDialogs";
import { SyDiagramDialog } from "./SyDiagramDialog";
import {
  SCREENING_CRITERIA,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  toExp,
  CONFIRM_METHODS,
  RESOURCE_TYPE_LABELS,
  FAILURE_MODE_LABELS,
  SY_METHODOLOGY_TOC,
  DEP_KIND,
  type CapabilityCategory,
} from "./syViewData";
import { isSystemLevelModel, type CcScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { SyUncertaintyParameters } from "./SyUncertaintyParameters";
import { SyUncertaintyAnalysis } from "./SyUncertaintyAnalysis";
import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { generateSyReport } from "./syDocx";
import { type SyDrawerContext } from "./syScreens";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import {
  SUPPORTED_CCF_MODELS,
  ccfParameterSummary,
  defaultCcfParameters,
  orderedFactors,
  totalFailureProbability,
  validateCcfGroup,
  type SupportedCcfModel,
} from "./syCcf";

function DepsScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const supportCriteria = sy.supportSystemSuccessCriteria ?? [];
  const couplings = sy.environmentalDesignBasisConsiderations ?? [];
  const inventories = sy.depletionModels ?? [];
  const digitalRecords = sy.digitalInstrumentationAndControl ?? [];
  const systemName = (id: string): string => sy.systemDefinitions.find((system) => system.uuid === id)?.name ?? id;
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
          <WorkbookSectionHeading title="Support dependency matrix" level={3} />
          <SYProvenanceChip>SY-B5 · SY-B6 · SY-B10</SYProvenanceChip>
        </div>
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
        {loops.length > 0 && (
          <div className="sy-review sy-review--offset">
            <section className="sy-review-section" aria-label="Logic loops">
              <ReviewTitle title="Logic loops" />
              <table className="sy-review-table" aria-label="Logic loops">
                <thead><tr><th scope="col">Systems</th><th scope="col">Dependencies</th><th scope="col">Resolution</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
                <tbody>
                  {loops.map((l) => (
                    <tr key={l.id}>
                      <td><span className="sy-review-name">{`${short(l.a)} and ${short(l.b)}`}</span></td>
                      <td><ReviewLines items={[`${short(l.a)} needs ${short(l.b)} for ${l.ab}`, `${short(l.b)} needs ${short(l.a)} for ${l.ba}`]} /></td>
                      <td>{l.resolution ?? <span className="sy-error">Resolution required</span>}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} loop ${short(l.a)} and ${short(l.b)}`} onClick={() => openDrawer({ kind: "loop", id: l.id })}>{actionLabel}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Support success criteria" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B7 · SY-B9 · SY-B13</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSsc}>Add criterion</button>}
          </div>
        </div>
        <div className="sy-review">
          {supportCriteria.length === 0 ? <p className="sy-review-empty">No support success criteria recorded.</p> : (
            <table className="sy-review-table" aria-label="Support success criteria">
              <thead><tr><th scope="col">Support system</th><th scope="col">Success criterion</th><th scope="col">Supports</th><th scope="col">Basis</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {supportCriteria.map((n) => (
                  <tr key={n.uuid}>
                    <td><span className="sy-review-name">{systemName(n.systemReference)}</span></td>
                    <td>{n.successCriteria.length > 0 ? n.successCriteria : <NotRecorded />}</td>
                    <td>{n.supportedSystems.length === 0 ? <NotRecorded /> : n.supportedSystems.map((x) => short(x)).join(", ")}</td>
                    <td>{n.criteriaType === "REALISTIC" ? "Realistic" : "Conservative"}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} criterion for ${systemName(n.systemReference)}`} onClick={() => openDrawer({ kind: "ssc", id: n.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Spatial and environmental couplings" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B8 · SY-B14</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSpc}>Add coupling</button>}
          </div>
        </div>
        <div className="sy-review">
          {couplings.length === 0 ? <p className="sy-review-empty">No couplings recorded.</p> : (
            <table className="sy-review-table" aria-label="Spatial and environmental couplings">
              <thead><tr><th scope="col">System</th><th scope="col">Components</th><th scope="col">Conditions</th><th scope="col">Event sequences</th><th scope="col">Dependent failures</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {couplings.map((c) => (
                  <tr key={c.uuid}>
                    <td><span className="sy-review-name">{short(c.systemReference)}</span></td>
                    <td>{c.components.length === 0 ? <NotRecorded /> : c.components.join(", ")}</td>
                    <td>{c.environmentalConditions.length > 0 ? c.environmentalConditions : <NotRecorded />}</td>
                    <td>{c.eventSequences.length === 0 ? <NotRecorded /> : <span className="posmono">{c.eventSequences.join(", ")}</span>}</td>
                    <td>{c.dependentFailuresIncluded === true ? "In the model" : "Not in the model"}</td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} coupling for ${short(c.systemReference)}`} onClick={() => openDrawer({ kind: "spc", id: c.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Depletable inventories" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B12</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addInv}>Add inventory</button>}
          </div>
        </div>
        <div className="sy-review">
          {inventories.length === 0 ? <p className="sy-review-empty">No depletable inventories recorded.</p> : (
            <table className="sy-review-table" aria-label="Depletable inventories">
              <thead><tr><th scope="col">Inventory</th><th scope="col">System</th><th scope="col">Capacity</th><th scope="col">Mission time</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {inventories.map((d) => {
                  const mission = d.associatedSystem === undefined ? undefined : sy.systemDefinitions.find((system) => system.uuid === d.associatedSystem)?.missionTimeHours;
                  const unit = d.units === "hours" ? "h" : d.units;
                  const described = d.description !== undefined && d.description.length > 0;
                  const label = described ? d.description : RESOURCE_TYPE_LABELS[d.resourceType];
                  return (
                    <tr key={d.uuid}>
                      <td>
                        <span className="sy-review-name">{label}</span>
                        {described && <span className="sy-review-sub">{RESOURCE_TYPE_LABELS[d.resourceType]}</span>}
                      </td>
                      <td>{d.associatedSystem === undefined ? <NotRecorded /> : short(d.associatedSystem)}</td>
                      <td>
                        <span className="posmono sy-review-num">{d.initialQuantity <= 0 ? "Passive" : `${d.initialQuantity} ${unit}`}</span>
                        {mission !== undefined && <span className="sy-review-sub">{`Mission ${mission} h`}</span>}
                      </td>
                      <td>{d.missionTimeSupported === true ? "Supported" : "Falls short"}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${label}`} onClick={() => openDrawer({ kind: "inv", id: d.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading title="Digital I&C and software" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B11</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDic}>Add record</button>}
          </div>
        </div>
        <div className="sy-review">
          {digitalRecords.length === 0 ? <p className="sy-review-empty">No digital I&C records.</p> : (
            <table className="sy-review-table" aria-label="Digital I&C and software">
              <thead><tr><th scope="col">Record</th><th scope="col">System</th><th scope="col">Failure modes</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {digitalRecords.map((d) => (
                  <tr key={d.uuid}>
                    <td>
                      {d.name.length > 0 ? <span className="sy-review-name">{d.name}</span> : <NotRecorded />}
                      {d.methodology.length > 0 && <span className="sy-review-sub">{d.methodology}</span>}
                    </td>
                    <td>{systemName(d.systemReference)}</td>
                    <td><ReviewLines items={d.failureModes ?? []} /></td>
                    <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${d.name.length > 0 ? d.name : "digital record"}`} onClick={() => openDrawer({ kind: "dic", id: d.uuid })}>{actionLabel}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function IntegrityScreen({ stage, openDrawer }: { stage: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const records = sy.systemConfirmationRecords ?? [];
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
    return { mode, label: FAILURE_MODE_LABELS[mode] ?? mode, count: of.length, example: of[0]?.code ?? "" };
  });
  const gates = sy.systemLogicModels.flatMap((model) => model.gates.map(({ code }) => code));
  const transfers = sy.systemLogicModels.flatMap((model) =>
    model.leafNodes.flatMap((leaf) => leaf.kind === "TRANSFER_REFERENCE" ? [leaf.code] : []),
  );
  const otherRows = [
    { label: "Logic gate", count: gates.length, example: gates[0] ?? "" },
    { label: "Transfer gate", count: transfers.length, example: transfers[0] ?? "" },
    { label: "Common cause group", count: sy.commonCauseFailureGroups.length, example: sy.commonCauseFailureGroups[0]?.uuid ?? "" },
    { label: "HR event", count: sy.humanFailureEventIntegrations.length, example: sy.humanFailureEventIntegrations[0]?.hfeReference ?? "" },
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Plant-fidelity confirmation" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>{isOp ? "SY-A5" : "SY-A6"}</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addConfirm}>Add record</button>}
          </div>
        </div>
        <div className="sy-review">
          {records.length === 0 ? <p className="sy-review-empty">No confirmation records yet.</p> : (
            <table className="sy-review-table" aria-label="Plant-fidelity confirmation">
              <thead><tr><th scope="col">System</th><th scope="col">Method</th><th scope="col">Finding</th><th scope="col">Date</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
              <tbody>
                {records.map((c) => {
                  const system = c.systemReference === undefined ? undefined : shortOf(c.systemReference);
                  const method = CONFIRM_METHODS[c.method] ?? c.method;
                  return (
                    <tr key={c.uuid}>
                      <td>{system === undefined ? <NotRecorded /> : <span className="sy-review-name">{system}</span>}</td>
                      <td>
                        <span>{method}</span>
                        {c.personnelRoles.length > 0 && <span className="sy-review-sub">{c.personnelRoles.join(", ")}</span>}
                      </td>
                      <td>{c.findings.length > 0 ? c.findings : <NotRecorded />}</td>
                      <td className="posmono sy-review-num">{c.date.length > 0 ? c.date : <NotRecorded />}</td>
                      <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${method} record${system === undefined ? "" : ` for ${system}`}`} onClick={() => openDrawer({ kind: "confirm", id: c.uuid })}>{actionLabel}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Nomenclature" level={3} />
          <SYProvenanceChip>SY-A30</SYProvenanceChip>
        </div>
        <div className="sy-review">
          <table className="sy-review-table" aria-label="Nomenclature">
            <thead><tr><th scope="col">Identifier</th><th scope="col">In the model</th><th scope="col">Example</th></tr></thead>
            <tbody>
              {modeRows.map((r) => (
                <tr key={r.mode}>
                  <td><span className="sy-review-name">{r.label}</span></td>
                  <td>{r.count}</td>
                  <td><span className="posmono">{r.example}</span></td>
                </tr>
              ))}
              {otherRows.map((r) => (
                <tr key={r.label}>
                  <td><span className="sy-review-name">{r.label}</span></td>
                  <td>{r.count}</td>
                  <td>{r.example.length > 0 ? <span className="posmono">{r.example}</span> : <span className="sy-review-none">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UncertScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf, runtime } = useSyWorkbook();
  const actionLabel = editable ? "Edit" : "View";
  const models = sy.systemLogicModels.filter((model) => model.topGate !== null && !isSystemLevelModel(model));
  const [modelId, setModelId] = useState(models[0]?.uuid ?? "");
  const model = models.find((candidate) => candidate.uuid === modelId) ?? models[0];
  const assumptions = (sy.uncertaintyAnalyses ?? [])
    .filter((analysis) => analysis.system === model?.systemReference)
    .flatMap((analysis) => analysis.modelUncertainties);
  function addAssumption(): void {
    if (!editable || model === undefined) return;
    const uncertaintyId = crypto.randomUUID();
    mutateSy((draft) => {
      const analyses = [...(draft.uncertaintyAnalyses ?? [])];
      const index = analyses.findIndex((analysis) => analysis.system === model.systemReference);
      const entry = { uncertaintyId, description: "", impact: "", isQuantified: false, treatmentApproach: "" };
      if (index < 0) analyses.push({
        uuid: crypto.randomUUID(), system: model.systemReference, propagationMethod: "MONTE_CARLO",
        modelUncertainties: [entry], parameterUncertainties: [], implementsSrs: [{ sr: "SY-B16", hlr: "B" }],
      });
      else analyses[index] = { ...analyses[index]!, modelUncertainties: [...analyses[index]!.modelUncertainties, entry] };
      return { ...draft, uncertaintyAnalyses: analyses };
    });
    openDrawer({ kind: "unc", id: uncertaintyId });
  }
  return <>
    <section className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Fault tree scope" level={3} /><SYProvenanceChip>SY-A32</SYProvenanceChip></div>
      {models.length === 0 ? <p className="possubtle">Create a detailed fault tree in Step 02 first.</p> :
        <label className="posfield" style={{ maxWidth: 520 }}><span className="posfield__label">Fault tree</span>
          <select className="posfield__select" aria-label="Step 07 fault tree" value={model?.uuid ?? ""} onChange={(event) => setModelId(event.target.value)}>
            {models.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{shortOf(candidate.systemReference)} · {candidate.code} · {candidate.name}</option>)}
          </select>
        </label>}
    </section>
    <SyUncertaintyParameters selectedModelId={model?.uuid} />
    <section className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Model assumptions" level={3} />
        <div className="posrow" style={{ gap: 8, alignItems: "center" }}><SYProvenanceChip>SY-A32 · B16</SYProvenanceChip>
          {editable && model !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addAssumption}>Add assumption</button>}
        </div>
      </div>
      <div className="sy-review">
        {assumptions.length === 0 ? <p className="sy-review-empty">No model assumption recorded for {model === undefined ? "this fault tree" : shortOf(model.systemReference)}.</p> : (
          <table className="sy-review-table" aria-label="Model assumptions">
            <thead><tr><th scope="col">Assumption</th><th scope="col">Impact</th><th scope="col">Treatment</th><th scope="col" className="sy-review-edit" aria-label="Actions" /></tr></thead>
            <tbody>
              {assumptions.map((item, index) => (
                <tr key={item.uncertaintyId}>
                  <td>{item.description.length > 0 ? item.description : <NotRecorded />}</td>
                  <td>{item.impact.length > 0 ? item.impact : <NotRecorded />}</td>
                  <td>
                    {item.treatmentApproach.length > 0 ? <span>{item.treatmentApproach}</span> : <NotRecorded />}
                    <span className="sy-review-sub">{item.isQuantified ? "Quantified" : "Not quantified"}</span>
                  </td>
                  <td className="sy-review-edit"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} assumption ${index + 1}`} onClick={() => openDrawer({ kind: "unc", id: item.uncertaintyId })}>{actionLabel}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
    <div className="poscard"><SyUncertaintyAnalysis selectedModelId={model?.uuid} /></div>
    <AnalysisRunHistory host="sy" workbookId={runtime.workbookId} calculationType="UNCERTAINTY" />
  </>;
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { sy, runtime } = useSyWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([stringifyJson(sy, 2)!], { type: "application/json" });
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
            <button type="button" className="posnav__btn" onClick={() => { void generateSyReport(sy, "methodology", "", ready, runtime.workbookId, runtime.revision); }}><SYIcon.Download /> Download draft (.docx)</button>
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
    controlledHumanFailures,
  } = useSyWorkbook();
  if (isSystemDialogKind(context.kind)) return <SystemDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;
  if (isEventDialogKind(context.kind)) return <EventDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;
  if (context.kind === "diagram") return <SyDiagramDialog systemId={context.id} diagramId={context.diagramId} onClose={onClose} />;

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
        <DialogHead cap="Exclusions and diversion paths · SY-A17, A18" title={def.name} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Simultaneous unavailability · SY-A27" title={u.description.length > 0 ? u.description : "New unavailability record"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Screening justification · SY-A20" title={c.componentId.length > 0 ? c.componentId : "New screening record"} onClose={onClose} />
        <div className="modal__body">
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
    const mgl = g.modelSpecificParameters?.mglParameters;
    const alpha = g.modelSpecificParameters?.alphaFactorParameters;
    const phi = g.modelSpecificParameters?.phiFactorParameters;
    const qt = totalFailureProbability(g) ?? 0;
    const par = ccfParameterSummary(g);
    const issues = validateCcfGroup(g, sy);
    const memberIds = g.members?.basicEvents.map(({ id }) => id) ?? [];
    const affectedSystemIds = new Set(g.affectedSystems);
    const eligibleEventIds = new Set(sy.systemLogicModels
      .filter((model) => affectedSystemIds.has(model.systemReference))
      .flatMap((model) => systemLogicModelBasicEvents(sy, model).map(({ uuid }) => uuid)));
    const memberOptions = sy.systemBasicEvents.filter((event) =>
      event.failureMode !== "COMMON_CAUSE_FAILURE" && (eligibleEventIds.has(event.uuid) || memberIds.includes(event.uuid)),
    );
    const num = (v: string): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const setModelType = (v: string): void => {
      const modelType = SUPPORTED_CCF_MODELS.includes(v as SupportedCcfModel) ? v as SupportedCcfModel : "BETA_FACTOR";
      patch({ modelType, modelSpecificParameters: defaultCcfParameters(modelType, memberIds.length, qt) });
    };
    const setQt = (v: number): void => {
      if (g.modelType === "MGL") patch({ modelSpecificParameters: { mglParameters: { beta: mgl?.beta ?? 0.05, ...(mgl?.gamma === undefined ? {} : { gamma: mgl.gamma }), ...(mgl?.delta === undefined ? {} : { delta: mgl.delta }), ...(mgl?.additionalFactors === undefined ? {} : { additionalFactors: mgl.additionalFactors }), totalFailureProbability: v } } });
      else if (g.modelType === "ALPHA_FACTOR") patch({ modelSpecificParameters: { alphaFactorParameters: { alphaFactors: alpha?.alphaFactors ?? {}, totalFailureProbability: v } } });
      else if (g.modelType === "PHI_FACTOR") patch({ modelSpecificParameters: { phiFactorParameters: { phiFactors: phi?.phiFactors ?? {}, totalFailureProbability: v } } });
      else patch({ modelSpecificParameters: { betaFactorParameters: { beta: beta?.beta ?? 0.05, totalFailureProbability: v } } });
    };
    const resizeOrderedFactors = (prefix: "alpha" | "phi", current: Record<string, number>, count: number): Record<string, number> => {
      const values = Array.from({ length: Math.max(0, count) }, (_, index) => current[`${prefix}${index + 1}`] ?? 0);
      const sum = values.reduce((total, value) => total + value, 0);
      const normalized = sum > 0 ? values.map((value) => value / sum) : values.map((_, index) => index === 0 ? 1 : 0);
      return Object.fromEntries(normalized.map((value, index) => [`${prefix}${index + 1}`, value]));
    };
    const setMembers = (ids: string[]): void => {
      const unique = [...new Set(ids)];
      if (g.modelType === "ALPHA_FACTOR") {
        patch({ members: { basicEvents: unique.map((id) => ({ id })) }, modelSpecificParameters: { alphaFactorParameters: { alphaFactors: resizeOrderedFactors("alpha", alpha?.alphaFactors ?? {}, unique.length), totalFailureProbability: qt } } });
      } else if (g.modelType === "PHI_FACTOR") {
        patch({ members: { basicEvents: unique.map((id) => ({ id })) }, modelSpecificParameters: { phiFactorParameters: { phiFactors: resizeOrderedFactors("phi", phi?.phiFactors ?? {}, unique.length), totalFailureProbability: qt } } });
      } else if (g.modelType === "MGL" && unique.length > 1) {
        const allowed = unique.length - 1;
        const factors = [mgl?.beta ?? 0.05, mgl?.gamma, mgl?.delta, ...orderedFactors(mgl?.additionalFactors ?? {}).map(([, value]) => value)]
          .filter((value): value is number => value !== undefined).slice(0, allowed);
        patch({
          members: { basicEvents: unique.map((id) => ({ id })) },
          modelSpecificParameters: { mglParameters: {
            beta: factors[0] ?? 0.05,
            ...(factors[1] === undefined ? {} : { gamma: factors[1] }),
            ...(factors[2] === undefined ? {} : { delta: factors[2] }),
            ...(factors.length <= 3 ? {} : { additionalFactors: Object.fromEntries(factors.slice(3).map((value, index) => [`factor${index + 4}`, value])) }),
            totalFailureProbability: qt,
          } },
        });
      } else patch({ members: { basicEvents: unique.map((id) => ({ id })) } });
    };
    const toggleMember = (id: string): void => setMembers(memberIds.includes(id) ? memberIds.filter((memberId) => memberId !== id) : [...memberIds, id]);
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
        <DialogHead cap="Common cause group · SY-B1 to B4" title={g.name.length > 0 ? g.name : "New common cause group"} onClose={onClose} />
        <div className="modal__body">
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Name</label>
              {editable ? <WorkbookInput className="posfield__input" value={g.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{g.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">System</label>
              {editable ? (
                <select className="posfield__select" value={owner} onChange={(e) => patch({ affectedSystems: [e.target.value, ...(g.scope === "INTERSYSTEM" ? couples.filter((c) => c !== e.target.value) : [])] })}>
                  {sy.systemDefinitions.map((d) => <option key={d.uuid} value={d.uuid}>{shortOf(d.uuid)}: {d.name}</option>)}
                </select>
              ) : <div>{sy.systemDefinitions.find((d) => d.uuid === owner)?.name ?? owner}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Scope</label>
              {editable ? (
                <select className="posfield__select" value={g.scope} onChange={(e) => {
                  const scope = e.target.value === "INTERSYSTEM" ? "INTERSYSTEM" : "INTRASYSTEM";
                  patch({ scope, affectedSystems: scope === "INTRASYSTEM" ? [owner] : [owner, ...couples] });
                }}>
                  <option value="INTRASYSTEM">Within one system</option>
                  <option value="INTERSYSTEM">Across systems</option>
                </select>
              ) : <div>{g.scope === "INTRASYSTEM" ? "Within one system" : "Across systems"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Model</label>
              {editable ? (
                <select className="posfield__select" value={g.modelType} onChange={(e) => setModelType(e.target.value)}>
                  {SUPPORTED_CCF_MODELS.map((modelType) => <option key={modelType} value={modelType}>{CCF_MODELS[modelType]?.label ?? modelType}</option>)}
                </select>
              ) : <div>{CCF_MODELS[g.modelType]?.label ?? g.modelType}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Total failure probability</label>
              {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={qt} onChange={(e) => setQt(num(e.target.value))} /> : <div className="posmono">{qt}</div>}
            </div>
            {g.modelType === "BETA_FACTOR" ? (
              <div className="posfield"><label className="posfield__label">Beta</label>
                {editable ? <WorkbookInput className="posfield__input posmono" type="number" step="any" value={beta?.beta ?? 0} onChange={(e) => patch({ modelSpecificParameters: { betaFactorParameters: { beta: num(e.target.value), totalFailureProbability: qt } } })} /> : <div className="posmono">{beta?.beta ?? 0}</div>}
              </div>
            ) : g.modelType === "MGL" ? (
              <>
                {Array.from({ length: Math.max(1, memberIds.length - 1) }, (_, index) => {
                  const current = [mgl?.beta ?? 0.05, mgl?.gamma, mgl?.delta, ...orderedFactors(mgl?.additionalFactors ?? {}).map(([, value]) => value)];
                  const labels = ["Beta", "Gamma", "Delta"];
                  return (
                    <div key={index} className="posfield"><label className="posfield__label">{labels[index] ?? `Factor ${index + 1}`}</label>
                      {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" value={current[index] ?? 0} onChange={(e) => {
                        const next = Array.from({ length: Math.max(1, memberIds.length - 1) }, (_, factorIndex) => factorIndex === index ? num(e.target.value) : (current[factorIndex] ?? 0));
                        patch({ modelSpecificParameters: { mglParameters: {
                          beta: next[0] ?? 0,
                          ...(next[1] === undefined ? {} : { gamma: next[1] }),
                          ...(next[2] === undefined ? {} : { delta: next[2] }),
                          ...(next.length <= 3 ? {} : { additionalFactors: Object.fromEntries(next.slice(3).map((value, factorIndex) => [`factor${factorIndex + 4}`, value])) }),
                          totalFailureProbability: qt,
                        } } });
                      }} /> : <div className="posmono">{current[index] ?? 0}</div>}
                    </div>
                  );
                })}
              </>
            ) : g.modelType === "ALPHA_FACTOR" ? (
              orderedFactors(alpha?.alphaFactors ?? {}).map(([k, value]) => (
                <div key={k} className="posfield"><label className="posfield__label">Alpha {k.startsWith("alpha") ? k.slice(5) : k}</label>
                  {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" value={value} onChange={(e) => patch({ modelSpecificParameters: { alphaFactorParameters: { alphaFactors: { ...(alpha?.alphaFactors ?? {}), [k]: num(e.target.value) }, totalFailureProbability: qt } } })} /> : <div className="posmono">{value}</div>}
                </div>
              ))
            ) : (
              orderedFactors(phi?.phiFactors ?? {}).map(([k, value]) => (
                <div key={k} className="posfield"><label className="posfield__label">Phi {k.startsWith("phi") ? k.slice(3) : k}</label>
                  {editable ? <WorkbookInput className="posfield__input posmono" type="number" min="0" max="1" step="any" value={value} onChange={(e) => patch({ modelSpecificParameters: { phiFactorParameters: { phiFactors: { ...(phi?.phiFactors ?? {}), [k]: num(e.target.value) }, totalFailureProbability: qt } } })} /> : <div className="posmono">{value}</div>}
                </div>
              ))
            )}
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Components (comma separated)</label>
              {editable ? <WorkbookInput className="posfield__input posmono" value={csv(g.affectedComponents)} onChange={(e) => patch({ affectedComponents: parseCsv(e.target.value) })} /> : <div className="posmono">{csv(g.affectedComponents)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Member basic events</label>
              <p className="possubtle" style={{ margin: "0 0 8px" }}>Select the independent component events. PRAXIS generates the dependent combinations.</p>
              <div className="syccf-members">
                {memberOptions.map((event) => (
                  <label key={event.uuid} className="syccf-members__option">
                    <WorkbookInput type="checkbox" checked={memberIds.includes(event.uuid)} disabled={!editable} onChange={() => toggleMember(event.uuid)} />
                    <span><strong>{event.code ?? event.uuid}</strong><small>{event.name}</small></span>
                  </label>
                ))}
                {memberOptions.length === 0 && <span className="possubtle">No eligible basic events are used by the selected system models.</span>}
              </div>
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
            {g.scope === "INTERSYSTEM" && (
              <div className="posfield posfield-grid--span2"><label className="posfield__label">Coupled systems</label>
                <div className="sycause">
                  {sy.systemDefinitions.filter((d) => d.uuid !== owner).map((d) => (
                    <label key={d.uuid} className="sycause__opt">
                      <WorkbookInput type="checkbox" checked={couples.includes(d.uuid)} disabled={!editable} onChange={() => toggleCouple(d.uuid)} />
                      {shortOf(d.uuid)}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
          <div className="syccf-drawer-review" aria-label="Common cause group readiness">
            <div className="syccf-drawer-review__head">
              <span className="sylight"><span className={`sylight__dot sylight__dot--${issues.some(({ severity }) => severity === "ERROR") ? "f" : "s"}`} /> {issues.some(({ severity }) => severity === "ERROR") ? "Needs attention" : "Ready for PRAXIS"}</span>
              {par !== null && <span className="posmono">{par.detail}</span>}
            </div>
            {issues.length > 0 && <ul>{issues.map((issue) => <li key={`${issue.code}:${issue.message}`} className={`syccf-drawer-review__${issue.severity.toLowerCase()}`}>{issue.message}</li>)}</ul>}
          </div>
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
        <DialogHead cap="Support success criteria · SY-B7, B9" title={sy.systemDefinitions.find((d) => d.uuid === n.systemReference)?.name ?? "Support success criterion"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Spatial and environmental coupling · SY-B8, B14" title={sy.systemDefinitions.find((d) => d.uuid === c.systemReference)?.name ?? "Spatial coupling"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Depletable inventory · SY-B12" title={d.description ?? d.resourceType} onClose={onClose} />
        <div className="modal__body">
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
              ) : <div>{RESOURCE_TYPE_LABELS[d.resourceType]}</div>}
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
        <DialogHead cap="Digital I&C and software · SY-B11" title={d.name.length > 0 ? d.name : "New digital I&C record"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Logic loop · SY-B10" title={`${shortOf(a)} and ${shortOf(b)}`} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Plant-fidelity confirmation · SY-A5, A6" title={c.systemReference === undefined ? "Confirmation record" : sy.systemDefinitions.find((d) => d.uuid === c.systemReference)?.name ?? "Confirmation record"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Capacity limit · SY-A29" title={sy.systemDefinitions.find((d) => d.uuid === o.system)?.name ?? "Capacity limit"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Model uncertainty · SY-B16" title={m.description.length > 0 ? m.description : "New model uncertainty"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Pre-operational assumption · SY-A33" title={a.influenceOnDefinition.length > 0 ? a.influenceOnDefinition : "New assumption"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Sensitivity study · SY-A32" title={st.name ?? "New sensitivity study"} onClose={onClose} />
        <div className="modal__body">
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
        <DialogHead cap="Human failure event · SY-A21, A23" title={h.taskDescription.length > 0 ? h.taskDescription : "New human failure event"} onClose={onClose} />
        <div className="modal__body">
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

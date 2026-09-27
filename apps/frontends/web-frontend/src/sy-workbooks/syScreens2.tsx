import { stringifyJson } from "interfaces-shared-types/json";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX, useState } from "react";
import { SYIcon } from "./syIcons";
import { DialogHead, NotRecorded, SYProvenanceChip } from "./syShared";
import { SystemDialogContent, isSystemDialogKind } from "./SySystemDialogs";
import { EventDialogContent, isEventDialogKind } from "./SyEventDialogs";
import { FailureDialogContent, isFailureDialogKind } from "./SyFailureDialogs";
import { SyDiagramDialog } from "./SyDiagramDialog";
import { CommonCauseDialog } from "./SyCommonCauseDialog";
import { DependencyDialogContent, isDependencyDialogKind } from "./SyDependencyDialogs";
import {
  CONFIRM_METHODS,
  FAILURE_MODE_LABELS,
  SY_METHODOLOGY_TOC,
  type CapabilityCategory,
} from "./syViewData";
import { isSystemLevelModel, type CcScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { SyUncertaintyParameters } from "./SyUncertaintyParameters";
import { SyUncertaintyAnalysis } from "./SyUncertaintyAnalysis";
import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { generateSyReport } from "./syDocx";
import { type SyDrawerContext } from "./syScreens";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";

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
  } = useSyWorkbook();
  if (isSystemDialogKind(context.kind)) return <SystemDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;
  if (isEventDialogKind(context.kind)) return <EventDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;
  if (isFailureDialogKind(context.kind)) return <FailureDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;
  if (context.kind === "diagram") return <SyDiagramDialog systemId={context.id} diagramId={context.diagramId} onClose={onClose} />;

  if (context.kind === "ccf") return <CommonCauseDialog id={context.id} onClose={onClose} />;

  if (isDependencyDialogKind(context.kind)) return <DependencyDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;

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

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><div className="syempty"><div className="syempty__title">{label}</div><p className="syempty__hint">This step is not part of the current workbook view.</p></div></div>;
}

export { IntegrityScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen };

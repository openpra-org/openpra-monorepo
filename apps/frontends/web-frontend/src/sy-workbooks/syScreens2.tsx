import { stringifyJson } from "interfaces-shared-types/json";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { SYIcon } from "./syIcons";
import { DialogHead } from "./syShared";
import { SystemDialogContent, isSystemDialogKind } from "./SySystemDialogs";
import { EventDialogContent, isEventDialogKind } from "./SyEventDialogs";
import { FailureDialogContent, isFailureDialogKind } from "./SyFailureDialogs";
import { SyDiagramDialog } from "./SyDiagramDialog";
import { CommonCauseDialog } from "./SyCommonCauseDialog";
import { DependencyDialogContent, isDependencyDialogKind } from "./SyDependencyDialogs";
import { IntegrityDialogContent, isIntegrityDialogKind } from "./SyIntegrityDialogs";
import { UncertaintyDialogContent, isUncertaintyDialogKind } from "./SyUncertaintyDialogs";
import {
  SY_METHODOLOGY_TOC,
  type CapabilityCategory,
} from "./syViewData";
import { type CcScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";
import { generateSyReport } from "./syDocx";
import { type SyDrawerContext } from "./syScreens";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { sy, runtime, links, controlledParameters, controlledComponentBoundaries, controlledCcfVectors, controlledCcfFactors } = useSyWorkbook();
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
            <button type="button" className="posnav__btn" onClick={() => { void generateSyReport(sy, "methodology", "", ready, runtime.workbookId, runtime.revision, { parameters: controlledParameters, boundaries: controlledComponentBoundaries, missionTimes: links, ccf: { vectors: controlledCcfVectors, factors: controlledCcfFactors } }); }}><SYIcon.Download /> Download draft (.docx)</button>
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

  if (isIntegrityDialogKind(context.kind)) return <IntegrityDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;

  if (isUncertaintyDialogKind(context.kind)) return <UncertaintyDialogContent context={{ ...context, kind: context.kind }} onClose={onClose} />;

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

  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return <div className="poscard"><div className="syempty"><div className="syempty__title">{label}</div><p className="syempty__hint">This step is not part of the current workbook view.</p></div></div>;
}

export { DraftScreen, DrawerContent, PlaceholderScreen };

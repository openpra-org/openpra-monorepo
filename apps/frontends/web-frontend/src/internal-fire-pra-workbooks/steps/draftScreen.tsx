import { reviewBlockingInternalFirePraDiagnostics } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";
import { type JSX, useMemo, useState } from "react";
import { WorkbookSectionHeading } from "../../workbooks/workbookSectionHeading";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { internalFireConformanceItems, internalFireConformanceScore } from "../internalFirePraConformance";
import { downloadInternalFirePraJson, generateInternalFirePraReport } from "../internalFirePraDocx";
import { useInternalFirePraWorkbook } from "../internalFirePraWorkbookContext";

export interface InternalFireWorkflowActions { submitForReview?: () => Promise<void>; requestRevision?: () => Promise<void>; submitForApproval?: () => Promise<void>; finalize?: () => Promise<void>; toggleResolve?: (commentId: string, resolved: boolean) => Promise<void> }

const REPORT_TOC = [
  ["Executive summary", 1], ["Analysis scope and application", 3], ["Evidence base and investigations", 6],
  ["Plant boundary and physical analysis units", 10], ["Equipment and instrumentation selection", 18], ["Cable selection, routing, and raceways", 26],
  ["Qualitative screening", 34], ["Plant-response model", 39], ["Fire scenario selection and analysis", 48], ["Ignition frequency", 62],
  ["Circuit failure analysis", 70], ["Fire human reliability analysis", 78], ["Event-sequence quantification and uncertainty", 89],
  ["Risk interpretation and integration", 103], ["Conformance matrix", 112], ["Controlled references and appendices", 124],
] as const;

export function DraftScreen({ actions }: { actions?: InternalFireWorkflowActions }): JSX.Element {
  const { mef, editable, mutate } = useInternalFirePraWorkbook();
  const [busy, setBusy] = useState(false);
  const blockers = useMemo(() => reviewBlockingInternalFirePraDiagnostics(mef), [mef]);
  const score = useMemo(() => internalFireConformanceScore(internalFireConformanceItems(mef)), [mef]);
  const ready = blockers.length === 0;
  const canSubmit = editable && (mef.workflowState === "DRAFT" || mef.workflowState === "REVISION_REQUIRED");
  function submit(): void {
    setBusy(true);
    const operation = actions?.submitForReview?.();
    if (operation !== undefined) operation.finally(() => setBusy(false));
    else {
      mutate((current) => ({ ...current, workflowState: "INTERNAL_TECHNICAL_REVIEW", workflowHistory: [...current.workflowHistory, { state: "INTERNAL_TECHNICAL_REVIEW", enteredAt: new Date().toISOString(), actor: current.owner ?? "Internal Fire PRA Team" }] }));
      setBusy(false);
    }
  }
  return <div className="posgen">
    <div className="posgen__preview" aria-hidden="true">
      <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
      <h1>{mef.name}</h1>
      <h2>Internal Fire Probabilistic Risk Assessment</h2>
      <h3>Table of contents</h3>
      <div className="posgen__preview-toc">{REPORT_TOC.map(([title, page]) => <div key={title} className="posgen__preview-toc-row"><span>{title}</span><span>{page}</span></div>)}</div>
    </div>
    <div className="posgen__side">
      <div className="posgen__readout">
        <WorkbookSectionHeading workbook="FIRE" title="Conformance check" description="Summarize whether the workbook satisfies the applicable Internal Fire supporting requirements for the selected plant stage and capability-category target." className="posgen__readout-h" />
        <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{mef.capabilityCategory}</span></div>
        <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{mef.plantStage === "PRE_OPERATIONAL" ? "Pre-operational" : "Operational"}</span></div>
        <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{score.met} / {score.applicable}</span></div>
        {score.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{score.warn}</span></div>}
        {score.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{score.blocked}</span></div>}
      </div>
      <div className="posgen__readout">
        <WorkbookSectionHeading workbook="FIRE" title={canSubmit ? "Hand-off to internal review" : "Read-only draft preview"} description={canSubmit ? "Generate the report and submit a controlled workbook snapshot for internal technical review. The analysis steps become read only while review is active." : "Inspect the report-ready workbook contents without changing or submitting the controlled analysis."} className="posgen__readout-h" />
        {canSubmit ? <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>{ready ? <>Producing the draft locks Steps 1–15 and advances the workbook to <strong>Internal Technical Review</strong>.</> : <>{blockers.length} blocking item{blockers.length === 1 ? "" : "s"} remain. A working report may be downloaded, but submission stays locked until the blockers are resolved.</>}</p> : <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>Only the preparer or a co-preparer can submit the draft for internal review.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" disabled={!ready || busy} onClick={submit}>{ready ? <POSIcon.Send /> : <POSIcon.Lock />} {busy ? "Submitting…" : "Submit draft to internal review"}</button>}
          <button type="button" className="posnav__btn" onClick={() => { void generateInternalFirePraReport(mef, false); }}><POSIcon.Download /> Download draft (.docx)</button>
          <button type="button" className="posnav__btn" onClick={() => downloadInternalFirePraJson(mef)}><POSIcon.Download /> Download JSON</button>
        </div>
      </div>
    </div>
  </div>;
}

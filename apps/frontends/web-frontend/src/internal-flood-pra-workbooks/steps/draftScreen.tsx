import { reviewBlockingInternalFloodPraDiagnostics, validateInternalFloodPra } from "interfaces-mef-types/internal-flood/internal-flood-pra-validation";
import { type JSX, useMemo, useState } from "react";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { downloadInternalFloodPraJson, generateInternalFloodPraReport } from "../internalFloodPraDocx";
import { countInternalFloodRecords } from "../internalFloodPraRecordCounts";
import { InternalFloodPraStepScreen } from "../internalFloodPraStepScreen";
import { useInternalFloodPraWorkbook } from "../internalFloodPraWorkbookContext";

export interface InternalFloodWorkflowActions { submitForReview?: () => Promise<void>; requestRevision?: () => Promise<void>; submitForApproval?: () => Promise<void>; finalize?: () => Promise<void> }

export function DraftScreen({ actions }: { actions?: InternalFloodWorkflowActions }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [busy, setBusy] = useState(false);
  const diagnostics = useMemo(() => validateInternalFloodPra(mef), [mef]);
  const blockers = useMemo(() => reviewBlockingInternalFloodPraDiagnostics(mef), [mef]);
  const ready = blockers.length === 0;
  const met = mef.conformanceMatrix.filter((item) => item.status === "MET" || item.status === "NOT_APPLICABLE").length;
  const recordCount = countInternalFloodRecords(mef);
  return <div className="flstep"><section className="flworkflow-card"><div><span className="flworkflow-card__eyebrow">Controlled output</span><h2>Internal Flood PRA report package</h2><p>{ready ? `All ${String(met)} applicable supporting requirements are dispositioned across ${String(recordCount)} controlled records. The workbook has no review-blocking validation errors and can be submitted for internal technical review.` : `${String(blockers.length)} review-blocking validation item(s) and ${String(diagnostics.filter((item) => item.severity === "WARNING").length)} warning(s) remain. Draft files can still be generated.`}</p></div><div className="flworkflow-card__actions"><button type="button" className="flbtn" onClick={() => { void generateInternalFloodPraReport(mef, false); }}><POSIcon.Download /> Download draft (.docx)</button><button type="button" className="flbtn" onClick={() => downloadInternalFloodPraJson(mef)}><POSIcon.Download /> Download JSON</button>{actions?.submitForReview !== undefined && <button type="button" className="flbtn flbtn--primary" disabled={!ready || busy} onClick={() => { setBusy(true); actions.submitForReview?.().finally(() => setBusy(false)); }}><POSIcon.Send /> {busy ? "Submitting…" : "Submit for review"}</button>}</div></section><InternalFloodPraStepScreen stepId="draft" /></div>;
}

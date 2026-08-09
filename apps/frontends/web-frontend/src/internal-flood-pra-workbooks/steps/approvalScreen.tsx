import { type JSX, type ReactNode, useState } from "react";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { generateInternalFloodPraReport } from "../internalFloodPraDocx";
import { InternalFloodPraStepScreen } from "../internalFloodPraStepScreen";
import { countInternalFloodRecords } from "../internalFloodPraRecordCounts";
import { useInternalFloodPraWorkbook } from "../internalFloodPraWorkbookContext";
import { type InternalFloodWorkflowActions } from "./draftScreen";

export function ApprovalScreen({ actions, renderApprovalTable, renderSignCard }: { actions?: InternalFloodWorkflowActions; renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [busy, setBusy] = useState(false);
  const open = mef.internalReviewComments.openCount;
  const approved = countInternalFloodRecords(mef, ["APPROVED"]);
  return <div className="flstep"><section className="flworkflow-card"><div><span className="flworkflow-card__eyebrow">Controlled release</span><h2>Approval and final baseline</h2><p>{`${String(approved)} records are approved, ${String(open)} comment(s) remain open, and the workbook is ${mef.workflowState.replace(/_/g, " ").toLowerCase()}. Confirm signatures, released model files, final report, limitations, and configuration-control ownership.`}</p></div>{renderApprovalTable !== undefined && <div className="flworkflow-embed">{renderApprovalTable()}</div>}{renderSignCard !== undefined && <div className="flworkflow-embed">{renderSignCard()}</div>}<div className="flworkflow-card__actions"><button type="button" className="flbtn" onClick={() => { void generateInternalFloodPraReport(mef, true); }}><POSIcon.Download /> Download final report</button>{actions?.finalize !== undefined && <button type="button" className="flbtn flbtn--primary" disabled={busy || open > 0} onClick={() => { setBusy(true); actions.finalize?.().finally(() => setBusy(false)); }}><POSIcon.Send /> {busy ? "Finalizing…" : "Finalize workbook"}</button>}</div></section><InternalFloodPraStepScreen stepId="approval" /></div>;
}

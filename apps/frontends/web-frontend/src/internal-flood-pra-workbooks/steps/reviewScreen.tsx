import { type JSX, type ReactNode, useState } from "react";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { InternalFloodPraStepScreen } from "../internalFloodPraStepScreen";
import { countInternalFloodRecords } from "../internalFloodPraRecordCounts";
import { useInternalFloodPraWorkbook } from "../internalFloodPraWorkbookContext";
import { type InternalFloodWorkflowActions } from "./draftScreen";

export function ReviewScreen({ actions, renderRoster }: { actions?: InternalFloodWorkflowActions; renderRoster?: () => ReactNode }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [busy, setBusy] = useState(false);
  const open = mef.internalReviewComments.openCount;
  const reviewed = countInternalFloodRecords(mef, ["REVIEWED", "APPROVED"]);
  return <div className="flstep"><section className="flworkflow-card"><div><span className="flworkflow-card__eyebrow">Independent challenge</span><h2>Technical and peer-review control</h2><p>{`${String(reviewed)} records have completed review across ${String(mef.activePeerReviewIds.length)} active peer-review package(s); ${String(open)} comment(s) remain open. Assignments, qualifications, findings, resolutions, and verification remain traceable to records and standard requirements.`}</p></div>{renderRoster !== undefined && <div className="flworkflow-embed">{renderRoster()}</div>}<div className="flworkflow-card__actions">{actions?.requestRevision !== undefined && <button type="button" className="flbtn" disabled={busy} onClick={() => { setBusy(true); actions.requestRevision?.().finally(() => setBusy(false)); }}><POSIcon.ArrowL /> Request revision</button>}{actions?.submitForApproval !== undefined && <button type="button" className="flbtn flbtn--primary" disabled={busy || open > 0} onClick={() => { setBusy(true); actions.submitForApproval?.().finally(() => setBusy(false)); }}><POSIcon.Send /> {busy ? "Submitting…" : "Submit for approval"}</button>}</div></section><InternalFloodPraStepScreen stepId="review" /></div>;
}

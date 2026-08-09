import { type JSX, type ReactNode, useMemo, useState } from "react";
import { WorkbookSectionHeading } from "../../workbooks/workbookSectionHeading";
import { POSIcon } from "../../pos-workbooks/posIcons";
import { Badge } from "../../pos-workbooks/posShared";
import { internalFloodConformanceItems, internalFloodConformanceScore } from "../internalFloodPraConformance";
import { type InternalFloodPraPersona } from "../internalFloodPraWorkbench";
import { useInternalFloodPraWorkbook } from "../internalFloodPraWorkbookContext";
import { type InternalFloodWorkflowActions } from "./draftScreen";
import { ReviewBanner, ReviewComments } from "./reviewScreen";

export function ApprovalScreen({ persona, actions, renderApprovalTable, renderSignCard }: { persona: InternalFloodPraPersona; actions?: InternalFloodWorkflowActions; renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode }): JSX.Element {
  const { mef } = useInternalFloodPraWorkbook();
  const [handoff, setHandoff] = useState<string | null>(null);
  const score = useMemo(() => internalFloodConformanceScore(internalFloodConformanceItems(mef)), [mef]);
  const comments = mef.internalReviewComments.comments;
  const resolved = comments.filter((comment) => comment.resolved).length;
  const approved = mef.workflowState === "FINAL";
  const snapshot = mef.configurationControlRecordId ?? "";

  return <>
    <ReviewBanner />
    <ReviewComments comments={comments} persona={persona} actions={actions} approvalView title={persona === "preparer" ? "Comments by reviewers & approvers" : "Your comments"} description="Review the comment record that supports the approval decision, including each comment's resolution status and responsible role." />
    <div className="poscard">
      <div className="poscard__head"><WorkbookSectionHeading title="What is being attested" description="Confirm the capability target, supporting-requirement status, resolved comment record, and controlled configuration snapshot covered by the approval signature." /></div>
      <div className="posapprove__attest-with-sign">
        <div className="posapprove__attest-grid">
          <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Capability target</span><span className="posapprove__attest-val"><strong>{mef.capabilityCategory}</strong> · Internal Flood PRA</span></div>
          <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Items satisfied</span><span className="posapprove__attest-val posmono">{score.met} of {score.applicable}</span></div>
          <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Review comments</span><span className="posapprove__attest-val posmono">{resolved} of {comments.length} resolved</span></div>
          <div className="posapprove__attest-row"><span className="posapprove__attest-cap">Configuration snapshot</span>{snapshot.length > 0 ? <span className="posapprove__attest-val poscclink"><POSIcon.Lock /> {snapshot}</span> : <span className="posapprove__attest-val possubtle">Not linked</span>}</div>
        </div>
        {renderSignCard !== undefined && <div className="posapprove__sign-col">{renderSignCard()}</div>}
      </div>
    </div>
    {renderApprovalTable?.()}
    {approved && <div className="poscard posapprove__handoff">
      <div className="poscard__head"><WorkbookSectionHeading title="After approval — external workflows" description="Release the approved, locked workbook to independent peer review or audit. External participants may inspect and comment, but cannot alter the approved analysis." /><Badge kind="draft">View + comment only</Badge></div>
      <div className="posapprove__handoff-grid">
        <button type="button" className="posapprove__handoff-card" onClick={() => setHandoff("Peer Review release selected")}><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Eye /></div><div><div className="posapprove__handoff-card-eyebrow">External · Internal Flood PRA</div><div className="posapprove__handoff-card-title">Peer Review</div></div></div><div className="posapprove__handoff-card-foot"><span>Release to peer review</span><POSIcon.ArrowR /></div></button>
        <button type="button" className="posapprove__handoff-card" onClick={() => setHandoff("Audit release selected")}><div className="posapprove__handoff-card-head"><div className="posapprove__handoff-card-icon"><POSIcon.Lock /></div><div><div className="posapprove__handoff-card-eyebrow">External · NQA-1 aligned</div><div className="posapprove__handoff-card-title">Audit</div></div></div><div className="posapprove__handoff-card-foot"><span>Release to audit</span><POSIcon.ArrowR /></div></button>
      </div>
      {handoff !== null && <p className="posmuted" role="status">{handoff}</p>}
    </div>}
  </>;
}

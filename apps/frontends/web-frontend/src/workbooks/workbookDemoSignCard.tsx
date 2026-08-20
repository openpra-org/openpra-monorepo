import { JSX, useState } from "react";
import { CheckIcon, LockIcon } from "./reviewIcons";
import "./css/workbookApprovalTable.css";

type DemoPersona = "preparer" | "co_preparer" | "reviewer" | "approver";

const SIGN_CARD_TITLE: Record<DemoPersona, string> = {
  preparer: "Sign off as preparer",
  co_preparer: "Sign off as co-preparer",
  reviewer: "Sign review",
  approver: "Sign and approve workbook",
};

const ACTION_LABEL: Record<DemoPersona, string> = {
  preparer: "Preparer",
  co_preparer: "Co-preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

const GATED: DemoPersona[] = ["reviewer", "approver"];

interface WorkbookDemoSignCardProps {
  persona: DemoPersona;
  myOpenComments: number;
  submitted: boolean;
  preparerPhase: boolean;
  onReviewerApproverSigned: () => void;
  onPreparerSigned: () => void;
}

function WorkbookDemoSignCard({
  persona,
  myOpenComments,
  submitted,
  preparerPhase,
  onReviewerApproverSigned,
  onPreparerSigned,
}: WorkbookDemoSignCardProps): JSX.Element | null {
  const [ackedNoMore, setAckedNoMore] = useState(false);
  const [signed, setSigned] = useState(false);

  if ((persona === "reviewer" || persona === "approver") && !submitted) return null;
  if ((persona === "preparer" || persona === "co_preparer") && !preparerPhase) return null;

  const gated = GATED.includes(persona);
  const blockedByComments = gated && myOpenComments > 0;
  const canSign = !blockedByComments && (!gated || ackedNoMore);

  if (signed) {
    return (
      <div className="poscard posapprove__signcard">
        <div className="posapprove__signer">
          <div className="posapprove__signer-avatar">ME</div>
          <div className="posapprove__signer-main">
            <div className="posapprove__signer-name">Demo User</div>
            <div className="posapprove__signer-role">{ACTION_LABEL[persona]} · example workbook</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="poscard posapprove__signcard">
      <div className="posapprove__signer">
        <div className="posapprove__signer-avatar">ME</div>
        <div className="posapprove__signer-main">
          <div className="posapprove__signer-name">Demo User</div>
          <div className="posapprove__signer-role">{ACTION_LABEL[persona]} · example workbook</div>
        </div>
      </div>

      {gated && (
        <div className="posapprove__ackrow">
          {blockedByComments ? (
            <p className="posapprove__signhint"><LockIcon /> Resolve your {myOpenComments} open comment{myOpenComments === 1 ? "" : "s"} before you can sign.</p>
          ) : !ackedNoMore ? (
            <button type="button" className="posapprove__ack" onClick={() => setAckedNoMore(true)}>
              ☐ I have no further comments
            </button>
          ) : (
            <span className="posapprove__ack-confirmed">
              ☑ Confirmed, no further comments.{" "}
              <button type="button" className="posapprove__ack-undo" onClick={() => setAckedNoMore(false)}>undo</button>
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        className="posnav__btn posnav__btn--primary posapprove__signbtn"
        disabled={!canSign}
        style={!canSign ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        onClick={() => {
          setSigned(true);
          if (persona === "reviewer" || persona === "approver") {
            onReviewerApproverSigned();
          } else {
            onPreparerSigned();
          }
        }}
      >
        <CheckIcon /> {persona === "approver" ? "Sign & approve workbook" : "Sign"}
      </button>
    </div>
  );
}

export { WorkbookDemoSignCard, type DemoPersona };

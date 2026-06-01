import { JSX, useEffect, useState } from "react";
import { CheckIcon, LockIcon } from "./reviewIcons";
import { getWorkbookWorkflowStatus, signWorkbookAs, type WorkbookSignoffRole, type WorkbookWorkflowStatus } from "./workbookReviewApi";
import "./css/workbookApprovalTable.css";

interface WorkbookSignCardProps {
  workbookId: string;
  actingUsername: string;
  myOpenComments: number;
  refreshSignal: number;
  onSigned: () => void;
}

const ACTION_LABEL: Record<WorkbookSignoffRole, string> = {
  preparer: "Preparer",
  co_preparer: "Co-preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

const SIGN_CARD_TITLE: Record<WorkbookSignoffRole, string> = {
  preparer: "Sign off as preparer",
  co_preparer: "Sign off as co-preparer",
  reviewer: "Sign review",
  approver: "Sign and approve workbook",
};

const COMMENT_GATED_ROLES: WorkbookSignoffRole[] = ["reviewer", "approver"];

function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function WorkbookSignCard({ workbookId, actingUsername, myOpenComments, refreshSignal, onSigned }: WorkbookSignCardProps): JSX.Element | null {
  const [status, setStatus] = useState<WorkbookWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [ackedNoMore, setAckedNoMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWorkbookWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [workbookId, refreshSignal]);

  useEffect(() => { setAckedNoMore(false); }, [workbookId, refreshSignal, myOpenComments]);

  if (status === null) return null;

  const pendingRole = status.myPendingSignoff;
  if (pendingRole === null) return null;
  const myRow = status.roleHolders.find((h) => h.username === actingUsername && h.role === pendingRole && h.signedAt === null);
  if (myRow === undefined) return null;

  const gated = COMMENT_GATED_ROLES.includes(pendingRole);
  const blockedByComments = gated && myOpenComments > 0;
  const canSignNow = !blockedByComments && (!gated || ackedNoMore);

  function handleSign(): void {
    if (pendingRole === null) return;
    setSigning(true);
    setError(null);
    signWorkbookAs(workbookId, pendingRole)
      .then(() => { onSigned(); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not sign"); setSigning(false); });
  }

  return (
    <div className="poscard posapprove__signcard">
      <div className="poscard__head">
        <h3 className="poscard__title">{SIGN_CARD_TITLE[pendingRole]}</h3>
        {canSignNow
          ? <span className="posbadge posbadge--progress"><span className="posbadge__dot" />Awaiting your signature</span>
          : <span className="posbadge posbadge--warn"><span className="posbadge__dot" />Signature withheld</span>}
      </div>

      <div className="posapprove__signer">
        <div className="posapprove__signer-avatar">{initialsOf(myRow.fullName)}</div>
        <div className="posapprove__signer-main">
          <div className="posapprove__signer-name">{myRow.fullName}</div>
          <div className="posapprove__signer-role">{ACTION_LABEL[pendingRole]}{myRow.designation !== null && myRow.designation.length > 0 ? ` · ${myRow.designation}` : ""}</div>
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
              ☑ Confirmed, no further comments. <button type="button" className="posapprove__ack-undo" onClick={() => setAckedNoMore(false)}>undo</button>
            </span>
          )}
        </div>
      )}

      {error !== null && <p className="posapproval__error">{error}</p>}

      <button
        type="button"
        className="posnav__btn posnav__btn--primary posapprove__signbtn"
        disabled={!canSignNow || signing}
        style={!canSignNow || signing ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        onClick={handleSign}
      >
        <CheckIcon /> {signing ? "Signing…" : pendingRole === "approver" ? "Sign & approve workbook" : "Sign"}
      </button>
    </div>
  );
}

export { WorkbookSignCard };

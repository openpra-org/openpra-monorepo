import { JSX, useEffect, useState } from "react";
import { CheckIcon, LockIcon } from "./reviewIcons";
import { getWorkbookWorkflowStatus, signWorkbookAs, submitWorkbookToApprover, type WorkbookSignoffRole, type WorkbookWorkflowStatus } from "./workbookReviewApi";
import { getMySignature } from "../users/userApi";
import { SignatureSetupModal } from "../settings/signatureSetupModal";
import "./css/workbookApprovalTable.css";

type UiPersona = "preparer" | "reviewer" | "approver";

const PERSONA_ROLES: Record<UiPersona, WorkbookSignoffRole[]> = {
  preparer: ["preparer", "co_preparer"],
  reviewer: ["reviewer"],
  approver: ["approver"],
};

interface WorkbookSignCardProps {
  workbookId: string;
  actingUsername: string;
  currentPersona: UiPersona;
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

function WorkbookSignCard({ workbookId, actingUsername, currentPersona, myOpenComments, refreshSignal, onSigned }: WorkbookSignCardProps): JSX.Element | null {
  const [status, setStatus] = useState<WorkbookWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [ackedNoMore, setAckedNoMore] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null | "loading">("loading");
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWorkbookWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [workbookId, refreshSignal]);

  useEffect(() => {
    let cancelled = false;
    getMySignature()
      .then((res) => { if (!cancelled) setSignatureDataUrl(res.signatureDataUrl); })
      .catch(() => { if (!cancelled) setSignatureDataUrl(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setAckedNoMore(false); }, [workbookId, refreshSignal, myOpenComments]);

  if (status === null) return null;

  const pendingRole = status.myPendingSignoff;

  if (pendingRole === null) {
    const isPrep = currentPersona === "preparer" &&
      (status.preparers.includes(actingUsername) || status.coPreparers.includes(actingUsername));
    if (status.workflowState === "INTERNAL_TECHNICAL_REVIEW" && status.allReviewersSigned && isPrep) {
      return (
        <SendToApproverCard
          workbookId={workbookId}
          hasApprover={status.approvers.length > 0}
          onSubmitted={onSigned}
        />
      );
    }
    return null;
  }

  if (!PERSONA_ROLES[currentPersona].includes(pendingRole)) return null;

  const myRow = status.roleHolders.find((h) => h.username === actingUsername && h.role === pendingRole && h.signedAt === null);
  if (myRow === undefined) return null;

  const gated = COMMENT_GATED_ROLES.includes(pendingRole);
  const blockedByComments = gated && myOpenComments > 0;
  const canSignNow = !blockedByComments && (!gated || ackedNoMore);
  const sigReady = signatureDataUrl !== "loading" && signatureDataUrl !== null;

  function doSign(dataUrl: string | null): void {
    if (pendingRole === null) return;
    setSigning(true);
    setError(null);
    signWorkbookAs(workbookId, pendingRole, dataUrl ?? undefined)
      .then(() => { onSigned(); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not sign"); setSigning(false); });
  }

  function handleSignClick(): void {
    if (!canSignNow) return;
    if (signatureDataUrl === "loading") return;
    if (signatureDataUrl === null) {
      setShowSetupModal(true);
    } else {
      setShowConfirm(true);
    }
  }

  return (
    <>
      <div className="poscard posapprove__signcard">

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
                ☑ Confirmed, no further comments.{" "}
                <button type="button" className="posapprove__ack-undo" onClick={() => setAckedNoMore(false)}>undo</button>
              </span>
            )}
          </div>
        )}

        {canSignNow && signatureDataUrl !== "loading" && signatureDataUrl === null && (
          <p className="posapprove__signhint" style={{ marginTop: 8 }}>No signature set up. Go to user → Settings → Signature.</p>
        )}

        {error !== null && <p className="posapproval__error">{error}</p>}

        <button
          type="button"
          className="posnav__btn posnav__btn--primary posapprove__signbtn"
          disabled={!canSignNow || signing || signatureDataUrl === "loading"}
          style={(!canSignNow || signing || signatureDataUrl === "loading") ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={handleSignClick}
        >
          <CheckIcon /> {signing ? "Signing…" : pendingRole === "approver" ? "Sign & approve workbook" : "Sign"}
        </button>

        {showConfirm && sigReady && (
          <div className="posapprove__sig-confirm">
            <p className="posapprove__sig-confirm-label">Sign with this signature?</p>
            <img src={signatureDataUrl as string} alt="Your signature" className="posapprove__sig-preview" />
            <div className="posapprove__sig-confirm-actions">
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button
                type="button"
                className="posnav__btn posnav__btn--sm posnav__btn--primary"
                disabled={signing}
                onClick={() => { setShowConfirm(false); doSign(signatureDataUrl as string); }}
              >
                <CheckIcon /> Confirm & sign
              </button>
            </div>
          </div>
        )}
      </div>

      {showSetupModal && (
        <SignatureSetupModal
          onClose={() => setShowSetupModal(false)}
          onSaved={(dataUrl) => {
            setSignatureDataUrl(dataUrl);
            setShowSetupModal(false);
            setShowConfirm(true);
          }}
        />
      )}
    </>
  );
}

function SendToApproverCard({
  workbookId,
  hasApprover,
  onSubmitted,
}: {
  workbookId: string;
  hasApprover: boolean;
  onSubmitted: () => void;
}): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    setSubmitting(true);
    setError(null);
    submitWorkbookToApprover(workbookId)
      .then(() => { onSubmitted(); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not submit to approver"); setSubmitting(false); });
  }

  return (
    <div className="poscard posapprove__signcard">
      <p className="posapprove__signhint" style={{ marginTop: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
        {hasApprover
          ? "All reviewers have completed their review. Send the workbook to the approver for final sign-off."
          : "Assign an approver in Roles before submitting."}
      </p>
      {error !== null && <p className="posapproval__error">{error}</p>}
      <button
        type="button"
        className="posnav__btn posnav__btn--primary posapprove__signbtn"
        disabled={!hasApprover || submitting}
        style={(!hasApprover || submitting) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        onClick={handleSubmit}
      >
        <CheckIcon /> {submitting ? "Submitting…" : "Send to approver"}
      </button>
    </div>
  );
}

export { WorkbookSignCard };

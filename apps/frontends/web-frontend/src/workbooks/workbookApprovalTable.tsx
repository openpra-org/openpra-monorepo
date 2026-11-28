import { JSX, useEffect, useState } from "react";
import { linkedRevisionChanged, type WorkbookLinkedRevisionStatus } from "interfaces-shared-types/workbooks";
import { LockIcon } from "./reviewIcons";
import { getWorkbookLinkedRevisions, getWorkbookWorkflowStatus, type WorkbookSignoffRole, type WorkbookWorkflowStatus } from "./workbookReviewApi";
import "./css/workbookApprovalTable.css";

interface WorkbookApprovalTableProps {
  workbookId: string;
  refreshSignal: number;
}

interface Row {
  role: WorkbookSignoffRole;
  actionLabel: string;
  username: string;
  fullName: string;
  designation: string | null;
  signedAt: string | null;
  signatureDataUrl: string | null;
}

const ACTION_LABEL: Record<WorkbookSignoffRole, string> = {
  preparer: "Preparer",
  co_preparer: "Co-preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

const ROLE_ORDER: WorkbookSignoffRole[] = ["preparer", "co_preparer", "reviewer", "approver"];

function buildRows(status: WorkbookWorkflowStatus): Row[] {
  return [...status.roleHolders]
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map((h) => ({
      role: h.role,
      actionLabel: ACTION_LABEL[h.role],
      username: h.username,
      fullName: h.fullName,
      designation: h.designation,
      signedAt: h.signedAt,
      signatureDataUrl: h.signatureDataUrl,
    }));
}

function formatDate(iso: string | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} | ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function WorkbookApprovalTable({ workbookId, refreshSignal }: WorkbookApprovalTableProps): JSX.Element {
  const [status, setStatus] = useState<WorkbookWorkflowStatus | null>(null);
  const [linked, setLinked] = useState<WorkbookLinkedRevisionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkbookWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load workflow status"); });
    getWorkbookLinkedRevisions(workbookId)
      .then((next) => { if (!cancelled) setLinked(next); })
      .catch(() => { if (!cancelled) setLinked(null); });
    return () => { cancelled = true; };
  }, [workbookId, refreshSignal]);

  if (status === null && error === null) {
    return <div className="posapproval"><p className="posapproval__status">Loading signatures…</p></div>;
  }
  if (status === null) {
    return <div className="posapproval"><p className="posapproval__error">{error}</p></div>;
  }

  const rows = buildRows(status);
  const notStarted = status.workflowState === "DRAFT" || status.workflowState === "REVISION_REQUIRED";
  const signedAgainst = linked?.signedAgainst ?? null;

  return (
    <div className="posapproval">
      <h3 className="posapproval__title">Document approval and sign-off</h3>
      <table className="posapproval__table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Name &amp; designation</th>
            <th>Signature</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="posapproval__empty">No role-holders assigned to this workbook yet.</td></tr>
          ) : rows.map((r) => (
            <tr key={`${r.role}-${r.username}`} className={r.signedAt !== null ? "posapproval__row--signed" : "posapproval__row--pending"}>
              <td className={`posapproval__action posapproval__action--${r.role}`}>{r.actionLabel}</td>
              <td>
                <div className="posapproval__name">{r.fullName}</div>
                <div className="posapproval__desig">{r.designation !== null && r.designation.length > 0 ? r.designation : `@${r.username}`}</div>
              </td>
              <td className="posapproval__signature">
                {r.signedAt !== null ? (
                  r.signatureDataUrl !== null ? (
                    <img src={r.signatureDataUrl} alt={`${r.fullName} signature`} className="posapproval__sig-img" />
                  ) : (
                    <span className="posapproval__sig-name">{r.fullName}</span>
                  )
                ) : (
                  <span className="posapproval__sig-pending">Pending</span>
                )}
              </td>
              <td className="posapproval__date">{formatDate(r.signedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {linked !== null && signedAgainst !== null && signedAgainst.links.length > 0 && (
        <div className="posapproval__linked">
          <h3 className="posapproval__title">Linked workbooks at sign-off</h3>
          {linked.outOfDate && <p className="posapproval__error" role="alert">Out of date since sign-off. A linked workbook changed after this workbook was signed, so it needs a new review.</p>}
          <table className="posapproval__table" aria-label="Linked workbooks at sign-off">
            <thead>
              <tr>
                <th>Linked workbook</th>
                <th>Signed against</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              {signedAgainst.links.map((entry) => (
                <tr key={entry.code}>
                  <td>{`${entry.code} · ${entry.name}`}</td>
                  <td>{entry.revision === undefined ? `As of ${formatDate(signedAgainst.recordedAt)}` : `Revision ${entry.revision}`}</td>
                  <td>{linkedRevisionChanged(entry, linked.current) ? "Changed" : "Same"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {notStarted && (
        <p className="posapproval__hint">
          Signatures collect once the workbook is submitted for review. Current state: <strong>{status.workflowState}</strong>.
        </p>
      )}
    </div>
  );
}

export { WorkbookApprovalTable };

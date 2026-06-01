import { JSX, useEffect, useState } from "react";
import { LockIcon } from "./reviewIcons";
import { getWorkbookWorkflowStatus, type WorkbookSignoffRole, type WorkbookWorkflowStatus } from "./workbookReviewApi";
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
    }));
}

function formatDate(iso: string | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} | ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function WorkbookApprovalTable({ workbookId, refreshSignal }: WorkbookApprovalTableProps): JSX.Element {
  const [status, setStatus] = useState<WorkbookWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWorkbookWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load workflow status"); });
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
                  <span className="posapproval__sig-name">{r.fullName}</span>
                ) : (
                  <span className="posapproval__sig-pending">Pending</span>
                )}
              </td>
              <td className="posapproval__date">{formatDate(r.signedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notStarted && (
        <p className="posapproval__hint">
          Signatures collect once the workbook is submitted for review. Current state: <strong>{status.workflowState}</strong>.
        </p>
      )}
    </div>
  );
}

export { WorkbookApprovalTable };

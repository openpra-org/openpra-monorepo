import { JSX, useEffect, useState } from "react";
import { getPosWorkflowStatus, signPosAs, type PosSignoffRole, type PosWorkflowStatus } from "./posWorkbookApi";
import "./css/posApprovalTable.css";

interface PosApprovalTableProps {
  workbookId: string;
  actingUsername: string;
  refreshSignal: number;
  onSigned: () => void;
}

interface Row {
  role: PosSignoffRole;
  actionLabel: string;
  username: string;
  signedAt: string | null;
}

const ACTION_LABEL: Record<PosSignoffRole, string> = {
  preparer: "Preparer",
  co_preparer: "Co-preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

function buildRows(status: PosWorkflowStatus): Row[] {
  const signoffMap = new Map<string, string>();
  for (const s of status.signoffs) signoffMap.set(`${s.role}::${s.username}`, s.signedAt);
  const rows: Row[] = [];
  function push(username: string, role: PosSignoffRole): void {
    rows.push({
      role,
      actionLabel: ACTION_LABEL[role],
      username,
      signedAt: signoffMap.get(`${role}::${username}`) ?? null,
    });
  }
  for (const u of status.preparers) push(u, "preparer");
  for (const u of status.coPreparers) push(u, "co_preparer");
  for (const u of status.reviewers) push(u, "reviewer");
  for (const u of status.approvers) push(u, "approver");
  return rows;
}

function formatDate(iso: string | null): string {
  if (iso === null) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} | ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function PosApprovalTable({ workbookId, actingUsername, refreshSignal, onSigned }: PosApprovalTableProps): JSX.Element {
  const [status, setStatus] = useState<PosWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRole, setBusyRole] = useState<PosSignoffRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPosWorkflowStatus(workbookId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load workflow status"); });
    return () => { cancelled = true; };
  }, [workbookId, refreshSignal]);

  function handleSign(role: PosSignoffRole): void {
    setBusyRole(role);
    setError(null);
    signPosAs(workbookId, role)
      .then(() => getPosWorkflowStatus(workbookId))
      .then((s) => { setStatus(s); onSigned(); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not sign"); })
      .finally(() => { setBusyRole(null); });
  }

  if (status === null && error === null) {
    return <div className="posapproval"><p className="posapproval__status">Loading signatures…</p></div>;
  }
  if (status === null) {
    return <div className="posapproval"><p className="posapproval__error">{error}</p></div>;
  }

  const rows = buildRows(status);
  const isApprovalState = status.workflowState === "INTERNAL_APPROVAL";

  return (
    <div className="posapproval">
      <h3 className="posapproval__title">Document Approval</h3>
      {error !== null && <p className="posapproval__error">{error}</p>}
      <table className="posapproval__table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Name</th>
            <th>Signature</th>
            <th>Date</th>
            <th aria-label="Sign" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="posapproval__empty">No role-holders assigned to this workbook yet.</td></tr>
          ) : rows.map((r) => {
            const isMine = r.username === actingUsername;
            const canSign = isMine && r.signedAt === null && isApprovalState;
            return (
              <tr key={`${r.role}-${r.username}`} className={r.signedAt !== null ? "posapproval__row--signed" : "posapproval__row--pending"}>
                <td className={`posapproval__action posapproval__action--${r.role}`}>{r.actionLabel}</td>
                <td>@{r.username}</td>
                <td className="posapproval__signature">
                  {r.signedAt !== null ? (
                    <span className="posapproval__sig-name">{r.username}</span>
                  ) : (
                    <span className="posapproval__sig-pending">Pending</span>
                  )}
                </td>
                <td className="posapproval__date">{formatDate(r.signedAt)}</td>
                <td>
                  {canSign && (
                    <button
                      type="button"
                      className="posnav__btn posnav__btn--sm posnav__btn--primary"
                      disabled={busyRole !== null}
                      onClick={() => handleSign(r.role)}
                    >
                      {busyRole === r.role ? "Signing…" : "Sign"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!isApprovalState && (
        <p className="posapproval__hint">
          Signatures collect once the workbook reaches the internal approval phase. Current state: <strong>{status.workflowState}</strong>.
        </p>
      )}
    </div>
  );
}

export { PosApprovalTable };

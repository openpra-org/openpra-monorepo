import { JSX, useEffect, useState } from "react";
import { POSIcon } from "./posIcons";
import {
  assignPosRole,
  getPosRoles,
  unassignPosRole,
  type PosRolesResponse,
  type PosWorkbookRoleName,
} from "./posWorkbookApi";
import "./css/posRolesModal.css";

const ROLE_LABEL: Record<PosWorkbookRoleName, string> = {
  preparer: "Preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

function PosRolesModal({ workbookId, onClose, onChanged }: {
  workbookId: string;
  onClose: () => void;
  onChanged: (roles: PosRolesResponse) => void;
}): JSX.Element {
  const [roles, setRoles] = useState<PosRolesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<PosWorkbookRoleName>("reviewer");

  useEffect(() => {
    let cancelled = false;
    getPosRoles(workbookId)
      .then((res) => { if (!cancelled) setRoles(res); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load roles"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  function handleAssign(): void {
    if (selectedUser.length === 0 || roles === null) return;
    setBusy(true);
    setError(null);
    assignPosRole(workbookId, selectedUser, selectedRole)
      .then((res) => { setRoles(res); onChanged(res); setSelectedUser(""); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not assign role"); })
      .finally(() => { setBusy(false); });
  }

  function handleUnassign(username: string, role: PosWorkbookRoleName): void {
    setBusy(true);
    setError(null);
    unassignPosRole(workbookId, username, role)
      .then((res) => { setRoles(res); onChanged(res); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not remove role"); })
      .finally(() => { setBusy(false); });
  }

  if (roles === null && error === null) {
    return (
      <div className="posroles-overlay" onClick={onClose}>
        <div className="posroles-modal" onClick={(e) => e.stopPropagation()}>
          <p className="posroles__status">Loading roles…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="posroles-overlay" onClick={onClose}>
      <div className="posroles-modal" onClick={(e) => e.stopPropagation()}>
        <header className="posroles__head">
          <h2 className="posroles__title">Workbook roles</h2>
          <button type="button" className="posroles__close" onClick={onClose} aria-label="Close"><POSIcon.Close /></button>
        </header>

        {error !== null && <p className="posroles__error">{error}</p>}

        {roles !== null && (
          <>
            <section className="posroles__section">
              <h3 className="posroles__subtitle">Current assignments</h3>
              {roles.assignments.length === 0 ? (
                <p className="posroles__empty">No roles assigned yet.</p>
              ) : (
                <ul className="posroles__list">
                  {roles.assignments.map((a) => (
                    <li key={`${a.username}-${a.role}`} className="posroles__row">
                      <span className="posroles__row-name">{a.fullName}</span>
                      <span className="posroles__row-username">@{a.username}</span>
                      <span className={`posroles__row-role posroles__row-role--${a.role}`}>{ROLE_LABEL[a.role]}</span>
                      {roles.canManage && (
                        <button
                          type="button"
                          className="posroles__row-remove"
                          onClick={() => handleUnassign(a.username, a.role)}
                          disabled={busy}
                          aria-label={`Remove ${ROLE_LABEL[a.role]} from ${a.fullName}`}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {roles.canManage && (
              <section className="posroles__section">
                <h3 className="posroles__subtitle">Assign a role</h3>
                <div className="posroles__assign">
                  <select
                    className="posroles__select"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Select a project member…</option>
                    {roles.eligibleMembers.map((m) => (
                      <option key={m.username} value={m.username}>{m.fullName} (@{m.username})</option>
                    ))}
                  </select>
                  <select
                    className="posroles__select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as PosWorkbookRoleName)}
                    disabled={busy}
                  >
                    <option value="preparer">Preparer</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="approver">Approver</option>
                  </select>
                  <button
                    type="button"
                    className="posroles__assign-btn"
                    onClick={handleAssign}
                    disabled={busy || selectedUser.length === 0}
                  >
                    Assign
                  </button>
                </div>
                <p className="posroles__hint">
                  One person can hold multiple roles. Reviewers and approvers all must sign before the workbook advances.
                </p>
              </section>
            )}

            {!roles.canManage && (
              <p className="posroles__hint">Only the workbook owner or the project owner can change role assignments.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { PosRolesModal };

import { JSX, useEffect, useState } from "react";
import { CloseIcon } from "./reviewIcons";
import {
  assignWorkbookTeamRole,
  assignWorkbookUserRole,
  getWorkbookRoles,
  unassignWorkbookTeamRole,
  unassignWorkbookUserRole,
  type WorkbookRolesResponse,
  type WorkbookRoleName,
} from "./workbookReviewApi";
import "./css/workbookRolesModal.css";

const ROLE_LABEL: Record<WorkbookRoleName, string> = {
  preparer: "Preparer",
  co_preparer: "Co-preparer",
  reviewer: "Reviewer",
  approver: "Approver",
};

type Target = { kind: "user"; username: string } | { kind: "team"; teamId: string };

function WorkbookRolesModal({ workbookId, onClose, onChanged }: {
  workbookId: string;
  onClose: () => void;
  onChanged: (roles: WorkbookRolesResponse) => void;
}): JSX.Element {
  const [roles, setRoles] = useState<WorkbookRolesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<WorkbookRoleName>("reviewer");
  const [selectedDesignation, setSelectedDesignation] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    getWorkbookRoles(workbookId)
      .then((res) => { if (!cancelled) setRoles(res); })
      .catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load roles"); });
    return () => { cancelled = true; };
  }, [workbookId]);

  function parseTarget(key: string): Target | null {
    if (key.startsWith("user:")) return { kind: "user", username: key.slice(5) };
    if (key.startsWith("team:")) return { kind: "team", teamId: key.slice(5) };
    return null;
  }

  function handleAssign(): void {
    const target = parseTarget(selectedTargetKey);
    if (target === null || roles === null) return;
    setBusy(true);
    setError(null);
    const promise = target.kind === "user"
      ? assignWorkbookUserRole(workbookId, target.username, selectedRole, selectedDesignation)
      : assignWorkbookTeamRole(workbookId, target.teamId, selectedRole);
    promise
      .then((res) => { setRoles(res); onChanged(res); setSelectedTargetKey(""); setSelectedDesignation(""); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not assign role"); })
      .finally(() => { setBusy(false); });
  }

  function handleUnassignUser(username: string, role: WorkbookRoleName): void {
    setBusy(true);
    setError(null);
    unassignWorkbookUserRole(workbookId, username, role)
      .then((res) => { setRoles(res); onChanged(res); })
      .catch((err: unknown) => { setError((err as { message?: string }).message ?? "Could not remove role"); })
      .finally(() => { setBusy(false); });
  }

  function handleUnassignTeam(teamId: string, role: WorkbookRoleName): void {
    setBusy(true);
    setError(null);
    unassignWorkbookTeamRole(workbookId, teamId, role)
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
          <button type="button" className="posroles__close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
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
                  {roles.assignments.map((a) => {
                    const key = a.kind === "user" ? `user-${a.username}-${a.role}` : `team-${a.teamId}-${a.role}`;
                    return (
                      <li key={key} className="posroles__row">
                        {a.kind === "user" ? (
                          <>
                            <span className="posroles__row-name">{a.fullName}</span>
                            <span className="posroles__row-username">@{a.username}</span>
                            {a.designation !== undefined && a.designation.length > 0 && (
                              <span className="posroles__row-desig">{a.designation}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="posroles__row-name">{a.teamName}</span>
                            <span className="posroles__row-username">team · {a.memberCount} member{a.memberCount === 1 ? "" : "s"}</span>
                          </>
                        )}
                        <span className={`posroles__row-role posroles__row-role--${a.role}`}>{ROLE_LABEL[a.role]}</span>
                        {roles.canManage && (
                          <button
                            type="button"
                            className="posroles__row-remove"
                            onClick={() => {
                              if (a.kind === "user") handleUnassignUser(a.username, a.role);
                              else handleUnassignTeam(a.teamId, a.role);
                            }}
                            disabled={busy}
                            aria-label="Remove assignment"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {roles.canManage && (
              <section className="posroles__section">
                <h3 className="posroles__subtitle">Assign a role</h3>
                <div className="posroles__assign">
                  <select
                    className="posroles__select"
                    value={selectedTargetKey}
                    onChange={(e) => setSelectedTargetKey(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Select a person or team…</option>
                    {roles.eligibleTeams.length > 0 && (
                      <optgroup label="Teams">
                        {roles.eligibleTeams.map((t) => (
                          <option key={`team-${t.teamId}`} value={`team:${t.teamId}`}>
                            {t.teamName} ({t.memberCount} member{t.memberCount === 1 ? "" : "s"})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {roles.eligibleMembers.length > 0 && (
                      <optgroup label="People">
                        {roles.eligibleMembers.map((m) => (
                          <option key={`user-${m.username}`} value={`user:${m.username}`}>
                            {m.fullName} (@{m.username})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <select
                    className="posroles__select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as WorkbookRoleName)}
                    disabled={busy}
                  >
                    <option value="preparer">Preparer</option>
                    <option value="co_preparer">Co-preparer</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="approver">Approver</option>
                  </select>
                  {selectedTargetKey.startsWith("user:") && (
                    <input
                      type="text"
                      className="posroles__designation"
                      placeholder="Designation (optional)"
                      value={selectedDesignation}
                      onChange={(e) => setSelectedDesignation(e.target.value)}
                      disabled={busy}
                    />
                  )}
                  <button
                    type="button"
                    className="posroles__assign-btn"
                    onClick={handleAssign}
                    disabled={busy || selectedTargetKey.length === 0}
                  >
                    Assign
                  </button>
                </div>
                <p className="posroles__hint">
                  Assigning a role to a team grants the role to every current and future member of that team. One person can hold multiple roles. Reviewers and approvers all must sign before the workbook advances.
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

export { WorkbookRolesModal };

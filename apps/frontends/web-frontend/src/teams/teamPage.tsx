import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  type AuditLogEntry,
  type BulkInviteResult,
  type Team,
  type TeamDetail,
  type TeamRosterEntry,
  type UpdateTeamRequest,
} from "interfaces-shared-types";
import { getTeamAuditLog } from "../notifications/notificationsApi";
import { useToast } from "../toast/toastProvider";
import { ArrowLeftIcon, CloseIcon, TrashIcon, UsersIcon } from "../welcome/icons";
import { useTheme } from "../welcome/useTheme";
import { ThemePicker } from "../welcome/themePicker";
import { EditTeamModal } from "../profile/editTeamModal";
import { ConfirmDeleteTeamModal } from "../profile/confirmDeleteTeamModal";
import { UserTypeahead } from "../users/userTypeahead";
import {
  bulkInviteToTeam,
  cancelInvite,
  deleteTeam,
  deleteTeamAvatar,
  demoteFromLead,
  getTeamDetail,
  inviteToTeam,
  kickMember,
  leaveTeam,
  promoteToLead,
  transferTeamAdmin,
  updateTeam,
  uploadTeamAvatar,
} from "./teamsApi";
import "./css/teamPage.css";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "expires in 1 day" : `expires in ${days} days`;
}

function roleLabel(role: TeamRosterEntry["role"]): string {
  if (role === "admin") return "Admin";
  if (role === "lead") return "Lead";
  if (role === "invited") return "Invited";
  return "Member";
}

function roleChipClass(role: TeamRosterEntry["role"]): string {
  if (role === "admin") return "tp__role tp__role--admin";
  if (role === "lead") return "tp__role tp__role--lead";
  if (role === "invited") return "tp__role tp__role--invited";
  return "tp__role";
}

function TeamPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const teamId = params.id ?? "";
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [theme, setTheme] = useTheme();
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteValue, setInviteValue] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkInviteResult[]>([]);
  const [busy, setBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTeamDetail(teamId)
      .then((res) => { if (!cancelled) setDetail(res); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not load team");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teamId]);

  function flashSuccess(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "success", message: msg });
  }
  function flashError(msg: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message: msg });
  }

  function applyTeam(next: Team): void {
    setDetail((prev) => prev === null ? prev : { ...prev, ...next, role: next.role });
  }

  async function reloadDetail(): Promise<void> {
    try {
      const next = await getTeamDetail(teamId);
      setDetail(next);
    } catch (err) {
      flashError((err as { message?: string }).message ?? "Could not refresh team");
    }
  }

  function submitInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const id = inviteValue.trim();
    if (id === "") return;
    setBusy(true);
    inviteToTeam(teamId, { identifier: id })
      .then(() => {
        setInviteValue("");
        flashSuccess(`Invited ${id}`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not invite"); })
      .finally(() => { setBusy(false); });
  }

  function submitBulkInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const identifiers = bulkValue
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (identifiers.length === 0) return;
    setBusy(true);
    setBulkResults([]);
    bulkInviteToTeam(teamId, { identifiers })
      .then((res) => {
        setBulkResults(res.results);
        const invited = res.results.filter((r) => r.status === "invited").length;
        flashSuccess(`Invited ${invited} of ${res.results.length}`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not send invitations"); })
      .finally(() => { setBusy(false); });
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    uploadTeamAvatar(teamId, file)
      .then((t) => { applyTeam(t); flashSuccess("Team avatar updated"); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not upload avatar"); })
      .finally(() => { setBusy(false); });
  }

  function handleRemoveAvatar(): void {
    setBusy(true);
    deleteTeamAvatar(teamId)
      .then((t) => { applyTeam(t); flashSuccess("Team avatar removed"); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not remove avatar"); })
      .finally(() => { setBusy(false); });
  }

  function handleCancelInvite(username: string): void {
    setBusy(true);
    cancelInvite(teamId, username)
      .then(() => {
        flashSuccess(`Cancelled invitation for ${username}`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not cancel invitation"); })
      .finally(() => { setBusy(false); });
  }

  function handleKick(username: string): void {
    setBusy(true);
    kickMember(teamId, username)
      .then(() => {
        flashSuccess(`Removed ${username}`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not remove member"); })
      .finally(() => { setBusy(false); });
  }

  function handlePromote(username: string): void {
    setBusy(true);
    promoteToLead(teamId, username)
      .then((t) => {
        applyTeam(t);
        flashSuccess(`${username} is now a lead`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not promote"); })
      .finally(() => { setBusy(false); });
  }

  function handleDemote(username: string): void {
    setBusy(true);
    demoteFromLead(teamId, username)
      .then((t) => {
        applyTeam(t);
        flashSuccess(`${username} demoted to member`);
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not demote"); })
      .finally(() => { setBusy(false); });
  }

  function handleTransfer(): void {
    if (transferTarget === "") return;
    setBusy(true);
    transferTeamAdmin(teamId, transferTarget)
      .then(() => {
        flashSuccess(`Admin transferred to ${transferTarget}`);
        setTransferOpen(false);
        setTransferTarget("");
        return reloadDetail();
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not transfer admin"); })
      .finally(() => { setBusy(false); });
  }

  function handleLeave(): void {
    setBusy(true);
    leaveTeam(teamId)
      .then(() => {
        flashSuccess("Left team");
        navigate("/profile");
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not leave"); })
      .finally(() => { setBusy(false); });
  }

  function handleEditSubmit(payload: UpdateTeamRequest): void {
    setBusy(true);
    updateTeam(teamId, payload)
      .then((t) => {
        applyTeam(t);
        setEditOpen(false);
        flashSuccess("Team updated");
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not update team"); })
      .finally(() => { setBusy(false); });
  }

  function handleDeleteConfirm(): void {
    setBusy(true);
    deleteTeam(teamId)
      .then(() => {
        flashSuccess("Team deleted");
        navigate("/profile");
      })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not delete team"); })
      .finally(() => { setBusy(false); });
  }

  function toggleAudit(): void {
    const next = !auditOpen;
    setAuditOpen(next);
    if (next && !auditLoaded) {
      getTeamAuditLog(teamId)
        .then((res) => { setAuditEntries(res.entries); setAuditLoaded(true); })
        .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not load activity"); });
    }
  }

  const myRole = detail?.role ?? null;
  const isAdmin = myRole === "admin";
  const isLead = myRole === "lead";
  const isManager = isAdmin || isLead;
  const transferCandidates = detail?.members.filter((m) => m.role !== "admin") ?? [];

  return (
    <div className="wp wp--compact tp">
      <div className="wp__bg" />
      <main className="wp__main tp__main">
        <div className="tp__topline">
          <button type="button" className="ap__back tp__back" onClick={() => { navigate("/profile"); }}>
            <ArrowLeftIcon /> Profile
          </button>
          <ThemePicker theme={theme} setTheme={setTheme} />
        </div>

        {loading && <p className="tp__load">Loading team…</p>}
        {loadError !== null && <p className="tp__load-error">{loadError}</p>}

        {!loading && !loadError && detail !== null && (
          <>
            <header className="tp__header">
              <div className="tp__identity">
                <div className="tp__logo-wrap">
                  {detail.avatarUrl !== null
                    ? <img src={detail.avatarUrl} alt="" className="tp__logo tp__logo--img" />
                    : <span className="tp__logo" aria-hidden="true">{teamInitials(detail.name)}</span>}
                  {isAdmin && (
                    <div className="tp__logo-actions">
                      <button type="button" className="tp__logo-edit" onClick={() => { avatarInputRef.current?.click(); }} disabled={busy}>
                        {detail.avatarUrl !== null ? "Change" : "Add logo"}
                      </button>
                      {detail.avatarUrl !== null && (
                        <button type="button" className="tp__logo-edit" onClick={handleRemoveAvatar} disabled={busy}>
                          Remove
                        </button>
                      )}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="tp__logo-input"
                        onChange={handleAvatarFile}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="tp__title">{detail.name}</h1>
                  {detail.organization !== "" && (
                    <p className="tp__org">{detail.organization}</p>
                  )}
                </div>
              </div>
              {detail.description !== "" && (
                <p className="tp__desc">{detail.description}</p>
              )}
              <div className="tp__chips">
                <span className="tp__chip">{detail.visibility === "public" ? "Public" : "Private"}</span>
                <span className="tp__chip">
                  <UsersIcon /> {detail.memberCount} member{detail.memberCount === 1 ? "" : "s"}
                </span>
                {myRole !== null && <span className={roleChipClass(myRole)}>{roleLabel(myRole)}</span>}
              </div>
              <div className="tp__actions">
                {(myRole === "member" || myRole === "lead") && (
                  <button type="button" className="btn btn--ghost" onClick={handleLeave} disabled={busy}>
                    Leave team
                  </button>
                )}
                {isAdmin && (
                  <button type="button" className="btn btn--ghost" onClick={() => { setEditOpen(true); }} disabled={busy}>
                    Edit team
                  </button>
                )}
                {isAdmin && transferCandidates.length > 0 && (
                  <button type="button" className="btn btn--ghost" onClick={() => { setTransferOpen(true); }} disabled={busy}>
                    Transfer admin
                  </button>
                )}
                {isAdmin && (
                  <button type="button" className="btn btn--danger" onClick={() => { setDeleteOpen(true); }} disabled={busy}>
                    Delete team
                  </button>
                )}
              </div>
            </header>

            <section className="tp__section">
              <h2 className="tp__h">Members ({detail.members.length})</h2>
              <ul className="tp__list">
                {detail.members.map((m) => (
                  <li key={m.username} className="tp__row">
                    <span className="tp__avatar" aria-hidden="true">{m.initials}</span>
                    <div className="tp__row-body">
                      <Link to={`/users/${m.username}`} className="tp__row-name tp__row-link">{m.fullName}</Link>
                      <div className="tp__row-meta">@{m.username}</div>
                    </div>
                    <span className={roleChipClass(m.role)}>{roleLabel(m.role)}</span>
                    {isAdmin && m.role === "member" && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => { handlePromote(m.username); }} disabled={busy}>
                        Make lead
                      </button>
                    )}
                    {isAdmin && m.role === "lead" && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => { handleDemote(m.username); }} disabled={busy}>
                        Demote
                      </button>
                    )}
                    {isManager && m.role !== "admin" && m.username !== detail.adminUsername && (isAdmin || m.role === "member") && (
                      <button
                        type="button"
                        className="tp__remove"
                        aria-label={`Remove ${m.username}`}
                        onClick={() => { handleKick(m.username); }}
                        disabled={busy}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {isManager && (
              <section className="tp__section">
                <h2 className="tp__h">Pending invitations ({detail.invited.length})</h2>
                {detail.invited.length === 0 ? (
                  <p className="tp__empty">No open invitations.</p>
                ) : (
                  <ul className="tp__list">
                    {detail.invited.map((m) => (
                      <li key={m.username} className="tp__row">
                        <span className="tp__avatar" aria-hidden="true">{m.initials}</span>
                        <div className="tp__row-body">
                          <div className="tp__row-name">{m.fullName}</div>
                          <div className="tp__row-meta">@{m.username} · {expiryLabel(m.expiresAt)}</div>
                        </div>
                        <span className={roleChipClass("invited")}>Invited</span>
                        <button
                          type="button"
                          className="tp__remove"
                          aria-label={`Cancel invitation for ${m.username}`}
                          onClick={() => { handleCancelInvite(m.username); }}
                          disabled={busy}
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="tp__invite-mode">
                  <button
                    type="button"
                    className={`tp__invite-tab${!bulkMode ? " tp__invite-tab--active" : ""}`}
                    onClick={() => { setBulkMode(false); }}
                  >
                    Invite one
                  </button>
                  <button
                    type="button"
                    className={`tp__invite-tab${bulkMode ? " tp__invite-tab--active" : ""}`}
                    onClick={() => { setBulkMode(true); }}
                  >
                    Invite many
                  </button>
                </div>

                {!bulkMode ? (
                  <form className="tp__invite" onSubmit={submitInvite} noValidate>
                    <UserTypeahead
                      value={inviteValue}
                      onChange={setInviteValue}
                      placeholder="username or email"
                      ariaLabel="Invite by username or email"
                      disabled={busy}
                      className="tp__invite-input"
                    />
                    <button type="submit" className="btn btn--primary" disabled={busy || inviteValue.trim() === ""}>
                      Send invite
                    </button>
                  </form>
                ) : (
                  <form className="tp__bulk" onSubmit={submitBulkInvite} noValidate>
                    <textarea
                      className="field__input tp__bulk-input"
                      value={bulkValue}
                      onChange={(e) => { setBulkValue(e.target.value); }}
                      placeholder="One username or email per line (or comma-separated)"
                      rows={4}
                      disabled={busy}
                      aria-label="Bulk invite identifiers"
                    />
                    <button type="submit" className="btn btn--primary" disabled={busy || bulkValue.trim() === ""}>
                      Send invitations
                    </button>
                  </form>
                )}

                {bulkResults.length > 0 && (
                  <ul className="tp__bulk-results">
                    {bulkResults.map((r) => (
                      <li key={r.identifier} className={`tp__bulk-result tp__bulk-result--${r.status}`}>
                        <span>{r.identifier}</span>
                        <span className="tp__bulk-status">{r.status.replace(/-/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {isManager && (
              <section className="tp__section">
                <button type="button" className="tp__audit-toggle" onClick={toggleAudit} aria-expanded={auditOpen}>
                  {auditOpen ? "Hide activity log" : "Show activity log"}
                </button>
                {auditOpen && (
                  auditEntries.length === 0 ? (
                    <p className="tp__empty">No activity recorded yet.</p>
                  ) : (
                    <ul className="tp__audit">
                      {auditEntries.map((entry) => (
                        <li key={entry.id} className="tp__audit-row">
                          <span className="tp__audit-summary">{entry.summary}</span>
                          <span className="tp__audit-time">{new Date(entry.createdAt).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </section>
            )}
          </>
        )}
      </main>

      {editOpen && detail !== null && (
        <EditTeamModal
          team={detail}
          onCancel={() => { if (!busy) setEditOpen(false); }}
          onSubmit={handleEditSubmit}
          pending={busy}
        />
      )}

      {deleteOpen && detail !== null && (
        <ConfirmDeleteTeamModal
          team={detail}
          onCancel={() => { if (!busy) setDeleteOpen(false); }}
          onConfirm={handleDeleteConfirm}
          pending={busy}
        />
      )}

      {transferOpen && detail !== null && (
        <div
          className="modal__backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setTransferOpen(false); }}
        >
          <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="tx-title">
            <div className="modal__head">
              <div>
                <h2 className="modal__title" id="tx-title">Transfer admin</h2>
                <p className="modal__sub">
                  Hand the admin role to another member. You stay on the team as a regular member.
                </p>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={() => { setTransferOpen(false); }}
                aria-label="Close"
                disabled={busy}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal__body">
              <div className="field">
                <label className="field__label" htmlFor="tx-target">New admin</label>
                <select
                  id="tx-target"
                  className="field__input"
                  value={transferTarget}
                  onChange={(e) => { setTransferTarget(e.target.value); }}
                  disabled={busy}
                >
                  <option value="">Select a member…</option>
                  {transferCandidates.map((m) => (
                    <option key={m.username} value={m.username}>{m.fullName} (@{m.username})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={() => { setTransferOpen(false); }} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={handleTransfer} disabled={busy || transferTarget === ""}>
                {busy ? "Transferring…" : "Transfer admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { TeamPage };

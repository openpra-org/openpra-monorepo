import { JSX, FormEvent, useEffect, useState } from "react";
import { type Team, type TeamDetail, type TeamRosterEntry } from "interfaces-shared-types";
import {
  cancelInvite,
  getTeamDetail,
  inviteToTeam,
  kickMember,
  approveRequest,
  rejectRequest,
} from "../teams/teamsApi";
import { EditIcon, TrashIcon } from "../welcome/icons";
import "./css/teamAdminPanel.css";

interface TeamAdminPanelProps {
  team: Team;
  onTeamChanged: (team: Team) => void;
  onEdit: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

function TeamAdminPanel(props: TeamAdminPanelProps): JSX.Element {
  const { team, onTeamChanged, onEdit, onDelete, onError, onSuccess } = props;
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTeamDetail(team.id)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError((err as { message?: string }).message ?? "Could not load team");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [team.id, onError]);

  function reloadDetail(): Promise<void> {
    return getTeamDetail(team.id).then((d) => { setDetail(d); });
  }

  function handleInvite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = inviteIdentifier.trim();
    if (trimmed === "") return;
    setInviting(true);
    inviteToTeam(team.id, { identifier: trimmed })
      .then((updated) => {
        setInviteIdentifier("");
        onTeamChanged(updated);
        return reloadDetail();
      })
      .then(() => { onSuccess(`Invited "${trimmed}"`); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not invite user");
      })
      .finally(() => { setInviting(false); });
  }

  function handleCancelInvite(entry: TeamRosterEntry): void {
    setBusyRow(`inv:${entry.username}`);
    cancelInvite(team.id, entry.username)
      .then(reloadDetail)
      .then(() => { onSuccess(`Cancelled invite to ${entry.username}`); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not cancel invite");
      })
      .finally(() => { setBusyRow(null); });
  }

  function handleApprove(entry: TeamRosterEntry): void {
    setBusyRow(`pend:${entry.username}`);
    approveRequest(team.id, entry.username)
      .then((updated) => {
        onTeamChanged(updated);
        return reloadDetail();
      })
      .then(() => { onSuccess(`Approved ${entry.fullName}`); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not approve request");
      })
      .finally(() => { setBusyRow(null); });
  }

  function handleReject(entry: TeamRosterEntry): void {
    setBusyRow(`pend:${entry.username}`);
    rejectRequest(team.id, entry.username)
      .then(reloadDetail)
      .then(() => { onSuccess(`Rejected request from ${entry.fullName}`); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not reject request");
      })
      .finally(() => { setBusyRow(null); });
  }

  function handleKick(entry: TeamRosterEntry): void {
    setBusyRow(`mem:${entry.username}`);
    kickMember(team.id, entry.username)
      .then(reloadDetail)
      .then(() => { onSuccess(`Removed ${entry.fullName}`); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not remove member");
      })
      .finally(() => { setBusyRow(null); });
  }

  if (loading || detail === null) {
    return <div className="pf__admin pf__admin--loading">Loading team…</div>;
  }

  const members = detail.members.filter((m) => m.username !== detail.adminUsername);
  const adminEntry = detail.members.find((m) => m.username === detail.adminUsername) ?? null;

  return (
    <div className="pf__admin">
      <div className="pf__admin-h">
        <div>
          <h4 className="pf__admin-title">Manage team</h4>
          <p className="pf__admin-sub">
            Invite collaborators, review join requests, remove members.
          </p>
        </div>
        <div className="pf__admin-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
            <EditIcon /> Edit
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
            <TrashIcon /> Delete
          </button>
        </div>
      </div>

      <form onSubmit={handleInvite} className="pf__admin-invite" noValidate>
        <input
          type="text"
          className="field__input"
          placeholder="Invite by username or email"
          value={inviteIdentifier}
          onChange={(e) => { setInviteIdentifier(e.target.value); }}
          disabled={inviting}
          aria-label="Username or email to invite"
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={inviting || inviteIdentifier.trim() === ""}>
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </form>

      <div className="pf__admin-group">
        <h5 className="pf__admin-group-h">Members ({detail.members.length})</h5>
        <ul className="pf__roster">
          {adminEntry !== null && (
            <li className="pf__roster-row">
              <span className="pf__roster-av">{adminEntry.initials}</span>
              <div className="pf__roster-body">
                <span className="pf__roster-name">{adminEntry.fullName}</span>
                <span className="pf__roster-username">@{adminEntry.username}</span>
              </div>
              <span className="pf__role-chip pf__role-chip--admin">Admin</span>
            </li>
          )}
          {members.map((m) => (
            <li key={m.username} className="pf__roster-row">
              <span className="pf__roster-av">{m.initials}</span>
              <div className="pf__roster-body">
                <span className="pf__roster-name">{m.fullName}</span>
                <span className="pf__roster-username">@{m.username}</span>
              </div>
              <button
                type="button"
                className="pf__roster-action"
                onClick={() => { handleKick(m); }}
                disabled={busyRow !== null}
              >
                {busyRow === `mem:${m.username}` ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
          {members.length === 0 && adminEntry !== null && (
            <li className="pf__roster-empty">Just you for now. Invite someone above.</li>
          )}
        </ul>
      </div>

      {detail.pending.length > 0 && (
        <div className="pf__admin-group">
          <h5 className="pf__admin-group-h">Pending requests ({detail.pending.length})</h5>
          <ul className="pf__roster">
            {detail.pending.map((p) => (
              <li key={p.username} className="pf__roster-row">
                <span className="pf__roster-av">{p.initials}</span>
                <div className="pf__roster-body">
                  <span className="pf__roster-name">{p.fullName}</span>
                  <span className="pf__roster-username">@{p.username}</span>
                </div>
                <div className="pf__roster-pair">
                  <button
                    type="button"
                    className="pf__roster-action"
                    onClick={() => { handleReject(p); }}
                    disabled={busyRow !== null}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="pf__roster-action pf__roster-action--primary"
                    onClick={() => { handleApprove(p); }}
                    disabled={busyRow !== null}
                  >
                    {busyRow === `pend:${p.username}` ? "Working…" : "Approve"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.invited.length > 0 && (
        <div className="pf__admin-group">
          <h5 className="pf__admin-group-h">Open invitations ({detail.invited.length})</h5>
          <ul className="pf__roster">
            {detail.invited.map((i) => (
              <li key={i.username} className="pf__roster-row">
                <span className="pf__roster-av">{i.initials}</span>
                <div className="pf__roster-body">
                  <span className="pf__roster-name">{i.fullName}</span>
                  <span className="pf__roster-username">@{i.username}</span>
                </div>
                <button
                  type="button"
                  className="pf__roster-action"
                  onClick={() => { handleCancelInvite(i); }}
                  disabled={busyRow !== null}
                >
                  {busyRow === `inv:${i.username}` ? "Cancelling…" : "Cancel invite"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { TeamAdminPanel };

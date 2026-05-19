import { JSX, useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  type Project,
  type ProjectShareRole,
  type Team,
} from "interfaces-shared-types";
import { CloseIcon, TrashIcon, UsersIcon } from "../welcome/icons";
import { getMyTeams } from "../teams/teamsApi";
import { UserTypeahead } from "../users/userTypeahead";
import {
  shareProjectWithTeam,
  shareProjectWithUser,
  unshareProjectFromTeam,
  unshareProjectFromUser,
  updateProjectTeamShare,
  updateProjectUserShare,
} from "./projectApi";
import "./css/shareProjectModal.css";

interface ShareProjectModalProps {
  project: Project;
  onClose: () => void;
  onChanged: (project: Project) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

function ShareProjectModal({ project, onClose, onChanged, onError, onSuccess }: ShareProjectModalProps): JSX.Element {
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickTeamId, setPickTeamId] = useState("");
  const [pickTeamRole, setPickTeamRole] = useState<ProjectShareRole>("editor");
  const [userIdentifier, setUserIdentifier] = useState("");
  const [userRole, setUserRole] = useState<ProjectShareRole>("editor");

  useEffect(() => {
    let cancelled = false;
    getMyTeams()
      .then((res) => {
        if (cancelled) return;
        const eligible = res.teams.filter((t) => t.role === "admin" || t.role === "member");
        setTeams(eligible);
        const first = eligible.find((t) => !project.sharedTeams.some((s) => s.teamId === t.id));
        if (first) setPickTeamId(first.id);
      })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not load teams"); });
    return () => { cancelled = true; };
  }, [onError, project.sharedTeams]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onClose, busy]);

  function submitTeam(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (pickTeamId === "") return;
    setBusy(true);
    shareProjectWithTeam(project.id, pickTeamId, pickTeamRole)
      .then((p) => {
        onChanged(p);
        onSuccess(`Shared with team`);
        setPickTeamId("");
      })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not share with team"); })
      .finally(() => { setBusy(false); });
  }

  function submitUser(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const id = userIdentifier.trim();
    if (id === "") return;
    setBusy(true);
    shareProjectWithUser(project.id, id, userRole)
      .then((p) => {
        onChanged(p);
        onSuccess(`Shared with ${id}`);
        setUserIdentifier("");
      })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not share with user"); })
      .finally(() => { setBusy(false); });
  }

  function changeTeamRole(teamId: string, role: ProjectShareRole): void {
    setBusy(true);
    updateProjectTeamShare(project.id, teamId, role)
      .then((p) => { onChanged(p); })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not update role"); })
      .finally(() => { setBusy(false); });
  }

  function removeTeam(teamId: string): void {
    setBusy(true);
    unshareProjectFromTeam(project.id, teamId)
      .then(() => {
        const next: Project = { ...project, sharedTeams: project.sharedTeams.filter((s) => s.teamId !== teamId) };
        onChanged(next);
        onSuccess("Team removed");
      })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not remove team"); })
      .finally(() => { setBusy(false); });
  }

  function changeUserRole(username: string, role: ProjectShareRole): void {
    setBusy(true);
    updateProjectUserShare(project.id, username, role)
      .then((p) => { onChanged(p); })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not update role"); })
      .finally(() => { setBusy(false); });
  }

  function removeUser(username: string): void {
    setBusy(true);
    unshareProjectFromUser(project.id, username)
      .then(() => {
        const next: Project = { ...project, sharedUsers: project.sharedUsers.filter((s) => s.username !== username) };
        onChanged(next);
        onSuccess("Collaborator removed");
      })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not remove collaborator"); })
      .finally(() => { setBusy(false); });
  }

  const teamOptions = teams.filter((t) => !project.sharedTeams.some((s) => s.teamId === t.id));

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sh-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="sh-title">Share &quot;{project.name}&quot;</h2>
            <p className="modal__sub">
              You stay the sole owner — only you can delete. Share with teams or individuals; they can view or edit.
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body sh__body">
          <section className="sh__section">
            <h3 className="sh__h">Teams with access</h3>
            {project.sharedTeams.length === 0 ? (
              <p className="sh__empty">No teams yet.</p>
            ) : (
              <ul className="sh__list">
                {project.sharedTeams.map((s) => (
                  <li key={s.teamId} className="sh__row">
                    <span className="sh__row-icon" aria-hidden="true"><UsersIcon /></span>
                    <div className="sh__row-body">
                      <div className="sh__row-name">{s.teamName}</div>
                      <div className="sh__row-meta">{s.memberCount} member{s.memberCount === 1 ? "" : "s"}</div>
                    </div>
                    <select
                      className="sh__role"
                      value={s.role}
                      onChange={(e) => { changeTeamRole(s.teamId, e.target.value as ProjectShareRole); }}
                      disabled={busy}
                      aria-label={`Role for team ${s.teamName}`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="button"
                      className="sh__remove"
                      aria-label={`Remove team ${s.teamName}`}
                      onClick={() => { removeTeam(s.teamId); }}
                      disabled={busy}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {teamOptions.length > 0 && (
              <form className="sh__add" onSubmit={submitTeam} noValidate>
                <select
                  className="field__input sh__add-input"
                  value={pickTeamId}
                  onChange={(e) => { setPickTeamId(e.target.value); }}
                  disabled={busy}
                  aria-label="Pick a team"
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  className="field__input sh__add-role"
                  value={pickTeamRole}
                  onChange={(e) => { setPickTeamRole(e.target.value as ProjectShareRole); }}
                  disabled={busy}
                  aria-label="Role for new team share"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button type="submit" className="btn btn--primary btn--sm" disabled={busy || pickTeamId === ""}>
                  Add team
                </button>
              </form>
            )}
          </section>

          <section className="sh__section">
            <h3 className="sh__h">Collaborators</h3>
            {project.sharedUsers.length === 0 ? (
              <p className="sh__empty">No collaborators yet.</p>
            ) : (
              <ul className="sh__list">
                {project.sharedUsers.map((s) => (
                  <li key={s.username} className="sh__row">
                    <span className="sh__row-glyph" aria-hidden="true">
                      {s.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}
                    </span>
                    <div className="sh__row-body">
                      <Link to={`/users/${s.username}`} className="sh__row-name sh__row-link">{s.fullName}</Link>
                      <div className="sh__row-meta">@{s.username}</div>
                    </div>
                    <select
                      className="sh__role"
                      value={s.role}
                      onChange={(e) => { changeUserRole(s.username, e.target.value as ProjectShareRole); }}
                      disabled={busy}
                      aria-label={`Role for ${s.fullName}`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      type="button"
                      className="sh__remove"
                      aria-label={`Remove ${s.fullName}`}
                      onClick={() => { removeUser(s.username); }}
                      disabled={busy}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="sh__add" onSubmit={submitUser} noValidate>
              <UserTypeahead
                value={userIdentifier}
                onChange={setUserIdentifier}
                placeholder="username or email"
                ariaLabel="Username or email"
                disabled={busy}
                className="sh__add-input"
              />
              <select
                className="field__input sh__add-role"
                value={userRole}
                onChange={(e) => { setUserRole(e.target.value as ProjectShareRole); }}
                disabled={busy}
                aria-label="Role for new collaborator"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy || userIdentifier.trim() === ""}>
                Invite
              </button>
            </form>
          </section>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export { ShareProjectModal };

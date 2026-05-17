import { JSX, useState } from "react";
import { type Team } from "interfaces-shared-types";
import { CaretIcon, PlusIcon, UsersIcon } from "../welcome/icons";
import { TeamAdminPanel } from "./teamAdminPanel";
import "./css/teamsSection.css";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleLabel(role: Team["role"]): string {
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  if (role === "pending") return "Pending";
  if (role === "invited") return "Invited";
  return "";
}

function leaveLabel(role: Team["role"]): string {
  return role === "pending" ? "Cancel" : "Leave";
}

interface TeamsSectionProps {
  teams: Team[];
  onJoin: () => void;
  onCreate: () => void;
  onLeave: (team: Team) => void;
  onTeamUpdated: (team: Team) => void;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

function TeamsSection(props: TeamsSectionProps): JSX.Element {
  const { teams, onJoin, onCreate, onLeave, onTeamUpdated, onEdit, onDelete, onError, onSuccess } = props;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isEmpty = teams.length === 0;

  function toggle(id: string): void {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <section className="pf__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Teams &amp; organizations</h2>
          <p className="pf__section-sub">
            Groups you belong to or have requested to join. Expand a team you own to manage members.
          </p>
        </div>
        {!isEmpty && (
          <div className="pf__section-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onJoin}>
              Join team
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={onCreate}>
              <PlusIcon /> Create team
            </button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="pf__teams-empty">
          <UsersIcon />
          <h3>You&apos;re not on any teams yet</h3>
          <p>Join an existing team to collaborate on analyses, or create a new one for your group.</p>
          <div className="pf__teams-empty-actions">
            <button type="button" className="btn btn--ghost" onClick={onJoin}>
              Browse teams
            </button>
            <button type="button" className="btn btn--primary" onClick={onCreate}>
              <PlusIcon /> Create a team
            </button>
          </div>
        </div>
      ) : (
        <div className="pf__teams">
          {teams.map((team) => {
            const role = team.role;
            const isAdmin = role === "admin";
            const isExpanded = isAdmin && expandedId === team.id;
            const roleChipClass = role === "admin"
              ? "pf__role-chip pf__role-chip--admin"
              : role === "pending"
                ? "pf__role-chip pf__role-chip--pending"
                : role === "invited"
                  ? "pf__role-chip pf__role-chip--pending"
                  : "pf__role-chip";

            return (
              <div key={team.id} className={`pf__team-wrap${isExpanded ? " pf__team-wrap--expanded" : ""}`}>
                <div className="pf__team">
                  <span className="pf__team-glyph" aria-hidden="true">{teamInitials(team.name)}</span>
                  <div className="pf__team-body">
                    <h3 className="pf__team-name">{team.name}</h3>
                    <div className="pf__team-meta">
                      {role !== null && <span className={roleChipClass}>{roleLabel(role)}</span>}
                      {team.organization && <span className="pf__team-org">{team.organization}</span>}
                      <span className="pf__team-sep">·</span>
                      <span className="pf__team-members">
                        <UsersIcon /> {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`pf__team-toggle${isExpanded ? " pf__team-toggle--open" : ""}`}
                      onClick={() => { toggle(team.id); }}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Collapse team management" : "Expand team management"}
                    >
                      Manage <CaretIcon />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pf__team-leave"
                      onClick={() => { onLeave(team); }}
                    >
                      {leaveLabel(role)}
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <TeamAdminPanel
                    team={team}
                    onTeamChanged={onTeamUpdated}
                    onEdit={() => { onEdit(team); }}
                    onDelete={() => { onDelete(team); }}
                    onError={onError}
                    onSuccess={onSuccess}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export { TeamsSection };

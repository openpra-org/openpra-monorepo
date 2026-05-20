import { JSX } from "react";
import { Link } from "react-router-dom";
import { type Team } from "interfaces-shared-types";
import { ArrowRightIcon, PlusIcon, UsersIcon } from "../welcome/icons";
import "./css/teamsSection.css";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleLabel(role: Team["role"]): string {
  if (role === "admin") return "Admin";
  if (role === "lead") return "Lead";
  if (role === "member") return "Member";
  if (role === "invited") return "Invited";
  return "";
}

function roleChipClassFor(role: Team["role"]): string {
  if (role === "admin") return "pf__role-chip pf__role-chip--admin";
  if (role === "lead") return "pf__role-chip pf__role-chip--lead";
  if (role === "invited") return "pf__role-chip pf__role-chip--invited";
  return "pf__role-chip";
}

interface TeamsSectionProps {
  teams: Team[];
  onJoin: () => void;
  onCreate: () => void;
  onLeave: (team: Team) => void;
}

function TeamsSection(props: TeamsSectionProps): JSX.Element {
  const { teams, onJoin, onCreate, onLeave } = props;
  const isEmpty = teams.length === 0;

  return (
    <section className="pf__section">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">Teams &amp; organizations</h2>
          <p className="pf__section-sub">
            Groups you belong to. Open a team to view its roster.
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
            const canOpen = role === "admin" || role === "lead" || role === "member";
            const showLeave = role === "member" || role === "lead";

            return (
              <div key={team.id} className="pf__team-wrap">
                <div className="pf__team">
                  <span className="pf__team-glyph" aria-hidden="true">{teamInitials(team.name)}</span>
                  <div className="pf__team-body">
                    <h3 className="pf__team-name">{team.name}</h3>
                    <div className="pf__team-meta">
                      {role !== null && <span className={roleChipClassFor(role)}>{roleLabel(role)}</span>}
                      {team.organization && <span className="pf__team-org">{team.organization}</span>}
                      <span className="pf__team-sep">·</span>
                      <span className="pf__team-members">
                        <UsersIcon /> {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {canOpen && (
                    <Link to={`/teams/${team.id}`} className="pf__team-open">
                      Open <ArrowRightIcon />
                    </Link>
                  )}
                  {showLeave && (
                    <button
                      type="button"
                      className="pf__team-leave"
                      onClick={() => { onLeave(team); }}
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export { TeamsSection };

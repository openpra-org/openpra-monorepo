import { JSX } from "react";
import { type Team } from "interfaces-shared-types";
import { MailIcon } from "../welcome/icons";
import "./css/invitationsSection.css";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function InvitationsSection({
  invitations,
  busyId,
  onAccept,
  onDecline,
}: {
  invitations: Team[];
  busyId: string | null;
  onAccept: (team: Team) => void;
  onDecline: (team: Team) => void;
}): JSX.Element | null {
  if (invitations.length === 0) return null;

  return (
    <section className="pf__section pf__invitations">
      <div className="pf__section-h">
        <div>
          <h2 className="pf__section-title">
            <span className="pf__inv-icon" aria-hidden="true"><MailIcon /></span>
            Team invitations
          </h2>
          <p className="pf__section-sub">
            {invitations.length} pending invitation{invitations.length === 1 ? "" : "s"} to review.
          </p>
        </div>
      </div>
      <div className="pf__inv-list">
        {invitations.map((team) => (
          <div key={team.id} className="pf__inv">
            <span className="pf__team-glyph" aria-hidden="true">{teamInitials(team.name)}</span>
            <div className="pf__inv-body">
              <h3 className="pf__inv-name">{team.name}</h3>
              <div className="pf__team-meta">
                {team.organization && <span className="pf__team-org">{team.organization}</span>}
                {team.organization && <span className="pf__team-sep">·</span>}
                <span>Admin {team.adminUsername}</span>
              </div>
              {team.description && <p className="pf__inv-desc">{team.description}</p>}
            </div>
            <div className="pf__inv-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => { onDecline(team); }}
                disabled={busyId !== null}
              >
                {busyId === team.id ? "Working…" : "Decline"}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { onAccept(team); }}
                disabled={busyId !== null}
              >
                Accept
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { InvitationsSection };

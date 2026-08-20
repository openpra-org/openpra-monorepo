import { JSX, useEffect, useState } from "react";
import { type Team } from "interfaces-shared-types";
import { CloseIcon, SearchIcon } from "../welcome/icons";
import { getAvailableTeams, joinTeam } from "../teams/teamsApi";
import "./css/joinTeamModal.css";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function JoinTeamModal({
  onClose,
  onJoin,
  onError,
}: {
  onClose: () => void;
  onJoin: (team: Team) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const id = window.setTimeout(() => {
      getAvailableTeams(query)
        .then((res) => { if (!cancelled) setTeams(res.teams); })
        .catch((err: unknown) => {
          if (cancelled) return;
          onError((err as { message?: string }).message ?? "Could not load teams");
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query, onError]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && joiningId === null) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onClose, joiningId]);

  function handleJoin(team: Team): void {
    setJoiningId(team.id);
    joinTeam(team.id)
      .then((joined) => { onJoin(joined); })
      .catch((err: unknown) => {
        onError((err as { message?: string }).message ?? "Could not join team");
      })
      .finally(() => { setJoiningId(null); });
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && joiningId === null) onClose(); }}
    >
      <div className="modal modal--lg modal--tall" role="dialog" aria-modal="true" aria-labelledby="jt-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="jt-title">Browse teams</h2>
            <p className="modal__sub">
              Public teams join instantly. Private teams require approval.
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
            disabled={joiningId !== null}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body modal__body--no-pad-bot">
          <div className="pf__team-search">
            <div className="pf__search">
              <span className="pf__search-icon"><SearchIcon /></span>
              <input
                className="pf__search-input"
                type="text"
                placeholder="Search teams by name, organization, or description…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); }}
                aria-label="Search teams"
              />
              {query && (
                <button
                  type="button"
                  className="pf__search-clear"
                  onClick={() => { setQuery(""); }}
                  aria-label="Clear search"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>

          <div className="pf__browse">
            {loading ? (
              <div className="pf__browse-empty">
                <p>Loading…</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="pf__browse-empty">
                <SearchIcon />
                <p>
                  {query.trim() ? `No teams match "${query}"` : "No teams to join right now."}
                </p>
              </div>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="pf__browse-team">
                  <span className="pf__team-glyph" aria-hidden="true">{teamInitials(team.name)}</span>
                  <div className="pf__team-body">
                    <h3 className="pf__team-name">
                      <span>{team.name}</span>
                      <span className={`pf__visibility-tag pf__visibility-tag--${team.visibility}`}>
                        {team.visibility.toUpperCase()}
                      </span>
                    </h3>
                    <div className="pf__team-meta">
                      {team.organization && <span className="pf__team-org">{team.organization}</span>}
                      {team.organization && <span className="pf__team-sep">·</span>}
                      <span className="pf__team-members">{team.memberCount} member{team.memberCount === 1 ? "" : "s"}</span>
                    </div>
                    {team.description && <p className="pf__browse-desc">{team.description}</p>}
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm pf__browse-join"
                    onClick={() => { handleJoin(team); }}
                    disabled={joiningId !== null}
                  >
                    {joiningId === team.id
                      ? "Joining…"
                      : team.visibility === "public"
                        ? "Join"
                        : "Request to join"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { JoinTeamModal };

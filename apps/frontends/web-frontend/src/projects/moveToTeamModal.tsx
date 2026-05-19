import { JSX, useEffect, useState, FormEvent } from "react";
import { type Project, type Team } from "interfaces-shared-types";
import { CloseIcon } from "../welcome/icons";
import { getMyTeams } from "../teams/teamsApi";

interface MoveToTeamModalProps {
  project: Project;
  onCancel: () => void;
  onConfirm: (teamId: string) => void;
  pending: boolean;
}

function MoveToTeamModal({ project, onCancel, onConfirm, pending }: MoveToTeamModalProps): JSX.Element {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyTeams()
      .then((res) => {
        if (cancelled) return;
        const eligible = res.teams.filter((t) => (t.role === "admin" || t.role === "member") && t.id !== project.ownerTeamId);
        setTeams(eligible);
        if (eligible.length > 0) setSelected(eligible[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not load teams");
      });
    return () => { cancelled = true; };
  }, [project.ownerTeamId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onCancel, pending]);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (selected === "") return;
    onConfirm(selected);
  }

  const noTeams = teams.length === 0;

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="mtt-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="mtt-title">Move to team</h2>
            <p className="modal__sub">
              Pick a team to attach as the project&apos;s collaborative owner. You stay the personal owner.
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            aria-label="Close"
            disabled={pending}
          >
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            {loadError !== null && <div className="field__error">{loadError}</div>}
            {!loadError && noTeams && (
              <p className="modal__sub">
                You&apos;re not in any teams yet. Join or create a team from your profile.
              </p>
            )}
            {!loadError && !noTeams && (
              <div className="field">
                <label className="field__label" htmlFor="mtt-team">Team</label>
                <select
                  id="mtt-team"
                  className="field__input"
                  value={selected}
                  onChange={(e) => { setSelected(e.target.value); }}
                  disabled={pending}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending || noTeams || selected === ""}>
              {pending ? "Moving…" : "Move to team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { MoveToTeamModal };

import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import {
  type Team,
  type TeamVisibility,
  type UpdateTeamRequest,
  UpdateTeamRequestSchema,
} from "interfaces-shared-types";
import { CloseIcon, GlobeIcon, LockIcon } from "../welcome/icons";
import { OrgTypeahead } from "../orgs/orgTypeahead";

const VISIBILITY_OPTIONS: { id: TeamVisibility; label: string; icon: JSX.Element; desc: string }[] = [
  { id: "private", label: "Private", icon: <LockIcon />, desc: "Hidden from Browse. Members join only via admin invite." },
  { id: "public", label: "Public", icon: <GlobeIcon />, desc: "Listed in Browse. Anyone on OpenPRA can join instantly." },
];

interface FieldErrors {
  name?: string;
  description?: string;
}

function EditTeamModal({
  team,
  onCancel,
  onSubmit,
  pending,
}: {
  team: Team;
  onCancel: () => void;
  onSubmit: (payload: UpdateTeamRequest) => void;
  pending: boolean;
}): JSX.Element {
  const [name, setName] = useState(team.name);
  const [organization, setOrganization] = useState(team.organization);
  const [description, setDescription] = useState(team.description);
  const [visibility, setVisibility] = useState<TeamVisibility>(team.visibility);
  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => { nameRef.current?.focus(); }, 50);
    return () => { window.clearTimeout(id); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onCancel, pending]);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const candidate: Record<string, unknown> = {};
    const trimmedName = name.trim();
    const trimmedOrg = organization.trim();
    const trimmedDesc = description.trim();
    if (trimmedName !== team.name) candidate.name = trimmedName;
    if (trimmedOrg !== team.organization) candidate.organization = trimmedOrg;
    if (trimmedDesc !== team.description) candidate.description = trimmedDesc;
    if (visibility !== team.visibility) candidate.visibility = visibility;
    if (Object.keys(candidate).length === 0) {
      onCancel();
      return;
    }
    const parsed = UpdateTeamRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" && !next.name) next.name = issue.message;
        if (key === "description" && !next.description) next.description = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="et-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="et-title">Edit team</h2>
            <p className="modal__sub">Update team metadata. Members are notified on the next page load.</p>
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
            <div className="field">
              <label className="field__label" htmlFor="et-name">Team name</label>
              <input
                ref={nameRef}
                id="et-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
                className={`field__input${errors.name ? " field__input--error" : ""}`}
                autoComplete="off"
                disabled={pending}
              />
              {errors.name && <div className="field__error">{errors.name}</div>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="et-org">Organization</label>
              <OrgTypeahead
                value={organization}
                onChange={setOrganization}
                ariaLabel="Organization"
                disabled={pending}
                inputId="et-org"
              />
            </div>
            <div className="field">
              <label className="field__label">Visibility</label>
              <div className="pf__vis-row" role="radiogroup" aria-label="Visibility">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const checked = visibility === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`pf__vis${checked ? " pf__vis--checked" : ""}`}
                      htmlFor={`et-vis-${opt.id}`}
                    >
                      <input
                        id={`et-vis-${opt.id}`}
                        className="pf__vis-input"
                        type="radio"
                        name="et-visibility"
                        value={opt.id}
                        checked={checked}
                        onChange={() => { setVisibility(opt.id); }}
                        disabled={pending}
                      />
                      <span className="pf__vis-dot" aria-hidden="true" />
                      <div className="pf__vis-body">
                        <span className="pf__vis-head">{opt.icon} {opt.label}</span>
                        <span className="pf__vis-desc">{opt.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="et-desc">Description</label>
              <textarea
                id="et-desc"
                value={description}
                onChange={(e) => { setDescription(e.target.value.slice(0, 300)); if (errors.description) setErrors({ ...errors, description: undefined }); }}
                className={`field__input field__input--textarea${errors.description ? " field__input--error" : ""}`}
                disabled={pending}
              />
              <div className="pf__char-count">{description.length} / 300</div>
              {errors.description && <div className="field__error">{errors.description}</div>}
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { EditTeamModal };

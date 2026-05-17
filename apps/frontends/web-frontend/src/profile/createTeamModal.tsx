import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import {
  type CreateTeamRequest,
  type TeamVisibility,
  CreateTeamRequestSchema,
} from "interfaces-shared-types";
import { CloseIcon, GlobeIcon, LockIcon } from "../welcome/icons";
import "./css/createTeamModal.css";

interface FieldErrors {
  name?: string;
  description?: string;
}

const VISIBILITY_OPTIONS: { id: TeamVisibility; label: string; icon: JSX.Element; desc: string }[] = [
  {
    id: "private",
    label: "Private",
    icon: <LockIcon />,
    desc: "Only invited members can find or join.",
  },
  {
    id: "public",
    label: "Public",
    icon: <GlobeIcon />,
    desc: "Anyone on OpenPRA can find this team and request to join.",
  },
];

function CreateTeamModal({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: CreateTeamRequest) => void;
  pending: boolean;
}): JSX.Element {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<TeamVisibility>("private");
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
    const candidate = {
      name: name.trim(),
      organization: organization.trim(),
      description: description.trim(),
      visibility,
    };
    const parsed = CreateTeamRequestSchema.safeParse(candidate);
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ct-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="ct-title">Create a team</h2>
            <p className="modal__sub">
              Teams group collaborators on shared analyses. You become the team admin.
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
            <div className="field">
              <label className="field__label" htmlFor="ct-name">Team name</label>
              <div className="field__hint">At least 3 characters.</div>
              <input
                ref={nameRef}
                id="ct-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
                className={`field__input${errors.name ? " field__input--error" : ""}`}
                placeholder="Risk & Reliability Research Group"
                autoComplete="off"
                disabled={pending}
              />
              {errors.name && <div className="field__error">{errors.name}</div>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ct-org">Organization</label>
              <input
                id="ct-org"
                type="text"
                value={organization}
                onChange={(e) => { setOrganization(e.target.value); }}
                className="field__input"
                placeholder="NC State University"
                disabled={pending}
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
                      htmlFor={`ct-vis-${opt.id}`}
                    >
                      <input
                        id={`ct-vis-${opt.id}`}
                        className="pf__vis-input"
                        type="radio"
                        name="visibility"
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
              <label className="field__label" htmlFor="ct-desc">Description</label>
              <textarea
                id="ct-desc"
                value={description}
                onChange={(e) => { setDescription(e.target.value.slice(0, 300)); }}
                className={`field__input field__input--textarea${errors.description ? " field__input--error" : ""}`}
                placeholder="What does this team work on?"
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
              {pending ? "Creating…" : "Create team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CreateTeamModal };

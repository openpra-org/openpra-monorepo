import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import {
  type CreateProjectRequest,
  type Project,
  type RiskMode,
  CreateProjectRequestSchema,
  RISK_MODES,
  elementsForMode,
} from "interfaces-shared-types";
import { ArrowRightIcon, CloseIcon } from "./icons";
import { createProject } from "../projects/projectApi";
import "./css/newProjectModal.css";

function NewProjectModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RiskMode>("internal-events");
  const [nameErr, setNameErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => { nameRef.current?.focus(); }, 50);
    return () => { window.clearTimeout(id); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const candidate: CreateProjectRequest = { name: name.trim(), mode };
    const parsed = CreateProjectRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === "name");
      setNameErr(issue?.message ?? "Invalid name");
      return;
    }
    setSubmitting(true);
    createProject(parsed.data)
      .then((project) => { onCreated(project); })
      .catch((err: unknown) => {
        const message = (err as { message?: string }).message ?? "Could not create project";
        onError(message);
      })
      .finally(() => { setSubmitting(false); });
  }

  return (
    <div
      className="modal__backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="np-title">
        <div className="modal__head">
          <div>
            <h2 className="modal__title" id="np-title">Create a new project</h2>
            <p className="modal__sub">
              Name your analysis and choose a risk mode. You can configure technical elements inside the project.
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label className="field__label" htmlFor="np-name">Project name</label>
              <div className="field__hint">At least 3 characters. E.g. &quot;Unit 2 — Internal Events Baseline&quot;</div>
              <input
                ref={nameRef}
                id="np-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameErr) setNameErr(""); }}
                className={`field__input${nameErr ? " field__input--error" : ""}`}
                placeholder="Untitled analysis"
                autoComplete="off"
              />
              {nameErr && <div className="field__error">{nameErr}</div>}
            </div>

            <div className="field">
              <label className="field__label">Risk mode</label>
              <div className="field__hint">Determines which ASME-ANS-RA-S-1.4 technical elements are included.</div>
              <div className="modes" role="radiogroup" aria-label="Risk mode">
                {RISK_MODES.map((m) => {
                  const checked = m.id === mode;
                  const count = elementsForMode(m.id).length;
                  return (
                    <label
                      key={m.id}
                      className={`mode${checked ? " mode--checked" : ""}`}
                      htmlFor={`np-mode-${m.id}`}
                    >
                      <input
                        id={`np-mode-${m.id}`}
                        className="mode__radio-input"
                        type="radio"
                        name="risk-mode"
                        value={m.id}
                        checked={checked}
                        onChange={() => { setMode(m.id); }}
                      />
                      <span className="mode__radio" aria-hidden="true" />
                      <span className="mode__body">
                        <span className="mode__head">
                          <span className="mode__name">{m.name}</span>
                          <span className="mode__count">{count} elements</span>
                        </span>
                        <p className="mode__desc">{m.desc}</p>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="modal__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"} <ArrowRightIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { NewProjectModal };

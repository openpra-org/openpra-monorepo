import { JSX, useEffect, useRef, useState, FormEvent } from "react";
import {
  type CreateProjectRequest,
  type PageLayout,
  type Project,
  CreateProjectRequestSchema,
  CreateProjectWorkbooksRequestSchema,
  elementsForMode,
} from "interfaces-shared-types";
import { ArrowRightIcon, CloseIcon } from "./icons";
import { createProject } from "../projects/projectApi";
import { createProjectWorkbooks } from "../workbooks/workbookApi";
import { LayoutPicker } from "../projects/layoutPicker";
import type { CreationNotice } from "../projects/projectCreation";
import "./css/newProjectModal.css";

function NewProjectModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (project: Project, notice: CreationNotice) => void;
  onError: (message: string) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [workbookName, setWorkbookName] = useState("");
  const [pageLayout, setPageLayout] = useState<PageLayout>("modern");
  const [nameErr, setNameErr] = useState("");
  const [workbookErr, setWorkbookErr] = useState("");
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
    const candidate: CreateProjectRequest = { name: name.trim(), pageLayout };
    const parsed = CreateProjectRequestSchema.safeParse(candidate);
    const workbook = CreateProjectWorkbooksRequestSchema.safeParse({ name: workbookName });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === "name");
      setNameErr(issue?.message ?? "Invalid name");
    }
    if (!workbook.success) setWorkbookErr(workbook.error.issues[0]?.message ?? "Workbook name is required");
    if (!parsed.success || !workbook.success) return;
    const projectRequest = parsed.data;
    const workbookRequest = workbook.data;
    setSubmitting(true);
    createProject(projectRequest)
      .then(async (project) => {
        const notice = await createProjectWorkbooks(project.id, workbookRequest)
          .then((result): CreationNotice => ({
            workbookName: workbookRequest.name,
            failed: result.failed.map((entry) => entry.elementCode),
            unlinked: result.unlinked.map((entry) => entry.elementCode),
          }))
          .catch((): CreationNotice => ({
            workbookName: workbookRequest.name,
            failed: elementsForMode(project.mode).map((element) => element.code),
            unlinked: [],
          }));
        onCreated(project, notice);
      })
      .catch((err: Error) => {
        onError(err.message.length > 0 ? err.message : "Could not create project");
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
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="modal__body">
            <div className="field">
              <label className="field__label" htmlFor="np-name">Project name</label>
              <div className="field__hint">At least 3 characters.</div>
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
              <label className="field__label" htmlFor="np-workbook">Workbook name</label>
              <div className="field__hint">Every technical element gets a workbook with this name, linked to each other.</div>
              <input
                id="np-workbook"
                type="text"
                value={workbookName}
                onChange={(e) => { setWorkbookName(e.target.value); if (workbookErr) setWorkbookErr(""); }}
                className={`field__input${workbookErr ? " field__input--error" : ""}`}
                placeholder="Plant baseline"
                autoComplete="off"
                aria-required="true"
              />
              {workbookErr && <div className="field__error">{workbookErr}</div>}
            </div>

            <div className="field">
              <label className="field__label">Workspace layout</label>
              <div className="field__hint">You can switch this later from the project workspace.</div>
              <LayoutPicker value={pageLayout} onChange={setPageLayout} />
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

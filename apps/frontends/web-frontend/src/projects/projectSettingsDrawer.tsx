import { JSX, useEffect, useState } from "react";
import { type PageLayout, type Project } from "interfaces-shared-types";
import { CloseIcon, SettingsIcon } from "../welcome/icons";
import { updateProject } from "./projectApi";

const LAYOUTS: readonly { value: PageLayout; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "legacy", label: "Legacy" },
];

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProjectSettingsDrawer({
  project,
  onClose,
  onUpdated,
  onError,
  onRequestDelete,
}: {
  project: Project;
  onClose: () => void;
  onUpdated: (project: Project) => void;
  onError: (message: string) => void;
  onRequestDelete: () => void;
}): JSX.Element {
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const canEdit = project.myRole === "owner";

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function patch(payload: Parameters<typeof updateProject>[1], onDone?: () => void): void {
    setSaving(true);
    updateProject(project.id, payload)
      .then((updated) => { onUpdated(updated); onDone?.(); })
      .catch((err: unknown) => { onError((err as { message?: string }).message ?? "Could not update project"); })
      .finally(() => { setSaving(false); });
  }

  const nameChanged = name.trim() !== project.name && name.trim().length >= 3;
  const isArchived = project.state === "archived";

  return (
    <div className="hist__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="hist hist--wide" role="dialog" aria-modal="true" aria-label="Project settings">
        <header className="hist__head">
          <div>
            <div className="hist__eyebrow"><SettingsIcon /> Settings</div>
            <h2 className="hist__title">Project settings</h2>
            <p className="hist__sub">Manage how this project is configured.</p>
          </div>
          <button type="button" className="hist__close" onClick={onClose} aria-label="Close settings"><CloseIcon /></button>
        </header>
        <div className="hist__body">
          <div className="set-block">
            <h3 className="set-block__h">General</h3>
            <div className="set-row">
              <label className="set-row__label" htmlFor="set-name">Project name</label>
              <input
                id="set-name"
                className="set-input"
                value={name}
                disabled={!canEdit}
                onChange={(e) => { setName(e.target.value); }}
              />
            </div>
            <div className="set-row">
              <span className="set-row__label">Risk mode</span>
              <span className="chip chip--mode">{project.modeLabel}</span>
            </div>
            {canEdit && (
              <div className="set-row">
                <span className="set-row__label">Workspace layout</span>
                <div className="set-toggle" role="group" aria-label="Workspace layout">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      className={`set-toggle__opt${project.pageLayout === l.value ? " set-toggle__opt--active" : ""}`}
                      disabled={saving}
                      onClick={() => { if (project.pageLayout !== l.value) patch({ pageLayout: l.value }); }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!nameChanged || saving}
                onClick={() => { patch({ name: name.trim() }); }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>

          <div className="set-block">
            <h3 className="set-block__h">Collaborators</h3>
            {project.sharedUsers.length === 0 ? (
              <p className="collab-empty">No collaborators yet.</p>
            ) : (
              <ul className="collab-list">
                {project.sharedUsers.map((c) => (
                  <li key={c.username} className="collab-row">
                    <span className="collab-row__avatar" aria-hidden="true">{initialsOf(c.fullName)}</span>
                    <div className="collab-row__name">
                      <span>{c.fullName}</span>
                      <span className="collab-row__role">{c.username}</span>
                    </div>
                    <span className="chip chip--soft">{c.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <div className="set-block set-block--danger">
              <h3 className="set-block__h">Danger zone</h3>
              <div className="danger-row">
                <div>
                  <div className="danger-row__title">{isArchived ? "Restore project" : "Archive project"}</div>
                  <div className="danger-row__sub">
                    {isArchived ? "Move this project back to your active list." : "Hide from active projects. You can restore at any time."}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={saving}
                  onClick={() => { patch({ state: isArchived ? "active" : "archived" }); }}
                >
                  {isArchived ? "Restore" : "Archive"}
                </button>
              </div>
              <div className="danger-row">
                <div>
                  <div className="danger-row__title">Delete project</div>
                  <div className="danger-row__sub">Permanently delete the project and its analysis data. This cannot be undone.</div>
                </div>
                <button type="button" className="btn btn--danger btn--sm" onClick={onRequestDelete}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export { ProjectSettingsDrawer };

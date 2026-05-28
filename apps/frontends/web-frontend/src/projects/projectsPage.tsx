import { JSX, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Project } from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { TopBar } from "../welcome/topBar";
import { EmptyState } from "../welcome/emptyState";
import { NewProjectModal } from "../welcome/newProjectModal";
import { PinIcon, UsersIcon } from "../welcome/icons";
import {
  deleteProject,
  duplicateProject,
  getOwnedProjects,
  getSharedProjects,
  updateProject,
} from "./projectApi";
import { ProjectsHeader } from "./projectsHeader";
import { ProjectsToolbar, type ModeFilter } from "./projectsToolbar";
import { ProjectSection } from "./projectSection";
import { ProjectGrid } from "./projectGrid";
import { ProjectTable } from "./projectTable";
import { NoResultsState } from "./noResultsState";
import { PendingActionsSection } from "./pendingActionsSection";
import { ConfirmDeleteModal } from "./confirmDeleteModal";
import { RenameModal } from "./renameModal";
import { ShareProjectModal } from "./shareProjectModal";
import { type SortKey } from "./sortMenu";
import { useViewMode } from "./useViewMode";
import "./css/projectsPage.css";

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const sorted = projects.slice();
  sorted.sort((a, b) => {
    switch (key) {
      case "edited-desc":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "edited-asc":
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "progress-desc":
        return b.progress - a.progress;
      case "progress-asc":
        return a.progress - b.progress;
    }
  });
  return sorted;
}

function ProjectsPage(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  const [shared, setShared] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [sort, setSort] = useState<SortKey>("edited-desc");
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useViewMode();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [shareTarget, setShareTarget] = useState<Project | null>(null);
  const [mutating, setMutating] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOwnedProjects(), getSharedProjects()])
      .then(([owned, shared]) => {
        if (cancelled) return;
        setProjects(owned.projects);
        setShared(shared.projects);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = (err as { message?: string }).message ?? "Could not load projects";
        setLoadError(message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function flashSuccess(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "success", message });
  }

  function flashError(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message });
  }

  const archivedCount = useMemo(
    () => projects.filter((p) => p.state === "archived").length,
    [projects],
  );

  const visible = useMemo(() => {
    let list = projects.slice();
    if (!showArchived) list = list.filter((p) => p.state !== "archived");
    if (modeFilter !== "all") list = list.filter((p) => p.mode === modeFilter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.modeLabel.toLowerCase().includes(q));
    return sortProjects(list, sort);
  }, [projects, showArchived, modeFilter, query, sort]);

  const pinned = useMemo(() => visible.filter((p) => p.pinned), [visible]);
  const rest = useMemo(() => visible.filter((p) => !p.pinned), [visible]);

  const totalAfterArchiveFilter = useMemo(
    () => projects.filter((p) => showArchived || p.state !== "archived").length,
    [projects, showArchived],
  );

  const hasFilters = query.trim() !== "" || modeFilter !== "all";
  const isEmpty = !loading && projects.length === 0 && shared.length === 0;

  function clearFilters(): void {
    setQuery("");
    setModeFilter("all");
  }

  async function handleTogglePin(project: Project): Promise<void> {
    try {
      const next = await updateProject(project.id, { pinned: !project.pinned });
      setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    } catch (err) {
      flashError((err as { message?: string }).message ?? "Could not update project");
    }
  }

  async function handleToggleArchive(project: Project): Promise<void> {
    try {
      const nextState = project.state === "archived" ? "active" : "archived";
      const next = await updateProject(project.id, { state: nextState });
      setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      flashSuccess(nextState === "archived" ? "Project archived" : "Project restored");
    } catch (err) {
      flashError((err as { message?: string }).message ?? "Could not update project");
    }
  }

  async function handleDuplicate(project: Project): Promise<void> {
    try {
      const copy = await duplicateProject(project.id);
      setProjects((prev) => [copy, ...prev]);
      flashSuccess(`Duplicated as "${copy.name}"`);
    } catch (err) {
      flashError((err as { message?: string }).message ?? "Could not duplicate project");
    }
  }

  function handleRenameSubmit(name: string): void {
    if (renameTarget === null) return;
    setMutating(true);
    updateProject(renameTarget.id, { name })
      .then((next) => {
        setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
        flashSuccess("Project renamed");
        setRenameTarget(null);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not rename project");
      })
      .finally(() => { setMutating(false); });
  }

  function handleDeleteConfirm(): void {
    if (deleteTarget === null) return;
    setMutating(true);
    const target = deleteTarget;
    deleteProject(target.id)
      .then(() => {
        setProjects((prev) => prev.filter((p) => p.id !== target.id));
        flashSuccess(`Deleted "${target.name}"`);
        setDeleteTarget(null);
      })
      .catch((err: unknown) => {
        flashError((err as { message?: string }).message ?? "Could not delete project");
      })
      .finally(() => { setMutating(false); });
  }

  function handleCreated(project: Project): void {
    setProjects((prev) => [project, ...prev]);
    setNewProjectOpen(false);
    flashSuccess(`Project "${project.name}" created`);
  }

  function handleShareChanged(next: Project): void {
    setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setShareTarget(next);
  }

  function handlersFor(project: Project): {
    onOpen: () => void;
    onTogglePin: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onShare: () => void;
    onToggleArchive: () => void;
    onDelete: () => void;
  } {
    return {
      onOpen: () => { navigate(`/projects/${project.id}`); },
      onTogglePin: () => { void handleTogglePin(project); },
      onRename: () => { setRenameTarget(project); },
      onDuplicate: () => { void handleDuplicate(project); },
      onShare: () => { setShareTarget(project); },
      onToggleArchive: () => { void handleToggleArchive(project); },
      onDelete: () => { setDeleteTarget(project); },
    };
  }

  function readOnlyHandlersFor(project: Project): {
    onOpen: () => void;
    onTogglePin: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onShare: () => void;
    onToggleArchive: () => void;
    onDelete: () => void;
    readOnly: boolean;
  } {
    const noop = (): void => undefined;
    return {
      onOpen: () => { navigate(`/projects/${project.id}`); },
      onTogglePin: noop,
      onRename: noop,
      onDuplicate: noop,
      onShare: noop,
      onToggleArchive: noop,
      onDelete: noop,
      readOnly: true,
    };
  }

  const showPinnedSection = pinned.length > 0;
  const restSectionTitle = showPinnedSection ? "All projects" : null;
  const showSharedSection = shared.length > 0;

  return (
    <div className="wp wp--compact ap">
      <div className="wp__bg" />
      <TopBar />
      <main className="wp__main ap__main">
        <ProjectsHeader
          filteredCount={visible.length}
          totalCount={totalAfterArchiveFilter}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          onNewProject={() => { setNewProjectOpen(true); }}
          isEmpty={isEmpty}
        />

        {loadError && <p className="ap__load-error">{loadError}</p>}

        <PendingActionsSection />

        {!loading && !loadError && !isEmpty && (
          <ProjectsToolbar
            query={query}
            setQuery={setQuery}
            modeFilter={modeFilter}
            setModeFilter={setModeFilter}
            sort={sort}
            setSort={setSort}
            view={view}
            setView={setView}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            archivedCount={archivedCount}
          />
        )}

        {!loading && !loadError && (
          isEmpty ? (
            <EmptyState onCreate={() => { setNewProjectOpen(true); }} />
          ) : projects.length > 0 && visible.length === 0 ? (
            <NoResultsState onClear={clearFilters} />
          ) : (
            <>
              {showPinnedSection && (
                <ProjectSection title="Pinned" count={pinned.length} icon={<PinIcon />}>
                  {view === "grid" ? (
                    <ProjectGrid projects={pinned} cardHandlers={handlersFor} />
                  ) : (
                    <ProjectTable projects={pinned} rowHandlers={handlersFor} />
                  )}
                </ProjectSection>
              )}
              {rest.length > 0 && (
                <ProjectSection title={restSectionTitle} count={rest.length}>
                  {view === "grid" ? (
                    <ProjectGrid projects={rest} cardHandlers={handlersFor} />
                  ) : (
                    <ProjectTable projects={rest} rowHandlers={handlersFor} />
                  )}
                </ProjectSection>
              )}
              {showSharedSection && (
                <ProjectSection title="Shared with me" count={shared.length} icon={<UsersIcon />}>
                  {view === "grid" ? (
                    <ProjectGrid projects={shared} cardHandlers={readOnlyHandlersFor} />
                  ) : (
                    <ProjectTable projects={shared} rowHandlers={readOnlyHandlersFor} />
                  )}
                </ProjectSection>
              )}
            </>
          )
        )}
      </main>

      {newProjectOpen && (
        <NewProjectModal
          onClose={() => { setNewProjectOpen(false); }}
          onCreated={handleCreated}
          onError={flashError}
        />
      )}

      {renameTarget !== null && (
        <RenameModal
          initialName={renameTarget.name}
          onCancel={() => { if (!mutating) setRenameTarget(null); }}
          onSubmit={handleRenameSubmit}
          pending={mutating}
        />
      )}

      {deleteTarget !== null && (
        <ConfirmDeleteModal
          project={deleteTarget}
          onCancel={() => { if (!mutating) setDeleteTarget(null); }}
          onConfirm={handleDeleteConfirm}
          pending={mutating}
        />
      )}

      {shareTarget !== null && (
        <ShareProjectModal
          project={shareTarget}
          onClose={() => { setShareTarget(null); }}
          onChanged={handleShareChanged}
          onError={flashError}
          onSuccess={flashSuccess}
        />
      )}
    </div>
  );
}

export { ProjectsPage };

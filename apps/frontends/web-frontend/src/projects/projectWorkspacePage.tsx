import { JSX, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type Project, type Workbook } from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import { getProject, updateProject, duplicateProject, deleteProject } from "./projectApi";
import { ProjectHeader } from "./projectHeader";
import { ElementsSection } from "./elementsSection";
import { WorkspaceLegacy } from "./workspaceLegacy";
import { HistoryDrawer } from "./historyDrawer";
import { ProjectSettingsDrawer } from "./projectSettingsDrawer";
import { RenameModal } from "./renameModal";
import { ConfirmDeleteModal } from "./confirmDeleteModal";
import { ShareProjectModal } from "./shareProjectModal";
import { WorkbooksPanel } from "../workbooks/workbooksPanel";
import { LoadExampleModal } from "../workbooks/exampleWorkbookModal";
import { getProjectExampleInfo, generateProjectExamples, type ProjectExampleInfo } from "../workbooks/workbookApi";
import "./css/projectWorkspace.css";

function ProjectWorkspacePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wbElement, setWbElement] = useState<{ code: string; name: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [exampleInfo, setExampleInfo] = useState<ProjectExampleInfo | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    setLoading(true);
    getProject(id)
      .then((p) => { if (!cancelled) setProject(p); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as { message?: string }).message ?? "Could not load project");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    getProjectExampleInfo(id)
      .then((info) => { if (!cancelled) setExampleInfo(info); })
      .catch(() => { if (!cancelled) setExampleInfo(null); });
    return () => { cancelled = true; };
  }, [id]);

  function flashError(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "danger", message });
  }
  function flashSuccess(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "success", message });
  }
  function flashInfo(message: string): void {
    addToast({ id: crypto.randomUUID(), type: "info", message });
  }

  function handleOpenWorkbook(workbook: Workbook): void {
    if (workbook.elementCode === "POS") {
      navigate(`/pos-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "IE") {
      navigate(`/ie-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "ES") {
      navigate(`/es-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "SC") {
      navigate(`/sc-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "SY") {
      navigate(`/sy-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "HRA") {
      navigate(`/hr-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "DA") {
      navigate(`/da-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "ESQ") {
      navigate(`/esq-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "MS") {
      navigate(`/ms-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "RC") {
      navigate(`/rc-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "RI") {
      navigate(`/ri-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "S") {
      navigate(`/seismic-pra-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "FL") {
      navigate(`/internal-flood-pra-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "F") {
      navigate(`/internal-fire-pra-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "HS") {
      navigate(`/hazards-screening-analysis-workbooks/${workbook.id}`);
      return;
    }
    if (workbook.elementCode === "W") {
      navigate(`/high-winds-pra-workbooks/${workbook.id}`);
      return;
    }
    flashInfo(`"${workbook.name}" — workflow coming soon`);
  }

  function togglePin(): void {
    if (project === null) return;
    updateProject(project.id, { pinned: !project.pinned })
      .then(setProject)
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not update project"); });
  }

  function handleRename(name: string): void {
    if (project === null) return;
    setMutating(true);
    updateProject(project.id, { name })
      .then((next) => { setProject(next); setRenameOpen(false); flashSuccess("Project renamed"); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not rename project"); })
      .finally(() => { setMutating(false); });
  }

  function handleDuplicate(): void {
    if (project === null) return;
    duplicateProject(project.id)
      .then((copy) => { flashSuccess(`Duplicated as "${copy.name}"`); navigate(`/projects/${copy.id}`); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not duplicate project"); });
  }

  function handleDelete(): void {
    if (project === null) return;
    setMutating(true);
    const name = project.name;
    deleteProject(project.id)
      .then(() => { flashSuccess(`Deleted "${name}"`); navigate("/projects"); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not delete project"); })
      .finally(() => { setMutating(false); });
  }

  function toggleArchive(): void {
    if (project === null) return;
    updateProject(project.id, { state: project.state === "archived" ? "active" : "archived" })
      .then((next) => { setProject(next); flashSuccess(next.state === "archived" ? "Project archived" : "Project restored"); })
      .catch((err: unknown) => { flashError((err as { message?: string }).message ?? "Could not update project"); });
  }

  const isLegacy = project !== null && project.pageLayout === "legacy";

  return (
    <div className={`wp wp--compact pp pp--bare${isLegacy ? " pp--legacy" : ""}`}>
      {(loading || loadError !== null || project === null) && (
        <main className="wp__main pp__main">
          <button type="button" className="phead__back" onClick={() => { navigate("/projects"); }}>← All projects</button>
          {loading && <p className="pws-status">Loading project…</p>}
          {loadError !== null && <p className="pws-status pws-status--error">{loadError}</p>}
        </main>
      )}

      {!loading && loadError === null && project !== null && (
        isLegacy ? (
          <WorkspaceLegacy
            project={project}
            onBack={() => { navigate("/projects"); }}
            onOpenHistory={() => { setHistoryOpen(true); }}
            onOpenSettings={() => { setSettingsOpen(true); }}
            onOpenWorkbook={handleOpenWorkbook}
            onError={flashError}
            onTogglePin={togglePin}
            onRename={() => { setRenameOpen(true); }}
            onDuplicate={handleDuplicate}
            onShare={() => { setShareOpen(true); }}
            onToggleArchive={toggleArchive}
            onDelete={() => { setDeleteOpen(true); }}
          />
        ) : (
          <main className="wp__main pp__main">
            <ProjectHeader
              project={project}
              onBack={() => { navigate("/projects"); }}
              onOpenHistory={() => { setHistoryOpen(true); }}
              onOpenSettings={() => { setSettingsOpen(true); }}
              onTogglePin={togglePin}
              onRename={() => { setRenameOpen(true); }}
              onDuplicate={handleDuplicate}
              onShare={() => { setShareOpen(true); }}
              onToggleArchive={toggleArchive}
              onDelete={() => { setDeleteOpen(true); }}
            />
            <div className="pp__pane">
              <ElementsSection
                project={project}
                onOpenElement={(element) => { setWbElement(element); }}
                onGenerateExamples={project.myRole !== "viewer" && exampleInfo !== null && exampleInfo.elements.length > 0 ? () => { setGenerateOpen(true); } : undefined}
              />
            </div>
          </main>
        )
      )}

      {generateOpen && project !== null && exampleInfo !== null && (
        <LoadExampleModal
          exampleName="project"
          title="Generate example workbooks"
          intro={`This will create one example workbook per selected reactor in each covered technical element (${exampleInfo.elements.join(", ")}). If a reserved example workbook such as "IE Workbook 1" already exists in this project, it is repopulated instead, so no duplicates are created.`}
          confirmLabel="Generate examples"
          exampleOptions={exampleInfo.options}
          onCancel={() => { setGenerateOpen(false); }}
          onConfirm={async (exampleId) => {
            const result = await generateProjectExamples(project.id, exampleId);
            const created = result.generated.filter((g) => g.action === "created").length;
            const repopulated = result.generated.filter((g) => g.action === "repopulated").length;
            const skipped = result.generated.filter((g) => g.action === "skipped");
            flashSuccess(`Example workbooks ready: ${String(created)} created, ${String(repopulated)} repopulated`);
            if (skipped.length > 0) {
              flashError(`Skipped ${String(skipped.length)}: ${skipped.map((g) => g.workbookName).join(", ")}`);
            }
            const refreshed = await getProject(project.id);
            setProject(refreshed);
            setGenerateOpen(false);
          }}
        />
      )}

      {wbElement !== null && project !== null && (
        <WorkbooksPanel
          projectId={project.id}
          element={wbElement}
          readOnly={project.myRole === "viewer"}
          onClose={() => { setWbElement(null); }}
          onOpenWorkbook={handleOpenWorkbook}
          onError={flashError}
        />
      )}

      {historyOpen && project !== null && (
        <HistoryDrawer projectId={project.id} onClose={() => { setHistoryOpen(false); }} onError={flashError} />
      )}

      {settingsOpen && project !== null && (
        <ProjectSettingsDrawer
          project={project}
          onClose={() => { setSettingsOpen(false); }}
          onUpdated={setProject}
          onError={flashError}
          onRequestDelete={() => { setDeleteOpen(true); }}
        />
      )}

      {renameOpen && project !== null && (
        <RenameModal
          initialName={project.name}
          onCancel={() => { if (!mutating) setRenameOpen(false); }}
          onSubmit={handleRename}
          pending={mutating}
        />
      )}

      {shareOpen && project !== null && (
        <ShareProjectModal
          project={project}
          onClose={() => { setShareOpen(false); }}
          onChanged={setProject}
          onError={flashError}
          onSuccess={flashSuccess}
        />
      )}

      {deleteOpen && project !== null && (
        <ConfirmDeleteModal
          project={project}
          onCancel={() => { if (!mutating) setDeleteOpen(false); }}
          onConfirm={handleDelete}
          pending={mutating}
        />
      )}
    </div>
  );
}

export { ProjectWorkspacePage };

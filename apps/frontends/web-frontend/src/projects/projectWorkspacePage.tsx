import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { type Project, type ProjectWorkbooksResult, type Workbook } from "interfaces-shared-types";
import { useToast } from "../toast/toastProvider";
import {
  addProjectCollaborator,
  deleteProject,
  duplicateProject,
  getProject,
  getProjectCollaborators,
  removeProjectCollaborator,
  updateProject,
  updateProjectCollaborator,
} from "./projectApi";
import { WorkbookShareModal, type WorkbookShareActions } from "../workbooks/workbookShareModal";
import { NO_WORKBOOK_ROLE_MESSAGE, canOpenWorkbook } from "../workbooks/workbookAccess";
import { ProjectHeader } from "./projectHeader";
import { ElementsSection } from "./elementsSection";
import { WorkspaceLegacy } from "./workspaceLegacy";
import { HistoryDrawer } from "./historyDrawer";
import { ProjectSettingsDrawer } from "./projectSettingsDrawer";
import { RenameModal } from "./renameModal";
import { ConfirmDeleteModal } from "./confirmDeleteModal";
import { ShareProjectModal } from "./shareProjectModal";
import { LinkedWorkbooksModal } from "./linkedWorkbooksModal";
import { WorkbooksPanel } from "../workbooks/workbooksPanel";
import { LoadExampleModal } from "../workbooks/exampleWorkbookModal";
import { getProjectExampleInfo, generateProjectExamples, type ProjectExampleInfo, type ProjectExampleOption } from "../workbooks/workbookApi";
import { CreationNoticeSchema, creationNoticeText, type CreationNotice } from "./projectCreation";
import "./css/projectWorkspace.css";

const WORKBOOK_PAGES = new Map<string, string>([
  ["POS", "pos-workbooks"],
  ["IE", "ie-workbooks"],
  ["ES", "es-workbooks"],
  ["SC", "sc-workbooks"],
  ["SY", "sy-workbooks"],
  ["HRA", "hr-workbooks"],
  ["DA", "da-workbooks"],
  ["ESQ", "esq-workbooks"],
  ["MS", "ms-workbooks"],
  ["RC", "rc-workbooks"],
  ["RI", "ri-workbooks"],
  ["S", "seismic-pra-workbooks"],
  ["FL", "internal-flood-pra-workbooks"],
  ["F", "internal-fire-pra-workbooks"],
  ["HS", "hazards-screening-analysis-workbooks"],
  ["W", "high-winds-pra-workbooks"],
  ["XF", "external-flood-pra-workbooks"],
  ["O", "other-hazards-pra-workbooks"],
]);

function generationIntro(option: ProjectExampleOption): string {
  const perElement = option.id === "both" ? "one example workbook per reactor" : "one example workbook";
  return `This will create ${perElement} in each of ${String(option.elements.length)} technical elements, all linked to each other. If a reserved example workbook such as "IE Workbook 1" already exists in this project, it is repopulated instead, so no duplicates are created.`;
}

function ProjectWorkspacePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const creation = CreationNoticeSchema.safeParse(location.state);
  const creationText = creation.success ? creationNoticeText(creation.data) : undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wbElement, setWbElement] = useState<{ code: string; name: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [exampleInfo, setExampleInfo] = useState<ProjectExampleInfo | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [workbooksOpen, setWorkbooksOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  const opening = useRef(false);

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

  const sharingActions = useMemo((): WorkbookShareActions | null => {
    if (id === undefined) return null;
    return {
      load: () => getProjectCollaborators(id),
      add: (identifier, access) => addProjectCollaborator(id, identifier, access),
      update: (username, access) => updateProjectCollaborator(id, username, access),
      remove: (username) => removeProjectCollaborator(id, username),
    };
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
    const page = WORKBOOK_PAGES.get(workbook.elementCode);
    if (page === undefined) {
      flashInfo(`"${workbook.name}" — workflow coming soon`);
      return;
    }
    if (opening.current) return;
    opening.current = true;
    const path = `/${page}/${workbook.id}`;
    canOpenWorkbook(workbook.id)
      .then((allowed) => {
        if (allowed) navigate(path);
        else flashInfo(NO_WORKBOOK_ROLE_MESSAGE);
      })
      .catch(() => { navigate(path); })
      .finally(() => { opening.current = false; });
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

  function handleWorkbooksCreated(workbookName: string, result: ProjectWorkbooksResult): void {
    setWorkbooksOpen(false);
    setGeneration((count) => count + 1);
    const created = result.workbooks.length;
    if (created > 0) flashSuccess(`Created "${workbookName}" in ${String(created)} technical element${created === 1 ? "" : "s"}`);
    const notice: CreationNotice = {
      workbookName,
      failed: result.failed.map((entry) => entry.elementCode),
      unlinked: result.unlinked.map((entry) => entry.elementCode),
    };
    if (creationNoticeText(notice) !== undefined) navigate(location.pathname, { replace: true, state: notice });
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
            onOpenSharing={project.myRole === "owner" ? () => { setSharingOpen(true); } : undefined}
            onToggleArchive={toggleArchive}
            onDelete={() => { setDeleteOpen(true); }}
            onNewLinkedWorkbooks={project.myRole !== "viewer" ? () => { setWorkbooksOpen(true); } : undefined}
            onGenerateExamples={project.myRole !== "viewer" && exampleInfo !== null && exampleInfo.elements.length > 0 ? () => { setGenerateOpen(true); } : undefined}
            generation={generation}
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
              onOpenSharing={project.myRole === "owner" ? () => { setSharingOpen(true); } : undefined}
              onToggleArchive={toggleArchive}
              onDelete={() => { setDeleteOpen(true); }}
            />
            <div className="pp__pane">
              <ElementsSection
                project={project}
                onOpenElement={(element) => { setWbElement(element); }}
                onNewLinkedWorkbooks={project.myRole !== "viewer" ? () => { setWorkbooksOpen(true); } : undefined}
                onGenerateExamples={project.myRole !== "viewer" && exampleInfo !== null && exampleInfo.elements.length > 0 ? () => { setGenerateOpen(true); } : undefined}
              />
            </div>
          </main>
        )
      )}

      {creationText !== undefined && (
        <div className="pws-notice" role="alert">
          <span>{creationText}</span>
          <button type="button" className="pws-notice__dismiss" onClick={() => { navigate(location.pathname, { replace: true, state: null }); }}>Dismiss</button>
        </div>
      )}

      {generateOpen && project !== null && exampleInfo !== null && (
        <LoadExampleModal
          exampleName="project"
          title="Generate example workbooks"
          intro={`This will create one example workbook per selected reactor in each covered technical element. If a reserved example workbook such as "IE Workbook 1" already exists in this project, it is repopulated instead, so no duplicates are created.`}
          hint="Useful for exploring the workflow without entering plant data first."
          exampleIntros={Object.fromEntries(exampleInfo.options.map((option) => [option.id, generationIntro(option)]))}
          confirmLabel="Generate examples"
          choiceLabel="Example"
          exampleOptions={exampleInfo.options.map((option) => ({ id: option.id, label: option.label, group: option.partial ? "Partial examples" : "Complete examples" }))}
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
            setGeneration((count) => count + 1);
            setGenerateOpen(false);
          }}
        />
      )}

      {workbooksOpen && project !== null && (
        <LinkedWorkbooksModal
          projectId={project.id}
          onCancel={() => { setWorkbooksOpen(false); }}
          onCreated={handleWorkbooksCreated}
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

      {sharingOpen && project !== null && sharingActions !== null && (
        <WorkbookShareModal title={`Share "${project.name}"`} actions={sharingActions} onClose={() => { setSharingOpen(false); }} />
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

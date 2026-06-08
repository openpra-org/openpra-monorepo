import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { getProject } from "../projects/projectApi";
import {
  getPosWorkbook,
  postPosComment,
  patchPosComment,
  submitPosForReview,
  signPosReview,
  signPosApproval,
  requestPosRevision,
  loadPosExample,
  unloadPosExample,
  listPosDocuments,
  uploadPosDocument,
  deletePosDocument,
  getPosDocumentDownload,
  type PosWorkbookRoleName,
  type PosDocumentEntry,
} from "./posWorkbookApi";
import { PosWorkbench } from "./posDemoPage";
import { PosWorkbookProvider, type PosWorkbookData } from "./posWorkbookContext";
import { PosLoadExampleModal } from "./posLoadExampleModal";
import { PosUnloadExampleModal } from "./posUnloadExampleModal";
import { type PosPersona } from "./posViewData";
import { useMefPatch } from "./useMefPatch";
import { useAuth } from "../auth/AuthContext";
import { WorkbookApprovalTable } from "../workbooks/workbookApprovalTable";
import { WorkbookSignCard } from "../workbooks/workbookSignCard";
import { WorkbookRoster } from "../workbooks/workbookRoster";
import { WorkbookRolesModal } from "../workbooks/workbookRolesModal";

interface ExampleSlugResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface PosBundleResponse {
  pos: ExampleSlugResponse;
  configurationControl: ExampleSlugResponse;
  newlyDevelopedMethods: ExampleSlugResponse[];
}

const STEP_SR_HINT: Record<string, string | undefined> = {
  setup: undefined,
  documents: undefined,
  evolutions: "POS-A1",
  states: "POS-A2",
  interviews: "POS-A3",
  screening: "POS-A4",
  grouping: "POS-A5",
  frequency: "POS-A8",
  decayheat: "POS-A9",
};

function PosWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [approvalRefresh, setApprovalRefresh] = useState<number>(0);
  const [data, setData] = useState<PosWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<PosWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [documents, setDocuments] = useState<PosDocumentEntry[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const workbookName = data?.pos.name ?? "";
  const workbookVersion = data?.pos.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getPosWorkbook(id),
      fetchJson<PosBundleResponse>("/api/example-workbooks/pos-bundle"),
      listPosDocuments(id).catch(() => [] as PosDocumentEntry[]),
    ])
      .then(async ([workbook, bundle, docs]) => {
        if (cancelled) return;
        setData({
          pos: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
        });
        setMyRoles(workbook.myRoles);
        setHasPreviousMef(workbook.hasPreviousMef);
        setDocuments(docs);
        setProjectId(workbook.projectId);
        try {
          const project = await getProject(workbook.projectId);
          if (!cancelled) setProjectName(project.name);
        } catch {
          if (!cancelled) setProjectName("");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load this POS workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updatePos = useCallback((pos: PlantOperatingStatesAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, pos }));
  }, []);

  const onPatchError = useCallback((message: string): void => {
    console.error("MEF patch failed:", message);
  }, []);

  const { patch: mefPatch, patchDebounced: mefPatchDebounced } = useMefPatch(
    id ?? "",
    data?.pos ?? null,
    updatePos,
    onPatchError,
  );

  const refreshDocuments = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    const docs = await listPosDocuments(id);
    setDocuments(docs);
  }, [id]);

  const availablePersonas = useMemo<PosPersona[]>(() => {
    const out: PosPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<PosPersona>("preparer");

  useEffect(() => {
    if (availablePersonas.length === 0) return;
    if (!availablePersonas.includes(persona)) setPersona(availablePersonas[0]);
  }, [availablePersonas, persona]);

  const actions = useMemo(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string): Promise<void> => {
        const pos = await postPosComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] });
        updatePos(pos);
      },
      toggleResolve: async (commentId: string, nextResolved: boolean): Promise<void> => {
        const pos = await patchPosComment(id, commentId, { resolved: nextResolved });
        updatePos(pos);
      },
      submitForReview: async (): Promise<void> => {
        const pos = await submitPosForReview(id);
        updatePos(pos);
      },
      signReview: async (): Promise<void> => {
        const pos = await signPosReview(id);
        updatePos(pos);
      },
      signApproval: async (): Promise<void> => {
        const pos = await signPosApproval(id);
        updatePos(pos);
      },
      requestRevision: async (note: string): Promise<void> => {
        const pos = await requestPosRevision(id, note);
        updatePos(pos);
      },
    };
  }, [id, updatePos]);

  const documentsBundle = useMemo(() => {
    if (id === undefined) return undefined;
    const wfState = data?.pos.workflowState ?? "DRAFT";
    const canUpload = (myRoles.includes("preparer") || myRoles.includes("co_preparer")) && (wfState === "DRAFT" || wfState === "REVISION_REQUIRED");
    return {
      list: documents,
      canUpload,
      onUpload: async (file: File): Promise<void> => {
        await uploadPosDocument(id, file);
        await refreshDocuments();
      },
      onDelete: async (documentId: string): Promise<void> => {
        await deletePosDocument(id, documentId);
        await refreshDocuments();
      },
      onDownload: async (documentId: string): Promise<void> => {
        const { url } = await getPosDocumentDownload(id, documentId);
        window.open(url, "_blank", "noopener");
      },
    };
  }, [id, documents, myRoles, data?.pos.workflowState, refreshDocuments]);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null || id === undefined) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading workbook…</p></main></div>;
  }

  if (availablePersonas.length === 0) {
    return (
      <div className="posw">
        <main className="posmain">
          <p className="pws-status">You do not have any role on this workbook yet. Ask the workbook owner to assign you a preparer, reviewer, or approver role.</p>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setRolesOpen(true)}>View roles</button>
        </main>
        {rolesOpen && (
          <WorkbookRolesModal
            workbookId={id}
            onClose={() => setRolesOpen(false)}
            onChanged={(res) => setMyRoles(res.myRoles)}
          />
        )}
      </div>
    );
  }

  const workflowState = data.pos.workflowState;
  const canLoadExample = (myRoles.includes("preparer") || myRoles.includes("co_preparer")) && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <PosWorkbookProvider data={data}>
      <PosWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onLoadExample={canLoadExample ? () => setLoadExOpen(true) : undefined}
        onUnloadExample={canUnloadExample ? () => setUnloadExOpen(true) : undefined}
        actions={actions}
        documents={documentsBundle}
        headerMeta={{
          projectName,
          workbookName,
          workbookVersion,
          plantIdentity: data.pos.metadata.plantIdentity !== undefined
            ? {
                name: data.pos.metadata.plantIdentity.name,
                type: data.pos.metadata.plantIdentity.reactorType,
                power: data.pos.metadata.plantIdentity.thermalPower,
                vendor: data.pos.metadata.plantIdentity.vendor,
              }
            : undefined,
        }}
        mefPatch={mefPatch}
        mefPatchDebounced={mefPatchDebounced}
        renderApprovalTable={() => (
          <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />
        )}
        renderSignCard={() => (
          <WorkbookSignCard
            workbookId={id}
            actingUsername={actingUsername}
            currentPersona={persona}
            myOpenComments={data.pos.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => (
          <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />
        )}
      />
      {rolesOpen && (
        <WorkbookRolesModal
          workbookId={id}
          onClose={() => setRolesOpen(false)}
          onChanged={(res) => setMyRoles(res.myRoles)}
        />
      )}
      {loadExOpen && (
        <PosLoadExampleModal
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadPosExample(id);
            updatePos(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            await refreshDocuments();
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <PosUnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadPosExample(id);
            updatePos(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </PosWorkbookProvider>
  );
}

export { PosWorkbookPage };

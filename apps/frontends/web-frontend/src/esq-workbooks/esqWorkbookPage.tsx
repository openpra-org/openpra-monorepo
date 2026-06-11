import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { getProject } from "../projects/projectApi";
import { WorkbookRolesModal } from "../workbooks/workbookRolesModal";
import { WorkbookApprovalTable } from "../workbooks/workbookApprovalTable";
import { WorkbookSignCard } from "../workbooks/workbookSignCard";
import { WorkbookRoster } from "../workbooks/workbookRoster";
import { postWorkbookComment, patchWorkbookComment, submitWorkbookForReview, requestWorkbookRevision } from "../workbooks/workbookReviewApi";
import { useAuth } from "../auth/AuthContext";
import {
  getEsqWorkbook,
  loadEsqExample,
  unloadEsqExample,
  type EsqWorkbookRoleName,
} from "./esqWorkbookApi";
import { EsqWorkbench, type EsqWorkbenchActions } from "./esqWorkbench";
import { EsqWorkbookProvider, type EsqWorkbookData } from "./esqWorkbookContext";
import { EsqLoadExampleModal, EsqUnloadExampleModal } from "./esqLoadExampleModal";
import { EsqDocumentsCard } from "./esqDocumentsCard";
import { type EsqPersona } from "./esqViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "ESQ-A2",
  integrate: "ESQ-A1",
  solve: "ESQ-B3",
  logic: "ESQ-B9",
  depend: "ESQ-C2",
  barriers: "ESQ-C10",
  results: "ESQ-D6",
  uncert: "ESQ-E1",
};

interface EsqExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface EsqBundleResponse {
  esq: EsqExampleResponse;
  configurationControl: EsqExampleResponse;
  newlyDevelopedMethods: EsqExampleResponse[];
}

function EsqWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<EsqWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<EsqWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.esq.name ?? "";
  const workbookVersion = data?.esq.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getEsqWorkbook(id),
      fetchJson<EsqBundleResponse>("/api/example-workbooks/esq-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          esq: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
        });
        setMyRoles(workbook.myRoles);
        setHasPreviousMef(workbook.hasPreviousMef);
        try {
          const project = await getProject(workbook.projectId);
          if (!cancelled) setProjectName(project.name);
        } catch {
          if (!cancelled) setProjectName("");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load this ESQ workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateEsq = useCallback((esq: EventSequenceQuantification): void => {
    setData((prev) => (prev === null ? prev : { ...prev, esq }));
  }, []);

  const actions = useMemo<EsqWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const esq = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as EventSequenceQuantification;
        updateEsq(esq);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const esq = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as EventSequenceQuantification;
        updateEsq(esq);
      },
      submitForReview: async (): Promise<void> => {
        const esq = await submitWorkbookForReview(id) as EventSequenceQuantification;
        updateEsq(esq);
      },
      requestRevision: async (note): Promise<void> => {
        const esq = await requestWorkbookRevision(id, note) as EventSequenceQuantification;
        updateEsq(esq);
      },
    };
  }, [id, updateEsq]);

  const availablePersonas = useMemo<EsqPersona[]>(() => {
    const out: EsqPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<EsqPersona>("preparer");
  useEffect(() => {
    if (availablePersonas.length === 0) return;
    if (!availablePersonas.includes(persona)) setPersona(availablePersonas[0]);
  }, [availablePersonas, persona]);

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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as EsqWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.esq.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <EsqWorkbookProvider data={data}>
      <EsqWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onStageChange={(s) => {
          const newMef = { ...data.esq, plantStage: s === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" } as EventSequenceQuantification;
          updateEsq(newMef);
        }}
        onLoadExample={canLoadExample ? () => setLoadExOpen(true) : undefined}
        onUnloadExample={canUnloadExample ? () => setUnloadExOpen(true) : undefined}
        actions={actions}
        headerMeta={{ projectName, workbookName, workbookVersion }}
        renderApprovalTable={() => <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />}
        renderSignCard={() => (
          <WorkbookSignCard
            workbookId={id}
            actingUsername={actingUsername}
            currentPersona={persona}
            myOpenComments={data.esq.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <EsqDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as EsqWorkbookRoleName[])} />}
      {loadExOpen && (
        <EsqLoadExampleModal
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadEsqExample(id);
            updateEsq(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <EsqUnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadEsqExample(id);
            updateEsq(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </EsqWorkbookProvider>
  );
}

export { EsqWorkbookPage };

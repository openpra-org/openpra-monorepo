import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
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
  getRiWorkbook,
  loadRiExample,
  unloadRiExample,
  type RiWorkbookRoleName,
} from "./riWorkbookApi";
import { RiWorkbench, type RiWorkbenchActions } from "./riWorkbench";
import { RiWorkbookProvider, type RiWorkbookData } from "./riWorkbookContext";
import { useRiMefPatch } from "./useRiMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { RiDocumentsCard } from "./riDocumentsCard";
import { type RiPersona } from "./riViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  converge: "RI-B1",
  criteria: "RI-A1",
  integrate: "RI-B2",
  aggregate: "RI-B3",
  uncertainty: "RI-C1",
  feedback: "RI-D1",
};

interface RiExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface RiBundleResponse {
  ri: RiExampleResponse;
  configurationControl: RiExampleResponse;
  newlyDevelopedMethods: RiExampleResponse[];
}

function RiWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<RiWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<RiWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.ri.name ?? "";
  const workbookVersion = data?.ri.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getRiWorkbook(id),
      fetchJson<RiBundleResponse>("/api/example-workbooks/ri-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          ri: workbook.mef,
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
        setError((err as { message?: string }).message ?? "Could not load this RI workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateRi = useCallback((ri: RiskIntegration): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ri }));
  }, []);

  const handleSaveOk = useCallback((): void => { setSaveError(null); }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const { patchDebounced } = useRiMefPatch(id ?? "", data?.ri ?? null, handleSaveOk, handleSaveErr);
  const mutateRi = useCallback((mutator: (ri: RiskIntegration) => RiskIntegration): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ri: mutator(prev.ri) }));
    patchDebounced(mutator);
  }, [patchDebounced]);

  const actions = useMemo<RiWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const ri = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as RiskIntegration;
        updateRi(ri);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const ri = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as RiskIntegration;
        updateRi(ri);
      },
      submitForReview: async (): Promise<void> => {
        const ri = await submitWorkbookForReview(id) as RiskIntegration;
        updateRi(ri);
      },
      requestRevision: async (note): Promise<void> => {
        const ri = await requestWorkbookRevision(id, note) as RiskIntegration;
        updateRi(ri);
      },
    };
  }, [id, updateRi]);

  const availablePersonas = useMemo<RiPersona[]>(() => {
    const out: RiPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<RiPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as RiWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.ri.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <RiWorkbookProvider data={data} editable={editable} mutateRi={mutateRi}>
      <RiWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
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
            myOpenComments={data.ri.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <RiDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as RiWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="RI"
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadRiExample(id);
            updateRi(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadRiExample(id);
            updateRi(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </RiWorkbookProvider>
  );
}

export { RiWorkbookPage };

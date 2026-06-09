import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
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
  getScWorkbook,
  loadScExample,
  unloadScExample,
  type ScWorkbookRoleName,
} from "./scWorkbookApi";
import { ScWorkbench, type ScWorkbenchActions } from "./scWorkbench";
import { ScWorkbookProvider, type ScWorkbookData } from "./scWorkbookContext";
import { ScLoadExampleModal, ScUnloadExampleModal } from "./scLoadExampleModal";
import { ScDocumentsCard } from "./scDocumentsCard";
import { type ScPersona } from "./scViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "SC-A4",
  stable: "SC-A1",
  criteria: "SC-A5",
  mission: "SC-A7",
  bases: "SC-B1",
  passive: "SC-B5",
  consistency: "SC-A9",
};

interface ScExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface ScBundleResponse {
  sc: ScExampleResponse;
  configurationControl: ScExampleResponse;
  newlyDevelopedMethods: ScExampleResponse[];
}

function ScWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<ScWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<ScWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.sc.name ?? "";
  const workbookVersion = data?.sc.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getScWorkbook(id),
      fetchJson<ScBundleResponse>("/api/example-workbooks/sc-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          sc: workbook.mef,
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
        setError((err as { message?: string }).message ?? "Could not load this SC workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateSc = useCallback((sc: SuccessCriteriaDevelopment): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sc }));
  }, []);

  const actions = useMemo<ScWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const sc = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as SuccessCriteriaDevelopment;
        updateSc(sc);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const sc = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as SuccessCriteriaDevelopment;
        updateSc(sc);
      },
      submitForReview: async (): Promise<void> => {
        const sc = await submitWorkbookForReview(id) as SuccessCriteriaDevelopment;
        updateSc(sc);
      },
      requestRevision: async (note): Promise<void> => {
        const sc = await requestWorkbookRevision(id, note) as SuccessCriteriaDevelopment;
        updateSc(sc);
      },
    };
  }, [id, updateSc]);

  const availablePersonas = useMemo<ScPersona[]>(() => {
    const out: ScPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<ScPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as ScWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.sc.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <ScWorkbookProvider data={data}>
      <ScWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onStageChange={(s) => {
          const newMef = { ...data.sc, plantStage: s === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" } as SuccessCriteriaDevelopment;
          updateSc(newMef);
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
            myOpenComments={data.sc.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <ScDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as ScWorkbookRoleName[])} />}
      {loadExOpen && (
        <ScLoadExampleModal
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadScExample(id);
            updateSc(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <ScUnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadScExample(id);
            updateSc(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </ScWorkbookProvider>
  );
}

export { ScWorkbookPage };

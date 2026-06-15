import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
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
  getRcWorkbook,
  loadRcExample,
  unloadRcExample,
  type RcWorkbookRoleName,
} from "./rcWorkbookApi";
import { RcWorkbench, type RcWorkbenchActions } from "./rcWorkbench";
import { RcWorkbookProvider, type RcWorkbookData } from "./rcWorkbookContext";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { RcDocumentsCard } from "./rcDocumentsCard";
import { type RcPersona } from "./rcViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  handoff: "RCRE-A1",
  protective: "RCPA-A1",
  weather: "RCME-A1",
  dispersion: "RCAD-A1",
  dose: "RCDO-A1",
  health: "RCHE-A1",
  economics: "RCEC-A1",
  quantify: "RCQ-A3",
};

interface RcExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface RcBundleResponse {
  rc: RcExampleResponse;
  configurationControl: RcExampleResponse;
  newlyDevelopedMethods: RcExampleResponse[];
}

function RcWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<RcWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<RcWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.rc.name ?? "";
  const workbookVersion = data?.rc.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getRcWorkbook(id),
      fetchJson<RcBundleResponse>("/api/example-workbooks/rc-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          rc: workbook.mef,
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
        setError((err as { message?: string }).message ?? "Could not load this RC workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateRc = useCallback((rc: RadiologicalConsequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, rc }));
  }, []);

  const actions = useMemo<RcWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const rc = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const rc = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      submitForReview: async (): Promise<void> => {
        const rc = await submitWorkbookForReview(id) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      requestRevision: async (note): Promise<void> => {
        const rc = await requestWorkbookRevision(id, note) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
    };
  }, [id, updateRc]);

  const availablePersonas = useMemo<RcPersona[]>(() => {
    const out: RcPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<RcPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as RcWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.rc.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <RcWorkbookProvider data={data}>
      <RcWorkbench
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
            myOpenComments={data.rc.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <RcDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as RcWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="RC"
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadRcExample(id);
            updateRc(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadRcExample(id);
            updateRc(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </RcWorkbookProvider>
  );
}

export { RcWorkbookPage };

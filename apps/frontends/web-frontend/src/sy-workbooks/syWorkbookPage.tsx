import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
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
  getSyWorkbook,
  loadSyExample,
  unloadSyExample,
  type SyWorkbookRoleName,
} from "./syWorkbookApi";
import { SyWorkbench, type SyWorkbenchActions } from "./syWorkbench";
import { SyWorkbookProvider, type SyWorkbookData } from "./syWorkbookContext";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { SyDocumentsCard } from "./syDocumentsCard";
import { type SyPersona } from "./syViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "SY-A1",
  models: "SY-A8",
  failures: "SY-A16",
  ccf: "SY-B1",
  deps: "SY-B5",
  integrity: "SY-A30",
  uncert: "SY-A32",
};

interface SyExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface SyBundleResponse {
  sy: SyExampleResponse;
  configurationControl: SyExampleResponse;
  newlyDevelopedMethods: SyExampleResponse[];
}

function SyWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<SyWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<SyWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.sy.name ?? "";
  const workbookVersion = data?.sy.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getSyWorkbook(id),
      fetchJson<SyBundleResponse>("/api/example-workbooks/sy-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          sy: workbook.mef,
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
        setError((err as { message?: string }).message ?? "Could not load this SY workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateSy = useCallback((sy: SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy }));
  }, []);

  const actions = useMemo<SyWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const sy = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as SystemsAnalysis;
        updateSy(sy);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const sy = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as SystemsAnalysis;
        updateSy(sy);
      },
      submitForReview: async (): Promise<void> => {
        const sy = await submitWorkbookForReview(id) as SystemsAnalysis;
        updateSy(sy);
      },
      requestRevision: async (note): Promise<void> => {
        const sy = await requestWorkbookRevision(id, note) as SystemsAnalysis;
        updateSy(sy);
      },
    };
  }, [id, updateSy]);

  const availablePersonas = useMemo<SyPersona[]>(() => {
    const out: SyPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<SyPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as SyWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.sy.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <SyWorkbookProvider data={data}>
      <SyWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onStageChange={(s) => {
          const newMef = { ...data.sy, plantStage: s === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" } as SystemsAnalysis;
          updateSy(newMef);
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
            myOpenComments={data.sy.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <SyDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as SyWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="SY"
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadSyExample(id);
            updateSy(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadSyExample(id);
            updateSy(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </SyWorkbookProvider>
  );
}

export { SyWorkbookPage };

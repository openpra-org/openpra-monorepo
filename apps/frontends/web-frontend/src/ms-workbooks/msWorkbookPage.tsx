import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
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
  getMsWorkbook,
  getMsExamples,
  loadMsExample,
  unloadMsExample,
  type MsWorkbookRoleName,
  type MsExampleOption,
} from "./msWorkbookApi";
import { MsWorkbench, type MsWorkbenchActions } from "./msWorkbench";
import { MsWorkbookProvider, type MsWorkbookData } from "./msWorkbookContext";
import { useMsMefPatch } from "./useMsMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { MsDocumentsCard } from "./msDocumentsCard";
import { type MsPersona } from "./msViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "MS-A1",
  categories: "MS-A1",
  sources: "MS-B1",
  transport: "MS-B5",
  sourceterm: "MS-C1",
  uncert: "MS-D2",
};

interface MsExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface MsBundleResponse {
  ms: MsExampleResponse;
  configurationControl: MsExampleResponse;
  newlyDevelopedMethods: MsExampleResponse[];
}

function MsWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<MsWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<MsWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [exampleOptions, setExampleOptions] = useState<MsExampleOption[]>([]);
  const workbookName = data?.ms.name ?? "";
  const workbookVersion = data?.ms.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getMsWorkbook(id),
      fetchJson<MsBundleResponse>("/api/example-workbooks/ms-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          ms: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
        });
        setMyRoles(workbook.myRoles);
        setHasPreviousMef(workbook.hasPreviousMef);
        try {
          const options = await getMsExamples();
          if (!cancelled) setExampleOptions(options);
        } catch {
          if (!cancelled) setExampleOptions([]);
        }
        try {
          const project = await getProject(workbook.projectId);
          if (!cancelled) setProjectName(project.name);
        } catch {
          if (!cancelled) setProjectName("");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load this MS workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateMs = useCallback((ms: MechanisticSourceTermAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ms }));
  }, []);

  const handleSaveOk = useCallback((): void => { setSaveError(null); }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const { patchDebounced } = useMsMefPatch(id ?? "", data?.ms ?? null, handleSaveOk, handleSaveErr);
  const mutateMs = useCallback((mutator: (ms: MechanisticSourceTermAnalysis) => MechanisticSourceTermAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ms: mutator(prev.ms) }));
    patchDebounced(mutator);
  }, [patchDebounced]);

  const actions = useMemo<MsWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const ms = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as MechanisticSourceTermAnalysis;
        updateMs(ms);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const ms = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as MechanisticSourceTermAnalysis;
        updateMs(ms);
      },
      submitForReview: async (): Promise<void> => {
        const ms = await submitWorkbookForReview(id) as MechanisticSourceTermAnalysis;
        updateMs(ms);
      },
      requestRevision: async (note): Promise<void> => {
        const ms = await requestWorkbookRevision(id, note) as MechanisticSourceTermAnalysis;
        updateMs(ms);
      },
    };
  }, [id, updateMs]);

  const availablePersonas = useMemo<MsPersona[]>(() => {
    const out: MsPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<MsPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as MsWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.ms.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <MsWorkbookProvider data={data} editable={editable} mutateMs={mutateMs}>
      <MsWorkbench
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
            myOpenComments={data.ms.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <MsDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as MsWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="MS"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadMsExample(id, exampleId);
            updateMs(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadMsExample(id);
            updateMs(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </MsWorkbookProvider>
  );
}

export { MsWorkbookPage };

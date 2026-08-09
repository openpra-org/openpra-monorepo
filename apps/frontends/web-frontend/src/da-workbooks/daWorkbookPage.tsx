import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
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
  getDaWorkbook,
  fetchDaLinkedInputs,
  getDaExampleOptions,
  loadDaExample,
  unloadDaExample,
  type DaWorkbookRoleName,
  type DaExampleOption,
} from "./daWorkbookApi";
import { DaWorkbench, type DaWorkbenchActions } from "./daWorkbench";
import { DaWorkbookProvider, type DaWorkbookData } from "./daWorkbookContext";
import { useDaMefPatch } from "./useDaMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { DaDocumentsCard } from "./daDocumentsCard";
import { type DaPersona } from "./daViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "DA-A1",
  define: "DA-A1",
  group: "DA-B1",
  generic: "DA-C1",
  counts: "DA-C7",
  unavail: "DA-C13",
  estimate: "DA-D1",
  ccf: "DA-D7",
  uncert: "DA-A5",
};

interface DaExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface DaBundleResponse {
  da: DaExampleResponse;
  configurationControl: DaExampleResponse;
  newlyDevelopedMethods: DaExampleResponse[];
}

function DaWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<DaWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<DaWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [exampleOptions, setExampleOptions] = useState<DaExampleOption[]>([]);
  const workbookName = data?.da.name ?? "";
  const workbookVersion = data?.da.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getDaWorkbook(id),
      fetchJson<DaBundleResponse>("/api/example-workbooks/da-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          da: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          links: null,
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
        setError((err as { message?: string }).message ?? "Could not load this DA workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getDaExampleOptions()
      .then((opts) => { if (!cancelled) setExampleOptions(opts); })
      .catch(() => { if (!cancelled) setExampleOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const daUuid = data?.da.uuid ?? "";
  useEffect(() => {
    const variant = daUuid === "da-generic-1" ? "sfr" : daUuid === "da-generic-2" ? "htgr" : null;
    if (variant === null) return;
    let cancelled = false;
    fetchDaLinkedInputs(variant)
      .then((links) => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links })); })
      .catch(() => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links: null })); });
    return () => { cancelled = true; };
  }, [daUuid]);

  const updateDa = useCallback((da: DataAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, da }));
  }, []);

  const handleSaveOk = useCallback((): void => { setSaveError(null); }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const { patch } = useDaMefPatch(id ?? "", data?.da ?? null, handleSaveOk, handleSaveErr);
  const mutateDa = useCallback((mutator: (da: DataAnalysis) => DataAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, da: mutator(prev.da) }));
    void patch(mutator);
  }, [patch]);

  const actions = useMemo<DaWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const da = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as DataAnalysis;
        updateDa(da);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const da = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as DataAnalysis;
        updateDa(da);
      },
      submitForReview: async (): Promise<void> => {
        const da = await submitWorkbookForReview(id) as DataAnalysis;
        updateDa(da);
      },
      requestRevision: async (note): Promise<void> => {
        const da = await requestWorkbookRevision(id, note) as DataAnalysis;
        updateDa(da);
      },
    };
  }, [id, updateDa]);

  const availablePersonas = useMemo<DaPersona[]>(() => {
    const out: DaPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<DaPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as DaWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.da.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <DaWorkbookProvider data={data} editable={editable} mutateDa={mutateDa}>
      <DaWorkbench
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
            myOpenComments={data.da.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <DaDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as DaWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="DA"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadDaExample(id, exampleId);
            updateDa(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadDaExample(id);
            updateDa(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </DaWorkbookProvider>
  );
}

export { DaWorkbookPage };

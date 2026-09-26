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
  getSyExampleOptions,
  loadSyExample,
  unloadSyExample,
  type SyWorkbookResponse,
  type SyWorkbookRoleName,
  type SyExampleOption,
} from "./syWorkbookApi";
import { SyWorkbench, type SyWorkbenchActions } from "./syWorkbench";
import {
  SyWorkbookProvider,
  type SyControlledFailureModeOption,
  type SyControlledHumanFailureOption,
  type SyControlledParameterOption,
  type SyLinkCode,
  type SyUpstream,
  type SyWorkbookData,
} from "./syWorkbookContext";
import { useSyMefPatch } from "./useSyMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { SyDocumentsCard } from "./syDocumentsCard";
import { type SyPersona } from "./syViewData";
import { type Workbook } from "interfaces-shared-types";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { getDaWorkbook } from "../da-workbooks/daWorkbookApi";
import { getHrWorkbook } from "../hr-workbooks/hrWorkbookApi";
import { getEsWorkbook } from "../es-workbooks/esWorkbookApi";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { getPosWorkbook } from "../pos-workbooks/posWorkbookApi";
import { buildLinkedInputs, controlledFailureModeOptions, controlledHumanFailureOptions, controlledParameterOptions, listSyLinkOptions } from "./syLinks";

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

const NO_LINK_OPTIONS: Record<SyLinkCode, Workbook[]> = { ES: [], SC: [], POS: [], DA: [], HRA: [] };

function SyWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<SyWorkbookData | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [myRoles, setMyRoles] = useState<SyWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [exampleOptions, setExampleOptions] = useState<SyExampleOption[]>([]);
  const [controlledParameters, setControlledParameters] = useState<SyControlledParameterOption[]>([]);
  const [controlledHumanFailures, setControlledHumanFailures] = useState<SyControlledHumanFailureOption[]>([]);
  const [controlledFailureModes, setControlledFailureModes] = useState<SyControlledFailureModeOption[]>([]);
  const [linkOptions, setLinkOptions] = useState<Record<SyLinkCode, Workbook[]>>(NO_LINK_OPTIONS);
  const [linkedEs, setLinkedEs] = useState<EventSequenceAnalysis | undefined>(undefined);
  const [linkedSc, setLinkedSc] = useState<SuccessCriteriaDevelopment | undefined>(undefined);
  const [linkedPos, setLinkedPos] = useState<PlantOperatingStatesAnalysis | undefined>(undefined);
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
          links: null,
        });
        setMyRoles(workbook.myRoles);
        setRevision(workbook.revision);
        setHasPreviousMef(workbook.hasPreviousMef);
        setProjectId(workbook.projectId);
        try {
          const project = await getProject(workbook.projectId);
          if (!cancelled) setProjectName(project.name);
        } catch {
          if (!cancelled) setProjectName("");
        }
        try {
          const options = await listSyLinkOptions(workbook.projectId);
          if (!cancelled) setLinkOptions(options);
        } catch {
          if (!cancelled) setLinkOptions(NO_LINK_OPTIONS);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load this SY workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getSyExampleOptions()
      .then((opts) => { if (!cancelled) setExampleOptions(opts); })
      .catch(() => { if (!cancelled) setExampleOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const linkedIds = data?.sy.linkedWorkbooks;
  const linkedEsId = linkedIds?.ES;
  const linkedScId = linkedIds?.SC;
  const linkedPosId = linkedIds?.POS;
  const linkedDaId = linkedIds?.DA;
  const linkedHrId = linkedIds?.HRA;

  useEffect(() => {
    if (linkedEsId === undefined) { setLinkedEs(undefined); return; }
    let cancelled = false;
    getEsWorkbook(linkedEsId)
      .then((res) => { if (!cancelled) setLinkedEs(res.mef); })
      .catch(() => { if (!cancelled) setLinkedEs(undefined); });
    return () => { cancelled = true; };
  }, [linkedEsId]);

  useEffect(() => {
    if (linkedScId === undefined) { setLinkedSc(undefined); return; }
    let cancelled = false;
    getScWorkbook(linkedScId)
      .then((res) => { if (!cancelled) setLinkedSc(res.mef); })
      .catch(() => { if (!cancelled) setLinkedSc(undefined); });
    return () => { cancelled = true; };
  }, [linkedScId]);

  useEffect(() => {
    if (linkedPosId === undefined) { setLinkedPos(undefined); return; }
    let cancelled = false;
    getPosWorkbook(linkedPosId)
      .then((res) => { if (!cancelled) setLinkedPos(res.mef); })
      .catch(() => { if (!cancelled) setLinkedPos(undefined); });
    return () => { cancelled = true; };
  }, [linkedPosId]);

  useEffect(() => {
    const entries = linkedDaId === undefined ? linkOptions.DA : linkOptions.DA.filter((entry) => entry.id === linkedDaId);
    let cancelled = false;
    Promise.allSettled(entries.map(async (entry) => ({ entry, workbook: await getDaWorkbook(entry.id) })))
      .then((loaded) => {
        if (cancelled) return;
        const sources = loaded.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        setControlledParameters(controlledParameterOptions(sources));
        setControlledFailureModes(controlledFailureModeOptions(sources));
      })
      .catch(() => {
        if (cancelled) return;
        setControlledParameters([]);
        setControlledFailureModes([]);
      });
    return () => { cancelled = true; };
  }, [linkOptions.DA, linkedDaId]);

  useEffect(() => {
    const entries = linkedHrId === undefined ? linkOptions.HRA : linkOptions.HRA.filter((entry) => entry.id === linkedHrId);
    let cancelled = false;
    Promise.allSettled(entries.map(async (entry) => ({ entry, workbook: await getHrWorkbook(entry.id) })))
      .then((loaded) => {
        if (cancelled) return;
        setControlledHumanFailures(controlledHumanFailureOptions(loaded.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])));
      })
      .catch(() => { if (!cancelled) setControlledHumanFailures([]); });
    return () => { cancelled = true; };
  }, [linkOptions.HRA, linkedHrId]);

  const links = useMemo(
    () => buildLinkedInputs(linkOptions, { ES: linkedEsId, SC: linkedScId, POS: linkedPosId }, linkedEs, linkedSc, linkedPos),
    [linkOptions, linkedEsId, linkedScId, linkedPosId, linkedEs, linkedSc, linkedPos],
  );
  const upstream = useMemo<SyUpstream>(() => ({ options: linkOptions }), [linkOptions]);
  const providerData = useMemo<SyWorkbookData | null>(() => (data === null ? null : { ...data, links }), [data, links]);

  const updateSy = useCallback((sy: SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy }));
  }, []);

  const handleSaveOk = useCallback((nextRevision: number): void => {
    setRevision(nextRevision);
    setSaveError(null);
  }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const handleSaveResync = useCallback((latest: SyWorkbookResponse): void => {
    setData((previous) => (previous === null ? previous : { ...previous, sy: latest.mef }));
    setRevision(latest.revision);
    setMyRoles(latest.myRoles);
    setHasPreviousMef(latest.hasPreviousMef);
  }, []);
  const refreshWorkbook = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    handleSaveResync(await getSyWorkbook(id));
  }, [handleSaveResync, id]);
  const { patch, saveStatus } = useSyMefPatch(
    id ?? "",
    data?.sy ?? null,
    revision,
    handleSaveOk,
    handleSaveErr,
    handleSaveResync,
  );
  const mutateSy = useCallback((mutator: (sy: SystemsAnalysis) => SystemsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, sy: mutator(prev.sy) }));
    void patch(mutator);
  }, [patch]);

  const actions = useMemo<SyWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] });
        await refreshWorkbook();
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        await patchWorkbookComment(id, commentId, { resolved: nextResolved });
        await refreshWorkbook();
      },
      submitForReview: async (): Promise<void> => {
        await submitWorkbookForReview(id);
        await refreshWorkbook();
      },
      requestRevision: async (note): Promise<void> => {
        await requestWorkbookRevision(id, note);
        await refreshWorkbook();
      },
    };
  }, [id, refreshWorkbook]);

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
  if (data === null || providerData === null || id === undefined) {
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
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <SyWorkbookProvider
      data={providerData}
      editable={editable}
      mutateSy={mutateSy}
      runtime={{ workbookId: id, projectId, revision, saveStatus }}
      controlledParameters={controlledParameters}
      controlledHumanFailures={controlledHumanFailures}
      controlledFailureModes={controlledFailureModes}
      upstream={upstream}
    >
      <SyWorkbench
        data={providerData}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onLoadExample={canLoadExample ? () => setLoadExOpen(true) : undefined}
        onUnloadExample={canUnloadExample ? () => setUnloadExOpen(true) : undefined}
        actions={actions}
        headerMeta={{ projectName, workbookName, workbookVersion, saveStatus }}
        renderApprovalTable={() => <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />}
        renderSignCard={() => (
          <WorkbookSignCard
            workbookId={id}
            actingUsername={actingUsername}
            currentPersona={persona}
            myOpenComments={data.sy.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => {
              setApprovalRefresh((n) => n + 1);
              void refreshWorkbook().catch((refreshError: unknown) => {
                handleSaveErr((refreshError as { message?: string }).message ?? "Could not refresh this SY workbook");
              });
            }}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <SyDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as SyWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="SY"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadSyExample(id, exampleId);
            updateSy(res.mef);
            setRevision(res.revision);
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
            setRevision(res.revision);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </SyWorkbookProvider>
  );
}

export { SyWorkbookPage };

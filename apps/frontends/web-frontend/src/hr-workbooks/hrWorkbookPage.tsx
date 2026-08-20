import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
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
  getHrWorkbook,
  fetchHrLinkedInputs,
  getHrExampleOptions,
  loadHrExample,
  unloadHrExample,
  type HrWorkbookRoleName,
  type HrExampleOption,
} from "./hrWorkbookApi";
import { HrWorkbench, type HrWorkbenchActions } from "./hrWorkbench";
import { HrWorkbookProvider, type HrWorkbookData } from "./hrWorkbookContext";
import { useHrMefPatch } from "./useHrMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { HrDocumentsCard } from "./hrDocumentsCard";
import { type HrPersona } from "./hrViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "HR-A1",
  preid: "HR-A1",
  predef: "HR-B1",
  prequant: "HR-D1",
  respid: "HR-E1",
  respdef: "HR-F1",
  respquant: "HR-G1",
  recovery: "HR-H1",
  uncert: "HR-G15",
};

interface HrExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface HrBundleResponse {
  hr: HrExampleResponse;
  configurationControl: HrExampleResponse;
  newlyDevelopedMethods: HrExampleResponse[];
}

function HrWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<HrWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<HrWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [exampleOptions, setExampleOptions] = useState<HrExampleOption[]>([]);
  const workbookName = data?.hr.name ?? "";
  const workbookVersion = data?.hr.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getHrWorkbook(id),
      fetchJson<HrBundleResponse>("/api/example-workbooks/hr-bundle"),
    ])
      .then(async ([workbook, bundle]) => {
        if (cancelled) return;
        setData({
          hr: workbook.mef,
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
        setError((err as { message?: string }).message ?? "Could not load this HR workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    getHrExampleOptions()
      .then((opts) => { if (!cancelled) setExampleOptions(opts); })
      .catch(() => { if (!cancelled) setExampleOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const hrUuid = data?.hr.uuid ?? "";
  useEffect(() => {
    const variant = hrUuid === "hr-generic-1" ? "sfr" : hrUuid === "hr-generic-2" ? "htgr" : null;
    if (variant === null) return;
    let cancelled = false;
    fetchHrLinkedInputs(variant)
      .then((links) => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links })); })
      .catch(() => { if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, links: null })); });
    return () => { cancelled = true; };
  }, [hrUuid]);

  const updateHr = useCallback((hr: HumanReliabilityAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, hr }));
  }, []);

  const handleSaveOk = useCallback((): void => { setSaveError(null); }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const { patch } = useHrMefPatch(id ?? "", data?.hr ?? null, handleSaveOk, handleSaveErr);
  const mutateHr = useCallback((mutator: (hr: HumanReliabilityAnalysis) => HumanReliabilityAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, hr: mutator(prev.hr) }));
    void patch(mutator);
  }, [patch]);

  const actions = useMemo<HrWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const hr = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as HumanReliabilityAnalysis;
        updateHr(hr);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const hr = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as HumanReliabilityAnalysis;
        updateHr(hr);
      },
      submitForReview: async (): Promise<void> => {
        const hr = await submitWorkbookForReview(id) as HumanReliabilityAnalysis;
        updateHr(hr);
      },
      requestRevision: async (note): Promise<void> => {
        const hr = await requestWorkbookRevision(id, note) as HumanReliabilityAnalysis;
        updateHr(hr);
      },
    };
  }, [id, updateHr]);

  const availablePersonas = useMemo<HrPersona[]>(() => {
    const out: HrPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<HrPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as HrWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.hr.workflowState;
  const canEdit = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <HrWorkbookProvider data={data} editable={editable} mutateHr={mutateHr}>
      <HrWorkbench
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
            myOpenComments={data.hr.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <HrDocumentsCard workbookId={id} canEdit={canEdit} />}
      />
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as HrWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="HRA"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadHrExample(id, exampleId);
            updateHr(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadHrExample(id);
            updateHr(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            setUnloadExOpen(false);
          }}
        />
      )}
    </HrWorkbookProvider>
  );
}

export { HrWorkbookPage };

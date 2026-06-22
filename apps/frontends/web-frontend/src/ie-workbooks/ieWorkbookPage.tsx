import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { getProject } from "../projects/projectApi";
import {
  postWorkbookComment,
  patchWorkbookComment,
  submitWorkbookForReview,
  requestWorkbookRevision,
} from "../workbooks/workbookReviewApi";
import { WorkbookApprovalTable } from "../workbooks/workbookApprovalTable";
import { WorkbookSignCard } from "../workbooks/workbookSignCard";
import { WorkbookRoster } from "../workbooks/workbookRoster";
import { WorkbookRolesModal } from "../workbooks/workbookRolesModal";
import { useAuth } from "../auth/AuthContext";
import {
  getIeWorkbook,
  getIePosLink,
  linkPosWorkbook,
  loadIeExample,
  unloadIeExample,
  type IeWorkbookRoleName,
  type IePosLinkStatus,
} from "./ieWorkbookApi";
import { IeWorkbench, type IeWorkbenchActions } from "./ieWorkbench";
import { IeWorkbookProvider, type IeWorkbookData } from "./ieWorkbookContext";
import { IePosLinkModal } from "./iePosLinkModal";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { type IePersona } from "./ieViewData";

interface IeExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface IeBundleResponse {
  ie: IeExampleResponse;
  configurationControl: IeExampleResponse;
  newlyDevelopedMethods: IeExampleResponse[];
}

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "IE-A2",
  methods: "IE-A1",
  identify: "IE-A5",
  completeness: "IE-A9",
  hazards: "IE-A6",
  grouping: "IE-B4",
  screening: "IE-C9",
  frequency: "IE-C8",
};

function IeWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [approvalRefresh, setApprovalRefresh] = useState<number>(0);
  const [data, setData] = useState<IeWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<IeWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [posLinkOpen, setPosLinkOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.ie.name ?? "";
  const workbookVersion = data?.ie.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getIeWorkbook(id),
      fetchJson<IeBundleResponse>("/api/example-workbooks/ie-bundle"),
      getIePosLink(id).catch((): IePosLinkStatus => ({ linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] })),
    ])
      .then(async ([workbook, bundle, posLink]) => {
        if (cancelled) return;
        setData({
          ie: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink,
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
        setError((err as { message?: string }).message ?? "Could not load this IE workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateIe = useCallback((ie: InitiatingEventsAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, ie }));
  }, []);

  const refreshPosLink = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    const posLink = await getIePosLink(id);
    setData((prev) => (prev === null ? prev : { ...prev, posLink }));
  }, [id]);

  const availablePersonas = useMemo<IePersona[]>(() => {
    const out: IePersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<IePersona>("preparer");
  useEffect(() => {
    if (availablePersonas.length === 0) return;
    if (!availablePersonas.includes(persona)) setPersona(availablePersonas[0]);
  }, [availablePersonas, persona]);

  const actions = useMemo<IeWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const ie = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as InitiatingEventsAnalysis;
        updateIe(ie);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const ie = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as InitiatingEventsAnalysis;
        updateIe(ie);
      },
      submitForReview: async (): Promise<void> => {
        const ie = await submitWorkbookForReview(id) as InitiatingEventsAnalysis;
        updateIe(ie);
      },
      requestRevision: async (note): Promise<void> => {
        const ie = await requestWorkbookRevision(id, note) as InitiatingEventsAnalysis;
        updateIe(ie);
      },
    };
  }, [id, updateIe]);

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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as IeWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.ie.workflowState;
  const canLoadExample = (myRoles.includes("preparer") || myRoles.includes("co_preparer")) && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;
  const canLink = myRoles.includes("preparer") || myRoles.includes("co_preparer");

  return (
    <IeWorkbookProvider data={data}>
      <IeWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onLoadExample={canLoadExample ? () => setLoadExOpen(true) : undefined}
        onUnloadExample={canUnloadExample ? () => setUnloadExOpen(true) : undefined}
        onOpenPosLink={canLink ? () => setPosLinkOpen(true) : undefined}
        onStageChange={(s) => {
          const newMef = { ...data.ie, plantStage: s === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" } as InitiatingEventsAnalysis;
          updateIe(newMef);
        }}
        actions={actions}
        headerMeta={{
          projectName,
          workbookName,
          workbookVersion,
          plantIdentity: data.ie.metadata.plantIdentity !== undefined
            ? {
                name: data.ie.metadata.plantIdentity.name,
                type: data.ie.metadata.plantIdentity.reactorType,
                power: data.ie.metadata.plantIdentity.thermalPower,
                vendor: data.ie.metadata.plantIdentity.vendor,
              }
            : undefined,
        }}
        renderApprovalTable={() => (
          <WorkbookApprovalTable workbookId={id} refreshSignal={approvalRefresh} />
        )}
        renderSignCard={() => (
          <WorkbookSignCard workbookId={id} actingUsername={actingUsername} currentPersona={persona} myOpenComments={data.ie.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length} refreshSignal={approvalRefresh} onSigned={() => setApprovalRefresh((n) => n + 1)} />
        )}
        renderRoster={() => (<WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />)}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as IeWorkbookRoleName[])} />}
      {posLinkOpen && (
        <IePosLinkModal
          workbookId={id}
          currentLinkedId={data.posLink.linkedPosWorkbookId}
          onClose={() => setPosLinkOpen(false)}
          onConfirm={async (posWorkbookId) => {
            const posLink = await linkPosWorkbook(id, posWorkbookId);
            setData((prev) => (prev === null ? prev : { ...prev, posLink }));
            const wb = await getIeWorkbook(id);
            updateIe(wb.mef);
            setPosLinkOpen(false);
          }}
        />
      )}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="IE"
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadIeExample(id);
            updateIe(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            await refreshPosLink();
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadIeExample(id);
            updateIe(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            await refreshPosLink();
            setUnloadExOpen(false);
          }}
        />
      )}
    </IeWorkbookProvider>
  );
}

export { IeWorkbookPage };

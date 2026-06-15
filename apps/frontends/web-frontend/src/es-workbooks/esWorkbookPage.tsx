import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
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
  getEsWorkbook,
  getEsPosLink,
  getEsIeLink,
  linkPosWorkbook,
  linkIeWorkbook,
  loadEsExample,
  unloadEsExample,
  type EsWorkbookRoleName,
  type EsPosLinkStatus,
  type EsIeLinkStatus,
} from "./esWorkbookApi";
import { EsWorkbench, type EsWorkbenchActions } from "./esWorkbench";
import { EsWorkbookProvider, type EsWorkbookData } from "./esWorkbookContext";
import { EsPosLinkModal } from "./esPosLinkModal";
import { EsIeLinkModal } from "./esIeLinkModal";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { EsDocumentsCard } from "./esDocumentsCard";
import { type EsPersona } from "./esViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "ES-A2",
  sequences: "ES-A1",
  deps: "ES-B1",
  timing: "ES-A6",
  endstates: "ES-C1",
  families: "ES-C8",
  screening: "ES-A7",
  quant: "ES-C8",
};

interface EsExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface EsBundleResponse {
  es: EsExampleResponse;
  configurationControl: EsExampleResponse;
  newlyDevelopedMethods: EsExampleResponse[];
}

function EsWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<EsWorkbookData | null>(null);
  const [myRoles, setMyRoles] = useState<EsWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [posLinkOpen, setPosLinkOpen] = useState(false);
  const [ieLinkOpen, setIeLinkOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const workbookName = data?.es.name ?? "";
  const workbookVersion = data?.es.version ?? "1";

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    Promise.all([
      getEsWorkbook(id),
      fetchJson<EsBundleResponse>("/api/example-workbooks/es-bundle"),
      getEsPosLink(id).catch((): EsPosLinkStatus => ({ linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] })),
      getEsIeLink(id).catch((): EsIeLinkStatus => ({ linkedIeWorkbookId: null, linkedName: null, initiators: [] })),
    ])
      .then(async ([workbook, bundle, posLink, ieLink]) => {
        if (cancelled) return;
        setData({
          es: workbook.mef,
          cc: bundle.configurationControl.mef as PRAConfigurationControl,
          nms: bundle.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
          posLink,
          ieLink,
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
        setError((err as { message?: string }).message ?? "Could not load this ES workbook");
      });
    return () => { cancelled = true; };
  }, [id]);

  const updateEs = useCallback((es: EventSequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, es }));
  }, []);

  const refreshLinks = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    const [posLink, ieLink] = await Promise.all([getEsPosLink(id), getEsIeLink(id)]);
    setData((prev) => (prev === null ? prev : { ...prev, posLink, ieLink }));
  }, [id]);

  const actions = useMemo<EsWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const es = await postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] }) as EventSequenceAnalysis;
        updateEs(es);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const es = await patchWorkbookComment(id, commentId, { resolved: nextResolved }) as EventSequenceAnalysis;
        updateEs(es);
      },
      submitForReview: async (): Promise<void> => {
        const es = await submitWorkbookForReview(id) as EventSequenceAnalysis;
        updateEs(es);
      },
      requestRevision: async (note): Promise<void> => {
        const es = await requestWorkbookRevision(id, note) as EventSequenceAnalysis;
        updateEs(es);
      },
    };
  }, [id, updateEs]);

  const availablePersonas = useMemo<EsPersona[]>(() => {
    const out: EsPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const [persona, setPersona] = useState<EsPersona>("preparer");
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
        {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as EsWorkbookRoleName[])} />}
      </div>
    );
  }

  const workflowState = data.es.workflowState;
  const canLink = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const canLoadExample = canLink && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <EsWorkbookProvider data={data}>
      <EsWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        onOpenPosLink={canLink ? () => setPosLinkOpen(true) : undefined}
        onOpenIeLink={canLink ? () => setIeLinkOpen(true) : undefined}
        onStageChange={(s) => {
          const newMef = { ...data.es, plantStage: s === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" } as EventSequenceAnalysis;
          updateEs(newMef);
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
            myOpenComments={data.es.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => setApprovalRefresh((n) => n + 1)}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <EsDocumentsCard workbookId={id} canEdit={canLink} />}
      />
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as EsWorkbookRoleName[])} />}
      {posLinkOpen && (
        <EsPosLinkModal
          workbookId={id}
          currentLinkedId={data.posLink.linkedPosWorkbookId}
          onClose={() => setPosLinkOpen(false)}
          onConfirm={async (posWorkbookId) => {
            const posLink = await linkPosWorkbook(id, posWorkbookId);
            setData((prev) => (prev === null ? prev : { ...prev, posLink }));
            const wb = await getEsWorkbook(id);
            updateEs(wb.mef);
            setPosLinkOpen(false);
          }}
        />
      )}
      {ieLinkOpen && (
        <EsIeLinkModal
          workbookId={id}
          currentLinkedId={data.ieLink.linkedIeWorkbookId}
          onClose={() => setIeLinkOpen(false)}
          onConfirm={async (ieWorkbookId) => {
            const ieLink = await linkIeWorkbook(id, ieWorkbookId);
            setData((prev) => (prev === null ? prev : { ...prev, ieLink }));
            const wb = await getEsWorkbook(id);
            updateEs(wb.mef);
            setIeLinkOpen(false);
          }}
        />
      )}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="ES"
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async () => {
            const res = await loadEsExample(id);
            updateEs(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            await refreshLinks();
            setLoadExOpen(false);
          }}
        />
      )}
      {unloadExOpen && (
        <UnloadExampleModal
          onCancel={() => setUnloadExOpen(false)}
          onConfirm={async () => {
            const res = await unloadEsExample(id);
            updateEs(res.mef);
            setHasPreviousMef(res.hasPreviousMef);
            await refreshLinks();
            setUnloadExOpen(false);
          }}
        />
      )}
    </EsWorkbookProvider>
  );
}

export { EsWorkbookPage };

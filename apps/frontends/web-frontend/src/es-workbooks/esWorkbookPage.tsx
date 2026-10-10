import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { expressionReferences } from "interfaces-mef-types/core/uncertainty";
import { type EsLinkedWorkbooks } from "interfaces-mef-types/es/event-sequence-analysis";
import { listWorkbooks } from "../workbooks/workbookApi";
import { getScWorkbook } from "../sc-workbooks/scWorkbookApi";
import { getSyWorkbook } from "../sy-workbooks/syWorkbookApi";
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
  unlinkPosWorkbook,
  unlinkIeWorkbook,
  getAvailablePosWorkbooks,
  getAvailableIeWorkbooks,
  getEsExampleOptions,
  loadEsExample,
  unloadEsExample,
  type EsExampleOption,
  type EsWorkbookResponse,
  type EsWorkbookRoleName,
  type EsPosLinkStatus,
  type EsIeLinkStatus,
} from "./esWorkbookApi";
import { EsWorkbench, type EsWorkbenchActions } from "./esWorkbench";
import { EsWorkbookProvider, type EsWorkbookData } from "./esWorkbookContext";
import { useEsMefPatch } from "./useEsMefPatch";
import { type EsLinkActions } from "./EsScope";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { EsDocumentsCard } from "./esDocumentsCard";
import { loadDaFrequencies } from "../ie-workbooks/ieDaLinks";
import { type EsPersona } from "./esViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "ES-A2",
  sequences: "ES-A1",
  deps: "ES-B1",
  timing: "ES-A6",
  endstates: "ES-C1",
  families: "ES-C8",
  quant: "ES-C8",
};

function withLink(links: EsLinkedWorkbooks | undefined, code: keyof EsLinkedWorkbooks, workbookId: string | null): EsLinkedWorkbooks {
  const next: EsLinkedWorkbooks = { ...links };
  delete next[code];
  if (workbookId !== null) next[code] = workbookId;
  return next;
}

function EsWorkbookPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const actingUsername = user?.username ?? "";
  const [data, setData] = useState<EsWorkbookData | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [myRoles, setMyRoles] = useState<EsWorkbookRoleName[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [exampleOptions, setExampleOptions] = useState<EsExampleOption[]>([]);
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
      getEsPosLink(id).catch((): EsPosLinkStatus => ({ linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] })),
      getEsIeLink(id).catch((): EsIeLinkStatus => ({ linkedIeWorkbookId: null, linkedName: null, groups: [] })),
    ])
      .then(async ([workbook, posLink, ieLink]) => {
        if (cancelled) return;
        setData({
          projectId: workbook.projectId,
          es: workbook.mef,
          posLink,
          ieLink,
        });
        setMyRoles(workbook.myRoles);
        setRevision(workbook.revision);
        const linkedDa = (workbook.mef.eventTrees ?? []).flatMap((tree) => (tree.initiatingEventFrequency === undefined ? [] : expressionReferences(tree.initiatingEventFrequency.expression).map((reference) => reference.workbookId)));
        void loadDaFrequencies(workbook.projectId, linkedDa).then((daFrequencies) => {
          if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, daFrequencies }));
        });
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

  useEffect(() => {
    let cancelled = false;
    getEsExampleOptions()
      .then((opts) => { if (!cancelled) setExampleOptions(opts); })
      .catch(() => { if (!cancelled) setExampleOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const updateEs = useCallback((es: EventSequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, es }));
  }, []);

  const handleSaveOk = useCallback((nextRevision: number): void => {
    setRevision(nextRevision);
    setSaveError(null);
  }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const handleSaveResync = useCallback((latest: EsWorkbookResponse): void => {
    setData((previous) => (previous === null ? previous : { ...previous, es: latest.mef }));
    setRevision(latest.revision);
    setMyRoles(latest.myRoles);
    setHasPreviousMef(latest.hasPreviousMef);
  }, []);
  const refreshWorkbook = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    handleSaveResync(await getEsWorkbook(id));
  }, [handleSaveResync, id]);
  const { patch, saveStatus } = useEsMefPatch(
    id ?? "",
    data?.es ?? null,
    revision,
    handleSaveOk,
    handleSaveErr,
    handleSaveResync,
  );
  const mutateEs = useCallback((mutator: (es: EventSequenceAnalysis) => EventSequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, es: mutator(prev.es) }));
    void patch(mutator);
  }, [patch]);

  const refreshLinks = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    const [posLink, ieLink] = await Promise.all([getEsPosLink(id), getEsIeLink(id)]);
    setData((prev) => (prev === null ? prev : { ...prev, posLink, ieLink }));
  }, [id]);

  const actions = useMemo<EsWorkbenchActions | undefined>(() => {
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

  const availablePersonas = useMemo<EsPersona[]>(() => {
    const out: EsPersona[] = [];
    if (myRoles.includes("preparer") || myRoles.includes("co_preparer")) out.push("preparer");
    if (myRoles.includes("reviewer")) out.push("reviewer");
    if (myRoles.includes("approver")) out.push("approver");
    return out;
  }, [myRoles]);

  const linkRoles = myRoles.includes("preparer") || myRoles.includes("co_preparer");
  const projectId = data?.projectId;
  const links = useMemo<EsLinkActions | undefined>(() => {
    if (id === undefined || projectId === undefined || !linkRoles) return undefined;
    const reload = async (): Promise<void> => {
      const wb = await getEsWorkbook(id);
      updateEs(wb.mef);
      setRevision(wb.revision);
    };
    return {
      available: async (code) => {
        if (code === "POS") return (await getAvailablePosWorkbooks(id)).map((workbook) => ({ workbookId: workbook.workbookId, name: workbook.name }));
        if (code === "IE") return (await getAvailableIeWorkbooks(id)).map((workbook) => ({ workbookId: workbook.workbookId, name: workbook.name }));
        return (await listWorkbooks(projectId, code)).workbooks.map((workbook) => ({ workbookId: workbook.id, name: workbook.name }));
      },
      link: async (code, workbookId) => {
        if (code === "POS") {
          const posLink = await linkPosWorkbook(id, workbookId);
          setData((prev) => (prev === null ? prev : { ...prev, posLink }));
          await reload();
          return;
        }
        if (code === "IE") {
          const ieLink = await linkIeWorkbook(id, workbookId);
          setData((prev) => (prev === null ? prev : { ...prev, ieLink }));
          await reload();
          return;
        }
        mutateEs((draft) => ({ ...draft, linkedWorkbooks: withLink(draft.linkedWorkbooks, code, workbookId) }));
      },
      unlink: async (code) => {
        if (code === "POS") {
          const posLink = await unlinkPosWorkbook(id);
          setData((prev) => (prev === null ? prev : { ...prev, posLink }));
          await reload();
          return;
        }
        if (code === "IE") {
          const ieLink = await unlinkIeWorkbook(id);
          setData((prev) => (prev === null ? prev : { ...prev, ieLink }));
          await reload();
          return;
        }
        mutateEs((draft) => ({ ...draft, linkedWorkbooks: withLink(draft.linkedWorkbooks, code, null) }));
      },
    };
  }, [id, projectId, linkRoles, updateEs, mutateEs]);

  const linkedSc = data?.es.linkedWorkbooks?.SC;
  const linkedSy = data?.es.linkedWorkbooks?.SY;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      linkedSc === undefined ? Promise.resolve(undefined) : getScWorkbook(linkedSc).then((workbook) => workbook.mef),
      linkedSy === undefined ? Promise.resolve(undefined) : getSyWorkbook(linkedSy).then((workbook) => workbook.mef),
    ])
      .then(([sc, sy]) => {
        if (!cancelled) setData((prev) => (prev === null ? prev : { ...prev, upstream: { ...(sc === undefined ? {} : { sc }), ...(sy === undefined ? {} : { sy }) } }));
      })
      .catch((failure: Error) => { if (!cancelled) setUpstreamError(`Could not load a linked workbook: ${failure.message}`); });
    return () => { cancelled = true; };
  }, [linkedSc, linkedSy]);

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
  const editable = persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canLink && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <EsWorkbookProvider
      data={data}
      editable={editable}
      runtime={{ workbookId: id, revision, saveState: saveStatus }}
      mutateEs={mutateEs}
    >
      <EsWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={availablePersonas.length > 1}
        availablePersonas={availablePersonas}
        onOpenRoles={() => setRolesOpen(true)}
        links={links}
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
            myOpenComments={data.es.internalReviewComments.comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
            refreshSignal={approvalRefresh}
            onSigned={() => {
              setApprovalRefresh((n) => n + 1);
              void refreshWorkbook().catch((refreshError: unknown) => {
                handleSaveErr((refreshError as { message?: string }).message ?? "Could not refresh this ES workbook");
              });
            }}
          />
        )}
        renderRoster={() => <WorkbookRoster workbookId={id} refreshSignal={approvalRefresh} />}
        renderDocuments={() => <EsDocumentsCard workbookId={id} canEdit={canLink} />}
      />
      {upstreamError !== null && (
        <div className="ie-savebar" role="alert">
          <span>{upstreamError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setUpstreamError(null)}>Dismiss</button>
        </div>
      )}
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as EsWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="ES"
          exampleOptions={exampleOptions}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await loadEsExample(id, exampleId);
            updateEs(res.mef);
            setRevision(res.revision);
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
            setRevision(res.revision);
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

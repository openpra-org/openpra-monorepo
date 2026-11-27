import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { type EsLinkedWorkbooks } from "interfaces-mef-types/es/event-sequence-analysis";
import { listWorkbooks } from "../workbooks/workbookApi";
import { useLinkedWorkbookRefresh } from "../workbooks/useLinkedWorkbookRefresh";
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
import { EsWorkbookProvider, type EsUnavailableLink, type EsWorkbookData } from "./esWorkbookContext";
import { esShowsSavedCopies, esWithLinkedTiming, esWithTypedWindowsReplaced, esWithoutLinkedTiming, loadEsLinkedSources } from "./esLinkedTiming";
import { useEsMefPatch } from "./useEsMefPatch";
import { type EsLinkActions } from "./EsScope";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { EsDocumentsCard } from "./esDocumentsCard";
import { type EsPersona } from "./esViewData";

const STEP_SR_HINT: Record<string, string | undefined> = {
  scope: "ES-A2",
  sequences: "ES-A1",
  timing: "ES-A6",
  dynamic: "ES-A5",
  uncertainty: "ES-A14",
  handoff: "ES-C8",
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
  const upstream = data?.upstream;
  const mutateEs = useCallback((mutator: (es: EventSequenceAnalysis) => EventSequenceAnalysis): void => {
    const saved = (current: EventSequenceAnalysis): EventSequenceAnalysis => esWithoutLinkedTiming(mutator(esWithLinkedTiming(current, upstream)), upstream);
    setData((prev) => (prev === null ? prev : { ...prev, es: saved(prev.es) }));
    void patch(saved);
  }, [patch, upstream]);

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
  const linkedSc = data?.es.linkedWorkbooks?.SC;
  const linkedSy = data?.es.linkedWorkbooks?.SY;
  const linkedHr = data?.es.linkedWorkbooks?.HRA;
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
        if (code === "HRA" || code === "SC") {
          const held: EsLinkedWorkbooks = { ...(linkedSc === undefined ? {} : { SC: linkedSc }), ...(linkedHr === undefined ? {} : { HRA: linkedHr }) };
          const next = await loadEsLinkedSources({ linkedWorkbooks: withLink(held, code, workbookId) });
          if (next.unavailable.includes(code)) throw new Error("Linked workbook unavailable");
          mutateEs((draft) => ({ ...esWithTypedWindowsReplaced(draft, next.sources), linkedWorkbooks: withLink(draft.linkedWorkbooks, code, workbookId) }));
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
  }, [id, projectId, linkRoles, updateEs, mutateEs, linkedSc, linkedHr]);

  const upstreamRequest = useRef(0);
  const loadUpstream = useCallback(async (): Promise<void> => {
    const request = upstreamRequest.current + 1;
    upstreamRequest.current = request;
    const [linked, sy] = await Promise.all([
      loadEsLinkedSources({ linkedWorkbooks: { ...(linkedSc === undefined ? {} : { SC: linkedSc }), ...(linkedHr === undefined ? {} : { HRA: linkedHr }) } }),
      linkedSy === undefined ? undefined : getSyWorkbook(linkedSy).then((workbook) => workbook.mef).catch(() => undefined),
    ]);
    if (upstreamRequest.current !== request) return;
    const unavailable: EsUnavailableLink[] = [...linked.unavailable];
    if (linkedSy !== undefined && sy === undefined) unavailable.push("SY");
    setData((prev) => (prev === null ? prev : { ...prev, upstream: { ...linked.sources, ...(sy === undefined ? {} : { sy }), ...(unavailable.length === 0 ? {} : { unavailable }) } }));
    setUpstreamError(unavailable.length > 0
      ? `Could not load a linked workbook: ${unavailable.map((code) => (code === "HRA" ? "HR" : code)).join(", ")}`
      : linked.missionTimesUnavailable ? "Could not read the mission times of the linked SC workbook" : null);
  }, [linkedSc, linkedSy, linkedHr]);

  const loaded = data !== null;
  useEffect(() => {
    if (loaded) void loadUpstream();
  }, [loaded, loadUpstream]);

  const refreshLinked = useCallback(async (): Promise<void> => {
    await Promise.all([loadUpstream(), refreshLinks()]);
  }, [loadUpstream, refreshLinks]);
  useLinkedWorkbookRefresh(refreshLinked);

  const savedEs = data?.es;
  const viewData = useMemo<EsWorkbookData | null>(() => {
    if (data === null || savedEs === undefined) return null;
    return esShowsSavedCopies(savedEs) ? data : { ...data, es: esWithLinkedTiming(savedEs, upstream) };
  }, [data, savedEs, upstream]);

  const [persona, setPersona] = useState<EsPersona>("preparer");
  useEffect(() => {
    if (availablePersonas.length === 0) return;
    if (!availablePersonas.includes(persona)) setPersona(availablePersonas[0]);
  }, [availablePersonas, persona]);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null || viewData === null || id === undefined) {
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
      data={viewData}
      editable={editable}
      runtime={{ workbookId: id, revision, saveState: saveStatus }}
      mutateEs={mutateEs}
    >
      <EsWorkbench
        data={viewData}
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
        <LoadExampleModal replacesLinks
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

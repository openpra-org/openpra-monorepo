import type { RcCaseRecords } from "interfaces-mef-types/rc/case-records";
import type { RcCaseActions } from "./rcWorkbookContext";
import { saveRcCaseSnapshot, saveRcLinkedResult, readRcCaseTable, readRcCaseText, readRcCaseReview, readRcCaseChoices, readRcCaseOutput } from "./rcWorkbookApi";
import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { ReleaseCategoryInputs } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { withSourceTermSummary } from "interfaces-shared-types/rc-workbooks/source-term-summary";
import type { RcSiteReceptors } from "interfaces-mef-types/rc/site-receptors";
import type { RcWeatherInputs } from "interfaces-mef-types/rc/weather";
import type { RcTransportInputs } from "interfaces-mef-types/rc/transport";
import type { RcTransportActions } from "./rcWorkbookContext";
import type { RcDoseInputs } from "interfaces-mef-types/rc/dose-inputs";
import type { RcDoseActions } from "./rcWorkbookContext";
import { importRcDoseInput, saveRcDoseSettings, readRcDoseOriginal, readRcDoseRecords } from "./rcWorkbookApi";
import { importRcTransportFiles, saveRcTransportSettings, unlinkRcTransportFile, readRcTransportSource, readRcTransportOriginal, readRcTransportDecay } from "./rcWorkbookApi";
import type { RcWeatherActions } from "./rcWorkbookContext";
import { importRcWeatherInput, saveRcWeatherSettings, prepareRcWeatherCollection, readRcWeatherOriginal, readRcWeatherRecords } from "./rcWorkbookApi";
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
  importRcSiteInput,
  saveRcSiteSettings,
  readRcSiteOriginal,
  importRcSourceTerm,
  saveRcSourceTerm,
  getRcDocumentDownload,
  getRcExamples,
  loadRcExample,
  unloadRcExample,
  type RcWorkbookRoleName,
  type RcExampleOption,
} from "./rcWorkbookApi";
import { RcWorkbench, type RcWorkbenchActions } from "./rcWorkbench";
import { RcWorkbookProvider, type RcWorkbookData, type RcSourceTermActions, type RcSiteReceptorActions } from "./rcWorkbookContext";
import { useRcMefPatch } from "./useRcMefPatch";
import { LoadExampleModal, UnloadExampleModal } from "../workbooks/exampleWorkbookModal";
import { RcDocumentsCard } from "./rcDocumentsCard";
import { type RcPersona } from "./rcViewData";
import {
  loadEsHandoffSources,
  type EventSequenceFamilySource,
  type ReleaseCategorySource,
} from "../workbooks/riskWorkbookConnections";

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [loadExOpen, setLoadExOpen] = useState(false);
  const [unloadExOpen, setUnloadExOpen] = useState(false);
  const [hasPreviousMef, setHasPreviousMef] = useState(false);
  const [approvalRefresh, setApprovalRefresh] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [exampleOptions, setExampleOptions] = useState<RcExampleOption[]>([]);
  const [eventSequenceFamilySources, setEventSequenceFamilySources] = useState<EventSequenceFamilySource[]>([]);
  const [releaseCategorySources, setReleaseCategorySources] = useState<ReleaseCategorySource[]>([]);
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
          const options = await getRcExamples();
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
        try {
          const sources = await loadEsHandoffSources(workbook.projectId);
          if (!cancelled) {
            setEventSequenceFamilySources(sources.families);
            setReleaseCategorySources(sources.categories);
          }
        } catch {
          if (!cancelled) {
            setEventSequenceFamilySources([]);
            setReleaseCategorySources([]);
          }
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

  const handleSaveOk = useCallback((): void => { setSaveError(null); }, []);
  const handleSaveErr = useCallback((message: string): void => { setSaveError(message); }, []);
  const { patch, enqueue } = useRcMefPatch(id ?? "", data?.rc ?? null, handleSaveOk, handleSaveErr);
  const mutateRc = useCallback((mutator: (rc: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis): void => {
    setData((prev) => (prev === null ? prev : { ...prev, rc: mutator(prev.rc) }));
    void patch(mutator);
  }, [patch]);

  const sourceTerms = useMemo<RcSourceTermActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (category: ReleaseCategoryInputs): ReleaseCategoryInputs => {
      setData((previous) => previous === null ? previous : { ...previous, rc: { ...previous.rc,
        releaseCategoryToConsequence: { ...previous.rc.releaseCategoryToConsequence,
          releaseCategoryAndSourceTermReviewed: false,
          releaseCategoryInputs: previous.rc.releaseCategoryToConsequence.releaseCategoryInputs.map((c) =>
            c.releaseCategory === category.releaseCategory ? withSourceTermSummary({ ...c, sourceTerm: category.sourceTerm }) : c),
        },
      } });
      return category;
    };
    return {
      importFile: (category, revision, file) => enqueue(async () => accept(await importRcSourceTerm(id, category, revision, file))),
      saveValues: (category, revision, values) => enqueue(async () => accept(await saveRcSourceTerm(id, category, revision, values))),
      downloadOriginal: async (documentId) => {
        const result = await getRcDocumentDownload(id, documentId);
        window.open(result.url, "_blank", "noopener");
      },
    };
  }, [id, enqueue]);

  const actions = useMemo<RcWorkbenchActions | undefined>(() => {
    if (id === undefined) return undefined;
    return {
      postComment: async (text, severity, stepId): Promise<void> => {
        const rc = await enqueue(() => postWorkbookComment(id, { text, severity, associatedSr: STEP_SR_HINT[stepId] })) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      toggleResolve: async (commentId, nextResolved): Promise<void> => {
        const rc = await enqueue(() => patchWorkbookComment(id, commentId, { resolved: nextResolved })) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      submitForReview: async (): Promise<void> => {
        const rc = await enqueue(() => submitWorkbookForReview(id)) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
      requestRevision: async (note): Promise<void> => {
        const rc = await enqueue(() => requestWorkbookRevision(id, note)) as RadiologicalConsequenceAnalysis;
        updateRc(rc);
      },
    };
  }, [id, updateRc, enqueue]);

  const siteReceptors = useMemo<RcSiteReceptorActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (site: RcSiteReceptors) => {
      setData(previous => previous === null ? previous : { ...previous, rc: { ...previous.rc,
        protectiveActionParameters: { ...previous.rc.protectiveActionParameters, siteAndReceptors: site },
      } });
      return site;
    };
    return { importFile: (kind, revision, file) => enqueue(async () => accept(await importRcSiteInput(id, kind, revision, file))),
      saveSettings: (revision, settings) => enqueue(async () => accept(await saveRcSiteSettings(id, revision, settings))),
      readOriginal: documentId => readRcSiteOriginal(id, documentId) };
  }, [id, enqueue]);

  const weather = useMemo<RcWeatherActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (inputs: RcWeatherInputs) => {
      setData(previous => previous === null ? previous : { ...previous, rc: { ...previous.rc,
        meteorologicalData: { ...previous.rc.meteorologicalData, weatherInputs: inputs },
      } });
      return inputs;
    };
    return { importFile: (kind, revision, file) => enqueue(async () => accept(await importRcWeatherInput(id, kind, revision, file))),
      saveSettings: (revision, settings, confirm) => enqueue(async () => accept(await saveRcWeatherSettings(id, revision, settings, confirm))),
      prepareCollection: (revision, siteRevision, dates) => enqueue(async () => accept(await prepareRcWeatherCollection(id, revision, siteRevision, dates))),
      readOriginal: documentId => readRcWeatherOriginal(id, documentId), readRecords: offset => readRcWeatherRecords(id, offset) };
  }, [id, enqueue]);

  const caseRecords = useMemo<RcCaseActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (records: RcCaseRecords) => {
      setData(previous => previous === null ? previous : { ...previous, rc: { ...previous.rc, consequenceQuantification: { ...previous.rc.consequenceQuantification, caseRecords: records } } }); return records;
    };
    return { saveSnapshot: (revision, selection) => enqueue(async () => { const result = await saveRcCaseSnapshot(id, revision, selection); accept(result.records); return result; }),
      saveResult: (revision, values, file) => enqueue(async () => accept(await saveRcLinkedResult(id, revision, values, file))),
      readTable: (selection, kind, offset) => readRcCaseTable(id, selection, kind, offset), readText: (selection, fileId, offset) => readRcCaseText(id, selection, fileId, offset),
      readReview: selection => readRcCaseReview(id, selection), readChoices: (snapshotId, kind, search) => readRcCaseChoices(id, snapshotId, kind, search), readOutput: (resultId, offset) => readRcCaseOutput(id, resultId, offset) };
  }, [id, enqueue]);

  const doseInputs = useMemo<RcDoseActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (inputs: RcDoseInputs) => {
      setData(previous => previous === null ? previous : { ...previous, rc: { ...previous.rc, dosimetry: { ...previous.rc.dosimetry, doseInputs: inputs } } }); return inputs;
    };
    return { importFile: (kind, revision, file, category, sourceRevision) => enqueue(async () => accept(await importRcDoseInput(id, kind, revision, file, category, sourceRevision))),
      saveSettings: (revision, category, sourceRevision, settings) => enqueue(async () => accept(await saveRcDoseSettings(id, revision, category, sourceRevision, settings))),
      readOriginal: (documentId, offset) => readRcDoseOriginal(id, documentId, offset), readRecords: (documentId, nuclide) => readRcDoseRecords(id, documentId, nuclide) };
  }, [id, enqueue]);

  const transport = useMemo<RcTransportActions | undefined>(() => {
    if (!id) return undefined;
    const accept = (inputs: RcTransportInputs) => {
      setData(previous => previous === null ? previous : { ...previous, rc: { ...previous.rc,
        atmosphericTransportAndDispersion: { ...previous.rc.atmosphericTransportAndDispersion, transportInputs: inputs },
      } }); return inputs;
    };
    return { importFiles: (kind, revision, files, category, sourceRevision) => enqueue(async () => accept(await importRcTransportFiles(id, kind, revision, files, category, sourceRevision))),
      saveSettings: (revision, category, sourceRevision, settings) => enqueue(async () => accept(await saveRcTransportSettings(id, revision, category, sourceRevision, settings))),
      unlink: (revision, kind, documentId, categoryId) => enqueue(async () => accept(await unlinkRcTransportFile(id, revision, kind, documentId, categoryId))),
      readSource: category => readRcTransportSource(id, category), readOriginal: documentId => readRcTransportOriginal(id, documentId), readDecay: (documentId, index, offset) => readRcTransportDecay(id, documentId, index, offset) };
  }, [id, enqueue]);

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
  const editable = canEdit && persona === "preparer" && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canLoadExample = canEdit && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const canUnloadExample = canLoadExample && hasPreviousMef;

  return (
    <RcWorkbookProvider key={id} data={data} editable={editable} mutateRc={mutateRc} eventSequenceFamilySources={eventSequenceFamilySources} releaseCategorySources={releaseCategorySources} sourceTerms={sourceTerms} siteReceptors={siteReceptors} weather={weather} transport={transport} doseInputs={doseInputs} caseRecords={caseRecords}>
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
      {saveError !== null && (
        <div className="ie-savebar" role="alert">
          <span>Could not save changes: {saveError}</span>
          <button type="button" className="ie-savebar__dismiss" onClick={() => setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {rolesOpen && <WorkbookRolesModal workbookId={id} onClose={() => setRolesOpen(false)} onChanged={(res) => setMyRoles(res.myRoles as RcWorkbookRoleName[])} />}
      {loadExOpen && (
        <LoadExampleModal
          exampleName="RC"
          exampleOptions={exampleOptions}
          choiceLabel="Example"
          exampleNotices={{ "published-rc-inputs": "Numeric inputs in this example come from cited Sandia, NRC, thesis, NNDC and EPA sources. Original files and source references are included. It combines published examples for interface review, not one validated plant accident case. Unspecified settings remain open for the expert; no calculated results are invented." }}
          onCancel={() => setLoadExOpen(false)}
          onConfirm={async (exampleId) => {
            const res = await enqueue(() => loadRcExample(id, exampleId));
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
            const res = await enqueue(() => unloadRcExample(id));
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

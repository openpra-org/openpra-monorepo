import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { finishedRun, getAnalysisRun, awaitAnalysisRun, type RunProgressListener } from "../newly-developed-methods/shared/analysisRunWait";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkExecuteResult,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type {
  BayesianNetworkEvidenceConfiguration,
  FaultTreeTopEventReference,
  WorkbookModelAddress,
} from "interfaces-mef-types/modeling";
import type {
  HclBatchExecuteResult,
  HclBatchInput,
  HclHazardSweepSpec,
  HclGenerateScenariosResult,
  HclExecuteResult,
  HclCalculationType,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import {
  EsqImportanceRunResultSchema,
  EsqModelRunResultSchema,
  EsqPostRunResultSchema,
  EsqUncertaintyRunResultSchema,
  type EsqEventTreeRunLogic,
  type EsqImportanceRunResult,
  type EsqModelCalculation,
  type EsqModelRunHcl,
  type EsqModelRunResult,
  type EsqPostRunPurpose,
  type EsqPostRunResult,
  type EsqUncertaintyCorrelation,
  type EsqUncertaintyRunResult,
  type EventTreeSamplingMethod,
  type EventTreeAnalysisResult,
  type EventTreeCutSetSettings,
  type EventTreeExecuteResult,
  type EventTreeMonteCarloSettings,
  type EventTreeSuccessTreatment,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import {
  AnalysisRunDetailsSchema,
  AnalysisRunProvenanceListSchema,
  type AnalysisRunDetails,
  type AnalysisRunProgress,
  type AnalysisRunProvenanceList,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { esqCellRunId } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { esqModelRunId } from "interfaces-mef-types/esq/esq-solve-inputs";
import { esqUncertaintyRunId } from "interfaces-mef-types/esq/esq-measure-inputs";
import {
  EsqBarrierCellRunRequestSchema,
  LoadCapacityAnalysisResultSchema,
  type LoadCapacityAnalysisResult,
  type LoadCapacityExecuteResult,
  type LoadCapacityRunSettings,
} from "interfaces-shared-types/newly-developed-methods/load-capacity";

type EsqWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface EsqWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: EventSequenceQuantification;
  myRoles: EsqWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getEsqWorkbook(workbookId: string): Promise<EsqWorkbookResponse> {
  return fetchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`);
}

async function patchEsqWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: EventSequenceQuantification,
  mef: EventSequenceQuantification,
): Promise<EsqWorkbookResponse> {
  return patchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface EsqExampleOption {
  id: string;
  label: string;
}

async function getEsqExampleOptions(): Promise<EsqExampleOption[]> {
  return fetchJson<EsqExampleOption[]>("/api/example-workbooks/esq-examples");
}

async function loadEsqExample(workbookId: string, exampleId?: string): Promise<EsqWorkbookResponse> {
  return postJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadEsqExample(workbookId: string): Promise<EsqWorkbookResponse> {
  return postJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}/unload-example`, {});
}

interface EsqDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listEsqDocuments(workbookId: string): Promise<EsqDocumentEntry[]> {
  return fetchJson<EsqDocumentEntry[]>(`/api/esq-workbooks/${workbookId}/documents`);
}

async function uploadEsqDocument(workbookId: string, file: File): Promise<EsqDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<EsqDocumentEntry>(`/api/esq-workbooks/${workbookId}/documents`, form);
}

async function deleteEsqDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/esq-workbooks/${workbookId}/documents/${documentId}`);
}

async function getEsqDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/esq-workbooks/${workbookId}/documents/${documentId}/download`);
}

async function runEsqBayesianNetwork(
  workbookId: string,
  modelId: string,
  workbookRevision: number,
  evidence: BayesianNetworkEvidenceConfiguration,
  queryNodeId: string,
): Promise<BayesianNetworkExecuteResult> {
  return finishedRun("esq", workbookId, postJson<BayesianNetworkExecuteResult>(
    `/api/esq-workbooks/${workbookId}/bayesian-networks/${modelId}/runs`,
    {
      schemaVersion: "1.0.0",
      modelId,
      workbookRevision,
      query: { evidence, queryNodeIds: [queryNodeId] },
    },
  ));
}

async function getEsqBayesianNetworkResult(
  workbookId: string,
  modelId: string,
  runId: string,
): Promise<BayesianNetworkAnalysisResult> {
  return fetchJson<BayesianNetworkAnalysisResult>(
    `/api/esq-workbooks/${workbookId}/bayesian-networks/${modelId}/runs/${runId}/result`,
  );
}

async function runEsqHclFaultTree(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  faultTreeTopGate: FaultTreeTopEventReference,
  calculationType: HclCalculationType,
): Promise<HclExecuteResult> {
  return finishedRun("esq", workbookId, postJson<HclExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      calculationType,
      faultTreeTopGate,
    },
  ));
}

async function runEsqHclEventTree(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  eventTree: WorkbookModelAddress,
  calculationType: HclCalculationType,
  dependencyConfiguration?: WorkbookModelAddress,
): Promise<HclExecuteResult> {
  return finishedRun("esq", workbookId, postJson<HclExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/event-tree-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      calculationType,
      eventTree,
      ...(dependencyConfiguration === undefined ? {} : { dependencyConfiguration }),
    },
  ));
}

async function finishedHclBatch(workbookId: string, configurationId: string, started: Promise<HclBatchExecuteResult>): Promise<HclBatchExecuteResult> {
  const response = await started;
  if (response.batchId === undefined) return response;
  const batch = await awaitAnalysisRun("esq", workbookId, await getAnalysisRun("esq", workbookId, response.batchId));
  if (batch.status === "SUCCEEDED") {
    return fetchJson<HclBatchExecuteResult>(`/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/runs/${batch.id}/result`);
  }
  return { ...response, runs: await Promise.all(response.runs.map(async (row) => ({ ...row, run: await getAnalysisRun("esq", workbookId, row.run.id) }))) };
}

async function runEsqHclFaultTreeBatch(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  faultTreeTopGate: FaultTreeTopEventReference,
  calculationType: HclCalculationType,
  evidenceScenarioIds: string[],
  integrateHazardGrid = false,
  batchInput?: HclBatchInput,
): Promise<HclBatchExecuteResult> {
  return finishedHclBatch(workbookId, configurationId, postJson<HclBatchExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-batch-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      calculationType,
      faultTreeTopGate,
      evidenceScenarioIds,
      ...(batchInput === undefined ? {} : { batchInput }),
      ...(integrateHazardGrid ? { integrateHazardGrid: true } : {}),
    },
  ));
}

async function runEsqHclEventTreeBatch(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  eventTree: WorkbookModelAddress,
  calculationType: HclCalculationType,
  evidenceScenarioIds: string[],
  integrateHazardGrid = false,
  dependencyConfiguration?: WorkbookModelAddress,
  batchInput?: HclBatchInput,
): Promise<HclBatchExecuteResult> {
  return finishedHclBatch(workbookId, configurationId, postJson<HclBatchExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/event-tree-batch-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      calculationType,
      eventTree,
      ...(dependencyConfiguration === undefined ? {} : { dependencyConfiguration }),
      evidenceScenarioIds,
      ...(batchInput === undefined ? {} : { batchInput }),
      ...(integrateHazardGrid ? { integrateHazardGrid: true } : {}),
    },
  ));
}

async function getEsqHclFaultTreeResult(
  workbookId: string,
  configurationId: string,
  runId: string,
): Promise<HclQuantificationResult> {
  return fetchJson<HclQuantificationResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/runs/${runId}/result`,
  );
}

async function getEsqHclEventTreeResult(
  workbookId: string,
  configurationId: string,
  runId: string,
): Promise<EventTreeAnalysisResult> {
  return fetchJson<EventTreeAnalysisResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/runs/${runId}/result`,
  );
}

async function getEsqRunDetails(workbookId: string, runId: string): Promise<AnalysisRunDetails> {
  return AnalysisRunDetailsSchema.parse(await fetchJson<AnalysisRunDetails>(`/api/esq-workbooks/${workbookId}/analysis-runs/${runId}/details`));
}

async function getEsqRunWorkbook(workbookId: string, runId: string): Promise<EventSequenceQuantification> {
  return fetchJson<EventSequenceQuantification>(`/api/esq-workbooks/${workbookId}/analysis-runs/${runId}/workbook`);
}

async function listEsqRunsOf(workbookId: string, modelId: string): Promise<AnalysisRunProvenanceList> {
  return AnalysisRunProvenanceListSchema.parse(await fetchJson<AnalysisRunProvenanceList>(`/api/esq-workbooks/${workbookId}/analysis-runs?modelId=${encodeURIComponent(modelId)}`));
}

async function getEsqRunSourceRevision(workbookId: string, modelId: string, runId: string, sourceId: string): Promise<number | null> {
  const list = await listEsqRunsOf(workbookId, modelId);
  const run = list.runs.find((row) => row.run.id === runId)?.run;
  return run?.sourceWorkbooks.find((source) => source.workbookId === sourceId)?.workbookRevision ?? null;
}

interface EsqCellRunEntry {
  id: string;
  requestedAt: string;
  revision: number;
  status: string;
  settings?: LoadCapacityRunSettings;
  result?: LoadCapacityAnalysisResult;
  failure?: string;
}

async function runEsqBarrierCell(workbookId: string, cellId: string, workbookRevision: number, settings: LoadCapacityRunSettings, onProgress?: RunProgressListener): Promise<LoadCapacityExecuteResult> {
  return finishedRun("esq", workbookId, postJson<LoadCapacityExecuteResult>(`/api/esq-workbooks/${workbookId}/barrier-cells/${encodeURIComponent(cellId)}/runs`, {
    schemaVersion: "1.0.0",
    cellId,
    workbookRevision,
    settings,
  }), onProgress);
}

async function listEsqCellRuns(workbookId: string, cellId: string, limit = 12): Promise<EsqCellRunEntry[]> {
  const modelId = esqCellRunId(cellId);
  const list = await listEsqRunsOf(workbookId, modelId);
  const rows = list.runs.filter((row) => row.run.owner.modelId === modelId && row.run.methodType === "LOAD_CAPACITY").slice(0, limit);
  return Promise.all(rows.map(async (row): Promise<EsqCellRunEntry> => {
    const run: EsqCellRunEntry = { id: row.run.id, requestedAt: row.run.requestedAt, revision: row.run.owner.workbookRevision, status: row.run.status };
    const failure = row.run.failure?.message;
    if (failure !== undefined) run.failure = failure;
    if (row.run.status !== "SUCCEEDED") return run;
    const details = await getEsqRunDetails(workbookId, row.run.id);
    const request = EsqBarrierCellRunRequestSchema.safeParse(details.request);
    if (request.success) run.settings = request.data.settings;
    const result = LoadCapacityAnalysisResultSchema.safeParse(details.result);
    if (result.success) run.result = result.data;
    return run;
  }));
}

interface EsqModelRunEntry {
  id: string;
  requestedAt: string;
  revision: number;
  status: string;
  failure?: string;
  progress?: AnalysisRunProgress;
}

async function runEsqModel(
  workbookId: string,
  workbookRevision: number,
  logic: EsqEventTreeRunLogic,
  calculation: EsqModelCalculation,
  cutSets: EventTreeCutSetSettings | undefined,
  hcl?: EsqModelRunHcl,
  onProgress?: RunProgressListener,
  treeIds?: readonly string[],
  engine?: { successTreatment?: EventTreeSuccessTreatment; monteCarlo?: EventTreeMonteCarloSettings },
): Promise<EventTreeExecuteResult> {
  return finishedRun("esq", workbookId, postJson<EventTreeExecuteResult>(`/api/esq-workbooks/${workbookId}/model-runs`, {
    schemaVersion: "1.0.0",
    workbookRevision,
    logic,
    calculation,
    ...(cutSets === undefined ? {} : { cutSets }),
    ...(engine?.successTreatment === undefined ? {} : { successTreatment: engine.successTreatment }),
    ...(engine?.monteCarlo === undefined ? {} : { monteCarlo: { ...engine.monteCarlo } }),
    ...(hcl === undefined ? {} : { hcl }),
    ...(treeIds === undefined ? {} : { treeIds: [...treeIds] }),
  }), onProgress);
}

async function getEsqModelRunResult(workbookId: string, runId: string): Promise<EsqModelRunResult> {
  return EsqModelRunResultSchema.parse(await fetchJson<EsqModelRunResult>(`/api/esq-workbooks/${workbookId}/model-runs/${runId}/result`));
}

async function listEsqModelRuns(workbookId: string, limit = 12): Promise<EsqModelRunEntry[]> {
  return listEsqBatchRuns(workbookId, esqModelRunId(), limit);
}

async function listEsqUncertaintyRuns(workbookId: string, limit = 12): Promise<EsqModelRunEntry[]> {
  return listEsqBatchRuns(workbookId, esqUncertaintyRunId(), limit);
}

async function listEsqBatchRuns(workbookId: string, modelId: string, limit: number): Promise<EsqModelRunEntry[]> {
  const list = await listEsqRunsOf(workbookId, modelId);
  return list.runs
    .filter((row) => row.run.owner.modelId === modelId && row.run.scope === "BATCH")
    .slice(0, limit)
    .map((row) => {
      const run: EsqModelRunEntry = { id: row.run.id, requestedAt: row.run.requestedAt, revision: row.run.owner.workbookRevision, status: row.run.status };
      const failure = row.run.failure?.message;
      if (failure !== undefined) run.failure = failure;
      if (row.run.progress !== undefined) run.progress = row.run.progress;
      return run;
    });
}

async function runEsqPost(
  workbookId: string,
  workbookRevision: number,
  logic: EsqEventTreeRunLogic,
  purpose: EsqPostRunPurpose,
  cutOff: number,
  raisedHep?: number,
  onProgress?: RunProgressListener,
): Promise<EventTreeExecuteResult> {
  return finishedRun("esq", workbookId, postJson<EventTreeExecuteResult>(`/api/esq-workbooks/${workbookId}/post-runs`, {
    schemaVersion: "1.0.0",
    workbookRevision,
    logic,
    purpose,
    cutOff,
    ...(raisedHep === undefined ? {} : { raisedHep }),
  }), onProgress);
}

async function getEsqPostResult(workbookId: string, runId: string): Promise<EsqPostRunResult> {
  return EsqPostRunResultSchema.parse(await fetchJson<EsqPostRunResult>(`/api/esq-workbooks/${workbookId}/post-runs/${runId}/result`));
}

async function runEsqImportance(workbookId: string, workbookRevision: number, logic: EsqEventTreeRunLogic, onProgress?: RunProgressListener): Promise<EventTreeExecuteResult> {
  return finishedRun("esq", workbookId, postJson<EventTreeExecuteResult>(`/api/esq-workbooks/${workbookId}/importance-runs`, { schemaVersion: "1.0.0", workbookRevision, logic }), onProgress);
}

async function getEsqImportanceResult(workbookId: string, runId: string): Promise<EsqImportanceRunResult> {
  return EsqImportanceRunResultSchema.parse(await fetchJson<EsqImportanceRunResult>(`/api/esq-workbooks/${workbookId}/importance-runs/${runId}/result`));
}

interface EsqUncertaintySettings {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
}

async function runEsqUncertainty(
  workbookId: string,
  workbookRevision: number,
  logic: EsqEventTreeRunLogic,
  settings: EsqUncertaintySettings,
  onProgress?: RunProgressListener,
  treeIds?: readonly string[],
): Promise<EventTreeExecuteResult> {
  return finishedRun("esq", workbookId, postJson<EventTreeExecuteResult>(`/api/esq-workbooks/${workbookId}/uncertainty-runs`, {
    schemaVersion: "1.0.0",
    workbookRevision,
    logic,
    trials: settings.trials,
    seed: settings.seed,
    method: settings.method,
    correlation: settings.correlation,
    ...(treeIds === undefined ? {} : { treeIds: [...treeIds] }),
  }), onProgress);
}

async function getEsqUncertaintyResult(workbookId: string, runId: string): Promise<EsqUncertaintyRunResult> {
  return EsqUncertaintyRunResultSchema.parse(await fetchJson<EsqUncertaintyRunResult>(`/api/esq-workbooks/${workbookId}/uncertainty-runs/${runId}/result`));
}

async function runEsqSensitivity(
  workbookId: string,
  caseId: string,
  workbookRevision: number,
  logic: EsqEventTreeRunLogic,
  calculation: EsqModelCalculation,
  cutSets: EventTreeCutSetSettings | undefined,
  onProgress?: RunProgressListener,
): Promise<EventTreeExecuteResult> {
  return finishedRun("esq", workbookId, postJson<EventTreeExecuteResult>(`/api/esq-workbooks/${workbookId}/sensitivity-cases/${encodeURIComponent(caseId)}/runs`, {
    schemaVersion: "1.0.0",
    workbookRevision,
    caseId,
    logic,
    calculation,
    ...(cutSets === undefined ? {} : { cutSets }),
  }), onProgress);
}

async function getEsqSensitivityResult(workbookId: string, caseId: string, runId: string): Promise<EsqModelRunResult> {
  return EsqModelRunResultSchema.parse(await fetchJson<EsqModelRunResult>(`/api/esq-workbooks/${workbookId}/sensitivity-cases/${encodeURIComponent(caseId)}/runs/${runId}/result`));
}

export {
  runEsqModel,
  runEsqPost,
  getEsqPostResult,
  runEsqImportance,
  getEsqImportanceResult,
  runEsqUncertainty,
  getEsqUncertaintyResult,
  listEsqUncertaintyRuns,
  runEsqSensitivity,
  getEsqSensitivityResult,
  type EsqUncertaintySettings,
  getEsqModelRunResult,
  listEsqModelRuns,
  type EsqModelRunEntry,
  getEsqRunDetails,
  getEsqRunWorkbook,
  getEsqRunSourceRevision,
  runEsqBarrierCell,
  listEsqCellRuns,
  type EsqCellRunEntry,
  getEsqExampleOptions,
  getEsqWorkbook,
  patchEsqWorkbook,
  loadEsqExample,
  unloadEsqExample,
  listEsqDocuments,
  uploadEsqDocument,
  deleteEsqDocument,
  getEsqDocumentDownload,
  runEsqBayesianNetwork,
  getEsqBayesianNetworkResult,
  runEsqHclFaultTree,
  runEsqHclEventTree,
  runEsqHclFaultTreeBatch,
  runEsqHclEventTreeBatch,
  getEsqHclFaultTreeResult,
  getEsqHclEventTreeResult,
  type EsqWorkbookResponse,
  type EsqWorkbookRoleName,
  type EsqExampleOption,
  type EsqDocumentEntry,
};

export async function generateEsqHclScenarios(
  workbookId: string, configurationId: string, workbookRevision: number,
  spec: HclHazardSweepSpec, dependencyConfiguration?: WorkbookModelAddress,
): Promise<HclGenerateScenariosResult> {
  return postJson<HclGenerateScenariosResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/generate-scenarios`,
    { schemaVersion: "1.0.0", modelId: configurationId, workbookRevision, spec,
      ...(dependencyConfiguration === undefined ? {} : { dependencyConfiguration }),
    },
  );
}

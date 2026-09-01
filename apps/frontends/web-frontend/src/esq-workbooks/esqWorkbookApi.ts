import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  DynamicRun,
  EventSequence,
  EventTree,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { type EsqLinkedInputs } from "./esqWorkbookContext";
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
  HclExecuteResult,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { AnalysisRunProvenanceList } from "interfaces-shared-types/newly-developed-methods";

interface LinkedPosMef { plantOperatingStates?: { uuid: string; name: string; operatingMode?: string; meanDurationHours: number }[] }
interface LinkedIeMef { initiatingEventGroups?: { uuid: string; name: string; meanFrequency?: { value: number } }[] }
interface LinkedEsMef {
  eventSequenceFamilies?: { uuid: string; name: string }[];
  eventTrees?: EventTree[];
  eventSequences?: EventSequence[];
  dynamicRuns?: DynamicRun[];
}
interface LinkedScMef { missionTimes?: { uuid: string; eventSequenceReference: string; missionTimeHours: number }[] }
interface LinkedSyMef { systemDefinitions?: { uuid: string; name: string }[] }
interface LinkedHrMef { hepQuantifications?: { uuid: string; hfeId?: string; meanHep?: number; pointEstimateHep?: number }[] }
interface LinkedDaMef { parameters?: { uuid: string; name: string; value: number }[] }

async function fetchEsqLinkedInputs(variant: string): Promise<EsqLinkedInputs> {
  if (variant === "hcl") {
    const [ieB, esB, syB] = await Promise.all([
      fetchJson<{ ie: { mef: LinkedIeMef } }>(`/api/example-workbooks/ie-bundle?example=${variant}`),
      fetchJson<{ es: { mef: LinkedEsMef } }>(`/api/example-workbooks/es-bundle?example=${variant}`),
      fetchJson<{ sy: { mef: LinkedSyMef } }>(`/api/example-workbooks/sy-bundle?example=${variant}`),
    ]);
    return {
      posStates: [],
      ieGroups: (ieB.ie.mef.initiatingEventGroups ?? []).filter((group) => group.meanFrequency !== undefined).map((group) => ({ id: group.uuid, name: group.name, frequency: group.meanFrequency?.value ?? 0 })),
      esFamilies: (esB.es.mef.eventSequenceFamilies ?? []).map((family) => ({ id: family.uuid, name: family.name })),
      eventTrees: esB.es.mef.eventTrees ?? [],
      eventSequences: esB.es.mef.eventSequences ?? [],
      dynamicRuns: esB.es.mef.dynamicRuns ?? [],
      scMissionTimes: [],
      sySystems: (syB.sy.mef.systemDefinitions ?? []).map((system) => ({ id: system.uuid, name: system.name })),
      hrActions: [],
      daParams: [],
    };
  }
  const [posB, ieB, esB, scB, syB, hrB, daB] = await Promise.all([
    fetchJson<{ pos: { mef: LinkedPosMef } }>(`/api/example-workbooks/pos-bundle?example=${variant}`),
    fetchJson<{ ie: { mef: LinkedIeMef } }>(`/api/example-workbooks/ie-bundle?example=${variant}`),
    fetchJson<{ es: { mef: LinkedEsMef } }>(`/api/example-workbooks/es-bundle?example=${variant}`),
    fetchJson<{ sc: { mef: LinkedScMef } }>(`/api/example-workbooks/sc-bundle?example=${variant}`),
    fetchJson<{ sy: { mef: LinkedSyMef } }>(`/api/example-workbooks/sy-bundle?example=${variant}`),
    fetchJson<{ hr: { mef: LinkedHrMef } }>(`/api/example-workbooks/hr-bundle?example=${variant}`),
    fetchJson<{ da: { mef: LinkedDaMef } }>(`/api/example-workbooks/da-bundle?example=${variant}`),
  ]);
  return {
    posStates: (posB.pos.mef.plantOperatingStates ?? []).map((s) => ({ id: s.uuid, name: s.name, mode: s.operatingMode ?? "—", durationHours: s.meanDurationHours })),
    ieGroups: (ieB.ie.mef.initiatingEventGroups ?? []).filter((g) => g.meanFrequency !== undefined).map((g) => ({ id: g.uuid, name: g.name, frequency: g.meanFrequency?.value ?? 0 })),
    esFamilies: (esB.es.mef.eventSequenceFamilies ?? []).map((f) => ({ id: f.uuid, name: f.name })),
    eventTrees: esB.es.mef.eventTrees ?? [],
    eventSequences: esB.es.mef.eventSequences ?? [],
    dynamicRuns: esB.es.mef.dynamicRuns ?? [],
    scMissionTimes: (scB.sc.mef.missionTimes ?? []).map((m) => ({ id: m.uuid, sequence: m.eventSequenceReference, hours: m.missionTimeHours })),
    sySystems: (syB.sy.mef.systemDefinitions ?? []).map((s) => ({ id: s.uuid, name: s.name })),
    hrActions: (hrB.hr.mef.hepQuantifications ?? []).map((h) => ({ id: h.uuid, hfe: h.hfeId ?? "—", mean: h.meanHep ?? h.pointEstimateHep ?? 0 })),
    daParams: (daB.da.mef.parameters ?? []).map((p) => ({ id: p.uuid, name: p.name, value: p.value })),
  };
}

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

async function getEsqAnalysisRunProvenance(
  workbookId: string,
): Promise<AnalysisRunProvenanceList> {
  return fetchJson<AnalysisRunProvenanceList>(
    `/api/esq-workbooks/${workbookId}/analysis-runs`,
  );
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
  return postJson<BayesianNetworkExecuteResult>(
    `/api/esq-workbooks/${workbookId}/bayesian-networks/${modelId}/runs`,
    {
      schemaVersion: "1.0.0",
      modelId,
      workbookRevision,
      query: { evidence, queryNodeIds: [queryNodeId] },
    },
  );
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
): Promise<HclExecuteResult> {
  return postJson<HclExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      faultTreeTopGate,
    },
  );
}

async function runEsqHclEventTree(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  eventTree: WorkbookModelAddress,
): Promise<HclExecuteResult> {
  return postJson<HclExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/event-tree-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      eventTree,
    },
  );
}

async function runEsqHclFaultTreeBatch(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  faultTreeTopGate: FaultTreeTopEventReference,
  evidenceScenarioIds: string[],
  integrateHazardGrid = false,
): Promise<HclBatchExecuteResult> {
  return postJson<HclBatchExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-batch-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      faultTreeTopGate,
      evidenceScenarioIds,
      ...(integrateHazardGrid ? { integrateHazardGrid: true } : {}),
    },
  );
}

async function runEsqHclEventTreeBatch(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  eventTree: WorkbookModelAddress,
  evidenceScenarioIds: string[],
  integrateHazardGrid = false,
): Promise<HclBatchExecuteResult> {
  return postJson<HclBatchExecuteResult>(
    `/api/esq-workbooks/${workbookId}/hcl-configurations/${configurationId}/event-tree-batch-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      eventTree,
      evidenceScenarioIds,
      ...(integrateHazardGrid ? { integrateHazardGrid: true } : {}),
    },
  );
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

export {
  fetchEsqLinkedInputs,
  getEsqExampleOptions,
  getEsqWorkbook,
  getEsqAnalysisRunProvenance,
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

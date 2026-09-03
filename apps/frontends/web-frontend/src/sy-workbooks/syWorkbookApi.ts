import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type {
  FaultTreeAnalysisResult,
  FaultTreeExecuteResult,
  FaultTreeValidateResult,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type {
  BayesianNetworkAnalysisResult,
  BayesianNetworkExecuteResult,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import type {
  BayesianNetworkEvidenceConfiguration,
  FaultTreeTopEventReference,
} from "interfaces-mef-types/modeling";
import type {
  HclBatchExecuteResult,
  HclExecuteResult,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

type SyWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface SyWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: SystemsAnalysis;
  myRoles: SyWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getSyWorkbook(workbookId: string): Promise<SyWorkbookResponse> {
  return fetchJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}`);
}

async function patchSyWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: SystemsAnalysis,
  mef: SystemsAnalysis,
): Promise<SyWorkbookResponse> {
  return patchJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface SyExampleOption {
  id: string;
  label: string;
}

async function getSyExampleOptions(): Promise<SyExampleOption[]> {
  return fetchJson<SyExampleOption[]>("/api/example-workbooks/sy-examples");
}

async function loadSyExample(workbookId: string, exampleId?: string): Promise<SyWorkbookResponse> {
  return postJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadSyExample(workbookId: string): Promise<SyWorkbookResponse> {
  return postJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}/unload-example`, {});
}

interface SyDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listSyDocuments(workbookId: string): Promise<SyDocumentEntry[]> {
  return fetchJson<SyDocumentEntry[]>(`/api/sy-workbooks/${workbookId}/documents`);
}

async function uploadSyDocument(workbookId: string, file: File): Promise<SyDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<SyDocumentEntry>(`/api/sy-workbooks/${workbookId}/documents`, form);
}

async function deleteSyDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/sy-workbooks/${workbookId}/documents/${documentId}`);
}

async function getSyDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/sy-workbooks/${workbookId}/documents/${documentId}/download`);
}

async function runSyFaultTree(
  workbookId: string,
  modelId: string,
  workbookRevision: number,
): Promise<FaultTreeExecuteResult> {
  return postJson<FaultTreeExecuteResult>(
    `/api/sy-workbooks/${workbookId}/fault-trees/${modelId}/runs`,
    { schemaVersion: "1.0.0", modelId, workbookRevision },
  );
}

async function validateSyFaultTree(
  workbookId: string,
  modelId: string,
  workbookRevision: number,
): Promise<FaultTreeValidateResult> {
  return postJson<FaultTreeValidateResult>(
    `/api/sy-workbooks/${workbookId}/fault-trees/${modelId}/validate`,
    { schemaVersion: "1.0.0", modelId, workbookRevision, mode: "ANALYSIS_READY" },
  );
}

async function getSyFaultTreeResult(
  workbookId: string,
  modelId: string,
  runId: string,
): Promise<FaultTreeAnalysisResult> {
  return fetchJson<FaultTreeAnalysisResult>(
    `/api/sy-workbooks/${workbookId}/fault-trees/${modelId}/runs/${runId}/result`,
  );
}

async function runSyBayesianNetwork(
  workbookId: string,
  modelId: string,
  workbookRevision: number,
  evidence: BayesianNetworkEvidenceConfiguration,
  queryNodeId: string,
): Promise<BayesianNetworkExecuteResult> {
  return postJson<BayesianNetworkExecuteResult>(
    `/api/sy-workbooks/${workbookId}/bayesian-networks/${modelId}/runs`,
    {
      schemaVersion: "1.0.0",
      modelId,
      workbookRevision,
      query: { evidence, queryNodeIds: [queryNodeId] },
    },
  );
}

async function getSyBayesianNetworkResult(
  workbookId: string,
  modelId: string,
  runId: string,
): Promise<BayesianNetworkAnalysisResult> {
  return fetchJson<BayesianNetworkAnalysisResult>(
    `/api/sy-workbooks/${workbookId}/bayesian-networks/${modelId}/runs/${runId}/result`,
  );
}

async function runSyHclFaultTree(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  faultTreeTopGate: FaultTreeTopEventReference,
  evidenceScenarioId?: string,
): Promise<HclExecuteResult> {
  return postJson<HclExecuteResult>(
    `/api/sy-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-runs`,
    {
      schemaVersion: "1.0.0",
      modelId: configurationId,
      workbookRevision,
      faultTreeTopGate,
      ...(evidenceScenarioId === undefined ? {} : { evidenceScenarioId }),
    },
  );
}

async function runSyHclFaultTreeBatch(
  workbookId: string,
  configurationId: string,
  workbookRevision: number,
  faultTreeTopGate: FaultTreeTopEventReference,
  evidenceScenarioIds: string[],
  integrateHazardGrid = false,
): Promise<HclBatchExecuteResult> {
  return postJson<HclBatchExecuteResult>(
    `/api/sy-workbooks/${workbookId}/hcl-configurations/${configurationId}/fault-tree-batch-runs`,
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

async function getSyHclFaultTreeResult(
  workbookId: string,
  configurationId: string,
  runId: string,
): Promise<HclQuantificationResult> {
  return fetchJson<HclQuantificationResult>(
    `/api/sy-workbooks/${workbookId}/hcl-configurations/${configurationId}/runs/${runId}/result`,
  );
}

export {
  getSyWorkbook,
  patchSyWorkbook,
  getSyExampleOptions,
  loadSyExample,
  unloadSyExample,
  listSyDocuments,
  uploadSyDocument,
  deleteSyDocument,
  getSyDocumentDownload,
  runSyFaultTree,
  validateSyFaultTree,
  getSyFaultTreeResult,
  runSyBayesianNetwork,
  getSyBayesianNetworkResult,
  runSyHclFaultTree,
  runSyHclFaultTreeBatch,
  getSyHclFaultTreeResult,
  type SyWorkbookResponse,
  type SyWorkbookRoleName,
  type SyExampleOption,
  type SyDocumentEntry,
};

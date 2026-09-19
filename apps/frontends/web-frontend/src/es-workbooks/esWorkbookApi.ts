import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type {
  EventTreeAnalysisResult,
  EventTreeExecuteResult,
} from "interfaces-shared-types/newly-developed-methods/event-tree";

type EsWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface EsWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: EventSequenceAnalysis;
  myRoles: EsWorkbookRoleName[];
  hasPreviousMef: boolean;
  linkedPosWorkbookId: string | null;
  linkedIeWorkbookId: string | null;
  updatedAt: string;
}

async function getEsWorkbook(workbookId: string): Promise<EsWorkbookResponse> {
  return fetchJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}`);
}

async function patchEsWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: EventSequenceAnalysis,
  mef: EventSequenceAnalysis,
): Promise<EsWorkbookResponse> {
  return patchJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface EsExampleOption {
  id: string;
  label: string;
}

async function getEsExampleOptions(): Promise<EsExampleOption[]> {
  return fetchJson<EsExampleOption[]>("/api/example-workbooks/es-examples");
}

async function loadEsExample(workbookId: string, exampleId?: string): Promise<EsWorkbookResponse> {
  return postJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadEsExample(workbookId: string): Promise<EsWorkbookResponse> {
  return postJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}/unload-example`, {});
}

async function runEsEventTree(
  workbookId: string,
  modelId: string,
  workbookRevision: number,
): Promise<EventTreeExecuteResult> {
  return postJson<EventTreeExecuteResult>(`/api/es-workbooks/${workbookId}/event-trees/${modelId}/runs`, {
    schemaVersion: "1.0.0",
    modelId,
    workbookRevision,
    mode: "INDEPENDENT",
  });
}

async function getEsEventTreeResult(
  workbookId: string,
  modelId: string,
  runId: string,
): Promise<EventTreeAnalysisResult> {
  return fetchJson<EventTreeAnalysisResult>(`/api/es-workbooks/${workbookId}/event-trees/${modelId}/runs/${runId}/result`);
}

interface ImportedPosState {
  id: string;
  name: string;
  operatingMode: string;
  meanDurationHours: number;
  meanEntryFrequency: number;
}

interface ImportedPosSource {
  id: string;
  name: string;
  location: string;
  barriers: string[];
}

interface EsPosLinkStatus {
  linkedPosWorkbookId: string | null;
  linkedName: string | null;
  states: ImportedPosState[];
  sources: ImportedPosSource[];
}

interface AvailablePosWorkbook {
  workbookId: string;
  name: string;
  workflowState: string;
  stateCount: number;
  sourceCount: number;
  updatedAt: string;
}

async function getEsPosLink(workbookId: string): Promise<EsPosLinkStatus> {
  return fetchJson<EsPosLinkStatus>(`/api/es-workbooks/${workbookId}/pos-link`);
}

async function getAvailablePosWorkbooks(workbookId: string): Promise<AvailablePosWorkbook[]> {
  return fetchJson<AvailablePosWorkbook[]>(`/api/es-workbooks/${workbookId}/pos-link/available`);
}

async function linkPosWorkbook(workbookId: string, posWorkbookId: string): Promise<EsPosLinkStatus> {
  return postJson<EsPosLinkStatus>(`/api/es-workbooks/${workbookId}/pos-link`, { posWorkbookId });
}

async function unlinkPosWorkbook(workbookId: string): Promise<EsPosLinkStatus> {
  return postJson<EsPosLinkStatus>(`/api/es-workbooks/${workbookId}/pos-link/unlink`, {});
}

interface ImportedIeInitiator {
  id: string;
  name: string;
  category: string;
}

interface EsIeLinkStatus {
  linkedIeWorkbookId: string | null;
  linkedName: string | null;
  initiators: ImportedIeInitiator[];
}

interface AvailableIeWorkbook {
  workbookId: string;
  name: string;
  workflowState: string;
  initiatorCount: number;
  groupCount: number;
  updatedAt: string;
}

async function getEsIeLink(workbookId: string): Promise<EsIeLinkStatus> {
  return fetchJson<EsIeLinkStatus>(`/api/es-workbooks/${workbookId}/ie-link`);
}

async function getAvailableIeWorkbooks(workbookId: string): Promise<AvailableIeWorkbook[]> {
  return fetchJson<AvailableIeWorkbook[]>(`/api/es-workbooks/${workbookId}/ie-link/available`);
}

async function linkIeWorkbook(workbookId: string, ieWorkbookId: string): Promise<EsIeLinkStatus> {
  return postJson<EsIeLinkStatus>(`/api/es-workbooks/${workbookId}/ie-link`, { ieWorkbookId });
}

async function unlinkIeWorkbook(workbookId: string): Promise<EsIeLinkStatus> {
  return postJson<EsIeLinkStatus>(`/api/es-workbooks/${workbookId}/ie-link/unlink`, {});
}

export {
  getEsWorkbook,
  patchEsWorkbook,
  getEsExampleOptions,
  loadEsExample,
  unloadEsExample,
  runEsEventTree,
  getEsEventTreeResult,
  type EsExampleOption,
  getEsPosLink,
  getAvailablePosWorkbooks,
  linkPosWorkbook,
  unlinkPosWorkbook,
  getEsIeLink,
  getAvailableIeWorkbooks,
  linkIeWorkbook,
  unlinkIeWorkbook,
  type EsWorkbookResponse,
  type EsWorkbookRoleName,
  type EsPosLinkStatus,
  type AvailablePosWorkbook,
  type ImportedPosState,
  type ImportedPosSource,
  type EsIeLinkStatus,
  type AvailableIeWorkbook,
  type ImportedIeInitiator,
};

interface EsDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listEsDocuments(workbookId: string): Promise<EsDocumentEntry[]> {
  return fetchJson<EsDocumentEntry[]>(`/api/es-workbooks/${workbookId}/documents`);
}

async function uploadEsDocument(workbookId: string, file: File): Promise<EsDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<EsDocumentEntry>(`/api/es-workbooks/${workbookId}/documents`, form);
}

async function deleteEsDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/es-workbooks/${workbookId}/documents/${documentId}`);
}

async function getEsDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/es-workbooks/${workbookId}/documents/${documentId}/download`);
}

export { listEsDocuments, uploadEsDocument, deleteEsDocument, getEsDocumentDownload, type EsDocumentEntry };

import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";

type EsWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface EsWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: EventSequenceAnalysis;
  myRoles: EsWorkbookRoleName[];
  hasPreviousMef: boolean;
  linkedIeWorkbookId: string | null;
  linkedPosWorkbookId: string | null;
  updatedAt: string;
}

async function getEsWorkbook(workbookId: string): Promise<EsWorkbookResponse> {
  return fetchJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}`);
}

async function patchEsWorkbook(workbookId: string, mef: EventSequenceAnalysis): Promise<EsWorkbookResponse> {
  return patchJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}`, { mef });
}

async function loadEsExample(workbookId: string): Promise<EsWorkbookResponse> {
  return postJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}/load-example`, {});
}

async function unloadEsExample(workbookId: string): Promise<EsWorkbookResponse> {
  return postJson<EsWorkbookResponse>(`/api/es-workbooks/${workbookId}/unload-example`, {});
}

interface ImportedIeGroup {
  id: string;
  name: string;
  memberCount: number;
  meanFrequency: number | null;
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

interface EsUpstreamLinkStatus {
  linkedIeWorkbookId: string | null;
  linkedIeName: string | null;
  initiatingEventGroups: ImportedIeGroup[];
  linkedPosWorkbookId: string | null;
  linkedPosName: string | null;
  states: ImportedPosState[];
  sources: ImportedPosSource[];
}

async function getEsUpstreamLink(workbookId: string): Promise<EsUpstreamLinkStatus> {
  return fetchJson<EsUpstreamLinkStatus>(`/api/es-workbooks/${workbookId}/upstream-link`);
}

async function linkIeWorkbook(workbookId: string, ieWorkbookId: string): Promise<EsUpstreamLinkStatus> {
  return postJson<EsUpstreamLinkStatus>(`/api/es-workbooks/${workbookId}/upstream-link/link-ie`, { ieWorkbookId });
}

async function linkPosWorkbook(workbookId: string, posWorkbookId: string): Promise<EsUpstreamLinkStatus> {
  return postJson<EsUpstreamLinkStatus>(`/api/es-workbooks/${workbookId}/upstream-link/link-pos`, { posWorkbookId });
}

async function unlinkUpstream(workbookId: string): Promise<EsUpstreamLinkStatus> {
  return postJson<EsUpstreamLinkStatus>(`/api/es-workbooks/${workbookId}/upstream-link/unlink`, {});
}

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

export {
  getEsWorkbook,
  patchEsWorkbook,
  loadEsExample,
  unloadEsExample,
  getEsUpstreamLink,
  linkIeWorkbook,
  linkPosWorkbook,
  unlinkUpstream,
  listEsDocuments,
  uploadEsDocument,
  deleteEsDocument,
  getEsDocumentDownload,
  type EsWorkbookResponse,
  type EsWorkbookRoleName,
  type EsUpstreamLinkStatus,
  type ImportedIeGroup,
  type ImportedPosState,
  type ImportedPosSource,
  type EsDocumentEntry,
};

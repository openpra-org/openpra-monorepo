import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";

type EsqWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface EsqWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: EventSequenceQuantification;
  myRoles: EsqWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getEsqWorkbook(workbookId: string): Promise<EsqWorkbookResponse> {
  return fetchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`);
}

async function patchEsqWorkbook(workbookId: string, mef: EventSequenceQuantification): Promise<EsqWorkbookResponse> {
  return patchJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}`, { mef });
}

async function loadEsqExample(workbookId: string): Promise<EsqWorkbookResponse> {
  return postJson<EsqWorkbookResponse>(`/api/esq-workbooks/${workbookId}/load-example`, {});
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

export {
  getEsqWorkbook,
  patchEsqWorkbook,
  loadEsqExample,
  unloadEsqExample,
  listEsqDocuments,
  uploadEsqDocument,
  deleteEsqDocument,
  getEsqDocumentDownload,
  type EsqWorkbookResponse,
  type EsqWorkbookRoleName,
  type EsqDocumentEntry,
};

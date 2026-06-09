import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";

type ScWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface ScWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: SuccessCriteriaDevelopment;
  myRoles: ScWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getScWorkbook(workbookId: string): Promise<ScWorkbookResponse> {
  return fetchJson<ScWorkbookResponse>(`/api/sc-workbooks/${workbookId}`);
}

async function patchScWorkbook(workbookId: string, mef: SuccessCriteriaDevelopment): Promise<ScWorkbookResponse> {
  return patchJson<ScWorkbookResponse>(`/api/sc-workbooks/${workbookId}`, { mef });
}

async function loadScExample(workbookId: string): Promise<ScWorkbookResponse> {
  return postJson<ScWorkbookResponse>(`/api/sc-workbooks/${workbookId}/load-example`, {});
}

async function unloadScExample(workbookId: string): Promise<ScWorkbookResponse> {
  return postJson<ScWorkbookResponse>(`/api/sc-workbooks/${workbookId}/unload-example`, {});
}

interface ScDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listScDocuments(workbookId: string): Promise<ScDocumentEntry[]> {
  return fetchJson<ScDocumentEntry[]>(`/api/sc-workbooks/${workbookId}/documents`);
}

async function uploadScDocument(workbookId: string, file: File): Promise<ScDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<ScDocumentEntry>(`/api/sc-workbooks/${workbookId}/documents`, form);
}

async function deleteScDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/sc-workbooks/${workbookId}/documents/${documentId}`);
}

async function getScDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/sc-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getScWorkbook,
  patchScWorkbook,
  loadScExample,
  unloadScExample,
  listScDocuments,
  uploadScDocument,
  deleteScDocument,
  getScDocumentDownload,
  type ScWorkbookResponse,
  type ScWorkbookRoleName,
  type ScDocumentEntry,
};

import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";

type DaWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface DaWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: DataAnalysis;
  myRoles: DaWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getDaWorkbook(workbookId: string): Promise<DaWorkbookResponse> {
  return fetchJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}`);
}

async function patchDaWorkbook(workbookId: string, mef: DataAnalysis): Promise<DaWorkbookResponse> {
  return patchJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}`, { mef });
}

async function loadDaExample(workbookId: string): Promise<DaWorkbookResponse> {
  return postJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}/load-example`, {});
}

async function unloadDaExample(workbookId: string): Promise<DaWorkbookResponse> {
  return postJson<DaWorkbookResponse>(`/api/da-workbooks/${workbookId}/unload-example`, {});
}

interface DaDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listDaDocuments(workbookId: string): Promise<DaDocumentEntry[]> {
  return fetchJson<DaDocumentEntry[]>(`/api/da-workbooks/${workbookId}/documents`);
}

async function uploadDaDocument(workbookId: string, file: File): Promise<DaDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<DaDocumentEntry>(`/api/da-workbooks/${workbookId}/documents`, form);
}

async function deleteDaDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/da-workbooks/${workbookId}/documents/${documentId}`);
}

async function getDaDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/da-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getDaWorkbook,
  patchDaWorkbook,
  loadDaExample,
  unloadDaExample,
  listDaDocuments,
  uploadDaDocument,
  deleteDaDocument,
  getDaDocumentDownload,
  type DaWorkbookResponse,
  type DaWorkbookRoleName,
  type DaDocumentEntry,
};

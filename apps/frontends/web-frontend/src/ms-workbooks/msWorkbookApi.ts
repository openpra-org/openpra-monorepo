import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";

type MsWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface MsWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: MechanisticSourceTermAnalysis;
  myRoles: MsWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getMsWorkbook(workbookId: string): Promise<MsWorkbookResponse> {
  return fetchJson<MsWorkbookResponse>(`/api/ms-workbooks/${workbookId}`);
}

async function patchMsWorkbook(workbookId: string, mef: MechanisticSourceTermAnalysis): Promise<MsWorkbookResponse> {
  return patchJson<MsWorkbookResponse>(`/api/ms-workbooks/${workbookId}`, { mef });
}

async function loadMsExample(workbookId: string): Promise<MsWorkbookResponse> {
  return postJson<MsWorkbookResponse>(`/api/ms-workbooks/${workbookId}/load-example`, {});
}

async function unloadMsExample(workbookId: string): Promise<MsWorkbookResponse> {
  return postJson<MsWorkbookResponse>(`/api/ms-workbooks/${workbookId}/unload-example`, {});
}

interface MsDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listMsDocuments(workbookId: string): Promise<MsDocumentEntry[]> {
  return fetchJson<MsDocumentEntry[]>(`/api/ms-workbooks/${workbookId}/documents`);
}

async function uploadMsDocument(workbookId: string, file: File): Promise<MsDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<MsDocumentEntry>(`/api/ms-workbooks/${workbookId}/documents`, form);
}

async function deleteMsDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/ms-workbooks/${workbookId}/documents/${documentId}`);
}

async function getMsDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/ms-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getMsWorkbook,
  patchMsWorkbook,
  loadMsExample,
  unloadMsExample,
  listMsDocuments,
  uploadMsDocument,
  deleteMsDocument,
  getMsDocumentDownload,
  type MsWorkbookResponse,
  type MsWorkbookRoleName,
  type MsDocumentEntry,
};

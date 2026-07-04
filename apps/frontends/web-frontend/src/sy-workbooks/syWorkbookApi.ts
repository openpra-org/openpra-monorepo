import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";

type SyWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface SyWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: SystemsAnalysis;
  myRoles: SyWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getSyWorkbook(workbookId: string): Promise<SyWorkbookResponse> {
  return fetchJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}`);
}

async function patchSyWorkbook(workbookId: string, mef: SystemsAnalysis): Promise<SyWorkbookResponse> {
  return patchJson<SyWorkbookResponse>(`/api/sy-workbooks/${workbookId}`, { mef });
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
  type SyWorkbookResponse,
  type SyWorkbookRoleName,
  type SyExampleOption,
  type SyDocumentEntry,
};

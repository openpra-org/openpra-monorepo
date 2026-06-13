import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";

type RiWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface RiWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: RiskIntegration;
  myRoles: RiWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getRiWorkbook(workbookId: string): Promise<RiWorkbookResponse> {
  return fetchJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}`);
}

async function patchRiWorkbook(workbookId: string, mef: RiskIntegration): Promise<RiWorkbookResponse> {
  return patchJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}`, { mef });
}

async function loadRiExample(workbookId: string): Promise<RiWorkbookResponse> {
  return postJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}/load-example`, {});
}

async function unloadRiExample(workbookId: string): Promise<RiWorkbookResponse> {
  return postJson<RiWorkbookResponse>(`/api/ri-workbooks/${workbookId}/unload-example`, {});
}

interface RiDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listRiDocuments(workbookId: string): Promise<RiDocumentEntry[]> {
  return fetchJson<RiDocumentEntry[]>(`/api/ri-workbooks/${workbookId}/documents`);
}

async function uploadRiDocument(workbookId: string, file: File): Promise<RiDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<RiDocumentEntry>(`/api/ri-workbooks/${workbookId}/documents`, form);
}

async function deleteRiDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/ri-workbooks/${workbookId}/documents/${documentId}`);
}

async function getRiDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/ri-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getRiWorkbook,
  patchRiWorkbook,
  loadRiExample,
  unloadRiExample,
  listRiDocuments,
  uploadRiDocument,
  deleteRiDocument,
  getRiDocumentDownload,
  type RiWorkbookResponse,
  type RiWorkbookRoleName,
  type RiDocumentEntry,
};

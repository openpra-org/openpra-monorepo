import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";

type HrWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface HrWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: HumanReliabilityAnalysis;
  myRoles: HrWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getHrWorkbook(workbookId: string): Promise<HrWorkbookResponse> {
  return fetchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`);
}

async function patchHrWorkbook(workbookId: string, mef: HumanReliabilityAnalysis): Promise<HrWorkbookResponse> {
  return patchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`, { mef });
}

async function loadHrExample(workbookId: string): Promise<HrWorkbookResponse> {
  return postJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}/load-example`, {});
}

async function unloadHrExample(workbookId: string): Promise<HrWorkbookResponse> {
  return postJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}/unload-example`, {});
}

interface HrDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listHrDocuments(workbookId: string): Promise<HrDocumentEntry[]> {
  return fetchJson<HrDocumentEntry[]>(`/api/hr-workbooks/${workbookId}/documents`);
}

async function uploadHrDocument(workbookId: string, file: File): Promise<HrDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<HrDocumentEntry>(`/api/hr-workbooks/${workbookId}/documents`, form);
}

async function deleteHrDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/hr-workbooks/${workbookId}/documents/${documentId}`);
}

async function getHrDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/hr-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getHrWorkbook,
  patchHrWorkbook,
  loadHrExample,
  unloadHrExample,
  listHrDocuments,
  uploadHrDocument,
  deleteHrDocument,
  getHrDocumentDownload,
  type HrWorkbookResponse,
  type HrWorkbookRoleName,
  type HrDocumentEntry,
};

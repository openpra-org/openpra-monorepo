import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";

type HrWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface HrWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: HumanReliabilityAnalysis;
  myRoles: HrWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getHrWorkbook(workbookId: string): Promise<HrWorkbookResponse> {
  return fetchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`);
}

async function patchHrWorkbook(
  workbookId: string,
  expectedRevision: number,
  current: HumanReliabilityAnalysis,
  mef: HumanReliabilityAnalysis,
): Promise<HrWorkbookResponse> {
  return patchJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}`, {
    expectedRevision,
    operations: createWorkbookPatch(current, mef),
  });
}

interface HrExampleOption {
  id: string;
  label: string;
}

async function getHrExampleOptions(): Promise<HrExampleOption[]> {
  return fetchJson<HrExampleOption[]>("/api/example-workbooks/hr-examples");
}

async function loadHrExample(workbookId: string, exampleId?: string): Promise<HrWorkbookResponse> {
  return postJson<HrWorkbookResponse>(`/api/hr-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
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
  getHrExampleOptions,
  loadHrExample,
  unloadHrExample,
  listHrDocuments,
  uploadHrDocument,
  deleteHrDocument,
  getHrDocumentDownload,
  type HrWorkbookResponse,
  type HrWorkbookRoleName,
  type HrExampleOption,
  type HrDocumentEntry,
};

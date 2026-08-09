import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson, patchJson, postJson, postMultipart, deleteJson } from "../api/client";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";

type RcWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface RcWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: RadiologicalConsequenceAnalysis;
  myRoles: RcWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

async function getRcWorkbook(workbookId: string): Promise<RcWorkbookResponse> {
  return fetchJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}`);
}

async function patchRcWorkbook(workbookId: string, current: RadiologicalConsequenceAnalysis, mef: RadiologicalConsequenceAnalysis): Promise<RcWorkbookResponse> {
  return patchJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
}

interface RcExampleOption {
  id: string;
  label: string;
}

async function getRcExamples(): Promise<RcExampleOption[]> {
  return fetchJson<RcExampleOption[]>("/api/example-workbooks/rc-examples");
}

async function loadRcExample(workbookId: string, exampleId?: string): Promise<RcWorkbookResponse> {
  return postJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadRcExample(workbookId: string): Promise<RcWorkbookResponse> {
  return postJson<RcWorkbookResponse>(`/api/rc-workbooks/${workbookId}/unload-example`, {});
}

interface RcDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listRcDocuments(workbookId: string): Promise<RcDocumentEntry[]> {
  return fetchJson<RcDocumentEntry[]>(`/api/rc-workbooks/${workbookId}/documents`);
}

async function uploadRcDocument(workbookId: string, file: File): Promise<RcDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<RcDocumentEntry>(`/api/rc-workbooks/${workbookId}/documents`, form);
}

async function deleteRcDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/rc-workbooks/${workbookId}/documents/${documentId}`);
}

async function getRcDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/rc-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getRcWorkbook,
  patchRcWorkbook,
  getRcExamples,
  loadRcExample,
  unloadRcExample,
  listRcDocuments,
  uploadRcDocument,
  deleteRcDocument,
  getRcDocumentDownload,
  type RcWorkbookResponse,
  type RcWorkbookRoleName,
  type RcExampleOption,
  type RcDocumentEntry,
};

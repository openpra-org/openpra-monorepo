import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";

type IeWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface IeWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: InitiatingEventsAnalysis;
  myRoles: IeWorkbookRoleName[];
  hasPreviousMef: boolean;
  linkedPosWorkbookId: string | null;
  updatedAt: string;
}

async function getIeWorkbook(workbookId: string): Promise<IeWorkbookResponse> {
  return fetchJson<IeWorkbookResponse>(`/api/ie-workbooks/${workbookId}`);
}

async function patchIeWorkbook(workbookId: string, mef: InitiatingEventsAnalysis): Promise<IeWorkbookResponse> {
  return patchJson<IeWorkbookResponse>(`/api/ie-workbooks/${workbookId}`, { mef });
}

interface IeExampleOption {
  id: string;
  label: string;
}

async function getIeExampleOptions(): Promise<IeExampleOption[]> {
  return fetchJson<IeExampleOption[]>("/api/example-workbooks/ie-examples");
}

async function loadIeExample(workbookId: string, exampleId?: string): Promise<IeWorkbookResponse> {
  return postJson<IeWorkbookResponse>(`/api/ie-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
}

async function unloadIeExample(workbookId: string): Promise<IeWorkbookResponse> {
  return postJson<IeWorkbookResponse>(`/api/ie-workbooks/${workbookId}/unload-example`, {});
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

interface IePosLinkStatus {
  linkedPosWorkbookId: string | null;
  linkedName: string | null;
  states: ImportedPosState[];
  sources: ImportedPosSource[];
}

interface AvailablePosWorkbook {
  workbookId: string;
  name: string;
  workflowState: string;
  stateCount: number;
  sourceCount: number;
  updatedAt: string;
}

async function getIePosLink(workbookId: string): Promise<IePosLinkStatus> {
  return fetchJson<IePosLinkStatus>(`/api/ie-workbooks/${workbookId}/pos-link`);
}

async function getAvailablePosWorkbooks(workbookId: string): Promise<AvailablePosWorkbook[]> {
  return fetchJson<AvailablePosWorkbook[]>(`/api/ie-workbooks/${workbookId}/pos-link/available`);
}

async function linkPosWorkbook(workbookId: string, posWorkbookId: string): Promise<IePosLinkStatus> {
  return postJson<IePosLinkStatus>(`/api/ie-workbooks/${workbookId}/pos-link`, { posWorkbookId });
}

async function unlinkPosWorkbook(workbookId: string): Promise<IePosLinkStatus> {
  return postJson<IePosLinkStatus>(`/api/ie-workbooks/${workbookId}/pos-link/unlink`, {});
}

interface IeDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listIeDocuments(workbookId: string): Promise<IeDocumentEntry[]> {
  return fetchJson<IeDocumentEntry[]>(`/api/ie-workbooks/${workbookId}/documents`);
}

async function uploadIeDocument(workbookId: string, file: File): Promise<IeDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<IeDocumentEntry>(`/api/ie-workbooks/${workbookId}/documents`, form);
}

async function deleteIeDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/ie-workbooks/${workbookId}/documents/${documentId}`);
}

async function getIeDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/ie-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getIeWorkbook,
  patchIeWorkbook,
  getIeExampleOptions,
  loadIeExample,
  unloadIeExample,
  getIePosLink,
  getAvailablePosWorkbooks,
  linkPosWorkbook,
  unlinkPosWorkbook,
  listIeDocuments,
  uploadIeDocument,
  deleteIeDocument,
  getIeDocumentDownload,
  type IeWorkbookResponse,
  type IeWorkbookRoleName,
  type IePosLinkStatus,
  type AvailablePosWorkbook,
  type ImportedPosState,
  type ImportedPosSource,
  type IeDocumentEntry,
  type IeExampleOption,
};

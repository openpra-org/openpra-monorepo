import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-states-analysis";

type PosWorkbookRoleName = "preparer" | "reviewer" | "approver";

interface PosWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: PlantOperatingStatesAnalysis;
  myRoles: PosWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface PosRoleAssignment {
  username: string;
  fullName: string;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

interface PosRolesResponse {
  workbookId: string;
  canManage: boolean;
  myRoles: PosWorkbookRoleName[];
  assignments: PosRoleAssignment[];
  eligibleMembers: { username: string; fullName: string }[];
}

async function getPosWorkbook(workbookId: string): Promise<PosWorkbookResponse> {
  return fetchJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}`);
}

async function patchPosWorkbook(workbookId: string, mef: PlantOperatingStatesAnalysis): Promise<PosWorkbookResponse> {
  return patchJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}`, { mef });
}

async function getPosRoles(workbookId: string): Promise<PosRolesResponse> {
  return fetchJson<PosRolesResponse>(`/api/pos-workbooks/${workbookId}/roles`);
}

async function assignPosRole(workbookId: string, username: string, role: PosWorkbookRoleName): Promise<PosRolesResponse> {
  return postJson<PosRolesResponse>(`/api/pos-workbooks/${workbookId}/roles`, { username, role });
}

async function unassignPosRole(workbookId: string, username: string, role: PosWorkbookRoleName): Promise<PosRolesResponse> {
  return deleteJson<PosRolesResponse>(`/api/pos-workbooks/${workbookId}/roles/${encodeURIComponent(username)}/${role}`);
}

type PosCommentSeverity = "MAJOR" | "MINOR" | "OBSERVATION";

async function postPosComment(workbookId: string, body: { text: string; severity?: PosCommentSeverity; associatedSr?: string; associatedField?: string }): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/comments`, body);
}

async function patchPosComment(workbookId: string, commentUuid: string, body: { resolved?: boolean; resolution?: string }): Promise<PlantOperatingStatesAnalysis> {
  return patchJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/comments/${commentUuid}`, body);
}

type PosSignoffRole = "reviewer" | "approver";

interface PosWorkflowStatus {
  workflowState: string;
  reviewers: string[];
  approvers: string[];
  signoffs: { username: string; role: PosSignoffRole; signedAt: string }[];
  myPendingSignoff: PosSignoffRole | null;
}

async function getPosWorkflowStatus(workbookId: string): Promise<PosWorkflowStatus> {
  return fetchJson<PosWorkflowStatus>(`/api/pos-workbooks/${workbookId}/workflow`);
}

async function submitPosForReview(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/workflow/submit-for-review`, {});
}

async function signPosReview(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/workflow/sign-review`, {});
}

async function signPosApproval(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/workflow/sign-approval`, {});
}

async function requestPosRevision(workbookId: string, note: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/pos-workbooks/${workbookId}/workflow/request-revision`, { note });
}

interface PosAwaitingMeEntry {
  workbookId: string;
  projectId: string;
  workflowState: string;
  pendingAction: string;
}

async function getPosAwaitingMe(): Promise<PosAwaitingMeEntry[]> {
  return fetchJson<PosAwaitingMeEntry[]>("/api/pos-workbooks/awaiting-me");
}

async function loadPosExample(workbookId: string): Promise<PosWorkbookResponse> {
  return postJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}/load-example`, {});
}

async function unloadPosExample(workbookId: string): Promise<PosWorkbookResponse> {
  return postJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}/unload-example`, {});
}

interface PosDocumentEntry {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

async function listPosDocuments(workbookId: string): Promise<PosDocumentEntry[]> {
  return fetchJson<PosDocumentEntry[]>(`/api/pos-workbooks/${workbookId}/documents`);
}

async function uploadPosDocument(workbookId: string, file: File): Promise<PosDocumentEntry> {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<PosDocumentEntry>(`/api/pos-workbooks/${workbookId}/documents`, form);
}

async function deletePosDocument(workbookId: string, documentId: string): Promise<void> {
  await deleteJson<void>(`/api/pos-workbooks/${workbookId}/documents/${documentId}`);
}

async function getPosDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/pos-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getPosWorkbook,
  patchPosWorkbook,
  getPosRoles,
  assignPosRole,
  unassignPosRole,
  postPosComment,
  patchPosComment,
  getPosWorkflowStatus,
  submitPosForReview,
  signPosReview,
  signPosApproval,
  requestPosRevision,
  getPosAwaitingMe,
  loadPosExample,
  unloadPosExample,
  listPosDocuments,
  uploadPosDocument,
  deletePosDocument,
  getPosDocumentDownload,
  type PosDocumentEntry,
  type PosWorkbookResponse,
  type PosRolesResponse,
  type PosRoleAssignment,
  type PosWorkbookRoleName,
  type PosCommentSeverity,
  type PosWorkflowStatus,
  type PosSignoffRole,
  type PosAwaitingMeEntry,
};

import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { deleteJson, fetchJson, patchJson, postJson, postMultipart } from "../api/client";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";

type PosWorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

interface PosWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: PlantOperatingStatesAnalysis;
  myRoles: PosWorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface PosUserRoleAssignment {
  kind: "user";
  username: string;
  fullName: string;
  designation?: string;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

interface PosTeamRoleAssignment {
  kind: "team";
  teamId: string;
  teamName: string;
  memberCount: number;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

type PosRoleAssignment = PosUserRoleAssignment | PosTeamRoleAssignment;

interface PosEligibleMember {
  username: string;
  fullName: string;
  viaTeamId?: string;
}

interface PosEligibleTeam {
  teamId: string;
  teamName: string;
  memberCount: number;
}

interface PosRolesResponse {
  workbookId: string;
  canManage: boolean;
  myRoles: PosWorkbookRoleName[];
  assignments: PosRoleAssignment[];
  eligibleMembers: PosEligibleMember[];
  eligibleTeams: PosEligibleTeam[];
}

async function getPosWorkbook(workbookId: string): Promise<PosWorkbookResponse> {
  return fetchJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}`);
}

async function patchPosWorkbook(workbookId: string, current: PlantOperatingStatesAnalysis, mef: PlantOperatingStatesAnalysis): Promise<PosWorkbookResponse> {
  return patchJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}`, { operations: createWorkbookPatch(current, mef) });
}

async function getPosRoles(workbookId: string): Promise<PosRolesResponse> {
  return fetchJson<PosRolesResponse>(`/api/workbooks/${workbookId}/roles`);
}

async function assignPosUserRole(workbookId: string, username: string, role: PosWorkbookRoleName, designation?: string): Promise<PosRolesResponse> {
  return postJson<PosRolesResponse>(`/api/workbooks/${workbookId}/roles`, { username, role, designation });
}

async function assignPosTeamRole(workbookId: string, teamId: string, role: PosWorkbookRoleName): Promise<PosRolesResponse> {
  return postJson<PosRolesResponse>(`/api/workbooks/${workbookId}/roles`, { teamId, role });
}

async function unassignPosUserRole(workbookId: string, username: string, role: PosWorkbookRoleName): Promise<PosRolesResponse> {
  return deleteJson<PosRolesResponse>(`/api/workbooks/${workbookId}/roles/user/${encodeURIComponent(username)}/${role}`);
}

async function unassignPosTeamRole(workbookId: string, teamId: string, role: PosWorkbookRoleName): Promise<PosRolesResponse> {
  return deleteJson<PosRolesResponse>(`/api/workbooks/${workbookId}/roles/team/${encodeURIComponent(teamId)}/${role}`);
}

type PosCommentSeverity = "MAJOR" | "MINOR" | "OBSERVATION";

async function postPosComment(workbookId: string, body: { text: string; severity?: PosCommentSeverity; associatedSr?: string; associatedField?: string }): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/comments`, body);
}

async function patchPosComment(workbookId: string, commentUuid: string, body: { resolved?: boolean; resolution?: string }): Promise<PlantOperatingStatesAnalysis> {
  return patchJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/comments/${commentUuid}`, body);
}

type PosSignoffRole = "preparer" | "co_preparer" | "reviewer" | "approver";

interface PosRoleHolder {
  role: PosSignoffRole;
  username: string;
  fullName: string;
  designation: string | null;
  signedAt: string | null;
}

interface PosWorkflowStatus {
  workflowState: string;
  preparers: string[];
  coPreparers: string[];
  reviewers: string[];
  approvers: string[];
  roleHolders: PosRoleHolder[];
  signoffs: { username: string; role: PosSignoffRole; signedAt: string }[];
  myPendingSignoff: PosSignoffRole | null;
}

async function getPosWorkflowStatus(workbookId: string): Promise<PosWorkflowStatus> {
  return fetchJson<PosWorkflowStatus>(`/api/workbooks/${workbookId}/workflow`);
}

async function submitPosForReview(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/workflow/submit-for-review`, {});
}

async function signPosReview(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/workflow/sign-review`, {});
}

async function signPosApproval(workbookId: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/workflow/sign-approval`, {});
}

async function requestPosRevision(workbookId: string, note: string): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/workflow/request-revision`, { note });
}

async function signPosAs(workbookId: string, role: PosSignoffRole): Promise<PlantOperatingStatesAnalysis> {
  return postJson<PlantOperatingStatesAnalysis>(`/api/workbooks/${workbookId}/workflow/sign-as`, { role });
}

interface PosAwaitingMeEntry {
  workbookId: string;
  projectId: string;
  workflowState: string;
  pendingAction: string;
}

async function getPosAwaitingMe(): Promise<PosAwaitingMeEntry[]> {
  return fetchJson<PosAwaitingMeEntry[]>("/api/workbooks/awaiting-me");
}

interface PosExampleOption {
  id: string;
  label: string;
}

async function getPosExampleOptions(): Promise<PosExampleOption[]> {
  return fetchJson<PosExampleOption[]>("/api/example-workbooks/pos-examples");
}

async function loadPosExample(workbookId: string, exampleId?: string): Promise<PosWorkbookResponse> {
  return postJson<PosWorkbookResponse>(`/api/pos-workbooks/${workbookId}/load-example`, exampleId !== undefined ? { example: exampleId } : {});
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
  notes: string;
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

async function updatePosDocument(workbookId: string, documentId: string, fields: { name?: string; notes?: string }): Promise<PosDocumentEntry> {
  return patchJson<PosDocumentEntry>(`/api/pos-workbooks/${workbookId}/documents/${documentId}`, fields);
}

async function getPosDocumentDownload(workbookId: string, documentId: string): Promise<{ url: string; filename: string }> {
  return fetchJson<{ url: string; filename: string }>(`/api/pos-workbooks/${workbookId}/documents/${documentId}/download`);
}

export {
  getPosWorkbook,
  patchPosWorkbook,
  getPosRoles,
  assignPosUserRole,
  assignPosTeamRole,
  unassignPosUserRole,
  unassignPosTeamRole,
  postPosComment,
  patchPosComment,
  getPosWorkflowStatus,
  submitPosForReview,
  signPosReview,
  signPosApproval,
  signPosAs,
  requestPosRevision,
  getPosAwaitingMe,
  getPosExampleOptions,
  loadPosExample,
  unloadPosExample,
  listPosDocuments,
  uploadPosDocument,
  deletePosDocument,
  updatePosDocument,
  getPosDocumentDownload,
  type PosDocumentEntry,
  type PosWorkbookResponse,
  type PosRolesResponse,
  type PosRoleAssignment,
  type PosWorkbookRoleName,
  type PosCommentSeverity,
  type PosWorkflowStatus,
  type PosRoleHolder,
  type PosSignoffRole,
  type PosAwaitingMeEntry,
  type PosExampleOption,
};

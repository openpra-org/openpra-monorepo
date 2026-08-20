import { deleteJson, fetchJson, patchJson, postJson } from "../api/client";

type WorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";
type WorkbookSignoffRole = WorkbookRoleName;
type WorkbookCommentSeverity = "MAJOR" | "MINOR" | "OBSERVATION";

interface WorkbookUserRoleAssignment {
  kind: "user";
  username: string;
  fullName: string;
  designation?: string;
  role: WorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

interface WorkbookTeamRoleAssignment {
  kind: "team";
  teamId: string;
  teamName: string;
  memberCount: number;
  role: WorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

type WorkbookRoleAssignment = WorkbookUserRoleAssignment | WorkbookTeamRoleAssignment;

interface WorkbookEligibleMember {
  username: string;
  fullName: string;
  viaTeamId?: string;
}

interface WorkbookEligibleTeam {
  teamId: string;
  teamName: string;
  memberCount: number;
}

interface WorkbookRolesResponse {
  workbookId: string;
  canManage: boolean;
  myRoles: WorkbookRoleName[];
  assignments: WorkbookRoleAssignment[];
  eligibleMembers: WorkbookEligibleMember[];
  eligibleTeams: WorkbookEligibleTeam[];
}

interface WorkbookRoleHolder {
  role: WorkbookSignoffRole;
  username: string;
  fullName: string;
  designation: string | null;
  signedAt: string | null;
  signatureDataUrl: string | null;
}

interface WorkbookWorkflowStatus {
  workflowState: string;
  preparers: string[];
  coPreparers: string[];
  reviewers: string[];
  approvers: string[];
  roleHolders: WorkbookRoleHolder[];
  signoffs: { username: string; role: WorkbookSignoffRole; signedAt: string }[];
  myPendingSignoff: WorkbookSignoffRole | null;
  allReviewersSigned: boolean;
}

interface WorkbookAwaitingMeEntry {
  workbookId: string;
  projectId: string;
  workflowState: string;
  pendingAction: string;
}

async function getWorkbookRoles(workbookId: string): Promise<WorkbookRolesResponse> {
  return fetchJson<WorkbookRolesResponse>(`/api/workbooks/${workbookId}/roles`);
}

async function assignWorkbookUserRole(workbookId: string, username: string, role: WorkbookRoleName, designation?: string): Promise<WorkbookRolesResponse> {
  return postJson<WorkbookRolesResponse>(`/api/workbooks/${workbookId}/roles`, { username, role, designation });
}

async function assignWorkbookTeamRole(workbookId: string, teamId: string, role: WorkbookRoleName): Promise<WorkbookRolesResponse> {
  return postJson<WorkbookRolesResponse>(`/api/workbooks/${workbookId}/roles`, { teamId, role });
}

async function unassignWorkbookUserRole(workbookId: string, username: string, role: WorkbookRoleName): Promise<WorkbookRolesResponse> {
  return deleteJson<WorkbookRolesResponse>(`/api/workbooks/${workbookId}/roles/user/${encodeURIComponent(username)}/${role}`);
}

async function unassignWorkbookTeamRole(workbookId: string, teamId: string, role: WorkbookRoleName): Promise<WorkbookRolesResponse> {
  return deleteJson<WorkbookRolesResponse>(`/api/workbooks/${workbookId}/roles/team/${encodeURIComponent(teamId)}/${role}`);
}

async function getWorkbookWorkflowStatus(workbookId: string): Promise<WorkbookWorkflowStatus> {
  return fetchJson<WorkbookWorkflowStatus>(`/api/workbooks/${workbookId}/workflow`);
}

async function submitWorkbookForReview(workbookId: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/submit-for-review`, {});
}

async function signWorkbookReview(workbookId: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/sign-review`, {});
}

async function signWorkbookApproval(workbookId: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/sign-approval`, {});
}

async function requestWorkbookRevision(workbookId: string, note: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/request-revision`, { note });
}

async function signWorkbookAs(workbookId: string, role: WorkbookSignoffRole, signatureDataUrl?: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/sign-as`, { role, signatureDataUrl });
}

async function submitWorkbookToApprover(workbookId: string): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/workflow/submit-to-approver`, {});
}

async function postWorkbookComment(workbookId: string, body: { text: string; severity?: WorkbookCommentSeverity; associatedSr?: string; associatedField?: string }): Promise<unknown> {
  return postJson<unknown>(`/api/workbooks/${workbookId}/comments`, body);
}

async function patchWorkbookComment(workbookId: string, commentUuid: string, body: { resolved?: boolean; resolution?: string }): Promise<unknown> {
  return patchJson<unknown>(`/api/workbooks/${workbookId}/comments/${commentUuid}`, body);
}

async function getWorkbookAwaitingMe(): Promise<WorkbookAwaitingMeEntry[]> {
  return fetchJson<WorkbookAwaitingMeEntry[]>("/api/workbooks/awaiting-me");
}

export {
  getWorkbookRoles,
  assignWorkbookUserRole,
  assignWorkbookTeamRole,
  unassignWorkbookUserRole,
  unassignWorkbookTeamRole,
  getWorkbookWorkflowStatus,
  submitWorkbookForReview,
  signWorkbookReview,
  signWorkbookApproval,
  requestWorkbookRevision,
  signWorkbookAs,
  submitWorkbookToApprover,
  postWorkbookComment,
  patchWorkbookComment,
  getWorkbookAwaitingMe,
  type WorkbookRoleName,
  type WorkbookSignoffRole,
  type WorkbookCommentSeverity,
  type WorkbookRoleAssignment,
  type WorkbookRolesResponse,
  type WorkbookRoleHolder,
  type WorkbookWorkflowStatus,
  type WorkbookAwaitingMeEntry,
};

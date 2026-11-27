import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project,
  type ProjectShareRole,
  type RecentProjectResponse,
  type SharedProjectsResponse,
  type UpdateProjectRequest,
  type WorkbookShareAccess,
  type WorkbookSharesResponse,
  OwnedProjectsResponseSchema,
  ProjectSchema,
  RecentProjectResponseSchema,
  SharedProjectsResponseSchema,
  WorkbookSharesResponseSchema,
} from "interfaces-shared-types";
import { getToken, onUnauthorized } from "../auth/authStorage";

const PROJECT_BASE = "/api/projects";

function authHeaders(): Record<string, string> {
  const token = getToken();
  const base: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token !== null) base.Authorization = `Bearer ${token}`;
  return base;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return response.statusText;
  try {
    const parsed = JSON.parse(text) as { message?: string; detail?: string };
    return parsed.message ?? parsed.detail ?? text;
  } catch {
    return text;
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${PROJECT_BASE}${path}`, init);
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function getJson(path: string): Promise<unknown> {
  const response = await request("GET", path);
  return response.json();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await request("POST", path, body);
  return response.json();
}

async function patchJson(path: string, body: unknown): Promise<unknown> {
  const response = await request("PATCH", path, body);
  return response.json();
}

async function getRecentProject(): Promise<RecentProjectResponse> {
  const data = await getJson("/recent");
  return RecentProjectResponseSchema.parse(data);
}

async function getOwnedProjects(): Promise<OwnedProjectsResponse> {
  const data = await getJson("");
  return OwnedProjectsResponseSchema.parse(data);
}

async function getSharedProjects(): Promise<SharedProjectsResponse> {
  const data = await getJson("/shared");
  return SharedProjectsResponseSchema.parse(data);
}

async function getProject(id: string): Promise<Project> {
  const data = await getJson(`/${id}`);
  return ProjectSchema.parse(data);
}

async function createProject(payload: CreateProjectRequest): Promise<Project> {
  const data = await postJson("", payload);
  return ProjectSchema.parse(data);
}

async function updateProject(id: string, payload: UpdateProjectRequest): Promise<Project> {
  const data = await patchJson(`/${id}`, payload);
  return ProjectSchema.parse(data);
}

async function duplicateProject(id: string): Promise<Project> {
  const data = await postJson(`/${id}/duplicate`, undefined);
  return ProjectSchema.parse(data);
}

async function shareProjectWithTeam(id: string, teamId: string, role: ProjectShareRole): Promise<Project> {
  const data = await postJson(`/${id}/shares/teams`, { teamId, role });
  return ProjectSchema.parse(data);
}

async function updateProjectTeamShare(id: string, teamId: string, role: ProjectShareRole): Promise<Project> {
  const data = await patchJson(`/${id}/shares/teams/${teamId}`, { role });
  return ProjectSchema.parse(data);
}

async function unshareProjectFromTeam(id: string, teamId: string): Promise<void> {
  await request("DELETE", `/${id}/shares/teams/${teamId}`);
}

async function shareProjectWithUser(id: string, identifier: string, role: ProjectShareRole): Promise<Project> {
  const data = await postJson(`/${id}/shares/users`, { identifier, role });
  return ProjectSchema.parse(data);
}

async function updateProjectUserShare(id: string, username: string, role: ProjectShareRole): Promise<Project> {
  const data = await patchJson(`/${id}/shares/users/${encodeURIComponent(username)}`, { role });
  return ProjectSchema.parse(data);
}

async function unshareProjectFromUser(id: string, username: string): Promise<void> {
  await request("DELETE", `/${id}/shares/users/${encodeURIComponent(username)}`);
}

async function deleteProject(id: string): Promise<void> {
  await request("DELETE", `/${id}`);
}

async function getProjectCollaborators(id: string): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await getJson(`/${id}/collaborators`));
}

async function addProjectCollaborator(id: string, identifier: string, access: WorkbookShareAccess): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await postJson(`/${id}/collaborators`, { identifier, access }));
}

async function updateProjectCollaborator(id: string, username: string, access: WorkbookShareAccess): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await patchJson(`/${id}/collaborators/${encodeURIComponent(username)}`, { access }));
}

async function removeProjectCollaborator(id: string, username: string): Promise<WorkbookSharesResponse> {
  const response = await request("DELETE", `/${id}/collaborators/${encodeURIComponent(username)}`);
  return WorkbookSharesResponseSchema.parse(await response.json());
}

export {
  getRecentProject,
  getOwnedProjects,
  getSharedProjects,
  getProject,
  createProject,
  updateProject,
  duplicateProject,
  shareProjectWithTeam,
  updateProjectTeamShare,
  unshareProjectFromTeam,
  shareProjectWithUser,
  updateProjectUserShare,
  unshareProjectFromUser,
  deleteProject,
  getProjectCollaborators,
  addProjectCollaborator,
  updateProjectCollaborator,
  removeProjectCollaborator,
};

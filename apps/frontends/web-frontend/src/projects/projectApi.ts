import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project,
  type RecentProjectResponse,
  type SharedProjectsResponse,
  type UpdateProjectRequest,
  OwnedProjectsResponseSchema,
  ProjectSchema,
  RecentProjectResponseSchema,
  SharedProjectsResponseSchema,
} from "interfaces-shared-types";
import { getToken } from "../auth/authStorage";

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

async function transferProjectToTeam(id: string, teamId: string): Promise<Project> {
  const data = await postJson(`/${id}/transfer-to-team`, { teamId });
  return ProjectSchema.parse(data);
}

async function transferProjectToSelf(id: string): Promise<Project> {
  const data = await postJson(`/${id}/transfer-to-self`, undefined);
  return ProjectSchema.parse(data);
}

async function deleteProject(id: string): Promise<void> {
  await request("DELETE", `/${id}`);
}

export {
  getRecentProject,
  getOwnedProjects,
  getSharedProjects,
  createProject,
  updateProject,
  duplicateProject,
  transferProjectToTeam,
  transferProjectToSelf,
  deleteProject,
};

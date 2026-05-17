import {
  type CreateProjectRequest,
  type Project,
  type RecentProjectResponse,
  type SharedProjectsResponse,
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

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${PROJECT_BASE}${path}`, { method: "GET", headers: authHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${PROJECT_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function getRecentProject(): Promise<RecentProjectResponse> {
  const data = await getJson("/recent");
  return RecentProjectResponseSchema.parse(data);
}

async function getSharedProjects(): Promise<SharedProjectsResponse> {
  const data = await getJson("/shared");
  return SharedProjectsResponseSchema.parse(data);
}

async function createProject(payload: CreateProjectRequest): Promise<Project> {
  const data = await postJson("", payload);
  return ProjectSchema.parse(data);
}

export { getRecentProject, getSharedProjects, createProject };

import {
  type CreateWorkbookRequest,
  type UpdateWorkbookRequest,
  type Workbook,
  type WorkbookListResponse,
  WorkbookSchema,
  WorkbookListResponseSchema,
} from "interfaces-shared-types";
import { getToken, onUnauthorized } from "../auth/authStorage";

const API_BASE = "/api/projects";

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
  const response = await fetch(`${API_BASE}${path}`, init);
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function listWorkbooks(projectId: string, elementCode: string, toolId: string): Promise<WorkbookListResponse> {
  const query = new URLSearchParams({ elementCode, toolId }).toString();
  const response = await request("GET", `/${projectId}/workbooks?${query}`);
  return WorkbookListResponseSchema.parse(await response.json());
}

async function createWorkbook(projectId: string, payload: CreateWorkbookRequest): Promise<Workbook> {
  const response = await request("POST", `/${projectId}/workbooks`, payload);
  return WorkbookSchema.parse(await response.json());
}

async function updateWorkbook(projectId: string, id: string, payload: UpdateWorkbookRequest): Promise<Workbook> {
  const response = await request("PATCH", `/${projectId}/workbooks/${id}`, payload);
  return WorkbookSchema.parse(await response.json());
}

async function deleteWorkbook(projectId: string, id: string): Promise<void> {
  await request("DELETE", `/${projectId}/workbooks/${id}`);
}

export { listWorkbooks, createWorkbook, updateWorkbook, deleteWorkbook };

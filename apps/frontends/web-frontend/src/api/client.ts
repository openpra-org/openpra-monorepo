import { notifyAnalysisRun } from "../newly-developed-methods/shared/analysisRunEvents";
import { stringifyJson } from "interfaces-shared-types/json";
import {
  WORKBOOK_CLIENT_HEADER,
  WORKBOOK_ID_HEADER,
  WORKBOOK_SEEN_HEADER,
  WORKBOOK_SEQ_HEADER,
  workbookIdOfPath,
} from "interfaces-shared-types/workbooks";
import { getToken, onUnauthorized } from "../auth/authStorage";

const WORKBOOK_CONFLICT_EVENT = "openpra:workbook-conflict";
const seenChanges = new Map<string, number>();
const activeWrites = new Map<string, number>();
const idleWaiters = new Map<string, (() => void)[]>();
let workbookClient: string | null = null;

function workbookClientId(): string {
  if (workbookClient === null) workbookClient = crypto.randomUUID();
  return workbookClient;
}

function beginWrite(workbookId: string): void {
  activeWrites.set(workbookId, (activeWrites.get(workbookId) ?? 0) + 1);
}

function endWrite(workbookId: string): void {
  const left = Math.max(0, (activeWrites.get(workbookId) ?? 1) - 1);
  if (left > 0) {
    activeWrites.set(workbookId, left);
    return;
  }
  activeWrites.delete(workbookId);
  const waiters = idleWaiters.get(workbookId) ?? [];
  idleWaiters.delete(workbookId);
  for (const resolve of waiters) resolve();
}

function whenWorkbookIdle(workbookId: string): Promise<void> {
  if ((activeWrites.get(workbookId) ?? 0) === 0) return Promise.resolve();
  return new Promise((resolve) => {
    idleWaiters.set(workbookId, [...(idleWaiters.get(workbookId) ?? []), resolve]);
  });
}

function noteSeenChange(response: Response): void {
  const workbookId = response.headers.get(WORKBOOK_ID_HEADER);
  const seq = Number(response.headers.get(WORKBOOK_SEQ_HEADER));
  if (workbookId !== null && Number.isSafeInteger(seq)) seenChanges.set(workbookId, seq);
}

function workbookHeaders(path: string): Record<string, string> {
  const headers: Record<string, string> = { [WORKBOOK_CLIENT_HEADER]: workbookClientId() };
  const workbookId = workbookIdOfPath(path);
  const seen = workbookId === null ? undefined : seenChanges.get(workbookId);
  if (seen !== undefined) headers[WORKBOOK_SEEN_HEADER] = String(seen);
  return headers;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const base: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token !== null) base.Authorization = `Bearer ${token}`;
  return base;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
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
  const init: RequestInit = { method, headers: { ...authHeaders(), ...workbookHeaders(path) } };
  if (body !== undefined) init.body = stringifyJson(body);
  const workbookId = workbookIdOfPath(path);
  const writing = workbookId !== null && method !== "GET";
  if (writing) beginWrite(workbookId);
  try {
    const response = await fetch(path, init);
    if (method === "GET") noteSeenChange(response);
    if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
    if (response.status === 409 && workbookId !== null) window.dispatchEvent(new CustomEvent(WORKBOOK_CONFLICT_EVENT, { detail: workbookId }));
    if (!response.ok) throw new ApiError(await readError(response), response.status);
    return response;
  } finally {
    if (writing) endWrite(workbookId);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await request("GET", path);
  return response.json() as Promise<T>;
}

async function fetchBytes(path: string): Promise<ArrayBuffer> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: "GET", headers });
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error(await readError(response));
  return response.arrayBuffer();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let result: T | undefined;
  try {
    const response = await request("POST", path, body);
    result = await response.json() as T;
    return result;
  } finally { notifyAnalysisRun(path, result); }
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await request("PATCH", path, body);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function deleteJson<T>(path: string): Promise<T> {
  const response = await request("DELETE", path);
  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json", ...workbookHeaders(path) };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method: "POST", headers, body: formData });
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    try {
      const parsed = JSON.parse(text) as { message?: string };
      throw new Error(parsed.message ?? text ?? response.statusText);
    } catch {
      throw new Error(text || response.statusText);
    }
  }
  return response.json() as Promise<T>;
}

export {
  ApiError,
  WORKBOOK_CONFLICT_EVENT,
  deleteJson,
  fetchBytes,
  fetchJson,
  patchJson,
  postJson,
  postMultipart,
  whenWorkbookIdle,
  workbookClientId,
};

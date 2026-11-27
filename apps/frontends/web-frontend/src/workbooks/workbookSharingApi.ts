import {
  WorkbookLiveEventSchema,
  WorkbookSharesResponseSchema,
  type WorkbookLiveEvent,
  type WorkbookShareAccess,
  type WorkbookSharesResponse,
} from "interfaces-shared-types/workbooks";
import { deleteJson, fetchJson, patchJson, postJson } from "../api/client";
import { getToken } from "../auth/authStorage";

type WorkbookLiveEnd = "ended" | "refused";

async function getWorkbookShares(workbookId: string): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await fetchJson(`/api/workbooks/${workbookId}/collaborators`));
}

async function addWorkbookShare(workbookId: string, identifier: string, access: WorkbookShareAccess): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await postJson(`/api/workbooks/${workbookId}/collaborators`, { identifier, access }));
}

async function updateWorkbookShare(workbookId: string, username: string, access: WorkbookShareAccess): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await patchJson(`/api/workbooks/${workbookId}/collaborators/${encodeURIComponent(username)}`, { access }));
}

async function removeWorkbookShare(workbookId: string, username: string): Promise<WorkbookSharesResponse> {
  return WorkbookSharesResponseSchema.parse(await deleteJson(`/api/workbooks/${workbookId}/collaborators/${encodeURIComponent(username)}`));
}

function liveEventOf(block: string): WorkbookLiveEvent | null {
  const lines = block.split("\n");
  if (!lines.includes("event: change")) return null;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n");
  try {
    const parsed = WorkbookLiveEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readWorkbookLive(workbookId: string, signal: AbortSignal, onEvent: (event: WorkbookLiveEvent) => void): Promise<WorkbookLiveEnd> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/workbooks/${workbookId}/live`, { headers, signal });
  if (response.status === 401 || response.status === 403 || response.status === 404) return "refused";
  if (!response.ok || response.body === null) return "ended";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return "ended";
    buffer += decoder.decode(chunk.value, { stream: true }).split("\r\n").join("\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const event = liveEventOf(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event !== null) onEvent(event);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export {
  addWorkbookShare,
  getWorkbookShares,
  readWorkbookLive,
  removeWorkbookShare,
  updateWorkbookShare,
  type WorkbookLiveEnd,
};

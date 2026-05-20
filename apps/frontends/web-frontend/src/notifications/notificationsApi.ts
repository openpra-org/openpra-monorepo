import {
  type AuditLogResponse,
  type NotificationsResponse,
  type UnreadCountResponse,
  AuditLogResponseSchema,
  NotificationsResponseSchema,
  UnreadCountResponseSchema,
} from "interfaces-shared-types";
import { getToken } from "../auth/authStorage";

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

async function call(method: string, path: string): Promise<Response> {
  const response = await fetch(path, { method, headers: authHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function getNotifications(): Promise<NotificationsResponse> {
  const data = await (await call("GET", "/api/notifications")).json();
  return NotificationsResponseSchema.parse(data);
}

async function getUnreadCount(): Promise<UnreadCountResponse> {
  const data = await (await call("GET", "/api/notifications/unread-count")).json();
  return UnreadCountResponseSchema.parse(data);
}

async function markNotificationRead(id: string): Promise<void> {
  await call("POST", `/api/notifications/${encodeURIComponent(id)}/read`);
}

async function markAllNotificationsRead(): Promise<void> {
  await call("POST", "/api/notifications/read-all");
}

async function getTeamAuditLog(teamId: string): Promise<AuditLogResponse> {
  const data = await (await call("GET", `/api/audit/teams/${encodeURIComponent(teamId)}`)).json();
  return AuditLogResponseSchema.parse(data);
}

async function getProjectAuditLog(projectId: string): Promise<AuditLogResponse> {
  const data = await (await call("GET", `/api/audit/projects/${encodeURIComponent(projectId)}`)).json();
  return AuditLogResponseSchema.parse(data);
}

export {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getTeamAuditLog,
  getProjectAuditLog,
};

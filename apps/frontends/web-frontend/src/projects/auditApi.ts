import { type AuditLogResponse, AuditLogResponseSchema } from "interfaces-shared-types";
import { getToken, onUnauthorized } from "../auth/authStorage";

const AUDIT_BASE = "/api/audit";

function authHeaders(): Record<string, string> {
  const token = getToken();
  const base: Record<string, string> = { Accept: "application/json" };
  if (token !== null) base.Authorization = `Bearer ${token}`;
  return base;
}

async function getProjectAudit(projectId: string): Promise<AuditLogResponse> {
  const response = await fetch(`${AUDIT_BASE}/projects/${projectId}`, { method: "GET", headers: authHeaders() });
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error(response.statusText);
  return AuditLogResponseSchema.parse(await response.json());
}

export { getProjectAudit };

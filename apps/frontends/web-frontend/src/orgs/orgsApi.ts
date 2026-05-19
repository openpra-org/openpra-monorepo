import {
  type OrgSearchResponse,
  type OrgSummary,
  OrgSearchResponseSchema,
  OrgSummarySchema,
} from "interfaces-shared-types";
import { getToken } from "../auth/authStorage";

const ORGS_BASE = "/api/orgs";

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
  const response = await fetch(`${ORGS_BASE}${path}`, { method, headers: authHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function searchOrgs(query: string): Promise<OrgSearchResponse> {
  const q = query.trim();
  if (q.length < 2) return { orgs: [] };
  const data = await (await call("GET", `/search?q=${encodeURIComponent(q)}`)).json();
  return OrgSearchResponseSchema.parse(data);
}

async function getOrgBySlug(slug: string): Promise<OrgSummary> {
  const data = await (await call("GET", `/${encodeURIComponent(slug)}`)).json();
  return OrgSummarySchema.parse(data);
}

export { searchOrgs, getOrgBySlug };

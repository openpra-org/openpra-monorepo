import { fetchJson, patchJson, postJson } from "../api/client";
import { getToken } from "../auth/authStorage";

interface MetricPoint { label: string; count: number }

interface SessionRanking {
  sessionId: string;
  technicalElement: string;
  username: string;
  activeMs: number;
  idleMs: number;
  totalMs: number;
}

interface AdminMetrics {
  range: { start: string; end: string; reactorType: string };
  summary: { accountsCreated: number; activeUsers: number; projectsCreated: number; trackedHours: number };
  accountTrend: MetricPoint[];
  activeIdle: { activeMs: number; idleMs: number };
  sessionRanking: SessionRanking[];
  projectTypes: MetricPoint[];
  technicalElementWorkbooks: MetricPoint[];
  reactorTypes: string[];
  idleThresholdSeconds: number;
}

interface AttributedUser { username: string; email: string; fullName: string; createdAt: string }

interface Campaign {
  id: string;
  name: string;
  token: string;
  destinationPath: string;
  active: boolean;
  expiresAt: string | null;
  openCount: number;
  uniqueOpenCount: number;
  signupCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
  createdBy: string;
  attributedUsers: AttributedUser[];
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  organization: string;
  isAdmin: boolean;
  createdAt: string;
}

interface DashboardFilters { start: string; end: string; reactorType: string }

function queryString(filters: DashboardFilters): string {
  const params = new URLSearchParams({ start: filters.start, end: filters.end });
  if (filters.reactorType.length > 0) params.set("reactorType", filters.reactorType);
  return params.toString();
}

function getMetrics(filters: DashboardFilters): Promise<AdminMetrics> {
  return fetchJson<AdminMetrics>(`/api/admin/metrics?${queryString(filters)}`);
}

function getCampaigns(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>("/api/admin/campaigns");
}

function createCampaign(input: { name: string; destinationPath: string; expiresAt: string | null }): Promise<Campaign> {
  return postJson<Campaign>("/api/admin/campaigns", input);
}

function setCampaignActive(id: string, active: boolean): Promise<Campaign> {
  return patchJson<Campaign>(`/api/admin/campaigns/${id}`, { active });
}

function getAdminUsers(): Promise<AdminUser[]> {
  return fetchJson<AdminUser[]>("/api/admin/users");
}

async function setUserAdmin(id: string, isAdmin: boolean): Promise<void> {
  const token = getToken();
  const response = await fetch(`/api/admin/users/${id}/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ isAdmin }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Could not update administrator access");
  }
}

async function downloadCsv(filters: DashboardFilters): Promise<void> {
  const token = getToken();
  const response = await fetch(`/api/admin/metrics.csv?${queryString(filters)}`, {
    headers: { Accept: "text/csv", ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
  });
  if (!response.ok) throw new Error("Could not export analytics");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `openpra-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export { createCampaign, downloadCsv, getAdminUsers, getCampaigns, getMetrics, setCampaignActive, setUserAdmin };
export type { AdminMetrics, AdminUser, Campaign, DashboardFilters, MetricPoint, SessionRanking };

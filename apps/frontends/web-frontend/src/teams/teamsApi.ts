import {
  type AvailableTeamsResponse,
  type CreateTeamRequest,
  type MyTeamsResponse,
  type Team,
  AvailableTeamsResponseSchema,
  MyTeamsResponseSchema,
  TeamSchema,
} from "interfaces-shared-types";
import { getToken } from "../auth/authStorage";

const TEAMS_BASE = "/api/teams";

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

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${TEAMS_BASE}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function getMyTeams(): Promise<MyTeamsResponse> {
  const data = await (await call("GET", "/mine")).json();
  return MyTeamsResponseSchema.parse(data);
}

async function getAvailableTeams(query: string): Promise<AvailableTeamsResponse> {
  const q = query.trim();
  const path = q.length > 0 ? `/available?q=${encodeURIComponent(q)}` : "/available";
  const data = await (await call("GET", path)).json();
  return AvailableTeamsResponseSchema.parse(data);
}

async function createTeam(payload: CreateTeamRequest): Promise<Team> {
  const data = await (await call("POST", "", payload)).json();
  return TeamSchema.parse(data);
}

async function joinTeam(id: string): Promise<Team> {
  const data = await (await call("POST", `/${id}/join`)).json();
  return TeamSchema.parse(data);
}

async function leaveTeam(id: string): Promise<void> {
  await call("DELETE", `/${id}/membership`);
}

export { getMyTeams, getAvailableTeams, createTeam, joinTeam, leaveTeam };

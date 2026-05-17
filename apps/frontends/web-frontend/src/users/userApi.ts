import {
  type MyProfileResponse,
  type UpdateUserProfileRequest,
  MyProfileResponseSchema,
} from "interfaces-shared-types";
import { getToken } from "../auth/authStorage";

const USERS_BASE = "/api/users";

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

async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  const init: RequestInit = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${USERS_BASE}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function getMyProfile(): Promise<MyProfileResponse> {
  const data = await call("GET", "/me");
  return MyProfileResponseSchema.parse(data);
}

async function updateMyProfile(payload: UpdateUserProfileRequest): Promise<MyProfileResponse> {
  const data = await call("PATCH", "/me", payload);
  return MyProfileResponseSchema.parse(data);
}

export { getMyProfile, updateMyProfile };

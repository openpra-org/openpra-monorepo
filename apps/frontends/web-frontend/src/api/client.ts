import { getToken, onUnauthorized } from "../auth/authStorage";

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
  const response = await fetch(path, init);
  if (response.status === 401) { onUnauthorized(); throw new Error("Session expired"); }
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await request("GET", path);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await request("POST", path, body);
  return response.json() as Promise<T>;
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
  const headers: Record<string, string> = { Accept: "application/json" };
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

export { fetchJson, postJson, patchJson, deleteJson, postMultipart };

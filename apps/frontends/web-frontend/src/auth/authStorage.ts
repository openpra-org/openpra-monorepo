import { jwtDecode } from "jwt-decode";

interface JwtPayload {
  exp?: number;
  user_id?: number;
  username?: string;
  email?: string;
  roles?: string[];
}

const TOKEN_KEY = "id_token";

function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  return !token || token === "undefined" ? null : token;
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function decodeToken(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

function isTokenExpired(): boolean {
  const payload = decodeToken();
  if (!payload?.exp) return true;
  return Date.now() / 1000 > payload.exp;
}

function getTokenRemainingSeconds(): number {
  const payload = decodeToken();
  if (!payload?.exp) return -1;
  return payload.exp - Date.now() / 1000;
}

function getRoles(): string[] {
  return decodeToken()?.roles ?? ["member-role"];
}

function isLoggedIn(): boolean {
  const token = getToken();
  if (!token) return false;
  if (isTokenExpired()) { removeToken(); return false; }
  return true;
}

const UNAUTHORIZED_EVENT = "auth:unauthorized";

function onUnauthorized(): void {
  removeToken();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export { getToken, setToken, removeToken, decodeToken, isTokenExpired, getTokenRemainingSeconds, getRoles, isLoggedIn, onUnauthorized, UNAUTHORIZED_EVENT };
export type { JwtPayload };

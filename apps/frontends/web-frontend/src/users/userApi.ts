import {
  type ChangeEmailRequest,
  type ChangeEmailResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type ChangeUsernameRequest,
  type ChangeUsernameResponse,
  type MyProfileResponse,
  type NotificationPrefs,
  type UpdateNotificationPrefsRequest,
  type UpdateUserProfileRequest,
  type UserProfile,
  ChangeEmailResponseSchema,
  ChangePasswordResponseSchema,
  ChangeUsernameResponseSchema,
  MyProfileResponseSchema,
  NotificationPrefsSchema,
  UserProfileSchema,
} from "interfaces-shared-types";
import { getToken, setToken } from "../auth/authStorage";

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

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = { method, headers: authHeaders() };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(`${USERS_BASE}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  return response;
}

async function getMyProfile(): Promise<MyProfileResponse> {
  const data = await (await call("GET", "/me")).json();
  return MyProfileResponseSchema.parse(data);
}

async function updateMyProfile(payload: UpdateUserProfileRequest): Promise<MyProfileResponse> {
  const data = await (await call("PATCH", "/me", payload)).json();
  return MyProfileResponseSchema.parse(data);
}

async function changeEmail(payload: ChangeEmailRequest): Promise<ChangeEmailResponse> {
  const data = await (await call("PATCH", "/me/email", payload)).json();
  const parsed = ChangeEmailResponseSchema.parse(data);
  setToken(parsed.token);
  return parsed;
}

async function changeUsername(payload: ChangeUsernameRequest): Promise<ChangeUsernameResponse> {
  const data = await (await call("PATCH", "/me/username", payload)).json();
  const parsed = ChangeUsernameResponseSchema.parse(data);
  setToken(parsed.token);
  return parsed;
}

async function changePassword(payload: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const data = await (await call("PATCH", "/me/password", payload)).json();
  return ChangePasswordResponseSchema.parse(data);
}

async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const data = await (await call("GET", "/me/prefs/notifications")).json();
  return NotificationPrefsSchema.parse(data);
}

async function updateNotificationPrefs(payload: UpdateNotificationPrefsRequest): Promise<NotificationPrefs> {
  const data = await (await call("PATCH", "/me/prefs/notifications", payload)).json();
  return NotificationPrefsSchema.parse(data);
}

async function deleteMyAccount(currentPassword: string): Promise<void> {
  await call("DELETE", "/me", { currentPassword });
}

async function uploadImage(path: string, file: File): Promise<UserProfile> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${USERS_BASE}${path}`, { method: "POST", headers, body: form });
  if (!response.ok) throw new Error(await readError(response));
  const data = await response.json();
  return UserProfileSchema.parse(data);
}

async function uploadAvatar(file: File): Promise<UserProfile> {
  return uploadImage("/me/avatar", file);
}

async function deleteAvatar(): Promise<UserProfile> {
  const data = await (await call("DELETE", "/me/avatar")).json();
  return UserProfileSchema.parse(data);
}

async function uploadCover(file: File): Promise<UserProfile> {
  return uploadImage("/me/cover", file);
}

async function deleteCover(): Promise<UserProfile> {
  const data = await (await call("DELETE", "/me/cover")).json();
  return UserProfileSchema.parse(data);
}

export {
  getMyProfile,
  updateMyProfile,
  changeEmail,
  changeUsername,
  changePassword,
  getNotificationPrefs,
  updateNotificationPrefs,
  deleteMyAccount,
  uploadAvatar,
  deleteAvatar,
  uploadCover,
  deleteCover,
};

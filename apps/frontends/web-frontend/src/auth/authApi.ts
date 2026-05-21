import {
  type AvailabilityResponse,
  type LoginRequest,
  type LoginResponse,
  type LoginSuccess,
  type LoginTwoFactorRequest,
  type SignupRequest,
  type SignupResponse,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  AvailabilityResponseSchema,
  LoginResponseSchema,
  LoginSuccessSchema,
  SignupResponseSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordResponseSchema,
} from "interfaces-shared-types";
import { getToken, setToken } from "./authStorage";

const AUTH_BASE = "/api/auth";

async function postJson<T>(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = response.statusText;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string; detail?: string };
        message = parsed.message ?? parsed.detail ?? text;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function signIn(payload: LoginRequest): Promise<LoginResponse> {
  const data = await postJson<LoginResponse>("/login", payload);
  const parsed = LoginResponseSchema.parse(data);
  if ("token" in parsed) setToken(parsed.token);
  return parsed;
}

async function completeTwoFactor(payload: LoginTwoFactorRequest): Promise<LoginSuccess> {
  const data = await postJson<LoginSuccess>("/login/2fa", payload);
  const parsed = LoginSuccessSchema.parse(data);
  setToken(parsed.token);
  return parsed;
}

async function signUp(payload: SignupRequest): Promise<SignupResponse> {
  const data = await postJson<SignupResponse>("/signup", payload);
  return SignupResponseSchema.parse(data);
}

async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const data = await postJson<ForgotPasswordResponse>("/forgot-password", payload);
  return ForgotPasswordResponseSchema.parse(data);
}

async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const data = await postJson<ResetPasswordResponse>("/reset-password", payload);
  return ResetPasswordResponseSchema.parse(data);
}

async function logout(): Promise<void> {
  const token = getToken();
  if (token === null) return;
  try {
    await fetch(`${AUTH_BASE}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    // best-effort server revoke; local sign-out proceeds regardless
  }
}

function oauthStartUrl(provider: string, intent: "login" | "signup" | "link", token?: string): string {
  const params = new URLSearchParams({ intent });
  if (token !== undefined && token.length > 0) params.set("token", token);
  return `${AUTH_BASE}/oauth/${provider}/start?${params.toString()}`;
}

async function checkAvailability(params: { username?: string; email?: string }): Promise<AvailabilityResponse> {
  const search = new URLSearchParams();
  if (params.username !== undefined && params.username.length > 0) search.set("username", params.username);
  if (params.email !== undefined && params.email.length > 0) search.set("email", params.email);
  const response = await fetch(`${AUTH_BASE}/availability?${search.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(response.statusText);
  const data = (await response.json()) as unknown;
  return AvailabilityResponseSchema.parse(data);
}

export { signIn, completeTwoFactor, signUp, forgotPassword, resetPassword, checkAvailability, oauthStartUrl, logout };

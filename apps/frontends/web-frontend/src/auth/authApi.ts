import {
  type AvailabilityResponse,
  type LoginRequest,
  type LoginResponse,
  type SignupRequest,
  type SignupResponse,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  AvailabilityResponseSchema,
  LoginResponseSchema,
  SignupResponseSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordResponseSchema,
} from "interfaces-shared-types";
import { setToken } from "./authStorage";

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
  setToken(parsed.token);
  return parsed;
}

async function signUp(payload: SignupRequest): Promise<SignupResponse> {
  const data = await postJson<SignupResponse>("/signup", payload);
  const parsed = SignupResponseSchema.parse(data);
  await signIn({ identifier: payload.username, password: payload.password });
  return parsed;
}

async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const data = await postJson<ForgotPasswordResponse>("/forgot-password", payload);
  return ForgotPasswordResponseSchema.parse(data);
}

async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const data = await postJson<ResetPasswordResponse>("/reset-password", payload);
  return ResetPasswordResponseSchema.parse(data);
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

export { signIn, signUp, forgotPassword, resetPassword, checkAvailability };

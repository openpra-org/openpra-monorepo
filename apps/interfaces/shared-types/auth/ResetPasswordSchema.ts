import { z } from "zod";

const ForgotPasswordRequestSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
});

type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

const ForgotPasswordResponseSchema = z.object({
  detail: z.string(),
});

type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

const ResetPasswordResponseSchema = z.object({
  detail: z.string(),
});

type ResetPasswordResponse = z.infer<typeof ResetPasswordResponseSchema>;

export {
  ForgotPasswordRequestSchema,
  ForgotPasswordResponseSchema,
  ResetPasswordRequestSchema,
  ResetPasswordResponseSchema,
};
export type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
};

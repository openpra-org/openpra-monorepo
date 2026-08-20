import { z } from "zod";

const LoginRequestSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginRequest = z.infer<typeof LoginRequestSchema>;

const LoginSuccessSchema = z.object({
  token: z.string(),
});

type LoginSuccess = z.infer<typeof LoginSuccessSchema>;

const LoginChallengeSchema = z.object({
  twoFactorRequired: z.literal(true),
  challengeToken: z.string(),
});

type LoginChallenge = z.infer<typeof LoginChallengeSchema>;

const LoginResponseSchema = z.union([LoginSuccessSchema, LoginChallengeSchema]);

type LoginResponse = z.infer<typeof LoginResponseSchema>;

const LoginTwoFactorRequestSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().trim().min(1, "Authentication code is required"),
});

type LoginTwoFactorRequest = z.infer<typeof LoginTwoFactorRequestSchema>;

export {
  LoginRequestSchema,
  LoginSuccessSchema,
  LoginChallengeSchema,
  LoginResponseSchema,
  LoginTwoFactorRequestSchema,
};
export type {
  LoginRequest,
  LoginSuccess,
  LoginChallenge,
  LoginResponse,
  LoginTwoFactorRequest,
};

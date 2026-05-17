import { z } from "zod";

const LoginRequestSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginRequest = z.infer<typeof LoginRequestSchema>;

const LoginResponseSchema = z.object({
  token: z.string(),
});

type LoginResponse = z.infer<typeof LoginResponseSchema>;

export { LoginRequestSchema, LoginResponseSchema };
export type { LoginRequest, LoginResponse };

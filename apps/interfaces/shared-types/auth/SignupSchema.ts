import { z } from "zod";

const SignupRequestSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.email("Invalid email format"),
  organization: z.string(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupRequest = z.infer<typeof SignupRequestSchema>;

const SignupResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
});

type SignupResponse = z.infer<typeof SignupResponseSchema>;

export { SignupRequestSchema, SignupResponseSchema };
export type { SignupRequest, SignupResponse };

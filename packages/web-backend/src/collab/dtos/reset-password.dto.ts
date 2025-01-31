import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1).describe("Reset password token"),
    newPassword: z.string().min(8).max(255).describe("New password for the user"),
  })
  .describe("Reset password request");

class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export { ResetPasswordDto };

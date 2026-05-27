import { z } from "zod";

const TwoFactorCodeSchema = z.string().trim().min(1, "Authentication code is required");

const TwoFactorSetupResponseSchema = z.object({
  otpauthUri: z.string(),
  secret: z.string(),
});

type TwoFactorSetupResponse = z.infer<typeof TwoFactorSetupResponseSchema>;

const TwoFactorEnableRequestSchema = z.object({
  code: TwoFactorCodeSchema,
});

type TwoFactorEnableRequest = z.infer<typeof TwoFactorEnableRequestSchema>;

const TwoFactorEnableResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});

type TwoFactorEnableResponse = z.infer<typeof TwoFactorEnableResponseSchema>;

const TwoFactorDisableRequestSchema = z.object({
  code: TwoFactorCodeSchema,
});

type TwoFactorDisableRequest = z.infer<typeof TwoFactorDisableRequestSchema>;

const TwoFactorDisableResponseSchema = z.object({
  detail: z.string(),
});

type TwoFactorDisableResponse = z.infer<typeof TwoFactorDisableResponseSchema>;

export {
  TwoFactorSetupResponseSchema,
  TwoFactorEnableRequestSchema,
  TwoFactorEnableResponseSchema,
  TwoFactorDisableRequestSchema,
  TwoFactorDisableResponseSchema,
};
export type {
  TwoFactorSetupResponse,
  TwoFactorEnableRequest,
  TwoFactorEnableResponse,
  TwoFactorDisableRequest,
  TwoFactorDisableResponse,
};

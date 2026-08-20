import { z } from "zod";

export const VersionInfoSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  schemaVersion: z.string(),
  deprecatedFields: z.array(z.string()).optional(),
  deprecatedInterfaces: z.array(z.string()).optional(),
});

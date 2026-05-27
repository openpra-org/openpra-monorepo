import { z } from "zod";

export const UniqueSchema = z.object({
  uuid: z.string(),
});

export const NamedSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const VersionedSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
});

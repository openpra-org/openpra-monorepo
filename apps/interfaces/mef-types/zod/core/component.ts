import { z } from "zod";
import { NamedSchema, UniqueSchema, VersionedSchema } from "./meta";

export const ComponentReferenceSchema = z.string();

export const ComponentTypeReferenceSchema = z.string();

export const ComponentSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  description: z.string().optional(),
  type: z.string(),
  systemId: z.string(),
});

export const ComponentRegistrySchema = z.object({
  ...UniqueSchema.shape,
  components: z.record(z.string(), ComponentSchema),
  description: z.string().optional(),
  version: z.string(),
  lastUpdated: z.string(),
});

export const ComponentTypeSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  ...VersionedSchema.shape,
  description: z.string().optional(),
  category: z.string(),
  commonCharacteristics: z.record(z.string(), z.unknown()),
});

import { z } from "zod";
import { TechnicalElementTypes } from "../technical-element";
import { NamedSchema, UniqueSchema } from "./core/meta";
import { BaseAssumptionSchema } from "./core/documentation";
import { VersionInfoSchema } from "./core/version";

export const TechnicalElementTypesSchema = z.enum(TechnicalElementTypes);

export const TechnicalElementMetadataSchema = z.object({
  versionInfo: VersionInfoSchema,
  analysisDate: z.string(),
  analysts: z.array(z.string()),
  reviewers: z.array(z.string()),
  approvalStatus: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"]),
  scope: z.string(),
  limitations: z.array(z.string()),
  lastModifiedDate: z.string(),
  lastModifiedBy: z.string(),
});

export function technicalElementSchema<T extends TechnicalElementTypes>(type: T) {
  return z.object({
    ...UniqueSchema.shape,
    ...NamedSchema.shape,
    type: z.literal(type),
    version: z.string(),
    created: z.string(),
    modified: z.string(),
    owner: z.string().optional(),
    status: z.enum(["DRAFT", "REVIEW", "APPROVED", "DEPRECATED"]).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    commonAssumptions: z.array(BaseAssumptionSchema).optional(),
    references: z
      .array(
        z.object({
          technicalElementId: z.string(),
          technicalElementType: TechnicalElementTypesSchema,
          description: z.string(),
        }),
      )
      .optional(),
  });
}

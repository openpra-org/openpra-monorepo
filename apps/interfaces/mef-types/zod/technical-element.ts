import { z } from "zod";
import { TechnicalElementTypes } from "../technical-element";
import type { PlantIdentity, TechnicalElementMetadata } from "../technical-element";
import { NamedSchema, UniqueSchema } from "./core/meta";
import { BaseAssumptionSchema } from "./core/documentation";
import { VersionInfoSchema } from "./core/version";
import {
  CapabilityCategorySchema,
  CommentCollectionSchema,
  PlantStageSchema,
  ReviewerReferenceSchema,
  SRConformanceSchema,
  WorkflowHistoryEntrySchema,
  WorkflowStateSchema,
} from "./core/pra-common";

export const TechnicalElementTypesSchema = z.enum(TechnicalElementTypes);

// Additional
export const PlantIdentitySchema = z.object({
  name: z.string(),
  vendor: z.string(),
  reactorType: z.string(),
  thermalPower: z.string(),
  primaryCoolant: z.string(),
  intermediateCoolant: z.string().optional(),
  powerConversionFluid: z.string().optional(),
  siteName: z.string().optional(),
  numberOfModules: z.number().optional(),
});

export const TechnicalElementMetadataSchema = z.object({
  versionInfo: VersionInfoSchema,
  analysisDate: z.string(),
  analysts: z.array(z.string()),
  reviewers: z.array(ReviewerReferenceSchema),
  scope: z.string(),
  limitations: z.array(z.string()),
  lastModifiedDate: z.string(),
  lastModifiedBy: z.string(),
  // Additional
  plantIdentity: PlantIdentitySchema.optional(),
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
    workflowState: WorkflowStateSchema,
    workflowHistory: z.array(WorkflowHistoryEntrySchema),
    capabilityCategory: CapabilityCategorySchema.optional(),
    plantStage: PlantStageSchema,
    metadata: TechnicalElementMetadataSchema,
    conformanceMatrix: z.array(SRConformanceSchema),
    internalReviewComments: CommentCollectionSchema,
    activePeerReviewIds: z.array(z.string()),
    activeAuditIds: z.array(z.string()),
  });
}

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertTechnicalElementMetadata = Expect<Equal<z.infer<typeof TechnicalElementMetadataSchema>, TechnicalElementMetadata>>;
// Additional
type _AssertPlantIdentity = Expect<Equal<z.infer<typeof PlantIdentitySchema>, PlantIdentity>>;

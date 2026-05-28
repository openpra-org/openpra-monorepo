import { z } from "zod";
import { NamedSchema, UniqueSchema } from "./meta";
import { ImportanceLevelSchema, SensitivityStudySchema } from "./shared-patterns";

export const BaseDesignInformationSchema = z.object({
  sourceId: z.string(),
  sourceType: z.string(),
  revision: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  requirementId: z.string().optional(),
  standardSection: z.string().optional(),
});

export const BaseProcessDocumentationSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  processDescription: z.string(),
  inputsDescription: z.string().optional(),
  designInformation: z.array(BaseDesignInformationSchema).optional(),
  methodsDescription: z.string().optional(),
  resultsDescription: z.string().optional(),
  supportingDocumentationReferences: z.array(z.string()).optional(),
  requirementReferences: z
    .array(z.object({ requirementId: z.string(), implementation: z.string() }))
    .optional(),
});

export const BaseModelUncertaintyDocumentationSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  uncertaintySources: z.array(
    z.object({ source: z.string(), impact: z.string(), applicableElements: z.array(z.string()).optional() }),
  ),
  relatedAssumptions: z.array(
    z.object({ assumption: z.string(), basis: z.string(), applicableElements: z.array(z.string()).optional() }),
  ),
  reasonableAlternatives: z.array(
    z.object({ alternative: z.string(), reasonNotSelected: z.string(), applicableElements: z.array(z.string()).optional() }),
  ),
  requirementReference: z.string().optional(),
});

export const BaseAssumptionSchema = z.object({
  ...UniqueSchema.shape,
  description: z.string(),
  impact: z.string().optional(),
  rationale: z.string().optional(),
  references: z.array(z.string()).optional(),
  isPreOperational: z.boolean().optional(),
  addressingPlans: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED", "IN_PROGRESS"]).optional(),
  limitations: z.array(z.string()).optional(),
});

export const PreOperationalAssumptionSchema = z.object({
  ...BaseAssumptionSchema.shape,
  assumptionId: z.string(),
  requiredDesignInformation: z.array(BaseDesignInformationSchema).optional(),
  resolutionPlan: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED", "IN_PROGRESS"]),
  limitations: z.array(z.string()),
  influenceOnDefinition: z.string(),
  riskImpact: ImportanceLevelSchema,
  closureBasis: z.string(),
  plannedClosureActions: z.array(z.string()),
  affectedElementIds: z.array(z.string()),
  affectedTechnicalElementCodes: z.array(z.string()).optional(),
  potentialAlternatives: z.array(z.string()).optional(),
  sensitivityAnalysis: SensitivityStudySchema.optional(),
});

export const BasePreOperationalAssumptionsDocumentationSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  assumptions: z.array(PreOperationalAssumptionSchema),
  supportingDocumentationReferences: z.array(z.string()).optional(),
  validationPhase: z.string().optional(),
});

export const BasePeerReviewDocumentationSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  reviewDate: z.string(),
  reviewers: z.array(z.string()),
  findingsAndObservations: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      significance: ImportanceLevelSchema,
      resolutionStatus: z.enum(["OPEN", "CLOSED", "IN_PROGRESS"]),
      resolutionActions: z.array(z.string()).optional(),
      associatedRequirements: z.array(z.string()).optional(),
    }),
  ),
  scope: z.string(),
  methodology: z.string(),
  reportReference: z.string().optional(),
});

export const BaseTraceabilityDocumentationSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  modelingDecisions: z.record(z.string(), z.string()).optional(),
  dataSourceReferences: z.record(z.string(), z.array(z.string())).optional(),
  analysisFlowDiagram: z.string().optional(),
  changeLog: z
    .array(z.object({ version: z.string(), date: z.string(), changes: z.array(z.string()), analyst: z.string() }))
    .optional(),
  crossReferences: z
    .array(
      z.object({
        technicalElement: z.string(),
        elementId: z.string(),
        relationship: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

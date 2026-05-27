import { z } from "zod";
import { ImportanceLevel, RiskMetricType, RiskSignificanceCriteriaType, ScreeningStatus } from "../../core/shared-patterns";
import { UniqueSchema } from "./meta";

export const SuccessCriteriaIdSchema = z.string();

export const ImportanceLevelSchema = z.enum(ImportanceLevel);

export const SensitivityStudySchema = z.object({
  ...UniqueSchema.shape,
  name: z.string().optional(),
  description: z.string(),
  variedParameters: z.array(z.string()),
  parameterRanges: z.record(z.string(), z.tuple([z.number(), z.number()])),
  results: z.string().optional(),
  insights: z.string().optional(),
  impact: z.string().optional(),
  modelUncertaintyId: z.string().optional(),
  elementSpecificProperties: z.record(z.string(), z.unknown()).optional(),
});

export const BaseUncertaintyAnalysisSchema = z.object({
  ...UniqueSchema.shape,
  propagationMethod: z.enum(["MONTE_CARLO", "LATIN_HYPERCUBE", "ANALYTICAL", "OTHER"]),
  numberOfSamples: z.number().optional(),
  randomSeed: z.number().optional(),
  modelUncertainties: z.array(
    z.object({
      uncertaintyId: z.string(),
      description: z.string(),
      impact: z.string(),
      isQuantified: z.boolean(),
      treatmentApproach: z.string(),
    }),
  ),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
});

export const ScreeningStatusSchema = z.enum(ScreeningStatus);

export const ScreeningCriteriaSchema = z.object({
  frequency_criterion: z.number().optional(),
  risk_criterion: z.number().optional(),
  damage_frequency_criterion: z.number().optional(),
  basis: z.string(),
  screened_out_elements: z.array(
    z.object({
      element_id: z.string(),
      reason: z.string(),
      justification: z.string(),
    }),
  ),
  elementSpecificProperties: z.record(z.string(), z.unknown()).optional(),
});

export const RiskMetricTypeSchema = z.enum(RiskMetricType);

export const RiskSignificanceCriteriaTypeSchema = z.enum(RiskSignificanceCriteriaType);

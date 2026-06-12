import { z } from "zod";
import type { MechanisticSourceTermAnalysis } from "../../ms/mechanistic-source-term-analysis";
import { ReleaseForm, TransportPhenomenonType } from "../../ms/mechanistic-source-term-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { ParameterDistributionSchema } from "../core/events";
import { ImportanceLevelSchema, SensitivityStudySchema, BaseUncertaintyAnalysisSchema } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const ReleaseFormSchema = z.enum(ReleaseForm);
export const TransportPhenomenonTypeSchema = z.enum(TransportPhenomenonType);

export const ReleasePhaseSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  startTime: z.number(),
  endTime: z.number(),
  timeUnit: z.string().optional(),
});

export const RadionuclideReleaseQuantitySchema = z.object({
  radionuclide: z.string(),
  quantity: z.number(),
  unit: z.string(),
  expressedAsReleaseFraction: z.boolean().optional(),
  uncertainty: ParameterDistributionSchema.optional(),
});

export const ReleaseCategorySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  technicalBasis: z.string(),
  supportingReferences: z.array(z.string()).optional(),
  regulatoryAlignment: z.string().optional(),
  groupingJustification: z.string().optional(),
  differentiationBasis: z.enum(["CONSEQUENCE_METRIC", "CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION"]),
  timingClassification: z.string().optional(),
  magnitudeClassification: z.string().optional(),
  boundingSequenceReference: z.string(),
  boundingSequenceJustification: z.string().optional(),
  releaseTerminationTime: z.object({
    value: z.number(),
    unit: z.string(),
    justification: z.string(),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ReleaseCategoryCompletenessAssessmentSchema = z.object({
  setReasonablyComplete: z.boolean(),
  consistencyWithConsequenceAnalysis: z.string(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SourceInventorySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  radioactiveSourceRef: z.string().optional(),
  description: z.string(),
  calculationBasis: z.enum(["GENERIC_ESTIMATE", "PLANT_SPECIFIC_CALCULATION"]),
  inventory: z.array(
    z.object({
      radionuclide: z.string(),
      quantity: z.number(),
      unit: z.string(),
      physicalForm: z.string().optional(),
      chemicalForm: z.string().optional(),
    }),
  ),
  inventoryDataSource: z.string().optional(),
  radionuclideSelectionBasis: z.string().optional(),
  inventoryUncertainty: z
    .object({
      description: z.string(),
      distribution: ParameterDistributionSchema.optional(),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TransportBarrierAssessmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  posBarrierRef: z.string().optional(),
  releaseCategoryReference: z.string(),
  sourceInventoryRefs: z.array(z.string()),
  description: z.string(),
  barrierType: z.string(),
  failureModes: z.array(z.string()).optional(),
  transportCharacteristics: z.array(
    z.object({
      description: z.string(),
      affectedRadionuclides: z.array(z.string()).optional(),
      retentionEffectiveness: z.string().optional(),
    }),
  ),
  physicalChemicalConditions: z
    .object({
      temperature: z.string().optional(),
      pressure: z.string().optional(),
      flowRate: z.string().optional(),
      chemicalEnvironment: z.string().optional(),
      impactOnTransport: z.string(),
    })
    .optional(),
  transportMechanisms: z
    .array(
      z.object({
        mechanismType: TransportPhenomenonTypeSchema,
        description: z.string(),
        significance: ImportanceLevelSchema,
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TransportMechanismSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  mechanismType: z.string(),
  activatingConditions: z.array(z.string()).optional(),
  affectedRadionuclides: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TransportPhenomenaAssessmentSchema = z.object({
  uuid: z.string(),
  releaseCategoryReference: z.string(),
  phenomenaChecklist: z.array(
    z.object({
      phenomenonType: TransportPhenomenonTypeSchema,
      included: z.boolean(),
      justification: z.string().optional(),
    }),
  ),
  designUniquePhenomena: z.array(z.string()).optional(),
  modelsUsed: z.array(z.string()),
  relatedBarrierAssessmentRefs: z.array(z.string()).optional(),
  relatedMechanismRefs: z.array(z.string()).optional(),
  consequenceQuantificationSupport: z.object({
    description: z.string(),
    adequacyJustification: z.string(),
    sufficientForRiskSignificantDifferentiation: z.boolean().optional(),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SourceTermDefinitionSchema = z.object({
  uuid: z.string(),
  releaseCategoryReference: z.string(),
  sourceTermBasis: z.enum(["GENERIC_APPLICABLE", "PLANT_SPECIFIC_MECHANISTIC"]),
  genericApplicabilityJustification: z.string().optional(),
  postProcessingModifications: z.array(z.string()).optional(),
  riskSignificantCategoryCalculationConfirmed: z.boolean().optional(),
  involvedReactors: z.number().optional(),
  initiatingEventCharacteristics: z.string().optional(),
  releasePhases: z.array(ReleasePhaseSchema),
  radionuclideReleases: z.array(
    z.object({
      phaseId: z.string(),
      quantities: z.array(RadionuclideReleaseQuantitySchema),
    }),
  ),
  releaseForms: z.array(
    z.object({
      radionuclide: z.string(),
      form: z.string(),
    }),
  ),
  particleSizeDistribution: z
    .object({
      description: z.string(),
      sizeRanges: z.array(
        z.object({
          min: z.number(),
          max: z.number(),
          unit: z.string(),
          fraction: z.number(),
        }),
      ),
    })
    .optional(),
  warningTimeForEvacuation: z.string().optional(),
  releaseEnergy: z
    .object({
      quantity: z.number(),
      unit: z.string(),
    })
    .optional(),
  releaseElevation: z
    .object({
      quantity: z.number(),
      unit: z.string(),
    })
    .optional(),
  sourceTermModelRefs: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SourceTermModelSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  version: z.string(),
  technicalBasis: z.string(),
  validationStatus: z.string(),
  verificationValidationProcess: z.string().optional(),
  applicabilityLimits: z.array(z.string()).optional(),
  similarClassApplicationEvaluation: z.string().optional(),
  keyAssumptions: z.array(z.string()).optional(),
  knownLimitations: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  applicableAreas: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MsUncertaintyAnalysisSchema = z.object({
  ...BaseUncertaintyAnalysisSchema.shape,
  releaseCategoryReference: z.string(),
  sourceTermDefinitionRef: z.string().optional(),
  uncertainInputParameters: z.array(
    z.object({
      parameter: z.string(),
      description: z.string(),
      distribution: ParameterDistributionSchema.optional(),
    }),
  ),
  componentEstimates: z.array(
    z.object({
      component: z.string(),
      valueType: z.enum(["POINT_ESTIMATE", "MEAN"]),
      isRiskSignificantFamily: z.boolean(),
      probabilisticRepresentationProvided: z.boolean().optional(),
      distribution: ParameterDistributionSchema.optional(),
    }),
  ),
  expertJudgmentUsed: z.boolean().optional(),
  expertJudgmentProcessSatisfied: z.boolean().optional(),
  transportPhenomenaUncertainties: z
    .array(
      z.object({
        phenomenon: z.string(),
        description: z.string(),
        impact: z.string(),
        distribution: ParameterDistributionSchema.optional(),
      }),
    )
    .optional(),
  releaseFractionUncertainties: z
    .array(
      z.object({
        radionuclide: z.string(),
        description: z.string(),
        distribution: ParameterDistributionSchema,
      }),
    )
    .optional(),
  characterizationLevel: z.enum(["CHARACTERIZED", "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES"]),
  phenomenaDependencies: z
    .array(
      z.object({
        description: z.string(),
        dependentPhenomena: z.array(z.string()),
        treatmentMethod: z.string(),
      }),
    )
    .optional(),
  uncertaintyPropagationResults: z
    .object({
      description: z.string(),
      resultSummary: z.string(),
      confidenceIntervals: z
        .array(
          z.object({
            level: z.number(),
            lowerBound: z.number(),
            upperBound: z.number(),
          }),
        )
        .optional(),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MsModelUncertaintyAssessmentSchema = z.object({
  uuid: z.string(),
  sourceBlock: z.enum(["BARRIER_TRANSPORT_ASSESSMENT", "SOURCE_TERM_CALCULATION"]),
  uncertaintySource: z.string(),
  relatedAssumptions: z.array(z.string()),
  reasonableAlternatives: z.array(z.string()).optional(),
  evaluationType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  evaluationScope: z.enum(["INDIVIDUAL", "COMBINATION"]),
  consequenceEffect: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MsRiskIntegrationFeedbackSchema = z.object({
  analysisRef: z.string(),
  feedbackDate: z.string().optional(),
  releaseCategoryFeedback: z
    .array(
      z.object({
        releaseCategoryReference: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "ADDRESSED", "DEFERRED"]).optional(),
      }),
    )
    .optional(),
  sourceTermFeedback: z
    .array(
      z.object({
        sourceTermDefinitionRef: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        keyUncertainties: z.array(z.string()).optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "ADDRESSED", "DEFERRED"]).optional(),
      }),
    )
    .optional(),
  generalFeedback: z.string().optional(),
  response: z
    .object({
      description: z.string(),
      changes: z.array(z.string()).optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
    })
    .optional(),
});

export const MsDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  sourceCharacterizationAndInventories: z.string(),
  releaseCategoryDefinitionBases: z.string(),
  sequenceToReleaseCategoryAssignment: z.string(),
  transportPhenomenaPerCategory: z.string(),
  modelsAndComputerPrograms: z.string(),
  uncertaintyAndSensitivityAnalyses: z.string(),
  surrogateRiskMetrics: z.string(),
  sourceTermParameterTables: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MechanisticSourceTermAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS).shape,
  praScope: z.string(),
  releaseCategories: z.array(ReleaseCategorySchema),
  releaseCategoryCompletenessAssessment: ReleaseCategoryCompletenessAssessmentSchema,
  sourceInventories: z.array(SourceInventorySchema),
  transportBarrierAssessments: z.array(TransportBarrierAssessmentSchema),
  transportMechanisms: z.array(TransportMechanismSchema).optional(),
  transportPhenomenaAssessments: z.array(TransportPhenomenaAssessmentSchema),
  sourceTermDefinitions: z.array(SourceTermDefinitionSchema),
  sourceTermModels: z.array(SourceTermModelSchema).optional(),
  uncertaintyAnalyses: z.array(MsUncertaintyAnalysisSchema),
  modelUncertaintyAssessments: z.array(MsModelUncertaintyAssessmentSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  riskIntegrationFeedback: MsRiskIntegrationFeedbackSchema.optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: MsDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertMsMirrorsType = Expect<Equal<z.infer<typeof MechanisticSourceTermAnalysisSchema>, MechanisticSourceTermAnalysis>>;

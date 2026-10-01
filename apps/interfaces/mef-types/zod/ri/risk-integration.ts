import { z } from "zod";
import type { RiskIntegration } from "../../ri/risk-integration";
import { TechnicalElementTypes } from "../../technical-element";
import { EndState } from "../../core/events";
import { technicalElementSchema, TechnicalElementTypesSchema } from "../technical-element";
import { ParameterDistributionSchema } from "../core/events";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";
import { RcMetricQuantitySchema, RcMetricReceptorSchema } from "../rc/metrics";
import {
  EventSequenceFamilyQuantificationReferenceSchema,
  EventSequenceFamilyWorkbookReferenceSchema,
  RadiologicalConsequenceResultReferenceSchema,
} from "../modeling/references";

export const RiskMetricSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metricType: z.string(),
  consequenceMeasureRef: z.string().optional(),
  value: z.number(),
  units: z.string(),
  uncertainty: ParameterDistributionSchema.optional(),
  uncertaintyDescription: z.string().optional(),
  acceptanceCriteria: z
    .object({
      limit: z.number(),
      basis: z.string(),
      complianceStatus: z.enum(["COMPLIANT", "NON_COMPLIANT", "INDETERMINATE"]),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskContributorSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  contributorType: z.string(),
  sourceElement: TechnicalElementTypesSchema,
  sourceId: z.string(),
  importanceMetrics: z
    .object({
      fussellVesely: z.number().optional(),
      riskAchievementWorth: z.number().optional(),
      riskReductionWorth: z.number().optional(),
      birnbaum: z.number().optional(),
      criticality: z.number().optional(),
    })
    .optional(),
  riskContribution: z.number().optional(),
  importanceLevel: ImportanceLevelSchema.optional(),
  context: z.string().optional(),
  insights: z.array(z.string()).optional(),
});

const thresholdsShape = {
  eventSequence: z.number().optional(),
  eventSequenceFamily: z.number().optional(),
  basicEvent: z.number().optional(),
  humanFailureEvent: z.number().optional(),
  component: z.number().optional(),
  system: z.number().optional(),
};

export const RiskSignificanceCriteriaSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  applicationType: z.enum(["BASELINE_RISK", "FIXED_RISK_TARGET"]),
  criteriaSource: z.enum(["TABLE_1_9_1", "TABLE_1_9_2", "ALTERNATE"]),
  alternateJustification: z.string().optional(),
  criteriaType: z.string(),
  metricType: z.string(),
  absoluteThresholds: z.object(thresholdsShape).optional(),
  relativeThresholds: z.object(thresholdsShape).optional(),
  justification: z.string(),
  references: z.array(z.string()).optional(),
  intendedApplications: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

const RiFloorValueSchema = z.object({
  value: z.number(),
  justification: z.string().optional(),
});

export const ReportingThresholdsSchema = z.object({
  minimumReportingFrequencyPerPlantYear: z.number(),
  frequencyBasis: z.enum(["STANDARD_DEFAULT", "JUSTIFIED_ALTERNATIVE"]),
  frequencyJustification: z.string().optional(),
  minimumReportingConsequenceDescription: z.string(),
  consequenceBasis: z.enum(["STANDARD_DEFAULT", "JUSTIFIED_ALTERNATIVE"]),
  consequenceJustification: z.string().optional(),
  consequenceFloor: z.object({
    backgroundMremPerYear: RiFloorValueSchema,
    windowDays: RiFloorValueSchema,
    sharePercent: RiFloorValueSchema,
  }).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskSignificanceEvaluationSchema = z.object({
  uuid: z.string(),
  elementType: z.string(),
  elementId: z.string(),
  criteriaReference: z.string(),
  evaluationResults: z.object({
    absoluteValue: z.number().optional(),
    relativeValue: z.number().optional(),
    isSignificant: z.boolean(),
    significanceBasis: z.string(),
  }),
  insights: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CompiledRiskInputSchema = z.object({
  uuid: z.string(),
  eventSequenceFamilyRef: z.string(),
  eventSequenceFamilyReference: EventSequenceFamilyWorkbookReferenceSchema.optional(),
  releaseCategoryRef: z.string().optional(),
  sourceTermDefinitionRef: z.string().optional(),
  frequency: z.number(),
  frequencyUnit: z.string().optional(),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  esqFamilyQuantificationRef: z.string().optional(),
  familyQuantificationReferences: z.array(EventSequenceFamilyQuantificationReferenceSchema).optional(),
  consequences: z.array(
    z.object({
      metric: z.string(),
      meanValue: z.number(),
      unit: z.string().optional(),
      distribution: ParameterDistributionSchema.optional(),
    }),
  ),
  rcqRecordRef: z.string().optional(),
  consequenceResultReference: RadiologicalConsequenceResultReferenceSchema.optional(),
  consistentWithEventSequenceAnalysis: z.boolean().optional(),
  consistentWithMechanisticSourceTerm: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IntegratedRiskResultsSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  calculationLevel: z.enum(["POINT_ESTIMATE", "MEAN"]),
  metrics: z.array(RiskMetricSchema),
  calculationApproach: z.object({
    sumOfProducts: z.boolean().optional(),
    frequencyConsequencePlots: z.boolean().optional(),
    exceedanceFrequencyCurves: z.boolean().optional(),
    alternativeApproach: z.string().optional(),
    justification: z.string(),
  }),
  frequencyConsequencePlotData: z
    .array(
      z.object({
        eventSequenceRef: z.string(),
        eventSequenceName: z.string().optional(),
        frequency: z.number(),
        consequence: z.number(),
        consequenceMetric: z.string(),
        frequencyUncertainty: z
          .object({
            lowerBound: z.number(),
            upperBound: z.number(),
            confidenceLevel: z.number(),
          })
          .optional(),
        consequenceUncertainty: z
          .object({
            lowerBound: z.number(),
            upperBound: z.number(),
            confidenceLevel: z.number(),
          })
          .optional(),
      }),
    )
    .optional(),
  exceedanceFrequencyCurveData: z
    .array(
      z.object({
        consequenceMetric: z.string(),
        dataPoints: z.array(
          z.object({
            consequenceValue: z.number(),
            exceedanceFrequency: z.number(),
          }),
        ),
        uncertaintyBands: z
          .array(
            z.object({
              confidenceLevel: z.number(),
              dataPoints: z.array(
                z.object({
                  consequenceValue: z.number(),
                  exceedanceFrequency: z.number(),
                }),
              ),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  sourceContributions: z
    .array(
      z.object({
        sourceRef: z.string(),
        contribution: z.number(),
      }),
    )
    .optional(),
  hazardGroupContributions: z
    .array(
      z.object({
        hazardGroup: z.string(),
        contribution: z.number(),
      }),
    )
    .optional(),
  plantOperatingStateContributions: z
    .array(
      z.object({
        plantOperatingStateRef: z.string(),
        contribution: z.number(),
      }),
    )
    .optional(),
  aggregationApproach: z.object({
    description: z.string(),
    perSourceHazardContributionsIdentified: z.boolean(),
    detailConservatismDifferences: z
      .array(
        z.object({
          scope: z.string(),
          description: z.string(),
        }),
      )
      .optional(),
    separateReviewPerformed: z.boolean().optional(),
    separateReviewFindings: z.string().optional(),
    justification: z.string(),
  }),
  multiReactorContributionsIncluded: z.boolean(),
  multiSourceContributionsIncluded: z.boolean(),
  hazardGroupAssignments: z.array(z.object({ initiatingEventId: z.string(), hazardGroup: z.string() })).optional(),
  complianceStatus: z
    .array(
      z.object({
        criterion: z.string(),
        limit: z.number(),
        status: z.enum(["COMPLIANT", "NON_COMPLIANT", "INDETERMINATE"]),
        margin: z.number().optional(),
        basis: z.string().optional(),
      }),
    )
    .optional(),
  integrationChallenges: z.string().optional(),
  keyAssumptions: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const GroupingAdequacyReviewSchema = z.object({
  variationNotSignificantJustification: z.string(),
  releaseCategorySelectionSufficiency: z.string(),
  familyAssignmentSufficiency: z.string(),
  groupingUncertaintyReview: z.object({
    performed: z.boolean(),
    artificialSignificanceFound: z.boolean(),
    findings: z.string().optional(),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SignificantRiskContributorsSchema = z.object({
  uuid: z.string(),
  metricType: z.string(),
  description: z.string().optional(),
  significantEventSequences: z.array(RiskContributorSchema).optional(),
  significantEventSequenceFamilies: z.array(RiskContributorSchema).optional(),
  significantInitiatingEvents: z.array(RiskContributorSchema).optional(),
  significantReleaseCategories: z.array(RiskContributorSchema).optional(),
  significantSystems: z.array(RiskContributorSchema).optional(),
  significantComponents: z.array(RiskContributorSchema).optional(),
  significantBasicEvents: z.array(RiskContributorSchema).optional(),
  significantHumanFailureEvents: z.array(RiskContributorSchema).optional(),
  significantPlantOperatingStates: z.array(RiskContributorSchema).optional(),
  significantHazardGroups: z.array(RiskContributorSchema).optional(),
  significantRadioactiveSources: z.array(RiskContributorSchema).optional(),
  insightDerivationBasis: z.string().optional(),
  insights: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskIntegrationMethodSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  applicability: z.string().optional(),
  limitations: z.array(z.string()).optional(),
  scopeJustification: z.string(),
  sqaReference: z.string().optional(),
  verificationStatus: z
    .object({
      verified: z.boolean(),
      verificationMethod: z.string().optional(),
      verificationDate: z.string().optional(),
      verifier: z.string().optional(),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModelUncertaintySourceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  originatingElement: TechnicalElementTypesSchema,
  impactScope: z.array(TechnicalElementTypesSchema).optional(),
  affectedMetrics: z.array(z.string()),
  impactAssessment: z.string(),
  frequencyImpactRef: z.string().optional(),
  consequenceImpactRef: z.string().optional(),
  characterizationMethod: z.string().optional(),
  relatedAssumptions: z.array(z.string()).optional(),
  alternatives: z
    .array(
      z.object({
        description: z.string(),
        potentialImpact: z.string(),
      }),
    )
    .optional(),
  recommendations: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ScreenedItemLedgerEntrySchema = z.object({
  uuid: z.string(),
  itemType: z.enum(["HAZARD_GROUP", "HAZARD_EVENT", "PLANT_OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "BASIC_EVENT"]),
  itemRef: z.string(),
  screeningElementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC"]),
  screeningBasis: z.string(),
  impactOnRiskMetrics: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskUncertaintyAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metric: z.string(),
  characterizationLevel: z.enum(["CHARACTERIZED", "PROPAGATED_RISK_SIGNIFICANT"]),
  propagationMethod: z.string(),
  parameterUncertainty: ParameterDistributionSchema.optional(),
  sokcAndPhenomenaTreatment: z.object({
    eventFrequencySokcConsidered: z.boolean(),
    phenomenaDependenciesConsidered: z.boolean(),
    treatmentDescription: z.string().optional(),
    riskSignificanceBasis: z.string().optional(),
  }),
  evaluationScope: z.enum(["INDIVIDUAL", "COMBINATION"]),
  evaluationType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  keyUncertaintySourceRefs: z.array(z.string()).optional(),
  prioritization: z
    .array(
      z.object({
        uncertaintySourceId: z.string(),
        priorityLevel: ImportanceLevelSchema,
        basis: z.string(),
      }),
    )
    .optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  uncertaintyRangeDiscussion: z.string().optional(),
  keyUncertaintyContributors: z
    .array(
      z.object({
        sourceId: z.string(),
        sourceName: z.string().optional(),
        contribution: z.union([z.string(), z.number()]),
        basis: z.string(),
        potentialImpactRange: z
          .object({
            lowerBound: z.number(),
            upperBound: z.number(),
            unit: z.string().optional(),
          })
          .optional(),
        recommendedActions: z.array(z.string()).optional(),
        priority: ImportanceLevelSchema.optional(),
      }),
    )
    .optional(),
  keyContributorIdentificationMethod: z
    .object({
      description: z.string(),
      significanceCriteria: z.string(),
      justification: z.string(),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskIntegrationFeedbackDispatchSchema = z.object({
  dispatchDate: z.string().optional(),
  eventSequenceQuantificationFeedback: z
    .object({
      familyFeedback: z
        .array(
          z.object({
            familyRef: z.string(),
            riskSignificance: ImportanceLevelSchema.optional(),
            significanceReason: z.string().optional(),
            insights: z.array(z.string()).optional(),
            recommendations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      contributorFeedback: z
        .array(
          z.object({
            entityRef: z.string(),
            riskSignificance: ImportanceLevelSchema.optional(),
            significanceReason: z.string().optional(),
            insights: z.array(z.string()).optional(),
            recommendations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      generalFeedback: z.string().optional(),
    })
    .optional(),
  mechanisticSourceTermFeedback: z
    .object({
      releaseCategoryFeedback: z
        .array(
          z.object({
            releaseCategoryRef: z.string(),
            riskSignificance: ImportanceLevelSchema.optional(),
            significanceReason: z.string().optional(),
            insights: z.array(z.string()).optional(),
            recommendations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      sourceTermFeedback: z
        .array(
          z.object({
            sourceTermDefinitionRef: z.string(),
            riskSignificance: ImportanceLevelSchema.optional(),
            significanceReason: z.string().optional(),
            insights: z.array(z.string()).optional(),
            keyUncertainties: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      generalFeedback: z.string().optional(),
    })
    .optional(),
  radiologicalConsequenceFeedback: z
    .object({
      metricFeedback: z
        .array(
          z.object({
            metric: z.string(),
            riskSignificance: ImportanceLevelSchema.optional(),
            significanceReason: z.string().optional(),
            insights: z.array(z.string()).optional(),
            recommendations: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      generalFeedback: z.string().optional(),
    })
    .optional(),
  additionalElementFeedback: z
    .array(
      z.object({
        elementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA"]),
        riskSignificance: ImportanceLevelSchema.optional(),
        significanceReason: z.string().optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
        generalFeedback: z.string().optional(),
      }),
    )
    .optional(),
});

export const RiDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  riskSignificanceCriteriaUsed: z.string(),
  resultsAndInsights: z.string(),
  scopeLimitations: z.string(),
  traceabilityToUpstreamContributions: z.string(),
  acceptanceCriteriaComparison: z.string(),
  keyUncertaintySources: z.string(),
  designFeatureInsights: z.string(),
  integratedContributorRollup: z.string(),
  modelUncertaintySourcesDocumentation: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiApplicationContextSchema = z.object({
  applicationType: z.enum(["BASELINE_RISK", "FIXED_RISK_TARGET"]),
  licensingAction: z.enum([
    "PRE_APPLICATION",
    "CONSTRUCTION_PERMIT",
    "OPERATING_LICENSE",
    "DESIGN_CERTIFICATION",
    "COMBINED_LICENSE",
    "STANDARD_DESIGN_APPROVAL",
    "MANUFACTURING_LICENSE",
  ]).optional(),
  siteBasis: z.enum(["SITE_INDEPENDENT", "BOUNDING_SITE", "SPECIFIC_SITE"]).optional(),
  linkedWorkbooks: z.object({
    POS: z.string().optional(),
    ES: z.string().optional(),
    ESQ: z.string().optional(),
    MS: z.string().optional(),
    RC: z.string().optional(),
  }),
});

const RiStatisticSchema = z.enum(["MEAN", "P05", "P50", "P95"]);

const RiNumberCriterionSchema = z.object({
  value: z.number(),
  justification: z.string().optional(),
});

const RiStatisticCriterionSchema = z.object({
  value: RiStatisticSchema,
  justification: z.string().optional(),
});

export const RiCriteriaSetSchema = z.object({
  publishedSet: z.literal("NEI_18_04_REV1"),
  absolute: z.object({
    fcAnchors: z.array(z.object({
      doseRem: z.number(),
      frequencyPerPlantYear: z.number(),
      justification: z.string().optional(),
    })),
    fcStatistic: RiStatisticCriterionSchema,
    aooLowerPerPlantYear: RiNumberCriterionSchema,
    dbeLowerPerPlantYear: RiNumberCriterionSchema,
    bdbeLowerPerPlantYear: RiNumberCriterionSchema,
    categoryStatistic: RiStatisticCriterionSchema,
    bandLowerStatistic: RiStatisticCriterionSchema,
    bandUpperStatistic: RiStatisticCriterionSchema,
    bdbeFloorStatistic: RiStatisticCriterionSchema,
    highConsequenceDoseRem: RiNumberCriterionSchema.optional(),
    highConsequenceStatistic: RiStatisticCriterionSchema.optional(),
    lbeTargetPercent: RiNumberCriterionSchema,
    lbeDoseFloorMrem: RiNumberCriterionSchema,
    lbeFrequencyStatistic: RiStatisticCriterionSchema,
    lbeDoseStatistic: RiStatisticCriterionSchema,
    sscTargetStatistic: RiStatisticCriterionSchema,
    sscCumulativePercent: RiNumberCriterionSchema,
    sscCumulativeStatistic: RiStatisticCriterionSchema,
    cumulativeTargets: z.array(z.object({
      id: z.enum(["DOSE_100_MREM_EXCEEDANCE", "EARLY_FATALITY_RISK", "LATENT_CANCER_RISK"]),
      limitPerPlantYear: z.number(),
      justification: z.string().optional(),
    })),
    cumulativeStatistic: RiStatisticCriterionSchema,
  }),
  relative: z.object({
    aggregatePercent: RiNumberCriterionSchema,
    individualPercent: RiNumberCriterionSchema,
    fussellVesely: RiNumberCriterionSchema,
    riskAchievementWorth: RiNumberCriterionSchema,
  }),
});

const RiFrequencyStatsSchema = z.object({
  mean: z.number(),
  p05: z.number().optional(),
  p50: z.number().optional(),
  p95: z.number().optional(),
});

const RiManualEntrySchema = z.object({ source: z.string() });

const RiConsequenceStatsSchema = z.object({
  mean: z.number().optional(),
  percentiles: z.array(z.object({ percentile: z.number(), value: z.number() })),
  exceedances: z.array(z.object({ threshold: z.number(), probability: z.number() })),
});

export const RiInputsSchema = z.object({
  importedAt: z.string().optional(),
  sources: z.array(z.object({
    element: z.enum(["ES", "ESQ", "RC"]),
    workbookId: z.string(),
    workbookName: z.string(),
    updatedAt: z.string().optional(),
  })),
  families: z.array(z.object({
    id: z.string(),
    name: z.string(),
    plantOperatingStateId: z.string(),
    initiatingEventId: z.string(),
    releaseCategoryIds: z.array(z.string()),
    endState: z.nativeEnum(EndState),
    memberSequenceIds: z.array(z.string()),
    frequencySource: z.enum(["ESQ", "ES"]).optional(),
    quantificationIds: z.array(z.string()),
    imported: RiFrequencyStatsSchema.optional(),
    frequency: RiFrequencyStatsSchema.optional(),
    changeReason: z.string().optional(),
    included: z.boolean(),
    exclusionReason: z.string().optional(),
    manual: RiManualEntrySchema.optional(),
  })),
  sequences: z.array(z.object({
    id: z.string(),
    name: z.string(),
    familyId: z.string().optional(),
    plantOperatingStateId: z.string(),
    initiatingEventId: z.string(),
    topEvents: z.array(z.object({ event: z.string(), state: z.enum(["SUCCESS", "FAILURE", "BYPASSED"]) })),
    endState: z.nativeEnum(EndState),
    releaseCategoryId: z.string().optional(),
    reactorSourceCombinations: z.array(z.string()),
    frequencySource: z.enum(["ESQ", "ES"]).optional(),
    imported: RiFrequencyStatsSchema.optional(),
    frequency: RiFrequencyStatsSchema.optional(),
    changeReason: z.string().optional(),
    manual: RiManualEntrySchema.optional(),
  })),
  consequences: z.array(z.object({
    releaseCategoryId: z.string(),
    measure: z.string(),
    rcMetricId: z.string(),
    unit: z.string(),
    sourceTermId: z.string().optional(),
    imported: RiConsequenceStatsSchema.optional(),
    statistics: RiConsequenceStatsSchema,
    changeReason: z.string().optional(),
    manual: RiManualEntrySchema.optional(),
  })),
  contributors: z.array(z.object({
    familyId: z.string(),
    quantificationId: z.string(),
    quantificationMean: z.number(),
    name: z.string(),
    type: z.string(),
    fraction: z.number(),
    manual: RiManualEntrySchema.optional(),
  })).optional(),
  importance: z.array(z.object({
    analysisId: z.string(),
    scope: z.enum(["OVERALL", "PER_FAMILY", "PER_SEQUENCE"]),
    familyRef: z.string().optional(),
    sequenceRef: z.string().optional(),
    entityType: z.string(),
    entity: z.string(),
    systemRef: z.string().optional(),
    fussellVesely: z.number().optional(),
    riskAchievementWorth: z.number().optional(),
    riskReductionWorth: z.number().optional(),
    birnbaum: z.number().optional(),
    manual: RiManualEntrySchema.optional(),
  })).optional(),
  unavailable: z.array(z.object({ measure: z.string(), reason: z.string() })).optional(),
});

export const RiScopeExclusionSchema = z.object({
  aspect: z.enum(["HAZARD_GROUP", "OPERATING_STATE", "SOURCE", "MODULE"]),
  item: z.string(),
  reason: z.string(),
});

export const RiEventCategoriesSchema = z.object({
  cliffEdgeChecks: z.array(z.object({
    familyId: z.string(),
    status: z.enum(["NO_CLIFF_EDGE", "CLIFF_EDGE"]).optional(),
    basis: z.string(),
  })),
});

export const RiskIntegrationSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.RISK_INTEGRATION).shape,
  praScope: z.string(),
  applicationContext: RiApplicationContextSchema.optional(),
  criteriaSet: RiCriteriaSetSchema.optional(),
  inputs: RiInputsSchema.optional(),
  eventCategories: RiEventCategoriesSchema.optional(),
  sscAssignments: z.array(z.object({ contributor: z.string(), ssc: z.string() })).optional(),
  scopeDefinition: z.object({
    consequenceMeasures: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      role: z.enum(["EAB_DOSE", "EARLY_FATALITY_RISK", "LATENT_CANCER_RISK"]).optional(),
      quantity: RcMetricQuantitySchema.optional(),
      customUnit: z.string().optional(),
      receptor: RcMetricReceptorSchema.optional(),
      window: z.object({
        seconds: z.number().finite().positive(),
        start: z.enum(["RELEASE_ONSET", "PLUME_ARRIVAL"]),
      }).strict().optional(),
      protectiveActionsCredited: z.boolean().optional(),
    })),
    plantOperatingStateRefs: z.array(z.string()),
    hazardGroups: z.array(z.string()),
    radioactiveMaterialSources: z.array(z.string()),
    reactorModules: z.array(z.string()).optional(),
    scopeExclusions: z.array(RiScopeExclusionSchema).optional(),
    eventSequenceFamilyRefs: z.array(z.string()).optional(),
    releaseCategoryRefs: z.array(z.string()).optional(),
    sourceTermDefinitionRefs: z.array(z.string()).optional(),
  }),
  riskSignificanceCriteria: z.array(RiskSignificanceCriteriaSchema),
  reportingThresholds: ReportingThresholdsSchema,
  riskSignificanceEvaluations: z.array(RiskSignificanceEvaluationSchema).optional(),
  compiledRiskInputs: z.array(CompiledRiskInputSchema),
  integratedRiskResults: IntegratedRiskResultsSchema,
  groupingAdequacyReview: GroupingAdequacyReviewSchema,
  significantContributors: SignificantRiskContributorsSchema,
  integrationMethods: z.array(RiskIntegrationMethodSchema),
  modelUncertaintySources: z.array(ModelUncertaintySourceSchema),
  screenedItemsLedger: z.array(ScreenedItemLedgerEntrySchema).optional(),
  uncertaintyAnalyses: z.array(RiskUncertaintyAnalysisSchema),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  riskIntegrationFeedbackDispatch: RiskIntegrationFeedbackDispatchSchema.optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: RiDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["doc", "sheet", "image"]),
    sizeLabel: z.string(),
    uploadedLabel: z.string(),
    extracted: z.string(),
    linked: z.number(),
    url: z.string().optional(),
  })).optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertRiMirrorsType = Expect<Equal<z.infer<typeof RiskIntegrationSchema>, RiskIntegration>>;

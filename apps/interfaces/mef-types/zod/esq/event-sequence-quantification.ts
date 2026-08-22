import { z } from "zod";
import type { EventSequenceQuantification } from "../../esq/event-sequence-quantification";
import {
  DependencyType,
  TruncationMethod,
  QuantificationApproach,
  CircularLogicResolutionMethod,
  RiskSignificantContributorType,
} from "../../esq/event-sequence-quantification";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { FrequencySchema, FrequencyWithDistributionSchema, ParameterDistributionSchema } from "../core/events";
import { ImportanceLevelSchema, SensitivityStudySchema, BaseUncertaintyAnalysisSchema } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";
import { EsqBayesianNetworkSchema, EsqHclConfigurationSchema } from "./workbook-models";

export const DependencyTypeSchema = z.enum(DependencyType);
export const TruncationMethodSchema = z.enum(TruncationMethod);
export const QuantificationApproachSchema = z.enum(QuantificationApproach);
export const CircularLogicResolutionMethodSchema = z.enum(CircularLogicResolutionMethod);
export const RiskSignificantContributorTypeSchema = z.enum(RiskSignificantContributorType);

export const EventSequenceFamilyQuantificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eventSequenceFamilyRef: z.string(),
  crossSourceGroupingJustification: z.string().optional(),
  crossPosGroupingJustification: z.string().optional(),
  dependenciesConsideredInGrouping: z.boolean(),
  representativeSequenceSelectionBasis: z.string().optional(),
  quantificationBasis: z.enum(["POINT_ESTIMATE", "MEAN_PROPAGATED_SOKC", "MEAN_RISK_SIGNIFICANT_PARAMETERS"]),
  meanFrequency: z.union([FrequencySchema, FrequencyWithDistributionSchema]),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  percentile05: z.number().optional(),
  percentile50: z.number().optional(),
  percentile95: z.number().optional(),
  significantUncertaintySources: z.array(z.string()).optional(),
  contributionBreakdown: z
    .array(
      z.object({
        contributorRef: z.string(),
        contributorType: z.string(),
        fractionalContribution: z.number(),
      }),
    )
    .optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SequenceFrequencyEstimateSchema = z.object({
  uuid: z.string(),
  eventSequenceRef: z.string(),
  meanFrequency: z.union([FrequencySchema, FrequencyWithDistributionSchema]),
  frequencyDistribution: ParameterDistributionSchema.optional(),
  percentile05: z.number().optional(),
  percentile50: z.number().optional(),
  percentile95: z.number().optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModelIntegrationSchema = z.object({
  integrationMethod: z.string(),
  softwareTools: z.array(z.string()),
  integrationSteps: z.array(z.string()),
  integrationVerification: z.string(),
  scopeCoverage: z.object({
    radionuclideSources: z.array(z.string()),
    initiatingEventGroups: z.array(z.string()),
    hazardGroups: z.array(z.string()),
    plantOperatingStates: z.array(z.string()),
    plantEvolutions: z.array(z.string()),
  }),
  systemDependenciesAccounted: z.boolean(),
  multiReactorSequencesIncluded: z.boolean(),
  multiReactorInclusionBasis: z.string().optional(),
  integrationIssues: z
    .array(
      z.object({
        description: z.string(),
        resolution: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComputerCodeRecordSchema = z.object({
  name: z.string(),
  version: z.string(),
  verificationDocumentation: z.string(),
  validationDocumentation: z.string(),
  benchmarkComparison: z.string().optional(),
  methodSpecificLimitations: z.array(z.string()),
  methodSpecificFeatures: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConvergenceAnalysisSchema = z.object({
  truncationMethod: TruncationMethodSchema,
  finalTruncationValue: z.number(),
  truncationProgression: z.array(z.number()),
  frequencyAtTruncation: z.record(z.coerce.number(), z.number()),
  percentageChangeAtTruncation: z.record(z.coerce.number(), z.number()),
  basisForSelection: z.string(),
  convergenceDemonstration: z.string(),
  dependenciesPreservedAtTruncation: z.boolean(),
  mergedCutsetTruncationConfirmed: z.boolean().optional(),
  mergedCutsetConfirmationBasis: z.string().optional(),
  truncationSensitivity: z.string().optional(),
  demonstratedFamilyRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const QuantificationMethodsSchema = z.object({
  approach: QuantificationApproachSchema,
  methodDiscriminationJustification: z.string(),
  cutsetSolutionMethod: z.enum(["MCUB", "EXACT", "RARE_EVENT"]).optional(),
  rareEventJustification: z.string().optional(),
  computerCodes: z.array(ComputerCodeRecordSchema),
  truncation: ConvergenceAnalysisSchema,
  postInitiatorHfeHandling: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RecoveryActionApplicationSchema = z.object({
  uuid: z.string(),
  recoveryActionRef: z.string(),
  appliedAtLevel: z.enum(["FAMILY", "SEQUENCE", "CUTSET"]),
  applicableFamilyRefs: z.array(z.string()).optional(),
  hrFeasibilityRequirementsSatisfied: z.boolean(),
  hrDependencyRequirementsSatisfied: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ParameterConsistencyAttestationSchema = z.object({
  capabilityCategory: z.enum(["CC_I", "CC_II"]),
  hrParameterConsistency: z.boolean(),
  daParameterConsistency: z.boolean(),
  sequenceConditionsConsidered: z.boolean(),
  harshEnvironmentsConsidered: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaParameterBasisSchema = z.object({
  uuid: z.string(),
  familyRef: z.string(),
  isRiskSignificant: z.boolean(),
  basis: z.enum(["CONSERVATIVE", "REALISTIC", "COMBINED"]),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CircularLogicResolutionSchema = z.object({
  uuid: z.string(),
  description: z.string(),
  involvedElementIds: z.array(z.string()),
  detectionMethod: z.string(),
  resolutionMethod: CircularLogicResolutionMethodSchema,
  resolutionDescription: z.string(),
  neutralityJustification: z.string(),
  resolutionImpact: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemSuccessTreatmentSchema = z.object({
  treatmentMethod: z.string(),
  systemsWithSuccessModeled: z.array(z.string()),
  impactOnResults: z.string(),
  modelingExamples: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MutuallyExclusiveEventRuleSchema = z.object({
  uuid: z.string(),
  description: z.string(),
  eventIds: z.array(z.string()),
  basis: z.string(),
  identifiedInResults: z.boolean(),
  treatment: z.enum(["LOGIC_ELIMINATION", "CUTSET_DELETION"]),
  retentionJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FlagEventSettingSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  purpose: z.string(),
  state: z.boolean(),
  effect: z.string(),
  basis: z.string(),
  isTemporary: z.boolean(),
  applicableFamilyRefs: z.array(z.string()).optional(),
  setPriorToCutsetGeneration: z.boolean(),
  houseEventNodeRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModuleUsageRecordSchema = z.object({
  uuid: z.string(),
  moduleType: z.enum(["MODULE", "SUBTREE", "SPLIT_FRACTION"]),
  processDescription: z.string(),
  sharedEventsIdentified: z.boolean(),
  trueIndependenceVerified: z.boolean(),
  perEventInterpretabilityMaintained: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MultiHfeCutsetIdentificationSchema = z.object({
  uuid: z.string(),
  quantificationResultRef: z.number().optional(),
  cutsetDescription: z.string(),
  hfeRefs: z.array(z.string()),
  potentialRiskImpact: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HfeDependencyApplicationSchema = z.object({
  uuid: z.string(),
  hrDependencyAssessmentRef: z.string(),
  cutsetContext: z.string(),
  appliedJointHep: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LinkingTransferRecordSchema = z.object({
  uuid: z.string(),
  sourceTreeDescription: z.string(),
  targetTreeDescription: z.string(),
  failedEquipmentTransferred: z.array(z.string()),
  flagSettingsTransferred: z.array(z.string()),
  otherCharacteristicsTransferred: z.array(z.string()).optional(),
  frequencyTransferred: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaDependencyAssessmentSchema = z.object({
  uuid: z.string(),
  phenomenon: z.string(),
  affectedSscRefs: z.array(z.string()),
  dependencyAssessment: z.string(),
  independenceJustifications: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const BarrierFailureModeQuantificationSchema = z.object({
  failureMode: z.string(),
  failureType: z.enum(["GROSS", "LOCALIZED_DEGRADED"]),
  mechanisms: z.array(z.string()),
  probability: z.number().optional(),
  perFamilyProbabilities: z
    .array(
      z.object({
        familyRef: z.string(),
        probability: z.number(),
      }),
    )
    .optional(),
});

export const RadionuclideBarrierQuantificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  barrierRef: z.string().optional(),
  applicableSourceRefs: z.array(z.string()),
  failureModes: z.array(BarrierFailureModeQuantificationSchema),
  challengingPhenomena: z.array(z.string()),
  hazardSpecificMechanisms: z.array(z.string()).optional(),
  designSpecificDegradationMechanisms: z.array(z.string()).optional(),
  screenedOutMechanisms: z
    .array(
      z.object({
        mechanism: z.string(),
        criterion: z.enum(["SCR-2", "SCR-3"]),
        justification: z.string(),
      }),
    )
    .optional(),
  challengeAssessment: z.object({
    basis: z.enum(["CONSERVATIVE_GENERIC_ESTIMATE", "REALISTIC_PLANT_SPECIFIC_CALCULATION"]),
    challenges: z.array(z.string()),
    genericApplicabilityJustification: z.string().optional(),
  }),
  capacityEvaluation: z.object({
    basis: z.enum(["CONSERVATIVE", "REALISTIC"]),
    description: z.string(),
    inServiceAgingIncluded: z.boolean().optional(),
  }),
  externalHazardCapacity: z
    .array(
      z.object({
        hazard: z.string(),
        basis: z.enum(["ESTIMATED", "FRAGILITY_CURVES"]),
        fragilityReference: z.string().optional(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PhenomenaModelLogicSchema = z.object({
  logicIncluded: z.boolean(),
  description: z.string(),
  scrubbingEffectsIncluded: z.boolean().optional(),
  scrubbingJustification: z.string().optional(),
  beneficialFailuresIncluded: z.boolean().optional(),
  beneficialFailureJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PostReleaseHfeTreatmentSchema = z.object({
  uuid: z.string(),
  hfeRefs: z.array(z.string()),
  treatment: z.enum(["CONSERVATIVE", "DETAILED_RISK_SIGNIFICANT"]),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EquipmentSurvivabilityAssessmentSchema = z.object({
  uuid: z.string(),
  equipmentRefs: z.array(z.string()),
  environmentalConditions: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
    }),
  ),
  survivabilityCriteria: z.string(),
  assessmentResults: z.array(
    z.object({
      equipmentRef: z.string(),
      survives: z.boolean(),
      basis: z.string(),
    }),
  ),
  creditTaken: z.boolean(),
  creditJustification: z.string().optional(),
  engineeringAnalysisRefs: z.array(z.string()).optional(),
  requirementsSatisfied: z
    .object({
      syA29: z.boolean(),
      hrH2: z.boolean(),
      esqC2: z.boolean(),
      esqC4: z.boolean(),
    })
    .optional(),
  barrierFailureImpactJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DependencyTypeTreatmentSchema = z.object({
  type: DependencyTypeSchema,
  treatmentDescription: z.string(),
  modelingMethod: z.string(),
  examples: z.array(z.string()).optional(),
});

export const DependencyTreatmentSchema = z.object({
  dependenciesByType: z.array(DependencyTypeTreatmentSchema),
  postInitiatorHfeDependencyMethod: z.string(),
  postInitiatorHfeDependencyBasis: z.string(),
  ccfTreatment: z.object({
    modelingApproach: z.string(),
    parameterBasis: z.string(),
    ccfGroupRefs: z.array(z.string()),
  }),
  recoveryDependencyTreatment: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CutsetLogicReviewRecordSchema = z.object({
  uuid: z.string(),
  sampleDescription: z.string(),
  quantificationResultRef: z.number().optional(),
  logicCorrect: z.boolean(),
  findings: z.string(),
  correctiveActions: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ConsistencyReviewRecordSchema = z.object({
  uuid: z.string(),
  modelingConsistencyConfirmed: z.boolean(),
  modelingFindings: z.string().optional(),
  operationalConsistencyConfirmed: z.boolean(),
  operationalFindings: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RuleLogicReviewRecordSchema = z.object({
  uuid: z.string(),
  flagSettingsReviewed: z.boolean(),
  mutuallyExclusiveRulesReviewed: z.boolean(),
  recoveryRulesReviewed: z.boolean(),
  logicalResultsConfirmed: z.boolean(),
  findings: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SimilarPlantComparisonSchema = z.object({
  uuid: z.string(),
  comparisonPlants: z.array(z.string()),
  keyDifferences: z.array(z.string()),
  differenceCauses: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const NonSignificantSampleReviewSchema = z.object({
  uuid: z.string(),
  sampleDescription: z.string(),
  physicallyMeaningful: z.boolean(),
  findings: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskSignificantContributorSchema = z.object({
  uuid: z.string(),
  contributorType: RiskSignificantContributorTypeSchema,
  entityRef: z.string(),
  applicableFamilyRefs: z.array(z.string()),
  fractionalContribution: z.number().optional(),
  riskSignificanceCriteriaBasis: z.string(),
  reactorScope: z.enum(["SINGLE_REACTOR", "MULTI_REACTOR"]).optional(),
  contributionPhase: z.enum(["INITIATING_EVENT_OCCURRENCE", "MITIGATION_FAILURE"]).optional(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ImportanceMeasureEntrySchema = z.object({
  entityType: z.enum(["BASIC_EVENT", "INITIATING_EVENT", "HUMAN_FAILURE_EVENT", "CCF_GROUP", "SYSTEM", "COMPONENT"]),
  entityRef: z.string(),
  solverBasicEventId: z.number().optional(),
  systemRef: z.string().optional(),
  humanFailureEventRef: z.string().optional(),
  dataAnalysisParameterRef: z.string().optional(),
  fussellVesely: z.number().optional(),
  riskAchievementWorth: z.number().optional(),
  riskReductionWorth: z.number().optional(),
  birnbaum: z.number().optional(),
  criticality: z.number().optional(),
});

export const ImportanceAnalysisRecordSchema = z.object({
  uuid: z.string(),
  scope: z.enum(["OVERALL", "PER_FAMILY", "PER_SEQUENCE"]),
  familyRef: z.string().optional(),
  sequenceRef: z.string().optional(),
  measures: z.array(ImportanceMeasureEntrySchema),
  significanceCutoff: z.number().optional(),
  quantificationResultRef: z.number().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ImportanceReviewRecordSchema = z.object({
  uuid: z.string(),
  scope: z.string(),
  riCriteriaBasis: z.string(),
  consistentWithExpectations: z.boolean(),
  unexpectedResults: z
    .array(
      z.object({
        entityRef: z.string(),
        description: z.string(),
        reconciliation: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ScreenedEventCumulativeAssessmentSchema = z.object({
  screenedInitiatingEventRefs: z.array(z.string()),
  cumulativeImpactAssessment: z.string(),
  affectsRiskSignificantContributors: z.boolean(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModelUncertaintySourceAssessmentSchema = z.object({
  uuid: z.string(),
  sourceElementCode: z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ"]),
  uncertaintySource: z.string(),
  relatedAssumptions: z.array(z.string()),
  evaluationType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  evaluationScope: z.enum(["INDIVIDUAL", "COMBINATION"]),
  effectOnFamilyFrequencies: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const UncertaintyPropagationSchema = z.object({
  ...BaseUncertaintyAnalysisSchema.shape,
  characterizationLevel: z.enum(["CHARACTERIZED", "PROPAGATED_RISK_SIGNIFICANT_SOKC"]),
  parameterUncertainties: z.array(
    z.object({
      parameterRef: z.string(),
      distribution: ParameterDistributionSchema,
      basis: z.string(),
    }),
  ),
  stateOfKnowledgeCorrelation: z.object({
    isConsidered: z.boolean(),
    justificationIfNotConsidered: z.string().optional(),
    handlingMethod: z.enum(["SAME_RANDOM_SEED", "EXPLICIT_CORRELATION_MATRIX", "PARAMETER_GROUPING", "OTHER"]).optional(),
    handlingDescription: z.string().optional(),
    correlatedParameterGroups: z.array(z.array(z.string())).optional(),
    impactAssessment: z.string().optional(),
  }),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RiskIntegrationFeedbackSchema = z.object({
  analysisRef: z.string(),
  feedbackDate: z.string().optional(),
  sequenceFeedback: z
    .array(
      z.object({
        sequenceRef: z.string(),
        riskSignificance: ImportanceLevelSchema.optional(),
        insights: z.array(z.string()).optional(),
        recommendations: z.array(z.string()).optional(),
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

export const EsqDocumentationSchema = z.object({
  processDescription: z.string(),
  inputsDescription: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  nonRecoveryTermsProcess: z.string(),
  cutsetReviewProcess: z.string(),
  quantificationProcessDescription: z.string(),
  truncationConvergenceProcess: z.string(),
  familyFrequenciesAndContributions: z.string(),
  aggregationDisaggregationInsights: z.string(),
  sequenceBinningMethod: z.string(),
  intermediateStateDependencyTreatment: z.string(),
  nonSignificanceDrivingFactors: z.string(),
  releaseCategoryResolutionInputs: z.string(),
  barrierChallengeTreatment: z.string(),
  barrierCapacityBasis: z.string(),
  uncertaintySensitivityResults: z.string(),
  importanceResults: z.string(),
  mutuallyExclusiveEventsEliminated: z.string(),
  modelingAsymmetries: z.string(),
  codeVerificationProcess: z.string(),
  undocumentedParameterEstimatesBasis: z.string(),
  pdsPreservationApproach: z.string(),
  scopeAssumptionDrivenContributors: z.string(),
  similarPlantComparison: z.string(),
  riskSignificantContributorsDocumentation: z.string(),
  uncertaintySourcesDocumentation: z.string(),
  limitationsForApplications: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EventSequenceQuantificationSchema = z
  .object({
    ...technicalElementSchema(TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION).shape,
    praScope: z.string(),
    bayesianNetworks: z.array(EsqBayesianNetworkSchema).default([]),
    hclConfigurations: z.array(EsqHclConfigurationSchema).default([]),
    familyQuantifications: z.array(EventSequenceFamilyQuantificationSchema),
    sequenceFrequencyEstimates: z.array(SequenceFrequencyEstimateSchema).optional(),
    modelIntegration: ModelIntegrationSchema,
    quantificationMethods: QuantificationMethodsSchema,
    parameterConsistency: ParameterConsistencyAttestationSchema,
    phenomenaParameterBases: z.array(PhenomenaParameterBasisSchema).optional(),
    recoveryActionApplications: z.array(RecoveryActionApplicationSchema).optional(),
    circularLogicResolutions: z.array(CircularLogicResolutionSchema).optional(),
    systemSuccessTreatment: SystemSuccessTreatmentSchema,
    mutuallyExclusiveEventRules: z.array(MutuallyExclusiveEventRuleSchema).optional(),
    flagEventSettings: z.array(FlagEventSettingSchema).optional(),
    moduleUsageRecords: z.array(ModuleUsageRecordSchema).optional(),
    dependencyTreatment: DependencyTreatmentSchema,
    multiHfeCutsetIdentifications: z.array(MultiHfeCutsetIdentificationSchema).optional(),
    hfeDependencyApplications: z.array(HfeDependencyApplicationSchema).optional(),
    linkingTransferRecords: z.array(LinkingTransferRecordSchema).optional(),
    phenomenaDependencyAssessments: z.array(PhenomenaDependencyAssessmentSchema).optional(),
    barrierQuantifications: z.array(RadionuclideBarrierQuantificationSchema),
    phenomenaModelLogic: PhenomenaModelLogicSchema.optional(),
    postReleaseHfeTreatments: z.array(PostReleaseHfeTreatmentSchema).optional(),
    equipmentSurvivabilityAssessments: z.array(EquipmentSurvivabilityAssessmentSchema).optional(),
    cutsetLogicReviews: z.array(CutsetLogicReviewRecordSchema),
    consistencyReviews: z.array(ConsistencyReviewRecordSchema),
    ruleLogicReviews: z.array(RuleLogicReviewRecordSchema),
    similarPlantComparisons: z.array(SimilarPlantComparisonSchema).optional(),
    nonSignificantSampleReviews: z.array(NonSignificantSampleReviewSchema),
    riskSignificantContributors: z.array(RiskSignificantContributorSchema),
    importanceAnalyses: z.array(ImportanceAnalysisRecordSchema).optional(),
    importanceReviews: z.array(ImportanceReviewRecordSchema).optional(),
    screenedEventCumulativeAssessment: ScreenedEventCumulativeAssessmentSchema.optional(),
    modelUncertaintySourceAssessments: z.array(ModelUncertaintySourceAssessmentSchema).optional(),
    uncertaintyPropagation: UncertaintyPropagationSchema,
    sensitivityStudies: z.array(SensitivityStudySchema).optional(),
    quantificationRequestRefs: z.array(z.number()).optional(),
    quantificationResultRefs: z.array(z.number()).optional(),
    riskIntegrationFeedback: RiskIntegrationFeedbackSchema.optional(),
    modelUncertainty: BaseModelUncertaintyDocumentationSchema,
    preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
    documentation: EsqDocumentationSchema,
    configurationControlRecordId: z.string().optional(),
    exampleDocuments: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          kind: z.enum(["doc", "sheet", "image"]),
          sizeLabel: z.string(),
          uploadedLabel: z.string(),
          extracted: z.string(),
          linked: z.number(),
          url: z.string().optional(),
        }),
      )
      .optional(),
    newlyDevelopedMethodIds: z.array(z.string()).optional(),
  })
  .superRefine((mef, context) => {
    const seenModelIds = new Set<string>();

    for (const collection of ["bayesianNetworks", "hclConfigurations"] as const) {
      mef[collection].forEach((model, index) => {
        if (seenModelIds.has(model.modelId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [collection, index, "modelId"],
            message: "Model IDs must be unique across workbook-owned model collections",
          });
        }
        seenModelIds.add(model.modelId);
      });
    }
  });

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertEsqMirrorsType = Expect<Equal<z.infer<typeof EventSequenceQuantificationSchema>, EventSequenceQuantification>>;

import { z } from "zod";
import type { HumanReliabilityAnalysis } from "../../hr/human-reliability-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { SensitivityStudySchema, SuccessCriteriaIdSchema } from "../core/shared-patterns";
import {
  BaseModelUncertaintyDocumentationSchema,
  PlantRepresentationAccuracySchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const HfeTimingSchema = z.enum(["PRE_INITIATOR", "AT_INITIATOR", "POST_INITIATOR"]);
export const HfeImpactLevelSchema = z.enum(["FUNCTION", "SYSTEM", "TRAIN", "COMPONENT"]);
export const DependenceLevelSchema = z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]);

export const RoutineActivityIdentificationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  activityType: z.enum(["REALIGNMENT", "CALIBRATION"]),
  description: z.string(),
  identificationSources: z.array(z.enum(["PROCEDURES", "PLANT_PRACTICES", "INDUSTRY_EXPERIENCE", "DESIGN_ENGINEER_INTERVIEW"])),
  affectedSystems: z.array(z.string()),
  affectedComponents: z.array(z.string()).optional(),
  applicablePlantOperatingStates: z.array(z.string()),
  affectsMultipleTrainsOrDiverseSystems: z.boolean(),
  multiTrainMechanism: z.string().optional(),
  preOperationalIdentificationProcess: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PreInitiatorScreeningRecordSchema = z.object({
  uuid: z.string(),
  activityId: z.string(),
  screenedOut: z.boolean(),
  criterion: z.literal("SCR-3").optional(),
  justification: z.string(),
  applicableStatesVerified: z.boolean(),
  multiStateAdministrativeDetectionJustification: z.string().optional(),
  multiTrainProhibitionRespected: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SupportSystemInitiatorOperatorContributionSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  faultTreeReference: z.string().optional(),
  included: z.boolean(),
  exclusionBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CueTimingBySequenceSchema = z.object({
  eventSequenceId: z.string(),
  plantOperatingStateId: z.string().optional(),
  cueTimeMinutes: z.number().optional(),
  timeWindowMinutes: z.number().optional(),
  basis: z.string().optional(),
});

export const HumanFailureEventSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hfeTiming: HfeTimingSchema,
  description: z.string(),
  impactLevel: HfeImpactLevelSchema,
  affectedSystems: z.array(z.string()),
  affectedComponents: z.array(z.string()).optional(),
  applicablePlantOperatingStates: z.array(z.string()),
  applicableInitiatingEvents: z.array(z.string()).optional(),
  applicableEventSequences: z.array(z.string()).optional(),
  preInitiatorDetail: z
    .object({
      sourceActivityId: z.string(),
      averageTimeToDetectionHours: z.number().optional(),
      detectionBasis: z.string(),
      unavailabilityModes: z.array(z.string()),
      miscalibrationImpactIncluded: z.boolean(),
    })
    .optional(),
  responseDetail: z
    .object({
      requiredResponse: z.string(),
      responseType: z.enum(["INITIATE", "OPERATE", "CONTROL", "ISOLATE", "TERMINATE", "AGGRAVATING_ACTION"]),
      successCriteriaIds: z.array(SuccessCriteriaIdSchema),
      procedureReferences: z.array(z.string()),
      cueDescription: z.string(),
      cueTimingBySequence: z.array(CueTimingBySequenceSchema).optional(),
    })
    .optional(),
  groupedResponses: z.array(z.string()).optional(),
  groupingJustification: z.string().optional(),
  crossPosGroupingBasis: z.enum(["BOUNDED", "EQUIVALENT_BOUNDARY_CONDITIONS"]).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ResponseIdentificationReviewSchema = z.object({
  uuid: z.string(),
  reviewScope: z.enum([
    "EMERGENCY_AND_ABNORMAL_PROCEDURES",
    "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH",
    "OPERATIONAL_EVENTS",
    "TRAINING_MATERIALS",
    "SIMILAR_FACILITY_EXPERIENCE",
    "NONNUCLEAR_FACILITY_EXPERIENCE",
  ]),
  sourcesReviewed: z.array(z.string()),
  date: z.string().optional(),
  findings: z.string(),
  identifiedHfeIds: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HumanResponseConfirmationSchema = z.object({
  uuid: z.string(),
  hfeIds: z.array(z.string()),
  method: z.enum(["PERSONNEL_REVIEW", "TALK_THROUGH", "SIMULATION_OBSERVATION"]),
  personnelRoles: z.array(z.string()),
  date: z.string(),
  findings: z.string(),
  interpretationConsistent: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PerformanceShapingFactorAssessmentSchema = z.object({
  factor: z.string(),
  evaluation: z.string(),
  impactOnHep: z.enum(["INCREASE", "DECREASE", "NEUTRAL"]),
});

export const HepQuantificationSchema = z.object({
  uuid: z.string(),
  hfeId: z.string(),
  methodology: z.string(),
  assessmentType: z.enum(["CONSERVATIVE_ESTIMATE", "DETAILED_ASSESSMENT"]),
  isRiskSignificant: z.boolean(),
  pointEstimateHep: z.number().optional(),
  meanHep: z.number().optional(),
  cognitionContribution: z.number().optional(),
  executionContribution: z.number().optional(),
  performanceShapingFactors: z.array(PerformanceShapingFactorAssessmentSchema).optional(),
  indicationsTreatment: z.enum(["ASSUMED_AVAILABLE", "EVALUATED_PER_SEQUENCE"]).optional(),
  timeAvailableMinutes: z.number().optional(),
  timeAvailableBasis: z.enum(["GENERIC_STUDY", "REALISTIC_PLANT_SPECIFIC_ANALYSIS"]).optional(),
  cueArrivalTimeMinutes: z.number().optional(),
  timeRequiredMinutes: z.number().optional(),
  timeRequiredBasis: z.enum(["ESTIMATED", "MEASURED_TALK_THROUGH", "MEASURED_SIMULATOR"]).optional(),
  plantSpecificInformationUsed: z.array(z.string()).optional(),
  uncertaintyCharacterization: z
    .object({
      riskSignificant: z.boolean(),
      method: z.string(),
      probabilisticRepresentationProvided: z.boolean(),
    })
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PreInitiatorRecoveryCreditSchema = z.object({
  uuid: z.string(),
  hfeId: z.string(),
  recoveryFactorsMethodologyConsistent: z.boolean(),
  maximumCreditSpecified: z.number(),
  creditBases: z
    .array(z.enum(["POST_MAINTENANCE_TEST", "INDEPENDENT_VERIFICATION", "WORK_SUPERVISION_CHECK", "OPERATOR_ROUNDS"]))
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const JointHepFloorSchema = z.object({
  uuid: z.string(),
  minimumJointProbability: z.number(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HfeDependencyAssessmentSchema = z.object({
  uuid: z.string(),
  scope: z.enum(["PRE_INITIATOR_SET", "WITHIN_SEQUENCE"]),
  hfeIds: z.array(z.string()),
  plantOperatingStateId: z.string().optional(),
  eventSequenceId: z.string().optional(),
  commonElements: z.array(z.string()),
  dependenceLevel: DependenceLevelSchema,
  jointHep: z.number(),
  belowFloor: z.boolean().optional(),
  floorAppliedOrJustification: z.string().optional(),
  includesRecoveryHfe: z.boolean().optional(),
  includesInitiatorCausingHfe: z.boolean().optional(),
  prePostDependenceFactorsIdentified: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HepConsistencyReviewSchema = z.object({
  uuid: z.string(),
  hfeIdsReviewed: z.array(z.string()),
  relativeReasonablenessConfirmed: z.boolean(),
  basis: z.enum(["PLANT_HISTORY_PROCEDURES_OPERATIONS", "SIMILAR_PLANT_AND_SCENARIO_CONTEXT"]),
  findings: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RecoveryActionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  hfeId: z.string(),
  appliedAtLevel: z.enum(["CUTSET", "SCENARIO", "SEQUENCE"]),
  restoredFunction: z.string(),
  appliedToSequenceIds: z.array(z.string()).optional(),
  feasibility: z.object({
    procedureOrGuidanceAvailable: z.boolean(),
    trainingIncluded: z.boolean(),
    omissionJustification: z.string().optional(),
    cuesAvailable: z.boolean(),
    manpowerAvailable: z.boolean(),
    timeAvailable: z.boolean(),
    accessibilityConfirmed: z.boolean(),
    equipmentAvailable: z.boolean(),
  }),
  preOperationalFeasibilityJustification: z.string().optional(),
  hepQuantificationId: z.string(),
  dependencyAssessmentId: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ErrorForcingContextSchema = z.object({
  uuid: z.string(),
  hfeId: z.string(),
  unsafeAction: z.string(),
  plantConditions: z.array(z.string()),
  performanceShapingFactors: z.array(z.string()),
  vulnerability: z.string(),
  searchMethod: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HrDocumentationSchema = z.object({
  processDescription: z.string(),
  preInitiatorIdentificationProcess: z.string(),
  screeningCriteriaAndResults: z.string(),
  hfeDefinitions: z.string(),
  responseIdentificationReviews: z.string(),
  confirmationActivities: z.string(),
  hepMethodologies: z.string(),
  performanceShapingFactorTreatment: z.string(),
  timingAnalysisBases: z.string(),
  dependenceTreatmentAndJointFloor: z.string(),
  recoveryActionFeasibilityAndCredit: z.string(),
  consistencyReviewResults: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HumanReliabilityAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS).shape,
  praScope: z.string(),
  routineActivities: z.array(RoutineActivityIdentificationSchema),
  preInitiatorScreeningRecords: z.array(PreInitiatorScreeningRecordSchema),
  supportSystemInitiatorOperatorContributions: z.array(SupportSystemInitiatorOperatorContributionSchema).optional(),
  humanFailureEvents: z.array(HumanFailureEventSchema),
  responseIdentificationReviews: z.array(ResponseIdentificationReviewSchema),
  responseConfirmations: z.array(HumanResponseConfirmationSchema).optional(),
  hepQuantifications: z.array(HepQuantificationSchema),
  preInitiatorRecoveryCredits: z.array(PreInitiatorRecoveryCreditSchema).optional(),
  jointHepFloor: JointHepFloorSchema,
  dependencyAssessments: z.array(HfeDependencyAssessmentSchema),
  hepConsistencyReviews: z.array(HepConsistencyReviewSchema).optional(),
  errorForcingContexts: z.array(ErrorForcingContextSchema).optional(),
  recoveryActions: z.array(RecoveryActionSchema).optional(),
  plantRepresentationAccuracy: PlantRepresentationAccuracySchema,
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  documentation: HrDocumentationSchema,
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
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertHrMirrorsType = Expect<Equal<z.infer<typeof HumanReliabilityAnalysisSchema>, HumanReliabilityAnalysis>>;

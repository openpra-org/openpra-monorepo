import { z } from "zod";
import {
  BarrierStatus,
  EvolutionType,
  OperatingMode,
  SafetyFunctionCategory,
  SourceLocation,
} from "../../pos/plant-operating-state-analysis";
import type { PlantOperatingStatesAnalysis } from "../../pos/plant-operating-state-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import {
  FrequencySchema,
  FrequencyWithDistributionSchema,
  InitiatingEventSchema,
} from "../core/events";
import {
  ImportanceLevelSchema,
  ScreeningStatusSchema,
  SensitivityStudySchema,
  SuccessCriteriaIdSchema,
} from "../core/shared-patterns";
import { ComponentReferenceSchema } from "../core/component";
import {
  BaseModelUncertaintyDocumentationSchema,
  PlantRepresentationAccuracySchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const ScreeningCriterionSchema = z.enum(["SCR-1", "SCR-2", "SCR-3", "ALTERNATE"]);
export const SystemStatusSchema = z.enum(["YES", "NO", "STANDBY", "OOS"]);

export const OperatingModeSchema = z.enum(OperatingMode);
export const EvolutionTypeSchema = z.enum(EvolutionType);
export const BarrierStatusSchema = z.enum(BarrierStatus);
export const SourceLocationSchema = z.enum(SourceLocation);
export const SafetyFunctionCategorySchema = z.enum(SafetyFunctionCategory);

const FrequencyValueSchema = z.union([FrequencySchema, FrequencyWithDistributionSchema]);

export const ParameterRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  representative: z.number(),
  units: z.string().optional(),
});

export const InterviewRecordSchema = z.object({
  // additional-to-example
  uuid: z.string().optional(),
  evolutionId: z.string().optional(),
  posId: z.string().optional(),
  date: z.string(),
  personnelRoles: z.array(z.string()),
  method: z.enum(["TABLETOP", "WALKDOWN", "COMPUTERIZED_WALKDOWN", "INTERVIEW"]),
  findings: z.string(),
  overlookedEvolutionsIdentified: z.array(z.string()),
});

export const TransitionParameterSchema = z.object({
  parameter: z.string(),
  threshold: z.union([z.string(), z.number()]),
  units: z.string().optional(),
  monitored: z.boolean(),
  monitoringInstruments: z.array(z.string()).optional(),
});

export const TimeBoundarySchema = z.object({
  startingCondition: z.string(),
  endingCondition: z.string(),
  transitionParameters: z.array(TransitionParameterSchema),
});

export const InstrumentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parameter: z.string(),
  location: z.string(),
  range: z.tuple([z.number(), z.number()]).optional(),
  units: z.string().optional(),
  availability: z.boolean(),
  safetyRelated: z.boolean(),
});

export const RadioactiveSourceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  location: SourceLocationSchema,
  radionuclides: z.array(z.string()),
  status: z.string(),
  releasePaths: z.array(z.string()),
  barriers: z.array(z.string()),
  screeningStatus: ScreeningStatusSchema,
  exclusionJustification: z.string().optional(),
});

export const RadionuclideTransportBarrierSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: BarrierStatusSchema.optional(),
  monitoringParameters: z.array(z.string()),
  breachCriteria: z.array(z.string()),
});

export const ReactorCoolantSystemParametersSchema = z.object({
  powerLevel: ParameterRangeSchema,
  decayHeatLevel: ParameterRangeSchema,
  reactorCoolantTemperature: ParameterRangeSchema,
  coolantPressure: ParameterRangeSchema,
  reactorLevel: ParameterRangeSchema.optional(),
  coolantInventory: ParameterRangeSchema.optional(),
  timeAfterShutdownHours: z.number().optional(),
  rcsConfigurationDescription: z.string(),
  otherParameters: z.record(z.string(), ParameterRangeSchema).optional(),
});

export const DecayHeatRemovalConfigurationSchema = z.object({
  primaryCoolingSystems: z.record(z.string(), SystemStatusSchema),
  secondaryCoolingSystems: z.record(z.string(), SystemStatusSchema),
  passiveMechanisms: z.record(z.string(), SystemStatusSchema),
});

export const SafetyFunctionImplementationSchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.string(),
  type: z.enum(["ACTIVE", "PASSIVE"]),
  reliability: z
    .object({
      mtbf: z.number().optional(),
      pfd: z.number().optional(),
    })
    .optional(),
});

export const SafetyFunctionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  category: SafetyFunctionCategorySchema,
  state: z.enum(["SUCCESS", "FAILURE", "STANDBY"]),
  successCriterion: z.string(),
  failureCriterion: z.string(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
  implementationMechanisms: z.array(SafetyFunctionImplementationSchema),
  supportingSscs: z.array(ComponentReferenceSchema),
  applicableInitiatingEvents: z.array(z.string()),
});

export const SscOperationalCharacteristicSchema = z.object({
  ssc: ComponentReferenceSchema,
  desiredState: z.string(),
  supportedSafetyFunction: SafetyFunctionCategorySchema,
});

export const TimeVaryingConditionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  timeHours: z.number(),
  parameter: z.string(),
  value: z.number(),
  units: z.string().optional(),
  uncertainty: z.number().optional(),
  impactOnSafetyFunctions: z.string(),
  requiresMonitoring: z.boolean(),
});

export const HazardGroupReviewSchema = z.object({
  hazardGroup: z.string(),
  hazardBarrierEffectivenessChanges: z.array(z.string()),
  propagationPathwayModifications: z.array(z.string()),
  sscFragilityModifications: z.array(z.string()),
  conditionsRemainSufficient: z.boolean(),
  basis: z.string(),
});

export const OperatingStateRiskSignificanceSchema = z.object({
  posId: z.string(),
  riskContributionFraction: z.number(),
  cdf: FrequencyValueSchema,
  lerf: FrequencyValueSchema.optional(),
  riskSignificantContributors: z.array(z.string()),
  importanceMeasures: z
    .array(
      z.object({
        component: ComponentReferenceSchema,
        fussellVesely: z.number().optional(),
        raw: z.number().optional(),
        rrw: z.number().optional(),
      }),
    )
    .optional(),
});

export const PlantOperatingStateSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  evolutionId: z.string(),
  operatingMode: OperatingModeSchema,
  radioactiveMaterialSources: z.array(RadioactiveSourceSchema),
  rcbConfiguration: z.string(),
  rcsParameters: ReactorCoolantSystemParametersSchema,
  availableInstrumentation: z.array(InstrumentSchema),
  activitiesLeadingToParameterChanges: z.array(z.string()),
  radionuclideTransportBarriers: z.array(RadionuclideTransportBarrierSchema),
  timeBoundary: TimeBoundarySchema,
  decayHeatRemoval: DecayHeatRemovalConfigurationSchema,
  sscOperationalCharacteristics: z.array(SscOperationalCharacteristicSchema),
  safetyFunctions: z.array(SafetyFunctionSchema),
  applicableInitiatingEvents: z.array(InitiatingEventSchema),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
  meanDurationHours: z.number(),
  meanTimeAfterShutdownHours: z.number().optional(),
  durationAndCycleTimingBasis: z.string().optional(),
  meanEntryFrequency: FrequencyValueSchema,
  decayHeatLevelDefined: z.boolean(),
  decayHeatBasis: z.string().optional(),
  timeVaryingConditions: z.array(TimeVaryingConditionSchema).optional(),
  hazardGroupReviews: z.array(HazardGroupReviewSchema).optional(),
  riskSignificance: OperatingStateRiskSignificanceSchema.optional(),
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
  // additional-to-example
  uiStatus: z.enum(["ok", "warn", "draft"]).optional(),
  // additional-to-example
  uiStatusMessage: z.string().optional(),
  // additional-to-example
  docsLinked: z.number().optional(),
});

export const PlantEvolutionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  type: EvolutionTypeSchema,
  operatingModes: z.array(z.string()),
  reviewedDocumentation: z.object({
    operatingModes: z.array(z.string()),
    rcbConfigurations: z.array(z.string()),
    rcsParameterRanges: z.array(z.string()),
    decayHeatRemovalMechanisms: z.array(z.string()),
    availableInstrumentation: z.array(z.string()),
    activitiesLeadingToChanges: z.array(z.string()),
    radionuclideTransportBarrierStatus: z.array(z.string()),
    sscCapabilityChanges: z.array(z.string()),
    operationalAssumptions: z.array(z.string()),
  }),
  plantOperatingStateIds: z.array(z.string()),
  futureEvolutionReview: z
    .object({
      higherRiskStatesNotPreviouslyEncountered: z.array(z.string()),
      earlierOrLaterEntryDecayHeatImpacts: z.array(z.string()),
      durationChanges: z.array(z.string()),
    })
    .optional(),
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
  // additional-to-example
  sourceDocumentRef: z.string().optional(),
});

export const PosEvidenceTypeSchema = z.enum([
  "DESIGN_BASIS",
  "PROCESS_DRAWING",
  "ELECTRICAL_I_AND_C",
  "OPERATING_PROCEDURE",
  "WORK_CONTROL",
  "ENGINEERING_CALCULATION",
  "HAZARD_BARRIER",
  "HUMAN_FACTORS",
  "OPERATING_EXPERIENCE",
  "CONFIGURATION_CONTROL",
  "INTERVIEW_WALKDOWN",
]);

export const PosEvidenceStatusSchema = z.enum(["PRELIMINARY", "APPROVED", "AS_BUILT", "AS_OPERATED", "SUPERSEDED"]);

export const PosEvidenceRecordSchema = z.object({
  uuid: z.string(),
  identifier: z.string(),
  title: z.string(),
  revision: z.string(),
  effectiveDate: z.string(),
  evidenceType: PosEvidenceTypeSchema,
  lifecycleStatus: PosEvidenceStatusSchema,
  citation: z.string(),
  extractedFact: z.string(),
  affectedEvolutionIds: z.array(z.string()),
  affectedPosIds: z.array(z.string()),
  limitation: z.string().optional(),
  reviewer: z.string().optional(),
});

export const EvolutionSearchMethodSchema = z.enum([
  "MODE_LIFECYCLE",
  "PROCEDURE_ACTIVITY",
  "SYSTEM_SAFETY_FUNCTION",
  "SOURCE_BARRIER",
  "EXPERIENCE_PERSONNEL",
]);

export const EvolutionSearchRecordSchema = z.object({
  uuid: z.string(),
  method: EvolutionSearchMethodSchema,
  evidenceIds: z.array(z.string()),
  identifiedEvolutionIds: z.array(z.string()),
  complete: z.boolean(),
  basis: z.string(),
});

export const PosBoundaryDimensionSchema = z.enum([
  "RADIOACTIVE_SOURCE",
  "CRITICALITY_POWER",
  "TIME_AFTER_SHUTDOWN",
  "COOLANT_CONDITION",
  "PROCESS_BOUNDARY",
  "DECAY_HEAT_REMOVAL",
  "INSTRUMENTATION",
  "AUTOMATION",
  "SSC_ALIGNMENT",
  "SUPPORT_SYSTEMS",
  "RADIONUCLIDE_BARRIER",
  "HAZARD_BARRIER",
  "HUMAN_ACTIVITY",
  "HUMAN_CONTEXT",
]);

export const PosBoundaryDispositionSchema = z.enum(["UNRESOLVED", "RETAIN", "COMBINE"]);

export const PosCandidateBoundarySchema = z.object({
  uuid: z.string(),
  evolutionId: z.string(),
  sequence: z.number(),
  label: z.string(),
  activity: z.string(),
  entryCondition: z.string(),
  changedDimensions: z.array(PosBoundaryDimensionSchema),
  evidenceIds: z.array(z.string()),
  stateBeforeId: z.string().optional(),
  stateAfterId: z.string().optional(),
  disposition: PosBoundaryDispositionSchema,
  basis: z.string(),
});

export const PosImpactResultSchema = z.enum(["CHANGED", "UNCHANGED", "UNRESOLVED"]);
export const PosBoundaryInterfaceCodeSchema = z.enum([
  "IE",
  "ES",
  "SC",
  "SY",
  "HR",
  "DA",
  "FL",
  "F",
  "S",
  "HS",
  "W",
  "XF",
  "O",
  "ESQ",
  "MS",
  "RC",
  "RI",
]);

export const PosBoundaryInterfaceReviewSchema = z.object({
  uuid: z.string(),
  technicalElementCode: PosBoundaryInterfaceCodeSchema,
  result: PosImpactResultSchema,
  affectedArtifact: z.string(),
  responsibleAnalyst: z.string(),
  reviewStatus: z.enum(["NOT_REVIEWED", "PENDING", "CONFIRMED"]),
  technicalBasis: z.string(),
});

export const PosBoundaryImpactAssessmentSchema = z.object({
  boundaryId: z.string(),
  interfaceReviews: z.array(PosBoundaryInterfaceReviewSchema),
  exposureTreatment: z.enum(["UNRESOLVED", "TIME_BASED", "DEMAND_BASED", "BOTH", "NOT_APPLICABLE"]),
  exposureResult: PosImpactResultSchema,
  exposureBasis: z.string(),
  riskSignificanceCheck: z.enum(["UNRESOLVED", "PRESERVED", "COULD_MASK"]),
  riskSignificanceBasis: z.string(),
  conclusion: PosBoundaryDispositionSchema,
  basis: z.string(),
  reviewer: z.string().optional(),
});

export const PosBaselineReviewSchema = z.object({
  revision: z.string(),
  status: z.enum(["DRAFT", "READY", "BASELINED"]),
  reviewer: z.string(),
  reviewDate: z.string(),
  evolutionTraceable: z.boolean(),
  boundaryTraceable: z.boolean(),
  groupingTraceable: z.boolean(),
  quantificationTraceable: z.boolean(),
  interfacesTraceable: z.boolean(),
  openAssumptions: z.number(),
  changeSummary: z.string(),
});

export const EvolutionGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  memberEvolutionIds: z.array(z.string()),
  similarityBasis: z.string(),
  boundedByWorstCaseImpact: z.string(),
  groupingDoesNotImpactRiskSignificantSequences: z.boolean(),
  comparableImpactAcrossMembers: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantOperatingStateGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  evolutionType: EvolutionTypeSchema,
  memberPosIds: z.array(z.string()),
  similarityBasis: z.string(),
  boundingCharacteristics: z.array(z.string()),
  doesNotMaskRiskSignificantContributors: z.boolean(),
  summedDurationHours: z.number(),
  entryFrequency: FrequencyValueSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PosScreeningRecordSchema = z.object({
  posId: z.string(),
  retained: z.boolean(),
  criterion: ScreeningCriterionSchema.optional(),
  quantitativeBasis: z.number().optional(),
  justification: z.string(),
  alternateCriterionJustification: z.string().optional(),
  riskSignificance: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PosSeparationRecordSchema = z.object({
  separatedPosIds: z.array(z.string()),
  differingResponseBasis: z.string(),
  differentSuccessCriteria: z.boolean(),
  differentBarrierConfiguration: z.boolean(),
  moreSevereReleasePotential: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DemandTimeBasedRecordSchema = z.object({
  posId: z.string(),
  initiatorBasis: z.enum(["DEMAND_BASED", "TIME_BASED"]),
  delineatedToAvoidAveraging: z.boolean(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SubsumedPosRecordSchema = z.object({
  subsumedPosId: z.string(),
  subsumingPosId: z.string(),
  criterion: ScreeningCriterionSchema,
  justification: z.string(),
  riskImpact: ImportanceLevelSchema,
  limitations: z.array(z.string()),
  validationMethod: z.string(),
  sensitivityAnalysis: SensitivityStudySchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DecayHeatCharacterizationSchema = z.object({
  posId: z.string(),
  decayHeatLevel: ParameterRangeSchema,
  timeAfterShutdownHours: z.number(),
  basis: z.string(),
  isLpsd: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MutualExclusivityValidationSchema = z.object({
  delineationParameters: z.array(z.string()),
  verificationMethod: z.string(),
  allConditionsBelongToExactlyOnePos: z.boolean(),
});

export const CollectiveExhaustivityValidationSchema = z.object({
  verificationMethod: z.string(),
  totalCycleHours: z.number(),
  summedPosHours: z.number(),
  coverageFraction: z.number(),
  allConfigurationsCovered: z.boolean(),
});

export const TransitionValidationSchema = z.object({
  transitionMatrix: z.record(z.string(), z.array(z.string())),
  transitionTriggers: z.record(z.string(), z.string()),
});

export const PosValidationRulesSchema = z.object({
  mutualExclusivity: MutualExclusivityValidationSchema,
  collectiveExhaustivity: CollectiveExhaustivityValidationSchema,
  transitions: TransitionValidationSchema,
  implementsSrs: z.array(SRReferenceSchema),
});

export const TransitionEventSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  fromPosId: z.string(),
  toPosId: z.string(),
  trigger: z.string(),
  frequency: FrequencyValueSchema,
  durationHours: z.number().optional(),
  transitionParameters: z.array(TransitionParameterSchema),
  risks: z.array(z.string()),
  riskSignificance: ImportanceLevelSchema.optional(),
  requiredHumanActions: z.array(z.string()),
  requiredEquipment: z.array(z.string()),
  procedureIds: z.array(z.string()),
});

export const PosDocumentationSchema = z.object({
  processDescription: z.string(),
  evolutionSelectionAndDefinitions: z.string(),
  posIdentificationProcessAndCriteria: z.string(),
  posGroupingProcessAndCriteria: z.string(),
  posGroupDefinitions: z.string(),
  posCharacteristics: z.string(),
  durationsTimesSinceShutdownFrequencies: z.string(),
  decayHeatPerPos: z.string(),
  praTaskInterfaces: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PlantOperatingStatesAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS).shape,
  praScope: z.string(),
  includesNonInternalHazardGroups: z.boolean(),
  includesAtPowerOperations: z.boolean(),
  // Additional
  includesLPSDOperations: z.boolean().optional(),
  plantEvolutions: z.array(PlantEvolutionSchema),
  plantOperatingStates: z.array(PlantOperatingStateSchema),
  evidenceRegister: z.array(PosEvidenceRecordSchema).optional(),
  evolutionSearchRecords: z.array(EvolutionSearchRecordSchema).optional(),
  candidateBoundaries: z.array(PosCandidateBoundarySchema).optional(),
  boundaryImpactAssessments: z.array(PosBoundaryImpactAssessmentSchema).optional(),
  baselineReview: PosBaselineReviewSchema.optional(),
  evolutionGroups: z.array(EvolutionGroupSchema).optional(),
  plantOperatingStateGroups: z.array(PlantOperatingStateGroupSchema).optional(),
  screeningRecords: z.array(PosScreeningRecordSchema),
  separationRecords: z.array(PosSeparationRecordSchema),
  demandTimeBasedRecords: z.array(DemandTimeBasedRecordSchema).optional(),
  subsumedPosRecords: z.array(SubsumedPosRecordSchema).optional(),
  decayHeatCharacterizations: z.array(DecayHeatCharacterizationSchema),
  hazardGroupReviews: z.array(HazardGroupReviewSchema).optional(),
  interviewRecords: z.array(InterviewRecordSchema).optional(),
  plantRepresentationAccuracy: PlantRepresentationAccuracySchema,
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  transitionEvents: z.array(TransitionEventSchema),
  timeVaryingConditions: z.array(TimeVaryingConditionSchema).optional(),
  validationRules: PosValidationRulesSchema,
  documentation: PosDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
  // additional-to-example
  decayHeatOperatingDays: z.number().optional(),
  decayHeatCurve: z
    .object({
      name: z.string(),
      points: z.array(z.object({ hours: z.number(), fractionOfPower: z.number() })),
    })
    .optional(),
  // additional-to-example
  exampleDocuments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["doc", "sheet", "image"]),
    sizeLabel: z.string(),
    uploadedLabel: z.string(),
    extracted: z.string(),
    linked: z.number(),
    url: z.string().optional(),
    citation: z.string().optional(),
  })).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertPosMirrorsType = Expect<Equal<z.infer<typeof PlantOperatingStatesAnalysisSchema>, PlantOperatingStatesAnalysis>>;

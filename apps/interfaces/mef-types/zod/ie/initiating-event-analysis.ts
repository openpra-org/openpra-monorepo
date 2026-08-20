import { z } from "zod";
import {
  BarrierImpactState,
  InitiatingEventCategory,
  ModuleImpactState,
} from "../../ie/initiating-event-analysis";
import type { InitiatingEventsAnalysis } from "../../ie/initiating-event-analysis";
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
import {
  BaseModelUncertaintyDocumentationSchema,
  PlantRepresentationAccuracySchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";
import {
  MasterLogicDiagramSchema,
  HeatBalanceFaultTreeSchema,
  FailureModesEffectAnalysisSchema,
  HazardOperabilityStudySchema,
  ProcessHazardAnalysisSchema,
  OperatingExperienceReviewSchema,
  GenericInitiatorCatalogueSchema,
} from "../cross-cutting/methods/methods";

export const InitiatingEventCategorySchema = z.enum(InitiatingEventCategory);
export const ModuleImpactStateSchema = z.enum(ModuleImpactState);
export const BarrierImpactStateSchema = z.enum(BarrierImpactState);

export const IeScreeningCriterionSchema = z.enum(["SCR-1", "SCR-2", "SCR-3"]);
export const QuantificationBasisSchema = z.enum([
  "OPERATING_DATA",
  "GENERIC_DATA",
  "SIMILAR_PLANT_DATA",
  "DESIGN_BASED",
  "FAULT_TREE",
]);
export const HazardTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);

const FrequencyValueSchema = z.union([FrequencySchema, FrequencyWithDistributionSchema]);

export const TripParameterSchema = z.object({
  parameter: z.string(),
  setpoint: z.number(),
  uncertainty: z.number(),
  basis: z.string(),
});

export const MitigatingSystemDemandSchema = z.object({
  systemId: z.string(),
  function: z.string(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
  dependencies: z.array(z.string()),
});

export const BarrierImpactSchema = z.object({
  barrierId: z.string(),
  state: BarrierImpactStateSchema,
  timing: z.string(),
  mechanism: z.string(),
});

export const ModuleImpactSchema = z.object({
  moduleId: z.string(),
  state: ModuleImpactStateSchema,
  propagationPath: z.string().optional(),
  timing: z.string().optional(),
});

export const SourceEscapeMechanismSchema = z.object({
  sourceId: z.string(),
  mechanisms: z.array(z.string()),
  hazardGroupsConsidered: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IdentificationReviewSchema = z.object({
  reviewType: z.enum(["INTERVIEW", "EVALUATION"]),
  date: z.string(),
  personnelRoles: z.array(z.string()),
  findings: z.string(),
  overlookedInitiatorsIdentified: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InterfacingSystemBreachFeaturesSchema = z.object({
  pathwayConfiguration: z.string(),
  valveTypesAndFailureModes: z.array(z.string()),
  reliefValveProvisions: z.string(),
  otherComponentBehavior: z.array(z.string()).optional(),
  protectiveInterlocks: z.array(z.string()),
  testAndMaintenancePractices: z.array(z.string()).optional(),
  detectionMeans: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InitiatorDefinitionSchema = z.object({
  ...InitiatingEventSchema.shape,
  category: InitiatingEventCategorySchema,
  subcategory: z.string().optional(),
  applicableStates: z.array(z.string()),
  groupId: z.string().optional(),

  identificationMethodIds: z.array(z.string()),
  identificationBasis: z.array(z.string()),

  tripParameters: z.array(TripParameterSchema),
  mitigatingSystems: z.array(MitigatingSystemDemandSchema),
  barrierImpacts: z.array(BarrierImpactSchema),
  moduleImpacts: z.array(ModuleImpactSchema).optional(),
  interfacingSystemFeatures: InterfacingSystemBreachFeaturesSchema.optional(),

  challengedSafetyFunctions: z.array(z.string()),

  plantExperience: z.array(z.string()).optional(),
  genericAnalysisReview: z.string().optional(),
  similarPlantReview: z.string().optional(),

  screeningStatus: ScreeningStatusSchema,
  screeningCriterion: IeScreeningCriterionSchema.optional(),
  screeningBasis: z.string().optional(),
  barrierIntegrityScreeningSatisfied: z.boolean().optional(),

  importanceLevel: ImportanceLevelSchema.optional(),
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),

  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardInducedInitiatorSchema = z.object({
  ...InitiatorDefinitionSchema.shape,
  hazardType: z.string(),
  hazardSeverity: z.string(),
  combinedHazards: z.array(z.string()).optional(),
  affectedAreas: z.array(z.string()),
  hazardFrequencyFactors: z.object({
    returnPeriod: z.number().optional(),
    exceedanceProbability: z.number().optional(),
    fragilityParameters: z.record(z.string(), z.number()).optional(),
  }),
});

export const InitiatingEventGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  memberInitiatorIds: z.array(z.string()),
  groupingBasis: z.string(),
  boundingInitiatorId: z.string(),
  similarMitigationRequirements: z.array(z.string()),
  groupingDoesNotMaskRiskSignificantSequences: z.boolean(),
  comparableImpactAcrossMembers: z.boolean(),
  challengedSafetyFunctions: z.array(z.string()),
  applicableStates: z.array(z.string()),
  affectedReactorOrSourceCombinations: z.array(z.string()).optional(),
  meanFrequency: FrequencyValueSchema.optional(),
  riskImportance: ImportanceLevelSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FrequencyFaultTreeNodeSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  label: z.string(),
  nodeType: z.enum(["GATE", "BASIC", "HOUSE", "TRANSFER", "UNDEVELOPED"]),
  gate: z.enum(["AND", "OR", "NOT", "ATLEAST"]).optional(),
  k: z.number().optional(),
  detail: z.string().optional(),
});

export const FrequencyDataSourceSchema = z.object({
  uuid: z.string(),
  label: z.string(),
  basis: QuantificationBasisSchema,
  pedigree: z.enum(["TECHNOLOGY_SPECIFIC", "TECHNOLOGY_INDEPENDENT", "OTHER_INDUSTRY", "TEST_DATA"]).optional(),
  perModule: z.boolean(),
  sourceReference: z.string(),
  eventCount: z.number().optional(),
  exposureModuleYears: z.number().optional(),
  priorMean: z.number().optional(),
  priorWeightPseudoEvents: z.number().optional(),
  distributionFamily: z.enum(["POINT", "GAMMA", "LOGNORMAL", "BETA"]).optional(),
  distributionParameters: z.array(z.number()).optional(),
  faultTreeTopMean: z.number().optional(),
  faultTree: z.array(FrequencyFaultTreeNodeSchema).optional(),
});

export const InitiatingEventFrequencyQuantificationSchema = z.object({
  initiatorOrGroupId: z.string(),
  meanFrequency: FrequencyValueSchema,
  basis: QuantificationBasisSchema,
  plantCalendarYearBasis: z.boolean(),
  posTimeFractionApplied: z.boolean(),
  dataSourceJustification: z.string(),
  dataExclusionJustification: z.string().optional(),
  otherReactorDataJustification: z.string().optional(),
  recoveryActionsIncluded: z.boolean(),
  recoveryActionJustifications: z.array(z.string()).optional(),
  plantSpecificRecoveryInfoUsed: z.boolean().optional(),
  faultTreeDetails: z
    .object({
      modelId: z.string(),
      topEvent: z.string(),
      modifications: z.array(z.string()),
      quantifiesFrequencyNotProbability: z.boolean(),
      hfeContributionsIncluded: z.boolean(),
      hfeExclusionBasis: z.string().optional(),
      componentFailureCombinationsIncluded: z.boolean(),
    })
    .optional(),
  operatorContribution: z
    .object({
      controlRoomContributionEstimated: z.boolean(),
      operatorSplitFraction: z.number().optional(),
      hardwareSplitFraction: z.number().optional(),
      basis: z.string(),
    })
    .optional(),
  genericDataComparison: z
    .object({
      performed: z.boolean(),
      differencesExplanation: z.string().optional(),
    })
    .optional(),
  rareEventTreatment: z
    .object({
      industryGenericDataUsed: z.boolean(),
      plantSpecificAugmentation: z.string().optional(),
      expertJudgmentUsed: z.boolean(),
      expertJudgmentBasis: z.string().optional(),
    })
    .optional(),
  uncertaintyCharacterization: z
    .object({
      riskSignificant: z.boolean(),
      method: z.string(),
      probabilisticRepresentationProvided: z.boolean(),
    })
    .optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  dataSources: z.array(FrequencyDataSourceSchema).optional(),
  primaryDataSourceId: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InitiatingEventScreeningRecordSchema = z.object({
  initiatorOrGroupId: z.string(),
  retained: z.boolean(),
  criterion: IeScreeningCriterionSchema.optional(),
  barrierIntegrityPreconditionMet: z.boolean(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HazardAnalysisSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  hazardType: HazardTypeSchema,
  subcategory: z.string(),
  severityLevels: z.array(z.string()),
  affectedAreas: z.array(z.string()),
  radionuclideBarrierIds: z.array(z.string()),
  inducingMechanisms: z.array(z.string()),
  inducedInitiatorIds: z.array(z.string()),
  potentialCombinations: z.array(z.string()),
  analysisMethods: z.array(z.string()),
  screeningStatus: ScreeningStatusSchema,
  screeningBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IeCompletenessSearchSchema = z.object({
  functionalCategoriesCovered: z.array(InitiatingEventCategorySchema),
  perSystemSearchPerformed: z.boolean(),
  perSupportSystemSearchPerformed: z.boolean(),
  multipleFailureInitiatorsIncluded: z.boolean(),
  temporaryAlignmentsConsidered: z.boolean(),
  multiReactorEventsAddressed: z.boolean(),
  radioactiveSourceMechanismsAddressed: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IeDocumentationSchema = z.object({
  processDescription: z.string(),
  inputSources: z.string(),
  appliedMethods: z.string(),
  resultsSummary: z.string(),
  functionalCategoriesConsidered: z.string(),
  plantUniqueInitiatorsSearch: z.string(),
  stateSpecificInitiatorsSearch: z.string(),
  rcbFailureSearch: z.string(),
  completenessAssessment: z.string(),
  groupingProcessAndBasis: z.string(),
  screeningProcessAndBasis: z.string(),
  frequencyDerivation: z.string(),
  quantificationApproach: z.string(),
  dataSourceJustification: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IeSearchMethodSchema = z.object({
  id: z.string(),
  role: z.enum(["DEDUCTIVE", "INDUCTIVE", "EXPERIENCE", "CATALOGUE"]),
  name: z.string(),
  description: z.string(),
  scope: z.string(),
  coverageCategories: z.array(InitiatingEventCategorySchema),
  legitimacyBasis: z.string(),
  supportingDocuments: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InitiatingEventsAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.INITIATING_EVENT_ANALYSIS).shape,
  praScope: z.string(),
  includesNonInternalHazardGroups: z.boolean(),
  applicablePlantOperatingStates: z.array(z.string()),
  searchMethods: z.array(IeSearchMethodSchema).optional(),
  masterLogicDiagrams: z.array(MasterLogicDiagramSchema).optional(),
  heatBalanceFaultTrees: z.array(HeatBalanceFaultTreeSchema).optional(),
  failureModesAnalyses: z.array(FailureModesEffectAnalysisSchema).optional(),
  hazardOperabilityStudies: z.array(HazardOperabilityStudySchema).optional(),
  processHazardAnalyses: z.array(ProcessHazardAnalysisSchema).optional(),
  operatingExperienceReviews: z.array(OperatingExperienceReviewSchema).optional(),
  genericInitiatorCatalogues: z.array(GenericInitiatorCatalogueSchema).optional(),
  initiators: z.array(InitiatorDefinitionSchema),
  hazardInducedInitiators: z.array(HazardInducedInitiatorSchema).optional(),
  initiatingEventGroups: z.array(InitiatingEventGroupSchema),
  completenessSearch: IeCompletenessSearchSchema,
  sourceMechanisms: z.array(SourceEscapeMechanismSchema),
  identificationReviews: z.array(IdentificationReviewSchema),
  plantRepresentationAccuracy: PlantRepresentationAccuracySchema,
  hazardAnalyses: z.array(HazardAnalysisSchema).optional(),
  quantifications: z.array(InitiatingEventFrequencyQuantificationSchema),
  screeningRecords: z.array(InitiatingEventScreeningRecordSchema),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: IeDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertIeMirrorsType = Expect<Equal<z.infer<typeof InitiatingEventsAnalysisSchema>, InitiatingEventsAnalysis>>;

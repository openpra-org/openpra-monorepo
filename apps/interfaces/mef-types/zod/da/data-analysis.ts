import { z } from "zod";
import type { DataAnalysis } from "../../da/data-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { BasicEventSchema, FrequencyUnitSchema, ParameterDistributionSchema } from "../core/events";
import { SensitivityStudySchema, SuccessCriteriaIdSchema } from "../core/shared-patterns";
import {
  BaseAssumptionSchema,
  BaseModelUncertaintyDocumentationSchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const ParameterTypeSchema = z.enum([
  "FREQUENCY",
  "PROBABILITY",
  "UNAVAILABILITY",
  "CCF_PARAMETER",
  "HUMAN_ERROR_PROBABILITY",
  "OTHER",
]);

export const DetectabilityLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);

export const ProbabilityModelSchema = z.object({
  distribution: ParameterDistributionSchema,
  source: z.enum(["ESTIMATED", "MANUAL", "DEFAULT"]).optional(),
  estimationDetails: z
    .object({
      dataPointReferences: z.array(z.string()),
      estimationMethod: z.string(),
      estimationDate: z.string(),
      sampleSize: z.number().optional(),
      goodnessOfFit: z
        .object({
          method: z.string(),
          value: z.number(),
        })
        .optional(),
      confidenceIntervals: z
        .object({
          lower: z.record(z.string(), z.number()),
          upper: z.record(z.string(), z.number()),
        })
        .optional(),
    })
    .optional(),
});

export const FailureModeTypeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  category: z.string(),
  mechanismOfFailure: z.string(),
  detectability: DetectabilityLevelSchema,
  defaultProbabilityModel: ProbabilityModelSchema.optional(),
});

export const ComponentBasicEventSchema = z.object({
  ...BasicEventSchema.shape,
  componentTypeReference: z.string(),
  failureMode: z.string(),
  probabilityModel: ProbabilityModelSchema,
  isTemplate: z.boolean(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentBasicEventInstanceSchema = z.object({
  uuid: z.string(),
  componentReference: z.string(),
  templateReference: z.string(),
  probabilityAdjustments: z.record(z.string(), z.number()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const OperationalDataPointSchema = z.object({
  uuid: z.string(),
  componentReference: z.string(),
  componentTypeReference: z.string(),
  timestamp: z.string(),
  eventType: z.enum(["FAILURE", "REPAIR", "INSPECTION", "MAINTENANCE"]),
  operatingHours: z.number(),
  operatingCycles: z.number(),
  failureModeRef: z.string().optional(),
  repetitiveProblemGroupId: z.string().optional(),
  measurements: z.record(z.string(), z.number()).optional(),
  description: z.string().optional(),
});

export const OperationalDataRegistrySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  dataPoints: z.array(OperationalDataPointSchema),
});

export const DataSourceSchema = z.object({
  source: z.string(),
  context: z.string().optional(),
  notes: z.string().optional(),
  documentationReferences: z.array(z.string()).optional(),
  sourceType: z.enum(["GENERIC_INDUSTRY", "PLANT_SPECIFIC", "EXPERT_JUDGMENT", "OTHER_FACILITY_EXPERIENCE"]).optional(),
  timePeriod: z
    .object({
      startDate: z.string(),
      endDate: z.string(),
    })
    .optional(),
  applicabilityAssessment: z.string().optional(),
});

export const UncertaintySchema = z.object({
  distribution: ParameterDistributionSchema,
  modelUncertaintySources: z.array(z.string()).optional(),
  riskImplications: z
    .object({
      affectedMetrics: z.array(z.string()),
      significanceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
      propagationNotes: z.string().optional(),
    })
    .optional(),
  correlations: z
    .array(
      z.object({
        parameterId: z.string(),
        correlationType: z.enum(["COMMON_CAUSE", "ENVIRONMENTAL", "OPERATIONAL", "OTHER"]),
        correlationFactor: z.number(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
});

export const BayesianUpdateSchema = z.object({
  performed: z.boolean(),
  method: z.string(),
  convergenceCriteria: z.number().optional(),
  prior: z
    .object({
      distribution: ParameterDistributionSchema,
      source: z.string().optional(),
    })
    .optional(),
  posterior: z
    .object({
      distribution: ParameterDistributionSchema,
    })
    .optional(),
  posteriorReasonablenessCheck: z
    .object({
      evidenceStage: z.enum(["PLANT_SPECIFIC", "TECHNOLOGY_SPECIFIC"]),
      evidenceWeightAssessment: z.string(),
      reasonable: z.boolean(),
      basis: z.string(),
    })
    .optional(),
  validation: z
    .object({
      method: z.string(),
      results: z.string(),
      issues: z.array(z.string()).optional(),
    })
    .optional(),
});

export const DataAnalysisParameterSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parameterType: ParameterTypeSchema,
  value: z.number(),
  valueType: z.enum(["POINT_ESTIMATE", "MEAN"]),
  estimationApproach: z
    .enum(["PLANT_SPECIFIC", "TECHNOLOGY_SPECIFIC", "GENERIC", "REALISTIC_COMBINED", "SIMILAR_EQUIPMENT_ADJUSTED"])
    .optional(),
  isRiskSignificant: z.boolean().optional(),
  basicEventRef: z.string().optional(),
  componentGroupRef: z.string().optional(),
  systemReference: z.string().optional(),
  failureModeRef: z.string().optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema).optional(),
  plantOperatingStateRef: z.string().optional(),
  multiPosApplicabilityJustification: z.string().optional(),
  componentBoundaryRef: z.string().optional(),
  basicEventBoundaryRef: z.string().optional(),
  probabilityModel: ProbabilityModelSchema.optional(),
  modelSelectionBasis: z.string().optional(),
  requiredData: z.string().optional(),
  genericEvidence: z
    .object({
      source: z.string(),
      applicability: z.string(),
      timePeriod: z
        .object({
          startDate: z.string(),
          endDate: z.string(),
        })
        .optional(),
      events: z.number().optional(),
      exposureTime: z.number().optional(),
      exposureUnit: FrequencyUnitSchema.optional(),
    })
    .optional(),
  plantSpecificEvidence: z
    .object({
      events: z.number(),
      exposureTime: z.number(),
      exposureUnit: FrequencyUnitSchema,
      applicability: z.string(),
    })
    .optional(),
  dataExclusionJustifications: z.array(z.string()).optional(),
  bayesianUpdate: BayesianUpdateSchema.optional(),
  similarEquipmentAdjustment: z
    .object({
      sourceEquipment: z.string(),
      adjustments: z.string(),
      justification: z.string(),
    })
    .optional(),
  uncertainty: UncertaintySchema.optional(),
  dataSources: z.array(DataSourceSchema).optional(),
  assumptions: z.array(BaseAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentBoundarySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemId: z.string(),
  componentId: z.string().optional(),
  description: z.string(),
  boundaries: z.array(z.string()),
  includedItems: z.array(z.string()),
  excludedItems: z.array(z.string()).optional(),
  boundaryBasis: z.string(),
  referenceDocuments: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const BasicEventBoundarySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  basicEventId: z.string(),
  description: z.string(),
  includedConditions: z.array(z.string()),
  excludedConditions: z.array(z.string()).optional(),
  boundaryBasis: z.string(),
  referenceDocuments: z.array(z.string()).optional(),
  systemReference: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentGroupingSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemId: z.string(),
  groupId: z.string(),
  componentIds: z.array(z.string()),
  groupingBasis: z.enum(["TYPE_ONLY", "TYPE_AND_SERVICE_CONDITIONS"]),
  designCharacteristics: z.array(z.string()),
  environmentalConditions: z.array(z.string()),
  serviceConditions: z.array(z.string()),
  operationalConditions: z.array(z.string()).optional(),
  groupingJustification: z.string(),
  referenceDocuments: z.array(z.string()).optional(),
  excludedOutliers: z.array(z.string()).optional(),
  outlierIdentificationCriteria: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const OutlierComponentSchema = z.object({
  uuid: z.string(),
  systemId: z.string(),
  componentId: z.string(),
  potentialGroupId: z.string(),
  exclusionReason: z.string(),
  exclusionJustification: z.string(),
  differentiatingCharacteristics: z.array(z.string()),
  alternativeHandling: z.string(),
  referenceDocuments: z.array(z.string()).optional(),
  status: z.enum(["CONFIRMED", "TENTATIVE", "UNDER_REVIEW"]),
  determinationDate: z.string().optional(),
  determinedBy: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ExternalDataSourceSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceType: z.enum(["INDUSTRY_DATABASE", "PLANT_RECORDS", "EXPERT_JUDGMENT", "OTHER_FACILITY_EXPERIENCE", "OTHER"]),
  sourceLocation: z.string(),
  timePeriod: z.object({
    start: z.string(),
    end: z.string(),
  }),
  accessMethod: z.string(),
  dataFormat: z.string(),
  qualityAssurance: z.string().optional(),
  limitations: z.array(z.string()).optional(),
  referenceDocumentation: z.array(z.string()),
  validationMethod: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DataConsistencyCheckSchema = z.object({
  uuid: z.string(),
  parameterId: z.string(),
  dataSourceId: z.string(),
  verificationMethod: z.string(),
  consistencyAssessment: z.enum(["CONSISTENT", "INCONSISTENT", "PARTIALLY_CONSISTENT"]),
  discrepancies: z.array(z.string()).optional(),
  resolutionActions: z.array(z.string()).optional(),
  verificationDate: z.string(),
  verifierId: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FailureEventClassificationSchema = z.object({
  uuid: z.string(),
  componentGroupRef: z.string().optional(),
  failureModeRef: z.string().optional(),
  failureDefinitionBasis: z.string(),
  degradedStatesCountedAsFailures: z.array(z.string()),
  degradedStatesNotCounted: z.array(z.string()),
  repeatedFailureCountingApplied: z.boolean(),
  basisDocuments: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DemandCountRecordSchema = z.object({
  uuid: z.string(),
  componentGroupRef: z.string(),
  plantOperatingStateRef: z.string().optional(),
  surveillanceTestDemands: z.number().optional(),
  maintenanceActDemands: z.number().optional(),
  operationalDemands: z.number().optional(),
  additionalDemandSources: z
    .array(
      z.object({
        source: z.string(),
        count: z.number(),
      }),
    )
    .optional(),
  totalDemands: z.number(),
  basis: z.enum(["ANNUALIZED_PLANNED", "ACTUAL_PRACTICE_RECORDS", "PREOP_EXPECTED_PERFORMANCE"]),
  sourceRecords: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ExposureTimeRecordSchema = z.object({
  uuid: z.string(),
  componentGroupRef: z.string(),
  plantOperatingStateRef: z.string().optional(),
  standbyHours: z.number().optional(),
  operatingHours: z.number().optional(),
  basis: z.enum(["ESTIMATED_FROM_TEST_PRACTICES", "OPERATIONAL_RECORDS"]),
  sourceRecords: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TestCredibilityReviewSchema = z.object({
  uuid: z.string(),
  testProcedureReference: z.string(),
  componentGroupRef: z.string().optional(),
  failureModesExercised: z.array(z.string()),
  failureModesNotExercised: z.array(z.string()),
  demandCreditingDecision: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const UnavailabilityDataRecordSchema = z.object({
  uuid: z.string(),
  componentOrTrainReference: z.string(),
  systemReference: z.string().optional(),
  plantOperatingStateRef: z.string().optional(),
  contributingActivities: z.array(
    z.object({
      activity: z.string(),
      durationHours: z.number(),
      disablesFunction: z.boolean(),
    }),
  ),
  assignedToSupportSystem: z.string().optional(),
  preOperationalGenericJustification: z.string().optional(),
  preOperationalAssumptionsBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CoincidentMaintenanceRecordSchema = z.object({
  uuid: z.string(),
  redundantEquipmentIds: z.array(z.string()),
  scope: z.enum(["INTRASYSTEM", "INTERSYSTEM"]),
  plannedActivityDescription: z.string(),
  unavailabilityValue: z.number().optional(),
  basis: z.enum(["ACTUAL_PLANT_EXPERIENCE", "PREOP_ASSUMPTION"]),
  systemsAnalysisSimultaneousEventRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RepairTimeRecordSchema = z.object({
  uuid: z.string(),
  sscReference: z.string(),
  repairEvents: z.array(
    z.object({
      eventReference: z.string().optional(),
      identificationToRestorationHours: z.number(),
    }),
  ),
  industryExperienceReferences: z.array(z.string()).optional(),
  preOperationalAssumptionsBasis: z.string().optional(),
  plantOperatingStateInfluences: z.string().optional(),
  eventSequenceInfluences: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const RecoveryTimeRecordSchema = z.object({
  uuid: z.string(),
  functionLost: z.string(),
  recoveryEvents: z.array(
    z.object({
      eventReference: z.string().optional(),
      identificationToRestorationHours: z.number(),
    }),
  ),
  genericSourceReferences: z.array(z.string()).optional(),
  plantOperatingStateInfluences: z.string().optional(),
  eventSequenceInfluences: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LpsdOutageDataRecordSchema = z.object({
  uuid: z.string(),
  plantOperatingStateRef: z.string().optional(),
  evolutionType: z.string().optional(),
  outageType: z.string(),
  calendarYear: z.number().optional(),
  startTime: z.string().optional(),
  durationHours: z.number().optional(),
  specialMaintenanceConfigurations: z.array(z.string()).optional(),
  outagesPerCalendarYear: z.number().optional(),
  posDataLinkBasis: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CcfParameterEstimationSchema = z.object({
  uuid: z.string(),
  ccfGroupReference: z.string(),
  modelType: z.enum(["BETA_FACTOR", "ALPHA_FACTOR", "MGL", "PHI_FACTOR", "OTHER_EQUIVALENT"]),
  parameters: z.record(z.string(), z.number()),
  isRiskSignificant: z.boolean().optional(),
  parameterSource: z.enum(["GENERIC", "PLANT_EXPERIENCE_CONSISTENT"]),
  componentBoundaryConsistencyBasis: z.string(),
  genericExclusionConsistencyConfirmed: z.boolean().optional(),
  genericExclusionConsistencyBasis: z.string().optional(),
  dataSources: z.array(DataSourceSchema).optional(),
  uncertainty: UncertaintySchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DataModificationAdjustmentSchema = z.object({
  uuid: z.string(),
  modificationDescription: z.string(),
  affectedParameterIds: z.array(z.string()),
  pastDataDisposition: z.enum(["ADJUSTED", "DISCARDED", "RETAINED_WITH_JUSTIFICATION"]),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DaDocumentationSchema = z.object({
  processDescription: z.string(),
  systemComponentBoundaries: z.string(),
  basicEventProbabilityModels: z.string(),
  genericParameterSources: z.string(),
  plantSpecificDataSourcesAndPeriods: z.string(),
  dataExclusionJustifications: z.string(),
  demandAndExposureCounting: z.string(),
  unavailabilityTreatment: z.string(),
  repairAndRecoveryData: z.string(),
  lpsdOutageData: z.string(),
  componentGroupingAndOutliers: z.string(),
  ccfParameterBasis: z.string(),
  bayesianPriorRationales: z.string(),
  parameterEstimatesWithUncertainty: z.string(),
  multiPosGenericUse: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DataAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.DATA_ANALYSIS).shape,
  praScope: z.string(),
  parameters: z.array(DataAnalysisParameterSchema),
  componentBasicEvents: z.array(ComponentBasicEventSchema).optional(),
  componentBasicEventInstances: z.array(ComponentBasicEventInstanceSchema).optional(),
  failureModes: z.array(FailureModeTypeSchema).optional(),
  componentBoundaries: z.array(ComponentBoundarySchema),
  basicEventBoundaries: z.array(BasicEventBoundarySchema).optional(),
  componentGroupings: z.array(ComponentGroupingSchema).optional(),
  outlierComponents: z.array(OutlierComponentSchema).optional(),
  operationalDataRegistries: z.array(OperationalDataRegistrySchema).optional(),
  externalDataSources: z.array(ExternalDataSourceSchema).optional(),
  dataConsistencyChecks: z.array(DataConsistencyCheckSchema).optional(),
  failureEventClassifications: z.array(FailureEventClassificationSchema).optional(),
  demandCountRecords: z.array(DemandCountRecordSchema).optional(),
  exposureTimeRecords: z.array(ExposureTimeRecordSchema).optional(),
  testCredibilityReviews: z.array(TestCredibilityReviewSchema).optional(),
  unavailabilityDataRecords: z.array(UnavailabilityDataRecordSchema).optional(),
  coincidentMaintenanceRecords: z.array(CoincidentMaintenanceRecordSchema).optional(),
  repairTimeRecords: z.array(RepairTimeRecordSchema).optional(),
  recoveryTimeRecords: z.array(RecoveryTimeRecordSchema).optional(),
  lpsdOutageDataRecords: z.array(LpsdOutageDataRecordSchema).optional(),
  ccfParameterEstimations: z.array(CcfParameterEstimationSchema).optional(),
  dataModificationAdjustments: z.array(DataModificationAdjustmentSchema).optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  documentation: DaDocumentationSchema,
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

type _AssertDaMirrorsType = Expect<Equal<z.infer<typeof DataAnalysisSchema>, DataAnalysis>>;

import { z } from "zod";
import type { DataAnalysis } from "../../da/data-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { BasicEventSchema, ParameterDistributionSchema, UncertainFrequencySchema } from "../core/events";
import { BaseLawSchema, CcfFactorModelSchema, LawSchema, TruncatedLawSchema, UncertainExpressionSchema } from "../core/uncertainty";
import { entryHoldsLaw, holdsEstimate } from "../../da/data-analysis";
import { carriesUncertainExpression } from "../../sy/systems-analysis";
import { SensitivityStudySchema, SuccessCriteriaIdSchema } from "../core/shared-patterns";
import {
  BaseAssumptionSchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const ParameterTypeSchema = z.enum([
  "FREQUENCY",
  "FAILURE_RATE",
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

export const DaEvidenceKindSchema = z.enum([
  "PLANT_RECORDS",
  "TECHNOLOGY",
  "GENERIC_NUCLEAR",
  "ANALOGOUS_INDUSTRY",
  "ENGINEERING_MODEL",
  "EXPERT_JUDGMENT",
]);

export const DaSourceOriginSchema = z.enum(["SAME_TECHNOLOGY", "OTHER_NUCLEAR", "NONNUCLEAR"]);

export const DaEstimateQuantitySchema = z.enum(["PER_DEMAND", "PER_HOUR", "PER_YEAR", "FRACTION", "PROBABILITY", "HOURS", "FACTOR"]);

export const DaTransferFactorSchema = z.object({
  id: z.string(),
  name: z.string(),
  nominal: z.number(),
  low: z.number(),
  high: z.number(),
  basis: z.string(),
});

export const DaSourceUseSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  entryId: z.string().optional(),
  elicitationId: z.string().optional(),
  verdict: z.enum(["APPLIES", "SCALED", "REJECTED"]),
  boundary: z.enum(["SAME", "ADJUSTED", "DIFFERENT"]),
  reason: z.string(),
  hoursPerYear: z.number().optional(),
  standbyHours: z.number().optional(),
  factors: z.array(DaTransferFactorSchema).optional(),
});

export const DaSourceEntrySchema = z.object({
  id: z.string(),
  component: z.string(),
  failureMode: z.string(),
  quantity: DaEstimateQuantitySchema,
  table: z.string().optional(),
  law: LawSchema.optional(),
  distribution: ParameterDistributionSchema.optional(),
  mean: z.number().optional(),
  p05: z.number().optional(),
  median: z.number().optional(),
  p95: z.number().optional(),
  p025: z.number().optional(),
  p975: z.number().optional(),
  failures: z.number().optional(),
  exposure: z.number().optional(),
  population: z.number().optional(),
  yearsFrom: z.string().optional(),
  yearsTo: z.string().optional(),
  method: z.string().optional(),
  boundaryNote: z.string().optional(),
  catalogCode: z.string().optional(),
}).superRefine((entry, context) => {
  if (entryHoldsLaw(entry.quantity) && entry.distribution !== undefined) {
    context.addIssue({ code: "custom", path: ["distribution"], message: "This estimate keeps its law in the law field" });
  }
  if (!entryHoldsLaw(entry.quantity) && entry.law !== undefined) {
    context.addIssue({ code: "custom", path: ["law"], message: "This estimate keeps its distribution in the distribution field" });
  }
});

export const DaSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  catalogId: z.string().optional(),
  kind: DaEvidenceKindSchema,
  origin: DaSourceOriginSchema,
  covers: z.string(),
  yearsFrom: z.string().optional(),
  yearsTo: z.string().optional(),
  boundaryConvention: z.string(),
  failureCounting: z.string(),
  quality: z.string(),
  reference: z.string(),
  entries: z.array(DaSourceEntrySchema),
});

export const DaPriorFormSchema = z.enum(["AS_PUBLISHED", "CONSTRAINED_NONINFORMATIVE", "JEFFREYS"]);

export const DaEstimateMethodSchema = z.enum(["PRIOR", "BAYES", "POPULATION"]);

export const DaEvidenceOriginSchema = z.enum(["PLANT_RECORDS", "TECHNOLOGY"]);

export const DaEvidenceSchema = z.object({
  id: z.string(),
  origin: DaEvidenceOriginSchema,
  label: z.string().optional(),
  failuresFrom: z.enum(["TYPED", "ENTRY", "RECORDS"]),
  exposureFrom: z.enum(["TYPED", "ENTRY", "DEMANDS_AND_HOURS"]),
  sourceId: z.string().optional(),
  entryId: z.string().optional(),
  recordSetId: z.string().optional(),
  failures: z.number().optional(),
  exposure: z.number().optional(),
  unit: z.enum(["DEMANDS", "HOURS", "YEARS"]).optional(),
  hoursPerDemand: z.number().optional(),
  hoursPerYear: z.number().optional(),
  yearsFrom: z.string().optional(),
  yearsTo: z.string().optional(),
  boundary: z.enum(["SAME", "ADJUSTED", "DIFFERENT"]),
  reason: z.string(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
});

export const DaFailureRecordSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  unit: z.string().optional(),
  description: z.string(),
  reference: z.string().optional(),
  judgment: z.enum(["OPEN", "FAILURE", "NOT_FAILURE", "REPEAT", "EXCLUDED"]),
  parameterId: z.string().optional(),
  repeatOf: z.string().optional(),
  reason: z.string().optional(),
});

export const DaRecordSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: DaEvidenceOriginSchema,
  sourceId: z.string().optional(),
  yearsFrom: z.string().optional(),
  yearsTo: z.string().optional(),
  reference: z.string(),
  records: z.array(DaFailureRecordSchema),
});

export const DaCountBasisSchema = z.enum(["RECORDS", "ANNUALIZED_PLAN", "PLANNED_SCHEDULE"]);

export const DaDemandCountSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  kind: z.enum(["SURVEILLANCE", "MAINTENANCE", "OTHER_COMPONENT", "OPERATIONAL"]),
  activity: z.string(),
  count: z.number(),
  failureModeIds: z.array(z.string()),
  basis: DaCountBasisSchema,
  reference: z.string().optional(),
});

export const DaHourCountSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  runHours: z.number().optional(),
  standbyHours: z.number().optional(),
  basis: DaCountBasisSchema,
  reference: z.string().optional(),
});

export const DaMaintenanceActivitySchema = z.object({
  id: z.string(),
  activity: z.string(),
  perYear: z.number(),
  hoursEach: z.number(),
  hoursLow: z.number().optional(),
  hoursHigh: z.number().optional(),
  disablesFunction: z.boolean(),
  chargedTo: z.string().optional(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

export const DaOutOfServiceRecordSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  activity: z.string(),
  hours: z.number(),
  disablesFunction: z.boolean(),
  chargedTo: z.string().optional(),
  reference: z.string().optional(),
});

export const DaMaintenanceBasisSchema = z.object({
  kind: z.enum(["TRAIN", "COINCIDENT"]),
  method: z.enum(["PLANNED", "RECORDS", "GENERIC"]),
  requiredHoursPerYear: z.number().optional(),
  requiredReason: z.string().optional(),
  trains: z.number().optional(),
  trainsReason: z.string().optional(),
  activities: z.array(DaMaintenanceActivitySchema).optional(),
  records: z.array(DaOutOfServiceRecordSchema).optional(),
  overlapIds: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  scope: z.enum(["INTRASYSTEM", "INTERSYSTEM"]).optional(),
  basis: z.string().optional(),
});

export const DaRestorationTimeSchema = z.object({
  id: z.string(),
  hours: z.number(),
  date: z.string().optional(),
  reference: z.string().optional(),
});

export const DaRestorationPartSchema = z.object({
  useId: z.string(),
  weight: z.number().optional(),
  weightSourceId: z.string().optional(),
  weightEntryId: z.string().optional(),
  sampleSize: z.number().optional(),
});

export const DaRestorationBasisSchema = z.object({
  kind: z.enum(["REPAIR", "RECOVERY"]),
  subject: z.string(),
  from: z.enum(["SOURCES", "RECORDS"]),
  parts: z.array(DaRestorationPartSchema).optional(),
  comparison: z.array(DaRestorationPartSchema).optional(),
  times: z.array(DaRestorationTimeSchema).optional(),
  windowHours: z.number().optional(),
  windowReason: z.string().optional(),
  sequence: z.string().optional(),
  basis: z.string().optional(),
});

export const DaOutageSchema = z.object({
  id: z.string(),
  evolution: z.string(),
  outageType: z.string(),
  stateId: z.string().optional(),
  start: z.string().optional(),
  hours: z.number(),
  perYear: z.number(),
  configurations: z.array(z.string()).optional(),
  basis: DaCountBasisSchema,
  reference: z.string().optional(),
  valueFrom: z.enum(["TYPED", "POS"]).optional(),
});

export const DaElicitationExpertSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["EVALUATOR", "PROPONENT", "RESOURCE"]),
  outside: z.boolean(),
  expertise: z.string(),
  p05: z.number().optional(),
  median: z.number().optional(),
  p95: z.number().optional(),
  weight: z.number().optional(),
  acceptsResponsibility: z.boolean(),
});

export const DaJudgmentLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const DaElicitationSchema = z.object({
  id: z.string(),
  issue: z.string(),
  objective: z.string(),
  quantity: DaEstimateQuantitySchema,
  importance: DaJudgmentLevelSchema,
  complexity: DaJudgmentLevelSchema,
  structure: z.enum(["SINGLE_EVALUATOR", "PANEL"]),
  outsideReason: z.string().optional(),
  experts: z.array(DaElicitationExpertSchema),
  pooling: z.enum(["LINEAR", "LOGARITHMIC"]),
  integrator: z.string(),
  responsibility: z.enum(["INTEGRATOR", "SHARED"]),
  completed: z.string().optional(),
  reference: z.string().optional(),
});

export const DaInitiatorCategorySchema = z.enum(["I", "II", "III", "IV"]);

export const DaFrequencyPerSchema = z.enum(["CRITICAL_YEAR", "CALENDAR_YEAR", "SHUTDOWN_YEAR"]);

export const DaFrequencyPartSchema = z.object({
  id: z.string(),
  label: z.string(),
  memberIds: z.array(z.string()).optional(),
  per: DaFrequencyPerSchema,
  stateIds: z.array(z.string()).optional(),
  useId: z.string().optional(),
  priorForm: DaPriorFormSchema.optional(),
  method: z.enum(["PRIOR", "BAYES"]).optional(),
  evidence: z.array(DaEvidenceSchema).optional(),
  reason: z.string().optional(),
});

export const DaFrequencyComparisonSchema = z.object({
  id: z.string(),
  useId: z.string(),
  per: DaFrequencyPerSchema,
  reason: z.string().optional(),
});

export const DaFrequencyBasisSchema = z.object({
  category: DaInitiatorCategorySchema.optional(),
  categoryReason: z.string().optional(),
  siteWide: z.boolean().optional(),
  siteWideReason: z.string().optional(),
  parts: z.array(DaFrequencyPartSchema),
  comparisons: z.array(DaFrequencyComparisonSchema).optional(),
  basis: z.string().optional(),
});

export const DaImportanceSchema = z.object({
  from: z.enum(["TYPED", "ESQ"]),
  fussellVesely: z.number().optional(),
  riskAchievementWorth: z.number().optional(),
  entryIds: z.array(z.string()).optional(),
  importedAt: z.string().optional(),
});

export const DaPopulationHyperpriorSchema = z.object({
  mu: z.union([BaseLawSchema, TruncatedLawSchema]),
  sigma: z.union([BaseLawSchema, TruncatedLawSchema]),
});

export const DataAnalysisParameterSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parameterType: ParameterTypeSchema,
  value: z.number().optional(),
  valueType: z.enum(["POINT_ESTIMATE", "MEAN"]).optional(),
  estimate: UncertainExpressionSchema.optional(),
  quantificationModel: z
    .enum([
      "DEMAND_PROBABILITY",
      "RUNNING_RATE",
      "MISSION_PROBABILITY",
      "STANDBY_RATE",
      "UNAVAILABILITY",
      "HUMAN_ERROR",
      "NON_RECOVERY",
      "FREQUENCY",
      "OTHER_PROBABILITY",
    ])
    .optional(),
  missionTime: UncertainExpressionSchema.optional(),
  valueMode: z.enum(["TYPED", "LINKED", "CALCULATED"]).optional(),
  valueLink: z
    .object({
      element: z.enum(["SY", "IE", "HRA", "POS"]),
      needId: z.string(),
    })
    .optional(),
  stateIds: z.array(z.string()).optional(),
  sourceUses: z.array(DaSourceUseSchema).optional(),
  priorUseId: z.string().optional(),
  evidenceKind: DaEvidenceKindSchema.optional(),
  evidenceReason: z.string().optional(),
  priorForm: DaPriorFormSchema.optional(),
  priorFormReason: z.string().optional(),
  estimateMethod: DaEstimateMethodSchema.optional(),
  estimateReason: z.string().optional(),
  populationTargetId: z.string().optional(),
  populationHyperprior: DaPopulationHyperpriorSchema.optional(),
  evidence: z.array(DaEvidenceSchema).optional(),
  maintenance: DaMaintenanceBasisSchema.optional(),
  restoration: DaRestorationBasisSchema.optional(),
  frequency: DaFrequencyBasisSchema.optional(),
  isRiskSignificant: z.boolean().optional(),
  importance: DaImportanceSchema.optional(),
  basicEventRef: z.string().optional(),
  componentGroupRef: z.string().optional(),
  systemReference: z.string().optional(),
  failureModeRef: z.string().optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema).optional(),
  plantOperatingStateRef: z.string().optional(),
  multiPosApplicabilityJustification: z.string().optional(),
  componentBoundaryRef: z.string().optional(),
  basicEventBoundaryRef: z.string().optional(),
  modelSelectionBasis: z.string().optional(),
  requiredData: z.string().optional(),
  uncertainty: UncertaintySchema.optional(),
  uncertaintyNote: z.string().optional(),
  dataSources: z.array(DataSourceSchema).optional(),
  assumptions: z.array(BaseAssumptionSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
}).superRefine((parameter, context) => {
  if (holdsEstimate(parameter.quantificationModel)) {
    for (const field of ["value", "valueType", "uncertainty", "missionTime"] as const) {
      if (parameter[field] !== undefined) {
        context.addIssue({ code: "custom", path: [field], message: "This parameter keeps its estimate in the estimate field" });
      }
    }
    if (parameter.quantificationModel === "FREQUENCY" && parameter.populationHyperprior !== undefined) {
      context.addIssue({ code: "custom", path: ["populationHyperprior"], message: "Only a component parameter holds a population hyperprior" });
    }
  } else {
    if (parameter.valueType === undefined) {
      context.addIssue({ code: "custom", path: ["valueType"], message: "This parameter needs its value type" });
    }
    for (const field of ["estimate", "populationHyperprior"] as const) {
      if (parameter[field] !== undefined) {
        context.addIssue({ code: "custom", path: [field], message: "Only a component or frequency parameter holds an uncertain estimate" });
      }
    }
  }
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

export const DaCcfEventSchema = z.object({
  id: z.string(),
  recordId: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  impact: z.array(z.number()),
  included: z.boolean(),
  reason: z.string(),
});

export const DaCcfEvidenceSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  origin: DaEvidenceOriginSchema,
  recordSetId: z.string().optional(),
  population: z.number(),
  independentFailures: z.number(),
  events: z.array(DaCcfEventSchema),
  boundary: z.enum(["SAME", "ADJUSTED", "DIFFERENT"]),
  reason: z.string(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
});

export const CcfParameterEstimationSchema = z.object({
  uuid: z.string(),
  ccfGroupReference: z.string(),
  name: z.string().optional(),
  groupSize: z.number().optional(),
  memberParameterId: z.string().optional(),
  testing: z.enum(["STAGGERED", "NON_STAGGERED"]).optional(),
  testingReason: z.string().optional(),
  method: z.enum(["PRIOR", "BAYES", "TYPED"]).optional(),
  priorSourceId: z.string().optional(),
  priorTemplate: z.string().optional(),
  priorReason: z.string().optional(),
  evidence: z.array(DaCcfEvidenceSchema).optional(),
  estimateReason: z.string().optional(),
  factors: CcfFactorModelSchema.optional(),
  isRiskSignificant: z.boolean().optional(),
  importance: DaImportanceSchema.optional(),
  parameterSource: z.enum(["GENERIC", "PLANT_EXPERIENCE_CONSISTENT"]),
  componentBoundaryConsistencyBasis: z.string(),
  genericExclusionConsistencyConfirmed: z.boolean().optional(),
  genericExclusionConsistencyBasis: z.string().optional(),
  dataSources: z.array(DataSourceSchema).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DataModificationAdjustmentSchema = z.object({
  uuid: z.string(),
  modificationDescription: z.string(),
  effectiveDate: z.string().optional(),
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

export const DaLinkCodeSchema = z.enum(["SY", "IE", "HRA", "POS", "SC", "ESQ"]);

export const DaLinkedWorkbooksSchema = z.object({
  SY: z.string().optional(),
  IE: z.string().optional(),
  HRA: z.string().optional(),
  POS: z.string().optional(),
  SC: z.string().optional(),
  ESQ: z.string().optional(),
});

export const DaScopeKindSchema = z.enum([
  "TEST_MAINTENANCE",
  "REPAIR_RECOVERY",
  "COMMON_CAUSE",
  "INITIATING_EVENT",
  "HUMAN_ERROR",
  "OUTAGE",
]);

export const DaScopeDecisionSchema = z.object({
  kind: DaScopeKindSchema,
  included: z.boolean(),
  exclusionReason: z.string().optional(),
});

export const DaFieldLinkSchema = z.object({
  element: DaLinkCodeSchema,
  workbookId: z.string(),
  field: z.string(),
});

export const DaLinkedNumberSchema = z.object({
  value: z.number(),
  link: DaFieldLinkSchema.optional(),
});

export const DaDataPlanSchema = z.object({
  freezeDate: z.string().optional(),
  dataWindowStart: z.string().optional(),
  dataWindowEnd: z.string().optional(),
  modulesPerPlant: DaLinkedNumberSchema.optional(),
});

export const DaNeedKindSchema = z.enum([
  "DEMAND",
  "RUNNING",
  "STANDBY",
  "UNAVAILABILITY",
  "HUMAN_ERROR",
  "RECOVERY",
  "COMMON_CAUSE",
  "OTHER",
]);

export const DaNeedElementSchema = z.enum(["SY", "IE", "HRA", "POS"]);

export const DaValueHolderSchema = z.enum(["TYPED", "DA", "HRA"]);

export const DaManualEntrySchema = z.object({
  source: z.string(),
});

export const DaNeedSourceSchema = z.object({
  element: DaNeedElementSchema,
  workbookId: z.string(),
  workbookName: z.string(),
  updatedAt: z.string().optional(),
});

export const DaNeedChangeSchema = z.object({
  element: DaNeedElementSchema,
  id: z.string(),
  change: z.enum(["ADDED", "REMOVED", "CHANGED"]),
  label: z.string().optional(),
});

export const DaBasicEventNeedSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  systemId: z.string().optional(),
  systemName: z.string().optional(),
  failureMode: z.string().optional(),
  importedKind: DaNeedKindSchema.optional(),
  kind: DaNeedKindSchema.optional(),
  importedMissionTime: UncertainExpressionSchema.optional(),
  missionTime: UncertainExpressionSchema.optional(),
  testIntervalHours: z.number().optional(),
  value: z.number().optional(),
  valueUnit: z.enum(["PROBABILITY", "PER_HOUR"]).optional(),
  expression: UncertainExpressionSchema.optional(),
  valueHeldBy: DaValueHolderSchema.optional(),
  valueHolderId: z.string().optional(),
  repairCredited: z.boolean().optional(),
  meanTimeToRepairHours: z.number().optional(),
  changeReason: z.string().optional(),
  parameterId: z.string().optional(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  manual: DaManualEntrySchema.optional(),
}).superRefine((need, context) => {
  if (carriesUncertainExpression(need.failureMode)) {
    for (const field of ["value", "valueUnit"] as const) {
      if (need[field] !== undefined) {
        context.addIssue({ code: "custom", path: [field], message: "A component event keeps its value in the expression field" });
      }
    }
  } else if (need.expression !== undefined) {
    context.addIssue({ code: "custom", path: ["expression"], message: "Only a component event holds an uncertain expression" });
  }
});

export const DaInitiatorNeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  stateIds: z.array(z.string()),
  memberIds: z.array(z.string()),
  frequency: UncertainFrequencySchema.optional(),
  frequencyBasis: z.string().optional(),
  valueHeldBy: DaValueHolderSchema.optional(),
  valueHolderId: z.string().optional(),
  parameterId: z.string().optional(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  manual: DaManualEntrySchema.optional(),
});

export const DaHumanErrorNeedSchema = z.object({
  id: z.string(),
  hfeId: z.string(),
  name: z.string(),
  timing: z.enum(["PRE_INITIATOR", "AT_INITIATOR", "POST_INITIATOR"]).optional(),
  kind: z.enum(["HUMAN_ERROR", "RECOVERY"]),
  value: z.number().optional(),
  valueKind: z.enum(["MEAN", "POINT_ESTIMATE"]).optional(),
  method: z.string().optional(),
  stateIds: z.array(z.string()),
  valueHeldBy: DaValueHolderSchema.optional(),
  valueHolderId: z.string().optional(),
  parameterId: z.string().optional(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  manual: DaManualEntrySchema.optional(),
});

export const DaCcfGroupNeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemIds: z.array(z.string()),
  memberIds: z.array(z.string()),
  factors: CcfFactorModelSchema.optional(),
  total: UncertainExpressionSchema.optional(),
  estimateRef: z.string().optional(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  manual: DaManualEntrySchema.optional(),
});

export const DaStateNeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.string().optional(),
  durationHours: z.number().optional(),
  entriesPerYear: z.number().optional(),
  valueHeldBy: DaValueHolderSchema.optional(),
  included: z.boolean(),
  exclusionReason: z.string().optional(),
  manual: DaManualEntrySchema.optional(),
});

export const DaDataNeedsSchema = z.object({
  importedAt: z.string().optional(),
  sources: z.array(DaNeedSourceSchema),
  changes: z.array(DaNeedChangeSchema).optional(),
  basicEvents: z.array(DaBasicEventNeedSchema),
  initiators: z.array(DaInitiatorNeedSchema),
  humanErrors: z.array(DaHumanErrorNeedSchema),
  ccfGroups: z.array(DaCcfGroupNeedSchema),
  states: z.array(DaStateNeedSchema),
});

export const DaUncertaintyAlternativeSchema = z.object({
  id: z.string(),
  alternative: z.string(),
  reasonNotSelected: z.string(),
});

export const DaUncertaintySourceSchema = z.object({
  id: z.string(),
  source: z.string(),
  impact: z.string(),
  parameterIds: z.array(z.string()),
  estimateIds: z.array(z.string()).optional(),
  assumption: z.string().optional(),
  assumptionBasis: z.string().optional(),
  alternatives: z.array(DaUncertaintyAlternativeSchema),
  key: z.boolean(),
  keyReason: z.string().optional(),
  sensitivityIds: z.array(z.string()).optional(),
  assumptionIds: z.array(z.string()).optional(),
});

export const DaSensitivityCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["FACTOR", "PRIOR_FORM", "SOURCE", "TESTING", "RANGE"]),
  parameterId: z.string().optional(),
  estimateId: z.string().optional(),
  useId: z.string().optional(),
  priorForm: DaPriorFormSchema.optional(),
  testing: z.enum(["STAGGERED", "NON_STAGGERED"]).optional(),
  low: z.number().optional(),
  high: z.number().optional(),
  reason: z.string(),
  results: z.string().optional(),
});

export const DataAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.DATA_ANALYSIS).shape,
  praScope: z.string(),
  linkedWorkbooks: DaLinkedWorkbooksSchema.optional(),
  scopeDecisions: z.array(DaScopeDecisionSchema).optional(),
  dataPlan: DaDataPlanSchema.optional(),
  dataNeeds: DaDataNeedsSchema.optional(),
  sources: z.array(DaSourceSchema).optional(),
  elicitations: z.array(DaElicitationSchema).optional(),
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
  recordSets: z.array(DaRecordSetSchema).optional(),
  demandCounts: z.array(DaDemandCountSchema).optional(),
  hourCounts: z.array(DaHourCountSchema).optional(),
  outages: z.array(DaOutageSchema).optional(),
  ccfParameterEstimations: z.array(CcfParameterEstimationSchema).optional(),
  dataModificationAdjustments: z.array(DataModificationAdjustmentSchema).optional(),
  uncertaintyRegister: z.array(DaUncertaintySourceSchema).optional(),
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  sensitivityCases: z.array(DaSensitivityCaseSchema).optional(),
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

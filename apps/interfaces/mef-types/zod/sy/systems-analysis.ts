import { z } from "zod";
import type { SystemsAnalysis } from "../../sy/systems-analysis";
import { DependencyType, FailureModeType, FaultTreeNodeType } from "../../sy/systems-analysis";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { BasicEventSchema, DistributionTypeSchema } from "../core/events";
import { ComponentSchema } from "../core/component";
import { BaseUncertaintyAnalysisSchema, SensitivityStudySchema, SuccessCriteriaIdSchema } from "../core/shared-patterns";
import {
  BaseModelUncertaintyDocumentationSchema,
  PlantRepresentationAccuracySchema,
  PreOperationalAssumptionSchema,
} from "../core/documentation";
import { SRReferenceSchema } from "../core/pra-common";

export const SyDependencyTypeSchema = z.enum(DependencyType);
export const SyFailureModeTypeSchema = z.enum(FailureModeType);
export const FaultTreeNodeTypeSchema = z.enum(FaultTreeNodeType);
export const ComponentStateSchema = z.enum(["operational", "degraded", "failed", "recovering", "maintenance"]);
export const FaultTreeNodeProbabilityTypeSchema = z.enum(["constant", "distribution", "bayesian_network_link"]);
export const FaultTreeNodeEventTypeSchema = z.enum(["on_demand", "during_operation"]);

export const SystemBasicEventSchema = z.object({
  ...BasicEventSchema.shape,
  componentReference: z.string().optional(),
  failureMode: z.string().optional(),
  probability: z.number().optional(),
  repairModeled: z.boolean().optional(),
  repairJustification: z.string().optional(),
  meanTimeToRepair: z.number().optional(),
  probabilityModelRef: z.string().optional(),
  dataAnalysisBasicEventRef: z.string().optional(),
  expression: z
    .object({
      value: z.number().optional(),
      parameter: z.string().optional(),
      formula: z.string().optional(),
      type: z.enum(["constant", "parameter", "formula"]).optional(),
    })
    .optional(),
  unit: z.string().optional(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  role: z.enum(["public", "private", "interface"]).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DepletionModelSchema = z.object({
  uuid: z.string(),
  resourceType: z.enum(["fuel", "coolant", "battery", "air", "other"]),
  description: z.string().optional(),
  initialQuantity: z.number(),
  consumptionRate: z.number(),
  units: z.string(),
  associatedSystem: z.string().optional(),
  depletionImpact: z.enum(["immediate-failure", "degraded-operation"]).optional(),
  missionTimeSupported: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const TemporalPhaseSchema = z.object({
  uuid: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  state: ComponentStateSchema,
  activeFailureModes: z.array(z.string()).optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema).optional(),
  description: z.string().optional(),
  requiredHumanActions: z.array(z.string()).optional(),
});

export const ComponentTimelineSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  componentId: z.string(),
  description: z.string().optional(),
  phases: z.array(TemporalPhaseSchema),
  depletionModelId: z.string().optional(),
  applicablePlantOperatingStates: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemComponentSchema = z.object({
  ...ComponentSchema.shape,
  instanceProperties: z
    .object({
      position: z.string().optional(),
      serialNumber: z.string().optional(),
      installationDetails: z
        .object({
          dateInstalled: z.string().optional(),
          installedBy: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  isTemplateInstance: z.boolean(),
  templateReference: z.string().optional(),
  parentComponentId: z.string().optional(),
  basicEventIds: z.array(z.string()).optional(),
  failureModeIds: z.array(z.string()).optional(),
  componentBoundary: z.string().optional(),
  boundaryConsistencyWithData: z.string().optional(),
  failureData: z
    .object({
      failureRate: z.number().optional(),
      failureProbability: z.number().optional(),
      timeUnit: z.string().optional(),
      dataSource: z.string().optional(),
      isPartOfCCFGroup: z.boolean().optional(),
      ccfGroupReference: z.string().optional(),
    })
    .optional(),
  quantificationAttributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .optional(),
});

export const TemplateChangeRecordSchema = z.object({
  templateReference: z.string(),
  version: z.string(),
  timestamp: z.string(),
  changes: z.array(z.string()),
  changesPropagated: z.boolean(),
  excludedInstances: z.array(z.string()).optional(),
});

export const TemplatePropagationConfigSchema = z.object({
  autoPropagation: z.boolean(),
  excludedFields: z.array(z.string()).optional(),
  approvalRequired: z.boolean(),
});

export const TemplateInstanceRegistrySchema = z.object({
  uuid: z.string(),
  instancesByTemplate: z.record(z.string(), z.array(z.string())),
  templateVersions: z.record(z.string(), z.string()),
  changeHistory: z.array(TemplateChangeRecordSchema),
  propagationConfig: TemplatePropagationConfigSchema,
});

export const SystemAlignmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemReference: z.string(),
  isNormalAlignment: z.boolean(),
  description: z.string().optional(),
  modeled: z.boolean(),
  justificationIfNotModeled: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const VariableSuccessCriterionSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  plantOperatingStateId: z.string().optional(),
  scenarioCondition: z.string().optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemConfirmationRecordSchema = z.object({
  uuid: z.string(),
  systemReference: z.string().optional(),
  method: z.enum(["DISCUSSIONS", "PLANT_INVESTIGATION", "WALKDOWN", "DESIGN_REVIEW"]),
  date: z.string(),
  personnelRoles: z.array(z.string()),
  findings: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LognormalDistributionSchema = z.object({
  type: z.literal("lognormal"),
  median: z.number(),
  errorFactor: z.number(),
});

export const BetaDistributionSchema = z.object({
  type: z.literal("beta"),
  alpha: z.number(),
  betaParam: z.number(),
});

export const NormalDistributionSchema = z.object({
  type: z.literal("normal"),
  mean: z.number(),
  stdDev: z.number(),
});

export const UniformDistributionSchema = z.object({
  type: z.literal("uniform"),
  lower: z.number(),
  upper: z.number(),
});

export const ExponentialDistributionSchema = z.object({
  type: z.literal("exponential"),
  failureRate: z.number(),
});

export const WeibullDistributionSchema = z.object({
  type: z.literal("weibull"),
  scale: z.number(),
  shape: z.number(),
  location: z.number(),
});

export const GammaDistributionSchema = z.object({
  type: z.literal("gamma"),
  shape: z.number(),
  rate: z.number(),
});

export const LognormalTimeDistributionSchema = z.object({
  type: z.literal("lognormal_time"),
  mean: z.number(),
  stdDev: z.number(),
});

export const FaultTreeDistributionSchema = z.union([
  LognormalDistributionSchema,
  BetaDistributionSchema,
  NormalDistributionSchema,
  UniformDistributionSchema,
  ExponentialDistributionSchema,
  WeibullDistributionSchema,
  GammaDistributionSchema,
  LognormalTimeDistributionSchema,
]);

export const FaultTreeNodeSchema = z.object({
  uuid: z.string(),
  nodeType: FaultTreeNodeTypeSchema,
  name: z.string(),
  description: z.string().optional(),
  inputs: z.array(z.string()).optional(),
  condition: z.string().optional(),
  probability: z.number().optional(),
  basicEventReference: z.string().optional(),
  dataAnalysisBasicEventRef: z.string().optional(),
  usesDataAnalysisReference: z.boolean().optional(),
  humanActionReference: z.string().optional(),
  houseEventValue: z.boolean().optional(),
  transferTreeId: z.string().optional(),
  sourceNodeId: z.string().optional(),
  specialEventValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  initiatingEventRef: z.string().optional(),
  kValue: z.number().optional(),
  probabilityType: FaultTreeNodeProbabilityTypeSchema.optional(),
  eventType: FaultTreeNodeEventTypeSchema.optional(),
  probabilityDistribution: FaultTreeDistributionSchema.optional(),
  bayesianNetworkRef: z
    .object({
      networkId: z.number(),
      nodeId: z.string().optional(),
    })
    .optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const FaultTreeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemReference: z.string(),
  description: z.string(),
  topEventId: z.string(),
  topEventReference: z.string().optional(),
  nodes: z.record(z.string(), FaultTreeNodeSchema),
  minimalCutSets: z.array(z.array(z.string())).optional(),
  topEventProbability: z.number().optional(),
  quantificationSettings: z
    .object({
      method: z.enum(["mincut", "exact", "rare-event", "mcub"]).optional(),
      truncationLimit: z.number().optional(),
      maxOrder: z.number().optional(),
    })
    .optional(),
  assumptions: z.array(z.string()).optional(),
  saphireCompatibility: z
    .object({
      saphireFieldMappings: z.array(z.record(z.string(), z.string())).optional(),
      openPsaFieldMappings: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemLogicModelSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  description: z.string(),
  modelRepresentation: z.string(),
  basicEvents: z.array(SystemBasicEventSchema),
  nonDetailedModelJustification: z.string().optional(),
  logicLoopResolutions: z
    .array(
      z.object({
        loopId: z.string(),
        resolution: z.string(),
      }),
    )
    .optional(),
  nomenclature: z.record(z.string(), z.string()).optional(),
  faultTree: FaultTreeSchema.optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DigitalInstrumentationAndControlSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemReference: z.string(),
  description: z.string(),
  methodology: z.string(),
  assumptions: z.array(z.string()).optional(),
  failureModes: z.array(z.string()).optional(),
  specialConsiderations: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const PassiveSystemsTreatmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemReference: z.string(),
  description: z.string(),
  performanceAnalysisRef: z.string().optional(),
  relevantPhysicalPhenomena: z.array(z.string()).optional(),
  uncertaintyEvaluation: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemDefinitionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().optional(),
  boundaries: z.array(z.string()),
  components: z.record(z.string(), SystemComponentSchema).optional(),
  successCriteriaIds: z.array(SuccessCriteriaIdSchema),
  missionTimeHours: z.number().optional(),
  schematic: z
    .object({
      reference: z.string(),
      description: z.string().optional(),
    })
    .optional(),
  applicablePlantOperatingStates: z.array(z.string()).optional(),
  alignments: z.array(SystemAlignmentSchema).optional(),
  modeledComponentsAndFailures: z.record(
    z.string(),
    z.object({
      failureModes: z.array(z.string()),
      justificationForInclusion: z.string().optional(),
      componentGroup: z.string().optional(),
    }),
  ),
  justificationForExclusionOfComponents: z.array(z.string()).optional(),
  justificationForExclusionOfFailureModes: z.array(z.string()).optional(),
  flowDiversionConsiderations: z.array(z.string()).optional(),
  beneficialFailureTreatment: z.string().optional(),
  functionLossConditions: z.array(z.string()).optional(),
  humanActionsForOperation: z
    .array(
      z.object({
        actionRef: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  testAndMaintenanceProcedures: z.array(z.string()).optional(),
  spatialInformation: z
    .array(
      z.object({
        location: z.string(),
        hazards: z.array(z.string()).optional(),
        components: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  modelAssumptions: z.array(z.string()).optional(),
  operabilityConsiderations: z
    .array(
      z.object({
        component: z.string(),
        calculationRef: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  operatingLimitations: z.array(z.string()).optional(),
  componentOperabilityLimits: z
    .array(
      z.object({
        component: z.string(),
        limit: z.string(),
      }),
    )
    .optional(),
  configurations: z.array(z.string()).optional(),
  operationalHistory: z.array(z.string()).optional(),
  operatingProcedures: z.array(z.string()).optional(),
  temporalBehavior: z.array(ComponentTimelineSchema).optional(),
  informationBasis: z.enum(["as-built-as-operated", "as-designed-as-intended"]),
  preOperationalInformationJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const MinimalCutSetSchema = z.object({
  events: z.array(z.string()),
  order: z.number(),
  eventProbabilities: z.record(z.string(), z.number()),
  probability: z.number(),
  importance: z.number().optional(),
  truncationStatus: z.enum(["included", "truncated"]).optional(),
  truncationJustification: z.string().optional(),
  faultTreeReference: z.string(),
  systemReference: z.string(),
  validationStatus: z
    .object({
      isValidated: z.boolean(),
      validationDate: z.string().optional(),
      validationIssues: z.array(z.string()).optional(),
    })
    .optional(),
});

export const SystemDependencySchema = z.object({
  uuid: z.string(),
  description: z.string().optional(),
  dependentSystem: z.string(),
  supportingSystem: z.string(),
  type: z.string(),
  details: z.string().optional(),
  impact: z.string().optional(),
  crossReactor: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentDependencySchema = z.object({
  uuid: z.string(),
  description: z.string().optional(),
  system: z.string(),
  componentA: z.string(),
  componentB: z.string(),
  type: z.string(),
  details: z.string().optional(),
  impact: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const CommonCauseFailureGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  scope: z.enum(["INTRASYSTEM", "INTERSYSTEM"]),
  affectedComponents: z.array(z.string()),
  affectedSystems: z.array(z.string()),
  modelType: z.string(),
  modelSpecificParameters: z
    .object({
      betaFactorParameters: z
        .object({
          beta: z.number(),
          totalFailureProbability: z.number(),
        })
        .optional(),
      mglParameters: z
        .object({
          beta: z.number(),
          gamma: z.number().optional(),
          delta: z.number().optional(),
          additionalFactors: z.record(z.string(), z.number()).optional(),
          totalFailureProbability: z.number(),
        })
        .optional(),
      alphaFactorParameters: z
        .object({
          alphaFactors: z.record(z.string(), z.number()),
          totalFailureProbability: z.number(),
        })
        .optional(),
      phiFactorParameters: z
        .object({
          phiFactors: z.record(z.string(), z.number()),
          totalFailureProbability: z.number(),
        })
        .optional(),
    })
    .optional(),
  dataAnalysisCCFParameterRef: z.string().optional(),
  members: z
    .object({
      basicEvents: z.array(
        z.object({
          id: z.string(),
          name: z.string().optional(),
        }),
      ),
    })
    .optional(),
  groupSelectionBasis: z.string().optional(),
  defenseMechanisms: z.array(z.string()).optional(),
  sharedCauseFactors: z
    .object({
      hardwareDesign: z.boolean().optional(),
      manufacturer: z.boolean().optional(),
      maintenance: z.boolean().optional(),
      installation: z.boolean().optional(),
      environment: z.boolean().optional(),
      otherFactors: z.array(z.string()).optional(),
    })
    .optional(),
  riskSignificanceJustification: z.string().optional(),
  dataSources: z
    .array(
      z.object({
        reference: z.string(),
        description: z.string(),
        dataType: z.enum(["plant-specific", "generic", "expert-judgment"]),
      }),
    )
    .optional(),
  quantificationMapping: z
    .object({
      openPsaMapping: z
        .object({
          modelType: z.enum(["beta-factor", "MGL", "alpha-factor", "phi-factor"]),
          factorMappings: z.record(z.string(), z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HumanFailureEventIntegrationSchema = z.object({
  uuid: z.string(),
  hfeReference: z.string(),
  system: z.string(),
  taskDescription: z.string(),
  hfeType: z.enum(["PRE_INITIATOR", "POST_INITIATOR"]),
  isTestMaintenance: z.boolean(),
  impact: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const DependencySearchMethodologySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  reference: z.string(),
  dependencyTables: z
    .array(
      z.object({
        tableId: z.string(),
        description: z.string(),
        reference: z.string().optional(),
      }),
    )
    .optional(),
  systemsAnalyzed: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SupportSystemNeedAnalysisSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  analysisReference: z.string(),
  conditionsRepresented: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IsolationTripConditionSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  condition: z.string(),
  modeledIn: z.enum(["SYSTEM_MODEL", "EVENT_SEQUENCE", "EXCLUDED"]),
  exclusionJustification: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModularizationRecordSchema = z.object({
  uuid: z.string(),
  moduleId: z.string(),
  systemReference: z.string(),
  representedComponentIds: z.array(z.string()),
  avoidsMixedRecoveryPotential: z.boolean(),
  avoidsEventsRequiredByOtherSystems: z.boolean(),
  justification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SimultaneousUnavailabilityEventSchema = z.object({
  uuid: z.string(),
  description: z.string(),
  componentIds: z.array(z.string()),
  plannedActivityBasis: z.string(),
  dataAnalysisRef: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemUncertaintyAnalysisSchema = z.object({
  ...BaseUncertaintyAnalysisSchema.shape,
  system: z.string(),
  parameterUncertainties: z.array(
    z.object({
      parameterId: z.string(),
      distributionType: DistributionTypeSchema,
      distributionParameters: z.record(z.string(), z.number()),
      basis: z.string(),
      associatedComponent: z.string().optional(),
    }),
  ),
  ccfUncertainties: z
    .array(
      z.object({
        ccfGroupId: z.string(),
        description: z.string(),
        impact: z.string(),
      }),
    )
    .optional(),
  successCriteriaUncertainties: z
    .array(
      z.object({
        criterionId: z.string(),
        description: z.string(),
        impact: z.string(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemModelEvaluationSchema = z.object({
  uuid: z.string(),
  system: z.string(),
  topEventProbability: z.number().optional(),
  quantitativeResults: z.record(z.string(), z.number()).optional(),
  qualitativeInsights: z.array(z.string()).optional(),
  dominantContributors: z
    .array(
      z.object({
        contributor: z.string(),
        contribution: z.number(),
      }),
    )
    .optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const OverCapacityConsiderationSchema = z.object({
  uuid: z.string(),
  system: z.string(),
  potentialExceedanceScenarios: z.array(z.string()),
  treatment: z.enum(["CONSERVATIVE", "REALISTIC_JUSTIFIED"]),
  justificationForCapability: z.string().optional(),
  supportingDataReferences: z.array(z.string()).optional(),
  impactOnPerformance: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ModelValidationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string(),
  systemReference: z.string(),
  techniques: z.array(z.string()),
  results: z.string(),
  issuesIdentified: z.array(z.string()).optional(),
  issueResolutions: z.array(z.string()).optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemToSafetyFunctionMappingSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  safetyFunctions: z.array(z.string()),
  eventSequences: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const LPSDSystemConfigurationSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  description: z.string(),
  applicablePlantOperatingStates: z.array(z.string()),
  uniqueToLPSD: z.boolean(),
  informationSource: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const ComponentScreeningJustificationSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  componentId: z.string(),
  failureModes: z.array(SyFailureModeTypeSchema).optional(),
  screeningCriterion: z.enum(["a", "b"]),
  quantitativeJustification: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SupportSystemSuccessCriteriaSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  successCriteria: z.string(),
  criteriaType: z.enum(["CONSERVATIVE", "REALISTIC"]),
  supportedSystems: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const EnvironmentalDesignBasisConsiderationSchema = z.object({
  uuid: z.string(),
  systemReference: z.string(),
  components: z.array(z.string()),
  eventSequences: z.array(z.string()),
  environmentalConditions: z.string(),
  dependentFailuresIncluded: z.boolean().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const InitiationActuationSystemSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  systemReference: z.string(),
  description: z.string(),
  detailedModeling: z.boolean(),
  justificationForNonDetailedModeling: z.string().optional(),
  softwareModelingApproach: z.string().optional(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SyDocumentationSchema = z.object({
  processDescription: z.string(),
  systemFunctionsAndBoundaries: z.string(),
  systemSchematicsReferenced: z.string(),
  modeledComponentsAndFailureModes: z.string(),
  screeningAndExclusionJustifications: z.string(),
  successCriteriaRelationship: z.string(),
  alignmentsAndConfigurations: z.string(),
  testAndMaintenanceTreatment: z.string(),
  dependencySearchAndTables: z.string(),
  ccfGroupsAndModels: z.string(),
  humanFailureEventsIncluded: z.string(),
  modularizationAndLogicLoops: z.string(),
  nomenclatureConventions: z.string(),
  digitalICTreatment: z.string(),
  passiveSystemsTreatment: z.string(),
  evaluationResultsSummary: z.string(),
  informationSources: z.string(),
  modelUncertaintySources: z.string(),
  asBuiltLimitations: z.string(),
  praTaskInterfaces: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SystemsAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.SYSTEMS_ANALYSIS).shape,
  praScope: z.string(),
  systemDefinitions: z.array(SystemDefinitionSchema),
  systemToSafetyFunctionMappings: z.array(SystemToSafetyFunctionMappingSchema),
  systemLogicModels: z.array(SystemLogicModelSchema),
  faultTrees: z.array(FaultTreeSchema).optional(),
  systemBasicEvents: z.array(SystemBasicEventSchema).optional(),
  variableSuccessCriteria: z.array(VariableSuccessCriterionSchema).optional(),
  systemConfirmationRecords: z.array(SystemConfirmationRecordSchema).optional(),
  plantRepresentationAccuracy: PlantRepresentationAccuracySchema,
  systemDependencies: z.array(SystemDependencySchema),
  componentDependencies: z.array(ComponentDependencySchema),
  dependencySearchMethodology: DependencySearchMethodologySchema,
  commonCauseFailureGroups: z.array(CommonCauseFailureGroupSchema),
  supportSystemNeedAnalyses: z.array(SupportSystemNeedAnalysisSchema).optional(),
  supportSystemSuccessCriteria: z.array(SupportSystemSuccessCriteriaSchema).optional(),
  humanFailureEventIntegrations: z.array(HumanFailureEventIntegrationSchema),
  isolationTripConditions: z.array(IsolationTripConditionSchema).optional(),
  modularizationRecords: z.array(ModularizationRecordSchema).optional(),
  simultaneousUnavailabilityEvents: z.array(SimultaneousUnavailabilityEventSchema).optional(),
  componentScreeningJustifications: z.array(ComponentScreeningJustificationSchema).optional(),
  lpsdSystemConfigurations: z.array(LPSDSystemConfigurationSchema).optional(),
  environmentalDesignBasisConsiderations: z.array(EnvironmentalDesignBasisConsiderationSchema).optional(),
  initiationActuationSystems: z.array(InitiationActuationSystemSchema).optional(),
  digitalInstrumentationAndControl: z.array(DigitalInstrumentationAndControlSchema).optional(),
  passiveSystemsTreatments: z.array(PassiveSystemsTreatmentSchema).optional(),
  depletionModels: z.array(DepletionModelSchema).optional(),
  overCapacityConsiderations: z.array(OverCapacityConsiderationSchema).optional(),
  modelValidations: z.array(ModelValidationSchema).optional(),
  systemModelEvaluations: z.array(SystemModelEvaluationSchema).optional(),
  uncertaintyAnalyses: z.array(SystemUncertaintyAnalysisSchema).optional(),
  sensitivityStudies: z.array(SensitivityStudySchema).optional(),
  templateInstanceRegistry: TemplateInstanceRegistrySchema.optional(),
  parameters: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        value: z.number(),
        unit: z.string().optional(),
        dataAnalysisParameterRef: z.string().optional(),
      }),
    )
    .optional(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  dataAnalysisReference: z.string().optional(),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: SyDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSyMirrorsType = Expect<Equal<z.infer<typeof SystemsAnalysisSchema>, SystemsAnalysis>>;

import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import {
  IdPatterns,
  ImportanceLevel,
  SensitivityStudy,
  BaseUncertaintyAnalysis,
  SuccessCriteriaId,
} from "../core/shared-patterns";
import { BaseEvent, BasicEvent, TopEvent } from "../core/events";
import { SaphireFieldMapping } from "../integration/SAPHIRE/saphire-annotations";
import {
  BaseDesignInformation,
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePreOperationalAssumptionsDocumentation,
  BasePeerReviewDocumentation,
  BaseTraceabilityDocumentation,
  BaseAssumption,
  PreOperationalAssumption,
} from "../core/documentation";
import { Component, ComponentReference, ComponentTypeReference } from "../core/component";
import { SuccessCriterion, SystemSuccessCriterion } from "../success-criteria/success-criteria-development";
import { DistributionType, ProbabilityModel, ComponentBasicEvent } from "../data-analysis/data-analysis";
import { QuantificationReferenceManager } from "../core/quantification-bridge";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export type SystemReference = string;
export type HumanActionReference = string;
export type PlantOperatingStateReference = string;
export interface PlantOperatingStatesReference {
  states: PlantOperatingStateReference[];
  stateSpecificRequirements?: Record<PlantOperatingStateReference, string>;
}
export interface Assumption {
  statement: string;
  impact?: string;
}
export enum DependencyType {
  FUNCTIONAL = "FUNCTIONAL",
  SPATIAL = "SPATIAL",
  ENVIRONMENTAL = "ENVIRONMENTAL",
  HUMAN = "HUMAN",
  OTHER = "OTHER",
}
export enum FailureModeType {
  FAILURE_TO_START = "FAILURE_TO_START",
  FAILURE_TO_RUN = "FAILURE_TO_RUN",
  COMMON_CAUSE_FAILURE = "COMMON_CAUSE_FAILURE",
  TEST_MAINTENANCE = "TEST_MAINTENANCE",
  HUMAN_ERROR = "HUMAN_ERROR",
  EXTERNAL_EVENT = "EXTERNAL_EVENT",
  OTHER = "OTHER",
}
export type ComponentState = "operational" | "degraded" | "failed" | "recovering" | "maintenance";
export interface SystemBasicEvent extends BasicEvent {
  componentReference?: string;
  failureMode?: FailureModeType | string;
  probability?: number;
  repairModeled?: boolean;
  repairJustification?: string;
  meanTimeToRepair?: number;
  probabilityModel?: ProbabilityModel;
  dataAnalysisBasicEventRef?: string;
  expression?: {
    value?: number;
    parameter?: string;
    formula?: string;
    type?: "constant" | "parameter" | "formula";
  };
  unit?: "bool" | "int" | "float" | "hours" | "hours-1" | "years" | "years-1" | "fit" | "demands" | string;
  attributes?: {
    name: string;
    value: string;
  }[];
  role?: "public" | "private" | "interface";
}
export interface DepletionModel extends Unique {
  resourceType: "fuel" | "coolant" | "battery" | "other";
  description?: string;
  initialQuantity: number;
  consumptionRate: number;
  units: string;
  associatedSystem?: SystemReference;
  depletionImpact?: "immediate-failure" | "degraded-operation";
}
export interface TemporalPhase extends Unique {
  startTime: number;
  endTime: number;
  state: ComponentState;
  activeFailureModes?: (FailureModeType | string)[];
  successCriteria?: string[] | SuccessCriterion[] | SuccessCriteriaId[];
  description?: string;
  requiredHumanActions?: HumanActionReference[];
}
export interface ComponentTimeline extends Unique {
  systemReference: SystemReference;
  componentId: ComponentReference;
  description?: string;
  phases: TemporalPhase[];
  depletionModelId?: string;
  applicablePOSs?: string[];
}
export interface SystemComponent extends Component {
  instanceProperties?: {
    position?: string;
    serialNumber?: string;
    installationDetails?: {
      dateInstalled?: string;
      installedBy?: string;
    };
  };
  isTemplateInstance: boolean;
  templateReference?: ComponentTypeReference;
  parentComponentId?: ComponentReference;
  basicEventIds?: string[];
  failureModeIds?: string[];
  failureData?: {
    failureRate?: number;
    failureProbability?: number;
    timeUnit?: "hours" | "years" | string;
    dataSource?: string;
    isPartOfCCFGroup?: boolean;
    ccfGroupReference?: string;
  };
  quantificationAttributes?: {
    name: string;
    value: string | number | boolean;
  }[];
}
export interface TemplateChangeRecord {
  templateReference: string;
  version: string;
  timestamp: string;
  changes: string[];
  changesPropagated: boolean;
  excludedInstances?: string[];
}
export interface TemplatePropagationConfig {
  autoPropagation: boolean;
  excludedFields?: string[];
  approvalRequired: boolean;
}
export interface TemplateInstanceRegistry extends Unique {
  instancesByTemplate: Record<string, string[]>;
  templateVersions: Record<string, string>;
  changeHistory: TemplateChangeRecord[];
  propagationConfig: TemplatePropagationConfig;
}
export interface SystemDefinition extends Unique, Named {
  description?: string;
  boundaries: string[];
  components?: Record<ComponentReference, SystemComponent>;
  successCriteria: string | SystemSuccessCriterion | SuccessCriteriaId;
  missionTime?: string;
  schematic?: {
    reference: string;
    description?: string;
  };
  plantOperatingStates?: PlantOperatingStatesReference;
  modeledComponentsAndFailures: Record<
    string,
    {
      failureModes: string[];
      justificationForInclusion?: string;
      componentGroup?: string;
    }
  >;
  justificationForExclusionOfComponents?: string[];
  justificationForExclusionOfFailureModes?: string[];
  humanActionsForOperation?: {
    actionRef: HumanActionReference;
    description: string;
  }[];
  testMaintenanceProcedures?: string[];
  testAndMaintenance?: string[];
  spatialInformation?: {
    location: string;
    hazards?: string[];
    components?: string[];
  }[];
  modelAssumptions?: string[];
  operabilityConsiderations?: {
    component: string;
    calculationRef?: string;
    notes?: string;
  }[];
  operatingLimitations?: string[];
  componentOperabilityLimits?: {
    component: string;
    limit: string;
  }[];
  configurations?: string[];
  operationalHistory?: string[];
  operatingProcedures?: string[];
  temporalBehavior?: ComponentTimeline[];
  informationBasis: "as-built-as-operated" | "as-designed-as-intended";
  preOperationalInformationJustification?: string;
}
export interface SystemLogicModel extends Unique {
  systemReference: SystemReference;
  description: string;
  modelRepresentation: string;
  basicEvents: SystemBasicEvent[];
  logicLoopResolutions?: {
    loopId: string;
    resolution: string;
  }[];
  nomenclature?: Record<string, string>;
  faultTree?: FaultTree;
}
export interface DigitalInstrumentationAndControl extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  methodology: string;
  assumptions?: string[];
  failureModes?: string[];
  specialConsiderations?: string[];
}
export interface PassiveSystemsTreatment extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  performanceAnalysisRef?: string;
  uncertaintyAnalysis?: string;
  relevantPhysicalPhenomena?: string[];
  uncertaintyEvaluation?: string;
}
export interface FaultTree extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  topEventId: string;
  topEventReference?: string;
  nodes: Record<string, FaultTreeNode>;
  gates?: Record<
    string,
    {
      id: string;
      name: string;
      description?: string;
      type: string;
      inputs: {
        id: string;
      }[];
      k?: number;
    }
  >;
  components?: {
    id: string;
    name: string;
    description?: string;
  }[];
  minimalCutSets?: string[][];
  topEventProbability?: number;
  quantificationSettings?: {
    method?: "mincut" | "exact" | "rare-event" | "mcub";
    truncationLimit?: number;
    maxOrder?: number;
  };
  assumptions?: string[];
  validateSpecialEvents(): boolean;
  saphireCompatibility?: {
    saphireFieldMappings?: SaphireFieldMapping[];
    openPsaFieldMappings?: Record<string, string>;
  };
  attributes?: {
    name: string;
    value: string;
  }[];
}
export interface MinimalCutSet {
  events: string[];
  order: number;
  eventProbabilities: Record<string, number>;
  probability: number;
  importance?: number;
  truncationStatus?: "included" | "truncated";
  truncationJustification?: string;
  faultTreeReference: string;
  systemReference: SystemReference;
  validationStatus?: {
    isValidated: boolean;
    validationDate?: string;
    validationIssues?: string[];
  };
}
export enum FaultTreeNodeType {
  AND_GATE = "AND_GATE",
  OR_GATE = "OR_GATE",
  NOT_GATE = "NOT_GATE",
  INHIBIT_GATE = "INHIBIT_GATE",
  ATLEAST_GATE = "ATLEAST_GATE",
  BASIC_EVENT = "BASIC_EVENT",
  INTERMEDIATE_EVENT = "INTERMEDIATE_EVENT",
  UNDEVELOPED_EVENT = "UNDEVELOPED_EVENT",
  HOUSE_EVENT = "HOUSE_EVENT",
  TRUE_EVENT = "TRUE_EVENT",
  FALSE_EVENT = "FALSE_EVENT",
  PASS_EVENT = "PASS_EVENT",
  INIT_EVENT = "INIT_EVENT",
  TRANSFER_IN = "TRANSFER_IN",
  TRANSFER_OUT = "TRANSFER_OUT",
}
export type FaultTreeNodeProbabilityType = "constant" | "distribution" | "bayesian_network_link";
export type FaultTreeNodeEventType = "on_demand" | "during_operation";
export interface LognormalDistribution {
  type: "lognormal";
  median: number;
  errorFactor: number;
}
export interface BetaDistribution {
  type: "beta";
  alpha: number;
  betaParam: number;
}
export interface NormalDistribution {
  type: "normal";
  mean: number;
  stdDev: number;
}
export interface UniformDistribution {
  type: "uniform";
  lower: number;
  upper: number;
}
export interface ExponentialDistribution {
  type: "exponential";
  failureRate: number;
}
export interface WeibullDistribution {
  type: "weibull";
  scale: number;
  shape: number;
  location: number;
}
export interface GammaDistribution {
  type: "gamma";
  shape: number;
  rate: number;
}
export interface LognormalTimeDistribution {
  type: "lognormal_time";
  mean: number;
  stdDev: number;
}
export type FaultTreeDistribution =
  | LognormalDistribution
  | BetaDistribution
  | NormalDistribution
  | UniformDistribution
  | ExponentialDistribution
  | WeibullDistribution
  | GammaDistribution
  | LognormalTimeDistribution;
export interface FaultTreeNode extends Unique {
  nodeType: FaultTreeNodeType;
  name: string;
  description?: string;
  inputs?: string[];
  condition?: string;
  probability?: number;
  basicEventReference?: string;
  dataAnalysisBasicEventRef?: string;
  usesDataAnalysisReference?: boolean;
  humanActionReference?: HumanActionReference;
  houseEventValue?: boolean;
  transferTreeId?: string;
  sourceNodeId?: string;
  specialEventValue?: any;
  initiatingEventRef?: string;
  kValue?: number;
  probabilityType?: FaultTreeNodeProbabilityType;
  eventType?: FaultTreeNodeEventType;
  probabilityDistribution?: FaultTreeDistribution;
  bayesianNetworkRef?: {
    networkId: number;
    nodeId?: string;
  };
  position?: {
    x: number;
    y: number;
  };
}
export interface SystemDependency extends Unique {
  description?: string;
  dependentSystem: SystemReference;
  supportingSystem: SystemReference;
  type: DependencyType | string;
  details?: string;
  impact?: string;
}
export interface ComponentDependency extends Unique {
  description?: string;
  system: SystemReference;
  componentA: string;
  componentB: string;
  type: DependencyType | string;
  details?: string;
  impact?: string;
}
export interface CommonCauseFailureGroup extends Unique, Named {
  description: string;
  affectedComponents: string[];
  affectedSystems: SystemReference[];
  modelType: "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR" | string;
  modelParameters?: Record<string, number>;
  totalFailureProbability?: number;
  dataAnalysisCCFParameterRef?: string;
  members?: {
    basicEvents: {
      id: string;
      name?: string;
    }[];
  };
  modelSpecificParameters?: {
    betaFactorParameters?: {
      beta: number;
      totalFailureProbability: number;
    };
    mglParameters?: {
      beta: number;
      gamma?: number;
      delta?: number;
      additionalFactors?: Record<string, number>;
      totalFailureProbability: number;
    };
    alphaFactorParameters?: {
      alphaFactors: Record<string, number>;
      totalFailureProbability: number;
    };
    phiFactorParameters?: {
      phiFactors: Record<string, number>;
      totalFailureProbability: number;
    };
  };
  probabilityModel?: ProbabilityModel;
  factors?: {
    factor: {
      level: number;
      expression: {
        value: number;
      };
    }[];
  };
  defenseMechanisms?: string[];
  sharedCauseFactors?: {
    hardwareDesign?: boolean;
    manufacturer?: boolean;
    maintenance?: boolean;
    installation?: boolean;
    environment?: boolean;
    otherFactors?: string[];
  };
  riskSignificanceJustification?: string;
  dataSources?: {
    reference: string;
    description: string;
    dataType: "plant-specific" | "generic" | "expert-judgment";
  }[];
  quantificationMapping?: {
    openPsaMapping?: {
      modelType: "beta-factor" | "MGL" | "alpha-factor" | "phi-factor";
      factorMappings?: Record<string, string>;
    };
  };
  attributes?: {
    name: string;
    value: string;
  }[];
}
export interface HumanFailureEventIntegration extends Unique {
  hfeReference: HumanActionReference;
  system: SystemReference;
  taskDescription: string;
  isTestMaintenance: boolean;
  impact?: string;
}
export interface DependencySearchMethodology extends Unique, Named {
  description: string;
  reference: string;
  dependencyTables?: {
    tableId: string;
    description: string;
    reference?: string;
  }[];
  systemsAnalyzed: SystemReference[];
}
export interface SystemUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  system: SystemReference;
  parameterUncertainties: {
    parameterId: string;
    distributionType: DistributionType;
    distributionParameters: Record<string, number>;
    basis: string;
    associatedComponent?: string;
  }[];
  ccfUncertainties?: {
    ccfGroupId: string;
    description: string;
    impact: string;
  }[];
  successCriteriaUncertainties?: {
    criterionId: string;
    description: string;
    impact: string;
  }[];
}
export interface SystemModelEvaluation extends Unique {
  system: SystemReference;
  topEventProbability?: number;
  quantitativeResults?: Record<string, number>;
  qualitativeInsights?: string[];
  dominantContributors?: {
    contributor: string;
    contribution: number;
  }[];
}
export interface SystemSensitivityStudy extends SensitivityStudy {
  system: SystemReference;
  parameterChanged: string;
  impactOnSystem: string;
  insights?: string;
}
export interface OverCapacityConsideration extends Unique {
  system: SystemReference;
  potentialExceedanceScenarios: string[];
  justificationForCapability?: string;
  supportingDataReferences?: string[];
  impactOnPerformance?: string;
}
export interface ModelValidation extends Unique, Named {
  description: string;
  systemReference: SystemReference;
  techniques: string[];
  results: string;
  issuesIdentified?: string[];
  issueResolutions?: string[];
}
export interface ProcessDocumentation extends BaseProcessDocumentation {
  systemFunctionDocumentation?: Record<SystemReference, string>;
  systemBoundaryDocumentation?: Record<SystemReference, string>;
  systemSchematicReferences?: Record<
    SystemReference,
    {
      reference: string;
      description: string;
    }
  >;
  equipmentOperabilityDocumentation?: Record<
    string,
    {
      system: SystemReference;
      component: string;
      considerations: string;
      calculationReferences?: string[];
    }
  >;
  operationalHistoryDocumentation?: Record<SystemReference, string[]>;
  successCriteriaDocumentation?: Record<
    SystemReference,
    {
      criteria: string;
      relationshipToEventSequences: string;
    }
  >;
  humanActionsDocumentation?: Record<
    HumanActionReference,
    {
      system: SystemReference;
      description: string;
    }
  >;
  testMaintenanceProceduresDocumentation?: Record<SystemReference, string[]>;
  dependencySearchDocumentation?: {
    methodology: string;
    dependencyTableReferences: string[];
  };
  spatialInformationDocumentation?: Record<
    string,
    {
      location: string;
      systems: SystemReference[];
      components: string[];
      hazards: string[];
    }
  >;
  modelingAssumptionsDocumentation?: Record<SystemReference, string[]>;
  componentsFailureModesDocumentation?: Record<
    SystemReference,
    {
      includedComponents: string[];
      excludedComponents: string[];
      justificationForExclusion: string;
      includedFailureModes: string[];
      excludedFailureModes: string[];
      justificationForFailureModeExclusion: string;
    }
  >;
  modularizationDocumentation?: {
    description: string;
    systems: SystemReference[];
  };
  logicLoopResolutionsDocumentation?: Record<
    string,
    {
      system: SystemReference;
      loopDescription: string;
      resolution: string;
    }
  >;
  evaluationResultsDocumentation?: Record<
    SystemReference,
    {
      topEventProbability: number;
      otherResults: Record<string, string>;
    }
  >;
  sensitivityStudiesDocumentation?: Record<
    SystemReference,
    {
      studyDescription: string;
      results: string;
    }[]
  >;
  informationSourcesDocumentation?: {
    drawings: string[];
    procedures: string[];
    interviews: string[];
    otherSources: string[];
  };
  basicEventsDocumentation?: Record<
    string,
    {
      system: SystemReference;
      description: string;
      moduleReference?: string;
      cutsetReference?: string;
    }
  >;
  nomenclatureDocumentation?: Record<string, string>;
  digitalICDocumentation?: Record<
    SystemReference,
    {
      description: string;
      modelingApproach: string;
      specialConsiderations?: string;
    }
  >;
  passiveSystemsDocumentation?: Record<
    SystemReference,
    {
      description: string;
      uncertaintyEvaluation: string;
    }
  >;
}
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  systemSpecificUncertainties?: Record<
    SystemReference,
    {
      uncertainties: string[];
      impact: string;
    }
  >;
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableSystems?: SystemReference[];
  }[];
  preOperationalAssumptions?: Record<
    SystemReference,
    {
      assumptions: string[];
      impact: string;
    }
  >;
}
export interface SystemsAnalysis extends TechnicalElement<TechnicalElementTypes.SYSTEMS_ANALYSIS> {
  systemDefinitions: Record<SystemReference, SystemDefinition>;
  systemLogicModels: Record<string, SystemLogicModel>;
  systemDependencies: SystemDependency[];
  componentDependencies: ComponentDependency[];
  templateInstanceRegistry?: TemplateInstanceRegistry;
  commonCauseFailureGroups: Record<string, CommonCauseFailureGroup>;
  humanFailureEventIntegrations: HumanFailureEventIntegration[];
  dependencySearchMethodology: DependencySearchMethodology;
  systemModelEvaluations: Record<SystemReference, SystemModelEvaluation>;
  sensitivityStudies: SystemSensitivityStudy[];
  overCapacityConsiderations: OverCapacityConsideration[];
  modelValidations: ModelValidation[];
  digitalInstrumentationAndControl: Record<string, DigitalInstrumentationAndControl>;
  passiveSystemsTreatment: Record<string, PassiveSystemsTreatment>;
  processDocumentation: ProcessDocumentation;
  modelUncertaintyDocumentation: ModelUncertaintyDocumentation;
  uncertaintyAnalysis?: Record<SystemReference, SystemUncertaintyAnalysis>;
  faultTrees?: Record<string, FaultTree>;
  systemBasicEvents?: Record<string, SystemBasicEvent>;
  dataAnalysisReference?: string;
  parameters?: Record<
    string,
    {
      id: string;
      name: string;
      description?: string;
      value: number;
      unit?: string;
      dataAnalysisParameterRef?: string;
    }
  >;
  attributes?: {
    name: string;
    value: string;
  }[];
}
export interface SystemToSafetyFunctionMapping extends Unique {
  systemReference: SystemReference;
  safetyFunctions: string[];
  eventSequences: string[];
}
export interface LPSDSystemConfiguration extends Unique {
  systemReference: SystemReference;
  description: string;
  applicablePOSs: string[];
  uniqueToLPSD: boolean;
  informationSource: string;
}
export interface ComponentScreeningJustification extends Unique {
  systemReference: SystemReference;
  componentId: ComponentReference;
  failureModes?: FailureModeType[];
  screeningCriterion: "a" | "b";
  quantitativeJustification: string;
}
export interface SupportSystemSuccessCriteria extends Unique {
  systemReference: SystemReference;
  successCriteria: string;
  criteriaType: "conservative" | "realistic";
  supportedSystems: SystemReference[];
}
export interface EnvironmentalDesignBasisConsideration extends Unique {
  systemReference: SystemReference;
  components: string[];
  eventSequences: string[];
  environmentalConditions: string;
}
export interface InitiationActuationSystem extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  detailedModeling: boolean;
}

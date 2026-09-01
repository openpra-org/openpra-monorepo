import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { SensitivityStudy, BaseUncertaintyAnalysis, SuccessCriteriaId } from "../core/shared-patterns";
import { BasicEvent, DistributionType } from "../core/events";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption, PlantRepresentationAccuracy } from "../core/documentation";
import { Component, ComponentReference, ComponentTypeReference } from "../core/component";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import {
  FaultTreeDefinition,
  type FaultTreeControlledDataSourceReference,
} from "../modeling/fault-tree";
import type { HumanFailureEventReference } from "../modeling/references";
import type { FaultTreeBasicEventQuantificationBasis } from "../modeling/quantitative-semantics";
import type { WorkbookBayesianNetwork } from "../modeling/workbook-models";

export type SystemReference = string;
export type HumanActionReference = string;
export type PlantOperatingStateReference = string;
export type EventSequenceReference = string;
export type SafetyFunctionReference = string;

export enum DependencyType {
  FUNCTIONAL = "FUNCTIONAL",
  SPATIAL = "SPATIAL",
  ENVIRONMENTAL = "ENVIRONMENTAL",
  PHENOMENOLOGICAL = "PHENOMENOLOGICAL",
  OPERATIONAL = "OPERATIONAL",
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
  code: string;
  componentReference?: ComponentReference;
  failureMode?: FailureModeType | string;
  probability?: number;
  quantificationBasis?: FaultTreeBasicEventQuantificationBasis;
  repairModeled?: boolean;
  repairJustification?: string;
  meanTimeToRepair?: number;
  probabilityModelRef?: string;
  controlledDataSource?: FaultTreeControlledDataSourceReference;
  /** @deprecated Unqualified legacy traceability field. */
  dataAnalysisBasicEventRef?: string;
  attributes?: {
    name: string;
    value: string;
  }[];
  implementsSrs: SRReference[];
}

export interface DepletionModel extends Unique {
  resourceType: "fuel" | "coolant" | "battery" | "air" | "other";
  description?: string;
  initialQuantity: number;
  consumptionRate: number;
  units: string;
  associatedSystem?: SystemReference;
  depletionImpact?: "immediate-failure" | "degraded-operation";
  missionTimeSupported?: boolean;
  implementsSrs: SRReference[];
}

export interface TemporalPhase extends Unique {
  startTime: number;
  endTime: number;
  state: ComponentState;
  activeFailureModes?: (FailureModeType | string)[];
  successCriteriaIds?: SuccessCriteriaId[];
  description?: string;
  requiredHumanActions?: HumanActionReference[];
}

export interface ComponentTimeline extends Unique {
  systemReference: SystemReference;
  componentId: ComponentReference;
  description?: string;
  phases: TemporalPhase[];
  depletionModelId?: string;
  applicablePlantOperatingStates?: PlantOperatingStateReference[];
  implementsSrs: SRReference[];
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
  componentBoundary?: string;
  boundaryConsistencyWithData?: string;
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

export interface SystemAlignment extends Unique, Named {
  systemReference: SystemReference;
  isNormalAlignment: boolean;
  description?: string;
  modeled: boolean;
  justificationIfNotModeled?: string;
  implementsSrs: SRReference[];
}

export interface VariableSuccessCriterion extends Unique {
  systemReference: SystemReference;
  plantOperatingStateId?: PlantOperatingStateReference;
  scenarioCondition?: string;
  successCriteriaIds: SuccessCriteriaId[];
  basis: string;
  implementsSrs: SRReference[];
}

export interface SystemConfirmationRecord extends Unique {
  systemReference?: SystemReference;
  method: "DISCUSSIONS" | "PLANT_INVESTIGATION" | "WALKDOWN" | "DESIGN_REVIEW";
  date: string;
  personnelRoles: string[];
  findings: string;
  implementsSrs: SRReference[];
}

export interface SystemDefinition extends Unique, Named {
  description?: string;
  abbreviation?: string;
  boundaries: string[];
  components?: Record<ComponentReference, SystemComponent>;
  successCriteriaIds: SuccessCriteriaId[];
  successCriterion?: string;
  missionTimeHours?: number;
  schematic?: {
    reference: string;
    description?: string;
  };
  applicablePlantOperatingStates?: PlantOperatingStateReference[];
  alignments?: SystemAlignment[];
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
  flowDiversionConsiderations?: string[];
  beneficialFailureTreatment?: string;
  functionLossConditions?: string[];
  humanActionsForOperation?: {
    actionRef: HumanActionReference;
    description: string;
  }[];
  testAndMaintenanceProcedures?: string[];
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
  implementsSrs: SRReference[];
}

/** @deprecated Recursive SY fault trees are accepted only by the workbook migration preprocessor. */
export type SystemFaultTreeNode =
  | { id: string; type: "OR" | "AND" | "KN"; name: string; k?: number; children: SystemFaultTreeNode[] }
  | { id: string; type: "BE"; basicEventId: string }
  | { id: string; type: "TR"; name: string; transfer: string };

/** @deprecated Accepted only while migrating workbooks saved before the workbook catalogue became canonical. */
export type LegacySystemFaultTreeNode =
  | { id: string; type: "OR" | "AND" | "KN"; name: string; k?: number; children: LegacySystemFaultTreeNode[] }
  | { id: string; type: "BE"; name: string; be: string; mode: string; source: string; prob: string; ccf?: boolean }
  | { id: string; type: "TR"; name: string; transfer: string };

export interface SystemLogicModel extends Unique, FaultTreeDefinition {
  code: string;
  name: string;
  systemReference: SystemReference;
  description: string;
  modelRepresentation: string;
  nonDetailedModelJustification?: string;
  logicLoopResolutions?: {
    loopId: string;
    resolution: string;
  }[];
  nomenclature?: Record<string, string>;
  implementsSrs: SRReference[];
}

export interface DigitalInstrumentationAndControl extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  methodology: string;
  assumptions?: string[];
  failureModes?: string[];
  specialConsiderations?: string[];
  implementsSrs: SRReference[];
}

export interface PassiveSystemsTreatment extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  performanceAnalysisRef?: string;
  relevantPhysicalPhenomena?: string[];
  uncertaintyEvaluation?: string;
  implementsSrs: SRReference[];
}

export interface SystemDependency extends Unique {
  description?: string;
  dependentSystem: SystemReference;
  supportingSystem: SystemReference;
  type: DependencyType | string;
  details?: string;
  impact?: string;
  crossReactor?: boolean;
  implementsSrs: SRReference[];
}

export interface ComponentDependency extends Unique {
  description?: string;
  system: SystemReference;
  componentA: string;
  componentB: string;
  type: DependencyType | string;
  details?: string;
  impact?: string;
  implementsSrs: SRReference[];
}

export interface CommonCauseFailureGroup extends Unique, Named {
  description: string;
  scope: "INTRASYSTEM" | "INTERSYSTEM";
  affectedComponents: string[];
  affectedSystems: SystemReference[];
  modelType: "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR" | string;
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
  dataAnalysisCCFParameterRef?: string;
  members?: {
    basicEvents: {
      id: string;
      name?: string;
    }[];
  };
  groupSelectionBasis?: string;
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
  attributes?: {
    name: string;
    value: string;
  }[];
  implementsSrs: SRReference[];
}

export interface HumanFailureEventIntegration extends Unique {
  hfeReference: HumanActionReference;
  hfeSource?: HumanFailureEventReference;
  system: SystemReference;
  taskDescription: string;
  hfeType: "PRE_INITIATOR" | "POST_INITIATOR";
  isTestMaintenance: boolean;
  impact?: string;
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface SupportSystemNeedAnalysis extends Unique {
  systemReference: SystemReference;
  analysisReference: string;
  conditionsRepresented: string[];
  implementsSrs: SRReference[];
}

export interface IsolationTripCondition extends Unique {
  systemReference: SystemReference;
  condition: string;
  modeledIn: "SYSTEM_MODEL" | "EVENT_SEQUENCE" | "EXCLUDED";
  exclusionJustification?: string;
  implementsSrs: SRReference[];
}

export interface ModularizationRecord extends Unique {
  moduleId: string;
  systemReference: SystemReference;
  representedComponentIds: string[];
  avoidsMixedRecoveryPotential: boolean;
  avoidsEventsRequiredByOtherSystems: boolean;
  justification: string;
  implementsSrs: SRReference[];
}

export interface SimultaneousUnavailabilityEvent extends Unique {
  description: string;
  componentIds: string[];
  plannedActivityBasis: string;
  dataAnalysisRef?: string;
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface OverCapacityConsideration extends Unique {
  system: SystemReference;
  potentialExceedanceScenarios: string[];
  treatment: "CONSERVATIVE" | "REALISTIC_JUSTIFIED";
  justificationForCapability?: string;
  supportingDataReferences?: string[];
  impactOnPerformance?: string;
  implementsSrs: SRReference[];
}

export interface ModelValidation extends Unique, Named {
  description: string;
  systemReference: SystemReference;
  techniques: string[];
  results: string;
  issuesIdentified?: string[];
  issueResolutions?: string[];
  implementsSrs: SRReference[];
}

export interface SystemToSafetyFunctionMapping extends Unique {
  systemReference: SystemReference;
  safetyFunctions: SafetyFunctionReference[];
  eventSequences: EventSequenceReference[];
  implementsSrs: SRReference[];
}

export interface LPSDSystemConfiguration extends Unique {
  systemReference: SystemReference;
  description: string;
  applicablePlantOperatingStates: PlantOperatingStateReference[];
  uniqueToLPSD: boolean;
  informationSource: string;
  implementsSrs: SRReference[];
}

export interface ComponentScreeningJustification extends Unique {
  systemReference: SystemReference;
  componentId: ComponentReference;
  failureModes?: FailureModeType[];
  screeningCriterion: "a" | "b";
  quantitativeJustification: string;
  implementsSrs: SRReference[];
}

export interface SupportSystemSuccessCriteria extends Unique {
  systemReference: SystemReference;
  successCriteria: string;
  criteriaType: "CONSERVATIVE" | "REALISTIC";
  supportedSystems: SystemReference[];
  implementsSrs: SRReference[];
}

export interface EnvironmentalDesignBasisConsideration extends Unique {
  systemReference: SystemReference;
  components: string[];
  eventSequences: EventSequenceReference[];
  environmentalConditions: string;
  dependentFailuresIncluded?: boolean;
  implementsSrs: SRReference[];
}

export interface InitiationActuationSystem extends Unique, Named {
  systemReference: SystemReference;
  description: string;
  detailedModeling: boolean;
  justificationForNonDetailedModeling?: string;
  softwareModelingApproach?: string;
  implementsSrs: SRReference[];
}

export interface SyDocumentation {
  processDescription: string;
  systemFunctionsAndBoundaries: string;
  systemSchematicsReferenced: string;
  modeledComponentsAndFailureModes: string;
  screeningAndExclusionJustifications: string;
  successCriteriaRelationship: string;
  alignmentsAndConfigurations: string;
  testAndMaintenanceTreatment: string;
  dependencySearchAndTables: string;
  ccfGroupsAndModels: string;
  humanFailureEventsIncluded: string;
  modularizationAndLogicLoops: string;
  nomenclatureConventions: string;
  digitalICTreatment: string;
  passiveSystemsTreatment: string;
  evaluationResultsSummary: string;
  informationSources: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface SystemsAnalysis extends TechnicalElement<TechnicalElementTypes.SYSTEMS_ANALYSIS> {
  praScope: string;

  systemDefinitions: SystemDefinition[];
  systemToSafetyFunctionMappings: SystemToSafetyFunctionMapping[];
  systemLogicModels: SystemLogicModel[];
  systemBasicEvents: SystemBasicEvent[];

  variableSuccessCriteria?: VariableSuccessCriterion[];
  systemConfirmationRecords?: SystemConfirmationRecord[];
  plantRepresentationAccuracy: PlantRepresentationAccuracy;

  systemDependencies: SystemDependency[];
  componentDependencies: ComponentDependency[];
  dependencyBayesianNetworks?: WorkbookBayesianNetwork[];
  dependencySearchMethodology: DependencySearchMethodology;
  commonCauseFailureGroups: CommonCauseFailureGroup[];
  supportSystemNeedAnalyses?: SupportSystemNeedAnalysis[];
  supportSystemSuccessCriteria?: SupportSystemSuccessCriteria[];
  humanFailureEventIntegrations: HumanFailureEventIntegration[];

  isolationTripConditions?: IsolationTripCondition[];
  modularizationRecords?: ModularizationRecord[];
  simultaneousUnavailabilityEvents?: SimultaneousUnavailabilityEvent[];
  componentScreeningJustifications?: ComponentScreeningJustification[];
  lpsdSystemConfigurations?: LPSDSystemConfiguration[];
  environmentalDesignBasisConsiderations?: EnvironmentalDesignBasisConsideration[];
  initiationActuationSystems?: InitiationActuationSystem[];
  digitalInstrumentationAndControl?: DigitalInstrumentationAndControl[];
  passiveSystemsTreatments?: PassiveSystemsTreatment[];
  depletionModels?: DepletionModel[];

  overCapacityConsiderations?: OverCapacityConsideration[];
  modelValidations?: ModelValidation[];
  systemModelEvaluations?: SystemModelEvaluation[];
  uncertaintyAnalyses?: SystemUncertaintyAnalysis[];
  sensitivityStudies?: SensitivityStudy[];

  templateInstanceRegistry?: TemplateInstanceRegistry;
  parameters?: {
    id: string;
    name: string;
    description?: string;
    value: number;
    unit?: string;
    dataAnalysisParameterRef?: string;
  }[];
  attributes?: {
    name: string;
    value: string;
  }[];
  dataAnalysisReference?: string;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];

  documentation: SyDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
  // additional-to-example
  exampleDocuments?: ExampleDocumentRef[];
}

export interface ExampleDocumentRef {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export const SY_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "SY-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A4": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A5": { hlr: "A", stages: ["OPERATIONAL"] },
  "SY-A6": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A10": { hlr: "A", stages: ["OPERATIONAL"] },
  "SY-A11": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A12": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A13": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A14": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A15": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A16": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A17": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A18": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A19": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A20": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A21": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A22": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A23": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A24": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A25": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A26": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-A27": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A28": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A29": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A30": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A31": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A32": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-A33": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SY-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B8": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B9": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B10": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "SY-B11": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B12": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B13": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B14": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B15": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B16": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-B17": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "SY-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SY-C3": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
};

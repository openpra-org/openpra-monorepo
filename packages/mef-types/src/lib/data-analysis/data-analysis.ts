import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { BasicEvent, FrequencyUnit } from "../core/events";
import { SystemDefinition, SystemBasicEvent } from "../systems-analysis/systems-analysis";
import { SuccessCriteriaId } from "../core/shared-patterns";
import { SensitivityStudy } from "../core/shared-patterns";
import {
  BaseAssumption,
  PreOperationalAssumption,
  BasePreOperationalAssumptionsDocumentation,
} from "../core/documentation";
import { ComponentReference } from "../core/component";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export type PlantOperatingStateReference = string;
export type ParameterType =
  | "FREQUENCY"
  | "PROBABILITY"
  | "UNAVAILABILITY"
  | "CCF_PARAMETER"
  | "HUMAN_ERROR_PROBABILITY"
  | "OTHER";
export type DetectabilityLevel = "High" | "Medium" | "Low" | "None";
export enum DistributionType {
  EXPONENTIAL = "exponential",
  BINOMIAL = "binomial",
  NORMAL = "normal",
  LOGNORMAL = "lognormal",
  WEIBULL = "weibull",
  POISSON = "poisson",
  UNIFORM = "uniform",
  BETA = "beta",
  GAMMA = "gamma",
  POINT_ESTIMATE = "point_estimate",
}
export interface ProbabilityModel {
  distribution: DistributionType;
  parameters: Record<string, number>;
  source?: "estimated" | "manual" | "default";
  estimationDetails?: {
    dataPointReferences: string[];
    estimationMethod: string;
    estimationDate: string;
    confidence: number;
  };
}
export interface ComponentBasicEvent extends BasicEvent {
  componentTypeReference: string;
  failureMode: string;
  probabilityModel: ProbabilityModel;
  isTemplate: boolean;
  saphireAttributes?: {
    templateUseFlags: {
      componentId: boolean;
      system: boolean;
      train: boolean;
      type: boolean;
      failureMode: boolean;
      location: boolean;
      eventType: boolean;
      description: boolean;
      models: boolean;
      phases: boolean;
      notes: boolean;
      references: boolean;
      categories: boolean[];
    };
    alternateDescriptions?: {
      short?: string;
      long?: string;
      technical?: string;
      graphical?: string;
    };
    componentId?: string;
    train?: string;
    systemId?: string;
    location?: string;
    eventType?: string;
    categories?: string[];
    notes?: string;
    references?: string[];
    phaseApplicability?: Record<string, boolean>;
  };
}
export interface ComponentBasicEventInstance {
  instanceId: string;
  componentReference: string;
  templateReference: string;
  probabilityAdjustments?: Record<string, number>;
  saphireInstanceAttributes?: {
    componentId?: string;
    train?: string;
    systemId?: string;
    location?: string;
  };
}
export interface OperationalDataPoint {
  id: string;
  componentReference: string;
  componentTypeReference: string;
  timestamp: string;
  eventType: "failure" | "repair" | "inspection" | "maintenance";
  operatingHours: number;
  operatingCycles: number;
  failureModeReference?: string;
  measurements?: Record<string, number>;
  description?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
export interface OperationalDataRegistry {
  id: string;
  name: string;
  dataPoints: OperationalDataPoint[];
  dataByComponentType?: Record<string, string[]>;
  dataByFailureMode?: Record<string, string[]>;
}
export interface FailureRateEstimationResult {
  failureModeReference: string;
  componentTypeReference: string;
  estimatedDistribution: DistributionType;
  parameters: Record<string, number>;
  confidenceIntervals?: {
    lower: Record<string, number>;
    upper: Record<string, number>;
  };
  sampleSize: number;
  goodnessOfFit?: {
    method: string;
    value: number;
  };
}
export class FailureRateEstimator {
  estimateFailureRate(
    failureModeRef: string,
    componentTypeRef: string,
    dataRegistry: OperationalDataRegistry,
    method: "maxLikelihood" | "bayesian" = "maxLikelihood",
  ): FailureRateEstimationResult {
    const dataPointIds = dataRegistry.dataByFailureMode?.[failureModeRef] ?? [];
    const dataPoints = dataPointIds
      .map((id) => dataRegistry.dataPoints.find((dp) => dp.id === id))
      .filter((dp) => dp && dp.componentTypeReference === componentTypeRef) as OperationalDataPoint[];
    if (dataPoints.length === 0) {
      throw new Error("Insufficient data for estimation");
    }
    return method === "maxLikelihood" ?
        this.performMaxLikelihoodEstimation(dataPoints, failureModeRef, componentTypeRef)
      : this.performBayesianEstimation(dataPoints, failureModeRef, componentTypeRef);
  }
  private performMaxLikelihoodEstimation(
    dataPoints: OperationalDataPoint[],
    failureModeRef: string,
    componentTypeRef: string,
  ): FailureRateEstimationResult {
    const operatingHours = dataPoints.map((dp) => dp.operatingHours);
    const meanTime = operatingHours.reduce((sum, h) => sum + h, 0) / operatingHours.length;
    return {
      failureModeReference: failureModeRef,
      componentTypeReference: componentTypeRef,
      estimatedDistribution: DistributionType.WEIBULL,
      parameters: {
        shape: 2.0,
        scale: meanTime,
      },
      sampleSize: dataPoints.length,
      goodnessOfFit: {
        method: "Anderson-Darling",
        value: 0.95,
      },
    };
  }
  private performBayesianEstimation(
    dataPoints: OperationalDataPoint[],
    failureModeRef: string,
    componentTypeRef: string,
  ): FailureRateEstimationResult {
    return {
      failureModeReference: failureModeRef,
      componentTypeReference: componentTypeRef,
      estimatedDistribution: DistributionType.WEIBULL,
      parameters: {
        shape: 2.1,
        scale: 10000,
      },
      confidenceIntervals: {
        lower: { shape: 1.8, scale: 9000 },
        upper: { shape: 2.4, scale: 11000 },
      },
      sampleSize: dataPoints.length,
    };
  }
}
export interface FailureModeType extends Unique, Named {
  category: string;
  mechanismOfFailure: string;
  detectability: DetectabilityLevel;
  defaultProbabilityModel?: ProbabilityModel;
}
export interface BaseDataAnalysisParameter extends Unique, Named {
  description?: string;
  parameterType: ParameterType;
  uncertainty?: Uncertainty;
  data_sources?: DataSource[];
  assumptions?: Assumption[];
}
export interface DataSource {
  source: string;
  context?: string;
  notes?: string;
  documentationReferences?: string[];
  sourceType?: "GENERIC_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT";
  timePeriod?: {
    startDate: string;
    endDate: string;
  };
  applicabilityAssessment?: string;
}
export interface Assumption extends BaseAssumption {
  context?: string;
  impactedParameters?: string[];
  closureCriteria?: string;
}
export interface DataAnalysisParameter extends BaseDataAnalysisParameter {
  value: number;
  basicEventId?: string;
  testMaintenanceId?: string;
  systemDefinitionId?: string;
  failureMode?: FailureModeType | string;
  successCriteria?: string | string[] | SuccessCriteriaId;
  plant_operating_state?: PlantOperatingStateReference;
  probability_model?: DistributionType;
  alternatives?: string[];
  componentBoundaries?: {
    systemId: string;
    componentId?: string;
    description: string;
    boundaries: string[];
    includedParts: string[];
    excludedParts?: string[];
  };
  logicModelInfo?: {
    modelType: string;
    basicEventBoundary: string;
    evaluationModel: string;
  };
}
export interface ComponentBoundary extends Unique, Named {
  systemId: string;
  componentId?: ComponentReference;
  description: string;
  boundaries: string[];
  includedItems: string[];
  excludedItems?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
}
export interface BasicEventBoundary extends Unique, Named {
  basicEventId: string;
  description: string;
  includedConditions: string[];
  excludedConditions?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
  systemReference?: string;
}
export interface ExternalDataSource extends Unique, Named {
  sourceType: "INDUSTRY_DATABASE" | "PLANT_RECORDS" | "EXPERT_JUDGMENT" | "OTHER";
  sourceLocation: string;
  timePeriod: {
    start: string;
    end: string;
  };
  accessMethod: string;
  dataFormat: string;
  qualityAssurance?: string;
  limitations?: string[];
  referenceDocumentation: string[];
  validationMethod?: string;
}
export interface DataConsistencyCheck extends Unique {
  parameterId: string;
  dataSourceId: string;
  verificationMethod: string;
  consistencyAssessment: "CONSISTENT" | "INCONSISTENT" | "PARTIALLY_CONSISTENT";
  discrepancies?: string[];
  resolutionActions?: string[];
  verificationDate: string;
  verifierId: string;
}
export interface OutlierComponent extends Unique {
  systemId: string;
  componentId: ComponentReference;
  potentialGroupId: string;
  exclusionReason: string;
  exclusionJustification: string;
  differentiatingCharacteristics: string[];
  alternativeHandling: string;
  referenceDocuments?: string[];
  status: "CONFIRMED" | "TENTATIVE" | "UNDER_REVIEW";
  determinationDate?: string;
  determinedBy?: string;
}
export interface ComponentGrouping extends Unique, Named {
  systemId: string;
  groupId: string;
  componentIds: ComponentReference[];
  designCharacteristics: string[];
  environmentalConditions: string[];
  serviceConditions: string[];
  operationalConditions?: string[];
  groupingJustification: string;
  referenceDocuments?: string[];
  excludedOutliers?: string[];
  outlierIdentificationCriteria?: string[];
}
export interface Uncertainty {
  distribution: DistributionType;
  parameters: Record<string, number>;
  model_uncertainty_sources?: string[];
  riskImplications?: {
    affectedMetrics: string[];
    significanceLevel: "high" | "medium" | "low";
    propagationNotes?: string;
  };
  correlations?: {
    parameterId: string;
    correlationType: "common_cause" | "environmental" | "operational" | "other";
    correlationFactor: number;
    description?: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
}
export interface BayesianUpdate {
  performed: boolean;
  method: string;
  convergence_criteria?: number;
  prior?: {
    distribution: DistributionType;
    parameters: Record<string, number>;
    source?: string;
  };
  posterior?: {
    distribution: DistributionType;
    parameters: Record<string, number>;
  };
  validation?: {
    method: string;
    results: string;
    issues?: string[];
  };
}
export interface FrequencyQuantification {
  operating_state_fraction: number;
  modules_impacted: number;
  total_modules: number;
  generic_data: {
    source: string;
    applicability: string;
    time_period: [Date, Date];
    events: number;
    exposure_time: number;
    exposure_unit: FrequencyUnit;
  };
  plant_specific_data?: {
    events: number;
    exposure_time: number;
    exposure_unit: FrequencyUnit;
    applicability: string;
  };
  bayesian_update?: BayesianUpdate;
  frequency: number;
  frequency_unit: FrequencyUnit;
  distribution: DistributionType;
  distribution_parameters: Record<string, number>;
  uncertainty: Uncertainty;
  sensitivityStudies?: SensitivityStudy[];
}
export interface DataAnalysisDocumentation extends Unique, Named {
  processDescription: string;
  systemComponentBoundaries: {
    systemId: string;
    componentId?: string;
    boundaryDescription: string;
    boundaries: string[];
    references?: string[];
  }[];
  basicEventProbabilityModels: {
    basicEventId: string;
    model: string;
    justification?: string;
  }[];
  genericParameterSources: {
    parameterId: string;
    source: string;
    reference?: string;
  }[];
  plantSpecificDataSources: {
    parameterId: string;
    source: string;
    operatingState?: string;
    timePeriod?: string;
  }[];
  dataCollectionPeriods: {
    parameterId: string;
    startDate: string;
    endDate: string;
    censoringJustification?: string;
  }[];
  dataExclusionJustifications: {
    parameterId: string;
    excludedData: string;
    justification: string;
  }[];
  ccfProbabilityBasis: {
    ccfParameterId: string;
    estimationMethod: string;
    mappingJustification?: string;
  }[];
  bayesianPriorRationales: {
    parameterId: string;
    priorDistribution: string;
    rationale: string;
  }[];
  parameterEstimates: {
    parameterId: string;
    estimate: number;
    uncertaintyCharacterization: string;
  }[];
  operatingStateDataJustifications: {
    parameterId: string;
    operatingState: string;
    justification: string;
  }[];
  genericParameterRationales: {
    parameterId: string;
    operatingStates: string[];
    rationale: string;
  }[];
  componentGroupingDocumentation?: {
    groupId: string;
    groupingCriteria: string;
    outlierIdentificationMethodology: string;
    outlierExclusionJustifications: {
      componentId: string;
      exclusionReason: string;
      detailedJustification: string;
      alternativeTreatment: string;
    }[];
    supportingAnalyses?: string[];
  }[];
}
export interface ModelUncertaintyDocumentation extends Unique, Named {
  uncertaintySources: {
    source: string;
    impact: string;
    applicableParameters?: string[];
  }[];
  relatedAssumptions: {
    assumption: string;
    basis: string;
    applicableParameters?: string[];
  }[];
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableParameters?: string[];
  }[];
  requirementReference: string;
}
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
  relatedRequirement: string;
  relatedNote: string;
}
export interface PeerReviewDocumentation extends Unique, Named {
  reviewDate: string;
  reviewTeam: string[];
  findings: {
    id: string;
    description: string;
    significance: "HIGH" | "MEDIUM" | "LOW";
    associatedRequirements: string[];
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    resolutionPlan?: string;
    resolutionDate?: string;
  }[];
  scope: string;
  methodology: string;
  reportReference: string;
  outlierReview?: {
    outlierIdentificationReviewed: boolean;
    methodologyAssessment: string;
    justificationAssessment: string;
    outlierFindings: {
      componentId: string;
      finding: string;
      recommendation: string;
      status: "ACCEPTED" | "REJECTED" | "UNDER_REVIEW";
    }[];
    overallAssessment: string;
  };
}
export interface ParameterValidationRules {
  componentBoundaryRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };
  parameterConsistencyRules: {
    description: string;
    validationMethod: string;
    consistencyChecks: string[];
  };
  uncertaintyValidationRules: {
    description: string;
    requiredElements: string[];
    validationCriteria: string[];
  };
  dataSourceValidationRules: {
    description: string;
    qualityCriteria: string[];
    applicabilityRequirements: string[];
  };
  outlierValidationRules?: {
    description: string;
    outlierIdentificationCriteria: string[];
    requiredJustificationElements: string[];
    validationChecks: string[];
    reviewProcess: string;
  };
}
export interface DataAnalysisExportImport {
  exportFormat: "JSON" | "CSV" | "XML";
  exportConfig: {
    includeUncertainty: boolean;
    includeDocumentation: boolean;
    includeSourceData: boolean;
  };
  importValidation: {
    requiredFields: string[];
    validationChecks: string[];
    errorHandling: "STRICT" | "LENIENT";
  };
  externalSourceMapping: {
    sourceField: string;
    targetField: string;
    transformation?: string;
  }[];
}
export interface DataAnalysis extends TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS> {
  additionalMetadata?: {
    limitations?: string[];
    assumptions?: string[];
  };
  data_parameters: DataAnalysisParameter[];
  componentGroupings?: ComponentGrouping[];
  outlierComponents?: OutlierComponent[];
  externalDataSources?: ExternalDataSource[];
  dataConsistencyChecks?: DataConsistencyCheck[];
  documentation?: {
    processDocumentation?: DataAnalysisDocumentation;
    modelUncertainty?: ModelUncertaintyDocumentation;
    preOperationalAssumptions?: PreOperationalAssumptionsDocumentation;
    peerReview?: PeerReviewDocumentation;
  };
  validationRules?: ParameterValidationRules;
  exportImportConfig?: DataAnalysisExportImport;
  sensitivityStudies?: SensitivityStudy[];
}
export class DataAnalysisService {
  private basicEvents: Map<string, ComponentBasicEvent> = new Map();
  private failureModes: Map<string, FailureModeType> = new Map();
  private dataRegistry: OperationalDataRegistry | null = null;
  private estimator: FailureRateEstimator = new FailureRateEstimator();
  getComponentBasicEvent(id: string): ComponentBasicEvent {
    const event = this.basicEvents.get(id);
    if (!event) throw new Error(`Basic event ${id} not found`);
    return event;
  }
  createComponentBasicEvent(event: ComponentBasicEvent): string {
    this.basicEvents.set(event.uuid, event);
    return event.uuid;
  }
  getFailureMode(id: string): FailureModeType {
    const mode = this.failureModes.get(id);
    if (!mode) throw new Error(`Failure mode ${id} not found`);
    return mode;
  }
  createFailureMode(mode: FailureModeType): string {
    this.failureModes.set(mode.uuid, mode);
    return mode.uuid;
  }
  setDataRegistry(registry: OperationalDataRegistry): void {
    this.dataRegistry = registry;
  }
  getOperationalDataRegistry(): OperationalDataRegistry {
    if (!this.dataRegistry) throw new Error("No data registry available");
    return this.dataRegistry;
  }
  estimateFailureRate(
    failureModeRef: string,
    componentTypeRef: string,
    method: "maxLikelihood" | "bayesian" = "maxLikelihood",
  ): FailureRateEstimationResult {
    if (!this.dataRegistry) throw new Error("No data registry available");
    return this.estimator.estimateFailureRate(failureModeRef, componentTypeRef, this.dataRegistry, method);
  }
  updateBasicEventWithEstimation(basicEventId: string, estimationResult: FailureRateEstimationResult): void {
    const event = this.getComponentBasicEvent(basicEventId);
    event.probabilityModel = {
      distribution: estimationResult.estimatedDistribution,
      parameters: estimationResult.parameters,
      source: "estimated",
      estimationDetails: {
        dataPointReferences: [],
        estimationMethod: "maxLikelihood",
        estimationDate: new Date().toISOString(),
        confidence: estimationResult.goodnessOfFit?.value || 0.9,
      },
    };
    this.basicEvents.set(basicEventId, event);
  }
}

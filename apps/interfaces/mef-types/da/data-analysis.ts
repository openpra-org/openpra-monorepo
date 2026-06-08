import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { BasicEvent, FrequencyUnit, DistributionType } from "../core/events";
import { SuccessCriteriaId, SensitivityStudy } from "../core/shared-patterns";
import { BaseAssumption, BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { ComponentReference, ComponentTypeReference } from "../core/component";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type SystemReference = string;
export type EventSequenceReference = string;
export type CcfGroupReference = string;

export type ParameterType =
  | "FREQUENCY"
  | "PROBABILITY"
  | "UNAVAILABILITY"
  | "CCF_PARAMETER"
  | "HUMAN_ERROR_PROBABILITY"
  | "OTHER";

export type DetectabilityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface ProbabilityModel {
  distribution: DistributionType;
  parameters: Record<string, number>;
  source?: "ESTIMATED" | "MANUAL" | "DEFAULT";
  estimationDetails?: {
    dataPointReferences: string[];
    estimationMethod: string;
    estimationDate: string;
    sampleSize?: number;
    goodnessOfFit?: {
      method: string;
      value: number;
    };
    confidenceIntervals?: {
      lower: Record<string, number>;
      upper: Record<string, number>;
    };
  };
}

export interface FailureModeType extends Unique, Named {
  category: string;
  mechanismOfFailure: string;
  detectability: DetectabilityLevel;
  defaultProbabilityModel?: ProbabilityModel;
}

export interface ComponentBasicEvent extends BasicEvent {
  componentTypeReference: ComponentTypeReference;
  failureMode: string;
  probabilityModel: ProbabilityModel;
  isTemplate: boolean;
  // solver-specific
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
  implementsSrs: SRReference[];
}

export interface ComponentBasicEventInstance extends Unique {
  componentReference: ComponentReference;
  templateReference: string;
  probabilityAdjustments?: Record<string, number>;
  // solver-specific
  saphireInstanceAttributes?: {
    componentId?: string;
    train?: string;
    systemId?: string;
    location?: string;
  };
  implementsSrs: SRReference[];
}

export interface OperationalDataPoint extends Unique {
  componentReference: ComponentReference;
  componentTypeReference: ComponentTypeReference;
  timestamp: string;
  eventType: "FAILURE" | "REPAIR" | "INSPECTION" | "MAINTENANCE";
  operatingHours: number;
  operatingCycles: number;
  failureModeRef?: string;
  repetitiveProblemGroupId?: string;
  measurements?: Record<string, number>;
  description?: string;
}

export interface OperationalDataRegistry extends Unique, Named {
  dataPoints: OperationalDataPoint[];
}

export interface DataSource {
  source: string;
  context?: string;
  notes?: string;
  documentationReferences?: string[];
  sourceType?: "GENERIC_INDUSTRY" | "PLANT_SPECIFIC" | "EXPERT_JUDGMENT" | "OTHER_FACILITY_EXPERIENCE";
  timePeriod?: {
    startDate: string;
    endDate: string;
  };
  applicabilityAssessment?: string;
}

export interface Uncertainty {
  distribution: DistributionType;
  parameters: Record<string, number>;
  modelUncertaintySources?: string[];
  riskImplications?: {
    affectedMetrics: string[];
    significanceLevel: "HIGH" | "MEDIUM" | "LOW";
    propagationNotes?: string;
  };
  correlations?: {
    parameterId: string;
    correlationType: "COMMON_CAUSE" | "ENVIRONMENTAL" | "OPERATIONAL" | "OTHER";
    correlationFactor: number;
    description?: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
}

export interface BayesianUpdate {
  performed: boolean;
  method: string;
  convergenceCriteria?: number;
  prior?: {
    distribution: DistributionType;
    parameters: Record<string, number>;
    source?: string;
  };
  posterior?: {
    distribution: DistributionType;
    parameters: Record<string, number>;
  };
  posteriorReasonablenessCheck?: {
    evidenceStage: "PLANT_SPECIFIC" | "TECHNOLOGY_SPECIFIC";
    evidenceWeightAssessment: string;
    reasonable: boolean;
    basis: string;
  };
  validation?: {
    method: string;
    results: string;
    issues?: string[];
  };
}

export interface DataAnalysisParameter extends Unique, Named {
  description?: string;
  parameterType: ParameterType;
  value: number;
  valueType: "POINT_ESTIMATE" | "MEAN";
  estimationApproach?:
    | "PLANT_SPECIFIC"
    | "TECHNOLOGY_SPECIFIC"
    | "GENERIC"
    | "REALISTIC_COMBINED"
    | "SIMILAR_EQUIPMENT_ADJUSTED";
  isRiskSignificant?: boolean;
  basicEventRef?: string;
  componentGroupRef?: string;
  systemReference?: SystemReference;
  failureModeRef?: string;
  successCriteriaIds?: SuccessCriteriaId[];
  plantOperatingStateRef?: PlantOperatingStateReference;
  multiPosApplicabilityJustification?: string;
  componentBoundaryRef?: string;
  basicEventBoundaryRef?: string;
  probabilityModel?: ProbabilityModel;
  modelSelectionBasis?: string;
  requiredData?: string;
  genericEvidence?: {
    source: string;
    applicability: string;
    timePeriod?: {
      startDate: string;
      endDate: string;
    };
    events?: number;
    exposureTime?: number;
    exposureUnit?: FrequencyUnit;
  };
  plantSpecificEvidence?: {
    events: number;
    exposureTime: number;
    exposureUnit: FrequencyUnit;
    applicability: string;
  };
  dataExclusionJustifications?: string[];
  bayesianUpdate?: BayesianUpdate;
  similarEquipmentAdjustment?: {
    sourceEquipment: string;
    adjustments: string;
    justification: string;
  };
  uncertainty?: Uncertainty;
  dataSources?: DataSource[];
  assumptions?: BaseAssumption[];
  sensitivityStudies?: SensitivityStudy[];
  implementsSrs: SRReference[];
}

export interface ComponentBoundary extends Unique, Named {
  systemId: SystemReference;
  componentId?: ComponentReference;
  description: string;
  boundaries: string[];
  includedItems: string[];
  excludedItems?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
  implementsSrs: SRReference[];
}

export interface BasicEventBoundary extends Unique, Named {
  basicEventId: string;
  description: string;
  includedConditions: string[];
  excludedConditions?: string[];
  boundaryBasis: string;
  referenceDocuments?: string[];
  systemReference?: SystemReference;
  implementsSrs: SRReference[];
}

export interface ComponentGrouping extends Unique, Named {
  systemId: SystemReference;
  groupId: string;
  componentIds: ComponentReference[];
  groupingBasis: "TYPE_ONLY" | "TYPE_AND_SERVICE_CONDITIONS";
  designCharacteristics: string[];
  environmentalConditions: string[];
  serviceConditions: string[];
  operationalConditions?: string[];
  groupingJustification: string;
  referenceDocuments?: string[];
  excludedOutliers?: string[];
  outlierIdentificationCriteria?: string[];
  implementsSrs: SRReference[];
}

export interface OutlierComponent extends Unique {
  systemId: SystemReference;
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
  implementsSrs: SRReference[];
}

export interface ExternalDataSource extends Unique, Named {
  sourceType: "INDUSTRY_DATABASE" | "PLANT_RECORDS" | "EXPERT_JUDGMENT" | "OTHER_FACILITY_EXPERIENCE" | "OTHER";
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
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface FailureEventClassification extends Unique {
  componentGroupRef?: string;
  failureModeRef?: string;
  failureDefinitionBasis: string;
  degradedStatesCountedAsFailures: string[];
  degradedStatesNotCounted: string[];
  repeatedFailureCountingApplied: boolean;
  basisDocuments?: string[];
  implementsSrs: SRReference[];
}

export interface DemandCountRecord extends Unique {
  componentGroupRef: string;
  plantOperatingStateRef?: PlantOperatingStateReference;
  surveillanceTestDemands?: number;
  maintenanceActDemands?: number;
  operationalDemands?: number;
  additionalDemandSources?: {
    source: string;
    count: number;
  }[];
  totalDemands: number;
  basis: "ANNUALIZED_PLANNED" | "ACTUAL_PRACTICE_RECORDS" | "PREOP_EXPECTED_PERFORMANCE";
  sourceRecords?: string[];
  implementsSrs: SRReference[];
}

export interface ExposureTimeRecord extends Unique {
  componentGroupRef: string;
  plantOperatingStateRef?: PlantOperatingStateReference;
  standbyHours?: number;
  operatingHours?: number;
  basis: "ESTIMATED_FROM_TEST_PRACTICES" | "OPERATIONAL_RECORDS";
  sourceRecords?: string[];
  implementsSrs: SRReference[];
}

export interface TestCredibilityReview extends Unique {
  testProcedureReference: string;
  componentGroupRef?: string;
  failureModesExercised: string[];
  failureModesNotExercised: string[];
  demandCreditingDecision: string;
  implementsSrs: SRReference[];
}

export interface UnavailabilityDataRecord extends Unique {
  componentOrTrainReference: string;
  systemReference?: SystemReference;
  plantOperatingStateRef?: PlantOperatingStateReference;
  contributingActivities: {
    activity: string;
    durationHours: number;
    disablesFunction: boolean;
  }[];
  assignedToSupportSystem?: SystemReference;
  preOperationalGenericJustification?: string;
  preOperationalAssumptionsBasis?: string;
  implementsSrs: SRReference[];
}

export interface CoincidentMaintenanceRecord extends Unique {
  redundantEquipmentIds: string[];
  scope: "INTRASYSTEM" | "INTERSYSTEM";
  plannedActivityDescription: string;
  unavailabilityValue?: number;
  basis: "ACTUAL_PLANT_EXPERIENCE" | "PREOP_ASSUMPTION";
  systemsAnalysisSimultaneousEventRef?: string;
  implementsSrs: SRReference[];
}

export interface RepairTimeRecord extends Unique {
  sscReference: string;
  repairEvents: {
    eventReference?: string;
    identificationToRestorationHours: number;
  }[];
  industryExperienceReferences?: string[];
  preOperationalAssumptionsBasis?: string;
  plantOperatingStateInfluences?: string;
  eventSequenceInfluences?: string;
  implementsSrs: SRReference[];
}

export interface RecoveryTimeRecord extends Unique {
  functionLost: string;
  recoveryEvents: {
    eventReference?: string;
    identificationToRestorationHours: number;
  }[];
  genericSourceReferences?: string[];
  plantOperatingStateInfluences?: string;
  eventSequenceInfluences?: string;
  implementsSrs: SRReference[];
}

export interface LpsdOutageDataRecord extends Unique {
  plantOperatingStateRef?: PlantOperatingStateReference;
  evolutionType?: string;
  outageType: string;
  calendarYear?: number;
  startTime?: string;
  durationHours?: number;
  specialMaintenanceConfigurations?: string[];
  outagesPerCalendarYear?: number;
  posDataLinkBasis?: string;
  implementsSrs: SRReference[];
}

export interface CcfParameterEstimation extends Unique {
  ccfGroupReference: CcfGroupReference;
  modelType: "BETA_FACTOR" | "ALPHA_FACTOR" | "MGL" | "PHI_FACTOR" | "OTHER_EQUIVALENT";
  parameters: Record<string, number>;
  isRiskSignificant?: boolean;
  parameterSource: "GENERIC" | "PLANT_EXPERIENCE_CONSISTENT";
  componentBoundaryConsistencyBasis: string;
  genericExclusionConsistencyConfirmed?: boolean;
  genericExclusionConsistencyBasis?: string;
  dataSources?: DataSource[];
  uncertainty?: Uncertainty;
  implementsSrs: SRReference[];
}

export interface DataModificationAdjustment extends Unique {
  modificationDescription: string;
  affectedParameterIds: string[];
  pastDataDisposition: "ADJUSTED" | "DISCARDED" | "RETAINED_WITH_JUSTIFICATION";
  basis: string;
  implementsSrs: SRReference[];
}

export interface DaDocumentation {
  processDescription: string;
  systemComponentBoundaries: string;
  basicEventProbabilityModels: string;
  genericParameterSources: string;
  plantSpecificDataSourcesAndPeriods: string;
  dataExclusionJustifications: string;
  demandAndExposureCounting: string;
  unavailabilityTreatment: string;
  repairAndRecoveryData: string;
  lpsdOutageData: string;
  componentGroupingAndOutliers: string;
  ccfParameterBasis: string;
  bayesianPriorRationales: string;
  parameterEstimatesWithUncertainty: string;
  multiPosGenericUse: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface DataAnalysis extends TechnicalElement<TechnicalElementTypes.DATA_ANALYSIS> {
  praScope: string;

  parameters: DataAnalysisParameter[];
  componentBasicEvents?: ComponentBasicEvent[];
  componentBasicEventInstances?: ComponentBasicEventInstance[];
  failureModes?: FailureModeType[];

  componentBoundaries: ComponentBoundary[];
  basicEventBoundaries?: BasicEventBoundary[];
  componentGroupings?: ComponentGrouping[];
  outlierComponents?: OutlierComponent[];

  operationalDataRegistries?: OperationalDataRegistry[];
  externalDataSources?: ExternalDataSource[];
  dataConsistencyChecks?: DataConsistencyCheck[];

  failureEventClassifications?: FailureEventClassification[];
  demandCountRecords?: DemandCountRecord[];
  exposureTimeRecords?: ExposureTimeRecord[];
  testCredibilityReviews?: TestCredibilityReview[];
  unavailabilityDataRecords?: UnavailabilityDataRecord[];
  coincidentMaintenanceRecords?: CoincidentMaintenanceRecord[];
  repairTimeRecords?: RepairTimeRecord[];
  recoveryTimeRecords?: RecoveryTimeRecord[];
  lpsdOutageDataRecords?: LpsdOutageDataRecord[];

  ccfParameterEstimations?: CcfParameterEstimation[];
  dataModificationAdjustments?: DataModificationAdjustment[];

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  sensitivityStudies?: SensitivityStudy[];

  documentation: DaDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const DA_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "DA-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-A6": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "DA-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C2": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C3": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C4": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C5": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C6": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C7": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C8": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C9": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C10": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C11": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C12": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C13": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C14": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C15": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C16": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C17": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C18": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C19": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C20": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C21": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C22": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C23": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "DA-C24": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-C25": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-C26": { hlr: "C", stages: ["OPERATIONAL"] },
  "DA-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D4": { hlr: "D", stages: ["OPERATIONAL"] },
  "DA-D5": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
  "DA-D6": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D7": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D8": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D9": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-D10": { hlr: "D", stages: ["OPERATIONAL"] },
  "DA-E1": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "DA-E3": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
};

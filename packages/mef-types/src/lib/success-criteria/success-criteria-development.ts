import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { IdPatterns, ImportanceLevel, SensitivityStudy, SuccessCriteriaId } from "../core/shared-patterns";
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
import { ComponentReference } from "../core/component";
import { EndState, EventSequenceReference } from "../event-sequence-analysis/event-sequence-analysis";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export enum AnalysisType {
  THERMAL_HYDRAULIC = "THERMAL_HYDRAULIC",
  STRUCTURAL = "STRUCTURAL",
  NEUTRONIC = "NEUTRONIC",
  RADIATION_TRANSPORT = "RADIATION_TRANSPORT",
  OTHER = "OTHER",
}
export interface SuccessCriterion extends Unique, Named {
  description?: string;
  criteriaText: string[];
  engineeringBasisReferences: string[];
  plantOperatingStateReferences?: string[];
  initiatingEventReferences?: string[];
  endState?: EndState;
}
export interface OverallSuccessCriterion extends SuccessCriterion {
  eventSequenceFamilyReference: string;
}
export interface SystemSuccessCriterion extends SuccessCriterion {
  systemReference: string;
  requiredCapacity: string;
}
export interface ComponentSuccessCriterion extends SuccessCriterion {
  componentReference: string;
  performanceRequirements: string;
}
export interface OverallSuccessCriteriaDefinition extends Unique {
  eventSequenceReference: EventSequenceReference;
  description: string;
  criteria: string[];
  endStateParameters: Record<string, EndState>;
  keySafetyFunctions: string[];
  radionuclideBarriers: string[];
  engineeringBasisReferences: string[];
  applicablePlantOperatingStates?: string[];
  isRiskSignificant?: boolean;
  usesRealisticCriteria?: boolean;
}
export interface SystemSuccessCriteriaDefinition extends Unique {
  systemId: string;
  description: string;
  requiredCapacities: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  systemDependencies?: {
    dependentSystemId: string;
    dependencyNature: string;
  }[];
  analysisReferences: string[];
  overallSuccessCriteriaId: string;
}
export interface ComponentSuccessCriteriaDefinition extends Unique {
  componentId: ComponentReference;
  description: string;
  requiredPerformance: string;
  systemId: string;
  analysisReferences: string[];
}
export interface HumanActionSuccessCriteriaDefinition extends Unique {
  humanActionId: string;
  description: string;
  timeAvailable: string;
  successCriteria: string;
  procedureReference?: string;
  analysisReferences: string[];
}
export interface SharedResourceDefinition extends Unique, Named {
  description: string;
  sharedBySystems: string[];
  sharedByReactors: string[];
  allocationStrategy: string;
  successCriteriaImpact: string;
  analysisReferences: string[];
}
export interface ConsistencyVerification extends Unique {
  successCriteriaId: SuccessCriteriaId;
  designBasesVerification: {
    isConsistent: boolean;
    description: string;
    references: string[];
  };
  licensingBasesVerification: {
    isConsistent: boolean;
    description: string;
    references: string[];
  };
  operationalPracticesVerification: {
    isConsistent: boolean;
    description: string;
    references: string[];
  };
}
export interface EngineeringAnalysis extends Unique {
  analysisId: string;
  analysisType: AnalysisType;
  description: string;
  computerCode?: string;
  codeVersion?: string;
  validationVerificationBasis?: string;
  analyst?: string;
  applicabilityToPlantConditions: string;
  keyParametersAndResults: Record<string, string>;
  referenceDocuments?: string[];
  limitations?: string[];
  supportedSuccessCriteria: SuccessCriteriaId[];
}
export interface PlantSpecificDesignInformation extends BaseDesignInformation {
  plantSystems: string[];
  operatingConfigurations: string[];
  designParameters: Record<string, string>;
  operatingPhilosophies?: string[];
}
export interface ComputerCodeValidation extends Unique, Named {
  computerCode: string;
  codeVersion: string;
  verificationDocumentation: string;
  experimentalValidation?: {
    experimentDescription: string;
    validationResults: string;
    reference: string;
  }[];
  plantSpecificValidation?: {
    benchmarkDescription: string;
    validationResults: string;
    reference: string;
  }[];
  phenomenaValidation: {
    phenomenonDescription: string;
    validationResults: string;
    reference: string;
  }[];
  limitations: string[];
}
export interface AnalystQualification extends Unique {
  analystName: string;
  qualifications: string[];
  relevantExperience: string;
  codeTraining?: {
    codeName: string;
    trainingDescription: string;
    trainingDate: string;
  }[];
}
export interface ThermalFluidAnalysis extends Unique {
  engineeringAnalysisId: string;
  eventSequencesAnalyzed: string[];
  systemResponsesModeled: string[];
  thermalParametersAnalyzed: string[];
  analysisTimeSpan: string;
  resultsSummary: string;
}
export interface StructuralAnalysis extends Unique {
  engineeringAnalysisId: string;
  structuresAnalyzed: string[];
  loadingConditionsAnalyzed: string[];
  failureModesEvaluated: string[];
  analysisMethods: string[];
  resultsSummary: string;
}
export interface ModelUncertainty extends Unique, Named {
  source: string;
  description: string;
  impactOnSuccessCriteria: string;
  potentialAlternatives?: string[];
  characterizationMethod?: string;
  relatedAssumptions?: string[];
  affectedSuccessCriteria: SuccessCriteriaId[];
}
export interface SuccessCriteriaAssumption extends BaseAssumption {
  affectedSuccessCriteria: SuccessCriteriaId[];
  impactOnSuccessCriteria: string;
}
export interface ExpertJudgment extends Unique {
  topic: string;
  justification: string;
  panelMembers: string[];
  processDescription: string;
  processDocumentationReference: string;
  outcome: string;
  informedSuccessCriteria: SuccessCriteriaId[];
}
export interface SuccessCriteriaSensitivityStudy extends SensitivityStudy {
  evaluatedSuccessCriteria: SuccessCriteriaId[];
  significantAssumptions: string[];
  reasonableAlternatives: string[];
  impactOnDefinitions: string;
}
export interface ProcessDocumentation extends BaseProcessDocumentation {
  endStateDefinitions?: {
    endStateId: EndState;
    definition: string;
    eventSequences: EventSequenceReference[];
    parameters: Record<string, string>;
    parameterBasis: string;
  }[];
  calculationsUsed?: {
    calculationId: string;
    description: string;
    calculationType: "GENERIC" | "PLANT_SPECIFIC";
    references: string[];
    establishedCriteria: string[];
  }[];
  computerCodesUsed?: {
    codeId: string;
    nameAndVersion: string;
    description: string;
    validationReferences: string[];
    establishedCriteria: string[];
  }[];
  calculationLimitations?: {
    limitationId: string;
    description: string;
    affectedItems: string[];
    mitigation?: string;
    impact: string;
  }[];
  expertJudgmentUse?: {
    judgmentId: string;
    topic: string;
    rationale: string;
    impactedCriteria: string[];
  }[];
  mitigatingSystemsCriteria?: {
    systemId: string;
    successCriteria: string;
    technicalBasis: string;
    applicableInitiatingEvents: string[];
  }[];
  humanActionTimingBasis?: {
    actionId: string;
    timeAvailable: string;
    basis: string;
    supportingAnalyses: string[];
  }[];
  groupedEventsCriteria?: {
    groupId: string;
    groupedEvents: string[];
    process: string;
    groupingBasis: string;
    limitations?: string;
  }[];
  digitalSystemsCriteria?: {
    systemId: string;
    criteria: string;
    technicalBasis: string;
    failureModes: string[];
    supportingAnalyses: string[];
  }[];
  passiveSafetyCriteria?: {
    functionId: string;
    description: string;
    criteria: string;
    technicalBasis: string;
    uncertainties: string;
    uncertaintyTreatment: string;
  }[];
  sharedSystemsCriteria?: {
    systemId: string;
    sharedByReactors: string[];
    criteria: string;
    commonInitiatingEvents: string[];
    technicalBasis: string;
  }[];
}
export interface ModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  successCriteriaSpecificUncertainties?: {
    successCriteriaId: SuccessCriteriaId;
    uncertainties: string[];
    impact: string;
  }[];
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableElements?: string[];
  }[];
}
export interface PreOperationalAssumptionsDocumentation extends BasePreOperationalAssumptionsDocumentation {
  successCriteriaSpecificAssumptions?: {
    successCriteriaId: SuccessCriteriaId;
    assumptions: string[];
    impact: string;
    resolutionPlans?: string;
  }[];
}
export interface PeerReviewDocumentation extends BasePeerReviewDocumentation {
  consistencyWithEventSequenceAnalysis?: string;
  consistencyWithSourceTermAnalysis?: string;
  reviewerExperience?: string;
  plantSpecificFeaturesRecognition?: string;
}
export interface SuccessCriteriaDesignInformation extends BaseDesignInformation {
  supportedAspects: {
    systemCapacities?: boolean;
    componentPerformance?: boolean;
    humanActions?: boolean;
    endStateDefinitions?: boolean;
  };
  applicationInSuccessCriteria: string;
  assumptions?: string[];
}
export interface SuccessCriteriaDevelopment
  extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
  additionalMetadata?: {
    limitations?: string[];
    assumptions?: string[];
  };
  overallSuccessCriteria: Record<SuccessCriteriaId, OverallSuccessCriteriaDefinition>;
  systemSuccessCriteria?: Record<string, SystemSuccessCriteriaDefinition>;
  componentSuccessCriteria?: Record<string, ComponentSuccessCriteriaDefinition>;
  humanActionSuccessCriteria?: Record<string, HumanActionSuccessCriteriaDefinition>;
  sharedResources?: Record<string, SharedResourceDefinition>;
  engineeringAnalyses: Record<string, EngineeringAnalysis>;
  plantSpecificDesign?: Record<string, PlantSpecificDesignInformation>;
  computerCodeValidation?: Record<string, ComputerCodeValidation>;
  analystQualifications?: Record<string, AnalystQualification>;
  thermalFluidAnalyses?: Record<string, ThermalFluidAnalysis>;
  structuralAnalyses?: Record<string, StructuralAnalysis>;
  modelUncertainties?: Record<string, ModelUncertainty>;
  preOperationalAssumptions?: Record<string, SuccessCriteriaAssumption>;
  expertJudgments?: Record<string, ExpertJudgment>;
  sensitivityStudies?: Record<string, SuccessCriteriaSensitivityStudy>;
  plantResponseAnalysisReferences?: string[];
  documentation?: {
    processDocumentation?: ProcessDocumentation;
    modelUncertaintyDocumentation?: ModelUncertaintyDocumentation;
    preOperationalAssumptionsDocumentation?: PreOperationalAssumptionsDocumentation;
    peerReviewDocumentation?: PeerReviewDocumentation;
    traceabilityDocumentation?: BaseTraceabilityDocumentation;
  };
  missionTimes?: Record<string, MissionTimeDefinition>;
  componentMissionTimes?: Record<string, ComponentMissionTimeDefinition>;
  consistencyVerifications?: Record<string, ConsistencyVerification>;
}
export interface MissionTimeDefinition extends Unique {
  eventSequenceReference: EventSequenceReference;
  missionTimeHours: number;
  basis: string;
  analysisReferences: string[];
  isRiskSignificant?: boolean;
}
export interface ComponentMissionTimeDefinition extends Unique {
  componentId: ComponentReference;
  missionTimeHours: number;
  eventSequenceReference: EventSequenceReference;
  shorterMissionTimeJustification?: string;
  analysisReferences: string[];
}

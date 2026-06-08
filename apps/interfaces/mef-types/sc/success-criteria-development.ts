import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { ImportanceLevel, SensitivityStudy, SuccessCriteriaId } from "../core/shared-patterns";
import {
  BaseDesignInformation,
  BaseModelUncertaintyDocumentation,
  PreOperationalAssumption,
} from "../core/documentation";
import { ComponentReference } from "../core/component";
import { EndState } from "../core/events";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type InitiatingEventReference = string;
export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type SystemReference = string;
export type HumanActionReference = string;
export type ReleaseCategoryReference = string;
export type SafetyFunctionReference = string;
export type RadionuclideBarrierReference = string;
export type EngineeringAnalysisReference = string;

export enum AnalysisType {
  THERMAL_HYDRAULIC = "THERMAL_HYDRAULIC",
  STRUCTURAL = "STRUCTURAL",
  NEUTRONIC = "NEUTRONIC",
  RADIATION_TRANSPORT = "RADIATION_TRANSPORT",
  OTHER = "OTHER",
}

export interface SafeStableStateDefinition {
  definition: string;
  basis: string;
  implementsSrs: SRReference[];
}

export interface PlantDamageStateCondition {
  pdsId: string;
  physicalConditions: string;
  successCriteriaIds: SuccessCriteriaId[];
}

export interface EndStateDefinition extends Unique {
  endState: EndState;
  definition: string;
  releaseCategoryReferences: ReleaseCategoryReference[];
  determiningParameters: {
    parameter: string;
    criterion: string;
    basis: string;
  }[];
  releaseBelowRiThreshold?: boolean;
  resultingReleaseCategoryId?: ReleaseCategoryReference;
  marginJustification?: string;
  realisticSelectionBasis?: string;
  plantDamageStateConditions?: PlantDamageStateCondition[];
  implementsSrs: SRReference[];
}

export interface SafetyFunctionSuccessCriterion extends Unique {
  safetyFunctionId: SafetyFunctionReference;
  initiatingEventId: InitiatingEventReference;
  plantOperatingStateId: PlantOperatingStateReference;
  criteria: string[];
  engineeringAnalysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface OverallSuccessCriteriaDefinition extends Unique {
  successCriteriaId: SuccessCriteriaId;
  description: string;
  criteria: string[];
  eventSequenceReference?: EventSequenceReference;
  eventSequenceFamilyReference?: EventSequenceFamilyReference;
  endStateDefinitionId?: string;
  keySafetyFunctions: SafetyFunctionReference[];
  radionuclideBarriers: RadionuclideBarrierReference[];
  engineeringAnalysisReferences: EngineeringAnalysisReference[];
  applicablePlantOperatingStates?: PlantOperatingStateReference[];
  applicableInitiatingEvents?: InitiatingEventReference[];
  isRiskSignificant: boolean;
  usesRealisticCriteria?: boolean;
  genericAnalysisBasis?: string;
  implementsSrs: SRReference[];
}

export interface SystemSuccessCriteriaDefinition extends Unique {
  systemId: SystemReference;
  description: string;
  requiredCapacities: {
    parameter: string;
    value: string;
    basis: string;
  }[];
  systemDependencies?: {
    dependentSystemId: SystemReference;
    dependencyNature: string;
  }[];
  analysisReferences: EngineeringAnalysisReference[];
  overallSuccessCriteriaId: string;
  implementsSrs: SRReference[];
}

export interface ComponentSuccessCriteriaDefinition extends Unique {
  componentId: ComponentReference;
  description: string;
  requiredPerformance: string;
  systemId: SystemReference;
  analysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface HumanActionSuccessCriteriaDefinition extends Unique {
  humanActionId: HumanActionReference;
  description: string;
  timeAvailable: string;
  successCriteria: string;
  procedureReference?: string;
  analysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface RadionuclideBarrierCriterion extends Unique {
  barrierId: RadionuclideBarrierReference;
  protectionParameters: {
    parameter: string;
    criterion: string;
    basis: string;
  }[];
  challengeLoads: {
    eventSequenceReference?: EventSequenceReference;
    loadDescription: string;
    physicalAttributes: string[];
  }[];
  capacityParameters: string[];
  effectivenessEvaluationMethod: "CONSERVATIVE" | "REALISTIC";
  uncertaintyAssessment?: string;
  engineeringAnalysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface PassiveSafetyFunctionCriterion extends Unique, Named {
  safetyFunctionId: SafetyFunctionReference;
  passivePhenomena: string[];
  mechanisticModelDescription: string;
  empiricalDataReferences: string[];
  modelUncertaintyCharacterization: string;
  inputDataUncertaintyCharacterization: string;
  passiveFunctionalReliabilityBasis: string;
  engineeringAnalysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface SharedResourceDefinition extends Unique, Named {
  description: string;
  sharedBySystems: SystemReference[];
  sharedByReactors: string[];
  commonInitiatingEventReferences: InitiatingEventReference[];
  allocationStrategy: string;
  successCriteriaImpact: string;
  analysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
}

export interface MissionTimeDefinition extends Unique {
  eventSequenceReference: EventSequenceReference;
  missionTimeHours: number;
  basis: string;
  safeStableStateAchievedWithinMissionTime: boolean;
  treatmentWhenNotAchieved?: "CONSERVATIVE_END_STATE" | "EXTENDED_MISSION_TIME" | "ADDITIONAL_EVALUATION";
  treatmentJustification?: string;
  analysisReferences: EngineeringAnalysisReference[];
  isRiskSignificant?: boolean;
  implementsSrs: SRReference[];
}

export interface ComponentMissionTimeDefinition extends Unique {
  componentId: ComponentReference;
  missionTimeHours: number;
  eventSequenceReference: EventSequenceReference;
  shorterMissionTimeJustification?: string;
  analysisReferences: EngineeringAnalysisReference[];
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface AnalysisDetailConsistency {
  consistentWithInitiatingEventGrouping: boolean;
  consistentWithPlantOperatingStateDefinition: boolean;
  consistentWithEventSequenceModeling: boolean;
  basis: string;
  implementsSrs: SRReference[];
}

export interface EngineeringAnalysis extends Unique {
  analysisId: EngineeringAnalysisReference;
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
  reasonablenessReview?: {
    performed: boolean;
    method: string;
    conclusion: string;
  };
  supportedSuccessCriteria: SuccessCriteriaId[];
  implementsSrs: SRReference[];
}

export interface ThermalFluidAnalysis extends Unique {
  engineeringAnalysisId: EngineeringAnalysisReference;
  eventSequencesAnalyzed: EventSequenceReference[];
  systemResponsesModeled: string[];
  thermalParametersAnalyzed: string[];
  analysisTimeSpan: string;
  resultsSummary: string;
  implementsSrs: SRReference[];
}

export interface StructuralAnalysis extends Unique {
  engineeringAnalysisId: EngineeringAnalysisReference;
  structuresAnalyzed: string[];
  loadingConditionsAnalyzed: string[];
  failureModesEvaluated: string[];
  analysisMethods: string[];
  resultsSummary: string;
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
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
  implementsSrs: SRReference[];
}

export interface PlantSpecificDesignInformation extends BaseDesignInformation {
  plantSystems: SystemReference[];
  operatingConfigurations: string[];
  designParameters: Record<string, string>;
  operatingPhilosophies?: string[];
}

export interface ExpertJudgment extends Unique {
  topic: string;
  justification: string;
  panelMembers: string[];
  processDescription: string;
  processDocumentationReference: string;
  outcome: string;
  informedSuccessCriteria: SuccessCriteriaId[];
  implementsSrs: SRReference[];
}

export interface ScDocumentation {
  processDescription: string;
  endStateDefinitionsBasis: string;
  successCriteriaPerFunctionEventState: string;
  missionTimesBasis: string;
  calculationsAndCodesUsed: string;
  codeValidationAndLimitations: string;
  expertJudgmentUse: string;
  sharedSystemsTreatment: string;
  passiveSafetyTreatment: string;
  consistencyWithPlantDesign: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface SuccessCriteriaDevelopment
  extends TechnicalElement<TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT> {
  praScope: string;

  safeStableStateDefinition: SafeStableStateDefinition;
  endStateDefinitions: EndStateDefinition[];

  safetyFunctionSuccessCriteria: SafetyFunctionSuccessCriterion[];
  overallSuccessCriteria: OverallSuccessCriteriaDefinition[];
  systemSuccessCriteria?: SystemSuccessCriteriaDefinition[];
  componentSuccessCriteria?: ComponentSuccessCriteriaDefinition[];
  humanActionSuccessCriteria?: HumanActionSuccessCriteriaDefinition[];

  radionuclideBarrierCriteria: RadionuclideBarrierCriterion[];
  passiveSafetyFunctionCriteria?: PassiveSafetyFunctionCriterion[];
  sharedResources?: SharedResourceDefinition[];

  missionTimes: MissionTimeDefinition[];
  componentMissionTimes?: ComponentMissionTimeDefinition[];

  engineeringAnalyses: EngineeringAnalysis[];
  thermalFluidAnalyses?: ThermalFluidAnalysis[];
  structuralAnalyses?: StructuralAnalysis[];
  computerCodeValidations?: ComputerCodeValidation[];
  analystQualifications?: AnalystQualification[];
  plantSpecificDesign?: PlantSpecificDesignInformation[];
  expertJudgments?: ExpertJudgment[];

  analysisDetailConsistency: AnalysisDetailConsistency;
  consistencyVerifications?: ConsistencyVerification[];

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  sensitivityStudies?: SensitivityStudy[];

  documentation: ScDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const SC_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "SC-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-A11": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "SC-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B8": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B9": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-B10": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "SC-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "SC-C3": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
};
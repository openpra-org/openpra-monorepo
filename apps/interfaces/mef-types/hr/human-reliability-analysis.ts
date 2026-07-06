import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { SensitivityStudy, SuccessCriteriaId } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption, PlantRepresentationAccuracy } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type PlantOperatingStateReference = string;
export type InitiatingEventReference = string;
export type EventSequenceReference = string;
export type SystemReference = string;
export type ComponentReference = string;
export type FaultTreeReference = string;

export type HfeTiming = "PRE_INITIATOR" | "AT_INITIATOR" | "POST_INITIATOR";

export type HfeImpactLevel = "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT";

export type DependenceLevel = "ZERO" | "LOW" | "MODERATE" | "HIGH" | "COMPLETE";

export interface RoutineActivityIdentification extends Unique, Named {
  activityType: "REALIGNMENT" | "CALIBRATION";
  description: string;
  identificationSources: ("PROCEDURES" | "PLANT_PRACTICES" | "INDUSTRY_EXPERIENCE" | "DESIGN_ENGINEER_INTERVIEW")[];
  affectedSystems: SystemReference[];
  affectedComponents?: ComponentReference[];
  applicablePlantOperatingStates: PlantOperatingStateReference[];
  affectsMultipleTrainsOrDiverseSystems: boolean;
  multiTrainMechanism?: string;
  preOperationalIdentificationProcess?: string;
  implementsSrs: SRReference[];
}

export interface PreInitiatorScreeningRecord extends Unique {
  activityId: string;
  screenedOut: boolean;
  criterion?: "SCR-3";
  justification: string;
  applicableStatesVerified: boolean;
  multiStateAdministrativeDetectionJustification?: string;
  multiTrainProhibitionRespected: boolean;
  implementsSrs: SRReference[];
}

export interface SupportSystemInitiatorOperatorContribution extends Unique {
  systemReference: SystemReference;
  faultTreeReference?: FaultTreeReference;
  included: boolean;
  exclusionBasis?: string;
  implementsSrs: SRReference[];
}

export interface CueTimingBySequence {
  eventSequenceId: EventSequenceReference;
  plantOperatingStateId?: PlantOperatingStateReference;
  cueTimeMinutes?: number;
  timeWindowMinutes?: number;
  basis?: string;
}

export interface HumanFailureEvent extends Unique, Named {
  hfeTiming: HfeTiming;
  description: string;
  impactLevel: HfeImpactLevel;
  affectedSystems: SystemReference[];
  affectedComponents?: ComponentReference[];
  applicablePlantOperatingStates: PlantOperatingStateReference[];
  applicableInitiatingEvents?: InitiatingEventReference[];
  applicableEventSequences?: EventSequenceReference[];
  preInitiatorDetail?: {
    sourceActivityId: string;
    averageTimeToDetectionHours?: number;
    detectionBasis: string;
    unavailabilityModes: string[];
    miscalibrationImpactIncluded: boolean;
  };
  responseDetail?: {
    requiredResponse: string;
    responseType: "INITIATE" | "OPERATE" | "CONTROL" | "ISOLATE" | "TERMINATE" | "AGGRAVATING_ACTION";
    successCriteriaIds: SuccessCriteriaId[];
    procedureReferences: string[];
    cueDescription: string;
    cueTimingBySequence?: CueTimingBySequence[];
  };
  groupedResponses?: string[];
  groupingJustification?: string;
  crossPosGroupingBasis?: "BOUNDED" | "EQUIVALENT_BOUNDARY_CONDITIONS";
  implementsSrs: SRReference[];
}

export interface ResponseIdentificationReview extends Unique {
  reviewScope:
    | "EMERGENCY_AND_ABNORMAL_PROCEDURES"
    | "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH"
    | "OPERATIONAL_EVENTS"
    | "TRAINING_MATERIALS"
    | "SIMILAR_FACILITY_EXPERIENCE"
    | "NONNUCLEAR_FACILITY_EXPERIENCE";
  sourcesReviewed: string[];
  date?: string;
  findings: string;
  identifiedHfeIds: string[];
  implementsSrs: SRReference[];
}

export interface HumanResponseConfirmation extends Unique {
  hfeIds: string[];
  method: "PERSONNEL_REVIEW" | "TALK_THROUGH" | "SIMULATION_OBSERVATION";
  personnelRoles: string[];
  date: string;
  findings: string;
  interpretationConsistent: boolean;
  implementsSrs: SRReference[];
}

export interface PerformanceShapingFactorAssessment {
  factor: string;
  evaluation: string;
  impactOnHep: "INCREASE" | "DECREASE" | "NEUTRAL";
}

export interface HepQuantification extends Unique {
  hfeId: string;
  methodology: string;
  assessmentType: "CONSERVATIVE_ESTIMATE" | "DETAILED_ASSESSMENT";
  isRiskSignificant: boolean;
  pointEstimateHep?: number;
  meanHep?: number;
  cognitionContribution?: number;
  executionContribution?: number;
  performanceShapingFactors?: PerformanceShapingFactorAssessment[];
  indicationsTreatment?: "ASSUMED_AVAILABLE" | "EVALUATED_PER_SEQUENCE";
  timeAvailableMinutes?: number;
  timeAvailableBasis?: "GENERIC_STUDY" | "REALISTIC_PLANT_SPECIFIC_ANALYSIS";
  cueArrivalTimeMinutes?: number;
  timeRequiredMinutes?: number;
  timeRequiredBasis?: "ESTIMATED" | "MEASURED_TALK_THROUGH" | "MEASURED_SIMULATOR";
  plantSpecificInformationUsed?: string[];
  uncertaintyCharacterization?: {
    riskSignificant: boolean;
    method: string;
    probabilisticRepresentationProvided: boolean;
  };
  implementsSrs: SRReference[];
}

export interface PreInitiatorRecoveryCredit extends Unique {
  hfeId: string;
  recoveryFactorsMethodologyConsistent: boolean;
  maximumCreditSpecified: number;
  creditBases?: ("POST_MAINTENANCE_TEST" | "INDEPENDENT_VERIFICATION" | "WORK_SUPERVISION_CHECK" | "OPERATOR_ROUNDS")[];
  implementsSrs: SRReference[];
}

export interface JointHepFloor extends Unique {
  minimumJointProbability: number;
  justification: string;
  implementsSrs: SRReference[];
}

export interface HfeDependencyAssessment extends Unique {
  scope: "PRE_INITIATOR_SET" | "WITHIN_SEQUENCE";
  hfeIds: string[];
  plantOperatingStateId?: PlantOperatingStateReference;
  eventSequenceId?: EventSequenceReference;
  commonElements: string[];
  dependenceLevel: DependenceLevel;
  jointHep: number;
  belowFloor?: boolean;
  floorAppliedOrJustification?: string;
  includesRecoveryHfe?: boolean;
  includesInitiatorCausingHfe?: boolean;
  prePostDependenceFactorsIdentified?: string[];
  implementsSrs: SRReference[];
}

export interface HepConsistencyReview extends Unique {
  hfeIdsReviewed: string[];
  relativeReasonablenessConfirmed: boolean;
  basis: "PLANT_HISTORY_PROCEDURES_OPERATIONS" | "SIMILAR_PLANT_AND_SCENARIO_CONTEXT";
  findings: string;
  implementsSrs: SRReference[];
}

export interface RecoveryAction extends Unique, Named {
  hfeId: string;
  appliedAtLevel: "CUTSET" | "SCENARIO" | "SEQUENCE";
  restoredFunction: string;
  appliedToSequenceIds?: EventSequenceReference[];
  feasibility: {
    procedureOrGuidanceAvailable: boolean;
    trainingIncluded: boolean;
    omissionJustification?: string;
    cuesAvailable: boolean;
    manpowerAvailable: boolean;
    timeAvailable: boolean;
    accessibilityConfirmed: boolean;
    equipmentAvailable: boolean;
  };
  preOperationalFeasibilityJustification?: string;
  hepQuantificationId: string;
  dependencyAssessmentId?: string;
  implementsSrs: SRReference[];
}

export interface ErrorForcingContext extends Unique {
  hfeId: string;
  unsafeAction: string;
  plantConditions: string[];
  performanceShapingFactors: string[];
  vulnerability: string;
  searchMethod?: string;
  implementsSrs: SRReference[];
}

export interface HrDocumentation {
  processDescription: string;
  preInitiatorIdentificationProcess: string;
  screeningCriteriaAndResults: string;
  hfeDefinitions: string;
  responseIdentificationReviews: string;
  confirmationActivities: string;
  hepMethodologies: string;
  performanceShapingFactorTreatment: string;
  timingAnalysisBases: string;
  dependenceTreatmentAndJointFloor: string;
  recoveryActionFeasibilityAndCredit: string;
  consistencyReviewResults: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface HumanReliabilityAnalysis
  extends TechnicalElement<TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS> {
  praScope: string;

  routineActivities: RoutineActivityIdentification[];
  preInitiatorScreeningRecords: PreInitiatorScreeningRecord[];
  supportSystemInitiatorOperatorContributions?: SupportSystemInitiatorOperatorContribution[];

  humanFailureEvents: HumanFailureEvent[];
  responseIdentificationReviews: ResponseIdentificationReview[];
  responseConfirmations?: HumanResponseConfirmation[];

  hepQuantifications: HepQuantification[];
  preInitiatorRecoveryCredits?: PreInitiatorRecoveryCredit[];
  jointHepFloor: JointHepFloor;
  dependencyAssessments: HfeDependencyAssessment[];
  hepConsistencyReviews?: HepConsistencyReview[];
  errorForcingContexts?: ErrorForcingContext[];

  recoveryActions?: RecoveryAction[];

  plantRepresentationAccuracy: PlantRepresentationAccuracy;
  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  sensitivityStudies?: SensitivityStudy[];

  documentation: HrDocumentation;

  configurationControlRecordId?: string;
  exampleDocuments?: ExampleDocumentRef[];
  newlyDevelopedMethodIds?: string[];
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

export const HR_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "HR-A1": { hlr: "A", stages: ["OPERATIONAL"] },
  "HR-A2": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "HR-A3": { hlr: "A", stages: ["OPERATIONAL"] },
  "HR-A4": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "HR-A5": { hlr: "A", stages: ["OPERATIONAL"] },
  "HR-A6": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "HR-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-A8": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "HR-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-A10": { hlr: "A", stages: ["PRE_OPERATIONAL"] },
  "HR-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-C3": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "HR-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-C5": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-C6": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "HR-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D3": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
  "HR-D4": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D5": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D6": { hlr: "D", stages: ["OPERATIONAL"] },
  "HR-D7": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D8": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D9": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-D10": { hlr: "D", stages: ["PRE_OPERATIONAL"] },
  "HR-E1": { hlr: "E", stages: ["OPERATIONAL"] },
  "HR-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-E3": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
  "HR-E4": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-E5": { hlr: "E", stages: ["OPERATIONAL"] },
  "HR-E6": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
  "HR-E7": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-E8": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-E9": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
  "HR-F1": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-F2": { hlr: "F", stages: ["PRE_OPERATIONAL"] },
  "HR-F3": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-F4": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-F5": { hlr: "F", stages: ["PRE_OPERATIONAL"] },
  "HR-G1": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G2": { hlr: "G", stages: ["PRE_OPERATIONAL"] },
  "HR-G3": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G4": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G5": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G6": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G7": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G8": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G9": { hlr: "G", stages: ["OPERATIONAL"] },
  "HR-G10": { hlr: "G", stages: ["PRE_OPERATIONAL"] },
  "HR-G11": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G12": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G13": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G14": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G15": { hlr: "G", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-G16": { hlr: "G", stages: ["PRE_OPERATIONAL"] },
  "HR-H1": { hlr: "H", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-H2": { hlr: "H", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-H3": { hlr: "H", stages: ["PRE_OPERATIONAL"] },
  "HR-H4": { hlr: "H", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-H5": { hlr: "H", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-H6": { hlr: "H", stages: ["PRE_OPERATIONAL"] },
  "HR-I1": { hlr: "I", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-I2": { hlr: "I", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "HR-I3": { hlr: "I", stages: ["PRE_OPERATIONAL"] },
};

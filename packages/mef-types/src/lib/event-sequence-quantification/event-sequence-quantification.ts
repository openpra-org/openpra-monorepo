import { BarrierStatus } from "../plant-operating-states-analysis/plant-operating-states-analysis";
export { BarrierStatus };
import { Named, Unique } from "../core/meta";
import { BaseEvent, InitiatingEvent, FrequencyUnit } from "../core/events";
import { Uncertainty, DistributionType, BayesianUpdate } from "../data-analysis/data-analysis";
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { EventSequence, EventSequenceFamily, DependencyType } from "../event-sequence-analysis/event-sequence-analysis";
import {
  ImportanceLevel,
  ScreeningStatus,
  ScreeningCriteria,
  SensitivityStudy,
  BaseUncertaintyAnalysis,
} from "../core/shared-patterns";
import { BaseAssumption as Assumption } from "../core/documentation";
import {
  BaseTraceabilityDocumentation,
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePreOperationalAssumptionsDocumentation,
  BasePeerReviewDocumentation,
} from "../core/documentation";
interface FrequencyQuantification {
  value: number;
  unit: string;
}
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export const validateEventSequenceQuantification = {
  validateFamilyConsistency: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    Object.entries(analysis.eventSequenceFamilies).forEach(([familyId, family]) => {
      for (const sequenceId of family.memberSequenceIds) {
        const sequenceInResults = Object.values(analysis.quantificationResults).some(
          (result) => result.sequenceId === sequenceId && result.sequenceType === "INDIVIDUAL",
        );
        if (!sequenceInResults) {
          errors.push(`Family ${familyId} references sequence ${sequenceId} that is not quantified in results`);
        }
      }
      if (!family.memberSequenceIds.includes(family.representativeSequenceId)) {
        errors.push(`Representative sequence ${family.representativeSequenceId} is not a member of family ${familyId}`);
      }
    });
    return errors;
  },
  validateDependencyTreatment: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    const requiredDependencyTypes = ["FUNCTIONAL", "PHYSICAL", "HUMAN"];
    for (const depType of requiredDependencyTypes) {
      if (!analysis.dependencyTreatment.dependenciesByType[depType as DependencyType]) {
        errors.push(`Required dependency type ${depType} is not addressed in the analysis`);
      }
    }
    return errors;
  },
  validateConvergence: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    const { truncation } = analysis.quantificationMethods;
    if (truncation.truncationProgression.length < 3) {
      errors.push(`Truncation progression needs at least 3 values to demonstrate convergence`);
    }
    for (let i = 1; i < truncation.truncationProgression.length; i++) {
      if (truncation.truncationProgression[i] >= truncation.truncationProgression[i - 1]) {
        errors.push(`Truncation values must be in decreasing order`);
        break;
      }
    }
    return errors;
  },
  validateUncertaintyAnalysis: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    if (
      (analysis.uncertaintyAnalysis.propagationMethod === "MONTE_CARLO" ||
        analysis.uncertaintyAnalysis.propagationMethod === "LATIN_HYPERCUBE") &&
      (!analysis.uncertaintyAnalysis.numberOfSamples || analysis.uncertaintyAnalysis.numberOfSamples < 1000)
    ) {
      errors.push(`Simulation-based uncertainty propagation requires at least 1000 samples`);
    }
    const unquantifiedUncertainties = analysis.uncertaintyAnalysis.modelUncertainties.filter((u) => !u.isQuantified);
    if (
      unquantifiedUncertainties.length > 0 &&
      (!analysis.uncertaintyAnalysis.sensitivityStudies || analysis.uncertaintyAnalysis.sensitivityStudies.length === 0)
    ) {
      errors.push(`Unquantified uncertainties must be addressed via sensitivity studies`);
    }
    const { stateOfKnowledgeCorrelation } = analysis.uncertaintyAnalysis;
    if (!stateOfKnowledgeCorrelation.isConsidered && !stateOfKnowledgeCorrelation.justificationIfNotConsidered) {
      errors.push(`If state-of-knowledge correlation is not considered, justification must be provided`);
    }
    return errors;
  },
  validateDocumentation: (analysis: EventSequenceQuantification): string[] => {
    const errors: string[] = [];
    const requiredDocFields = [
      "processDescription",
      "inputs",
      "appliedMethods",
      "resultsSummary",
      "quantificationProcess",
      "truncationProcess",
      "familyFrequencies",
    ];
    for (const field of requiredDocFields) {
      if (!analysis.documentation[field]) {
        errors.push(`Required documentation field '${field}' is missing`);
      }
    }
    return errors;
  },
};
export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export enum TruncationMethod {
  ABSOLUTE_FREQUENCY = "ABSOLUTE_FREQUENCY",
  PERCENTAGE_OF_TOTAL = "PERCENTAGE_OF_TOTAL",
  SIGNIFICANT_DIGITS = "SIGNIFICANT_DIGITS",
  RELATIVE_CONTRIBUTION = "RELATIVE_CONTRIBUTION",
}
export enum QuantificationApproach {
  FAULT_TREE_LINKING = "FAULT_TREE_LINKING",
  EVENT_TREE_BOUNDARY_CONDITIONS = "EVENT_TREE_BOUNDARY_CONDITIONS",
  BINARY_DECISION_DIAGRAM = "BINARY_DECISION_DIAGRAM",
  MARKOV_MODEL = "MARKOV_MODEL",
  DISCRETE_EVENT_SIMULATION = "DISCRETE_EVENT_SIMULATION",
  MONTE_CARLO_SIMULATION = "MONTE_CARLO_SIMULATION",
}
export enum CircularLogicResolutionMethod {
  CONDITIONAL_SPLIT_FRACTIONS = "CONDITIONAL_SPLIT_FRACTIONS",
  TRANSFER_GATES = "TRANSFER_GATES",
  ITERATIVE_CONVERGENCE = "ITERATIVE_CONVERGENCE",
  LOGIC_TRANSFORMATION = "LOGIC_TRANSFORMATION",
}
export type SourceReference = string;
export type SourceTermReference = string;
export interface EventSequenceFamilyQuantification extends Unique, Named {
  familyId: string;
  description?: string;
  memberSequenceIds: EventSequenceReference[];
  representativeSequenceId: EventSequenceReference;
  groupingCriteriaId: string;
  representativeSourceId: SourceReference;
  representativePlantOperatingStateId: string;
  representativeInitiatingEventId: string;
  representativePlantResponse: string;
  representativeSourceTermId?: SourceTermReference;
  dependenciesConsideredInGrouping?: boolean;
  representativeSequenceSelectionBasis?: string;
}
export interface MutuallyExclusiveEvents {
  id: string;
  description: string;
  eventIds: string[];
  basis: string;
  treatmentMethod: string;
  retentionJustification?: string;
}
export interface CircularLogic {
  id: string;
  description: string;
  involvedElementIds: string[];
  detectionMethod: string;
  resolutionMethod: CircularLogicResolutionMethod;
  resolutionDescription: string;
  resolutionImpact?: string;
}
export interface FlagEvent extends Unique, Named {
  purpose: string;
  state: boolean;
  effect: string;
  basis: string;
  isTemporary: boolean;
}
export interface QuantificationReviewProcess {
  reviewCriteria: string[];
  reviewFindings: {
    id: string;
    description: string;
    correctiveActions?: string;
  }[];
  plantComparison?: {
    comparisonPlants: string[];
    keyDifferences: string[];
    differenceExplanation: string;
  };
  familyGroupingReview?: {
    groupingCriteria: string[];
    groupingIssues: string[];
  };
}
export interface QuantificationCutSet {
  systemCutSetReference: string;
  events: string[];
  order: number;
  eventProbabilities: Record<string, number>;
  systemProbability: number;
  sequenceModifications: {
    probabilityFactor: number;
    modificationJustification: string;
    sequenceConditions?: string[];
  };
  sequenceProbability: number;
  importance?: number;
  truncationStatus: "included" | "truncated";
  truncationJustification?: string;
}
export interface EventSequenceFrequencyEstimate {
  sequenceId: string;
  sequenceType: "INDIVIDUAL" | "FAMILY";
  meanFrequency: FrequencyQuantification;
  uncertaintyDistribution: {
    type: DistributionType;
    parameters: Record<string, number>;
  };
  confidenceIntervals?: {
    percentile05?: number;
    percentile50?: number;
    percentile95?: number;
  };
  significantUncertaintySources?: string[];
  sensitivityResults?: {
    parameter: string;
    range: [number, number];
    frequencyEffect: [number, number];
  }[];
  contributingCutSets?: CutSetUsage[];
  totalCutSets?: number;
  truncatedCutSets?: number;
  minimalCutSets?: QuantificationCutSet[];
  cutSetSummary?: {
    totalCutSets: number;
    truncatedCutSets: number;
    cutSetsByOrder: Record<number, number>;
    dominantCutSets: {
      cutSetReference: string;
      contribution: number;
      percentage: number;
    }[];
  };
  truncationCriteria?: {
    method: TruncationMethod;
    value: number;
    justification: string;
    impact?: string;
  };
}
export interface ConvergenceAnalysis {
  truncationMethod: TruncationMethod;
  finalTruncationValue: number;
  truncationProgression: number[];
  frequencyAtTruncation: Record<number, number>;
  percentageChangeAtTruncation: Record<number, number>;
  basisForSelection: string;
  convergenceDemonstration: string;
  truncationSensitivity?: string;
}
export interface ImportanceAnalysis {
  analysisType: "FUSSELL_VESELY" | "RISK_REDUCTION_WORTH" | "RISK_ACHIEVEMENT_WORTH" | "BIRNBAUM" | "OTHER";
  scope: "OVERALL" | "PER_SEQUENCE" | "PER_FAMILY";
  basicEventImportance?: Record<string, number>;
  initiatingEventImportance?: Record<string, number>;
  humanFailureEventImportance?: Record<string, number>;
  topEventImportance?: Record<string, number>;
  significanceCutoff?: number;
  significantBasicEvents?: string[];
  significantInitiatingEvents?: string[];
  significantHumanFailureEvents?: string[];
  significantTopEvents?: string[];
}
export interface EventQuantUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  parameterUncertainties: {
    parameterId: string;
    distributionType: DistributionType;
    distributionParameters: Record<string, number>;
    basis: string;
  }[];
  correlations?: {
    parameterIds: string[];
    correlationCoefficient: number;
    basis: string;
  }[];
  stateOfKnowledgeCorrelation: {
    isConsidered: boolean;
    justificationIfNotConsidered?: string;
    handlingMethod?: "SAME_RANDOM_SEED" | "EXPLICIT_CORRELATION_MATRIX" | "PARAMETER_GROUPING" | "OTHER";
    handlingDescription?: string;
    correlatedParameters?: string[][];
    impactAssessment?: string;
  };
}
export interface EquipmentSurvivabilityAssessment {
  equipmentIds: string[];
  environmentalConditions: {
    type: string;
    severity: string;
  }[];
  survivabilityCriteria: string;
  assessmentResults: {
    equipmentId: string;
    survives: boolean;
    basis: string;
  }[];
}
export interface RecoveryActionTreatment {
  recoveryActions: {
    id: string;
    description: string;
  }[];
  modelingMethod: string;
}
export interface ModelIntegration {
  integrationMethod: string;
  softwareTools: string[];
  integrationSteps: string[];
  integrationVerification: string;
  integrationIssues?: {
    description: string;
    resolution: string;
  }[];
}
export interface HumanFailureEventDependency {
  dependentHFEs: string[];
  dependencyLevel: string;
  adjustedProbabilities: Record<string, number>;
}
export interface DependencyRepresentation {
  dependenciesByType: Record<
    DependencyType,
    {
      treatmentDescription: string;
      modelingMethod: string;
      examples: string[];
    }
  >;
  postInitiatorHFEDependencies: {
    dependencyMethod: string;
    methodBasis: string;
    dependentHFEExamples: string[];
  };
  humanFailureEventDependencies?: HumanFailureEventDependency[];
  commonCauseFailures: {
    modelingApproach: string;
    parameterBasis: string;
    ccfGroupsModeled: string[];
  };
  phenomenologicalDependencies: {
    phenomenaConsidered: string[];
    modelingApproach: string;
    basisForApproach: string;
  };
  recoveryActionDependencies: {
    recoveryActionsModeled: string[];
    dependenciesConsidered: string[];
    modelingApproach: string;
  };
  equipmentSurvivabilityAssessment?: EquipmentSurvivabilityAssessment;
}
export interface SystemSuccessTreatment {
  treatmentMethod: string;
  systemsWithSuccessModeled: string[];
  impactOnResults: string;
  modelingExamples: string[];
}
export interface RadionuclideBarrierTreatment {
  barriersConsidered: string[];
  barrierFailureModes: Record<string, string[]>;
  barrierIntegrationMethod: Record<string, string>;
  barrierPhenomena: Record<string, string[]>;
  barrierChallengesTreatment: string;
  barrierCapacityBasis: string;
  barrierFailureProbabilities: Record<string, Record<string, number>>;
  barrierCapabilityEvaluation: Record<
    string,
    {
      conditions: string;
      capability: string;
    }
  >;
  calculationMethod: string;
  barrierStates?: Record<
    string,
    {
      eventSequenceId: string;
      states: Record<string, BarrierStatus>;
      timing?: Record<
        string,
        {
          time: number;
          unit: string;
          newState: BarrierStatus;
        }[]
      >;
    }[]
  >;
}
export interface EventSequenceQuantificationDocumentation extends BaseProcessDocumentation {
  processDescription: string;
  inputs: string[];
  appliedMethods: string[];
  resultsSummary: string;
  nonRecoveryTermsProcess?: string;
  cutsetReviewProcess?: string;
  quantificationProcess: string;
  truncationProcess: string;
  familyFrequencies: Array<{
    familyId: EventSequenceFamilyReference;
    meanFrequency: number;
    units: FrequencyUnit;
    distributionType?: DistributionType;
    keyContributors?: string[];
    quantificationResultReference?: string;
  }>;
  riskInsights: string[];
  eventSequencesAndBinning: string;
  dependenciesTreatment: string;
  radionuclideBarrierTreatment: string;
  mutuallyExclusiveEventsTreatment: string;
  asymmetriesInModeling?: string;
  computerCodeUsed: string;
  parameterEstimatesNotDocumented?: string;
  intermediateStatesApproach?: string;
  riskSignificanceDrivers?: string;
  comparisonToSimilarPlants?: string;
}
export interface EventSequenceQuantificationUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  modelUncertaintySources: {
    sourceId: string;
    description: string;
    impact: string;
    relatedAssumptions: string[];
    alternativeApproaches: string[];
    treatmentApproach: string;
  }[];
  keyAssumptions: Assumption[];
  reasonableAlternatives: {
    alternative: string;
    reasonNotSelected: string;
    applicableElements?: string[];
    alternativeId?: string;
    potentialImpact?: string;
  }[];
}
export interface EventSequenceQuantificationLimitationsDocumentation {
  quantificationLimitations: {
    limitationId: string;
    description: string;
    applicationImpact: string;
    potentialWorkarounds?: string;
  }[];
  validationLimitations?: string[];
  dataLimitations?: string[];
  modelIntegrationLimitations?: string[];
  otherLimitations?: string[];
}
export interface EventSequenceQuantificationPreOperationalDocumentation
  extends BasePreOperationalAssumptionsDocumentation {
  preOperationalAssumptions: {
    assumptionId: string;
    description: string;
    impact: string;
    validationApproach: string;
    validationTiming: string;
  }[];
  preOperationalLimitations: {
    limitationId: string;
    description: string;
    impact: string;
    resolutionApproach: string;
  }[];
}
export interface EventSequenceQuantificationPeerReviewDocumentation extends BasePeerReviewDocumentation {
  reviewDate: string;
  reviewTeam: string[];
  reviewScope: string;
  findings: {
    findingId: string;
    description: string;
    significance: "HIGH" | "MEDIUM" | "LOW";
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    resolution?: string;
    associatedRequirement?: string;
  }[];
  conclusions: string;
}
export interface EventSequenceQuantification
  extends TechnicalElement<TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION> {
  metadata: {
    version: string;
    analysisDate: string;
    analyst: string;
    reviewer?: string;
    approvalStatus?: string;
    scope?: string[];
    limitations?: string[];
    assumptions?: Assumption[];
  };
  eventSequenceFamilies: Record<string, EventSequenceFamilyQuantification>;
  quantificationResults: Record<string, EventSequenceFrequencyEstimate>;
  quantificationMethods: {
    approach: QuantificationApproach;
    computerCodes: {
      name: string;
      version: string;
      verificationDocumentation: string;
      validationDocumentation: string;
      validationReference?: string;
    }[];
    truncation: ConvergenceAnalysis;
    recoveryActionTreatment?: RecoveryActionTreatment;
    postInitiatorHFEHandling?: string;
  };
  modelIntegration: ModelIntegration;
  dependencyTreatment: DependencyRepresentation;
  logicalChallenges: {
    circularLogic: Record<string, CircularLogic>;
    mutuallyExclusiveEvents: Record<string, MutuallyExclusiveEvents>;
    flagEvents?: Record<string, FlagEvent>;
    systemSuccessTreatment: SystemSuccessTreatment;
  };
  uncertaintyAnalysis: EventQuantUncertaintyAnalysis;
  importanceAnalysis: Record<string, ImportanceAnalysis>;
  quantificationReview?: QuantificationReviewProcess;
  barrierTreatment: RadionuclideBarrierTreatment;
  documentation: EventSequenceQuantificationDocumentation;
  uncertaintyDocumentation: EventSequenceQuantificationUncertaintyDocumentation;
  limitationsDocumentation: EventSequenceQuantificationLimitationsDocumentation;
  preOperationalDocumentation?: EventSequenceQuantificationPreOperationalDocumentation;
  peerReviewDocumentation?: EventSequenceQuantificationPeerReviewDocumentation;
  mechanisticSourceTermAnalysisReferences?: string[];
  riskIntegrationInfo?: {
    riskSignificantSequences: {
      sequenceId: string;
      sequenceType: "INDIVIDUAL" | "FAMILY";
      meanFrequency: number;
      frequencyUnit: string;
      riskSignificance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
      importanceMetrics?: {
        fussellVesely?: number;
        raw?: number;
        rrw?: number;
        birnbaum?: number;
      };
      riskSignificanceBasis?: string;
      riskInsights?: string[];
      releaseCategoryId?: string;
    }[];
    riskIntegrationFeedback?: {
      analysisId: string;
      feedbackDate?: string;
      sequenceFeedback?: {
        sequenceId: string;
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
      }[];
      generalFeedback?: string;
      response?: {
        description: string;
        changes?: string[];
        status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
      };
    };
  };
}
export interface CutSetUsage {
  systemCutSetReference: string;
  sequenceModifications: {
    probabilityFactor: number;
    modificationJustification: string;
    sequenceConditions?: string[];
  };
  sequenceProbability: number;
  contributionStatus: "active" | "truncated" | "modified";
  validation: {
    isValidated: boolean;
    validationDate?: string;
    validationIssues?: string[];
  };
  traceability: {
    systemAnalysisReference: string;
    sequenceAnalysisReference: string;
    assumptions?: string[];
  };
}

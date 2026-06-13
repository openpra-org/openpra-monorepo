import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { ParameterDistribution } from "../core/events";
import {
  ImportanceLevel,
  SensitivityStudy,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type ReleaseCategoryReference = string;
export type SourceTermDefinitionReference = string;
export type RiskSignificanceCriteriaReference = string;

export interface RiskMetric extends Unique, Named {
  metricType: RiskMetricType | string;
  description?: string;
  value: number;
  units: string;
  uncertainty?: ParameterDistribution;
  uncertaintyDescription?: string;
  acceptanceCriteria?: {
    limit: number;
    basis: string;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
  };
  implementsSrs: SRReference[];
}

export interface RiskContributor extends Unique, Named {
  contributorType: string;
  sourceElement: TechnicalElementTypes;
  sourceId: string;
  importanceMetrics?: {
    fussellVesely?: number;
    riskAchievementWorth?: number;
    riskReductionWorth?: number;
    birnbaum?: number;
    criticality?: number;
  };
  riskContribution?: number;
  importanceLevel?: ImportanceLevel;
  context?: string;
  insights?: string[];
}

export interface RiskSignificanceCriteria extends Unique, Named {
  description?: string;
  applicationType: "BASELINE_RISK" | "FIXED_RISK_TARGET";
  criteriaSource: "TABLE_1_9_1" | "TABLE_1_9_2" | "ALTERNATE";
  alternateJustification?: string;
  criteriaType: RiskSignificanceCriteriaType | string;
  metricType: RiskMetricType | string;
  absoluteThresholds?: {
    eventSequence?: number;
    eventSequenceFamily?: number;
    basicEvent?: number;
    humanFailureEvent?: number;
    component?: number;
    system?: number;
  };
  relativeThresholds?: {
    eventSequence?: number;
    eventSequenceFamily?: number;
    basicEvent?: number;
    humanFailureEvent?: number;
    component?: number;
    system?: number;
  };
  justification: string;
  references?: string[];
  intendedApplications?: string[];
  implementsSrs: SRReference[];
}

export interface ReportingThresholds {
  minimumReportingFrequencyPerPlantYear: number;
  frequencyBasis: "STANDARD_DEFAULT" | "JUSTIFIED_ALTERNATIVE";
  frequencyJustification?: string;
  minimumReportingConsequenceDescription: string;
  consequenceBasis: "STANDARD_DEFAULT" | "JUSTIFIED_ALTERNATIVE";
  consequenceJustification?: string;
  implementsSrs: SRReference[];
}

export interface RiskSignificanceEvaluation extends Unique {
  elementType: string;
  elementId: string;
  criteriaReference: RiskSignificanceCriteriaReference;
  evaluationResults: {
    absoluteValue?: number;
    relativeValue?: number;
    isSignificant: boolean;
    significanceBasis: string;
  };
  insights?: string[];
  implementsSrs: SRReference[];
}

export interface CompiledRiskInput extends Unique {
  eventSequenceFamilyRef: EventSequenceFamilyReference;
  releaseCategoryRef?: ReleaseCategoryReference;
  sourceTermDefinitionRef?: SourceTermDefinitionReference;
  frequency: number;
  frequencyUnit?: string;
  frequencyDistribution?: ParameterDistribution;
  esqFamilyQuantificationRef?: string;
  consequences: {
    metric: string;
    meanValue: number;
    unit?: string;
    distribution?: ParameterDistribution;
  }[];
  rcqRecordRef?: string;
  consistentWithEventSequenceAnalysis?: boolean;
  consistentWithMechanisticSourceTerm?: boolean;
  implementsSrs: SRReference[];
}

export interface IntegratedRiskResults extends Unique, Named {
  description?: string;
  calculationLevel: "POINT_ESTIMATE" | "MEAN";
  metrics: RiskMetric[];
  calculationApproach: {
    sumOfProducts?: boolean;
    frequencyConsequencePlots?: boolean;
    exceedanceFrequencyCurves?: boolean;
    alternativeApproach?: string;
    justification: string;
  };
  frequencyConsequencePlotData?: {
    eventSequenceRef: EventSequenceReference | EventSequenceFamilyReference;
    eventSequenceName?: string;
    frequency: number;
    consequence: number;
    consequenceMetric: string;
    frequencyUncertainty?: {
      lowerBound: number;
      upperBound: number;
      confidenceLevel: number;
    };
    consequenceUncertainty?: {
      lowerBound: number;
      upperBound: number;
      confidenceLevel: number;
    };
  }[];
  exceedanceFrequencyCurveData?: {
    consequenceMetric: string;
    dataPoints: {
      consequenceValue: number;
      exceedanceFrequency: number;
    }[];
    uncertaintyBands?: {
      confidenceLevel: number;
      dataPoints: {
        consequenceValue: number;
        exceedanceFrequency: number;
      }[];
    }[];
  }[];
  sourceContributions?: {
    sourceRef: string;
    contribution: number;
  }[];
  hazardGroupContributions?: {
    hazardGroup: string;
    contribution: number;
  }[];
  plantOperatingStateContributions?: {
    plantOperatingStateRef: string;
    contribution: number;
  }[];
  aggregationApproach: {
    description: string;
    perSourceHazardContributionsIdentified: boolean;
    detailConservatismDifferences?: {
      scope: string;
      description: string;
    }[];
    separateReviewPerformed?: boolean;
    separateReviewFindings?: string;
    justification: string;
  };
  multiReactorContributionsIncluded: boolean;
  multiSourceContributionsIncluded: boolean;
  complianceStatus?: {
    criterion: string;
    limit: number;
    status: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
    margin?: number;
    basis?: string;
  }[];
  integrationChallenges?: string;
  keyAssumptions?: string[];
  implementsSrs: SRReference[];
}

export interface GroupingAdequacyReview {
  variationNotSignificantJustification: string;
  releaseCategorySelectionSufficiency: string;
  familyAssignmentSufficiency: string;
  groupingUncertaintyReview: {
    performed: boolean;
    artificialSignificanceFound: boolean;
    findings?: string;
  };
  implementsSrs: SRReference[];
}

export interface SignificantRiskContributors extends Unique {
  metricType: RiskMetricType | string;
  description?: string;
  significantEventSequences?: RiskContributor[];
  significantEventSequenceFamilies?: RiskContributor[];
  significantReleaseCategories?: RiskContributor[];
  significantSystems?: RiskContributor[];
  significantComponents?: RiskContributor[];
  significantBasicEvents?: RiskContributor[];
  significantHumanFailureEvents?: RiskContributor[];
  significantPlantOperatingStates?: RiskContributor[];
  significantHazardGroups?: RiskContributor[];
  significantRadioactiveSources?: RiskContributor[];
  insightDerivationBasis?: string;
  insights?: string[];
  implementsSrs: SRReference[];
}

export interface RiskIntegrationMethod extends Unique, Named {
  description?: string;
  version?: string;
  applicability?: string;
  limitations?: string[];
  scopeJustification: string;
  sqaReference?: string;
  verificationStatus?: {
    verified: boolean;
    verificationMethod?: string;
    verificationDate?: string;
    verifier?: string;
  };
  implementsSrs: SRReference[];
}

export interface ModelUncertaintySource extends Unique, Named {
  description: string;
  originatingElement: TechnicalElementTypes;
  impactScope?: TechnicalElementTypes[];
  affectedMetrics: (RiskMetricType | string)[];
  impactAssessment: string;
  frequencyImpactRef?: string;
  consequenceImpactRef?: string;
  characterizationMethod?: string;
  relatedAssumptions?: string[];
  alternatives?: {
    description: string;
    potentialImpact: string;
  }[];
  recommendations?: string[];
  implementsSrs: SRReference[];
}

export interface ScreenedItemLedgerEntry extends Unique {
  itemType:
    | "HAZARD_GROUP"
    | "HAZARD_EVENT"
    | "PLANT_OPERATING_STATE"
    | "INITIATING_EVENT"
    | "EVENT_SEQUENCE"
    | "BASIC_EVENT";
  itemRef: string;
  screeningElementCode: "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC";
  screeningBasis: string;
  impactOnRiskMetrics?: string;
  implementsSrs: SRReference[];
}

export interface RiskUncertaintyAnalysis extends Unique, Named {
  description?: string;
  metric: RiskMetricType | string;
  characterizationLevel: "CHARACTERIZED" | "PROPAGATED_RISK_SIGNIFICANT";
  propagationMethod: string;
  parameterUncertainty?: ParameterDistribution;
  sokcAndPhenomenaTreatment: {
    eventFrequencySokcConsidered: boolean;
    phenomenaDependenciesConsidered: boolean;
    treatmentDescription?: string;
    riskSignificanceBasis?: string;
  };
  evaluationScope: "INDIVIDUAL" | "COMBINATION";
  evaluationType: "QUALITATIVE" | "QUANTITATIVE";
  keyUncertaintySourceRefs?: string[];
  prioritization?: {
    uncertaintySourceId: string;
    priorityLevel: ImportanceLevel;
    basis: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
  uncertaintyRangeDiscussion?: string;
  keyUncertaintyContributors?: {
    sourceId: string;
    sourceName?: string;
    contribution: string | number;
    basis: string;
    potentialImpactRange?: {
      lowerBound: number;
      upperBound: number;
      unit?: string;
    };
    recommendedActions?: string[];
    priority?: ImportanceLevel;
  }[];
  keyContributorIdentificationMethod?: {
    description: string;
    significanceCriteria: string;
    justification: string;
  };
  implementsSrs: SRReference[];
}

export interface RiskIntegrationFeedbackDispatch {
  dispatchDate?: string;
  eventSequenceQuantificationFeedback?: {
    familyFeedback?: {
      familyRef: EventSequenceFamilyReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    contributorFeedback?: {
      entityRef: string;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
  mechanisticSourceTermFeedback?: {
    releaseCategoryFeedback?: {
      releaseCategoryRef: ReleaseCategoryReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    sourceTermFeedback?: {
      sourceTermDefinitionRef: SourceTermDefinitionReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      keyUncertainties?: string[];
    }[];
    generalFeedback?: string;
  };
  radiologicalConsequenceFeedback?: {
    metricFeedback?: {
      metric: string;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
}

export interface RiDocumentation {
  processDescription: string;
  inputsDescription: string;
  appliedMethods: string;
  resultsSummary: string;
  riskSignificanceCriteriaUsed: string;
  resultsAndInsights: string;
  scopeLimitations: string;
  traceabilityToUpstreamContributions: string;
  acceptanceCriteriaComparison: string;
  keyUncertaintySources: string;
  designFeatureInsights: string;
  integratedContributorRollup: string;
  modelUncertaintySourcesDocumentation: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface RiskIntegration extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
  praScope: string;

  scopeDefinition: {
    consequenceMeasures: string[];
    plantOperatingStateRefs: string[];
    hazardGroups: string[];
    radioactiveMaterialSources: string[];
    eventSequenceFamilyRefs?: EventSequenceFamilyReference[];
    releaseCategoryRefs?: ReleaseCategoryReference[];
    sourceTermDefinitionRefs?: SourceTermDefinitionReference[];
  };

  riskSignificanceCriteria: RiskSignificanceCriteria[];
  reportingThresholds: ReportingThresholds;
  riskSignificanceEvaluations?: RiskSignificanceEvaluation[];

  compiledRiskInputs: CompiledRiskInput[];
  integratedRiskResults: IntegratedRiskResults;
  groupingAdequacyReview: GroupingAdequacyReview;
  significantContributors: SignificantRiskContributors;
  integrationMethods: RiskIntegrationMethod[];

  modelUncertaintySources: ModelUncertaintySource[];
  screenedItemsLedger?: ScreenedItemLedgerEntry[];
  uncertaintyAnalyses: RiskUncertaintyAnalysis[];
  sensitivityStudies?: SensitivityStudy[];

  riskIntegrationFeedbackDispatch?: RiskIntegrationFeedbackDispatch;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];

  documentation: RiDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const RI_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "RI-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "RI-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
};

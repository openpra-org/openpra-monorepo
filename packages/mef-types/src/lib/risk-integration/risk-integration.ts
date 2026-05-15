import { Named, Unique } from "../core/meta";
import {
  ImportanceLevel,
  SensitivityStudy,
  ScreeningStatus,
  ScreeningCriteria,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from "../core/shared-patterns";
import { Frequency, FrequencyUnit } from "../core/events";
import { Uncertainty, DataSource, Assumption, DistributionType } from "../data-analysis/data-analysis";
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import {
  EventSequenceReference,
  EventSequenceFamilyReference,
  RiskSignificantEventSequence,
} from "../event-sequence-quantification";
import {
  ReleaseCategoryReference,
  SourceTermDefinitionReference,
  EventSequenceToReleaseCategoryMapping,
  ReleaseCategory,
  SourceTermDefinition,
  RiskSignificantConsequence,
} from "../radiological-consequence-analysis";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export type RiskSignificanceCriteriaReference = string;
export type IntegratedRiskResultReference = string;
export type SignificantContributorReference = string;
export type RiskIntegrationMethodReference = string;
export interface RiskMetric extends Unique, Named {
  metricType: RiskMetricType | string;
  description?: string;
  value: number;
  units: FrequencyUnit | string;
  uncertainty?: Uncertainty;
  acceptanceCriteria?: {
    limit: number;
    basis: string;
    complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
  };
}
export interface RiskContributor extends Unique, Named {
  contributorType: string;
  sourceElement: TechnicalElementTypes;
  sourceId: string;
  importanceMetrics?: {
    fussellVesely?: number;
    raw?: number;
    rrw?: number;
    birnbaum?: number;
    [key: string]: number | undefined;
  };
  riskContribution?: number;
  importanceLevel?: ImportanceLevel;
  context?: string;
  insights?: string[];
}
export interface RiskSignificanceCriteria extends Unique, Named {
  description?: string;
  criteriaType: RiskSignificanceCriteriaType | string;
  metricType: RiskMetricType | string;
  absoluteThresholds?: {
    eventSequence?: number;
    eventSequenceFamily?: number;
    basic?: number;
    humanFailure?: number;
    component?: number;
    system?: number;
    [key: string]: number | undefined;
  };
  relativeThresholds?: {
    eventSequence?: number;
    eventSequenceFamily?: number;
    basic?: number;
    humanFailure?: number;
    component?: number;
    system?: number;
    [key: string]: number | undefined;
  };
  justification: string;
  minimumReportingConsequence?: string;
  references?: string[];
  intendedApplications?: string[];
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
}
export interface IntegratedRiskResults extends Unique, Named {
  description?: string;
  metrics: RiskMetric[];
  calculationApproach: {
    pointEstimateApproach?: boolean;
    meanValueApproach?: boolean;
    frequencyConsequencePlots?: boolean;
    exceedanceFrequencyCurves?: boolean;
    alternativeApproach?: string;
    justification: string;
  };
  frequencyConsequencePlotData?: Array<{
    eventSequenceId: string;
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
  }>;
  exceedanceFrequencyCurveData?: Array<{
    consequenceMetric: string;
    dataPoints: Array<{
      consequenceValue: number;
      exceedanceFrequency: number;
    }>;
    uncertaintyBands?: Array<{
      confidenceLevel: number;
      dataPoints: Array<{
        consequenceValue: number;
        exceedanceFrequency: number;
      }>;
    }>;
  }>;
  hazardGroupContributions?: Record<string, number>;
  plantOperatingStateContributions?: Record<string, number>;
  integrationChallenges?: string;
  aggregationApproach?: {
    description: string;
    detailLevelAdjustments?: string;
    conservatismAdjustments?: string;
    justification: string;
  };
  radioactiveSourceContributions?: Record<string, number>;
  keyAssumptions?: string[];
  complianceStatus?: {
    criterion: string;
    limit: number;
    status: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
    margin?: number;
    basis?: string;
  }[];
  eventSequenceVariationJustification?: string;
}
export interface SignificantRiskContributors extends Unique {
  metricType: RiskMetricType | string;
  description?: string;
  significantEventSequences?: RiskContributor[];
  significantSystems?: RiskContributor[];
  significantComponents?: RiskContributor[];
  significantBasicEvents?: RiskContributor[];
  significantPlantOperatingStates?: RiskContributor[];
  significantHazardGroups?: RiskContributor[];
  significantRadioactiveSources?: RiskContributor[];
  insights?: string[];
  screeningCriteria?: {
    criteriaType: string;
    threshold: number;
    basis: string;
  };
}
export interface RiskIntegrationMethod extends Unique, Named {
  description?: string;
  version?: string;
  applicability?: string;
  limitations?: string[];
  justification: string;
  sqaReference?: string;
  verificationStatus?: {
    verified: boolean;
    verificationMethod?: string;
    verificationDate?: string;
    verifier?: string;
  };
}
export interface ModelUncertaintySource extends Unique, Named {
  description: string;
  originatingElement: TechnicalElementTypes;
  impactScope: TechnicalElementTypes[];
  affectedMetrics: (RiskMetricType | string)[];
  impactAssessment: string;
  characterizationMethod?: string;
  relatedAssumptions?: string[];
  alternatives?: {
    description: string;
    potentialImpact: string;
  }[];
  recommendations?: string[];
}
export interface RiskUncertaintyAnalysis extends Unique, Named {
  description?: string;
  metric: RiskMetricType | string;
  propagationMethod: string;
  parameterUncertainty?: {
    distribution: DistributionType;
    parameters: Record<string, number>;
  };
  keyUncertaintySources?: ModelUncertaintySource[];
  relatedAssumptions?: Assumption[];
  prioritization?: {
    uncertaintySourceId: string;
    priorityLevel: ImportanceLevel;
    basis: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
  uncertaintyRangeDiscussion?: string;
  deterministicComparison?: string;
  keyUncertaintyContributors?: {
    sourceId: string;
    sourceName: string;
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
}
export interface RiskIntegrationAssumption extends Unique {
  description: string;
  originatingElement: TechnicalElementTypes;
  basis: string;
  impact: string;
  alternatives?: string[];
  validationStatus?: "VALIDATED" | "PENDING" | "INVALIDATED";
  validationPlan?: string;
}
export interface RiskIntegrationDocumentation extends Unique {
  processDescription: string;
  riskSignificanceCriteriaDescription: string;
  calculationMethodsDescription: string;
  uncertaintyAnalysisDescription: string;
  keyAssumptionsDescription: string;
  limitationsDescription: string;
  riskInsights?: string[];
  preOperationalAssumptions?: {
    assumption: string;
    impact: string;
    validationPlan: string;
  }[];
  references?: string[];
  peerReviewFindings?: {
    findingId: string;
    description: string;
    significance: ImportanceLevel;
    resolution: string;
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
  }[];
  eventSequenceIntegrationDescription?: {
    integrationProcessDescription: string;
    mappingApproach: string;
    frequencyDerivationApproach: string;
    integrationChallenges?: string[];
    inconsistencyResolution?: string;
    feedbackProvided?: string;
  };
  mechanisticSourceTermIntegrationDescription?: {
    integrationProcessDescription: string;
    releaseCategoryIntegrationApproach: string;
    sourceTermUtilizationApproach: string;
    uncertaintyPropagationApproach?: string;
    integrationChallenges?: string[];
    inconsistencyResolution?: string;
    feedbackProvided?: string;
    sourceTermInsights?: string[];
  };
}
export interface EventSequenceToReleaseCategory extends Unique {
  eventSequenceId: EventSequenceReference | EventSequenceFamilyReference;
  releaseCategoryId: ReleaseCategoryReference;
  mappingBasis: string;
  frequency: number;
  frequencyUnit?: FrequencyUnit;
  uncertaintyFactors?: string[];
  supportingAnalyses?: string[];
  originalMappingId?: string;
  consistentWithEventSequenceAnalysis?: boolean;
  originalMstMappingId?: string;
  consistentWithMstAnalysis?: boolean;
  sourceTermDefinitionReference?: SourceTermDefinitionReference;
}
export interface RiskIntegration extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
  additionalMetadata?: {
    limitations?: string[];
    assumptions?: string[];
    traceability?: string;
    eventSequenceAnalysisReferences?: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
    mechanisticSourceTermReferences?: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
  };
  scopeDefinition?: {
    consequenceMeasures: string[];
    plantOperatingStateIds: string[];
    hazardGroups: string[];
    radioactiveMaterialSources: string[];
    eventSequenceFamilyIds?: EventSequenceFamilyReference[];
    releaseCategoryIds?: ReleaseCategoryReference[];
    sourceTermDefinitionIds?: SourceTermDefinitionReference[];
  };
  riskSignificanceCriteria: RiskSignificanceCriteria[];
  riskSignificanceEvaluations?: RiskSignificanceEvaluation[];
  eventSequenceToReleaseCategoryMappings: EventSequenceToReleaseCategory[];
  integratedRiskResults: IntegratedRiskResults;
  significantContributors: SignificantRiskContributors;
  integrationMethods: RiskIntegrationMethod[];
  uncertaintyAnalyses: RiskUncertaintyAnalysis[];
  keyAssumptions?: RiskIntegrationAssumption[];
  documentation: RiskIntegrationDocumentation;
  preOperationalAssumptions?: {
    assumption: string;
    impact: string;
    validationPlan: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
  validationRules?: RiskIntegrationValidationRules;
  eventSequenceAnalysisFeedback?: {
    analysisId: string;
    releaseCategoryMappingFeedback?: {
      originalMappingId: string;
      updatedFrequency?: number;
      updatedFrequencyUnit?: FrequencyUnit;
      insights?: string[];
      recommendations?: string[];
    }[];
    eventSequenceFamilyFeedback?: {
      familyId: EventSequenceFamilyReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
  mechanisticSourceTermFeedback?: {
    analysisId: string;
    releaseCategoryFeedback?: {
      releaseCategoryId: ReleaseCategoryReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    sourceTermDefinitionFeedback?: {
      sourceTermDefinitionId: SourceTermDefinitionReference;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
      keyUncertainties?: string[];
    }[];
    mappingFeedback?: {
      originalMappingId: string;
      riskSignificance?: ImportanceLevel;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
  eventSequenceQuantificationInputs: {
    analysisReferences: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
    riskSignificantSequences: RiskSignificantEventSequence[];
    significanceDeterminationMethod?: string;
  };
  radiologicalConsequenceInputs: {
    analysisReferences: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
    riskSignificantConsequences: RiskSignificantConsequence[];
    significanceDeterminationMethod?: string;
  };
}
export interface RiskIntegrationValidationRules {
  riskSignificanceCriteriaRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };
  integratedRiskResultsRules: {
    description: string;
    validationMethod: string;
    requiredElements: string[];
  };
  uncertaintyAnalysisRules: {
    description: string;
    requiredElements: string[];
    characterizationCriteria: string[];
  };
  significantContributorRules: {
    description: string;
    requiredContributorTypes: string[];
    documentationRequirements: string[];
  };
  documentationRules: {
    description: string;
    documentationCriteria: string[];
    requiredDocumentation: string[];
  };
}

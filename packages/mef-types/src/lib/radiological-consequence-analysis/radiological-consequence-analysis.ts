import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import {
  ImportanceLevel,
  SensitivityStudy,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from "../core/shared-patterns";
import {
  BaseProcessDocumentation,
  BaseModelUncertaintyDocumentation,
  BasePeerReviewDocumentation,
  BaseAssumption,
} from "../core/documentation";
import { EventSequenceFamilyReference } from "../event-sequence-analysis/event-sequence-analysis";
import {
  ReleaseCategoryReference as MstReleaseCategoryReference,
  SourceTermDefinitionReference,
} from "../mechanistic-source-term/mechanistic-source-term";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export interface MeteorologicalDataAnalysis {
  parameterUncertaintyCharacterisation?: string;
  meteorologicalDataSetDescription?: string;
  meteorologicalFrequencyDistributionTreatment?: string;
  temporalChangesAccommodation?: string;
  timeResolution?: string;
}
export interface ConsequenceQuantificationAnalysis {
  selectedMetrics: string[];
  consequenceCodesUsed: string[];
  modelAndCodeLimitations: {
    code?: string;
    feature: string;
    limitation: string;
    justification?: string;
  }[];
  eventSequenceConsequences: {
    eventSequenceFamily: EventSequenceFamilyReference;
    consequences: Record<string, number>;
    consequenceMetric?: string;
    meanValue?: number;
    uncertainty?: string;
    sourceTermReference?: SourceTermDefinitionReference;
    releaseCategoryReference?: MstReleaseCategoryReference;
    riskSignificance?: ImportanceLevel;
    riskIntegrationInsights?: string[];
  }[];
  uncertaintyCharacterization?: string;
  supportingDocumentationReferences?: string[];
  healthEffectsConsidered?: {
    earlyEffects?: string[];
    latentEffects?: string[];
    doseResponseApproach?: string;
  };
  economicFactorsConsidered?: {
    costCategories?: string[];
    valuationApproach?: string;
    timeHorizon?: string;
  };
  riskMetricMapping?: {
    consequenceMetric: string;
    riskMetric: RiskMetricType | string;
    mappingDescription: string;
    transformations?: string;
  }[];
  riskIntegrationFeedback?: {
    analysisId: string;
    feedbackDate?: string;
    metricFeedback?: {
      metric: string;
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
}
export interface RadiologicalConsequenceDocumentation extends BaseProcessDocumentation {
  inputSources: string[];
  appliedMethods: string[];
  resultsSummary: string;
  peerReview?: BasePeerReviewDocumentation;
  uncertaintiesAndAssumptions: string[];
  sensitivityStudies?: SensitivityStudy[];
  modelUncertaintyDocumentation?: BaseModelUncertaintyDocumentation;
  assumptions?: BaseAssumption[];
  requirementTraceability?: {
    requirementId: string;
    standardReference: string;
    implementation: string;
  }[];
  riskIntegrationDocumentation?: {
    integrationProcessDescription: string;
    consequenceMetricUsage: {
      metricName: string;
      correspondingRiskMetric?: RiskMetricType;
      usageDescription: string;
    }[];
    uncertaintyPropagation?: string;
    integrationChallenges?: string[];
    inconsistencyResolution?: string;
    feedbackReceived?: {
      source: string;
      date?: string;
      description: string;
      significance: ImportanceLevel;
    }[];
    feedbackIncorporation?: {
      feedbackReference: string;
      incorporationDescription: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
      date?: string;
    }[];
    keyInsights?: string[];
    riskIntegrationReferences?: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
  };
}
export interface RadiologicalConsequenceAnalysis extends TechnicalElement<TechnicalElementTypes.CONSEQUENCE_ANALYSIS> {
  "technical-element-type": TechnicalElementTypes.CONSEQUENCE_ANALYSIS;
  "technical-element-code": "RC";
  metadata: TechnicalElementMetadata & {
    scopeDefinition: RadiologicalConsequenceAnalysisScope;
    additionalMetadata?: {
      limitations?: string[];
      assumptions?: string[];
      traceability?: string;
      riskIntegrationReferences?: {
        analysisId: string;
        version?: string;
        date?: string;
        usageDescription: string;
      }[];
    };
  };
  releaseCategoryToConsequence: ReleaseCategoryToConsequenceAnalysis;
  atmosphericTransportAndDispersion: AtmosphericDispersionAnalysis;
  dosimetry: DosimetryAnalysis;
  consequenceQuantification: ConsequenceQuantificationAnalysis;
  protectiveActionParameters: ProtectiveActionAnalysis;
  meteorologicalData: MeteorologicalDataAnalysis;
  documentation?: RadiologicalConsequenceDocumentation;
  riskIntegrationDescription?: {
    supportDescription: string;
    consequenceMetricUsage: string;
    uncertaintyPropagation?: string;
    integrationChallenges?: string[];
    feedbackIncorporation?: string;
    keyInsights?: string[];
  };
  riskIntegrationInfo?: {
    riskSignificantConsequences: {
      releaseCategoryId: string;
      sourceTermDefinitionId?: string;
      consequenceMetrics: Record<string, number>;
      riskSignificance: "HIGH" | "MEDIUM" | "LOW" | "NONE";
      riskInsights?: string[];
      uncertaintyDescription?: string;
      mappedRiskMetrics?: {
        metricName: string;
        mappingDescription: string;
      }[];
    }[];
    riskIntegrationFeedback?: {
      analysisId: string;
      feedbackDate?: string;
      metricFeedback?: {
        metric: string;
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
export type ReleaseCategoryReference = string;
export type SiteReference = string;
export interface BoundingSite {
  description: string;
  justification: string;
  characteristics: {
    siteBoundaryDistance?: number;
    populationCentreDistance?: number;
    terrain?: string;
    [key: string]: any;
  };
  boundingJustification: string;
  boundedSites?: string[];
}
export interface DosimetryAnalysis {
  exposurePathways: string[];
  dcfSource: string;
  shieldingConsiderations?: string;
  occupancyConsiderations?: string;
  dcfUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };
  dcfParameterUncertaintyCharacterisation?: string;
  receptorTypes?: string[];
  dosimetryModelsUsed?: string;
  doseAggregationMethod?: string;
  radionuclideDecayConsideration?: string;
  doseIntegrationPeriods?: string[];
}
export interface ReleaseCharacteristics {
  numberOfPlumes?: number;
  radionuclideQuantities?: Record<string, number[]>;
  radionuclideGroupFractions?: Record<string, number>;
  importantRadionuclides?: string[];
  importantRadionuclidesJustification?: string;
  releaseTimingAndDuration?: [number, number][];
  releaseTiming?: string;
  releaseDuration?: string;
  warningTime?: number;
  warningTimeDescription?: string;
  hazardsImpactingProtectiveActions?: string;
  releaseEnergy?: number;
  releaseEnergyDescription?: string;
  releaseHeight?: number;
  releaseHeightDescription?: string;
  releasedParticleSize?: number;
  releasedParticleSizeDescription?: string;
  releaseUncertainties?: string;
}
export interface RadiologicalConsequenceAnalysisScope {
  isSpecificSite: boolean;
  siteReference?: SiteReference;
  boundingSite?: BoundingSite;
  consequenceMetrics: string[];
  protectiveActionsModellingDegree: string;
  meteorologyModellingDegree: string;
  atmosphericDispersionModellingDegree: string;
  dosimetryModellingDegree: string;
  healthEffectsModellingDegree: string;
  economicFactorsModellingDegree: string;
}
export interface ReleaseCategoryInputs {
  releaseCategory: ReleaseCategoryReference;
  releaseCharacteristics: ReleaseCharacteristics;
}
export interface ReleaseCategoryToConsequenceAnalysis {
  siteInformation:
    | {
        isBounding: false;
        siteReference: SiteReference;
      }
    | {
        isBounding: true;
        boundingSite: BoundingSite;
      };
  meteorologicalDataAssumptionsForBoundingSite?: string[];
  releaseCategoryInputs: ReleaseCategoryInputs[];
  releaseCategoryAndSourceTermReviewed: boolean;
  selectedConsequenceMeasures: string[];
  releaseCategoryLinkageDocumentation?: string;
  riskMetricMapping?: {
    releaseCategory: ReleaseCategoryReference;
    riskMetrics: {
      riskMetric: RiskMetricType | string;
      contributionDescription: string;
      significance?: ImportanceLevel;
    }[];
  }[];
  riskSignificanceCriteria?: {
    criteriaType: RiskSignificanceCriteriaType | string;
    description: string;
    thresholds?: {
      level: ImportanceLevel;
      value: number;
      units?: string;
    }[];
  }[];
  riskIntegrationFeedback?: {
    analysisId: string;
    feedbackDate?: string;
    releaseCategoryFeedback?: {
      releaseCategory: ReleaseCategoryReference;
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
}
export interface AtmosphericDispersionAnalysis {
  dispersionModel: string;
  dispersionModelJustification: string;
  plumeRiseConsideration?: string;
  buildingWakeEffectsConsideration?: string;
  terrainEffectsConsideration?: string;
  dispersionUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };
  siteCharacteristicsConsidered?: string;
  meteorologicalDataSpecification?: string;
  receptorLocationsSpecification?: string;
  uncertaintyAnalysisDescription?: string;
  supportingDocumentationReferences?: string[];
  modelLimitations?: string;
  depositionModeling?: string;
  dryDepositionParameters?: {
    depositionVelocities?: Record<string, number>;
    particleSizeDistribution?: string;
  };
  wetDepositionParameters?: {
    washoutCoefficients?: Record<string, number>;
    precipitationData?: string;
  };
}
export interface ProtectiveActionAnalysis {
  protectiveActionParameters: {
    evacuationDelay?: string;
    evacuationSpeed?: string;
    shelteringEffectiveness?: string;
    [key: string]: string | undefined;
  };
  populationDistribution: string;
  landUseCharacteristics: string;
  emergencyResponseTimingBases: string;
  protectiveActionUncertainty: {
    sources: string[];
    assumptions: string[];
    alternatives: string[];
  };
  boundingWarningTimeAssumption?: string;
  protectiveActionImpactingHazards?: string;
  populationDistributionJustification?: string;
  riskMetricImpact?: {
    riskMetric: RiskMetricType | string;
    impactDescription: string;
    quantitativeAssessment?: string;
    uncertaintyDescription?: string;
  }[];
  riskMetricSensitivity?: {
    parameter: string;
    affectedRiskMetrics: (RiskMetricType | string)[];
    sensitivityDescription: string;
    importance?: ImportanceLevel;
  }[];
  riskIntegrationFeedback?: {
    analysisId: string;
    feedbackDate?: string;
    parameterFeedback?: {
      parameter: string;
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
}

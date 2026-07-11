import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { ParameterDistribution } from "../core/events";
import {
  ImportanceLevel,
  SensitivityStudy,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type ReleaseCategoryReference = string;
export type SourceTermDefinitionReference = string;
export type EventSequenceFamilyReference = string;
export type SiteReference = string;

export type RcSubElement = "RCRE" | "RCPA" | "RCME" | "RCAD" | "RCDO" | "RCHE" | "RCEC" | "RCQ";

export interface ModelUncertaintyIdentification {
  sources: string[];
  assumptions: string[];
  alternatives: string[];
}

export interface BoundingSite {
  description: string;
  characteristics: {
    siteBoundaryDistance?: number;
    populationCentreDistance?: number;
    terrain?: string;
    additionalCharacteristics?: {
      name: string;
      value: string;
    }[];
  };
  boundingJustification: string;
  boundedSites?: string[];
}

export interface ReleaseCharacteristics {
  numberOfPlumes?: number;
  radionuclideGroupFractions?: {
    group: string;
    fraction: number;
  }[];
  importantRadionuclides?: string[];
  importantRadionuclidesJustification?: string;
  releasePhaseTimings?: {
    startTime: number;
    duration: number;
    timeUnit?: string;
  }[];
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

export interface ReleaseCategoryInputs {
  releaseCategory: ReleaseCategoryReference;
  sourceTermDefinitionRef?: SourceTermDefinitionReference;
  releaseCharacteristics: ReleaseCharacteristics;
}

export interface RcScope {
  consequenceMetrics: string[];
  metricSelectionApplicationBasis?: string;
  protectiveActionsModellingDegree: string;
  meteorologyModellingDegree: string;
  atmosphericDispersionModellingDegree: string;
  dosimetryModellingDegree: string;
  healthEffectsModellingDegree: string;
  economicFactorsModellingDegree: string;
  implementsSrs: SRReference[];
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
  releaseCategoryInputs: ReleaseCategoryInputs[];
  releaseCategoryAndSourceTermReviewed: boolean;
  reviewBasis?: string;
  implementsSrs: SRReference[];
}

export interface ProtectiveActionAnalysis {
  protectiveActionsIncluded: {
    action: "EVACUATION" | "SHELTERING" | "RELOCATION" | "LAND_INTERDICTION_REMEDIATION" | "FOOD_INTERDICTION_REMEDIATION";
    included: boolean;
    applicabilityJustification?: string;
  }[];
  incidentPhasesModeled: {
    phase: "EARLY" | "INTERMEDIATE" | "LATE_LONG_TERM";
    criteriaDescription: string;
  }[];
  sourceDocuments: {
    document: string;
    usage: string;
    justification?: string;
  }[];
  cohortModeling: {
    approach: "SINGLE_COHORT" | "MULTIPLE_COHORTS";
    cohorts?: {
      name: string;
      description: string;
      complianceAssumption?: string;
    }[];
  };
  complianceAssumptions: {
    description: string;
    basis: string;
  }[];
  shelterInPlaceCredit?: {
    credited: boolean;
    justification?: string;
  };
  protectionParameters?: {
    parameter: string;
    value: string;
    source: string;
  }[];
  evacuationModeling?: {
    approach: string;
    description?: string;
  };
  evacuationDelayComponents?: {
    component:
      | "GENERAL_EMERGENCY_DECLARATION"
      | "SITE_NOTIFIES_OFFICIALS"
      | "OFFICIALS_NOTIFY_PUBLIC"
      | "PUBLIC_RECEIVES_INSTRUCTIONS"
      | "SECURE_PERSONAL_PROPERTY"
      | "LOAD_VEHICLES";
    estimate: string;
  }[];
  evacuationSpeed?: {
    basis: string;
    daytimeNighttimeConsidered: boolean;
    adverseWeatherConsidered: boolean;
    specialEventsConsidered: boolean;
    transientPopulationsConsidered: boolean;
  };
  hazardGroupAdjustments?: {
    hazardGroup: string;
    adjustmentDescription: string;
  }[];
  populationDistribution: {
    basis: "ASSUMED_JUSTIFIED" | "DEMOGRAPHIC_SOURCES";
    description: string;
    justification?: string;
    transientPopulationsIncluded?: boolean;
    projectionAdjustments?: string;
  };
  landUseData: {
    basis: "GENERIC_SIMPLIFIED" | "REGIONAL_SPECIFIC";
    description: string;
    intraRegionalAdjustments?: string;
  };
  plantPhysicalCharacteristics: {
    basis: "ESTIMATED" | "ACTUAL";
    description: string;
  };
  releaseSourceGeographicLocation: string;
  boundingSiteLocationJustification?: string;
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface MeteorologicalDataAnalysis {
  dataSource: string;
  spatialRepresentativenessJustification: string;
  periodSelection: {
    approach: "REPRESENTATIVE_SINGLE_YEAR" | "MULTI_YEAR_EVALUATION";
    periodDescription: string;
  };
  dataRecovery: {
    combinedRecoveryPercent?: number;
    meetsNinetyPercent?: boolean;
    lowRecoveryJustification?: string;
    substitutionTechniques?: string;
    meteorologistReview?: {
      performed: boolean;
      reviewerQualification?: string;
      considerations?: string;
    };
  };
  instrumentationQuality?: {
    calibratedProgram: boolean;
    description?: string;
  };
  extractedParameters: {
    windSpeedAndDirection10m: boolean;
    stabilityClassMeasurement: boolean;
    precipitation?: boolean;
  };
  mixingHeights?: {
    scope: "SEASONAL_AFTERNOON" | "SEASONAL_MORNING_AND_AFTERNOON";
    source: string;
  };
  stabilityClassificationMethod: {
    approach: "SIMPLIFIED" | "RECOGNIZED_SOURCE";
    description: string;
  };
  accuracyReview: {
    performed: boolean;
    findings?: string;
  };
  temporalChangesAccommodation?: string;
  timeResolution?: string;
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface AtmosphericDispersionAnalysis {
  dispersionModel: {
    modelClass: "STRAIGHT_LINE_GAUSSIAN" | "SEGMENTED_PLUME" | "OTHER_VARIABLE_TRAJECTORY";
    name?: string;
    justification: string;
  };
  temporalResolution: {
    approach: "STEADY_STATE" | "HOURLY_UPDATES";
    description?: string;
  };
  spatialTreatment: {
    approach: "CENTERLINE" | "TWO_DIMENSIONAL_GRID";
    gridDescription?: string;
    gridJustification?: string;
  };
  windFieldData: string;
  windRepresentativeness?: string;
  meteorologicalDataPerRcme: boolean;
  meteorologicalSampling: {
    approach: "BOUNDING_CONDITIONS" | "STATISTICAL_SAMPLING";
    technique?: string;
    meanShiftValidation?: {
      performed: boolean;
      meanShiftPercent?: number;
      justification?: string;
    };
  };
  elevatedReleaseAlgorithms?: string;
  plumeRise: {
    credited: boolean;
    algorithmsDescription?: string;
  };
  buildingWakeEffects?: string;
  plumeSegmentation: {
    approach: "SINGLE_PLUME" | "MULTIPLE_PLUMES";
    description?: string;
  };
  deposition: {
    dryDeposition: {
      included: boolean;
      approach?: "SINGLE_VELOCITY" | "PER_PARTICLE_SIZE";
      velocities?: {
        particleSize?: string;
        velocity: number;
      }[];
    };
    wetDeposition: {
      included: boolean;
      precipitationIntensityDependent?: boolean;
      washoutCoefficients?: {
        condition: string;
        coefficient: number;
      }[];
    };
    sourceDepletion: {
      included: boolean;
      scope?: "DRY_ONLY_JUSTIFIED" | "DRY_AND_WET";
      wetExclusionJustification?: string;
    };
    resuspension: {
      included: boolean;
      description?: string;
    };
  };
  terrainEffectsConsideration?: string;
  siteCharacteristicsConsidered?: string;
  receptorLocationsSpecification?: string;
  modelLimitations?: string;
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface DosimetryAnalysis {
  exposurePathways: {
    pathway: "CLOUDSHINE" | "GROUNDSHINE" | "SKIN_DEPOSITION" | "INHALATION" | "INGESTION";
    included: boolean;
    exclusionJustification?: string;
  }[];
  dispersionResultsUsed: boolean;
  exposurePeriods: {
    period: string;
    justification: string;
  }[];
  cloudImmersionModel: {
    approach: "SEMI_INFINITE" | "FINITE_PLUME_OR_CORRECTED";
    description?: string;
  };
  groundshineIntegration?: string;
  skinBetaTreatment?: string;
  breathingRates: {
    approach: "GENERIC" | "PER_COHORT_JUSTIFIED";
    description?: string;
  };
  ingestionTreatment: {
    approach: "EXCLUDED" | "GENERIC_INTAKE";
    description?: string;
  };
  dcf: {
    source: string;
    type: "EFFECTIVE" | "ORGAN_SPECIFIC";
  };
  shieldingConsiderations?: string;
  occupancyConsiderations?: string;
  receptorTypes?: string[];
  dosimetryModelsUsed?: string;
  doseAggregationMethod?: string;
  radionuclideDecayConsideration?: string;
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface HealthEffectsAnalysis {
  earlyHealthEffects: string[];
  latentHealthEffects: string[];
  earlyEffectParameters: {
    approach: "SIMPLIFIED_ORGANS_OR_REDUCED_RADIONUCLIDES" | "ORGAN_SPECIFIC_DOSE_RESPONSE";
    description: string;
  };
  latentEffectParameters: {
    approach: "SIMPLIFIED_TEDE_OR_REDUCED_RADIONUCLIDES" | "ORGAN_SPECIFIC_FACTORS";
    description: string;
  };
  ageGenderHomogeneous: boolean;
  riskFactorSources: {
    source: string;
    recognizedBody: string;
    version?: string;
  }[];
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface EconomicFactorsAnalysis {
  costCategories: {
    category: string;
    parameterDefinitions: string[];
  }[];
  parameterConsistencyConfirmed: boolean;
  costParameterEstimates: {
    parameter: string;
    dataBasis: "REGIONAL_SITE_APPLICABLE" | "GENERIC_JUSTIFIED";
    source: string;
    justification?: string;
    timeFrameAdjustment?: string;
  }[];
  parameterUncertaintyCharacterization?: string;
  modelUncertainty: ModelUncertaintyIdentification;
  implementsSrs: SRReference[];
}

export interface ConsequenceQuantificationAnalysis {
  consequenceCodesUsed: {
    code: string;
    benchmarkBasis?: string;
  }[];
  modelAndCodeLimitations: {
    code?: string;
    feature: string;
    limitation: string;
    justification?: string;
  }[];
  eventSequenceConsequences: {
    uuid?: string;
    eventSequenceFamily: EventSequenceFamilyReference;
    releaseCategoryReference?: ReleaseCategoryReference;
    sourceTermReference?: SourceTermDefinitionReference;
    consequenceResults: {
      metric: string;
      meanValue: number;
      unit?: string;
      uncertaintyDistribution?: ParameterDistribution;
      uncertaintyDescription?: string;
    }[];
    riskSignificance?: ImportanceLevel;
  }[];
  outputReview: {
    performed: boolean;
    indicationsFound?: string[];
    acceptanceJustifications?: string[];
  };
  resultsConfirmation: {
    performed: boolean;
    description?: string;
  };
  riskSignificantContributors?: {
    contributor: string;
    basisPerRiB: string;
    significance?: ImportanceLevel;
  }[];
  riskSignificanceCriteriaUsed?: {
    criteriaType: RiskSignificanceCriteriaType | string;
    description: string;
  }[];
  modelUncertaintyAssessments: {
    sourceSubElement: RcSubElement;
    uncertaintySource: string;
    relatedAssumptions: string[];
    reasonableAlternatives?: string[];
    evaluationType: "QUALITATIVE" | "QUANTITATIVE";
    evaluationScope: "INDIVIDUAL" | "COMBINATION";
    effectOnMetrics: string;
  }[];
  uncertaintyCharacterization: {
    level: "CHARACTERIZED" | "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES";
    description: string;
    phenomenaDependencies?: {
      description: string;
      dependentPhenomena: string[];
      treatmentMethod: string;
    }[];
  };
  riskMetricMapping?: {
    consequenceMetric: string;
    riskMetric: RiskMetricType | string;
    mappingDescription: string;
    transformations?: string;
  }[];
  quantificationLimitations?: string[];
  implementsSrs: SRReference[];
}

export interface RiskIntegrationFeedback {
  analysisRef: string;
  feedbackDate?: string;
  metricFeedback?: {
    metric: string;
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
  }[];
  releaseCategoryFeedback?: {
    releaseCategoryReference: ReleaseCategoryReference;
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
    status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
  }[];
  generalFeedback?: string;
  response?: {
    description: string;
    changes?: string[];
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  };
}

export interface RcDocumentation {
  processDescription: string;
  inputsDescription: string;
  appliedMethods: string;
  resultsSummary: string;
  rcreProcess: string;
  rcpaProcess: string;
  rcpaModelUncertaintySources: string;
  rcpaBoundingSiteDocumentation?: string;
  rcmeProcess: string;
  rcmeModelUncertaintySources: string;
  rcmeBoundingSiteDocumentation?: string;
  rcadProcess: string;
  rcadModelUncertaintySources: string;
  rcadBoundingSiteDocumentation?: string;
  rcdoProcess: string;
  rcdoModelUncertaintySources: string;
  rcheProcess: string;
  rcheModelUncertaintySources: string;
  rcheBoundingSiteDocumentation?: string;
  rcecProcess: string;
  rcecModelUncertaintySources: string;
  rcecBoundingSiteDocumentation?: string;
  rcqProcess: string;
  rcqModelUncertaintySources: string;
  rcqLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface RadiologicalConsequenceAnalysis
  extends TechnicalElement<TechnicalElementTypes.CONSEQUENCE_ANALYSIS> {
  praScope: string;

  scope: RcScope;

  releaseCategoryToConsequence: ReleaseCategoryToConsequenceAnalysis;
  protectiveActionParameters: ProtectiveActionAnalysis;
  meteorologicalData: MeteorologicalDataAnalysis;
  atmosphericTransportAndDispersion: AtmosphericDispersionAnalysis;
  dosimetry: DosimetryAnalysis;
  healthEffects: HealthEffectsAnalysis;
  economicFactors: EconomicFactorsAnalysis;
  consequenceQuantification: ConsequenceQuantificationAnalysis;

  sensitivityStudies?: SensitivityStudy[];

  riskIntegrationFeedback?: RiskIntegrationFeedback;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  boundingSiteAssumptions?: PreOperationalAssumption[];

  documentation: RcDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const RC_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[]; subElement: RcSubElement }> = {
  "RCRE-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCRE-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCRE-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCRE-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCRE-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCRE-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCRE" },
  "RCPA-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A11": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A12": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A13": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-A14": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-B8": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCPA-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCPA" },
  "RCME-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-A11": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCME-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCME" },
  "RCAD-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C5": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-C6": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-D4": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E1": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E3": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E4": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E5": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E6": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-E7": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-F1": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-F2": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCAD-F3": { hlr: "F", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCAD" },
  "RCDO-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A8": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A9": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-A10": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCDO-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCDO" },
  "RCHE-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A6": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-A7": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCHE-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCHE" },
  "RCEC-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-B7": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCEC-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCEC" },
  "RCQ-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
  "RCQ-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"], subElement: "RCQ" },
};
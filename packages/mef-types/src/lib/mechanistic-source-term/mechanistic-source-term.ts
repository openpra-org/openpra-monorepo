import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { Named, Unique } from "../core/meta";
import { IdPatterns, ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis } from "../core/shared-patterns";
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
import { BaseEvent, BasicEvent, TopEvent } from "../core/events";
import { DistributionType } from "../data-analysis/data-analysis";
import {
  EventSequenceQuantification,
  BarrierStatus,
} from "../event-sequence-quantification/event-sequence-quantification";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export type ReleaseCategoryReference = string;
export type SourceTermDefinitionReference = string;
export type EventSequenceReference = string;
export enum ReleaseForm {
  ELEMENTAL = "ELEMENTAL",
  AEROSOL = "AEROSOL",
  DUST = "DUST",
  OTHER = "OTHER",
}
export type Radionuclide = string;
export interface ReleasePhase extends Unique {
  name: string;
  description?: string;
  startTime: number;
  endTime: number;
  timeUnit?: string;
}
export interface RadionuclideReleaseQuantity {
  radionuclide: Radionuclide;
  quantity: number;
  unit: string;
  uncertainty?: RadionuclideReleaseUncertainty;
}
export interface RadionuclideReleaseUncertainty {
  distributionType: DistributionType;
  parameters: Record<string, number>;
  description?: string;
}
export enum TransportPhenomenonType {
  BARRIER_FAILURE = "BARRIER_FAILURE",
  BARRIER_LEAKAGE = "BARRIER_LEAKAGE",
  DEPOSITION = "DEPOSITION",
  RESUSPENSION = "RESUSPENSION",
  CHEMICAL_INTERACTION = "CHEMICAL_INTERACTION",
  THERMAL_PROCESS = "THERMAL_PROCESS",
  MECHANICAL_PROCESS = "MECHANICAL_PROCESS",
  HEAT_GENERATION = "HEAT_GENERATION",
  HEAT_REMOVAL = "HEAT_REMOVAL",
  GASEOUS_TRANSPORT = "GASEOUS_TRANSPORT",
  SOLID_TRANSPORT = "SOLID_TRANSPORT",
  INVENTORY_RELOCATION = "INVENTORY_RELOCATION",
  EXPLOSION_EFFECTS = "EXPLOSION_EFFECTS",
  RADIONUCLIDE_TRANSFORMATION = "RADIONUCLIDE_TRANSFORMATION",
  OTHER = "OTHER",
}
export interface ReleaseCategory extends Unique, Named {
  description: string;
  eventSequenceFamilies: EventSequenceReference[];
  groupingJustification?: string;
  timingClassification?: string;
  magnitudeClassification?: string;
  boundingSequenceReference?: EventSequenceReference;
  boundingSequenceJustification?: string;
  releaseTerminationTime?: {
    value: number;
    unit: string;
    justification: string;
  };
  radiologicalConsequenceConsistency?: {
    description: string;
    justification: string;
  };
  preOperationalAssumptions?: {
    description: string;
    influence: string;
    basis?: string;
    validationNeeded?: string;
  }[];
}
export interface RadioactiveSource extends Unique, Named {
  description: string;
  radionuclides: Radionuclide[];
  totalInventory: Record<
    Radionuclide,
    {
      quantity: number;
      unit: string;
    }
  >;
  inventoryDataSource?: string;
  radionuclideSelectionBasis?: string;
  inventoryUncertainty?: {
    description: string;
    distributionType?: DistributionType;
    parameters?: Record<string, number>;
  };
}
export interface EventSequenceToReleaseCategoryMapping extends Unique {
  eventSequenceReference: EventSequenceReference;
  releaseCategoryReference: ReleaseCategoryReference;
  assignmentJustification: string;
  technicalBasis?: string;
  frequencyInformation?: {
    mean?: number;
    unit?: string;
    uncertainty?: {
      distributionType?: DistributionType;
      parameters?: Record<string, number>;
    };
  };
  processedByRiskIntegration?: boolean;
  riskIntegrationMappingId?: string;
  riskSignificance?: ImportanceLevel;
  riskIntegrationInsights?: string[];
}
export interface ReleaseCategoryBasis extends Unique {
  releaseCategoryReference: ReleaseCategoryReference;
  technicalBasis: string;
  supportingReferences?: string[];
  regulatoryAlignment?: string;
}
export interface RadionuclideTransportBarrier extends Unique, Named {
  description: string;
  barrierType: string;
  effectiveness?: string;
  failureConditions?: string[];
  affectedRadionuclides?: Radionuclide[];
  barrierReference?: string;
  status?: BarrierStatus;
  physicalChemicalConditions?: {
    temperature?: string;
    pressure?: string;
    flowRate?: string;
    chemicalEnvironment?: string;
    impactOnTransport: string;
  };
  transportMechanisms?: {
    mechanismType: TransportPhenomenonType;
    description: string;
    significance: ImportanceLevel;
  }[];
}
export interface TransportMechanism extends Unique, Named {
  description: string;
  mechanismType: string;
  activatingConditions?: string[];
  affectedRadionuclides?: Radionuclide[];
}
export interface TransportPhenomena extends Unique {
  releaseCategoryReference: ReleaseCategoryReference;
  phenomena: string[];
  phenomenaTypes?: TransportPhenomenonType[];
  modelsUsed: string[];
  relatedBarriers?: string[];
  relatedMechanisms?: string[];
  msB5Assessment?: {
    assessedPhenomena: {
      phenomenonType: TransportPhenomenonType;
      included: boolean;
      justification?: string;
    }[];
    assessmentJustification?: string;
  };
  consequenceQuantificationSupport?: {
    description: string;
    adequacyJustification: string;
  };
}
export interface SourceTermDefinition extends Unique {
  releaseCategoryReference: ReleaseCategoryReference;
  involvedReactors?: number;
  radionuclideReleases: {
    phase: ReleasePhase;
    quantities: RadionuclideReleaseQuantity[];
  }[];
  releaseForm: Record<Radionuclide, ReleaseForm | string>;
  releaseTiming: ReleasePhase[];
  warningTimeForEvacuation?: string;
  releaseEnergy?: {
    quantity: number;
    unit: string;
  };
  releaseElevation?: {
    quantity: number;
    unit: string;
  };
  sourceTermModelReference?: string;
  particleSizeDistribution?: {
    description: string;
    sizeRanges: {
      min: number;
      max: number;
      unit: string;
      fraction: number;
    }[];
  };
}
export interface SourceTermModel extends Unique, Named {
  version: string;
  technicalBasis: string;
  validationStatus: string;
  keyAssumptions?: string[];
  knownLimitations?: string[];
  references?: string[];
  applicableAreas?: string[];
}
export interface MechanisticSourceTermUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  sourceTermReference?: SourceTermDefinitionReference;
  releaseCategoryReference?: ReleaseCategoryReference;
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    description: string;
    impact: string;
    distributionType?: DistributionType;
    parameters?: Record<string, number>;
  }[];
  releaseFractionUncertainties?: {
    radionuclide: Radionuclide;
    description: string;
    distributionType: DistributionType;
    parameters: Record<string, number>;
  }[];
  uncertaintyPropagationResults?: {
    description: string;
    resultSummary: string;
    confidenceIntervals?: {
      level: number;
      lowerBound: number;
      upperBound: number;
    }[];
  };
  quantificationMethod?: {
    methodDescription: string;
    methodJustification?: string;
  };
  documentationOfResults?: string;
}
export interface MechanisticSourceTermSensitivityStudy extends SensitivityStudy {
  sourceTermReference?: SourceTermDefinitionReference;
  releaseCategoryReference?: ReleaseCategoryReference;
  parameterChanged: string;
  impactOnSourceTerm: string;
  isKeyDriver: boolean;
  recommendations?: string;
  keyUncertaintyImpactEvaluation?: {
    description: string;
    significance: ImportanceLevel;
  };
  documentationOfResults?: string;
}
export interface MechanisticSourceTermModelUncertaintyDocumentation extends BaseModelUncertaintyDocumentation {
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  sourceTermCharacterizationUncertainties?: {
    aspect: string;
    uncertaintySource: string;
    impact: string;
    treatmentApproach: string;
  }[];
  transportPhenomenaAlternatives?: {
    phenomenon: string;
    modelingApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  sourceTermDefinitionAlternatives?: {
    aspect: string;
    selectedApproach: string;
    alternativeApproach: string;
    reasonNotSelected: string;
  }[];
  preOperationalAssumptions?: {
    assumption: string;
    relatedArea: string;
    impact: string;
    resolutionApproach: string;
  }[];
  uncertaintyRequirementsLink?: {
    hlrMsDRequirements: string[];
    supportDescription: string;
  };
}
export interface MechanisticSourceTermProcessDocumentation extends BaseProcessDocumentation {
  radioactiveSourceCharacterizations?: Record<
    string,
    {
      source: RadioactiveSource["uuid"];
      description: string;
      inventoryBasis: string;
    }
  >;
  releaseCategoryBasis?: Record<ReleaseCategoryReference, string>;
  eventSequenceToReleaseCategoryMapping?: Record<
    EventSequenceReference,
    {
      releaseCategoryReference: ReleaseCategoryReference;
      justification: string;
    }
  >;
  transportPhenomenaDocumentation?: Record<
    ReleaseCategoryReference,
    {
      phenomena: string[];
      description: string;
    }
  >;
  sourceTermModelsDocumentation?: Record<
    string,
    {
      modelName: string;
      purpose: string;
      keyFeatures: string[];
    }
  >;
  uncertaintyAndSensitivityAnalysesDocumentation?: Record<
    SourceTermDefinitionReference,
    {
      analysisDescription: string;
      keyFindings: string[];
    }
  >;
  surrogateRiskMetricsDocumentation?: Record<
    string,
    {
      metricDefinition: string;
      relationshipToReleaseCategories: string;
    }
  >;
  sourceTermParametersDocumentation?: Record<
    SourceTermDefinitionReference,
    {
      parameterValues: string;
      uncertaintyAssessment: string;
    }
  >;
  riskIntegrationDocumentation?: {
    supportDescription: string;
    releaseCategoryUsage: string;
    sourceTermUsage: string;
    uncertaintyPropagation?: string;
    integrationChallenges?: string[];
    feedbackIncorporation?: string;
    keyInsights?: string[];
  };
}
export interface MechanisticSourceTermPreOperationalAssumptionsDocumentation
  extends BasePreOperationalAssumptionsDocumentation {
  transportBarrierAssumptions?: {
    barrier: string;
    assumption: string;
    impact: string;
    designInformationNeeded: string;
  }[];
  releaseTimingAssumptions?: {
    releaseCategory: ReleaseCategoryReference;
    assumption: string;
    impact: string;
    operationalInformationNeeded: string;
  }[];
  transportPhenomenaLimitations?: {
    phenomenon: string;
    limitation: string;
    workaround: string;
    informationNeeded: string;
  }[];
}
export interface MechanisticSourceTermAnalysis
  extends TechnicalElement<TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS> {
  additionalMetadata?: {
    limitations?: string[];
    assumptions?: string[];
    traceability?: string;
    eventSequenceQuantificationReferences?: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
    riskIntegrationReferences?: {
      analysisId: string;
      version?: string;
      date?: string;
      usageDescription: string;
    }[];
  };
  releaseCategories: Record<ReleaseCategoryReference, ReleaseCategory>;
  releaseCategoryBases: Record<ReleaseCategoryReference, ReleaseCategoryBasis>;
  eventSequenceToReleaseCategoryMappings: EventSequenceToReleaseCategoryMapping[];
  radioactiveSources: Record<string, RadioactiveSource>;
  radionuclideTransportBarriers: Record<string, RadionuclideTransportBarrier>;
  transportMechanisms: Record<string, TransportMechanism>;
  transportPhenomenaAnalysis: Record<string, TransportPhenomena>;
  sourceTermDefinitions: Record<SourceTermDefinitionReference, SourceTermDefinition>;
  sourceTermModels: Record<string, SourceTermModel>;
  releasePhases: Record<string, ReleasePhase>;
  uncertaintyAnalyses: Record<string, MechanisticSourceTermUncertaintyAnalysis>;
  sensitivityStudies: MechanisticSourceTermSensitivityStudy[];
  modelUncertaintyDocumentation: MechanisticSourceTermModelUncertaintyDocumentation;
  processDocumentation: MechanisticSourceTermProcessDocumentation;
  preOperationalAssumptionsDocumentation?: MechanisticSourceTermPreOperationalAssumptionsDocumentation;
  riskIntegrationFeedback?: {
    analysisId: string;
    feedbackDate?: string;
    releaseCategoryFeedback?: Record<
      ReleaseCategoryReference,
      {
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
        status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
      }
    >;
    sourceTermDefinitionFeedback?: Record<
      SourceTermDefinitionReference,
      {
        riskSignificance?: ImportanceLevel;
        insights?: string[];
        recommendations?: string[];
        keyUncertainties?: string[];
        status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
      }
    >;
    generalFeedback?: string;
    response?: {
      description: string;
      changes?: string[];
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
    };
  };
  riskIntegrationDescription?: {
    supportDescription: string;
    releaseCategoryUsage: string;
    sourceTermUsage: string;
    uncertaintyPropagation?: string;
    integrationChallenges?: string[];
    feedbackIncorporation?: string;
  };
}

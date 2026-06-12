import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { ParameterDistribution } from "../core/events";
import { ImportanceLevel, SensitivityStudy, BaseUncertaintyAnalysis } from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";

export type ReleaseCategoryReference = string;
export type SourceTermDefinitionReference = string;
export type EventSequenceReference = string;
export type RadioactiveSourceReference = string;
export type RadionuclideBarrierReference = string;
export type Radionuclide = string;

export enum ReleaseForm {
  ELEMENTAL = "ELEMENTAL",
  AEROSOL = "AEROSOL",
  DUST = "DUST",
  OTHER = "OTHER",
}

export enum TransportPhenomenonType {
  HEAT_GENERATION = "HEAT_GENERATION",
  HEAT_REMOVAL = "HEAT_REMOVAL",
  GASEOUS_TRANSPORT = "GASEOUS_TRANSPORT",
  SOLID_TRANSPORT = "SOLID_TRANSPORT",
  INVENTORY_RELOCATION = "INVENTORY_RELOCATION",
  CHEMICAL_PHYSICAL_FORM = "CHEMICAL_PHYSICAL_FORM",
  DEPOSITION = "DEPOSITION",
  RESUSPENSION = "RESUSPENSION",
  RADIONUCLIDE_DECAY_AND_BUILDUP = "RADIONUCLIDE_DECAY_AND_BUILDUP",
  EXPLOSION_EFFECTS = "EXPLOSION_EFFECTS",
  DESIGN_UNIQUE = "DESIGN_UNIQUE",
  OTHER = "OTHER",
}

export interface ReleasePhase extends Unique, Named {
  description?: string;
  startTime: number;
  endTime: number;
  timeUnit?: string;
}

export interface RadionuclideReleaseQuantity {
  radionuclide: Radionuclide;
  quantity: number;
  unit: string;
  expressedAsReleaseFraction?: boolean;
  uncertainty?: ParameterDistribution;
}

export interface ReleaseCategory extends Unique, Named {
  description: string;
  technicalBasis: string;
  supportingReferences?: string[];
  regulatoryAlignment?: string;
  groupingJustification?: string;
  differentiationBasis: "CONSEQUENCE_METRIC" | "CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION";
  timingClassification?: string;
  magnitudeClassification?: string;
  boundingSequenceReference: EventSequenceReference;
  boundingSequenceJustification?: string;
  releaseTerminationTime: {
    value: number;
    unit: string;
    justification: string;
  };
  implementsSrs: SRReference[];
}

export interface ReleaseCategoryCompletenessAssessment {
  setReasonablyComplete: boolean;
  consistencyWithConsequenceAnalysis: string;
  basis: string;
  implementsSrs: SRReference[];
}

export interface SourceInventory extends Unique, Named {
  radioactiveSourceRef?: RadioactiveSourceReference;
  description: string;
  calculationBasis: "GENERIC_ESTIMATE" | "PLANT_SPECIFIC_CALCULATION";
  inventory: {
    radionuclide: Radionuclide;
    quantity: number;
    unit: string;
    physicalForm?: ReleaseForm | string;
    chemicalForm?: string;
  }[];
  inventoryDataSource?: string;
  radionuclideSelectionBasis?: string;
  inventoryUncertainty?: {
    description: string;
    distribution?: ParameterDistribution;
  };
  implementsSrs: SRReference[];
}

export interface TransportBarrierAssessment extends Unique, Named {
  posBarrierRef?: RadionuclideBarrierReference;
  releaseCategoryReference: ReleaseCategoryReference;
  sourceInventoryRefs: string[];
  description: string;
  barrierType: string;
  failureModes?: string[];
  transportCharacteristics: {
    description: string;
    affectedRadionuclides?: Radionuclide[];
    retentionEffectiveness?: string;
  }[];
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
  implementsSrs: SRReference[];
}

export interface TransportMechanism extends Unique, Named {
  description: string;
  mechanismType: TransportPhenomenonType | string;
  activatingConditions?: string[];
  affectedRadionuclides?: Radionuclide[];
  implementsSrs: SRReference[];
}

export interface TransportPhenomenaAssessment extends Unique {
  releaseCategoryReference: ReleaseCategoryReference;
  phenomenaChecklist: {
    phenomenonType: TransportPhenomenonType;
    included: boolean;
    justification?: string;
  }[];
  designUniquePhenomena?: string[];
  modelsUsed: string[];
  relatedBarrierAssessmentRefs?: string[];
  relatedMechanismRefs?: string[];
  consequenceQuantificationSupport: {
    description: string;
    adequacyJustification: string;
    sufficientForRiskSignificantDifferentiation?: boolean;
  };
  implementsSrs: SRReference[];
}

export interface SourceTermDefinition extends Unique {
  releaseCategoryReference: ReleaseCategoryReference;
  sourceTermBasis: "GENERIC_APPLICABLE" | "PLANT_SPECIFIC_MECHANISTIC";
  genericApplicabilityJustification?: string;
  postProcessingModifications?: string[];
  riskSignificantCategoryCalculationConfirmed?: boolean;
  involvedReactors?: number;
  initiatingEventCharacteristics?: string;
  releasePhases: ReleasePhase[];
  radionuclideReleases: {
    phaseId: string;
    quantities: RadionuclideReleaseQuantity[];
  }[];
  releaseForms: {
    radionuclide: Radionuclide;
    form: ReleaseForm | string;
  }[];
  particleSizeDistribution?: {
    description: string;
    sizeRanges: {
      min: number;
      max: number;
      unit: string;
      fraction: number;
    }[];
  };
  warningTimeForEvacuation?: string;
  releaseEnergy?: {
    quantity: number;
    unit: string;
  };
  releaseElevation?: {
    quantity: number;
    unit: string;
  };
  sourceTermModelRefs?: string[];
  implementsSrs: SRReference[];
}

export interface SourceTermModel extends Unique, Named {
  version: string;
  technicalBasis: string;
  validationStatus: string;
  verificationValidationProcess?: string;
  applicabilityLimits?: string[];
  similarClassApplicationEvaluation?: string;
  keyAssumptions?: string[];
  knownLimitations?: string[];
  references?: string[];
  applicableAreas?: string[];
  implementsSrs: SRReference[];
}

export interface MsUncertaintyAnalysis extends BaseUncertaintyAnalysis {
  releaseCategoryReference: ReleaseCategoryReference;
  sourceTermDefinitionRef?: SourceTermDefinitionReference;
  uncertainInputParameters: {
    parameter: string;
    description: string;
    distribution?: ParameterDistribution;
  }[];
  componentEstimates: {
    component: string;
    valueType: "POINT_ESTIMATE" | "MEAN";
    isRiskSignificantFamily: boolean;
    probabilisticRepresentationProvided?: boolean;
    distribution?: ParameterDistribution;
  }[];
  expertJudgmentUsed?: boolean;
  expertJudgmentProcessSatisfied?: boolean;
  transportPhenomenaUncertainties?: {
    phenomenon: string;
    description: string;
    impact: string;
    distribution?: ParameterDistribution;
  }[];
  releaseFractionUncertainties?: {
    radionuclide: Radionuclide;
    description: string;
    distribution: ParameterDistribution;
  }[];
  characterizationLevel: "CHARACTERIZED" | "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES";
  phenomenaDependencies?: {
    description: string;
    dependentPhenomena: string[];
    treatmentMethod: string;
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
  implementsSrs: SRReference[];
}

export interface MsModelUncertaintyAssessment extends Unique {
  sourceBlock: "BARRIER_TRANSPORT_ASSESSMENT" | "SOURCE_TERM_CALCULATION";
  uncertaintySource: string;
  relatedAssumptions: string[];
  reasonableAlternatives?: string[];
  evaluationType: "QUALITATIVE" | "QUANTITATIVE";
  evaluationScope: "INDIVIDUAL" | "COMBINATION";
  consequenceEffect: string;
  implementsSrs: SRReference[];
}

export interface RiskIntegrationFeedback {
  analysisRef: string;
  feedbackDate?: string;
  releaseCategoryFeedback?: {
    releaseCategoryReference: ReleaseCategoryReference;
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    recommendations?: string[];
    status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
  }[];
  sourceTermFeedback?: {
    sourceTermDefinitionRef: SourceTermDefinitionReference;
    riskSignificance?: ImportanceLevel;
    insights?: string[];
    keyUncertainties?: string[];
    status?: "PENDING" | "IN_PROGRESS" | "ADDRESSED" | "DEFERRED";
  }[];
  generalFeedback?: string;
  response?: {
    description: string;
    changes?: string[];
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  };
}

export interface MsDocumentation {
  processDescription: string;
  inputsDescription: string;
  appliedMethods: string;
  resultsSummary: string;
  sourceCharacterizationAndInventories: string;
  releaseCategoryDefinitionBases: string;
  sequenceToReleaseCategoryAssignment: string;
  transportPhenomenaPerCategory: string;
  modelsAndComputerPrograms: string;
  uncertaintyAndSensitivityAnalyses: string;
  surrogateRiskMetrics: string;
  sourceTermParameterTables: string;
  modelUncertaintySources: string;
  asBuiltLimitations: string;
  praTaskInterfaces: string;
  implementsSrs: SRReference[];
}

export interface MechanisticSourceTermAnalysis
  extends TechnicalElement<TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS> {
  praScope: string;

  releaseCategories: ReleaseCategory[];
  releaseCategoryCompletenessAssessment: ReleaseCategoryCompletenessAssessment;

  sourceInventories: SourceInventory[];
  transportBarrierAssessments: TransportBarrierAssessment[];
  transportMechanisms?: TransportMechanism[];
  transportPhenomenaAssessments: TransportPhenomenaAssessment[];

  sourceTermDefinitions: SourceTermDefinition[];
  sourceTermModels?: SourceTermModel[];

  uncertaintyAnalyses: MsUncertaintyAnalysis[];
  modelUncertaintyAssessments?: MsModelUncertaintyAssessment[];
  sensitivityStudies?: SensitivityStudy[];

  riskIntegrationFeedback?: RiskIntegrationFeedback;

  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];

  documentation: MsDocumentation;

  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export const MS_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  "MS-A1": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-A2": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-A3": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-A4": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-A5": { hlr: "A", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B1": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B2": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B3": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B4": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B5": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B6": { hlr: "B", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-B7": { hlr: "B", stages: ["PRE_OPERATIONAL"] },
  "MS-C1": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C2": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C3": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C4": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C5": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C6": { hlr: "C", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-C7": { hlr: "C", stages: ["PRE_OPERATIONAL"] },
  "MS-D1": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-D2": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-D3": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-D4": { hlr: "D", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-E1": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-E2": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-E3": { hlr: "E", stages: ["OPERATIONAL", "PRE_OPERATIONAL"] },
  "MS-E4": { hlr: "E", stages: ["PRE_OPERATIONAL"] },
};

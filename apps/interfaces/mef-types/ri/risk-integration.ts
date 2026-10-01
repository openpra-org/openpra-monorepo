import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { Unique, Named } from "../core/meta";
import { EndState, ParameterDistribution } from "../core/events";
import {
  ImportanceLevel,
  SensitivityStudy,
  RiskMetricType,
  RiskSignificanceCriteriaType,
} from "../core/shared-patterns";
import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import type {
  EventSequenceFamilyQuantificationReference,
  EventSequenceFamilyWorkbookReference,
  RadiologicalConsequenceResultReference,
} from "../modeling/references";
import type { RcMetricQuantity, RcMetricReceptor, RcMetricWindow } from "../rc/metrics";

export type EventSequenceReference = string;
export type EventSequenceFamilyReference = string;
export type ReleaseCategoryReference = string;
export type SourceTermDefinitionReference = string;
export type RiskSignificanceCriteriaReference = string;

export interface RiskMetric extends Unique, Named {
  metricType: RiskMetricType | string;
  description?: string;
  consequenceMeasureRef?: string;
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

export interface RiConsequenceFloor {
  backgroundMremPerYear: RiCriterionValue<number>;
  windowDays: RiCriterionValue<number>;
  sharePercent: RiCriterionValue<number>;
}

export interface ReportingThresholds {
  minimumReportingFrequencyPerPlantYear: number;
  frequencyBasis: "STANDARD_DEFAULT" | "JUSTIFIED_ALTERNATIVE";
  frequencyJustification?: string;
  minimumReportingConsequenceDescription: string;
  consequenceBasis: "STANDARD_DEFAULT" | "JUSTIFIED_ALTERNATIVE";
  consequenceJustification?: string;
  consequenceFloor?: RiConsequenceFloor;
  implementsSrs: SRReference[];
}

export const PUBLISHED_REPORTING_FLOORS = {
  minimumReportingFrequencyPerPlantYear: 1e-7,
  backgroundMremPerYear: 300,
  windowDays: 30,
  sharePercent: 10,
};

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
  eventSequenceFamilyReference?: EventSequenceFamilyWorkbookReference;
  releaseCategoryRef?: ReleaseCategoryReference;
  sourceTermDefinitionRef?: SourceTermDefinitionReference;
  frequency: number;
  frequencyUnit?: string;
  frequencyDistribution?: ParameterDistribution;
  esqFamilyQuantificationRef?: string;
  familyQuantificationReferences?: EventSequenceFamilyQuantificationReference[];
  consequences: {
    metric: string;
    meanValue: number;
    unit?: string;
    distribution?: ParameterDistribution;
  }[];
  rcqRecordRef?: string;
  consequenceResultReference?: RadiologicalConsequenceResultReference;
  consistentWithEventSequenceAnalysis?: boolean;
  consistentWithMechanisticSourceTerm?: boolean;
  implementsSrs: SRReference[];
}

export interface RiHazardGroupAssignment {
  initiatingEventId: string;
  hazardGroup: string;
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
  hazardGroupAssignments?: RiHazardGroupAssignment[];
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
  significantInitiatingEvents?: RiskContributor[];
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
    significanceReason?: string;
      insights?: string[];
      recommendations?: string[];
    }[];
    contributorFeedback?: {
      entityRef: string;
      riskSignificance?: ImportanceLevel;
    significanceReason?: string;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
  mechanisticSourceTermFeedback?: {
    releaseCategoryFeedback?: {
      releaseCategoryRef: ReleaseCategoryReference;
      riskSignificance?: ImportanceLevel;
    significanceReason?: string;
      insights?: string[];
      recommendations?: string[];
    }[];
    sourceTermFeedback?: {
      sourceTermDefinitionRef: SourceTermDefinitionReference;
      riskSignificance?: ImportanceLevel;
    significanceReason?: string;
      insights?: string[];
      keyUncertainties?: string[];
    }[];
    generalFeedback?: string;
  };
  radiologicalConsequenceFeedback?: {
    metricFeedback?: {
      metric: string;
      riskSignificance?: ImportanceLevel;
    significanceReason?: string;
      insights?: string[];
      recommendations?: string[];
    }[];
    generalFeedback?: string;
  };
  additionalElementFeedback?: {
    elementCode: "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA";
    riskSignificance?: ImportanceLevel;
    significanceReason?: string;
    insights?: string[];
    recommendations?: string[];
    generalFeedback?: string;
  }[];
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

export type RiLicensingAction =
  | "PRE_APPLICATION"
  | "CONSTRUCTION_PERMIT"
  | "OPERATING_LICENSE"
  | "DESIGN_CERTIFICATION"
  | "COMBINED_LICENSE"
  | "STANDARD_DESIGN_APPROVAL"
  | "MANUFACTURING_LICENSE";

export type RiSiteBasis = "SITE_INDEPENDENT" | "BOUNDING_SITE" | "SPECIFIC_SITE";

export type RiScopeAspect = "HAZARD_GROUP" | "OPERATING_STATE" | "SOURCE" | "MODULE";

export interface RiScopeExclusion {
  aspect: RiScopeAspect;
  item: string;
  reason: string;
}

export interface RiLinkedWorkbooks {
  POS?: string;
  ES?: string;
  ESQ?: string;
  MS?: string;
  RC?: string;
}

export type RiStatistic = "MEAN" | "P05" | "P50" | "P95";

export interface RiCriterionValue<T> {
  value: T;
  justification?: string;
}

export interface RiFcAnchor {
  doseRem: number;
  frequencyPerPlantYear: number;
  justification?: string;
}

export type RiCumulativeTargetId = "DOSE_100_MREM_EXCEEDANCE" | "EARLY_FATALITY_RISK" | "LATENT_CANCER_RISK";

export interface RiCumulativeTarget {
  id: RiCumulativeTargetId;
  limitPerPlantYear: number;
  justification?: string;
}

export interface RiAbsoluteCriteria {
  fcAnchors: RiFcAnchor[];
  fcStatistic: RiCriterionValue<RiStatistic>;
  aooLowerPerPlantYear: RiCriterionValue<number>;
  dbeLowerPerPlantYear: RiCriterionValue<number>;
  bdbeLowerPerPlantYear: RiCriterionValue<number>;
  categoryStatistic: RiCriterionValue<RiStatistic>;
  bandLowerStatistic: RiCriterionValue<RiStatistic>;
  bandUpperStatistic: RiCriterionValue<RiStatistic>;
  bdbeFloorStatistic: RiCriterionValue<RiStatistic>;
  highConsequenceDoseRem?: RiCriterionValue<number>;
  highConsequenceStatistic?: RiCriterionValue<RiStatistic>;
  lbeTargetPercent: RiCriterionValue<number>;
  lbeDoseFloorMrem: RiCriterionValue<number>;
  lbeFrequencyStatistic: RiCriterionValue<RiStatistic>;
  lbeDoseStatistic: RiCriterionValue<RiStatistic>;
  sscTargetStatistic: RiCriterionValue<RiStatistic>;
  sscCumulativePercent: RiCriterionValue<number>;
  sscCumulativeStatistic: RiCriterionValue<RiStatistic>;
  cumulativeTargets: RiCumulativeTarget[];
  cumulativeStatistic: RiCriterionValue<RiStatistic>;
}

export interface RiRelativeCriteria {
  aggregatePercent: RiCriterionValue<number>;
  individualPercent: RiCriterionValue<number>;
  fussellVesely: RiCriterionValue<number>;
  riskAchievementWorth: RiCriterionValue<number>;
}

export interface RiCriteriaSet {
  publishedSet: "NEI_18_04_REV1";
  absolute: RiAbsoluteCriteria;
  relative: RiRelativeCriteria;
}

export type RiResolvedAbsoluteCriteria = Required<RiAbsoluteCriteria>;

export interface RiResolvedCriteriaSet extends RiCriteriaSet {
  absolute: RiResolvedAbsoluteCriteria;
}

export const PUBLISHED_RI_CRITERIA: RiResolvedCriteriaSet = {
  publishedSet: "NEI_18_04_REV1",
  absolute: {
    fcAnchors: [
      { doseRem: 0.1, frequencyPerPlantYear: 1 },
      { doseRem: 1, frequencyPerPlantYear: 1e-1 },
      { doseRem: 1, frequencyPerPlantYear: 1e-2 },
      { doseRem: 25, frequencyPerPlantYear: 1e-4 },
      { doseRem: 750, frequencyPerPlantYear: 5e-7 },
    ],
    fcStatistic: { value: "MEAN" },
    aooLowerPerPlantYear: { value: 1e-2 },
    dbeLowerPerPlantYear: { value: 1e-4 },
    bdbeLowerPerPlantYear: { value: 5e-7 },
    categoryStatistic: { value: "MEAN" },
    bandLowerStatistic: { value: "P05" },
    bandUpperStatistic: { value: "P95" },
    bdbeFloorStatistic: { value: "P95" },
    highConsequenceDoseRem: { value: 25 },
    highConsequenceStatistic: { value: "MEAN" },
    lbeTargetPercent: { value: 1 },
    lbeDoseFloorMrem: { value: 2.5 },
    lbeFrequencyStatistic: { value: "P95" },
    lbeDoseStatistic: { value: "P95" },
    sscTargetStatistic: { value: "P95" },
    sscCumulativePercent: { value: 1 },
    sscCumulativeStatistic: { value: "MEAN" },
    cumulativeTargets: [
      { id: "DOSE_100_MREM_EXCEEDANCE", limitPerPlantYear: 1 },
      { id: "EARLY_FATALITY_RISK", limitPerPlantYear: 5e-7 },
      { id: "LATENT_CANCER_RISK", limitPerPlantYear: 2e-6 },
    ],
    cumulativeStatistic: { value: "MEAN" },
  },
  relative: {
    aggregatePercent: { value: 95 },
    individualPercent: { value: 1 },
    fussellVesely: { value: 0.005 },
    riskAchievementWorth: { value: 2 },
  },
};

export interface RiFrequencyStats {
  mean: number;
  p05?: number;
  p50?: number;
  p95?: number;
}

export type RiFrequencySource = "ESQ" | "ES";

export interface RiManualEntry {
  source: string;
}

export interface RiUnavailableResult {
  measure: string;
  reason: string;
}

export interface RiInputSource {
  element: "ES" | "ESQ" | "RC";
  workbookId: string;
  workbookName: string;
  updatedAt?: string;
}

export interface RiInputFamily {
  id: string;
  name: string;
  plantOperatingStateId: string;
  initiatingEventId: string;
  releaseCategoryIds: string[];
  endState: EndState;
  memberSequenceIds: string[];
  frequencySource?: RiFrequencySource;
  quantificationIds: string[];
  imported?: RiFrequencyStats;
  frequency?: RiFrequencyStats;
  changeReason?: string;
  included: boolean;
  exclusionReason?: string;
  manual?: RiManualEntry;
}

export interface RiTopEventState {
  event: string;
  state: "SUCCESS" | "FAILURE" | "BYPASSED";
}

export interface RiInputSequence {
  id: string;
  name: string;
  familyId?: string;
  plantOperatingStateId: string;
  initiatingEventId: string;
  topEvents: RiTopEventState[];
  endState: EndState;
  releaseCategoryId?: string;
  reactorSourceCombinations: string[];
  frequencySource?: RiFrequencySource;
  imported?: RiFrequencyStats;
  frequency?: RiFrequencyStats;
  changeReason?: string;
  manual?: RiManualEntry;
}

export interface RiConsequenceStats {
  mean?: number;
  percentiles: { percentile: number; value: number }[];
  exceedances: { threshold: number; probability: number }[];
}

export interface RiInputConsequence {
  releaseCategoryId: string;
  measure: string;
  rcMetricId: string;
  unit: string;
  sourceTermId?: string;
  imported?: RiConsequenceStats;
  statistics: RiConsequenceStats;
  changeReason?: string;
  manual?: RiManualEntry;
}

export interface RiInputContributor {
  familyId: string;
  quantificationId: string;
  quantificationMean: number;
  name: string;
  type: string;
  fraction: number;
  manual?: RiManualEntry;
}

export interface RiInputImportance {
  analysisId: string;
  scope: "OVERALL" | "PER_FAMILY" | "PER_SEQUENCE";
  familyRef?: string;
  sequenceRef?: string;
  entityType: string;
  entity: string;
  systemRef?: string;
  fussellVesely?: number;
  riskAchievementWorth?: number;
  riskReductionWorth?: number;
  birnbaum?: number;
  manual?: RiManualEntry;
}

export interface RiInputs {
  importedAt?: string;
  sources: RiInputSource[];
  families: RiInputFamily[];
  sequences: RiInputSequence[];
  consequences: RiInputConsequence[];
  contributors?: RiInputContributor[];
  importance?: RiInputImportance[];
  unavailable?: RiUnavailableResult[];
}

export interface RiSscAssignment {
  contributor: string;
  ssc: string;
}

export type RiCliffEdgeStatus = "NO_CLIFF_EDGE" | "CLIFF_EDGE";

export interface RiCliffEdgeCheck {
  familyId: string;
  status?: RiCliffEdgeStatus;
  basis: string;
}

export interface RiEventCategories {
  cliffEdgeChecks: RiCliffEdgeCheck[];
}

export interface RiApplicationContext {
  applicationType: RiskSignificanceCriteria["applicationType"];
  licensingAction?: RiLicensingAction;
  siteBasis?: RiSiteBasis;
  linkedWorkbooks: RiLinkedWorkbooks;
}

export interface RiskIntegration extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
  praScope: string;
  applicationContext?: RiApplicationContext;
  criteriaSet?: RiCriteriaSet;
  inputs?: RiInputs;
  eventCategories?: RiEventCategories;
  sscAssignments?: RiSscAssignment[];

  scopeDefinition: {
    consequenceMeasures: ConsequenceMeasure[];
    plantOperatingStateRefs: string[];
    hazardGroups: string[];
    radioactiveMaterialSources: string[];
    reactorModules?: string[];
    scopeExclusions?: RiScopeExclusion[];
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
  exampleDocuments?: ExampleDocumentRef[];
  newlyDevelopedMethodIds?: string[];
}

export type RiMeasureRole = "EAB_DOSE" | "EARLY_FATALITY_RISK" | "LATENT_CANCER_RISK";

export interface ConsequenceMeasure {
  name: string;
  description?: string;
  role?: RiMeasureRole;
  quantity?: RcMetricQuantity;
  customUnit?: string;
  receptor?: RcMetricReceptor;
  window?: RcMetricWindow;
  protectiveActionsCredited?: boolean;
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

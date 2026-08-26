import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";
import { SHA_SR_CATALOG, SeismicHazardAnalysis } from "../sha/seismic-hazard-analysis";
import { SFR_SR_CATALOG, SeismicFragilityAnalysis } from "../sfr/seismic-fragility-analysis";
import { SPR_SR_CATALOG, SeismicPlantResponseAnalysis } from "../spr/seismic-plant-response-analysis";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import type { HazardConditionedMethodModels } from "../hazard-conditioned-models";
import { SeismicPraInterfaceRecord, SeismicPraSubelement } from "./seismic-pra-common";

export interface SeismicPraApplication extends Unique, Named {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  consumingElementRefs: string[];
  configurationBasis: string;
  limitations: string[];
  evidenceRefs: string[];
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "SUPERSEDED";
}

export interface SeismicPraEvidenceRecord extends Unique, Named {
  evidenceType: "DATA" | "MODEL" | "CALCULATION" | "DOCUMENT" | "REVIEW" | "DECISION" | "OTHER";
  sourceReference: string;
  revision?: string;
  effectiveDate?: string;
  owner: string;
  applicableSubelements: SeismicPraSubelement[];
  applicability: string;
  qualityAndLimitations: string;
  fileReference?: string;
  supersedesEvidenceRef?: string;
  status: "DRAFT" | "CONTROLLED" | "SUPERSEDED";
  implementsSrs: SRReference[];
}

export type BaselinePraTechnicalArea =
  | "PLANT_OPERATING_STATES"
  | "INITIATING_EVENTS"
  | "EVENT_SEQUENCES"
  | "SUCCESS_CRITERIA"
  | "SYSTEMS"
  | "DATA"
  | "HUMAN_RELIABILITY"
  | "INTERNAL_FIRE"
  | "INTERNAL_FLOOD"
  | "EXTERNAL_HAZARDS"
  | "RISK_INTEGRATION"
  | "SEISMIC_LOGIC";

export interface BaselinePraRecordTreatment extends Unique, Named {
  technicalArea: BaselinePraTechnicalArea;
  sourceRecordRefs: string[];
  treatment: "REUSED" | "MODIFIED" | "NEW" | "NOT_APPLICABLE";
  seismicChange: string;
  owner: string;
  status: "CONFIRMED" | "OPEN";
}

export interface BaselinePraDefinition {
  modelName: string;
  modelReference: string;
  sourceEvidenceRef: string;
  revision: string;
  freezeDate: string;
  freezeStatus: "WORKING" | "FROZEN" | "REFERENCE_ONLY";
  modelBoundary: string;
  nonSeismicHazardModelRefs: string[];
  recordTreatments: BaselinePraRecordTreatment[];
  unresolvedInterfaces: string[];
}

export interface SeismicPraConsistencyCheck extends Unique, Named {
  checkType:
    | "GROUND_MOTION_PARAMETER"
    | "CONTROL_POINT"
    | "SPECTRAL_SHAPE"
    | "HAZARD_RANGE"
    | "SEISMIC_EQUIPMENT_LIST"
    | "FAILURE_MODE"
    | "FRAGILITY_CORRELATION"
    | "HAZARD_FRAGILITY_INTEGRATION"
    | "SECONDARY_HAZARD"
    | "PLANT_STAGE"
    | "CAPABILITY_CATEGORY"
    | "OTHER";
  subelements: SeismicPraSubelement[];
  comparedRefs: string[];
  method: string;
  result: "PASS" | "OPEN" | "FAIL" | "NOT_APPLICABLE";
  evidence: string;
  openItems: string[];
  implementsSrs: SRReference[];
}

export interface SeismicPraCoverageSummary {
  sprEquipmentCount: number;
  fragilityScopeEquipmentCount: number;
  quantifiedFragilityCount: number;
  unlinkedEquipmentRefs: string[];
  unmodeledFailureModeRefs: string[];
  retainedSecondaryHazardRefs: string[];
  modeledSecondaryHazardRefs: string[];
  coverageBasis: string;
}

export interface SeismicPraIntegration {
  interfaces: SeismicPraInterfaceRecord[];
  consistencyChecks: SeismicPraConsistencyCheck[];
  coverage: SeismicPraCoverageSummary;
  selectedGroundMotionParameterRefs: string[];
  selectedControlPointRefs: string[];
  hazardCurveRefs: string[];
  responseSpectrumRefs: string[];
  hazardIntervalRefs: string[];
  seismicEquipmentListRef: string;
  fragilityResultRefs: string[];
  eventSequenceFamilyQuantificationRefs: string[];
  externalFloodingAnalysisRefs: string[];
  eventSequenceQuantificationRefs: string[];
  riskIntegrationRefs: string[];
  integrationMethod: string;
  unresolvedInterfaces: string[];
  implementsSrs: SRReference[];
}

export interface IntegratedSeismicPraUncertainty extends Unique, Named {
  sourceSubelement: SeismicPraSubelement;
  sourceUncertaintyRef: string;
  affectedSubelements: SeismicPraSubelement[];
  affectedEventSequenceFamilyRefs: string[];
  uncertaintyType: "PARAMETER" | "MODEL" | "ASSUMPTION";
  dependencyAndCorrelationTreatment: string;
  propagationOrSensitivityTreatment: string;
  combinedEffect: string;
  importance: ImportanceLevel;
  sensitivityStudyRefs: string[];
  closureOrRefinementActions: string[];
  implementsSrs: SRReference[];
}

export type SeismicRefinementArea =
  | "EVIDENCE"
  | "PLANT_DEMAND"
  | "FRAGILITY"
  | "PLANT_RESPONSE"
  | "HUMAN_RELIABILITY";

export interface SeismicModelRefinement extends Unique, Named {
  technicalArea: SeismicRefinementArea;
  driverRefs: string[];
  affectedRecordRefs: string[];
  refinement: string;
  evidenceRefs: string[];
  expectedEffect: string;
  priority: ImportanceLevel;
  status: "PROPOSED" | "IN_PROGRESS" | "REQUANTIFIED" | "CLOSED";
  quantificationIterationRef?: string;
  result: string;
  decisionBasis: string;
  implementsSrs: SRReference[];
}

export interface SeismicRefinementIteration extends Unique, Named {
  modelVersion: string;
  calculationDate: string;
  refinementActionRefs: string[];
  aggregateReleaseFamilyMeanFrequency: number;
  previousAggregateReleaseFamilyMeanFrequency?: number;
  relativeChange?: number;
  maximumFamilyRelativeChange?: number;
  topContributorRefs: string[];
  contributorRankingStable: boolean;
  newRiskSignificantContributorRefs: string[];
  decision: "CONTINUE_REFINEMENT" | "ACCEPT_STABLE";
  basis: string;
  implementsSrs: SRReference[];
}

export interface SeismicRefinementStoppingCriteria {
  maximumAggregateFrequencyChange: number;
  maximumFamilyFrequencyChange: number;
  maximumContributorRankShift: number;
  requiredStableIterations: number;
  requireNoNewRiskSignificantContributors: boolean;
  basis: string;
}

export interface SeismicRiskInterpretation {
  refinementActions: SeismicModelRefinement[];
  quantificationIterations: SeismicRefinementIteration[];
  stoppingCriteria: SeismicRefinementStoppingCriteria;
}

export interface SeismicRiskIntegrationResult extends Unique, Named {
  modelVersion: string;
  plantOperatingStateRefs: string[];
  unitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  initiatingEventRefs: string[];
  eventSequenceFamilyRefs: string[];
  releaseCategoryRefs: string[];
  aggregateReleaseFamilyMeanFrequency: number;
  frequencyUnit: "PER_PLANT_YEAR";
  uncertaintyRange?: {
    lowerBound: number;
    upperBound: number;
    confidenceLevel: number;
  };
  internalEventsRiskRef: string;
  otherHazardRiskRefs: string[];
  overlapTreatment: string;
  crossHazardIntegrationBasis: string;
  riskIntegrationResultRef: string;
  dominantContributorRefs: string[];
  status: "DRAFT" | "READY_FOR_RISK_INTEGRATION" | "ACCEPTED_BY_RISK_INTEGRATION";
  implementsSrs: SRReference[];
}

export type SeismicDecisionType =
  | "DESIGN"
  | "CONFIGURATION_CONTROL"
  | "PROCEDURE"
  | "MONITORING"
  | "DATA_COLLECTION"
  | "DEFENSE_IN_DEPTH_INPUT"
  | "SSC_CLASSIFICATION_INPUT"
  | "MODEL_CONTROL";

export interface SeismicRiskDecision extends Unique, Named {
  decisionType: SeismicDecisionType;
  driverRefs: string[];
  affectedSscRefs: string[];
  action: string;
  owner: string;
  duePhase: string;
  disposition:
    | "IMPLEMENT"
    | "MONITOR"
    | "CONFIRM_PRE_OPERATIONAL"
    | "RETAIN_CURRENT_BASIS"
    | "FORWARD_TO_PLANT_PROCESS";
  verificationRefs: string[];
  reanalysisRequired: boolean;
  riskIntegrationResultRef: string;
  basis: string;
  implementsSrs: SRReference[];
}

export interface SeismicRiskTraceabilityPath extends Unique, Named {
  evidenceRefs: string[];
  hazardRefs: string[];
  responseRefs: string[];
  sscRefs: string[];
  failureMechanismRefs: string[];
  fragilityRefs: string[];
  plantModelRefs: string[];
  humanActionRefs: string[];
  eventSequenceRefs: string[];
  eventSequenceFamilyRef: string;
  releaseCategoryRef: string;
  riskIntegrationResultRef: string;
  decisionRefs: string[];
  status: "PASS" | "OPEN";
  openItems: string[];
}

export interface SeismicControlledBaseline extends Unique, Named {
  modelVersion: string;
  configurationControlRecordId: string;
  quantificationRunRef: string;
  riskIntegrationHandoffRef: string;
  controlledDocumentRefs: string[];
  peerReviewRef: string;
  peerReviewStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  openFindingRefs: string[];
  approvalStatus: "NOT_SUBMITTED" | "IN_REVIEW" | "APPROVED";
  approvedBy?: string;
  approvalDate?: string;
  releaseStatus: "WORKING" | "CONTROLLED" | "SUPERSEDED";
  releaseDate?: string;
  scopeLimitations: string[];
  basis: string;
}

export interface SeismicRiskIntegrationBaseline {
  result: SeismicRiskIntegrationResult;
  decisions: SeismicRiskDecision[];
  traceabilityPaths: SeismicRiskTraceabilityPath[];
  baseline: SeismicControlledBaseline;
}

export interface SeismicPraPeerReviewBasis {
  peerReviewIds: string[];
  systemsEngineeringCoverage: string;
  seismicHazardCoverage: string;
  seismicCapabilityCoverage: string;
  seismicPraCoverage: string;
  fragilityWalkdownExperienceCoverage: string;
  methodologyReviewScope: string;
  openFindingRefs: string[];
}

export interface SeismicPraDocumentation {
  overallProcessDescription: string;
  shaSummary: string;
  sfrSummary: string;
  sprSummary: string;
  subelementInterfaceDescription: string;
  integratedResultsSummary: string;
  integratedRiskInsights: string;
  integratedUncertaintySummary: string;
  preOperationalAndBoundingSiteLimitations?: string;
  configurationControlDescription: string;
  peerReviewBasis: SeismicPraPeerReviewBasis;
  supportingDocumentRefs: string[];
  traceabilityMatrix: {
    requirement: string;
    subelement: SeismicPraSubelement;
    dataRefs: string[];
    modelRefs: string[];
    resultRefs: string[];
    documentationRefs: string[];
  }[];
}

export interface SeismicPraExampleDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export interface SeismicPRA extends TechnicalElement<TechnicalElementTypes.SEISMIC_PRA> {
  praScope: string;
  hazardConditionedModels: HazardConditionedMethodModels;
  applications: SeismicPraApplication[];
  evidenceRegister: SeismicPraEvidenceRecord[];
  baselinePra?: BaselinePraDefinition;
  seismicHazardAnalysis: SeismicHazardAnalysis;
  seismicFragilityAnalysis: SeismicFragilityAnalysis;
  seismicPlantResponseAnalysis: SeismicPlantResponseAnalysis;
  integration: SeismicPraIntegration;
  integratedUncertainties: IntegratedSeismicPraUncertainty[];
  integratedSensitivityStudies: SensitivityStudy[];
  riskInterpretation: SeismicRiskInterpretation;
  riskIntegrationBaseline: SeismicRiskIntegrationBaseline;
  modelUncertainty: BaseModelUncertaintyDocumentation;
  preOperationalAssumptions?: PreOperationalAssumption[];
  documentation: SeismicPraDocumentation;
  configurationControlRecordId?: string;
  exampleDocuments?: SeismicPraExampleDocument[];
  newlyDevelopedMethodIds?: string[];
}

export const SEISMIC_PRA_SR_CATALOG: Record<string, { hlr: HlrId; stages: PlantStage[] }> = {
  ...SHA_SR_CATALOG,
  ...SFR_SR_CATALOG,
  ...SPR_SR_CATALOG,
};

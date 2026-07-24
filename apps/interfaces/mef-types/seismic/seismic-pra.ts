import { BaseModelUncertaintyDocumentation, PreOperationalAssumption } from "../core/documentation";
import { Named, Unique } from "../core/meta";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { ImportanceLevel, SensitivityStudy } from "../core/shared-patterns";
import { SHA_SR_CATALOG, SeismicHazardAnalysis } from "../sha/seismic-hazard-analysis";
import { SFR_SR_CATALOG, SeismicFragilityAnalysis } from "../sfr/seismic-fragility-analysis";
import { SPR_SR_CATALOG, SeismicPlantResponseAnalysis } from "../spr/seismic-plant-response-analysis";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
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

export interface SeismicPraConfigurationBaseline extends Unique, Named {
  asOfDate: string;
  plantConfigurationRefs: string[];
  modelVersionRefs: string[];
  dataCutoffDates: {
    area: string;
    cutoffDate: string;
    basis: string;
  }[];
  assumptions: string[];
  changeControlProcess: string;
  openItems: string[];
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
  scopeAndApplications: string;
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
  applications: SeismicPraApplication[];
  evidenceRegister: SeismicPraEvidenceRecord[];
  configurationBaseline: SeismicPraConfigurationBaseline;
  seismicHazardAnalysis: SeismicHazardAnalysis;
  seismicFragilityAnalysis: SeismicFragilityAnalysis;
  seismicPlantResponseAnalysis: SeismicPlantResponseAnalysis;
  integration: SeismicPraIntegration;
  integratedUncertainties: IntegratedSeismicPraUncertainty[];
  integratedSensitivityStudies: SensitivityStudy[];
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

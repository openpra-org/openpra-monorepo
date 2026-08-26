import { InternalFloodEventSequenceQuantification, FLESQ_SR_CATALOG } from "../flesq/internal-flood-event-sequence-quantification";
import type { HazardConditionedMethodModels } from "../hazard-conditioned-models";
import { InternalFloodInitiatingEvents, FLEV_SR_CATALOG } from "../flev/internal-flood-initiating-events";
import { FLHR_SR_CATALOG, InternalFloodHumanReliabilityAnalysis } from "../flhr/internal-flood-human-reliability-analysis";
import { FLPP_SR_CATALOG, InternalFloodPlantPartitioning } from "../flpp/internal-flood-plant-partitioning";
import { FLPR_SR_CATALOG, InternalFloodPlantResponseModel } from "../flpr/internal-flood-plant-response-model";
import { FLSN_SR_CATALOG, InternalFloodScenariosDevelopment } from "../flsn/internal-flood-scenarios-development";
import { FLSO_SR_CATALOG, InternalFloodSourcesIdentificationAndCharacterization } from "../flso/internal-flood-sources-identification-and-characterization";
import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { InternalFloodAnalysisRecord, InternalFloodModelUncertainty, InternalFloodPraInterfaceRecord, InternalFloodSrCatalogEntry } from "./internal-flood-pra-common";

export * from "./internal-flood-pra-common";
export * from "../flpp/internal-flood-plant-partitioning";
export * from "../flso/internal-flood-sources-identification-and-characterization";
export * from "../flsn/internal-flood-scenarios-development";
export * from "../flev/internal-flood-initiating-events";
export * from "../flpr/internal-flood-plant-response-model";
export * from "../flhr/internal-flood-human-reliability-analysis";
export * from "../flesq/internal-flood-event-sequence-quantification";

export interface InternalFloodPraApplication extends InternalFloodAnalysisRecord {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  consumingElementRefs: string[];
  configurationBasis: string;
  limitations: string[];
}

export interface InternalFloodPraEvidenceRecord extends InternalFloodAnalysisRecord {
  evidenceType: "DRAWING" | "CALCULATION" | "PROCEDURE" | "DATA" | "MODEL" | "WALKDOWN" | "INTERVIEW" | "REVIEW" | "OTHER";
  sourceReference: string;
  revision?: string;
  effectiveDate?: string;
  applicableSubelements: ("FLPP" | "FLSO" | "FLSN" | "FLEV" | "FLPR" | "FLHR" | "FLESQ")[];
  applicability: string;
  qualityAndLimitations: string;
  fileReference?: string;
  supersedesEvidenceRef?: string;
  controlled: boolean;
}

export interface InternalFloodBaselinePraRecordTreatment extends InternalFloodAnalysisRecord {
  technicalArea: "PLANT_OPERATING_STATES" | "INITIATING_EVENTS" | "EVENT_SEQUENCES" | "SUCCESS_CRITERIA" | "SYSTEMS" | "DATA" | "HUMAN_RELIABILITY" | "RISK_INTEGRATION";
  sourceRecordRefs: string[];
  treatment: "REUSED" | "MODIFIED" | "NEW" | "NOT_APPLICABLE";
  internalFloodChange: string;
  unresolvedItems: string[];
}

export interface InternalFloodBaselinePraDefinition {
  modelName: string;
  modelReference: string;
  revision: string;
  freezeDate: string;
  freezeStatus: "WORKING" | "FROZEN" | "REFERENCE_ONLY";
  modelBoundary: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  recordTreatments: InternalFloodBaselinePraRecordTreatment[];
  unresolvedInterfaces: string[];
}

export interface InternalFloodConsistencyCheck extends InternalFloodAnalysisRecord {
  checkType: "AREA_SOURCE" | "SOURCE_RELEASE" | "PATH_SCENARIO" | "SCENARIO_INITIATOR" | "SCENARIO_TARGET" | "TARGET_SYSTEM_MODEL" | "HFE_CONTEXT" | "FREQUENCY_RECONCILIATION" | "TRACEABILITY" | "OTHER";
  subelements: ("FLPP" | "FLSO" | "FLSN" | "FLEV" | "FLPR" | "FLHR" | "FLESQ")[];
  comparedRefs: string[];
  method: string;
  result: "PASS" | "OPEN" | "FAIL" | "NOT_APPLICABLE";
  openItems: string[];
}

export interface InternalFloodPraIntegration {
  interfaces: InternalFloodPraInterfaceRecord[];
  consistencyChecks: InternalFloodConsistencyCheck[];
  selectedFloodAreaRefs: string[];
  selectedFloodSourceRefs: string[];
  retainedFloodScenarioRefs: string[];
  initiatingEventRefs: string[];
  plantResponseModelRefs: string[];
  humanFailureEventRefs: string[];
  quantificationResultRefs: string[];
  unresolvedInterfaces: string[];
  integrationMethod: string;
}

export interface InternalFloodRiskInsight extends InternalFloodAnalysisRecord {
  insightType: "DOMINANT_CONTRIBUTOR" | "DEFENSE_IN_DEPTH" | "MODEL_LIMITATION" | "UNCERTAINTY" | "DESIGN_OPPORTUNITY";
  contributorRefs: string[];
  affectedRiskMetric: string;
  fractionalContribution?: number;
  decisionImplication: string;
}

export interface InternalFloodModelRefinement extends InternalFloodAnalysisRecord {
  technicalArea: "EVIDENCE" | "PARTITIONING" | "SOURCE" | "SCENARIO" | "FREQUENCY" | "PLANT_RESPONSE" | "HRA" | "QUANTIFICATION";
  driverRefs: string[];
  affectedRecordRefs: string[];
  refinement: string;
  expectedEffect: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  refinementStatus: "PROPOSED" | "IN_PROGRESS" | "REQUANTIFIED" | "CLOSED";
  quantificationIterationRef?: string;
  result: string;
  decisionBasis: string;
}

export interface InternalFloodRefinementIteration extends InternalFloodAnalysisRecord {
  modelVersion: string;
  calculationDate: string;
  refinementActionRefs: string[];
  aggregateMeanFrequencyPerPlantYear: number;
  previousAggregateMeanFrequencyPerPlantYear?: number;
  relativeChange?: number;
  maximumFamilyRelativeChange?: number;
  topContributorRefs: string[];
  contributorRankingStable: boolean;
  newRiskSignificantContributorRefs: string[];
  decision: "CONTINUE_REFINEMENT" | "ACCEPT_STABLE";
}

export interface InternalFloodRiskInterpretation {
  riskInsights: InternalFloodRiskInsight[];
  refinementActions: InternalFloodModelRefinement[];
  quantificationIterations: InternalFloodRefinementIteration[];
  stoppingCriteria: {
    maximumAggregateFrequencyChange: number;
    maximumFamilyFrequencyChange: number;
    maximumContributorRankShift: number;
    requiredStableIterations: number;
    requireNoNewRiskSignificantContributors: boolean;
    basis: string;
  };
}

export interface InternalFloodRiskIntegrationResult extends InternalFloodAnalysisRecord {
  modelVersion: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  eventSequenceFamilyRefs: string[];
  releaseCategoryRefs: string[];
  aggregateMeanFrequencyPerPlantYear: number;
  fifthPercentileFrequencyPerPlantYear: number;
  ninetyFifthPercentileFrequencyPerPlantYear: number;
  otherHazardRiskRefs: string[];
  overlapTreatment: string;
  dominantContributorRefs: string[];
  integrationStatus: "DRAFT" | "READY_FOR_RISK_INTEGRATION" | "ACCEPTED_BY_RISK_INTEGRATION";
}

export interface InternalFloodRiskDecision extends InternalFloodAnalysisRecord {
  decisionType: "DESIGN" | "CONFIGURATION_CONTROL" | "PROCEDURE" | "MONITORING" | "DATA_COLLECTION" | "MODEL_CONTROL";
  driverRefs: string[];
  affectedSscRefs: string[];
  action: string;
  duePhase: string;
  disposition: "IMPLEMENT" | "MONITOR" | "CONFIRM_PRE_OPERATIONAL" | "RETAIN_CURRENT_BASIS" | "FORWARD_TO_PLANT_PROCESS";
  verificationRefs: string[];
  reanalysisRequired: boolean;
  riskIntegrationResultRef: string;
}

export interface InternalFloodRiskTraceabilityPath extends InternalFloodAnalysisRecord {
  evidenceRefs: string[];
  floodAreaRefs: string[];
  floodSourceRefs: string[];
  propagationPathRefs: string[];
  floodScenarioRefs: string[];
  initiatingEventRefs: string[];
  sscRefs: string[];
  humanFailureEventRefs: string[];
  eventSequenceFamilyRefs: string[];
  resultRefs: string[];
  decisionRefs: string[];
  complete: boolean;
}

export interface InternalFloodControlledBaseline extends InternalFloodAnalysisRecord {
  modelVersion: string;
  quantificationRunRef: string;
  reportRef: string;
  configurationControlRecordId: string;
  peerReviewRef: string;
  packageManifestRefs: string[];
  unresolvedLimitations: string[];
  releaseStatus: "WORKING" | "CONTROLLED" | "SUPERSEDED";
}

export interface InternalFloodRiskIntegrationBaseline {
  results: InternalFloodRiskIntegrationResult[];
  decisions: InternalFloodRiskDecision[];
  traceabilityPaths: InternalFloodRiskTraceabilityPath[];
  controlledBaselines: InternalFloodControlledBaseline[];
}

export interface InternalFloodWorkflowRecord extends InternalFloodAnalysisRecord {
  workflowRecordType: "REPORT_SECTION" | "QUALITY_CHECK" | "REVIEW_ASSIGNMENT" | "REVIEW_FINDING" | "APPROVAL_READINESS" | "APPROVAL_SIGNATURE";
  discipline: string;
  assignee: string;
  dueDate?: string;
  result: string;
  verificationRefs: string[];
}

export interface InternalFloodPraWorkflow {
  reportSections: InternalFloodWorkflowRecord[];
  draftQualityChecks: InternalFloodWorkflowRecord[];
  reviewAssignments: InternalFloodWorkflowRecord[];
  reviewFindings: InternalFloodWorkflowRecord[];
  approvalReadiness: InternalFloodWorkflowRecord[];
  approvalSignatures: InternalFloodWorkflowRecord[];
}

export interface InternalFloodPraDocumentation {
  overallProcessDescription: string;
  partitioningSummary: string;
  sourceSummary: string;
  scenarioSummary: string;
  frequencySummary: string;
  plantResponseSummary: string;
  humanReliabilitySummary: string;
  quantificationSummary: string;
  riskInsights: string;
  uncertaintySummary: string;
  configurationControlDescription: string;
  peerReviewScope: string;
  supportingDocumentRefs: string[];
}

export interface InternalFloodPraExampleDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export interface InternalFloodPRA extends TechnicalElement<TechnicalElementTypes.INTERNAL_FLOOD_PRA> {
  praScope: string;
  hazardConditionedModels: HazardConditionedMethodModels;
  applications: InternalFloodPraApplication[];
  evidenceRegister: InternalFloodPraEvidenceRecord[];
  baselinePra?: InternalFloodBaselinePraDefinition;
  plantPartitioning: InternalFloodPlantPartitioning;
  sourcesIdentificationAndCharacterization: InternalFloodSourcesIdentificationAndCharacterization;
  scenariosDevelopment: InternalFloodScenariosDevelopment;
  initiatingEvents: InternalFloodInitiatingEvents;
  plantResponseModel: InternalFloodPlantResponseModel;
  humanReliabilityAnalysis: InternalFloodHumanReliabilityAnalysis;
  eventSequenceQuantification: InternalFloodEventSequenceQuantification;
  integration: InternalFloodPraIntegration;
  integratedUncertainties: InternalFloodModelUncertainty[];
  riskInterpretation: InternalFloodRiskInterpretation;
  riskIntegrationBaseline: InternalFloodRiskIntegrationBaseline;
  workflow: InternalFloodPraWorkflow;
  documentation: InternalFloodPraDocumentation;
  configurationControlRecordId?: string;
  exampleDocuments?: InternalFloodPraExampleDocument[];
  newlyDevelopedMethodIds?: string[];
}

export type InternalFloodWorkbookSubelement = "INTEGRATED" | "FLPP" | "FLSO" | "FLSN" | "FLEV" | "FLPR" | "FLHR" | "FLESQ" | "WORKFLOW";

export interface InternalFloodStepDefinition {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  subelement: InternalFloodWorkbookSubelement;
}

export const INTERNAL_FLOOD_STEP_DEFINITIONS: InternalFloodStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis", subtitle: "Set the starting rules for the Internal Flood PRA: what is included, which risk results are needed, which flood-source and spatial inputs are shared, and what data moves between technical elements." },
  { id: "evidence-base", number: "02", label: "Evidence base", subelement: "INTEGRATED", title: "Qualified evidence base and investigations", subtitle: "Control drawings, calculations, procedures, operating experience, interviews, walkdowns, and evidence gaps." },
  { id: "baseline-pra", number: "03", label: "Baseline and interfaces", subelement: "INTEGRATED", title: "Baseline PRA and Internal Flood changes", subtitle: "Freeze the baseline PRA and control interfaces to systems, HRA, event sequences, quantification, and risk integration." },
  { id: "plant-partitioning", number: "04", label: "Plant partitioning", subelement: "FLPP", title: "Plant boundary and flood-area partitioning", subtitle: "Define the analysis boundary and complete, nonoverlapping flood areas with traceable spatial and operating-state attributes." },
  { id: "flood-sources", number: "05", label: "Flood sources", subelement: "FLSO", title: "Flood sources and failure mechanisms", subtitle: "Identify sources and characterize credible failures, release rates, durations, inventories, and isolation." },
  { id: "propagation-mitigation", number: "06", label: "Propagation and mitigation", subelement: "FLSN", title: "Flood propagation paths and mitigation features", subtitle: "Model hydraulic connections, barriers, drains, sumps, pumps, isolation, alarms, and other mitigation." },
  { id: "scenario-development", number: "07", label: "Scenarios and screening", subelement: "FLSN", title: "SSC susceptibility, scenario development, and screening", subtitle: "Evaluate flood effects, hydraulic consequences, source-path-target scenarios, and justified screening decisions." },
  { id: "event-frequency", number: "08", label: "Frequencies", subelement: "FLEV", title: "Flood-induced initiating events and frequencies", subtitle: "Group scenarios, map initiators, estimate frequencies, and quantify mitigation and maintenance contributions." },
  { id: "plant-response", number: "09", label: "Plant response", subelement: "FLPR", title: "Internal Flood plant-response model", subtitle: "Modify event sequences, systems logic, success criteria, mission times, and multi-source response models." },
  { id: "human-reliability", number: "10", label: "Human response", subelement: "FLHR", title: "Human response under internal-flood conditions", subtitle: "Define actions, flood-specific contexts, timing, feasibility, HEPs, recovery, and dependencies." },
  { id: "quantification", number: "11", label: "Annual risk", subelement: "FLESQ", title: "Event-sequence quantification and uncertainty", subtitle: "Quantify retained sequence families, dependencies, uncertainty, contributors, convergence, and traceability." },
  { id: "risk-interpretation", number: "12", label: "Risk interpretation", subelement: "INTEGRATED", title: "Risk interpretation and model refinement", subtitle: "Rank contributors, target model refinements, and demonstrate stable results and rankings." },
  { id: "risk-integration", number: "13", label: "Risk integration", subelement: "INTEGRATED", title: "Risk integration and controlled baseline", subtitle: "Transfer final results, avoid cross-hazard overlap, record decisions, and establish the controlled baseline." },
  { id: "draft", number: "14", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled Internal Flood PRA report and supporting package." },
  { id: "review", number: "15", label: "Review", subelement: "WORKFLOW", title: "Internal technical and peer review", subtitle: "Review each subelement, resolve findings, and demonstrate reviewer qualification and independence." },
  { id: "approval", number: "16", label: "Approval", subelement: "WORKFLOW", title: "Internal approval", subtitle: "Confirm the controlled baseline, findings, signatures, release limitations, and configuration control." },
];

export const INTERNAL_FLOOD_PRA_SR_CATALOG: Record<string, InternalFloodSrCatalogEntry> = {
  ...FLPP_SR_CATALOG,
  ...FLSO_SR_CATALOG,
  ...FLSN_SR_CATALOG,
  ...FLEV_SR_CATALOG,
  ...FLPR_SR_CATALOG,
  ...FLHR_SR_CATALOG,
  ...FLESQ_SR_CATALOG,
};

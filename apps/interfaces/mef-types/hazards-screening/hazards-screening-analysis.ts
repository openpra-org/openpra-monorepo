import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import { HlrId, PlantStage, SRReference } from "../core/pra-common";
import { Named, Unique } from "../core/meta";

export type HsaRecordStatus =
  | "DRAFT"
  | "READY"
  | "REVIEWED"
  | "APPROVED"
  | "SCREENED_OUT"
  | "RETAINED"
  | "OPEN"
  | "CLOSED";

export type HsaHazardCategory =
  | "NATURAL_EXTERNAL"
  | "HUMAN_INDUCED_EXTERNAL"
  | "INTERNAL_PLANT"
  | "SECONDARY"
  | "COMBINED";

export type HsaHazardDisposition =
  | "QUALITATIVELY_SCREENED"
  | "QUANTITATIVELY_SCREENED"
  | "RETAIN_FOR_DEDICATED_PRA"
  | "RETAIN_IN_INTERNAL_EVENTS_PRA"
  | "BOUND_BY_ANOTHER_HAZARD"
  | "OPEN";

export type HsaTechnicalElementCode =
  | "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC" | "RI"
  | "FL" | "F" | "S" | "W" | "XF" | "O" | "HS";

export interface HsaSrCatalogEntry {
  hlr: HlrId;
  stages: PlantStage[];
  description: string;
}

export interface HsaAnalysisRecord extends Unique, Named {
  code: string;
  description: string;
  basis: string;
  owner: string;
  status: HsaRecordStatus;
  evidenceRefs: string[];
  relatedRefs: string[];
  assumptionRefs: string[];
  implementsSrs: SRReference[];
}

export interface HsaApplication extends HsaAnalysisRecord {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  boundingSiteUsed: boolean;
  boundingSiteBasis: string;
  limitations: string[];
}

export interface HsaEvidenceRecord extends HsaAnalysisRecord {
  evidenceType: "SITE_DATA" | "DESIGN" | "LICENSING" | "PRA_MODEL" | "OPERATING_EXPERIENCE" | "INDUSTRY_STUDY" | "GOVERNMENT_STUDY" | "WALKDOWN" | "INTERVIEW" | "CALCULATION" | "OTHER";
  sourceReference: string;
  revision: string;
  effectiveDate: string;
  geographicApplicability: string;
  plantApplicability: string;
  qualityAndLimitations: string;
  controlled: boolean;
}

export interface HsaSiteDescriptor extends HsaAnalysisRecord {
  descriptorType: "SITE_LOCATION" | "TOPOGRAPHY" | "METEOROLOGY" | "HYDROLOGY" | "GEOLOGY" | "LAND_USE" | "TRANSPORTATION" | "NEARBY_FACILITY" | "PLANT_LAYOUT" | "RADIOACTIVE_SOURCE";
  locationOrFeature: string;
  distanceAndDirection: string;
  elevationOrDatum: string;
  observationPeriod: string;
  currentCondition: string;
  changeIndicator: string;
}

export interface HsaRegionalStudy extends HsaAnalysisRecord {
  organization: string;
  studyType: "REGIONAL" | "INDUSTRIAL" | "TRANSPORTATION" | "LAND_USE" | "METEOROLOGICAL" | "HYDROLOGICAL" | "GEOLOGICAL" | "EMERGENCY_PLANNING";
  coverageArea: string;
  publicationDate: string;
  hazardsAddressed: string[];
  findingsUsed: string[];
}

export interface HsaDesignBasisRecord extends HsaAnalysisRecord {
  designFeatureRef: string;
  hazardRefs: string[];
  designParameter: string;
  designValue: string;
  qualificationOrMargin: string;
  creditedInScreening: boolean;
  creditedFunction: string;
}

export interface HsaChangeMonitoringRecord extends HsaAnalysisRecord {
  monitoredDomain: "PLANT" | "SITE" | "REGIONAL_INDUSTRY" | "TRANSPORTATION" | "LAND_USE" | "CLIMATE" | "OTHER";
  baselineDate: string;
  currentReviewDate: string;
  observedChanges: string[];
  affectedHazardRefs: string[];
  screeningImpact: string;
  actionRequired: boolean;
}

export interface HsaHazardCandidate extends HsaAnalysisRecord {
  hazardFamily: string;
  category: HsaHazardCategory;
  origin: string;
  applicability: "APPLICABLE" | "NOT_PHYSICALLY_POSSIBLE" | "PENDING_INFORMATION";
  affectedPlantOperatingStateRefs: string[];
  affectedReactorUnitRefs: string[];
  affectedRadioactiveMaterialSourceRefs: string[];
  hazardParameters: string[];
  secondaryHazardRefs: string[];
  combinedHazardRefs: string[];
  preliminaryDisposition: HsaHazardDisposition;
  dedicatedTechnicalElement: "NONE" | "S" | "W" | "XF" | "O" | "FL" | "F";
}

export interface HsaHazardRoutingDecision extends HsaAnalysisRecord {
  hazardRef: string;
  routeTo: "QUALITATIVE_SCREENING" | "QUANTITATIVE_SCREENING" | "DEDICATED_HAZARD_PRA" | "INTERNAL_EVENTS_MODEL";
  receivingTechnicalElement: HsaTechnicalElementCode;
  receivingRecordRefs: string[];
  overlapControls: string[];
  dispositionComplete: boolean;
}

export interface HsaHazardInteraction extends HsaAnalysisRecord {
  primaryHazardRef: string;
  interactingHazardRefs: string[];
  interactionType: "CONSEQUENTIAL" | "CORRELATED" | "INDEPENDENT_COINCIDENT" | "COMMON_CAUSE_DRIVER";
  causalMechanism: string;
  combinedLoadDescription: string;
  affectedLocationRefs: string[];
  affectedSscRefs: string[];
  analysisTreatment: "SEPARATE" | "COMBINED_SCENARIO" | "BOUND_BY_PRIMARY" | "ROUTE_TO_DEDICATED_PRA";
  retained: boolean;
}

export interface HsaScreeningCriterion extends HsaAnalysisRecord {
  criterionCode: "PHYSICALLY_IMPOSSIBLE" | "DISTANCE" | "DESIGN_ENVELOPE" | "BOUNDED_BY_OTHER_EVENT" | "SCR_1" | "SCR_2" | "SCR_3" | "PROJECT_SPECIFIC";
  criterionType: "QUALITATIVE" | "QUANTITATIVE";
  applicabilityConditions: string[];
  thresholdValue?: number;
  thresholdUnit?: string;
  riskMetric: string;
  conservatismRequirements: string[];
  prohibitedUses: string[];
}

export interface HsaQualitativeScreeningDecision extends HsaAnalysisRecord {
  hazardRef: string;
  plantOperatingStateRefs: string[];
  criterionRef: string;
  decision: "SCREEN_OUT" | "RETAIN" | "MORE_INFORMATION_REQUIRED";
  siteSpecificFacts: string[];
  designFeaturesCredited: string[];
  conservativeArguments: string[];
  secondaryHazardsAddressed: boolean;
  uncertaintyAddressed: boolean;
}

export interface HsaHazardFrequencyModel extends HsaAnalysisRecord {
  hazardRef: string;
  modelType: "EXCEEDANCE_CURVE" | "OCCURRENCE_RATE" | "EVENT_TREE" | "FAULT_TREE" | "BOUNDING_ESTIMATE" | "DATABASE_RATE";
  frequencyBasis: string;
  exposureBasis: string;
  meanAnnualFrequency: number;
  lowerAnnualFrequency: number;
  upperAnnualFrequency: number;
  parameterName: string;
  parameterValue: number;
  parameterUnit: string;
  loadingDescription: string;
  uncertaintyDistribution: string;
  modelApplicability: string;
}

export interface HsaHazardDataAssessment extends HsaAnalysisRecord {
  hazardRef: string;
  sourceDatabase: string;
  eventCount: number;
  exposureYears: number;
  screeningRules: string[];
  plantSpecificDataIncluded: boolean;
  industryDataIncluded: boolean;
  alternativeDataEvaluation: string;
  selectedEstimateRef: string;
}

export interface HsaVulnerableSsc extends HsaAnalysisRecord {
  hazardRefs: string[];
  sscRef: string;
  systemRef: string;
  locationRef: string;
  creditedFunction: string;
  failureModes: string[];
  demandOrLoading: string;
  capacityOrProtection: string;
  conditionalFailureProbability: number;
  failureProbabilityTreatment: "CALCULATED" | "BOUNDING" | "UNITY";
}

export interface HsaPlantResponseScenario extends HsaAnalysisRecord {
  hazardRefs: string[];
  initiatingEventRef: string;
  eventSequenceRef: string;
  eventSequenceFamilyRef: string;
  affectedSscRefs: string[];
  affectedHumanActionRefs: string[];
  conditionalSequenceProbability: number;
  meanAnnualFrequency: number;
  consequenceResultRef: string;
  modelTreatment: "EXISTING_SEQUENCE" | "MODIFIED_SEQUENCE" | "NEW_SEQUENCE";
}

export interface HsaHumanActionEffect extends HsaAnalysisRecord {
  hazardRefs: string[];
  humanFailureEventRef: string;
  cueEffects: string;
  accessAndHabitability: string;
  timingEffects: string;
  instrumentationEffects: string;
  communicationEffects: string;
  baselineHep: number;
  hazardAdjustedHep: number;
}

export interface HsaPeerReviewDisposition extends HsaAnalysisRecord {
  sourcePeerReviewRef: string;
  findingRef: string;
  applicableTechnicalArea: string;
  disposition: string;
  incorporated: boolean;
  verificationRefs: string[];
}

export interface HsaConsequenceEstimate extends HsaAnalysisRecord {
  scenarioRef: string;
  releaseCategoryRef: string;
  consequenceMetric: string;
  meanConsequence: number;
  consequenceUnit: string;
  screeningSurrogate: string;
  consequenceThreshold: number;
  thresholdUnit: string;
}

export interface HsaQuantitativeScreeningDecision extends HsaAnalysisRecord {
  hazardRef: string;
  scenarioRefs: string[];
  criterionRef: string;
  meanEventSequenceFamilyFrequency: number;
  riskContribution: number;
  riskContributionUnit: string;
  conservativeMultipliers: string[];
  decision: "SCREEN_OUT" | "RETAIN";
  retainedTechnicalElement: HsaTechnicalElementCode;
}

export interface HsaFinalHazardDisposition extends HsaAnalysisRecord {
  hazardRef: string;
  disposition: HsaHazardDisposition;
  controllingDecisionRefs: string[];
  receivingTechnicalElement: HsaTechnicalElementCode;
  retainedScenarioRefs: string[];
  restrictions: string[];
  approvedForUse: boolean;
}

export interface HsaInvestigation extends HsaAnalysisRecord {
  investigationType: "WALKDOWN" | "INTERVIEW" | "TABLETOP" | "COMPUTERIZED_WALKDOWN" | "DOCUMENT_REVIEW" | "SITE_RECONNAISSANCE";
  scope: string;
  locations: string[];
  participants: string[];
  performedDate: string;
  observations: string[];
  findingRefs: string[];
  confirmedRecordRefs: string[];
  asBuiltOrIntendedConfirmed: boolean;
}

export interface HsaUncertainty extends HsaAnalysisRecord {
  uncertaintyType: "PARAMETER" | "MODEL" | "COMPLETENESS" | "ASSUMPTION";
  sourceArea: "HAZARD_IDENTIFICATION" | "QUALITATIVE_SCREENING" | "HAZARD_FREQUENCY" | "PLANT_RESPONSE" | "CONSEQUENCE" | "INTEGRATION";
  affectedRecordRefs: string[];
  potentialImpact: string;
  reasonableAlternatives: string[];
  treatment: string;
  sensitivityRefs: string[];
  importance: "LOW" | "MEDIUM" | "HIGH";
}

export interface HsaPreOperationalAssumption extends HsaAnalysisRecord {
  affectedRecordRefs: string[];
  missingDesignInformation: string[];
  limitation: string;
  closureAction: string;
  closurePhase: string;
  closureStatus: "OPEN" | "IN_PROGRESS" | "CLOSED";
}

export interface HsaInterfaceTransferItem extends Unique, Named {
  recordRef: string;
  sourceModelRef: string;
  destinationRefs: string[];
  values: string[];
  evidenceRefs: string[];
  status: "CONTROLLED" | "WORKING" | "OPEN";
}

export interface HsaInterfaceRecord extends HsaAnalysisRecord {
  technicalElementCode: HsaTechnicalElementCode;
  technicalElementName: string;
  direction: "INPUT" | "OUTPUT";
  role: string;
  producer: HsaTechnicalElementCode;
  consumer: HsaTechnicalElementCode;
  payloadType: "OPERATING_STATE" | "INITIATING_EVENT" | "EVENT_SEQUENCE" | "SUCCESS_CRITERION" | "SYSTEM_MODEL" | "HUMAN_FAILURE_EVENT" | "DATA_PARAMETER" | "CONSEQUENCE_RESULT" | "HAZARD_DISPOSITION" | "HAZARD_INPUT" | "RISK_RESULT";
  columns: string[];
  transferItems: HsaInterfaceTransferItem[];
  producerRefs: string[];
  consumerRefs: string[];
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
}

export interface HsaTechnicalHandoff extends HsaAnalysisRecord {
  destinationTechnicalElement: HsaTechnicalElementCode;
  transferredHazardRefs: string[];
  transferredScenarioRefs: string[];
  transferredResultRefs: string[];
  modelBoundaryStatement: string;
  overlapControls: string[];
  acceptanceStatus: "WORKING" | "READY" | "ACCEPTED";
  acceptanceReference: string;
}

export interface HsaTraceabilityPath extends HsaAnalysisRecord {
  evidenceRefs: string[];
  siteDescriptorRefs: string[];
  hazardRefs: string[];
  interactionRefs: string[];
  criterionRefs: string[];
  screeningDecisionRefs: string[];
  frequencyModelRefs: string[];
  sscRefs: string[];
  scenarioRefs: string[];
  consequenceRefs: string[];
  finalDispositionRefs: string[];
  handoffRefs: string[];
  complete: boolean;
}

export interface HsaControlledBaseline extends HsaAnalysisRecord {
  modelVersion: string;
  reportRef: string;
  evidenceIndexRef: string;
  configurationControlRecordId: string;
  peerReviewRef: string;
  packageManifestRefs: string[];
  unresolvedLimitations: string[];
  releaseStatus: "WORKING" | "CONTROLLED" | "SUPERSEDED";
}

export interface HsaWorkflowRecord extends HsaAnalysisRecord {
  workflowRecordType: "REPORT_SECTION" | "QUALITY_CHECK" | "REVIEW_ASSIGNMENT" | "REVIEW_FINDING" | "APPROVAL_READINESS" | "APPROVAL_SIGNATURE";
  discipline: string;
  assignee: string;
  dueDate?: string;
  result: string;
  verificationRefs: string[];
}

export interface HsaWorkflow {
  reportSections: HsaWorkflowRecord[];
  draftQualityChecks: HsaWorkflowRecord[];
  reviewAssignments: HsaWorkflowRecord[];
  reviewFindings: HsaWorkflowRecord[];
  approvalReadiness: HsaWorkflowRecord[];
  approvalSignatures: HsaWorkflowRecord[];
}

export interface HsaDocumentationSummary {
  overallProcess: string;
  hazardIdentificationSummary: string;
  qualitativeScreeningSummary: string;
  quantitativeScreeningSummary: string;
  plantConfirmationSummary: string;
  uncertaintySummary: string;
  resultsAndHandoffsSummary: string;
  configurationControlSummary: string;
  supportingDocumentRefs: string[];
}

export interface HazardsScreeningAnalysis extends TechnicalElement<TechnicalElementTypes.HAZARDS_SCREENING_ANALYSIS> {
  praScope: string;
  applications: HsaApplication[];
  evidenceRegister: HsaEvidenceRecord[];
  siteCharacterization: {
    siteDescriptors: HsaSiteDescriptor[];
    regionalStudies: HsaRegionalStudy[];
    designBasisRecords: HsaDesignBasisRecord[];
    changeMonitoringRecords: HsaChangeMonitoringRecord[];
  };
  hazardInventory: {
    hazards: HsaHazardCandidate[];
    routingDecisions: HsaHazardRoutingDecision[];
  };
  combinedHazards: { interactions: HsaHazardInteraction[] };
  screeningCriteria: { criteria: HsaScreeningCriterion[] };
  qualitativeScreening: { decisions: HsaQualitativeScreeningDecision[] };
  quantitativeCharacterization: {
    frequencyModels: HsaHazardFrequencyModel[];
    dataAssessments: HsaHazardDataAssessment[];
  };
  plantResponse: {
    vulnerableSscs: HsaVulnerableSsc[];
    scenarios: HsaPlantResponseScenario[];
    humanActionEffects: HsaHumanActionEffect[];
    peerReviewDispositions: HsaPeerReviewDisposition[];
  };
  quantitativeScreening: {
    consequenceEstimates: HsaConsequenceEstimate[];
    decisions: HsaQuantitativeScreeningDecision[];
  };
  confirmations: { investigations: HsaInvestigation[] };
  uncertainties: HsaUncertainty[];
  preOperationalAssumptions: HsaPreOperationalAssumption[];
  integration: {
    interfaces: HsaInterfaceRecord[];
    finalDispositions: HsaFinalHazardDisposition[];
    technicalHandoffs: HsaTechnicalHandoff[];
    unresolvedInterfaces: string[];
  };
  traceability: {
    paths: HsaTraceabilityPath[];
    controlledBaselines: HsaControlledBaseline[];
  };
  workflow: HsaWorkflow;
  documentation: HsaDocumentationSummary;
  configurationControlRecordId?: string;
  newlyDevelopedMethodIds?: string[];
}

export type HsaWorkbookSubelement = "INTEGRATED" | "HS-A" | "HS-B" | "HS-C" | "HS-D" | "HS-E" | "WORKFLOW";

export interface HsaStepDefinition {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  subelement: HsaWorkbookSubelement;
}

export const HSA_STEP_DEFINITIONS: HsaStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis, scope, and interfaces", subtitle: "Define the application, plant and site boundary, operating states, radioactive-material sources, risk measures, and controlled inputs and outputs shared with other PRA technical elements." },
  { id: "evidence-site", number: "02", label: "Evidence and site", subelement: "HS-A", title: "Evidence register and site characterization", subtitle: "Control the plant, site, regional, industrial, transportation, meteorological, hydrological, geological, design, licensing, and operating-experience information used to identify and screen hazards." },
  { id: "hazard-inventory", number: "03", label: "Hazard inventory", subelement: "HS-A", title: "Comprehensive hazard inventory and routing", subtitle: "Identify industry-recognized, site-specific, design-specific, internal, external, human-induced, and secondary hazards for every in-scope plant state and radioactive-material source, then route each one to the proper analysis." },
  { id: "combined-hazards", number: "04", label: "Combined hazards", subelement: "HS-A", title: "Secondary and combined hazards", subtitle: "Evaluate consequential, correlated, common-cause, and credible coincident hazards before any individual hazard is screened out." },
  { id: "screening-criteria", number: "05", label: "Screening criteria", subelement: "HS-B", title: "Approved screening criteria", subtitle: "Define the qualitative and quantitative criteria, limits, risk measures, required conservatism, and prohibited uses that govern every screening decision." },
  { id: "qualitative-screening", number: "06", label: "Qualitative screening", subelement: "HS-B", title: "Qualitative preliminary screening", subtitle: "Apply site-specific physical-impossibility, distance, design-envelope, and bounding-event criteria consistently while retaining uncertain or incompletely supported hazards." },
  { id: "hazard-characterization", number: "07", label: "Hazard characterization", subelement: "HS-C", title: "Quantitative hazard characterization", subtitle: "Develop demonstrably conservative occurrence or exceedance frequencies, associated loads, database evaluations, alternative estimates, and uncertainty distributions for hazards not screened qualitatively." },
  { id: "plant-response", number: "08", label: "Plant response", subelement: "HS-C", title: "Conservative plant-response model", subtitle: "Identify vulnerable SSCs and failure modes, represent internal-events and hazard-specific event sequences, address peer-review findings, and model hazard effects on human actions." },
  { id: "quantitative-screening", number: "09", label: "Quantitative screening", subelement: "HS-C", title: "Quantitative screening and final disposition", subtitle: "Combine hazard frequency, loading, SSC failure, sequence response, human reliability, and consequences to apply SCR-1 or SCR-2 and retain every hazard that does not demonstrably meet the criterion." },
  { id: "plant-confirmation", number: "10", label: "Plant confirmation", subelement: "HS-D", title: "Plant and surroundings confirmation", subtitle: "Use walkdowns, interviews, tabletop reviews, document reviews, and site reconnaissance to confirm the as-built and as-operated plant or the as-designed and as-intended basis." },
  { id: "uncertainty", number: "11", label: "Uncertainty and limitations", subelement: "HS-B", title: "Uncertainty, assumptions, and limitations", subtitle: "Record parameter, model, completeness, and assumption uncertainty, reasonable alternatives, sensitivity treatments, pre-operational limitations, and closure actions." },
  { id: "results-integration", number: "12", label: "Results integration", subelement: "INTEGRATED", title: "Results integration and technical handoffs", subtitle: "Establish the final disposition of every hazard and transfer retained hazards, scenarios, risk results, modeling boundaries, and overlap controls to the responsible PRA technical elements." },
  { id: "traceability", number: "13", label: "Traceability", subelement: "HS-E", title: "Documentation and traceability", subtitle: "Demonstrate complete evidence-to-hazard-to-criterion-to-model-to-disposition-to-handoff traceability and establish the configuration-controlled HSA baseline." },
  { id: "draft", number: "14", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled Hazards Screening Analysis report, conformance matrix, evidence index, hazard disposition register, and supporting package." },
  { id: "review", number: "15", label: "Review", subelement: "WORKFLOW", title: "Internal technical review", subtitle: "Review hazard identification, screening decisions, conservative analyses, plant confirmations, uncertainties, and handoffs; resolve every finding before approval." },
  { id: "approval", number: "16", label: "Approval", subelement: "WORKFLOW", title: "Internal approval", subtitle: "Confirm the controlled baseline, conformance status, resolved findings, signatures, release limitations, and configuration-control record." },
];

const bothStages: PlantStage[] = ["OPERATIONAL", "PRE_OPERATIONAL"];
const preOperationalOnly: PlantStage[] = ["PRE_OPERATIONAL"];

export const HSA_SR_CATALOG: Record<string, HsaSrCatalogEntry> = {
  "HS-A1": { hlr: "A", stages: bothStages, description: "Identify hazards applicable to the site or bounding site for all in-scope radioactive-material sources and plant operating states." },
  "HS-A2": { hlr: "A", stages: bothStages, description: "Include hazards recognized in applicable industry standards and guidance." },
  "HS-A3": { hlr: "A", stages: bothStages, description: "Include hazards unique to the site, plant design, surrounding activities, and advanced-reactor technology." },
  "HS-A4": { hlr: "A", stages: bothStages, description: "Identify consequential and other secondary hazards produced by each candidate hazard." },
  "HS-B1": { hlr: "B", stages: bothStages, description: "Use plant design, licensing, and safety-case information in qualitative preliminary screening." },
  "HS-B2": { hlr: "B", stages: bothStages, description: "Use relevant regional, industrial, transportation, and government studies." },
  "HS-B3": { hlr: "B", stages: bothStages, description: "Evaluate changes in plant configuration and activities in the surrounding area." },
  "HS-B4": { hlr: "B", stages: bothStages, description: "Address secondary and combined hazards before applying qualitative screening." },
  "HS-B5": { hlr: "B", stages: bothStages, description: "Apply defined qualitative screening criteria, including SCR-3 where applicable." },
  "HS-B6": { hlr: "B", stages: bothStages, description: "Identify and characterize uncertainties affecting qualitative screening." },
  "HS-B7": { hlr: "B", stages: preOperationalOnly, description: "Identify pre-operational assumptions, limitations, and closure actions affecting qualitative screening." },
  "HS-C1": { hlr: "C", stages: bothStages, description: "Estimate mean or demonstrably conservative hazard occurrence or exceedance frequencies and associated loadings." },
  "HS-C2": { hlr: "C", stages: bothStages, description: "Use applicable databases and evaluate reasonable alternative frequency estimates." },
  "HS-C3": { hlr: "C", stages: bothStages, description: "Identify vulnerable SSCs and credible hazard-induced failure modes." },
  "HS-C4": { hlr: "C", stages: bothStages, description: "Represent hazard effects using applicable internal-events sequences and new or modified sequences where needed." },
  "HS-C5": { hlr: "C", stages: bothStages, description: "Evaluate and disposition relevant internal-events PRA peer-review findings." },
  "HS-C6": { hlr: "C", stages: bothStages, description: "Use conservative conditional SSC failure probabilities, including unity when appropriate." },
  "HS-C7": { hlr: "C", stages: bothStages, description: "Quantify event-sequence and event-sequence-family frequencies." },
  "HS-C8": { hlr: "C", stages: bothStages, description: "Include secondary and combined hazards in quantitative screening." },
  "HS-C9": { hlr: "C", stages: bothStages, description: "Evaluate hazard effects on human actions, cues, access, timing, and instrumentation." },
  "HS-C10": { hlr: "C", stages: bothStages, description: "Estimate consequences or an appropriate conservative consequence surrogate." },
  "HS-C11": { hlr: "C", stages: bothStages, description: "Apply the quantitative SCR-1 or SCR-2 criteria to the calculated risk contribution." },
  "HS-C12": { hlr: "C", stages: bothStages, description: "Retain hazard, scenario, sequence, and consequence results needed for traceability and downstream use." },
  "HS-C13": { hlr: "C", stages: bothStages, description: "Identify and characterize uncertainties affecting quantitative screening." },
  "HS-C14": { hlr: "C", stages: preOperationalOnly, description: "Identify pre-operational assumptions, limitations, and closure actions affecting quantitative screening." },
  "HS-D1": { hlr: "D", stages: bothStages, description: "Perform plant and surroundings investigations sufficient to confirm the actual or intended HSA basis." },
  "HS-E1": { hlr: "E", stages: bothStages, description: "Document inputs, criteria, analyses, results, hazard dispositions, frequencies, and consequences with traceability." },
  "HS-E2": { hlr: "E", stages: bothStages, description: "Document uncertainty sources, alternatives, treatment, and impact on conclusions." },
  "HS-E3": { hlr: "E", stages: preOperationalOnly, description: "Document pre-operational limitations, assumptions, closure actions, and affected records." },
  "HS-E4": { hlr: "E", stages: bothStages, description: "Document and justify the bounding-site basis when a bounding site is used." },
};

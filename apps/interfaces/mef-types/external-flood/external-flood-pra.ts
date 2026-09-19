import { TechnicalElement, TechnicalElementTypes } from "../technical-element";
import type { HazardConditionedMethodModels } from "../hazard-conditioned-models";
import {
  createExternalFloodSrCatalog,
  ExternalFloodAnalysisRecord,
  ExternalFloodModelUncertainty,
  ExternalFloodPraInterfaceRecord,
  ExternalFloodPreOperationalAssumption,
  ExternalFloodProcessDocumentation,
  ExternalFloodSrCatalogEntry,
} from "./external-flood-pra-common";

export * from "./external-flood-pra-common";

export interface ExternalFloodPraApplication extends ExternalFloodAnalysisRecord {
  purpose: string;
  decisionContext: string;
  supportedRiskMetrics: string[];
  consumingElementRefs: string[];
  configurationBasis: string;
  limitations: string[];
}

export interface ExternalFloodPraEvidenceRecord extends ExternalFloodAnalysisRecord {
  evidenceType: "STANDARD" | "HYDROMETEOROLOGICAL_DATA" | "TOPOGRAPHIC_SURVEY" | "DRAWING" | "CALCULATION" | "PROCEDURE" | "MODEL" | "WALKDOWN" | "INTERVIEW" | "OPERATING_EXPERIENCE" | "REVIEW" | "OTHER";
  sourceReference: string;
  revision?: string;
  effectiveDate?: string;
  applicableSubelements: Array<"XFHA" | "XFFR" | "XFPR">;
  applicability: string;
  qualityAndLimitations: string;
  fileReference?: string;
  supersedesEvidenceRef?: string;
  controlled: boolean;
}

export interface ExternalFloodBaselinePraRecordTreatment extends ExternalFloodAnalysisRecord {
  technicalArea: "PLANT_OPERATING_STATES" | "INITIATING_EVENTS" | "EVENT_SEQUENCES" | "SUCCESS_CRITERIA" | "SYSTEMS" | "DATA" | "HUMAN_RELIABILITY" | "RISK_INTEGRATION";
  sourceRecordRefs: string[];
  treatment: "REUSED" | "MODIFIED" | "NEW" | "NOT_APPLICABLE";
  externalFloodChange: string;
  unresolvedItems: string[];
}

export interface ExternalFloodBaselinePraDefinition {
  modelName: string;
  modelReference: string;
  revision: string;
  freezeDate: string;
  freezeStatus: "WORKING" | "FROZEN" | "REFERENCE_ONLY";
  modelBoundary: string;
  plantOperatingStateRefs: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  recordTreatments: ExternalFloodBaselinePraRecordTreatment[];
  unresolvedInterfaces: string[];
}

export interface ExternalFloodSiteBasis extends ExternalFloodAnalysisRecord {
  siteBasisType: "SPECIFIC_SITE" | "BOUNDING_SITE";
  siteName: string;
  latitudeDegrees?: number;
  longitudeDegrees?: number;
  gradeElevationMetres?: number;
  siteSelectionStatus: "SELECTED" | "CANDIDATE" | "BOUNDING_ENVELOPE";
  boundingSiteRefs: string[];
  boundingCharacteristics: string[];
  watershedAndCoastalSetting: string;
  topographyAndDrainageDescription: string;
  datumAndSurveyBasis: string;
  licenseeControlledAreaDescription: string;
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  plantOperatingStateRefs: string[];
  multiReactorOrMultiSourceLocations: string[];
  analysisDateCutoff: string;
}

export interface ExternalFloodAnalysisScopeRecord extends ExternalFloodAnalysisRecord {
  hazardTypes: string[];
  floodEffects: string[];
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs: string[];
  plantOperatingStateRefs: string[];
  includedLocations: string[];
  excludedLocations: string[];
  inclusionBasis: string;
}

export interface ExternalFloodTechnicalSection {
  modelUncertainties: ExternalFloodModelUncertainty[];
  preOperationalAssumptions: ExternalFloodPreOperationalAssumption[];
  documentation: ExternalFloodProcessDocumentation;
}

export interface ExternalFloodAnalysisBasis extends ExternalFloodTechnicalSection {
  siteBasis?: ExternalFloodSiteBasis;
  scopeRecords: ExternalFloodAnalysisScopeRecord[];
  applications: ExternalFloodPraApplication[];
  evidenceRegister: ExternalFloodPraEvidenceRecord[];
  baselinePra?: ExternalFloodBaselinePraDefinition;
  interfaces: ExternalFloodPraInterfaceRecord[];
}

export interface ExternalFloodHazardScreening extends ExternalFloodTechnicalSection {
  hazardCandidates: ExternalFloodAnalysisRecord[];
  hazardCombinations: ExternalFloodAnalysisRecord[];
  screeningDecisions: ExternalFloodAnalysisRecord[];
  aggregateScreeningChecks: ExternalFloodAnalysisRecord[];
  confirmations: ExternalFloodAnalysisRecord[];
  investigations: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodSiteModel extends ExternalFloodTechnicalSection {
  dataSources: ExternalFloodAnalysisRecord[];
  siteParameters: ExternalFloodAnalysisRecord[];
  datumConversions: ExternalFloodAnalysisRecord[];
  hydrologicAssumptions: ExternalFloodAnalysisRecord[];
  numericalModels: ExternalFloodAnalysisRecord[];
  qualificationChecks: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodLipAnalysis extends ExternalFloodTechnicalSection {
  precipitationInputs: ExternalFloodAnalysisRecord[];
  drainageCatchments: ExternalFloodAnalysisRecord[];
  hydraulicModels: ExternalFloodAnalysisRecord[];
  surfaceFlowPaths: ExternalFloodAnalysisRecord[];
  hazardResults: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodRiverineAnalysis extends ExternalFloodTechnicalSection {
  watershedModels: ExternalFloodAnalysisRecord[];
  frequencyAnalyses: ExternalFloodAnalysisRecord[];
  stageDischargeModels: ExternalFloodAnalysisRecord[];
  leveeAssessments: ExternalFloodAnalysisRecord[];
  hazardResults: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodDamAnalysis extends ExternalFloodTechnicalSection {
  impoundmentInventory: ExternalFloodAnalysisRecord[];
  failureModes: ExternalFloodAnalysisRecord[];
  breachModels: ExternalFloodAnalysisRecord[];
  routingModels: ExternalFloodAnalysisRecord[];
  hazardResults: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodCoastalAnalysis extends ExternalFloodTechnicalSection {
  coastalSources: ExternalFloodAnalysisRecord[];
  stormSurgeModels: ExternalFloodAnalysisRecord[];
  seicheModels: ExternalFloodAnalysisRecord[];
  tsunamiModels: ExternalFloodAnalysisRecord[];
  hazardResults: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodHazardIntegration extends ExternalFloodTechnicalSection {
  logicTreeBranches: ExternalFloodAnalysisRecord[];
  hazardCurves: ExternalFloodAnalysisRecord[];
  spatialCharacterizations: ExternalFloodAnalysisRecord[];
  hazardIntervals: ExternalFloodAnalysisRecord[];
  uncertaintyStudies: ExternalFloodAnalysisRecord[];
  convergenceStudies: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodPreliminaryPlantResponse extends ExternalFloodTechnicalSection {
  preliminaryInitiatingEvents: ExternalFloodAnalysisRecord[];
  modelReviews: ExternalFloodAnalysisRecord[];
  externalFloodEquipmentList: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodPlantInvestigation extends ExternalFloodTechnicalSection {
  investigations: ExternalFloodAnalysisRecord[];
  findings: ExternalFloodAnalysisRecord[];
  floodPathways: ExternalFloodAnalysisRecord[];
  protectionFeatures: ExternalFloodAnalysisRecord[];
  drainageFeatures: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodFragilityBasis extends ExternalFloodTechnicalSection {
  screeningDecisions: ExternalFloodAnalysisRecord[];
  methodSelections: ExternalFloodAnalysisRecord[];
  failureModes: ExternalFloodAnalysisRecord[];
  correlationGroups: ExternalFloodAnalysisRecord[];
  coexistentHazardAssessments: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodFragilityAnalysis extends ExternalFloodTechnicalSection {
  barrierFragilities: ExternalFloodAnalysisRecord[];
  equipmentFragilities: ExternalFloodAnalysisRecord[];
  structuralLoadModels: ExternalFloodAnalysisRecord[];
  sealAssessments: ExternalFloodAnalysisRecord[];
  fragilityCurves: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodScenarioDevelopment extends ExternalFloodTechnicalSection {
  scenarioGroups: ExternalFloodAnalysisRecord[];
  propagationModels: ExternalFloodAnalysisRecord[];
  scenarioTimelines: ExternalFloodAnalysisRecord[];
  hazardCombinations: ExternalFloodAnalysisRecord[];
  screeningDecisions: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodPlantResponseModel extends ExternalFloodTechnicalSection {
  peerReviewDispositions: ExternalFloodAnalysisRecord[];
  initiatingEventModels: ExternalFloodAnalysisRecord[];
  eventSequenceModels: ExternalFloodAnalysisRecord[];
  successCriteria: ExternalFloodAnalysisRecord[];
  systemModelModifications: ExternalFloodAnalysisRecord[];
  missionTimes: ExternalFloodAnalysisRecord[];
  dataParameters: ExternalFloodAnalysisRecord[];
  multiUnitAssessments: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodHumanReliabilityAnalysis extends ExternalFloodTechnicalSection {
  humanActions: ExternalFloodAnalysisRecord[];
  humanFailureEvents: ExternalFloodAnalysisRecord[];
  performanceContexts: ExternalFloodAnalysisRecord[];
  hepEstimates: ExternalFloodAnalysisRecord[];
  confirmations: ExternalFloodAnalysisRecord[];
  recoveryAssessments: ExternalFloodAnalysisRecord[];
  dependencyAssessments: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodEventSequenceQuantification extends ExternalFloodTechnicalSection {
  quantificationRuns: ExternalFloodAnalysisRecord[];
  hazardIntervalResults: ExternalFloodAnalysisRecord[];
  eventSequenceFamilyResults: ExternalFloodAnalysisRecord[];
  convergenceStudies: ExternalFloodAnalysisRecord[];
  uncertaintyResults: ExternalFloodAnalysisRecord[];
  riskContributors: ExternalFloodAnalysisRecord[];
  screeningDecisions: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodRiskInterpretation {
  riskInsights: ExternalFloodAnalysisRecord[];
  refinementActions: ExternalFloodAnalysisRecord[];
  quantificationIterations: ExternalFloodAnalysisRecord[];
  sensitivityStudies: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodRiskIntegration {
  integrationResults: ExternalFloodAnalysisRecord[];
  riskDecisions: ExternalFloodAnalysisRecord[];
  traceabilityPaths: ExternalFloodAnalysisRecord[];
  controlledBaselines: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodTechnicalClosure extends ExternalFloodTechnicalSection {
  conformanceReviews: ExternalFloodAnalysisRecord[];
  documentationChecks: ExternalFloodAnalysisRecord[];
  interfaceClosureChecks: ExternalFloodAnalysisRecord[];
  peerReviewTeam: ExternalFloodAnalysisRecord[];
  peerReviewFindings: ExternalFloodAnalysisRecord[];
  readinessChecks: ExternalFloodAnalysisRecord[];
}

export interface ExternalFloodWorkflowRecord extends ExternalFloodAnalysisRecord {
  workflowRecordType: "REPORT_SECTION" | "QUALITY_CHECK" | "REVIEW_ASSIGNMENT" | "REVIEW_FINDING" | "APPROVAL_READINESS" | "APPROVAL_SIGNATURE";
  discipline: string;
  assignee: string;
  dueDate?: string;
  result: string;
  verificationRefs: string[];
}

export interface ExternalFloodPraWorkflow {
  reportSections: ExternalFloodWorkflowRecord[];
  draftQualityChecks: ExternalFloodWorkflowRecord[];
  reviewAssignments: ExternalFloodWorkflowRecord[];
  reviewFindings: ExternalFloodWorkflowRecord[];
  approvalReadiness: ExternalFloodWorkflowRecord[];
  approvalSignatures: ExternalFloodWorkflowRecord[];
}

export interface ExternalFloodPraDocumentation {
  overallProcessDescription: string;
  analysisBasisSummary: string;
  evidenceAndSiteBasisSummary: string;
  hazardScreeningSummary: string;
  siteFloodModelSummary: string;
  localIntensePrecipitationSummary: string;
  riverineFloodSummary: string;
  damAndImpoundmentSummary: string;
  surgeSeicheTsunamiSummary: string;
  hazardIntegrationSummary: string;
  equipmentListSummary: string;
  investigationSummary: string;
  fragilitySummary: string;
  scenarioSummary: string;
  plantResponseSummary: string;
  humanReliabilitySummary: string;
  quantificationSummary: string;
  riskInsights: string;
  uncertaintySummary: string;
  configurationControlDescription: string;
  peerReviewScope: string;
  supportingDocumentRefs: string[];
}

export interface ExternalFloodPraExampleDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  sizeLabel: string;
  uploadedLabel: string;
  extracted: string;
  linked: number;
  url?: string;
}

export interface ExternalFloodPRA extends TechnicalElement<TechnicalElementTypes.EXTERNAL_FLOODING_PRA> {
  praScope: string;
  hazardConditionedModels: HazardConditionedMethodModels;
  analysisBasis: ExternalFloodAnalysisBasis;
  hazardScreening: ExternalFloodHazardScreening;
  siteFloodModel: ExternalFloodSiteModel;
  localIntensePrecipitationAnalysis: ExternalFloodLipAnalysis;
  riverineFloodAnalysis: ExternalFloodRiverineAnalysis;
  damAndImpoundmentAnalysis: ExternalFloodDamAnalysis;
  surgeSeicheTsunamiAnalysis: ExternalFloodCoastalAnalysis;
  hazardIntegration: ExternalFloodHazardIntegration;
  preliminaryPlantResponse: ExternalFloodPreliminaryPlantResponse;
  plantInvestigation: ExternalFloodPlantInvestigation;
  sscScreeningAndFragilityBasis: ExternalFloodFragilityBasis;
  floodFragilityAnalysis: ExternalFloodFragilityAnalysis;
  scenarioDevelopment: ExternalFloodScenarioDevelopment;
  plantResponseModel: ExternalFloodPlantResponseModel;
  humanReliabilityAnalysis: ExternalFloodHumanReliabilityAnalysis;
  eventSequenceQuantification: ExternalFloodEventSequenceQuantification;
  integratedUncertainties: ExternalFloodModelUncertainty[];
  riskInterpretation: ExternalFloodRiskInterpretation;
  riskIntegration: ExternalFloodRiskIntegration;
  technicalClosure: ExternalFloodTechnicalClosure;
  workflow: ExternalFloodPraWorkflow;
  documentation: ExternalFloodPraDocumentation;
  configurationControlRecordId?: string;
  exampleDocuments?: ExternalFloodPraExampleDocument[];
  newlyDevelopedMethodIds?: string[];
}

export type ExternalFloodWorkbookSubelement = "INTEGRATED" | "XFHA" | "XFFR" | "XFPR" | "WORKFLOW";

export interface ExternalFloodStepDefinition {
  id: string;
  number: string;
  label: string;
  title: string;
  subtitle: string;
  subelement: ExternalFloodWorkbookSubelement;
}

export const EXTERNAL_FLOOD_STEP_DEFINITIONS: ExternalFloodStepDefinition[] = [
  { id: "analysis-basis", number: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis, scope, and interfaces", subtitle: "Define the PRA application, analysis boundary, baseline model, operating states, and technical-element inputs and outputs." },
  { id: "site-evidence", number: "02", label: "Site and evidence", subelement: "XFHA", title: "Controlled evidence and site basis", subtitle: "Control the site, survey datum, watershed and coastal setting, design records, flood studies, operating experience, and lifecycle assumptions." },
  { id: "hazard-screening", number: "03", label: "Hazard screening", subelement: "XFHA", title: "Flood hazard identification and screening", subtitle: "Identify and screen precipitation, riverine, dam, surge, seiche, tsunami, groundwater, wave, ice, and coincident flood mechanisms." },
  { id: "site-model", number: "04", label: "Site flood model", subelement: "XFHA", title: "Site flood model and common parameters", subtitle: "Establish topography, drainage, roughness, infiltration, loss, datum, boundary-condition, numerical-model, and quality bases shared across hazard analyses." },
  { id: "lip", number: "05", label: "Local precipitation", subelement: "XFHA", title: "Local intense precipitation analysis", subtitle: "Develop rainfall, drainage-capacity, surface-routing, ponding, duration, and location-specific flood hazard results." },
  { id: "riverine", number: "06", label: "Riverine flood", subelement: "XFHA", title: "Riverine and related flood analysis", subtitle: "Develop watershed, discharge-frequency, stage-discharge, levee, ice, sediment, and site inundation results." },
  { id: "dam-impoundment", number: "07", label: "Dam and impoundment", subelement: "XFHA", title: "Dam and impoundment analysis", subtitle: "Inventory upstream and onsite impoundments and quantify failure modes, breach development, routing, warning, and site effects." },
  { id: "surge-seiche-tsunami", number: "08", label: "Surge, seiche, tsunami", subelement: "XFHA", title: "Surge, seiche, and tsunami analysis", subtitle: "Evaluate coastal and enclosed-water sources, water levels, waves, runup, drawdown, duration, debris, and site inundation." },
  { id: "hazard-integration", number: "09", label: "Hazard results", subelement: "XFHA", title: "Hazard curves, spatial characterization, and uncertainty", subtitle: "Integrate frequency and spatial results, uncertainty branches, flood intervals, duration, velocity, warning, and numerical convergence." },
  { id: "preliminary-response", number: "10", label: "XFEL", subelement: "XFPR", title: "Preliminary plant response and XFEL development", subtitle: "Use the baseline PRA and flood effects to identify initiators, credited functions, SSCs, supports, pathways, and failure modes." },
  { id: "investigation", number: "11", label: "Investigation", subelement: "XFFR", title: "Plant investigation and flood-pathway confirmation", subtitle: "Confirm as-built or intended grades, openings, barriers, penetrations, drains, pathways, access routes, and exposed SSCs." },
  { id: "fragility-basis", number: "12", label: "Fragility basis", subelement: "XFFR", title: "SSC screening and fragility basis", subtitle: "Screen every XFEL SSC and protection feature by flood effect and select justified fragility, dependency, and correlation methods." },
  { id: "fragility", number: "13", label: "Flood fragility", subelement: "XFFR", title: "Flood protection and SSC fragility analysis", subtitle: "Develop barrier, seal, structure, equipment, load, leakage, submergence, impact, erosion, and conditional failure fragilities." },
  { id: "scenarios", number: "14", label: "Flood scenarios", subelement: "XFPR", title: "Flood scenario, propagation, and timeline development", subtitle: "Group sources and pathways into scenarios and model propagation, protection states, timing, combinations, and screened contributions." },
  { id: "plant-response", number: "15", label: "Plant response", subelement: "XFPR", title: "Initiating events and plant response modeling", subtitle: "Finalize flood initiating events, event sequences, success criteria, system logic, data, mission times, dependencies, and multi-unit effects." },
  { id: "human-reliability", number: "16", label: "Human reliability", subelement: "XFPR", title: "External flood human reliability analysis", subtitle: "Evaluate preparation, response, and recovery under warning, access, water, debris, darkness, staffing, communication, and multi-unit constraints." },
  { id: "quantification", number: "17", label: "Quantification", subelement: "XFPR", title: "Event-sequence quantification", subtitle: "Integrate flood hazard, fragility, scenario, plant-response, and HRA models and demonstrate stable plant-year results." },
  { id: "risk-interpretation", number: "18", label: "Risk interpretation", subelement: "INTEGRATED", title: "Risk interpretation and model refinement", subtitle: "Rank flood mechanisms, locations, SSCs, scenarios, and actions; evaluate sensitivities and refine material model gaps." },
  { id: "risk-integration", number: "19", label: "Risk integration", subelement: "INTEGRATED", title: "Risk integration and controlled baseline", subtitle: "Transfer results to integrated risk measures, resolve double counting, record decisions, trace evidence, and establish the controlled baseline." },
  { id: "technical-closure", number: "20", label: "Technical closure", subelement: "INTEGRATED", title: "Documentation, conformance, and peer-review readiness", subtitle: "Complete SR conformance, documentation, interface closure, independent review preparation, findings, and readiness evidence." },
  { id: "draft", number: "21", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Generate and verify the controlled External Flood PRA report and supporting analysis package." },
  { id: "review", number: "22", label: "Review", subelement: "WORKFLOW", title: "Review and resolve findings", subtitle: "Perform technical and independent review and resolve findings with traceable evidence." },
  { id: "approval", number: "23", label: "Approval", subelement: "WORKFLOW", title: "Approve and release the baseline", subtitle: "Confirm readiness, obtain approval, and release the configuration-controlled External Flood PRA baseline." },
];

export const XFHA_SR_CATALOG = createExternalFloodSrCatalog("XFHA", {
  A: [
    "Define the specific site or justified bounding site and the external-flood PRA scope.",
    "Compile all site-relevant external-flood mechanisms and combinations.",
    "Collect current regional and site hydrometeorological, topographic, drainage, and water-control information.",
    "Apply approved qualitative and quantitative screening criteria to each candidate flood mechanism.",
    "Retain flood mechanisms whose occurrence, effects, or combined contribution cannot be screened.",
    "Evaluate causal and coincident combinations without double counting.",
    "Demonstrate that aggregated screened flood contributions meet the approved screening threshold.",
    "Confirm screening decisions against as-built/as-operated or as-designed/as-intended conditions.",
    "Control pre-operational assumptions when site or design information is incomplete.",
  ],
  B: [
    "Define water-surface elevation, depth, velocity, duration, warning time, waves, debris, erosion, and other parameters needed by plant response.",
    "Use a consistent vertical and horizontal datum and document all conversions.",
    "Discretize each retained hazard over the range that can affect plant response.",
    "Extend hazard calculations far enough into the tail that truncation does not distort results or contributors.",
  ],
  C: [
    "Develop local-intense-precipitation inputs using applicable current precipitation-frequency information.",
    "Represent temporal and spatial storm distributions appropriate to the site and analysis purpose.",
    "Characterize site grading, catchments, drainage networks, inlets, roof drainage, and overflow routes.",
    "Account for infiltration, initial losses, surface roughness, blockage, and drainage availability.",
    "Model two-dimensional or otherwise justified surface routing to safety-related locations.",
    "Evaluate doors, openings, penetrations, vents, and other ingress points affected by local ponding.",
    "Determine location-specific water depth, elevation, velocity, duration, and arrival time.",
    "Evaluate plausible drainage degradation, blockage, backflow, and concurrent loss of power.",
    "Compare model behavior with hand checks, benchmarks, observations, or alternate models.",
    "Quantify uncertainty in precipitation, loss, drainage, and hydraulic-model parameters.",
    "Produce controlled local-precipitation hazard results suitable for plant-response quantification.",
  ],
  D: [
    "Develop riverine discharge-frequency relationships using qualified gage, regional, paleoflood, or hydrologic evidence.",
    "Convert discharge to site water level and other flood parameters with justified hydraulic models.",
    "Evaluate levees, ice, sediment, backwater, tributary, and channel-change effects where applicable.",
    "Produce controlled riverine hazard results and characterize uncertainty over the analyzed range.",
  ],
  E: [
    "Identify upstream, downstream, and onsite dams, levees, reservoirs, canals, and impoundments that can affect the site.",
    "Evaluate credible failure, misoperation, overtopping, seismic, and cascading failure modes.",
    "Model breach development and release hydrographs using justified parameters and alternatives.",
    "Route releases to the site and quantify arrival, elevation, depth, velocity, duration, debris, and erosion effects.",
  ],
  F: [
    "Identify applicable storm-surge, seiche, tsunami, tide, wave, runup, drawdown, and coastal water-level sources.",
    "Use qualified probabilistic or conservative models for each retained coastal or enclosed-water hazard.",
    "Account for bathymetry, topography, shoreline configuration, tide, waves, sediment, debris, and erosion where applicable.",
    "Produce controlled coastal hazard results and uncertainty characterizations suitable for plant response.",
  ],
  G: [
    "Identify parameter, model, and assumption uncertainties throughout external-flood hazard analysis.",
    "Characterize notable alternatives with logic trees, alternate models, data, or sensitivity studies.",
    "Develop representative hazard functions for CC-I or mean and percentile functions for CC-II.",
    "Document methods, inputs, screening, models, results, uncertainties, assumptions, limitations, and traceability.",
  ],
}, { "XFHA-G4": ["PRE_OPERATIONAL"] });

export const XFFR_SR_CATALOG = createExternalFloodSrCatalog("XFFR", {
  A: [
    "Include all SSCs, flood-protection features, pathways, supports, and failure modes identified by plant response.",
    "Develop fragilities using the external-flood parameters that control each failure mode.",
    "Use site-specific fragilities for a specific-site PRA and justified bounding fragilities for a bounding-site PRA.",
    "Cover the complete hazard range used in plant-response quantification.",
    "Address dependencies and correlations among barriers, pathways, structures, equipment, and common flood demands.",
  ],
  B: [
    "Use plant investigations to establish as-built/as-operated or as-designed/as-intended flood conditions.",
    "Confirm elevations, grades, drainage, openings, penetrations, seals, doors, hatches, walls, and access routes.",
    "Identify supporting SSCs and environmental or spatial dependencies required for credited functions.",
    "Confirm screening and fragility assumptions against observed or intended plant conditions.",
    "Track investigation findings to model changes, corrective actions, or controlled limitations.",
  ],
  C: [
    "Justify screening each SSC and failure mode from applicable water level, load, leakage, debris, erosion, or access effects.",
    "Retain conservative assumptions and aggregate contributions when screening multiple features or modes.",
  ],
  D: [
    "Develop fragilities for permanent and temporary flood barriers, doors, hatches, penetrations, seals, and closures.",
    "Represent leakage, overtopping, bypass, structural failure, installation, alignment, aging, and maintenance effects.",
    "Evaluate hydrostatic, hydrodynamic, wave, debris-impact, erosion, scour, buoyancy, and uplift loads where applicable.",
    "Address human deployment and configuration dependencies for non-passive protection features.",
  ],
  E: [
    "Develop equipment and structure fragilities for submergence, spray, seepage, groundwater, sediment, and loss of support.",
    "Aggregate component modes into functional fragilities with dependencies and correlations explicit.",
  ],
  F: [
    "Identify fragility uncertainty sources and reasonable alternative models.",
    "Develop conservative representative fragilities for CC-I or propagated uncertainty distributions for CC-II.",
    "Document fragility methods, inputs, failure modes, screening, investigations, results, assumptions, limitations, and traceability.",
  ],
}, { "XFFR-F3": ["PRE_OPERATIONAL"] });

export const XFPR_SR_CATALOG = createExternalFloodSrCatalog("XFPR", {
  A: [
    "Identify direct and consequential external-flood initiating events for every retained mechanism.",
    "Include initiators caused by protective actions, shutdowns, reconfiguration, access loss, or support failures.",
    "Use plant and industry flood operating experience when identifying initiators.",
    "Map retained flood-induced SSC and human failures into the initiating-event set.",
    "Represent initiating-event frequency consistently with the hazard model and flood intervals.",
    "Address common, dependent, and multi-unit initiating effects.",
    "Document initiating-event development and traceability to hazard and fragility records.",
  ],
  B: [
    "Use an applicable baseline PRA and dispose relevant peer-review findings before adapting the plant-response model.",
    "Identify event-sequence changes caused by flood progression, timing, duration, warning, recovery, and combinations.",
    "Define complete external-flood event-sequence families and release-category mappings.",
  ],
  C: [
    "Develop and maintain an External Flood Equipment List linked to plant-response functions and failure modes.",
    "Include required structures, barriers, penetrations, supports, utilities, instrumentation, and access dependencies.",
    "Model flood-induced SSC failures using the applicable hazard and fragility parameters.",
    "Represent flood propagation, ingress, drainage, pumping, accumulation, and spatial dependencies.",
    "Represent protection-feature states, deployment, bypass, leakage, and common-cause dependencies.",
    "Confirm success criteria for each flood event-sequence family and hazard interval.",
    "Define mission times consistent with flood duration, receding water, access restoration, and source response.",
    "Adapt random-failure, common-cause, unavailability, and recovery data to the flood context.",
    "Represent coexistent hazards and avoid double counting their frequencies and effects.",
    "Evaluate shared SSCs, resources, staffing, access, and organizational response for multi-unit or multi-source sites.",
    "Verify model logic, basic-event mapping, dependencies, and numerical implementation.",
    "Document plant-response methods, changes, assumptions, uncertainties, limitations, and traceability.",
  ],
  D: [
    "Identify preparation, response, mitigation, and recovery actions affected by external flooding.",
    "Characterize warning, cues, procedures, timing, workload, water, debris, access, habitability, staffing, and communications.",
    "Confirm credited actions through procedure review, interviews, talk-throughs, table-top exercises, or simulations.",
    "Quantify HEPs and uncertainty with a recognized method and flood-specific performance context.",
    "Evaluate dependencies, exclusive recoveries, and multi-unit demands among flood-related human failure events.",
  ],
  E: [
    "Integrate hazard, fragility, scenario, plant-response, data, and HRA models by flood interval.",
    "Quantify event-sequence-family frequencies on a consistent plant-year basis.",
    "Use appropriate treatment for mutually exclusive, overlapping, rare, and high conditional-probability events.",
    "Demonstrate convergence for hazard discretization, upper-tail truncation, scenario screening, and numerical sampling.",
    "Propagate applicable hazard, fragility, plant-response, data, and HRA uncertainty for CC-II.",
    "Identify dominant mechanisms, locations, protection features, SSCs, scenarios, actions, and basic events.",
    "Screen only quantitatively insignificant scenarios using approved criteria and aggregate checks.",
    "Document quantification inputs, software, controls, results, sensitivities, uncertainty, and traceability.",
  ],
  F: [
    "Interpret results to develop stable external-flood risk insights.",
    "Evaluate reasonable model alternatives and sensitivities that can affect risk conclusions.",
    "Refine material gaps and repeat quantification until results and contributor rankings are stable.",
    "Integrate external-flood results into total-risk metrics without overlap or double counting.",
    "Record risk-informed decisions, limitations, and configuration-control conditions.",
    "Trace important results from evidence through hazard, fragility, scenario, sequence, and decision records.",
    "Establish and release a controlled external-flood PRA baseline.",
  ],
  G: [
    "Document the complete external-flood plant-response process, models, results, uncertainty, and limitations.",
    "Resolve technical-element interfaces and confirm consistency of transferred data.",
    "Prepare the model, evidence, conformance matrix, and documentation for independent peer review.",
  ],
  H: [
    "Track peer-review team qualifications, independence, scope, findings, resolutions, and closure evidence.",
    "Control pre-operational assumptions and closure actions affecting plant-response conclusions.",
    "Complete approval-readiness checks before releasing the external-flood PRA baseline.",
  ],
}, { "XFPR-H2": ["PRE_OPERATIONAL"] });

export const EXTERNAL_FLOOD_PRA_SR_CATALOG: Record<string, ExternalFloodSrCatalogEntry> = {
  ...XFHA_SR_CATALOG,
  ...XFFR_SR_CATALOG,
  ...XFPR_SR_CATALOG,
};

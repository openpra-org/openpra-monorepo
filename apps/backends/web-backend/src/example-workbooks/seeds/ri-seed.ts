import {
  type RiskIntegration,
  type CompiledRiskInput,
  type IntegratedRiskResults,
  type RiskSignificanceCriteria,
  type SignificantRiskContributors,
  type RiskIntegrationMethod,
  type ModelUncertaintySource,
  type ScreenedItemLedgerEntry,
  type RiskUncertaintyAnalysis,
  type RiDocumentation,
  RI_SR_CATALOG,
} from "interfaces-mef-types/ri/risk-integration";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-06-09T12:00:00.000Z";
const CREATED = "2026-06-03T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as SRReference["hlr"] }));
}

const WARN_SRS = new Set<string>(["RI-B3", "RI-B5"]);

const SR_EVIDENCE: Record<string, string> = {
  "RI-A1": "Three consequence measures are defined from the intended applications.",
  "RI-A2": "The relative criteria are recorded for a baseline-risk application, not the active branch.",
  "RI-A3": "The absolute criteria are defined against the frequency-consequence target per Table 1.9-2.",
  "RI-A4": "The minimum reporting frequency is the standard default of 1E-7 per plant-year.",
  "RI-A5": "The minimum reporting consequence is the standard default of ten percent of background dose.",
  "RI-B1": "Five families are compiled with their ESQ frequencies and their RC consequences.",
  "RI-B2": "The risk is quantified with means, plotted against the target, and drawn as an exceedance curve at CC-II.",
  "RI-B3": "The seismic group runs a conservative model and internal events a realistic one, with the per-hazard-group review being documented.",
  "RI-B4": "The multi-reactor and multi-source terms are recorded as not driving for the single-unit single-source scope.",
  "RI-B5": "The boundary-leak grouping is reopened to ES so the within-family variation is justified.",
  "RI-B6": "Six risk-significant contributors are identified at an insight-grade level.",
  "RI-B7": "The integration codes and their limits are identified across every hazard, state, category and sequence.",
  "RI-C1": "The key model uncertainties from all ten elements are compiled, screened-out items included.",
  "RI-C2": "The grouping uncertainty is reviewed and no artificial significance is found.",
  "RI-C3": "The compiled uncertainties are assessed against each risk metric.",
  "RI-C4": "The distributions are propagated with the correlation and the phenomena dependencies at CC-II.",
  "RI-D1": "The criteria, results, insights and traceability are documented.",
  "RI-D2": "The model-uncertainty sources, assumptions and alternatives are documented.",
};

const conformanceMatrix: SRConformance[] = Object.keys(RI_SR_CATALOG).flatMap((code) => {
  const meta = RI_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the risk integration.";
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr: meta.hlr,
    capabilityCategory,
    applicableToStage: meta.stages,
    status,
    satisfiedByElementPaths: [meta.hlr === "A" ? "riskSignificanceCriteria" : meta.hlr === "B" ? "integratedRiskResults" : meta.hlr === "C" ? "uncertaintyAnalyses" : "documentation"],
    evidence,
  }));
});

const riskSignificanceCriteria: RiskSignificanceCriteria[] = [
  {
    uuid: "CRIT-A3",
    name: "Absolute criteria against the frequency-consequence target",
    description: "Judge the risk against absolute targets, with a frequency-consequence target for the application.",
    applicationType: "FIXED_RISK_TARGET",
    criteriaSource: "TABLE_1_9_2",
    criteriaType: "SAFETY_GOAL",
    metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
    justification: "The fixed-risk-target application uses RI-A3 with Table 1.9-2, as in the LMP demonstrations.",
    intendedApplications: ["LMP frequency-consequence demonstration"],
    implementsSrs: srs("RI-A3"),
  },
  {
    uuid: "CRIT-A2",
    name: "Relative criteria for a baseline-risk application",
    description: "Rank the risk by relative significance, accounting for both frequency and consequence.",
    applicationType: "BASELINE_RISK",
    criteriaSource: "TABLE_1_9_1",
    criteriaType: "OTHER",
    metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
    justification: "A baseline-risk application would use RI-A2 with Table 1.9-1 or a justified alternate.",
    implementsSrs: srs("RI-A2"),
  },
];

const compiledRiskInputs: CompiledRiskInput[] = [
  {
    uuid: "ESF-1",
    eventSequenceFamilyRef: "ESF-1",
    releaseCategoryRef: "RC-3",
    sourceTermDefinitionRef: "ST-3",
    frequency: 3.2e-7,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.9e-7, errorFactor: 3.2 },
    esqFamilyQuantificationRef: "ESQ-ESF-1",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-4, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 8.0e-2, unit: "Sv" },
    ],
    rcqRecordRef: "RCQ-ESF-1",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-4",
    eventSequenceFamilyRef: "ESF-4",
    releaseCategoryRef: "RC-3",
    sourceTermDefinitionRef: "ST-3",
    frequency: 2.4e-7,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.2e-7, errorFactor: 3.3 },
    esqFamilyQuantificationRef: "ESQ-ESF-4",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-4, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 8.0e-2, unit: "Sv" },
    ],
    rcqRecordRef: "RCQ-ESF-1",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-2",
    eventSequenceFamilyRef: "ESF-2",
    releaseCategoryRef: "RC-1",
    sourceTermDefinitionRef: "ST-1",
    frequency: 1.1e-7,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 1.0e-7, errorFactor: 3.25 },
    esqFamilyQuantificationRef: "ESQ-ESF-2",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-8, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 1.0e-6, unit: "Sv" },
    ],
    rcqRecordRef: "RCQ-ESF-2",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-3",
    eventSequenceFamilyRef: "ESF-3",
    releaseCategoryRef: "RC-2",
    sourceTermDefinitionRef: "ST-2",
    frequency: 8.0e-8,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 7.1e-8, errorFactor: 3.5 },
    esqFamilyQuantificationRef: "ESQ-ESF-3",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 1.0e-5, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 4.0e-3, unit: "Sv" },
    ],
    rcqRecordRef: "RCQ-ESF-3",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-5",
    eventSequenceFamilyRef: "ESF-5",
    releaseCategoryRef: "RC-1",
    sourceTermDefinitionRef: "ST-1",
    frequency: 4.5e-8,
    frequencyUnit: "per plant-year",
    esqFamilyQuantificationRef: "ESQ-ESF-5",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-8, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 1.0e-6, unit: "Sv" },
    ],
    rcqRecordRef: "RCQ-ESF-2",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
];

const integratedRiskResults: IntegratedRiskResults = {
  uuid: "RI-RESULTS-1",
  name: "Generic-1 integrated risk results",
  description: "The frequency-weighted totals across the five families, judged against the targets for the application.",
  calculationLevel: "MEAN",
  metrics: [
    {
      uuid: "METRIC-LATENT",
      name: "Integrated latent cancer risk",
      metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
      description: "The frequency-weighted sum across the five families, driven by the early-release pair.",
      value: 1.1e-10,
      units: "per plant-year",
      uncertainty: { type: DistributionType.LOGNORMAL, median: 1.1e-10, errorFactor: 2.75 },
      acceptanceCriteria: {
        limit: 2.0e-9,
        basis: "The cumulative target for the integrated latent cancer risk.",
        complianceStatus: "COMPLIANT",
      },
      implementsSrs: srs("RI-B2"),
    },
    {
      uuid: "METRIC-DOSE",
      name: "Mean site-boundary dose risk",
      metricType: "CUSTOM",
      description: "The dose-weighted frequency total against the cumulative target.",
      value: 1.8e-8,
      units: "Sv per plant-year",
      acceptanceCriteria: {
        limit: 1.0e-7,
        basis: "The cumulative target for the mean site-boundary dose risk.",
        complianceStatus: "COMPLIANT",
      },
      implementsSrs: srs("RI-B2"),
    },
  ],
  calculationApproach: {
    sumOfProducts: true,
    frequencyConsequencePlots: true,
    exceedanceFrequencyCurves: true,
    justification: "The risk is totaled by a sum of products, plotted against the frequency-consequence target, and drawn as an exceedance curve at CC-II, each one accepted route.",
  },
  frequencyConsequencePlotData: [
    { eventSequenceRef: "ESF-1", eventSequenceName: "Loss of decay-heat removal", frequency: 3.2e-7, consequence: 8.0e-2, consequenceMetric: "Site-boundary individual dose" },
    { eventSequenceRef: "ESF-4", eventSequenceName: "Loss of offsite power", frequency: 2.4e-7, consequence: 8.0e-2, consequenceMetric: "Site-boundary individual dose" },
    { eventSequenceRef: "ESF-3", eventSequenceName: "Primary sodium boundary leak", frequency: 8.0e-8, consequence: 4.0e-3, consequenceMetric: "Site-boundary individual dose" },
    { eventSequenceRef: "ESF-2", eventSequenceName: "Protected loss of primary flow", frequency: 1.1e-7, consequence: 1.0e-6, consequenceMetric: "Site-boundary individual dose" },
    { eventSequenceRef: "ESF-5", eventSequenceName: "Reactivity insertion transient", frequency: 4.5e-8, consequence: 1.0e-6, consequenceMetric: "Site-boundary individual dose" },
  ],
  exceedanceFrequencyCurveData: [
    {
      consequenceMetric: "Site-boundary individual dose",
      dataPoints: [
        { consequenceValue: 1e-6, exceedanceFrequency: 8.0e-7 },
        { consequenceValue: 1e-4, exceedanceFrequency: 7.0e-7 },
        { consequenceValue: 4e-3, exceedanceFrequency: 6.4e-7 },
        { consequenceValue: 2e-2, exceedanceFrequency: 5.6e-7 },
        { consequenceValue: 8e-2, exceedanceFrequency: 5.6e-7 },
        { consequenceValue: 2e-1, exceedanceFrequency: 5.0e-9 },
      ],
    },
  ],
  hazardGroupContributions: [
    { hazardGroup: "Internal events", contribution: 0.43 },
    { hazardGroup: "Seismic", contribution: 0.57 },
  ],
  aggregationApproach: {
    description: "Each source and hazard contribution is identified, and the differences in conservatism are flagged before the sum is read.",
    perSourceHazardContributionsIdentified: true,
    detailConservatismDifferences: [
      { scope: "Internal events", description: "The station-blackout early release runs a realistic CC-II model." },
      { scope: "Seismic", description: "The earthquake-initiated early release runs a conservative CC-I model." },
    ],
    separateReviewPerformed: true,
    separateReviewFindings: "The seismic group runs a conservative model while internal events run a realistic one, so the determinations are reviewed separately per hazard group before the sum is trusted.",
    justification: "A conservative model may not be added to a realistic one and presented as either.",
  },
  multiReactorContributionsIncluded: true,
  multiSourceContributionsIncluded: true,
  complianceStatus: [
    { criterion: "Integrated latent cancer risk", limit: 2.0e-9, status: "COMPLIANT", basis: "Below target." },
    { criterion: "Mean site-boundary dose risk", limit: 1.0e-7, status: "COMPLIANT", basis: "Below target." },
  ],
  keyAssumptions: ["The site is single-unit, so the multi-reactor term is recorded as not driving.", "The reactor core is the single source, so the multi-source term is recorded as not driving."],
  implementsSrs: srs("RI-B2", "RI-B3", "RI-B4"),
};

const significantContributors: SignificantRiskContributors = {
  uuid: "RI-SIG-1",
  metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
  description: "The contributors identified at an insight-grade level, the roll-up RI documents and feeds back upstream.",
  significantEventSequenceFamilies: [
    {
      uuid: "SC-ESF-1",
      name: "Early-release family ESF-1",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-1",
      importanceLevel: ImportanceLevel.HIGH,
      context: "Drives the integrated latent risk through the seismic early release.",
    },
    {
      uuid: "SC-ESF-4",
      name: "Early-release family ESF-4",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-4",
      importanceLevel: ImportanceLevel.HIGH,
      context: "The station-blackout early release, the second driver of the total.",
    },
    {
      uuid: "SC-ESF-3",
      name: "Boundary-leak family ESF-3",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-3",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The delayed filtered release, medium significance with a grouping question open.",
    },
  ],
  significantBasicEvents: [
    {
      uuid: "SC-BE-1",
      name: "Decay-heat removal common-cause failure",
      contributorType: "Basic event",
      sourceElement: TechnicalElementTypes.DATA_ANALYSIS,
      sourceId: "BE-DHR-CCF",
      importanceLevel: ImportanceLevel.HIGH,
      context: "The dominant cutset behind the loss-of-decay-heat family.",
    },
    {
      uuid: "SC-PAR-1",
      name: "Pool scrubbing decontamination factor",
      contributorType: "Parameter",
      sourceElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS,
      sourceId: "PAR-POOL-DF",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The retention uncertainty that moves the consequence side of the total.",
    },
  ],
  significantHumanFailureEvents: [
    {
      uuid: "SC-HFE-1",
      name: "Operator fails to align backup cooling",
      contributorType: "Human failure event",
      sourceElement: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS,
      sourceId: "HFE-BACKUP-COOLING",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The risk-significant operator action shared by the early-release families.",
    },
  ],
  significantSystems: [
    {
      uuid: "SC-SYS-1",
      name: "Decay-heat removal system",
      contributorType: "System",
      sourceElement: TechnicalElementTypes.SYSTEMS_ANALYSIS,
      sourceId: "SYS-DHR",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The system whose failure opens the early-release path.",
    },
  ],
  insightDerivationBasis: "The contributors are ranked by their contribution to the integrated latent risk, per the absolute criteria of the application.",
  insights: ["The passive decay-heat path explains the low integrated risk."],
  implementsSrs: srs("RI-B6"),
};

const integrationMethods: RiskIntegrationMethod[] = [
  {
    uuid: "RIM-1",
    name: "Sum of frequency and consequence products",
    description: "Total the frequency and consequence products across the families.",
    scopeJustification: "Applicable across every hazard group, operating state, release category and sequence in the scope.",
    verificationStatus: { verified: true, verificationMethod: "Closed-form check against the family table." },
    implementsSrs: srs("RI-B2", "RI-B7"),
  },
  {
    uuid: "RIM-2",
    name: "Frequency-consequence diagram against the target",
    description: "Plot each family against the target selected for the application.",
    scopeJustification: "Applicable to every compiled family with a dose consequence.",
    verificationStatus: { verified: true, verificationMethod: "Spot-checked against the compiled inputs." },
    implementsSrs: srs("RI-B2", "RI-B7"),
  },
  {
    uuid: "RIM-3",
    name: "Exceedance-frequency curve",
    description: "Draw the frequency of exceeding each consequence level, at CC-II.",
    scopeJustification: "Applicable at CC-II for the dose metric across the compiled families.",
    verificationStatus: { verified: true, verificationMethod: "Reconciled against the family frequencies." },
    implementsSrs: srs("RI-B2", "RI-B7"),
  },
];

const modelUncertaintySources: ModelUncertaintySource[] = [
  { uuid: "MU-POS", name: "Operating-state time fractions", description: "Shifts the weighting between the operating states.", originatingElement: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Shifts the weighting between the operating states.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-IE", name: "Initiating-event group frequencies", description: "Scales the family frequencies directly.", originatingElement: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Scales the family frequencies directly.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-ES", name: "Sequence binning and end-state assignment", description: "Affects which family a borderline sequence joins.", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Affects which family a borderline sequence joins.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-SC", name: "Success-criteria margins", description: "Affects the branch outcomes near the threshold.", originatingElement: TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Affects the branch outcomes near the threshold.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-SY", name: "System-logic completeness", description: "Affects the cutset structure of the families.", originatingElement: TechnicalElementTypes.SYSTEMS_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Affects the cutset structure of the families.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-HR", name: "Human-error probabilities", description: "Drives the human-action cutsets.", originatingElement: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Drives the human-action cutsets.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-DA", name: "Parameter distributions", description: "Sets the spread of the family-frequency distribution.", originatingElement: TechnicalElementTypes.DATA_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Sets the spread of the family-frequency distribution.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-ESQ", name: "Truncation and the state-of-knowledge correlation", description: "Bounds the residual error and couples shared parameters.", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Bounds the residual error and couples shared parameters.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-MS", name: "Source-term release-fraction phenomena", description: "Moves the release magnitude that feeds the dose.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Moves the release magnitude that feeds the dose.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-RC", name: "Dispersion and deposition phenomena", description: "Moves the dose and the health-effect result.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Moves the dose and the health-effect result.", implementsSrs: srs("RI-C1", "RI-C3") },
];

const screenedItemsLedger: ScreenedItemLedgerEntry[] = [
  { uuid: "SL-POS", itemType: "PLANT_OPERATING_STATE", itemRef: "Short transition states", screeningElementCode: "POS", screeningBasis: "Short transition states screened by duration.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-IE", itemType: "INITIATING_EVENT", itemRef: "Large sodium-line events", screeningElementCode: "IE", screeningBasis: "Large sodium-line events screened by frequency.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-ES", itemType: "EVENT_SEQUENCE", itemRef: "Benign success paths", screeningElementCode: "ES", screeningBasis: "Benign success paths screened from the families.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-ESQ", itemType: "BASIC_EVENT", itemRef: "Low-frequency cutsets", screeningElementCode: "ESQ", screeningBasis: "Low-frequency cutsets below the truncation cutoff.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-MS", itemType: "HAZARD_EVENT", itemRef: "Slow-release mechanisms", screeningElementCode: "MS", screeningBasis: "Slow-release mechanisms screened from the categories.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-RC", itemType: "HAZARD_EVENT", itemRef: "Resuspension", screeningElementCode: "RC", screeningBasis: "Resuspension excluded at the chosen capability category.", implementsSrs: srs("RI-C1") },
];

const uncertaintyAnalyses: RiskUncertaintyAnalysis[] = [
  {
    uuid: "RIU-1",
    name: "Integrated latent risk uncertainty",
    description: "The risk-significant distributions propagate into a full distribution on the metric, with the correlation and the dependencies intact.",
    metric: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
    characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT",
    propagationMethod: "Monte Carlo sampling of the risk-significant distributions",
    parameterUncertainty: { type: DistributionType.LOGNORMAL, median: 1.1e-10, errorFactor: 2.75 },
    sokcAndPhenomenaTreatment: {
      eventFrequencySokcConsidered: true,
      phenomenaDependenciesConsidered: true,
      treatmentDescription: "The state-of-knowledge correlation from ESQ-E2 and the phenomena dependencies from MS-D4 and RCQ-C2 are sampled together.",
      riskSignificanceBasis: "The correlated parameters and the dependent phenomena are risk-significant for the early-release pair.",
    },
    evaluationScope: "COMBINATION",
    evaluationType: "QUANTITATIVE",
    keyUncertaintySourceRefs: ["MU-ESQ", "MU-MS", "MU-RC"],
    implementsSrs: srs("RI-C3", "RI-C4"),
  },
];

const sensitivityStudies: SensitivityStudy[] = [
  {
    uuid: "RIS-1",
    name: "Aggregation conservatism sweep",
    description: "Sweep of the seismic model conservatism.",
    variedParameters: ["Seismic model conservatism"],
    parameterRanges: { "Seismic model conservatism": [0, 1] },
    results: "Replacing the conservative seismic model with a realistic one lowers the total by about a third.",
  },
  {
    uuid: "RIS-2",
    name: "Grouping sensitivity",
    description: "Split of the early-release pair.",
    variedParameters: ["Family grouping"],
    parameterRanges: { "Family grouping": [1, 2] },
    results: "Splitting the early-release pair leaves both members risk-significant.",
  },
  {
    uuid: "RIS-3",
    name: "Correlation sweep",
    description: "Sweep of the state-of-knowledge correlation.",
    variedParameters: ["State-of-knowledge correlation"],
    parameterRanges: { "State-of-knowledge correlation": [0, 1] },
    results: "Ignoring the state-of-knowledge correlation understates the mean by about a quarter.",
  },
];

const documentation: RiDocumentation = {
  processDescription: "The family frequencies and the family consequences are compiled, the integrated risk is totaled and plotted, the contributors are judged, the uncertainty is propagated, and the result is dispatched back upstream, per ASME/ANS RA-S-1.4 HLR-RI-A through D.",
  inputsDescription: "RI takes the event sequence family frequencies from ESQ and the family-by-family consequence table from RC, with the criteria set by the intended application.",
  appliedMethods: "A sum of frequency and consequence products, a frequency-consequence diagram, an exceedance-frequency curve and a Monte Carlo propagation, each one accepted way to do its sub-task.",
  resultsSummary: "The integrated latent cancer risk is 1.1E-10 per plant-year, below the 2.0E-9 target, driven by the two early-release families.",
  riskSignificanceCriteriaUsed: "The absolute criteria of RI-A3 against the frequency-consequence target per Table 1.9-2, for a fixed-risk-target application.",
  resultsAndInsights: "Every family sits below the frequency-consequence target, and the passive decay-heat path explains the low integrated risk.",
  scopeLimitations: "The single-unit single-source scope keeps the multi-reactor and multi-source terms recorded but not driving.",
  traceabilityToUpstreamContributions: "The results trace to the ESQ family quantifications and the RCQ consequence records family by family.",
  acceptanceCriteriaComparison: "Both cumulative metrics are compliant, the latent risk at six percent of its target and the dose risk at eighteen percent.",
  keyUncertaintySources: "The truncation and correlation from ESQ, the release-fraction phenomena from MS and the dispersion phenomena from RC lead the register.",
  designFeatureInsights: "The passive decay-heat path explains the low integrated risk.",
  integratedContributorRollup: "Six contributors are risk-significant at an insight-grade level, led by the two early-release families.",
  modelUncertaintySourcesDocumentation: "The ten-element register compiles the sources, the assumptions and the alternatives, with every screened-out item included.",
  praTaskInterfaces: "RI compiles from ESQ and RC, and it dispatches the risk significance back to ESQ, MS, RC and the elements behind them, closing the loop the standard built.",
  implementsSrs: srs("RI-D1", "RI-D2"),
};

export const RI_ANALYSIS: RiskIntegration = {
  uuid: "ri-generic-1",
  name: "Generic-1 Risk Integration",
  type: TechnicalElementTypes.RISK_INTEGRATION,
  version: "1",
  created: CREATED,
  modified: NOW,
  owner: "tberg",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "tberg" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["tberg", "abello"],
    reviewers: [
      { id: "rev-1", name: "Dr. Hossein Ardakani", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer, also Event Sequence reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Marcus Reyes", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also ESQ reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Priya Raman", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Radiological Consequence reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-4", name: "Nadia Sorensen", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Source Term reviewer", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Risk integration for the Generic-1 sodium-cooled fast reactor, pairing the family frequencies with the family consequences, totaling the integrated risk, judging the significance and dispatching the result back upstream.",
    limitations: ["The single-unit single-source scope keeps the multi-reactor and multi-source terms recorded but not driving."],
    lastModifiedDate: NOW,
    lastModifiedBy: "tberg",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "ric-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-06-07T09:14:00.000Z", associatedSr: "RI-B3", text: "The seismic group runs a conservative model and internal events run a realistic one, so RI-B3 needs the per-hazard-group review shown before the sum is trusted.", severity: "MAJOR", resolved: false },
      { uuid: "ric-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-07T10:30:00.000Z", associatedSr: "RI-B5", text: "The primary sodium boundary leak is grouped across sources, so RI-B5 needs the within-family variation justified so no contributor is masked.", severity: "MAJOR", resolved: false },
      { uuid: "ric-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-06-08T14:05:00.000Z", associatedSr: "RI-A3", text: "The application uses an absolute target, so RI-A3 needs the alternate-criteria justification recorded against Table 1.9-2.", severity: "MINOR", resolved: false },
      { uuid: "ric-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-4", createdAt: "2026-06-08T15:20:00.000Z", associatedSr: "RI-C1", text: "The register pulls from every element on both the frequency and the consequence side.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the screened-out items are listed by element code.", resolvedAt: "2026-06-08T16:30:00.000Z", resolvedBy: "rev-4" },
      { uuid: "ric-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-08T16:00:00.000Z", associatedSr: "RI-C4", text: "The propagation samples the correlation and the phenomena dependencies together, so RI-C4 needs the dependency treatment shown so the final distribution is auditable.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope risk integration for the Generic-1 SFR, fixed-risk-target application, capability category CC-II.",
  scopeDefinition: {
    consequenceMeasures: ["Site-boundary individual dose", "Latent cancer risk", "Quantity released"],
    plantOperatingStateRefs: ["POS-AT-POWER", "POS-SHUTDOWN"],
    hazardGroups: ["Internal events", "Seismic"],
    radioactiveMaterialSources: ["Reactor core"],
    eventSequenceFamilyRefs: ["ESF-1", "ESF-2", "ESF-3", "ESF-4", "ESF-5"],
    releaseCategoryRefs: ["RC-1", "RC-2", "RC-3"],
    sourceTermDefinitionRefs: ["ST-1", "ST-2", "ST-3"],
  },
  riskSignificanceCriteria,
  reportingThresholds: {
    minimumReportingFrequencyPerPlantYear: 1e-7,
    frequencyBasis: "STANDARD_DEFAULT",
    minimumReportingConsequenceDescription: "10% of background-radiation dose",
    consequenceBasis: "STANDARD_DEFAULT",
    implementsSrs: srs("RI-A4", "RI-A5"),
  },
  compiledRiskInputs,
  integratedRiskResults,
  groupingAdequacyReview: {
    variationNotSignificantJustification: "The two early-release families carry distinct sequences with like end states, and the within-family variations are justified as not risk-significant in both frequency and release magnitude.",
    releaseCategorySelectionSufficiency: "The cross-source grouping of the boundary-leak family could hide a contributor, so the family is reopened for justification.",
    familyAssignmentSufficiency: "No non-significant contributor is grouped with a risk-significant one.",
    groupingUncertaintyReview: {
      performed: true,
      artificialSignificanceFound: false,
      findings: "The grouping uncertainty does not artificially make a family risk-significant, and the distortion is checked in both directions.",
    },
    implementsSrs: srs("RI-B5", "RI-C2"),
  },
  significantContributors,
  integrationMethods,
  modelUncertaintySources,
  screenedItemsLedger,
  uncertaintyAnalyses,
  sensitivityStudies,
  riskIntegrationFeedbackDispatch: {
    dispatchDate: NOW,
    eventSequenceQuantificationFeedback: {
      familyFeedback: [
        { familyRef: "ESF-1", riskSignificance: ImportanceLevel.HIGH, recommendations: ["Refine the diesel common-cause and recovery terms."] },
        { familyRef: "ESF-4", riskSignificance: ImportanceLevel.HIGH, recommendations: ["Refine the diesel common-cause and recovery terms."] },
      ],
      generalFeedback: "The early-release families are risk-significant, so refine the diesel common-cause and recovery terms.",
    },
    mechanisticSourceTermFeedback: {
      releaseCategoryFeedback: [
        { releaseCategoryRef: "RC-3", riskSignificance: ImportanceLevel.HIGH, recommendations: ["Prioritize the retention phenomena."] },
      ],
      sourceTermFeedback: [
        { sourceTermDefinitionRef: "ST-3", riskSignificance: ImportanceLevel.HIGH, keyUncertainties: ["Pool scrubbing decontamination factor"] },
      ],
      generalFeedback: "The early release category drives the dose, so prioritize the retention phenomena.",
    },
    radiologicalConsequenceFeedback: {
      metricFeedback: [
        { metric: "Latent cancer risk", riskSignificance: ImportanceLevel.MEDIUM, recommendations: ["Hold the dispersion and deposition uncertainty."] },
      ],
      generalFeedback: "The latent cancer risk metric governs, so hold the dispersion and deposition uncertainty.",
    },
  },
  modelUncertainty: {
    uuid: "ri-mu-1",
    name: "RI model uncertainty documentation",
    uncertaintySources: [
      { source: "Truncation and the state-of-knowledge correlation", impact: "Bounds the residual error and couples shared parameters." },
      { source: "Source-term release-fraction phenomena", impact: "Moves the release magnitude that feeds the dose." },
      { source: "Dispersion and deposition phenomena", impact: "Moves the dose and the health-effect result." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  documentation,
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-101", "NM-104"],
};

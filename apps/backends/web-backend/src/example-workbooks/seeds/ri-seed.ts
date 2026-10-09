import {
  type RiskIntegration,
  type RiInputs,
  type RiInputFamily,
  type RiInputConsequence,
  type RiFrequencyStats,
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
import { DistributionType, EndState } from "interfaces-mef-types/core/events";
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
  "RI-B1": "Four release-bearing families are compiled with their ESQ frequencies and their RC consequences.",
  "RI-B2": "The risk is quantified with means, plotted against the target, and drawn as an exceedance curve at CC-II.",
  "RI-B3": "The seismic and the sodium-fire external groups run conservative models and internal events a realistic one, with the per-hazard-group review being documented across all three groups.",
  "RI-B4": "The multi-reactor and multi-source terms are recorded as not driving for the single-unit single-source scope.",
  "RI-B5": "The boundary-leak grouping is reopened to ES so the within-family variation is justified.",
  "RI-B6": "Twelve risk-significant contributors are identified at an insight-grade level.",
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
    absoluteThresholds: {
      eventSequence: 2.0e-8,
      eventSequenceFamily: 2.0e-8,
      system: 2.0e-8,
      component: 2.0e-8,
      basicEvent: 2.0e-8,
      humanFailureEvent: 2.0e-8,
    },
    justification: "The fixed-risk-target application uses RI-A3 with Table 1.9-2. The absolute bar is one percent of the quantitative health objective for the individual latent cancer fatality risk, which the Safety Goal Policy Statement sets at 2E-6 per year, so an item is absolutely risk-significant once its contribution to the metric exceeds 2E-8 per plant-year. The same bar applies at every level because the criterion is a contribution to the one metric. The integrated total for this plant is 2.6E-11 per plant-year, three orders below the bar, so no item is absolutely significant and the relative criteria carry the contributor ranking.",
    references: ["Safety Goals for the Operation of Nuclear Power Plants, Policy Statement (51 FR 30028)", "Guidance for a Technology-Inclusive, Risk-Informed and Performance-Based Methodology (NEI 18-04, endorsed by Regulatory Guide 1.233)"],
    intendedApplications: ["Frequency-consequence target demonstration"],
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
    relativeThresholds: {
      eventSequence: 0.01,
      eventSequenceFamily: 0.01,
      system: 0.005,
      component: 0.005,
      basicEvent: 0.005,
      humanFailureEvent: 0.005,
    },
    justification: "A baseline-risk application uses RI-A2 with Table 1.9-1. A sequence or a family is significant once it carries more than one percent of the total risk metric. An item below the family, a system, a component, a basic event or a human failure event, is significant once its Fussell-Vesely importance reaches 0.005, or equivalently once its risk achievement worth reaches 2.",
    references: ["An Approach for Using Probabilistic Risk Assessment in Risk-Informed Decisions on Plant-Specific Changes to the Licensing Basis (Regulatory Guide 1.174)"],
    intendedApplications: ["Baseline-risk contributor ranking"],
    implementsSrs: srs("RI-A2"),
  },
];

const compiledRiskInputs: CompiledRiskInput[] = [
  {
    uuid: "ESF-EARLY",
    eventSequenceFamilyRef: "ESF-EARLY",
    releaseCategoryRef: "RC-1",
    sourceTermDefinitionRef: "ST-3",
    frequency: 5.2e-8,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 3.2e-8, errorFactor: 5 },
    esqFamilyQuantificationRef: "EFQ-6",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-4, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 8.0e-2, unit: "Sv" },
      { metric: "Individual early fatality risk", meanValue: 2.0e-7, unit: "per event" },
    ],
    rcqRecordRef: "RCQ-ESF-EARLY",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-ATWS",
    eventSequenceFamilyRef: "ESF-ATWS",
    releaseCategoryRef: "RC-1",
    sourceTermDefinitionRef: "ST-3",
    frequency: 4.5e-8,
    frequencyUnit: "per plant-year",
    esqFamilyQuantificationRef: "EFQ-5",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 1.8e-4, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 7.0e-2, unit: "Sv" },
      { metric: "Individual early fatality risk", meanValue: 1.5e-7, unit: "per event" },
    ],
    rcqRecordRef: "RCQ-ESF-ATWS",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-LATE",
    eventSequenceFamilyRef: "ESF-LATE",
    releaseCategoryRef: "RC-2",
    sourceTermDefinitionRef: "ST-2",
    frequency: 6.7e-7,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 5.4e-7, errorFactor: 3 },
    esqFamilyQuantificationRef: "EFQ-1 + EFQ-2 + EFQ-4",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 1.0e-5, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 4.0e-3, unit: "Sv" },
      { metric: "Individual early fatality risk", meanValue: 0.0, unit: "per event" },
    ],
    rcqRecordRef: "RCQ-ESF-LATE",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
  {
    uuid: "ESF-LEAK",
    eventSequenceFamilyRef: "ESF-LEAK",
    releaseCategoryRef: "RC-3",
    sourceTermDefinitionRef: "ST-1",
    frequency: 3.3e-5,
    frequencyUnit: "per plant-year",
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.3e-5, errorFactor: 4 },
    esqFamilyQuantificationRef: "EFQ-3",
    consequences: [
      { metric: "Latent cancer risk", meanValue: 2.0e-8, unit: "per event" },
      { metric: "Site-boundary individual dose", meanValue: 1.0e-6, unit: "Sv" },
      { metric: "Individual early fatality risk", meanValue: 0.0, unit: "per event" },
    ],
    rcqRecordRef: "RCQ-ESF-LEAK",
    consistentWithEventSequenceAnalysis: true,
    consistentWithMechanisticSourceTerm: true,
    implementsSrs: srs("RI-B1"),
  },
];

const integratedRiskResults: IntegratedRiskResults = {
  uuid: "RI-RESULTS-1",
  name: "Generic-1 integrated risk results",
  description: "The frequency-weighted totals across the four release-bearing families, judged against the targets for the application.",
  calculationLevel: "MEAN",
  metrics: [
    {
      uuid: "METRIC-LATENT",
      name: "Integrated latent cancer risk",
      metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
      consequenceMeasureRef: "Latent cancer risk",
      description: "The frequency-weighted sum across the four release-bearing families, driven by the early-release pair.",
      value: 2.6e-11,
      units: "per plant-year",
      uncertainty: { type: DistributionType.LOGNORMAL, median: 2.6e-11, errorFactor: 4 },
      uncertaintyDescription: "Propagated with the correlation and the phenomena dependencies, the 90 percent band spanning about a factor of sixteen.",
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
      consequenceMeasureRef: "Site-boundary individual dose",
      description: "The dose-weighted frequency total against the cumulative target.",
      value: 1.0e-8,
      units: "Sv per plant-year",
      uncertainty: { type: DistributionType.LOGNORMAL, median: 1.0e-8, errorFactor: 4 },
      uncertaintyDescription: "Propagated with the same correlation and phenomena treatment as the latent metric.",
      acceptanceCriteria: {
        limit: 1.0e-7,
        basis: "The cumulative target for the mean site-boundary dose risk.",
        complianceStatus: "COMPLIANT",
      },
      implementsSrs: srs("RI-B2"),
    },
    {
      uuid: "METRIC-EARLY",
      name: "Integrated early fatality risk",
      metricType: "INDIVIDUAL_EARLY_FATALITY_RISK",
      consequenceMeasureRef: "Individual early fatality risk",
      description: "The frequency-weighted early fatality sum, carried by the early-release pair alone.",
      value: 1.7e-14,
      units: "per plant-year",
      acceptanceCriteria: {
        limit: 5.0e-7,
        basis: "The prompt-fatality quantitative health objective.",
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
  hazardGroupContributions: [
    { hazardGroup: "Internal events", contribution: 0.072 },
    { hazardGroup: "Seismic", contribution: 0.766 },
    { hazardGroup: "Sodium fires and other external hazards", contribution: 0.162 },
  ],
  aggregationApproach: {
    description: "Each source and hazard contribution is identified, and the differences in conservatism are flagged before the sum is read. The hazard-group split is apportioned on the fuel-damage frequencies carried over from the initiating-event analysis: 1.6E-6 per year for internal events, 1.7E-5 per year for seismic and 3.6E-6 per year for the sodium fires and other external hazards, a total of 2.2E-5 per year, so seismic carries roughly three quarters of the integrated risk.",
    perSourceHazardContributionsIdentified: true,
    detailConservatismDifferences: [
      { scope: "Internal events", description: "The internal-events members of the early-release pair run a realistic CC-II model." },
      { scope: "Seismic", description: "The seismic-initiated members of the early-release pair run a conservative CC-I model, and seismic is the dominant group, so the conservatism sits on the largest term." },
      { scope: "Sodium fires and other external hazards", description: "The sodium fires and the remaining external hazards are carried at a screening level, a conservative CC-I treatment, and they are the second-largest group after seismic." },
    ],
    separateReviewPerformed: true,
    separateReviewFindings: "The seismic and the sodium-fire external groups run conservative models while internal events run a realistic one, so the determinations are reviewed separately per hazard group before the sum is trusted. Seismic dominates the total, so its conservatism governs the integrated number.",
    justification: "A conservative model may not be added to a realistic one and presented as either.",
  },
  multiReactorContributionsIncluded: true,
  multiSourceContributionsIncluded: true,
  hazardGroupAssignments: [
    ...["IEG-01", "IEG-02", "IEG-03", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13"]
      .map((initiatingEventId) => ({ initiatingEventId, hazardGroup: "Internal events" })),
    { initiatingEventId: "HZ-SEIS", hazardGroup: "Seismic" },
    { initiatingEventId: "HZ-FIRE", hazardGroup: "Sodium fires and other external hazards" },
  ],
  complianceStatus: [
    { criterion: "Integrated latent cancer risk", limit: 2.0e-9, status: "COMPLIANT", basis: "Below target." },
    { criterion: "Mean site-boundary dose risk", limit: 1.0e-7, status: "COMPLIANT", basis: "Below target." },
    { criterion: "Integrated early fatality risk", limit: 5.0e-7, status: "COMPLIANT", basis: "Seven decades below the quantitative health objective." },
  ],
  keyAssumptions: ["The site is single-unit, so the multi-reactor term is recorded as not driving.", "Three radioactive material sources are in scope, the in-core metallic driver fuel, the activated primary sodium and the spent subassemblies in in-tank storage. The in-core fuel carries the releases that drive every release-bearing family, so the multi-source term is reported but it does not drive the total."],
  implementsSrs: srs("RI-B2", "RI-B3", "RI-B4"),
};

const significantContributors: SignificantRiskContributors = {
  uuid: "RI-SIG-1",
  metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
  description: "The contributors identified at an insight-grade level, the roll-up RI documents and feeds back upstream.",
  significantEventSequenceFamilies: [
    {
      uuid: "SC-ESF-EARLY",
      name: "Early-release family ESF-EARLY",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-EARLY",
      importanceLevel: ImportanceLevel.HIGH,
      context: "Drives the integrated latent risk through the confinement-failure early release.",
    },
    {
      uuid: "SC-ESF-ATWS",
      name: "Early-release family ESF-ATWS",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-ATWS",
      importanceLevel: ImportanceLevel.HIGH,
      context: "The unprotected transients, the second driver of the integrated risk even though the quantification carries them as a non-risk-significant point estimate pending the dedicated failure-to-trip tree.",
    },
    {
      uuid: "SC-ESF-LATE",
      name: "Late filtered family ESF-LATE",
      contributorType: "Family",
      sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
      sourceId: "ESF-LATE",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The delayed filtered release, medium significance with a grouping question open.",
    },
  ],
  significantBasicEvents: [
    {
      uuid: "SC-BE-1",
      name: "DRACS loop common-cause failure",
      contributorType: "Basic event",
      sourceElement: TechnicalElementTypes.SYSTEMS_ANALYSIS,
      sourceId: "CCF-DRACS-LOOP",
      importanceMetrics: { fussellVesely: 0.22, riskAchievementWorth: 8.4 },
      importanceLevel: ImportanceLevel.HIGH,
      context: "The dominant cutset behind the loss-of-decay-heat family, the common cause group the data analysis quantifies as DA-CCF-12.",
    },
    {
      uuid: "SC-BE-2",
      name: "Station battery common-cause failure",
      contributorType: "Basic event",
      sourceElement: TechnicalElementTypes.SYSTEMS_ANALYSIS,
      sourceId: "CCF-DC-BATT",
      importanceMetrics: { fussellVesely: 0.1, riskAchievementWorth: 3.6 },
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The intersystem battery group behind the loss-of-offsite-power contribution to the late family.",
    },
    {
      uuid: "SC-PAR-1",
      name: "Pool scrubbing decontamination factor",
      contributorType: "Parameter",
      sourceElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS,
      sourceId: "BAR-2",
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The factor-of-ten retention on the primary sodium pool, the consequence-side uncertainty that moves the total.",
    },
  ],
  significantHumanFailureEvents: [
    {
      uuid: "SC-HFE-1",
      name: "Operator fails to start backup decay heat removal",
      contributorType: "Human failure event",
      sourceElement: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS,
      sourceId: "HR-POST-005",
      importanceMetrics: { fussellVesely: 0.12, riskAchievementWorth: 4.2 },
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The risk-significant action behind the loss-of-decay-heat family, held at detailed treatment with a mean error probability of 8.0E-4.",
    },
  ],
  significantSystems: [
    {
      uuid: "SC-SYS-1",
      name: "Room cooling support",
      contributorType: "System",
      sourceElement: TechnicalElementTypes.SYSTEMS_ANALYSIS,
      sourceId: "SYS-HVAC",
      importanceMetrics: { fussellVesely: 0.15, riskAchievementWorth: 5.1 },
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The shared cooling dependency behind the loss-of-decay-heat and offsite-power families, the unexpected importance result the quantification reconciled.",
    },
  ],
  significantInitiatingEvents: [
    {
      uuid: "SC-IE-1",
      name: "Slow primary sodium level drop",
      contributorType: "Initiating event",
      sourceElement: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
      sourceId: "IE-15",
      riskContribution: 0.08,
      importanceLevel: ImportanceLevel.MEDIUM,
      context: "The boundary-leak driver, eight percent of the frequency-side contribution per the quantification ranking.",
    },
  ],
  significantPlantOperatingStates: [
    {
      uuid: "SC-POS-1",
      name: "Post-trip natural circulation",
      contributorType: "Plant operating state",
      sourceElement: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
      sourceId: "POS-07",
      importanceLevel: ImportanceLevel.HIGH,
      context: "The post-trip loss-of-forced-cooling state the operating-state analysis flags as risk-significant, the state where the decay-heat families live.",
    },
  ],
  significantHazardGroups: [
    {
      uuid: "SC-HZ-1",
      name: "Seismic hazard group",
      contributorType: "Hazard group",
      sourceElement: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS,
      sourceId: "HZ-SEIS",
      riskContribution: 0.766,
      importanceLevel: ImportanceLevel.HIGH,
      context: "Carries about three quarters of the integrated total on the fuel-damage apportionment, the controlling external hazard of the reference analysis.",
    },
  ],
  significantReleaseCategories: [
    {
      uuid: "SC-RC-1",
      name: "Early release category",
      contributorType: "Release category",
      sourceElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS,
      sourceId: "RC-1",
      importanceLevel: ImportanceLevel.HIGH,
      context: "Bounds the early-release pair and drives the individual and the population dose.",
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

const ALL_TOTALS = ["INDIVIDUAL_DOSE", "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", "INDIVIDUAL_EARLY_FATALITY_RISK"];

const modelUncertaintySources: ModelUncertaintySource[] = [
  { uuid: "MU-1", name: "Operating-state time fractions", description: "Shifts the weighting between the states.", originatingElement: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "POS-01 carries 60 percent of the latent cancer risk and 75 percent of the 100 mrem frequency, and POS-05 another 28 percent of the latent cancer risk. A shift in the time fractions moves weight between these states.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-2", name: "Initiating-event group frequencies", description: "Scales the family frequencies directly.", originatingElement: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Scales the families by their group frequencies. IEG-12 carries 30 percent of the latent cancer risk, IEG-03 17 percent and IEG-06 12 percent, with internal fire at 11 percent.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-3", name: "Sequence timing and end-state binning", description: "Affects which family a borderline sequence joins.", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "A borderline sequence that moves into RC-1 takes the largest consequence value. RC-1 already carries 73 percent of the latent total and all of the early fatality total, so a shift into it moves both most.", characterizationMethod: "Grouping sensitivity", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-4", name: "Success-criteria margins", description: "Affects the branch outcomes near the threshold.", originatingElement: TechnicalElementTypes.SUCCESS_CRITERIA_DEVELOPMENT, affectedMetrics: ALL_TOTALS, impactAssessment: "A tighter margin turns success branches near the threshold into failures. That raises the frequency of the release families and every total with it.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-5", name: "System-logic completeness", description: "Affects the cutset structure.", originatingElement: TechnicalElementTypes.SYSTEMS_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "A missing failure path adds cutsets to the families it feeds. Gaps in the confinement-isolation and reactor-trip logic matter most, since those families carry 73 percent of the latent total.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-6", name: "Human-error probabilities", description: "Drives the human-action cutsets.", originatingElement: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Moves the families whose cutsets carry operator actions. The early-release pair carries 73 percent of the latent total and all of the early fatality total, so the actions in its cutsets matter most.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-7", name: "Parameter distributions", description: "Sets the spread of the family-frequency distribution.", originatingElement: TechnicalElementTypes.DATA_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Sets the family bands the propagation samples. ESF-EARLY spans a factor of 25 from its 5th to its 95th percentile. ESF-ATWS has no distribution, so its 34 percent share of the latent total enters as a point value.", characterizationMethod: "Propagated totals and the correlation sweep", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-8", name: "Truncation and approximation", description: "Bounds the residual computational error.", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION, affectedMetrics: ALL_TOTALS, impactAssessment: "The truncated residual is under half a percent of the tracked family. That is far inside the band of every total.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-9", name: "Pool scrubbing decontamination factor model", description: "Drives the spread of the aerosol release fraction.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Scales the aerosol release of every category that passes through the pool. The pool decontamination-factor sweep finds that halving it roughly doubles the early-release fraction and the latent total.", characterizationMethod: "Pool decontamination-factor sweep", relatedAssumptions: ["The pool depth and the bubble path follow the design geometry."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-10", name: "Sodium-air reaction aerosol source model", description: "Combines with the cell temperature to raise the airborne load.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Raises the airborne load where sodium meets air, chiefly in RC-1. RC-1 carries 73 percent of the latent total and all of the early fatality total.", relatedAssumptions: ["The cell oxygen inventory bounds the reaction extent."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-11", name: "Iodine chemical-form split model", description: "Shifts the elemental and the aerosol iodine balance.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Moves iodine between the aerosol and the elemental form, which changes how much the pool and the filters retain. The totals move with the iodine share of the dose.", relatedAssumptions: ["The sodium chemistry holds most of the iodine as sodium iodide."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-12", name: "Revaporization and late-tail release model", description: "Adds a late-tail contribution to the long-term release phase.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ["INDIVIDUAL_DOSE", "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Adds late activity after the early plume has passed, so it moves the boundary dose and the latent total. The early fatality total does not see it.", relatedAssumptions: ["The deposited material can revaporize as the surfaces stay hot through the long-term phase."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-13", name: "Confinement leak-rate and degraded-retention model", description: "Sets the fraction that bypasses the confinement in the early-release category.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Sets the RC-1 bypass fraction. RC-1 carries 73 percent of the latent total and all of the early fatality total.", relatedAssumptions: ["The degraded confinement leak path follows the design penetration and seal behavior."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-14", name: "Cover-gas leak rate characterization", description: "Bounds the spread of the intact-boundary noble-gas release.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ["INDIVIDUAL_DOSE", "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Sets the RC-3 release of ESF-LEAK. That family carries 2 percent of the latent total and none of the early fatality total or the 100 mrem frequency.", relatedAssumptions: ["The intact cover-gas boundary leaks within the design leak-rate range."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-15", name: "Wet-deposition washout model", description: "Shifts the local groundshine and the downwind concentration together, so it is sampled with the weather.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Moves dose between the rained-on area and the downwind field. RC samples it with the weather, so the category values already carry it.", characterizationMethod: "Sampled with the weather in RC", relatedAssumptions: ["The washout coefficient follows the power-law form with the precipitation intensity."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-16", name: "Non-compliance fraction", description: "Combines with the warning time to move the early dose for the sheltered cohort.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", "INDIVIDUAL_EARLY_FATALITY_RISK"], impactAssessment: "Only the measures that credit protective actions see it, the latent and early fatality risks. The early fatality total rests on RC-1, so it moves with the non-compliant share there.", relatedAssumptions: ["The 0.5 percent non-compliance fraction comes from the reference evacuation behavior."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-17", name: "Low-dose dose-response model", description: "Shifts the latent cancer risk per unit dose across the population.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Converts dose to latent risk, so it scales the latent total alone. The dose and early fatality totals do not change.", relatedAssumptions: ["The risk factors come from internationally recognized bodies under the linear-no-threshold model."], implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-18", name: "Cloud-immersion geometry", description: "Shifts the cloudshine dose for the elevated early-release plume.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ALL_TOTALS, impactAssessment: "Moves the cloudshine of the elevated RC-1 plume, so the boundary dose and the early fatality total move most.", relatedAssumptions: ["The finite-plume correction is applied for the elevated buoyant plume."], implementsSrs: srs("RI-C1", "RI-C3") },
];

const screenedItemsLedger: ScreenedItemLedgerEntry[] = [
  { uuid: "SL-1", itemType: "PLANT_OPERATING_STATE", itemRef: "POS-09", screeningElementCode: "POS", screeningBasis: "Maintenance with the intermediate loop isolated is bounded by the shutdown-cooler out-of-service state (POS-08). POS-08 loses a passive decay-heat path while POS-09 keeps both shutdown coolers, so POS-08 is the more limiting configuration. Subsumed.", impactOnRiskMetrics: "None on the totals. No sequence is quantified in POS-09, so the subsumed state adds no frequency.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-2", itemType: "HAZARD_GROUP", itemRef: "Seventeen hazard groups, HAZ-1 to HAZ-17", screeningElementCode: "IE", screeningBasis: "Routed to the dedicated hazard analyses rather than the internal-events model, with seismic retained as the controlling external hazard and internal fire as the dominant non-seismic contributor.", impactOnRiskMetrics: "Seismic and internal fire enter the totals through their own sequences. The other groups stay with the dedicated hazard analyses and add to the totals when those report.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-3", itemType: "INITIATING_EVENT", itemRef: "IE-22", screeningElementCode: "IE", screeningBasis: "Each screened initiator is bounded, and their sum does not change the risk-significant contributors.", impactOnRiskMetrics: "The combined contribution of the screened-out initiating events stays well below the significance threshold.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-4", itemType: "INITIATING_EVENT", itemRef: "IE-23", screeningElementCode: "IE", screeningBasis: "Each screened initiator is bounded, and their sum does not change the risk-significant contributors.", impactOnRiskMetrics: "The combined contribution of the screened-out initiating events stays well below the significance threshold.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-5", itemType: "EVENT_SEQUENCE", itemRef: "ESX-1", screeningElementCode: "ES", screeningBasis: "Dropped before sequence development: spurious confinement isolation during POS-09 is slow, alarmed, and fixed by procedure before any barrier is challenged; calculation shows no real risk impact (SCR-3).", impactOnRiskMetrics: "None. The isolation is fixed by procedure before any barrier is challenged, so it adds no release frequency.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-6", itemType: "EVENT_SEQUENCE", itemRef: "ESX-2", screeningElementCode: "ES", screeningBasis: "Dropped before sequence development: load-follow power oscillation is covered by the protected-transient family ESF-OK, with a similar plant response and higher frequency (SCR-3).", impactOnRiskMetrics: "None. ESF-OK covers it and ends with no release.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-7", itemType: "BASIC_EVENT", itemRef: "Four components, CS-1 to CS-4", screeningElementCode: "SY", screeningBasis: "Screened from the detailed system models on probability or consequence grounds, led by the DRACS instrument root valve at 4E-7 over the mission time.", impactOnRiskMetrics: "Negligible. The largest is 4E-7 over the mission, far below the cutsets that set the family frequencies.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-8", itemType: "BASIC_EVENT", itemRef: "PS-5, confinement damper stroke-test misalignment", screeningElementCode: "HR", screeningBasis: "Screened under SCR-3, since the post-test indication catches the misalignment before any state transition.", impactOnRiskMetrics: "None. The misalignment is caught before any state transition, so it adds no cutset.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-9", itemType: "BASIC_EVENT", itemRef: "OL-1 and OL-2 outlier records", screeningElementCode: "DA", screeningBasis: "Excluded from the component groups, and an event excluded from the independent database is excluded from the common-cause database too.", impactOnRiskMetrics: "None on the totals. The records are not plant-representative, so the family frequencies keep the parameters of the retained groups.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-10", itemType: "BASIC_EVENT", itemRef: "Cutsets below 1E-13 per year", screeningElementCode: "ESQ", screeningBasis: "Below the truncation cutoff, with the tracked family frequency converged within half a percent between successive cutoffs.", impactOnRiskMetrics: "Under half a percent of the tracked family, far inside the band of every total.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-11", itemType: "HAZARD_EVENT", itemRef: "Inventory relocation and explosion effects, RC-2", screeningElementCode: "MS", screeningBasis: "The heat-up is arrested before fuel relocation and no explosive challenge arises while the pool stays closed, so both phenomena are excluded from the filtered category.", impactOnRiskMetrics: "None. The heat-up is arrested in RC-2 before relocation, so neither phenomenon adds to its release.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-12", itemType: "HAZARD_EVENT", itemRef: "Doses beyond the 80 km grid and the 72-hour window", screeningElementCode: "RC", screeningBasis: "The consequence grid is bound to 80 km and a 72-hour release, with the long-range residual assessed as not risk-significant.", impactOnRiskMetrics: "None on the individual totals, which sit within 10 miles. The long-range collective dose is not reported.", implementsSrs: srs("RI-C1") },
];

const uncertaintyAnalyses: RiskUncertaintyAnalysis[] = [
  {
    uuid: "RIU-1",
    name: "Integrated latent risk uncertainty",
    description: "The family frequency and release category distributions propagate into a full distribution on the latent total.",
    metric: "Individual latent cancer fatality risk",
    characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT",
    propagationMethod: "Monte Carlo sampling of the risk-significant distributions",
    parameterUncertainty: { type: DistributionType.LOGNORMAL, median: 2.6e-11, errorFactor: 2.7 },
    sokcAndPhenomenaTreatment: {
      eventFrequencySokcConsidered: true,
      phenomenaDependenciesConsidered: true,
      treatmentDescription: "ESQ's family distributions carry the state-of-knowledge correlation within each family (ESQ-E2). The RI propagation samples the families independently, so the correlation between families is not carried. Families that share a release category share its sampled consequence, which keeps the phenomena dependencies of MS-D4 and RCQ-C2.",
      riskSignificanceBasis: "The correlated parameters and the dependent phenomena are risk-significant for the early-release pair.",
    },
    evaluationScope: "COMBINATION",
    evaluationType: "QUANTITATIVE",
    keyUncertaintySourceRefs: ["MU-7", "MU-9", "MU-15"],
    prioritization: [
      { uncertaintySourceId: "MU-7", priorityLevel: ImportanceLevel.HIGH, basis: "The shared parameters and their correlation set the frequency-side spread." },
      { uncertaintySourceId: "MU-9", priorityLevel: ImportanceLevel.HIGH, basis: "The pool-scrubbing model sets the release-fraction spread." },
      { uncertaintySourceId: "MU-15", priorityLevel: ImportanceLevel.MEDIUM, basis: "The washout moves the consequence tail." },
    ],
    uncertaintyRangeDiscussion: "The 90 percent band on the latent total spans a factor of about 7.5, from 1.0E-11 to 7.8E-11 per plant-year. ESF-EARLY, with an error factor of five, is the widest frequency input, and ESF-ATWS enters as a point value.",
    implementsSrs: srs("RI-C3", "RI-C4"),
  },
  {
    uuid: "RIU-2",
    name: "Site-boundary dose risk uncertainty",
    description: "The site-boundary dose total propagated with the same treatment as the latent total.",
    metric: "Site-boundary individual dose",
    characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT",
    propagationMethod: "Monte Carlo sampling of the risk-significant distributions",
    parameterUncertainty: { type: DistributionType.LOGNORMAL, median: 1.0e-8, errorFactor: 2.5 },
    sokcAndPhenomenaTreatment: {
      eventFrequencySokcConsidered: true,
      phenomenaDependenciesConsidered: true,
      treatmentDescription: "The same sampling as the latent total, read against the site-boundary dose measure.",
      riskSignificanceBasis: "The dose total is carried by the early-release pair and the late filtered family, all propagated.",
    },
    evaluationScope: "COMBINATION",
    evaluationType: "QUANTITATIVE",
    keyUncertaintySourceRefs: ["MU-7", "MU-9", "MU-15"],
    uncertaintyRangeDiscussion: "The 90 percent band on the site-boundary dose total spans about a factor of six, from 4.4E-9 to 2.7E-8 Sv per plant-year. It is narrower than the latent band because the RC-1 dose spread is narrower than the RC-1 latent spread.",
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
    implementsSrs: srs("RI-B3"),
  },
  {
    uuid: "RIS-2",
    modelUncertaintyId: "MU-3",
    name: "Grouping sensitivity",
    description: "Split of the early-release pair.",
    variedParameters: ["Family grouping"],
    parameterRanges: { "Family grouping": [1, 2] },
    results: "Splitting the early-release pair leaves both members risk-significant.",
    implementsSrs: srs("RI-B5", "RI-C2"),
  },
  {
    uuid: "RIS-3",
    modelUncertaintyId: "MU-7",
    name: "Correlation sweep",
    description: "Sweep of the state-of-knowledge correlation.",
    variedParameters: ["State-of-knowledge correlation"],
    parameterRanges: { "State-of-knowledge correlation": [0, 1] },
    results: "Ignoring the state-of-knowledge correlation understates the mean by about a quarter.",
    implementsSrs: srs("RI-C4"),
  },
  {
    uuid: "RIS-4",
    modelUncertaintyId: "MU-9",
    name: "Pool decontamination-factor sweep",
    description: "Sweep of the primary-pool retention credited in the early-release source term.",
    variedParameters: ["Pool scrubbing decontamination factor"],
    parameterRanges: { "Pool scrubbing decontamination factor": [5, 20] },
    results: "Halving the pool decontamination factor roughly doubles the early-release fraction and the integrated latent risk, leaving both metrics below their targets.",
    implementsSrs: srs("RI-C3", "RI-D2"),
  },
];

const documentation: RiDocumentation = {
  processDescription: "The family frequencies and the family consequences are compiled, the integrated risk is totaled and plotted, the contributors are judged, the uncertainty is propagated, and the result is dispatched back upstream, per ASME/ANS RA-S-1.4 HLR-RI-A through D.",
  inputsDescription: "RI takes the event sequence family frequencies from ESQ and the family-by-family consequence table from RC, with the criteria set by the intended application.",
  appliedMethods: "A sum of frequency and consequence products, a frequency-consequence diagram, an exceedance-frequency curve and a Monte Carlo propagation, each one accepted way to do its sub-task.",
  resultsSummary: "The integrated latent cancer risk is 2.6E-11 per plant-year, below the 2.0E-9 target, driven by the early-release pair.",
  riskSignificanceCriteriaUsed: "The absolute criteria of RI-A3 against the frequency-consequence target per Table 1.9-2, for a fixed-risk-target application.",
  resultsAndInsights: "Every family sits below the frequency-consequence target, and the passive decay-heat path explains the low integrated risk.",
  scopeLimitations: "The single-unit single-source scope keeps the multi-reactor and multi-source terms recorded but not driving.",
  traceabilityToUpstreamContributions: "The results trace to the ESQ family quantifications and the RCQ consequence records family by family.",
  acceptanceCriteriaComparison: "All three cumulative metrics are compliant, the latent risk at about one percent of its target, the dose risk at ten percent and the early-fatality risk seven decades below its target.",
  keyUncertaintySources: "The truncation and correlation from the quantification, the pool-scrubbing model from the source term and the washout and dose-response models from the consequence analysis lead the register.",
  designFeatureInsights: "The passive decay-heat path explains the low integrated risk.",
  integratedContributorRollup: "Twelve contributors are risk-significant at an insight-grade level, led by the two early-release families and the seismic hazard group.",
  modelUncertaintySourcesDocumentation: "The register compiles the eighteen sources that ESQ, MS and RC assess, with their assumptions, and the ledger lists every screened-out item.",
  praTaskInterfaces: "RI compiles from ESQ and RC, and it dispatches the risk significance back to ESQ, MS, RC and the elements behind them, closing the loop the standard built.",
  implementsSrs: srs("RI-D1", "RI-D2"),
};

export const RI_ANALYSIS: RiskIntegration = {
  uuid: "ri-generic-1",
  name: "RI Workbook 2",
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
      { uuid: "ric-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-07T10:30:00.000Z", associatedSr: "RI-B5", text: "The intact-leakage family is grouped across sources, so RI-B5 needs the within-family variation justified so no contributor is masked.", severity: "MAJOR", resolved: false },
      { uuid: "ric-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-06-08T14:05:00.000Z", associatedSr: "RI-A3", text: "The application uses an absolute target, so RI-A3 needs the alternate-criteria justification recorded against Table 1.9-2.", severity: "MINOR", resolved: false },
      { uuid: "ric-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-4", createdAt: "2026-06-08T15:20:00.000Z", associatedSr: "RI-C1", text: "The register pulls from every element on both the frequency and the consequence side.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the screened-out items are listed by element code.", resolvedAt: "2026-06-08T16:30:00.000Z", resolvedBy: "rev-4" },
      { uuid: "ric-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-08T16:00:00.000Z", associatedSr: "RI-C4", text: "The propagation samples the correlation and the phenomena dependencies together, so RI-C4 needs the dependency treatment shown so the final distribution is auditable.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope risk integration for the Generic-1 SFR, fixed-risk-target application, capability category CC-II. The integration covers all nine plant operating states from POS, one subsumed, the three hazard groups carried by the initiating-event analysis (internal events, seismic, and the sodium fires and other external hazards), and all three radioactive material sources. It totals the four release-bearing event-sequence families against the frequency-consequence target. The no-release family ESF-OK is outside the integration because it produces no source term.",
  applicationContext: { applicationType: "FIXED_RISK_TARGET", linkedWorkbooks: { POS: "example-pos-sfr", ES: "example-es-sfr", ESQ: "example-esq-sfr", MS: "example-ms-sfr", RC: "example-rc-sfr" } },
  scopeDefinition: {
    consequenceMeasures: [
      { name: "Site-boundary individual dose", description: "The individual dose at the site boundary, the measure the frequency-consequence target is drawn against.", role: "EAB_DOSE", quantity: "INDIVIDUAL_DOSE", receptor: { kind: "EAB_MAXIMUM" }, window: { seconds: 2592000, start: "RELEASE_ONSET" }, protectiveActionsCredited: false },
      { name: "Latent cancer risk", description: "The latent health risk per event, the consequence the integrated total sums against the quantitative health objective.", role: "LATENT_CANCER_RISK", quantity: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: 16.09344 }, window: { seconds: 2592000, start: "PLUME_ARRIVAL" }, protectiveActionsCredited: true },
      { name: "Individual early fatality risk", description: "The early fatality risk per event within a mile of the boundary, summed against the prompt-fatality quantitative health objective.", role: "EARLY_FATALITY_RISK", quantity: "INDIVIDUAL_EARLY_FATALITY_RISK", receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: 1.609344 }, window: { seconds: 2592000, start: "PLUME_ARRIVAL" }, protectiveActionsCredited: true },
    ],
    plantOperatingStateRefs: [
      "POS-01",
      "POS-02",
      "POS-03",
      "POS-04",
      "POS-05",
      "POS-06",
      "POS-07",
      "POS-08",
      "POS-09",
    ],
    hazardGroups: ["Internal events", "Seismic", "Sodium fires and other external hazards"],
    radioactiveMaterialSources: [
      "In-core metallic driver fuel",
      "Activated primary sodium",
      "Spent subassemblies in in-tank storage",
    ],
    eventSequenceFamilyRefs: ["ESF-EARLY", "ESF-ATWS", "ESF-LATE", "ESF-LEAK"],
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
    releaseCategorySelectionSufficiency: "The cross-source grouping of the intact-leakage family could hide a contributor, so the family is reopened for justification.",
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
        { familyRef: "ESF-LATE", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries most of the 100 mrem frequency and a quarter of the latent cancer risk.", insights: ["Carries 87.3% of the 100 mrem frequency and 25.2% of the latent cancer risk."], recommendations: ["Keep the three-quantification aggregation visible so the family total stays auditable.", "Refine the decay-heat removal recovery terms behind the late release."] },
        { familyRef: "ESF-EARLY", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The largest share of the latent cancer risk and more than half of the early fatality risk.", insights: ["Carries 53.6% of the early fatality risk and 39.1% of the latent cancer risk."], recommendations: ["Refine the confinement isolation and recovery terms."] },
        { familyRef: "ESF-ATWS", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 46.4% of the early fatality risk as a point value with no distribution.", insights: ["Carries 46.4% of the early fatality risk and 33.8% of the latent cancer risk."], recommendations: ["Carry the dedicated failure-to-trip tree to final quantification and give the family a frequency distribution."] },
        { familyRef: "ESF-LEAK", riskSignificance: ImportanceLevel.LOW, insights: ["Carries 1.98% of the latent cancer risk."], recommendations: ["Keep the cover-gas leak grouping under review as the leak-rate data matures."] },
      ],
      contributorFeedback: [
        { entityRef: "Erroneous control-rod withdrawal (IE-07)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The largest single contributor to the early fatality risk, with 24.1%.", insights: ["Carries 24.1% of the early fatality risk and 17.6% of the latent cancer risk."], recommendations: ["Confirm the rod-withdrawal frequency and its binning into the unprotected transients."] },
        { entityRef: "DRACS loop common-cause failure (CCF-DRACS-LOOP)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The largest contributor to the 100 mrem frequency, with 18.4%.", insights: ["Carries 18.4% of the 100 mrem frequency and 12.3% of the latent cancer risk."], recommendations: ["Hold the DRACS loop group against its data-analysis parameters."] },
        { entityRef: "Confinement isolation damper common-cause failure (CCF-CIS-DMP)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 18.2% of the early fatality risk through the early-release family.", insights: ["Carries 18.2% of the early fatality risk and 13.3% of the latent cancer risk."], recommendations: ["Refine the confinement isolation damper group behind the early-release family."] },
        { entityRef: "Shutdown system fails to trip (CCF-RPS-DIV)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 15.3% of the early fatality risk through the failure-to-trip family.", insights: ["Carries 15.3% of the early fatality risk and 11.2% of the latent cancer risk."], recommendations: ["Close the shutdown-system group with the dedicated failure-to-trip tree."] },
        { entityRef: "Operator fails to start standby clean-up train (HR-POST-022)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 11.8% of the early fatality risk.", insights: ["Carries 11.8% of the early fatality risk and 8.59% of the latent cancer risk."], recommendations: ["Treat the standby clean-up action in detail."] },
        { entityRef: "Loss of room cooling support (SYS-HVAC)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 11.3% of the 100 mrem frequency through the late release.", insights: ["Carries 11.3% of the 100 mrem frequency and 3.24% of the latent cancer risk."], recommendations: ["Keep the room-cooling dependency visible in the importance review."] },
        { entityRef: "Station battery common-cause failure (CCF-DC-BATT)", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Carries 11.3% of the 100 mrem frequency through the late release.", insights: ["Carries 11.3% of the 100 mrem frequency and 3.24% of the latent cancer risk."], recommendations: ["Hold the battery group against its data-analysis parameters."] },
        { entityRef: "Operator fails to start backup decay heat removal (HR-POST-005)", riskSignificance: ImportanceLevel.LOW, insights: ["Carries 7.5% of the 100 mrem frequency and 2.16% of the latent cancer risk."], recommendations: ["Keep the backup decay heat removal action at detailed treatment."] },
      ],
      generalFeedback: "No family or contributor is risk-significant under NEI 18-04, and every total sits far below its target. The late release carries most of the 100 mrem frequency and the early-release pair most of the latent and early fatality risk, so refine the decay-heat removal and confinement isolation terms and finalize the failure-to-trip tree.",
    },
    mechanisticSourceTermFeedback: {
      releaseCategoryFeedback: [
        { releaseCategoryRef: "RC-1", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Holds the early-release pair, with all of the early fatality risk and 72.9% of the latent cancer risk.", insights: ["Holds ESF-EARLY and ESF-ATWS. Carries 100% of the early fatality risk and 72.9% of the latent cancer risk."], recommendations: ["Prioritize the pool-scrubbing and confinement-retention phenomena."] },
        { releaseCategoryRef: "RC-2", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Holds ESF-LATE, with 87.3% of the 100 mrem frequency.", insights: ["Holds ESF-LATE. Carries 87.3% of the 100 mrem frequency and 25.2% of the latent cancer risk."], recommendations: ["Confirm the late-tail revaporization release that sets the boundary dose."] },
      ],
      sourceTermFeedback: [
        { sourceTermDefinitionRef: "ST-3", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The source term of RC-1.", insights: ["Source term of RC-1."], keyUncertainties: ["Pool scrubbing decontamination factor model", "Sodium-air reaction aerosol source model", "Confinement leak-rate and degraded-retention model"] },
        { sourceTermDefinitionRef: "ST-2", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The source term of RC-2.", insights: ["Source term of RC-2."], keyUncertainties: ["Revaporization and late-tail release model", "Iodine chemical-form split model"] },
      ],
      generalFeedback: "No release category is risk-significant under NEI 18-04. RC-1 carries all of the early fatality risk and most of the latent cancer risk, and RC-2 most of the 100 mrem frequency, so prioritize the retention phenomena of both source terms.",
    },
    radiologicalConsequenceFeedback: {
      metricFeedback: [
        { metric: "Latent cancer risk", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The smallest margin of the three cumulative targets, a factor of 6.0E4.", insights: ["Individual latent cancer fatality risk is 3.33E-11 per plant-year against a limit of 2E-6. RC-1 carries 72.9% of it."], recommendations: ["Prioritize the source-term retention and the evacuation timing."] },
        { metric: "Site-boundary individual dose", riskSignificance: ImportanceLevel.LOW, insights: ["Frequency of exceeding 100 mrem is 7.63E-7 per plant-year against a limit of 1. Site-boundary individual dose is 1.22E-8 Sv per plant-year. RC-2 carries 87.3% of it."], recommendations: ["Confirm the RC-2 late-release dose, which sets most of the 100 mrem frequency."] },
        { metric: "Individual early fatality risk", riskSignificance: ImportanceLevel.LOW, insights: ["Individual early fatality risk is 1.57E-14 per plant-year against a limit of 5E-7. RC-1 carries 100% of it."], recommendations: ["Keep the RC-1 early dose and its evacuation credit under review."] },
      ],
      generalFeedback: "No measure is risk-significant under NEI 18-04. RC-1 sets the latent and early fatality risks and RC-2 the 100 mrem frequency, so the retention phenomena and the evacuation timing stay the consequence-side priorities.",
    },
    additionalElementFeedback: [
      { elementCode: "POS", riskSignificance: ImportanceLevel.LOW, insights: ["POS-01 carries 74.9% of the 100 mrem frequency."], recommendations: ["Keep POS-01 and POS-05 delineated, since they carry 88% of the latent cancer risk."], generalFeedback: "No operating state is risk-significant. POS-01 carries most of every total, and POS-05 more than a quarter of the latent cancer risk." },
      { elementCode: "IE", riskSignificance: ImportanceLevel.LOW, insights: ["IEG-03 carries 32.8% of the 100 mrem frequency."], recommendations: ["Confirm the IEG-12 and IEG-03 binning, which carries 47% of the latent cancer risk."], generalFeedback: "No initiating event group is risk-significant. IEG-12 and IEG-03 carry almost half of the latent cancer risk, and internal fire about a tenth." },
      { elementCode: "ES", riskSignificance: ImportanceLevel.LOW, insights: ["ESL-3 carries 23.8% of the 100 mrem frequency."], recommendations: ["Keep the late-release sequence assignments auditable."], generalFeedback: "No sequence is risk-significant. ESL-3 leads the 100 mrem frequency." },
      { elementCode: "SC", riskSignificance: ImportanceLevel.LOW, insights: ["DRACS carries 97.1% of the 100 mrem frequency."], recommendations: ["Keep the DRACS success criterion explicit, since its failure sits in most of every total."], generalFeedback: "No function is risk-significant. Failed DRACS appears in 82% of the latent cancer risk." },
      { elementCode: "SY", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "Its common-cause groups lead the totals, CCF-DRACS-LOOP with 18.4% of the 100 mrem frequency.", insights: ["DRACS loop common-cause failure (CCF-DRACS-LOOP) carries 18.4% of the 100 mrem frequency."], recommendations: ["Hold the DRACS loop, confinement damper and shutdown-system groups against their data-analysis parameters.", "Keep the room-cooling dependency visible in the importance review."], generalFeedback: "No contributor is risk-significant, but the DRACS loop, confinement damper and shutdown-system common-cause groups lead the totals, so confirm their logic." },
      { elementCode: "HR", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The standby clean-up action carries 11.8% of the early fatality risk.", insights: ["Operator fails to start backup decay heat removal (HR-POST-005) carries 7.5% of the 100 mrem frequency."], recommendations: ["Treat HR-POST-022 in detail.", "Keep HR-POST-005 at detailed treatment."], generalFeedback: "No human failure event is risk-significant, but the standby clean-up and backup decay-heat actions carry up to a tenth of a total, so keep them at detailed treatment." },
      { elementCode: "DA", riskSignificance: ImportanceLevel.MEDIUM, significanceReason: "The common cause factors behind the leading groups set most of each total.", insights: ["DRACS loop common-cause failure (CCF-DRACS-LOOP) carries 18.4% of the 100 mrem frequency."], recommendations: ["Confirm the DRACS loop and confinement damper beta factors as records accrue."], generalFeedback: "No parameter drives a risk-significant item, but the beta factors behind the leading groups set most of each total, so confirm them as records accrue." },
    ],
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
  preOperationalAssumptions: [
    {
      uuid: "RI-PA-1",
      assumptionId: "RI-PA-1",
      description: "The consequence side of every compiled family rests on the bounding site, with the population, the weather year and the road network held bounding until site selection.",
      influenceOnDefinition: "Consequence compilation",
      status: "OPEN",
      limitations: ["Pre-operational, pending site selection."],
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "Confirm against the selected site and the as-operated emergency plan.",
      plannedClosureActions: ["Recompile the consequence table at site selection."],
      affectedElementIds: ["compiledRiskInputs"],
      implementsSrs: srs("RI-B1"),
    },
    {
      uuid: "RI-PA-2",
      assumptionId: "RI-PA-2",
      description: "The failure-to-trip family enters the total as a provisional point estimate pending the dedicated tree, so the integrated metrics carry its value without a propagated spread.",
      influenceOnDefinition: "Integrated risk results",
      status: "IN_PROGRESS",
      limitations: ["No distribution on the failure-to-trip frequency."],
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "Close with the dedicated failure-to-trip tree at final quantification.",
      plannedClosureActions: ["Re-run the propagation once the tree lands."],
      affectedElementIds: ["integratedRiskResults"],
      implementsSrs: srs("RI-B2"),
    },
    {
      uuid: "RI-PA-3",
      assumptionId: "RI-PA-3",
      description: "The master uncertainty register carries the initiating-event entry as pending, its own register being empty at this stage.",
      influenceOnDefinition: "Model uncertainty register",
      status: "OPEN",
      limitations: ["One upstream register pending."],
      riskImpact: ImportanceLevel.LOW,
      closureBasis: "Close when the IE register is populated.",
      plannedClosureActions: ["Pull the upstream entries at their next revision."],
      affectedElementIds: ["modelUncertaintySources"],
      implementsSrs: srs("RI-C1"),
    },
  ],
  documentation,
  configurationControlRecordId: "cc-2026.05.20-001",
  exampleDocuments: [
    { id: "RI-DOC-01", name: "Level 1 Probabilistic Risk Assessment of the reference sodium-cooled fast reactor", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL/NSE-2", extracted: "The internal-events fuel-damage frequency of 1.6E-6 per year and the sequence families the integration totals", linked: 6, url: "/api/example-documents/ri/sfr-pra" },
    { id: "RI-DOC-02", name: "Hazard Summary Report for the reference sodium-cooled fast reactor", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-5719", extracted: "The site hazards and the radioactive material sources behind the hazard-group and source scope", linked: 4, url: "/api/example-documents/ri/sfr-hazard" },
    { id: "RI-DOC-03", name: "Inherent safety demonstration tests, loss of flow and loss of heat sink without scram", kind: "doc", sizeLabel: "ANL", uploadedLabel: "CONF-850410-6", extracted: "The passive reactivity feedback and natural-circulation decay-heat removal credited across the retained families", linked: 3, url: "/api/example-documents/ri/sfr-inherent" },
    { id: "RI-DOC-04", name: "Probabilistic Risk Assessment Standard for Advanced Non-Light Water Reactor Nuclear Power Plants", kind: "doc", sizeLabel: "ASME/ANS", uploadedLabel: "RA-S-1.4-2021", extracted: "The HLR-RI-A through HLR-RI-D requirements this integration implements, the significance criteria, the aggregation and the uncertainty", linked: 9 },
    { id: "RI-DOC-05", name: "Guidance for a Technology-Inclusive, Risk-Informed and Performance-Based Methodology", kind: "doc", sizeLabel: "NEI", uploadedLabel: "NEI 18-04, endorsed by Regulatory Guide 1.233", extracted: "The frequency-consequence target and the licensing-basis-event risk-significance criteria the absolute fork uses", linked: 5 },
    { id: "RI-DOC-06", name: "Safety Goals for the Operation of Nuclear Power Plants, Policy Statement", kind: "doc", sizeLabel: "NRC", uploadedLabel: "51 FR 30028", extracted: "The quantitative health objectives behind the cumulative latent-cancer and early-fatality risk targets", linked: 3 },
    { id: "RI-DOC-07", name: "An Approach for Using Probabilistic Risk Assessment in Risk-Informed Decisions on Plant-Specific Changes to the Licensing Basis", kind: "doc", sizeLabel: "NRC", uploadedLabel: "Regulatory Guide 1.174", extracted: "The acceptance guidelines behind the relative, baseline-risk application fork", linked: 4 },
    { id: "RI-DOC-08", name: "Guidance on the Treatment of Uncertainties Associated with PRAs in Risk-Informed Decision Making", kind: "doc", sizeLabel: "NRC", uploadedLabel: "NUREG-1855", extracted: "The model-uncertainty register, the grouping review and the propagation the uncertainty step follows", linked: 5 },
  ],
  newlyDevelopedMethodIds: ["NM-101", "NM-104"],
};

export const RI_PUBLISHED_ID = "published-ri-inputs";
export const RI_PUBLISHED_SLUG = "ri-published-inputs";
export const RI_PUBLISHED_LABEL = "Published RI inputs expert review";

const PUBLISHED_DATE = "2026-09-30T12:00:00.000Z";
const PUBLISHED_OWNER = "Published-source review example";
const PUBLISHED_DOSE = "30-day dose at the EAB";
const PUBLISHED_EARLY = "Early fatality risk within 1 mile of the EAB";
const PUBLISHED_LATENT = "Latent cancer fatality risk within 10 miles of the EAB";
const PUBLISHED_PSAR = "PSAR Rev. 1 (ML25276A288)";
const PUBLISHED_RCI = "the RCI response (ML25259A180)";
const PUBLISHED_HAZARD_REASON = "No LBE in PSAR Tables 3.5-1 to 3.5-3 comes from this hazard group. The NRC staff expects the FSAR integrated risk to cover all hazards (SE Section 4).";

type PublishedCategory = "AOO" | "DBE" | "BDBE";
type PublishedLbe = [string, PublishedCategory, string, number | null, number | null, number | null, number | null, number | null, number | null];

const PUBLISHED_LBES: PublishedLbe[] = [
  ["DHP-L1PP-BL", "AOO", "Loss of One Primary Sodium Pump with Non-Passive IAC", 4.82e-1, 6.78e-1, 8.98e-1, null, null, null],
  ["DHP-LOOP-BL", "AOO", "Loss of Offsite Power with Non-Passive IAC", 2.22e-3, 2.29e-2, 6.38e-2, null, null, null],
  ["DHS-ISTL-BL", "AOO", "Loss of Heat Sink with Non-Passive IAC", 2.76e-1, 4.76e-1, 8.49e-1, null, null, null],
  ["OTH-LMAC-BL", "AOO", "Loss of a Single Medium Voltage AC Bus with Non-Passive IAC", 6.23e-3, 1.14e-2, 1.83e-2, null, null, null],
  ["RFH-LSPC-BL", "AOO", "Loss of SFP Cooling with Cooling Restored", 9.47e-3, 3.83e-2, 5.97e-2, null, null, null],
  ["RFH-LTCA-BL", "AOO", "Loss of EVST Active Cooling While Storing Fuel Assemblies with Passive Cooling", 8.14e-2, 3.73e-1, 1.08e0, null, null, null],
  ["RFH-OERC-BL", "AOO", "Fuel Damage While Handling an LTA or LDA Test Pin with PRC Barrier Successfully Retains Release", 2.78e-3, 2.2e-2, 6.49e-2, 2.46e-3, 3.62e-3, 5.4e-3],
  ["RPD-CW1ACS-BL", "AOO", "Control Rod-Induced Transient Overpower with Non-Passive IAC", 4.42e-5, 1.06e-2, 4.1e-2, null, null, null],
  ["RPD-SS-BL", "AOO", "Reactor Scram or Spurious Scram with Non-Passive IAC", 7.91e-2, 3.1e-1, 6.63e-1, null, null, null],
  ["SUD-IACA-BL", "AOO", "Loss of One Train of IAC While Shutdown with Non-Passive IAC", 1.17e-2, 4.16e-2, 8.98e-2, null, null, null],
  ["SUD-LOOP-BL", "AOO", "Loss of Offsite Power While at Low Power with Non-Passive IAC", 4.4e-3, 1.51e-2, 3.21e-2, null, null, null],
  ["DHP-L1PP-2", "DBE", "Loss of One Primary Sodium Pump with RAC", 4.15e-5, 1.11e-4, 2.4e-4, null, null, null],
  ["DHP-LOOP-1", "DBE", "Loss of Offsite Power with Passive IAC", 1.01e-5, 1.8e-4, 5.11e-4, null, null, null],
  ["DHS-ISTL-1", "DBE", "Loss of Heat Sink with Passive IAC", 3.74e-4, 7.87e-4, 1.57e-3, null, null, null],
  ["DHS-ISTL-2", "DBE", "Loss of Heat Sink with RAC", 1.05e-3, 3.02e-3, 7.45e-3, null, null, null],
  ["DHS-RNBK-1", "DBE", "Energy Island Transient without Reactor Power Runback, with Non-Passive IAC", 4.12e-4, 2.4e-3, 6.52e-3, null, null, null],
  ["DHS-RNBK-3", "DBE", "Energy Island Transient without Reactor Power Runback, with RAC", 4.39e-5, 1.84e-4, 4.62e-4, null, null, null],
  ["IPI-IHEL-BL", "DBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak with Non-Passive IAC", 1.46e-4, 1.59e-3, 5.18e-3, null, null, null],
  ["LFF-SAO-BL", "DBE", "Core Blockage and Local Faults with Non-Passive IAC and Functional Containment Barrier Successfully Retains Release (Vessel Head Success)", 3.32e-5, 9.1e-4, 3.36e-3, 3.82e-3, 5.7e-3, 9.87e-3],
  ["RFH-ESWR-BL", "DBE", "Excessive Sodium-Water Reaction in the PIC", 2.05e-5, 5.5e-4, 2.06e-3, null, null, null],
  ["RFH-ESWR-1", "DBE", "Excessive Sodium-Water Reaction in the PIC with PIC and BLTC Barrier Successfully Retains Release", 2.44e-6, 1.03e-4, 4.02e-4, 1.2e-1, 3.31e-1, 5.05e-1],
  ["RFH-FDIV-BL", "DBE", "Fuel Handling Event Occurs While Moving a Non-Fuel Assembly in the Reactor Vessel with No Damage", 3.69e-5, 9.48e-4, 3.65e-3, null, null, null],
  ["RFH-FDIV-1", "DBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the Reactor Vessel with a Single Assembly Failed and Functional Containment Barriers Successfully Retain Release", 8.32e-5, 2.26e-3, 8.73e-3, 8.38e-2, 1.83e-1, 2.9e-1],
  ["RFH-FDIV-3", "DBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the Reactor Vessel with Two Assemblies Failed and Functional Containment Barriers Successfully Retain Release", 4.33e-5, 1.19e-3, 4.32e-3, 1.67e-1, 3.66e-1, 5.82e-1],
  ["RFH-FDSP-1", "DBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the SFP with a Single Assembly Failed and FHB Barrier Fails to Retain Release", 3.24e-5, 8.77e-4, 3.36e-3, 1.2e-1, 3.31e-1, 5.05e-1],
  ["RFH-LBCA-BL", "DBE", "Loss of BLTC Active Cooling While Handling Fuel Assembly with Passive Cooling", 1.95e-5, 5.02e-4, 1.72e-3, null, null, null],
  ["RFH-LMCA-BL", "DBE", "Loss of EVHM Active Cooling While Handling Fuel Assembly or an LTA or LDA with Passive Cooling", 7.51e-4, 8.82e-3, 2.46e-2, null, null, null],
  ["RFH-LTCA-1", "DBE", "Loss of EVST Active Cooling While Storing Fuel Assemblies without Passive Cooling", 5.12e-6, 1.02e-4, 3.72e-4, null, null, null],
  ["RRS-CGR-BL", "DBE", "SCG Leak in the SCG Primary Coolant Boundary where RXB Substructure Successfully Retains Release", 9.47e-6, 2.48e-4, 8.69e-4, 2.27e-3, 5.75e-3, 9.37e-3],
  ["RRS-CGR-1", "DBE", "SCG Leak Downstream of the SCG Vapor Trap Cell where RXB Substructure Successfully Retains Release", 5.23e-6, 1.49e-4, 5.19e-4, 2.27e-3, 5.75e-3, 9.37e-3],
  ["RRS-ISPL-BL", "DBE", "SPS-I Leak at the Cold Trap with Reactor Auxiliary Building Barrier Fails to Retain Release", 3.29e-5, 8.77e-4, 3.19e-3, 5.93e-3, 1.04e-2, 2.04e-2],
  ["RRS-SPLX-BL", "DBE", "SPS-P Leak in the RXB", 5.74e-6, 5.33e-4, 1.85e-3, 1.15e-2, 1.99e-2, 3.98e-2],
  ["RRS-SPLA-BL", "DBE", "SPS-P Leak in the Reactor Auxiliary Building", 2.03e-4, 3.68e-3, 1.28e-2, 1.15e-2, 1.99e-2, 3.98e-2],
  ["RRS-RWG-1", "DBE", "RWG Leak from the Holdup Tank with FHB Barrier Fails to Retain Release", 8.89e-4, 6.33e-3, 1.83e-2, 2.14e-4, 5.62e-4, 1.03e-3],
  ["RRS-RWG-2", "DBE", "RWG Leaks to the Stack to the Environment", 1.52e-5, 5.11e-4, 1.58e-3, 2.38e-4, 6.39e-4, 1.15e-3],
  ["SUD-IACA-1", "DBE", "Loss of One Train of IAC While Shutdown with Passive IAC", 1.4e-4, 6.14e-4, 1.49e-3, null, null, null],
  ["SUD-IHEL-BL", "DBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak While Shutdown with Non-Passive IAC", 1.17e-5, 1.81e-4, 5.81e-4, null, null, null],
  ["SUD-LOOP-1", "DBE", "Loss of Offsite Power While at Low Power with Passive IAC", 2.09e-5, 1.35e-4, 2.87e-4, null, null, null],
  ["DHP-L1PP-1", "BDBE", "Loss of One Primary Sodium Pump with Passive IAC", 3.52e-5, 7.33e-5, 1.35e-4, null, null, null],
  ["DHP-L1PP-3", "BDBE", "Loss of One Primary Sodium Pump with Scram Motor Drive-In", 4.39e-5, 6.69e-5, 9.46e-5, null, null, null],
  ["DHP-L1PP-4", "BDBE", "Loss of One Primary Sodium Pump with Alternative Shunt Trip", 7.13e-6, 4.52e-5, 1.19e-4, null, null, null],
  ["DHP-LAPP-BL", "BDBE", "Loss of All Primary Pumps with Non-Passive IAC", 1.66e-5, 2.88e-5, 4.87e-5, null, null, null],
  ["DHP-LOOP-2", "BDBE", "Loss of Offsite Power with RAC", 2.84e-7, 3.76e-6, 1.18e-5, null, null, null],
  ["DHP-LOOP-3", "BDBE", "Loss of Offsite Power with Scram Motor Drive-In", 1.99e-7, 2.26e-6, 6.17e-6, 1.12e-1, 1.62e-1, 4.06e-1],
  ["DHP-LOOP-4", "BDBE", "Loss of Offsite Power with Alternative Shunt Trip", 6.79e-8, 1.52e-6, 5.33e-6, 1.12e-1, 1.62e-1, 4.06e-1],
  ["DHS-ISTL-3", "BDBE", "Loss of Heat Sink with Scram Motor Drive-In", 2.55e-5, 4.7e-5, 8.8e-5, null, null, null],
  ["DHS-ISTL-4", "BDBE", "Loss of Heat Sink with Alternative Shunt Trip", 4.22e-6, 3.17e-5, 8.89e-5, null, null, null],
  ["DHS-RNBK-2", "BDBE", "Energy Island Transient without Reactor Power Runback, with Passive IAC", 5.38e-6, 5.56e-5, 1.7e-4, null, null, null],
  ["IPI-IHEL-1", "BDBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak with Passive IAC", 2.33e-7, 2.63e-6, 8.74e-6, null, null, null],
  ["IPI-IHEL-2", "BDBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak with RAC", 7.66e-7, 1.01e-5, 3.46e-5, null, null, null],
  ["LFF-SAO-1", "BDBE", "Core Blockage and Local Faults with Non-Passive IAC and Functional Containment Barrier Fails to Retain Release (Vessel Head Success)", 1.19e-8, 1.02e-6, 4.21e-6, 9.29e-2, 1.48e-1, 2.37e-1],
  ["LFF-SAO-2", "BDBE", "Core Blockage and Local Faults with Non-Passive IAC and Functional Containment Barrier Successfully Retains Release (Vessel Head Failed)", 1.26e-7, 9.13e-6, 3.71e-5, 9.29e-2, 1.48e-1, 2.37e-1],
  ["OTH-LMAC-1", "BDBE", "Loss of a Single Medium Voltage AC Bus with Passive IAC", 1.74e-5, 5.63e-5, 1.22e-4, null, null, null],
  ["OTH-LMAC-2", "BDBE", "Loss of a Single Medium Voltage AC Bus with RAC", 5.87e-7, 1.85e-6, 4.08e-6, null, null, null],
  ["OTH-LMAC-3", "BDBE", "Loss of a Single Medium Voltage AC Bus with Scram Motor Drive-In", null, null, null, null, null, null],
  ["OTH-LMAC-4", "BDBE", "Loss of a Single Medium Voltage AC Bus with Alternative Shunt Trip", null, null, null, null, null, null],
  ["RFH-ESWR-2", "BDBE", "Excessive Sodium-Water Reaction in the PIC with PIC and BLTC Barrier Fails to Retain Release (FHB Credited)", 4.9e-7, 3.4e-5, 1.61e-4, 1.2e0, 3.31e0, 5.05e0],
  ["RFH-ESWR-3", "BDBE", "Excessive Sodium-Water Reaction in the PIC with PIC and BLTC Barrier Fails to Retain Release (FHB Not Credited)", 3.12e-8, 1.38e-6, 4.94e-6, 1e1, 1.4e1, 2.1e1],
  ["RFH-FDBL-1", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the BLTC with BLTC Barrier Successfully Retains Release", 4.63e-8, 6.03e-5, 2.09e-4, 2.91e-2, 4.32e-2, 6.36e-2],
  ["RFH-FDBL-2", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the BLTC with BLTC Barrier Fails to Retain Release", 2.41e-8, 6.1e-7, 2.33e-6, 1e1, 1.4e1, 2.1e1],
  ["RFH-FDEM-1", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly or an LTA or LDA in the EVHM with EVHM Barrier Successfully Retains Release", 3.34e-6, 8.8e-5, 3.27e-4, 9.53e-2, 1.4e-1, 2.09e-1],
  ["RFH-FDEM-2", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly or an LTA or LDA in the EVHM with EVHM Barrier Fails to Retain Release", 7.28e-9, 5.25e-7, 1.99e-6, 3.2e1, 4.6e1, 7e1],
  ["RFH-FDET-BL", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the EVST with No Damage", 4.06e-7, 1.09e-5, 3.98e-5, null, null, null],
  ["RFH-FDET-1", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the EVST with a Single Assembly Failed and EVST Barrier Successfully Retains Release", 5.92e-7, 1.61e-5, 6.01e-5, 2.91e-2, 4.32e-2, 6.36e-2],
  ["RFH-FDIV-2", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the Reactor Vessel with a Single Assembly Failed and Functional Containment Barriers Fail to Retain Release", 3.06e-7, 2.27e-5, 8.48e-5, 3.88e-1, 6.74e-1, 1.62e0],
  ["RFH-FDIV-4", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the Reactor Vessel with Two Assemblies Failed and Functional Containment Barriers Fail to Retain Release", 1.66e-7, 1.19e-5, 4.41e-5, 3.88e-1, 6.74e-1, 1.62e0],
  ["RFH-FDPI-1", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the PIC with PIC Barrier Fails to Retain Release", 1.98e-8, 5.1e-7, 1.93e-6, 1e1, 1.4e1, 2.1e1],
  ["RFH-FDPI-BL", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the PIC with PIC Barrier Successfully Retains Release", 1.98e-6, 5.1e-5, 1.93e-4, 2.91e-2, 4.32e-2, 6.36e-2],
  ["RFH-FDSP-2", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the SFP with Two Assemblies Failed and FHB Barrier Fails to Retain Release", 2.41e-6, 9.74e-5, 3.72e-4, 2.4e-1, 6.62e-1, 1.01e0],
  ["RFH-FDRC-1", "BDBE", "Fuel Handling Event Occurs While Moving Fuel Assembly in the Pin Removal Cell with Pin Removal Cell Barrier Successfully Retains Release", 2.59e-6, 6.79e-5, 2.5e-4, 9.53e-2, 1.4e-1, 2.09e-1],
  ["RFH-LMCA-1", "BDBE", "Loss of EVHM Active Cooling While Handling Fuel Assembly or an LTA or LDA without Passive Cooling, EVHM Barrier Successfully Retains Release", 1.04e-8, 8.82e-7, 3.43e-6, 9.53e-2, 1.4e-1, 2.09e-1],
  ["RFH-LMCA-2", "BDBE", "Loss of EVHM Active Cooling While Handling Fuel Assembly or an LTA or LDA without Passive Cooling, EVHM Barrier Fails to Retain Release", 9.72e-9, 8.82e-7, 3.48e-6, 3.2e1, 4.6e1, 7e1],
  ["RFH-LSPC-1", "BDBE", "Loss of SFP Cooling with Makeup Restored", 1.53e-6, 5.74e-6, 9.84e-6, null, null, null],
  ["RPD-CW1ACS-1", "BDBE", "Control Rod-Induced Transient Overpower with Passive IAC", 3.79e-9, 1.05e-6, 4.08e-6, null, null, null],
  ["RPD-CW1ACS-2", "BDBE", "Control Rod-Induced Transient Overpower with RAC", 5.47e-9, 1.66e-6, 6.74e-6, null, null, null],
  ["RPD-CW1ACS-3", "BDBE", "Control Rod-Induced Transient Overpower with Scram Motor Drive-In", 4.63e-9, 1.04e-6, 4.19e-6, null, null, null],
  ["RPD-CW1ACS-4", "BDBE", "Control Rod-Induced Transient Overpower with Alternative Shunt Trip", 1.57e-9, 6.91e-7, 2.95e-6, null, null, null],
  ["RPD-SS-1", "BDBE", "Reactor Scram or Spurious Scram with Passive IAC", 7.26e-6, 3.32e-5, 8.02e-5, null, null, null],
  ["RPD-SS-2", "BDBE", "Reactor Scram or Spurious Scram with RAC", 9.53e-6, 5.08e-5, 1.31e-4, null, null, null],
  ["RPD-SS-3", "BDBE", "Reactor Scram or Spurious Scram with Scram Motor Drive-in", 7.84e-6, 3.03e-5, 6.61e-5, null, null, null],
  ["RPD-SS-4", "BDBE", "Reactor Scram or Spurious Scram with Alternative Shunt Trip", 2.02e-6, 2.05e-5, 6.43e-5, null, null, null],
  ["SUD-CGR-1", "BDBE", "SCG Leak in the SCG Primary Coolant Boundary where RXB Substructure Fails to Retain Release While Shutdown", 3.44e-7, 1.83e-5, 6.7e-5, 7.73e-3, 1.77e-2, 3.47e-2],
  ["SUD-CGR-2", "BDBE", "SCG Leak Downstream of the SCG Vapor Trap Cell where RXB Substructure Fails to Retain Release While Shutdown", 2.25e-7, 1.1e-5, 4.2e-5, 7.73e-3, 1.77e-2, 3.47e-2],
  ["SUD-IACA-2", "BDBE", "Loss of One Train of IAC While Shutdown with RAC", 1.62e-7, 1.84e-6, 6.17e-6, null, null, null],
  ["SUD-IHEL-1", "BDBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak While Shutdown with Passive IAC", 8.53e-8, 2.12e-6, 5.78e-6, null, null, null],
];

const RCI1_LBES: PublishedLbe[] = [
  ["RFH-OERC-EX1", "BDBE", "Fuel Damage While Handling an LTA or LDA Test Pin (RCI-1 event)", 4.81e-9, 3.3e-7, 1.19e-6, 1.2, 3.31, 5.05],
  ["IPI-IHEL-EX1", "BDBE", "Intermediate Heat Exchanger Secondary-to-Primary Leak (RCI-1 event)", 1.41e-8, 1.57e-7, 5.28e-7, null, null, null],
];

const PUBLISHED_ROWS: { row: PublishedLbe; rci1: boolean }[] = [
  ...PUBLISHED_LBES.map((row) => ({ row, rci1: false })),
  ...RCI1_LBES.map((row) => ({ row, rci1: true })),
];

const PUBLISHED_TABLES: Record<PublishedCategory, { table: string; article: string }> = {
  AOO: { table: "Table 3.5-1", article: "an AOO" },
  DBE: { table: "Table 3.5-2", article: "a DBE" },
  BDBE: { table: "Table 3.5-3", article: "a BDBE" },
};

function publishedState(id: string): string {
  if (id.startsWith("SUD-LOOP")) return "Low power";
  if (id.startsWith("SUD-")) return "Shutdown";
  return "Mode not stated";
}

function publishedFamily({ row, rci1 }: { row: PublishedLbe; rci1: boolean }): RiInputFamily {
  const [id, category, title, p05, mean, p95, , dose] = row;
  const release = dose !== null;
  const table = PUBLISHED_TABLES[category];
  const source = rci1
    ? `${PUBLISHED_RCI}, RCI-1, lists it as a BDBE under the 95th percentile floor of RG 1.233, with its 5th, mean and 95th percentile frequencies. The PSAR leaves it out, since its mean is below 5E-7 per plant-year.`
    : mean === null
      ? `${PUBLISHED_PSAR} ${table.table} lists it as ${table.article} with no release. Section 3.8 prints no frequency for it, and RCI-3 leaves it out.`
      : `${PUBLISHED_PSAR} ${table.table} lists it as ${table.article}${release ? "" : " with no release"}. The 5th, mean and 95th percentile frequencies are from ${PUBLISHED_RCI}, RCI-3, which the applicant confirmed against PSAR Figure 3.5-1.`;
  const family: RiInputFamily = {
    id,
    name: title,
    plantOperatingStateId: publishedState(id),
    initiatingEventId: id.slice(0, id.lastIndexOf("-")),
    releaseCategoryIds: release ? [id] : [],
    endState: release ? EndState.RADIONUCLIDE_RELEASE : EndState.SUCCESSFUL_MITIGATION,
    memberSequenceIds: [],
    quantificationIds: [],
    included: mean !== null,
    manual: { source },
  };
  if (mean === null) return { ...family, exclusionReason: "No frequency is published for it. It ends with no release, so leaving it out changes no total." };
  const frequency: RiFrequencyStats = { mean };
  if (p05 !== null) frequency.p05 = p05;
  if (p95 !== null) frequency.p95 = p95;
  return { ...family, frequency };
}

function publishedConsequences(): RiInputConsequence[] {
  const out: RiInputConsequence[] = [];
  for (const { row, rci1 } of PUBLISHED_ROWS) {
    const [id, , , , , , p05, mean, p95] = row;
    if (p05 === null || mean === null || p95 === null) continue;
    const corrected = id === "RFH-FDPI-BL" ? " The RCI-3 table printed 4.32E-1 rem for the mean, and the applicant corrected it to 4.32E-2 rem." : "";
    const source = rci1
      ? `The 5th, mean and 95th percentile 30-day EAB TEDE from ${PUBLISHED_RCI}, RCI-1.`
      : `The 5th, mean and 95th percentile 30-day EAB TEDE from ${PUBLISHED_RCI}, RCI-3, which the applicant confirmed against PSAR Figure 3.5-1.${corrected}`;
    out.push({
      releaseCategoryId: id,
      measure: PUBLISHED_DOSE,
      rcMetricId: `M-${out.length + 1}`,
      unit: "rem",
      statistics: { mean, percentiles: [{ percentile: 5, value: p05 }, { percentile: 95, value: p95 }], exceedances: [] },
      manual: { source },
    });
  }
  return out;
}

const publishedInputs: RiInputs = {
  sources: [],
  families: PUBLISHED_ROWS.map(publishedFamily),
  sequences: [],
  consequences: publishedConsequences(),
  unavailable: [
    { measure: PUBLISHED_EARLY, reason: "PSAR Section 4.1.2 gives only the plant total, 0 per plant-year from all LBEs and OQEs. No value is published for each LBE." },
    { measure: PUBLISHED_LATENT, reason: "PSAR Section 4.1.3 gives only the plant total, 3.86E-9 per plant-year from all LBEs and OQEs. No value is published for each LBE." },
  ],
};

const PUBLISHED_SR: Record<string, { status: SRStatus; evidence: string }> = {
  "RI-A1": { status: "MET", evidence: "Three measures follow NEI 18-04: the 30-day EAB dose, the early fatality risk within 1 mile and the latent cancer risk within 10 miles." },
  "RI-A2": { status: "NOT_APPLICABLE", evidence: "A construction permit under NEI 18-04 uses the absolute criteria, so the relative criteria do not apply." },
  "RI-A3": { status: "MET", evidence: "The F-C target and the three cumulative targets of NEI 18-04, with the 95th percentile BDBE floor of RG 1.233." },
  "RI-A4": { status: "MET", evidence: "The minimum reporting frequency is the standard default of 1E-7 per plant-year." },
  "RI-A5": { status: "MET", evidence: "The minimum reporting consequence is the standard default of ten percent of background dose." },
  "RI-B1": { status: "PARTIAL", evidence: "85 LBEs are compiled with published frequencies, 35 with a published EAB dose. The early and latent risks are published only as plant totals." },
  "RI-B2": { status: "PARTIAL", evidence: "The dose total and the F-C plot are built from the LBEs. The 100 mrem frequency and the early and latent risks cannot be rebuilt from the published LBE data." },
  "RI-B3": { status: "PARTIAL", evidence: "One hazard group, internal events. The other hazard groups are outside the published LBE set." },
  "RI-B4": { status: "MET", evidence: "One unit. Each LBE involves one source by its title." },
  "RI-B5": { status: "MET", evidence: "Each LBE is its own release category, so no grouping hides a contributor here." },
  "RI-B6": { status: "PARTIAL", evidence: "The 11 risk-significant LBEs are identified. No cut-set contributor or importance measure is published." },
  "RI-B7": { status: "MET", evidence: "The workbook sums the mean products and propagates fitted lognormals, with the limits stated in Steps 05 and 07." },
  "RI-C1": { status: "PARTIAL", evidence: "The register compiles the Table 3.1-1 assumptions and the review findings. The full uncertainty register is not published." },
  "RI-C2": { status: "MET", evidence: "No LBE is significant only because of grouping." },
  "RI-C3": { status: "PARTIAL", evidence: "The register is assessed against the dose measure. The early and latent risks have no LBE data to assess." },
  "RI-C4": { status: "PARTIAL", evidence: "The dose total is propagated with the LBEs sampled independently. The PSAR gives its totals as means without uncertainty." },
  "RI-D1": { status: "MET", evidence: "The criteria, results, insights and every source are documented." },
  "RI-D2": { status: "MET", evidence: "The model uncertainties, assumptions and published gaps are documented." },
};

const publishedConformance: SRConformance[] = Object.keys(RI_SR_CATALOG).flatMap((code) => {
  const meta = RI_SR_CATALOG[code];
  const entry = PUBLISHED_SR[code];
  if (meta === undefined || entry === undefined) return [];
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr: meta.hlr,
    capabilityCategory,
    applicableToStage: meta.stages,
    status: entry.status,
    satisfiedByElementPaths: [meta.hlr === "A" ? "riskSignificanceCriteria" : meta.hlr === "B" ? "inputs" : meta.hlr === "C" ? "uncertaintyAnalyses" : "documentation"],
    evidence: entry.evidence,
  }));
});

const PUBLISHED_SOURCES = [
  "Reactor core",
  "Fuel in handling and transfer",
  "Fuel in the EVST",
  "Fuel in the SFP",
  "Primary sodium and cover gas",
  "Sodium processing and radwaste gas",
];

const publishedResults: IntegratedRiskResults = {
  uuid: "RI-RESULTS-PUBLISHED",
  name: "Published cumulative risk metrics",
  description: "The plant totals PSAR Section 4.1 gives from all LBEs and OQEs, as means without uncertainty.",
  calculationLevel: "MEAN",
  metrics: [
    { uuid: "RIM-PUB-1", name: "Frequency of exceeding 100 mrem at the EAB", metricType: "CUSTOM", description: "PSAR Section 4.1.1, from all AOOs, DBEs, BDBEs and OQEs.", value: 3.12e-3, units: "per plant-year", acceptanceCriteria: { limit: 1, basis: "NEI 18-04 cumulative target", complianceStatus: "COMPLIANT" }, implementsSrs: srs("RI-B2") },
    { uuid: "RIM-PUB-2", name: PUBLISHED_EARLY, metricType: "INDIVIDUAL_EARLY_FATALITY_RISK", description: "PSAR Section 4.1.2, from all LBEs and OQEs.", value: 0, units: "per plant-year", acceptanceCriteria: { limit: 5e-7, basis: "NRC safety goal QHO for early fatality", complianceStatus: "COMPLIANT" }, implementsSrs: srs("RI-B2") },
    { uuid: "RIM-PUB-3", name: PUBLISHED_LATENT, metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", description: "PSAR Section 4.1.3, from all LBEs and OQEs, with no long-term phase.", value: 3.86e-9, units: "per plant-year", acceptanceCriteria: { limit: 2e-6, basis: "NRC safety goal QHO for latent cancer", complianceStatus: "COMPLIANT" }, implementsSrs: srs("RI-B2") },
  ],
  calculationApproach: {
    sumOfProducts: true,
    frequencyConsequencePlots: true,
    exceedanceFrequencyCurves: false,
    justification: "The dose total is a sum of mean products. Each LBE is tested against the F-C target at its mean and its 95th percentile. No exceedance curve is drawn from the LBEs, since no chance above any dose is published for them.",
  },
  aggregationApproach: {
    description: "The LBE frequencies and doses are entered by hand from the published tables. The dose measure is totaled as each LBE's mean frequency times its mean dose. The early and latent risks cannot be totaled from the LBEs, since only plant totals are published.",
    perSourceHazardContributionsIdentified: false,
    detailConservatismDifferences: [
      { scope: "Internal events", description: "Every LBE comes from one internal events PRA, with mean values and 5th to 95th percentile bands from its parametric uncertainty module (PSAR Section 3.1.1.14). One consequence method serves every LBE." },
      { scope: "Reactor core", description: "46 LBEs, mostly reactor transients with no release. Five release, LFF-SAO-BL, LFF-SAO-1, LFF-SAO-2, DHP-LOOP-3 and DHP-LOOP-4, for 0.4% of the dose total. Table 3.1-1 lists the local core blockage frequency, 1E-3 per year with an error factor of 10, as potentially more than minor." },
      { scope: "Fuel in handling and transfer", description: "22 LBEs in the vessel, the EVHM, the BLTC, the PIC and the pin removal cell, with 72.6% of the dose total and 9 of the 11 risk-significant LBEs. Several share one dose distribution, which points to a bounding source term reused across them." },
      { scope: "Fuel in the EVST", description: "4 LBEs, one with a release, under 0.1% of the dose total. Table 3.1-1 lists the EVST and HVAC dampers as potentially more than minor." },
      { scope: "Fuel in the SFP", description: "4 LBEs with 21.0% of the dose total. RFH-FDSP-1 and RFH-FDSP-2 are risk-significant and differ only by one more failed assembly (PSAR Table 4.2-3)." },
      { scope: "Primary sodium and cover gas", description: "6 LBEs from cover gas and primary sodium processing leaks, with 5.1% of the dose total. Table 3.1-1 lists the SCG filter location as potentially more than minor." },
      { scope: "Sodium processing and radwaste gas", description: "3 LBEs with 0.8% of the dose total. RRS-ISPL-CN, the DBA chosen from RRS-ISPL-BL, is the one DBA that relies on a single feature, with 40 years of tritium released and no containment credited (PSAR Table 4.2-5)." },
    ],
    separateReviewPerformed: false,
    justification: "Every LBE comes from one internal events PRA and one consequence method at one level of detail, so their mean products add directly.",
  },
  multiReactorContributionsIncluded: false,
  multiSourceContributionsIncluded: false,
  complianceStatus: [
    { criterion: "Frequency of exceeding 100 mrem at the EAB", limit: 1, status: "COMPLIANT", basis: "PSAR Section 4.1.1, 3.12E-3 per plant-year with OQEs." },
    { criterion: "Individual early fatality risk", limit: 5e-7, status: "COMPLIANT", basis: "PSAR Section 4.1.2, 0 per plant-year with OQEs." },
    { criterion: "Individual latent cancer fatality risk", limit: 2e-6, status: "COMPLIANT", basis: "PSAR Section 4.1.3, 3.86E-9 per plant-year with OQEs." },
  ],
  keyAssumptions: [
    "The OQE local sodium boiling source term assumes no bulk boiling, which may underestimate the QHO results (PSAR Section 4.1).",
    "The long-term phase is not evaluated at the CP stage (PSAR Section 3.3.2.2).",
  ],
  implementsSrs: srs("RI-B2", "RI-B3"),
};

const PUBLISHED_SIGNIFICANT: { id: string; insight: string; esq: string; dose: string; ms: string }[] = [
  {
    id: "RFH-LMCA-2",
    insight: "High-consequence BDBE. Its 95th percentile point is at 17.3% of the F-C target, the most of the 11, and its 95th percentile margins of 5.78 in frequency and 3.08 in dose are the smallest (PSAR Table 4.2-2).",
    esq: "Hold the EVHM passive failure probability and the EVHM active cooling assumption against data. PSAR Table 3.1-1 lists both as potentially more than minor.",
    dose: "Mean dose 46 rem, above the 25 rem high-consequence line. No function is left to retain the release (PSAR Table 4.2-4).",
    ms: "Show the source term behind 32, 46 and 70 rem. RFH-FDEM-2 has the same three values, so say whether one bounding source term serves both.",
  },
  {
    id: "RFH-ESWR-2",
    insight: "BDBE at 16.3% of the F-C target. Its mean margins are 53.1 in frequency and 15.1 in dose (PSAR Table 4.2-1).",
    esq: "Reconcile the 95th percentile frequency. PSAR Table 4.2-2 uses 1.31E-4 per plant-year, but Section 3.8.5.4.3 and RCI-3 give 1.61E-4, which cuts the frequency margin from 7.53 to 6.12.",
    dose: "Mean dose 3.31 rem, with the FHB barrier credited (DL4-RR7, PSAR Table 4.2-4).",
    ms: "Show the FHB retention credited in this release. RFH-ESWR-3, without that credit, reaches 14 rem.",
  },
  {
    id: "RFH-FDEM-2",
    insight: "High-consequence BDBE at 9.9% of the F-C target. Its 95th percentile margins are 10.1 in frequency and 4.42 in dose (PSAR Table 4.2-2).",
    esq: "Hold the EVHM passive failure probability of 1E-4 per demand against data. PSAR Table 3.1-1 lists it as potentially more than minor.",
    dose: "Mean dose 46 rem, above the 25 rem high-consequence line. No function is left to retain the release (PSAR Table 4.2-4).",
    ms: "Show the source term behind 32, 46 and 70 rem, the same three values as RFH-LMCA-2.",
  },
  {
    id: "RFH-ESWR-3",
    insight: "BDBE at 3.8% of the F-C target. Its 95th percentile margins are 26.1 in frequency and 8.22 in dose (PSAR Table 4.2-2).",
    esq: "Show the frequency split against RFH-ESWR-2, which credits the FHB barrier that this LBE does not.",
    dose: "Mean dose 14 rem, the same 10, 14 and 21 rem as RFH-FDBL-2 and RFH-FDPI-1.",
    ms: "Show whether one bounding source term gives the 10, 14 and 21 rem shared by RFH-ESWR-3, RFH-FDBL-2 and RFH-FDPI-1.",
  },
  {
    id: "RFH-FDSP-2",
    insight: "BDBE at 3.8% of the F-C target. Its 95th percentile margins are 26.5 in frequency and 9.90 in dose (PSAR Table 4.2-2).",
    esq: "Show the frequency of the second failed assembly, the only difference from RFH-FDSP-1 (PSAR Table 4.2-3).",
    dose: "Mean dose 0.662 rem, twice RFH-FDSP-1 for two failed assemblies, with the FHB barrier failing to retain the release.",
    ms: "Confirm that the dose doubles with the second assembly in this release.",
  },
  {
    id: "RFH-FDIV-1",
    insight: "DBE at 2.5% of the F-C target, with 24.5% of the EAB dose total. Its 95th percentile margins are 39.5 in frequency and 3.79 in dose (PSAR Table 4.2-2).",
    esq: "Keep DL3-RR1 and DL3-RR3a credited for this family. PSAR Table 4.2-3 finds no single feature relied on.",
    dose: "Mean dose 0.183 rem, with the functional containment barriers retaining the release.",
    ms: "Show the retention of the primary system boundary with the RES barrier and of the EVHM to head barrier in this release.",
  },
  {
    id: "RFH-FDIV-3",
    insight: "DBE at 2.5% of the F-C target, with 25.8% of the EAB dose total, the most of any LBE. Its 95th percentile margins are 39.8 in frequency and 3.09 in dose (PSAR Table 4.2-2).",
    esq: "Keep DL3-RR1 and DL3-RR3a credited, and show the frequency of two failed assemblies against one in RFH-FDIV-1.",
    dose: "Mean dose 0.366 rem, twice RFH-FDIV-1 for two failed assemblies.",
    ms: "Confirm the release fractions behind its 95th percentile dose margin of 3.09, the smallest of the DBEs.",
  },
  {
    id: "RFH-FDBL-2",
    insight: "BDBE at 1.8% of the F-C target. Its 95th percentile margins are 55.3 in frequency and 13.3 in dose (PSAR Table 4.2-2).",
    esq: "Show the BLTC barrier failure probability that sets this LBE.",
    dose: "Mean dose 14 rem, with the BLTC barrier failed and no function left (PSAR Table 4.2-4).",
    ms: "Show whether one bounding source term gives the 10, 14 and 21 rem shared by RFH-ESWR-3, RFH-FDBL-2 and RFH-FDPI-1.",
  },
  {
    id: "RFH-FDSP-1",
    insight: "DBE at 1.7% of the F-C target, with 17.2% of the EAB dose total. Its 95th percentile margins are 59.0 in frequency and 4.25 in dose (PSAR Table 4.2-2).",
    esq: "Show the SFP fuel handling frequency that sets it. No DL function is credited for it (PSAR Table 4.2-3).",
    dose: "Mean dose 0.331 rem, with the FHB barrier failing to retain the release. RFH-ESWR-1 has the same three values.",
    ms: "Show whether one source term gives both RFH-FDSP-1 and RFH-ESWR-1.",
  },
  {
    id: "RFH-FDIV-2",
    insight: "BDBE at 1.7% of the F-C target. Its 95th percentile margins are 59.2 in frequency and 17.2 in dose (PSAR Table 4.2-2).",
    esq: "Show the frequency of the functional containment failure that separates it from RFH-FDIV-1.",
    dose: "Mean dose 0.674 rem, with the functional containment barriers failed. RFH-FDIV-4 has the same three values.",
    ms: "Show the release path when the functional containment fails, shared with RFH-FDIV-4.",
  },
  {
    id: "RFH-FDPI-1",
    insight: "BDBE at 1.5% of the F-C target. Its 95th percentile margins are 66.6 in frequency and 15.0 in dose (PSAR Table 4.2-2).",
    esq: "Show the PIC barrier failure probability that sets this LBE.",
    dose: "Mean dose 14 rem, with the PIC barrier failed and no function left (PSAR Table 4.2-4).",
    ms: "Show whether one bounding source term gives the 10, 14 and 21 rem shared by RFH-ESWR-3, RFH-FDBL-2 and RFH-FDPI-1.",
  },
];

const PUBLISHED_TRACE = "Publish the sequences and top cut sets of this LBE, so its 95th percentile frequency can be traced.";

const PUBLISHED_ALL_METRICS = ["INDIVIDUAL_DOSE", "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", "INDIVIDUAL_EARLY_FATALITY_RISK"];

const publishedRegister: ModelUncertaintySource[] = [
  { uuid: "MU-P1", name: "LBE frequency distributions", description: "The parametric uncertainty module of the PRA gives each LBE's 5th and 95th percentile frequencies (PSAR Section 3.1.1.14).", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Sets the bands RI samples. RFH-FDBL-1 spans a factor of 4,500 from its 5th to its 95th percentile, and RFH-LMCA-2 a factor of 360.", characterizationMethod: "Propagated in Step 07", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P2", name: "Generic meteorological data and uniform population", description: "The doses use generic URD meteorological data, a uniform population and no emergency response credit (NRC SE Sections 3 and 4).", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Sets every published dose. The NRC staff expects the data to be justified as representative of the site at the OL stage.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P3", name: "EVHM passive failure probability", description: "PSAR Table 3.1-1 sets the EVHM passive failure probability at 1E-4 per demand.", originatingElement: TechnicalElementTypes.DATA_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "The EVHM barrier failure defines RFH-FDEM-2 and RFH-LMCA-2, the two high-consequence BDBEs. RFH-LMCA-2 has the smallest 95th percentile frequency margin, 5.78, and RFH-FDEM-2 the third smallest, 10.1.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P4", name: "EVHM active cooling", description: "PSAR Table 3.1-1 lists the EVHM active cooling as a potentially more than minor assumption.", originatingElement: TechnicalElementTypes.SYSTEMS_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Sets the RFH-LMCA family. RFH-LMCA-2 is a high-consequence BDBE at 17.3% of the F-C target.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P5", name: "Local core blockage frequency", description: "PSAR Table 3.1-1 sets the local core blockage frequency at 1E-3 per year, lognormal with an error factor of 10.", originatingElement: TechnicalElementTypes.INITIATING_EVENT_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Scales the three LFF-SAO LBEs. Together they carry 0.4% of the EAB dose total, so the totals move little.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P6", name: "Control rod insertion and CRA common-cause groups", description: "PSAR Table 3.1-1 lists the control rod insertion failure rate and the CRA common-cause groups.", originatingElement: TechnicalElementTypes.DATA_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Sets the -3 and -4 reactor LBEs that use the scram motor drive-in or the alternative shunt trip. Only DHP-LOOP-3 and DHP-LOOP-4 release, at 0.162 rem mean, so the dose total moves little.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P7", name: "NIC channel testing and software common-cause failure", description: "PSAR Table 3.1-1 lists the NIC channel testing frequency and the single digital common-cause factor for the NIC software.", originatingElement: TechnicalElementTypes.SYSTEMS_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Bears on the reactor trip LBEs. Of those, only DHP-LOOP-3 and DHP-LOOP-4 release, so the dose total moves little.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P8", name: "Consequential fuel damage", description: "PSAR Table 3.1-1 lists the treatment of consequential fuel damage as potentially more than minor.", originatingElement: TechnicalElementTypes.EVENT_SEQUENCE_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Decides whether a transient adds fuel damage and a release. Most reactor transient LBEs end with no release, so a change could move LBEs into the release set.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P9", name: "Molten salt data", description: "PSAR Table 3.1-1 lists the molten salt data as potentially more than minor.", originatingElement: TechnicalElementTypes.DATA_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "No release LBE is tied to it by title, so its effect on the totals cannot be judged from the published data.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P10", name: "EVST and HVAC dampers", description: "PSAR Table 3.1-1 lists the EVST and HVAC damper assumptions.", originatingElement: TechnicalElementTypes.SYSTEMS_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Bears on the four EVST LBEs, which carry under 0.1% of the EAB dose total.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P11", name: "SCG filter location", description: "PSAR Table 3.1-1 lists the SCG filter location as potentially more than minor.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Bears on the four cover gas leak LBEs, which carry 0.2% of the EAB dose total.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P12", name: "Vessel head and head access area leak rates", description: "PSAR Table 3.1-1 sets the vessel head leak rate at 1% per day and the head access area leak rate at 10% per day, both 100% per day if isolation fails.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: PUBLISHED_ALL_METRICS, impactAssessment: "Sets the release of the LBEs that credit the vessel head, such as LFF-SAO-BL, LFF-SAO-1 and LFF-SAO-2.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P13", name: "OQE local sodium boiling source term", description: "PSAR Section 4.1 assumes no bulk boiling in the local sodium boiling OQE source term.", originatingElement: TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", "INDIVIDUAL_EARLY_FATALITY_RISK"], impactAssessment: "The PSAR notes it may underestimate the QHO results. It moves the published plant totals, not the LBEs here.", implementsSrs: srs("RI-C1", "RI-C3") },
  { uuid: "MU-P14", name: "Long-term phase not evaluated", description: "PSAR Section 3.3.2.2 leaves out the long-term phase at the CP stage.", originatingElement: TechnicalElementTypes.CONSEQUENCE_ANALYSIS, affectedMetrics: ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"], impactAssessment: "Only the latent cancer risk sees it. The published total of 3.86E-9 per plant-year leaves out the chronic exposure.", implementsSrs: srs("RI-C1", "RI-C3") },
];

const publishedLedger: ScreenedItemLedgerEntry[] = [
  { uuid: "SL-P1", itemType: "HAZARD_GROUP", itemRef: "All hazard groups other than internal events", screeningElementCode: "IE", screeningBasis: "No LBE in PSAR Tables 3.5-1 to 3.5-3 comes from another hazard group. The NRC staff expects the FSAR integrated risk to cover all modes, hazards and sources (SE Section 4).", impactOnRiskMetrics: "Not known from the published data.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-P2", itemType: "EVENT_SEQUENCE", itemRef: "OQEs", screeningElementCode: "ES", screeningBasis: "The PSAR evaluates the OQEs outside the LBE set and adds them to its plant totals (Section 4.1). Their frequencies and doses are not published, so they are not compiled here.", impactOnRiskMetrics: "The published 100 mrem frequency of 3.12E-3 per plant-year includes them. The LBE totals here do not.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-P3", itemType: "EVENT_SEQUENCE", itemRef: "Reactor vessel leak into the guard vessel annulus", screeningElementCode: "ES", screeningBasis: "Not carried as an LBE in PSAR Rev. 1. The NRC staff found its mean frequency in the BDBE range, so it should be one (SE p. 3-77).", impactOnRiskMetrics: "Not quantified in the published data.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-P4", itemType: "EVENT_SEQUENCE", itemRef: "OTH-LMAC-3 and OTH-LMAC-4", screeningElementCode: "ES", screeningBasis: "Listed as BDBEs with no release, but no frequency is published for either. Left out of the integration.", impactOnRiskMetrics: "None. Both end with no release.", implementsSrs: srs("RI-C1") },
  { uuid: "SL-P5", itemType: "EVENT_SEQUENCE", itemRef: "The 21 DBAs", screeningElementCode: "ES", screeningBasis: "DBAs are deterministic events chosen from the DBEs and judged against 10 CFR 50.34, not the F-C target. NEI 18-04 leaves them out of the cumulative metrics.", impactOnRiskMetrics: "None on the totals. RRS-ISPL-CN is the one DBA that relies on a single feature (PSAR Table 4.2-5).", implementsSrs: srs("RI-C1") },
];

const publishedUncertainty: RiskUncertaintyAnalysis[] = [
  {
    uuid: "RIU-P1",
    name: "EAB dose total uncertainty",
    description: "The published LBE frequency and dose bands propagated into a distribution on the 30-day EAB dose total.",
    metric: PUBLISHED_DOSE,
    characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT",
    propagationMethod: "Monte Carlo sampling of lognormals fitted to each LBE's published 5th and 95th percentiles",
    parameterUncertainty: { type: DistributionType.LOGNORMAL, median: 1.13e-3, errorFactor: 2.9 },
    sokcAndPhenomenaTreatment: {
      eventFrequencySokcConsidered: false,
      phenomenaDependenciesConsidered: false,
      treatmentDescription: "The PRA's parametric uncertainty module gives each LBE's frequency band (PSAR Section 3.1.1.14). RI samples the LBEs independently, so any state-of-knowledge correlation between them is not carried. Each LBE is its own release category, so LBEs that share a published dose distribution are sampled independently too.",
      riskSignificanceBasis: "The 11 risk-significant LBEs carry 85% of the dose total, so their bands set its spread.",
    },
    evaluationScope: "COMBINATION",
    evaluationType: "QUANTITATIVE",
    keyUncertaintySourceRefs: ["MU-P1", "MU-P2", "MU-P3"],
    prioritization: [
      { uncertaintySourceId: "MU-P1", priorityLevel: ImportanceLevel.HIGH, basis: "The LBE bands set the spread of the total." },
      { uncertaintySourceId: "MU-P2", priorityLevel: ImportanceLevel.HIGH, basis: "Sets every published dose." },
      { uncertaintySourceId: "MU-P3", priorityLevel: ImportanceLevel.MEDIUM, basis: "Bears on the two high-consequence BDBEs." },
    ],
    uncertaintyRangeDiscussion: "The 90 percent band on the EAB dose total spans a factor of about 8.5, from 4.7E-4 to 4.0E-3 rem per plant-year, with a sampled mean of 1.6E-3. The published means sum to 1.7E-3. The lognormals fitted to the 5th and 95th percentiles do not reproduce every published mean, which explains the gap.",
    implementsSrs: srs("RI-C3", "RI-C4"),
  },
];

const publishedSensitivities: SensitivityStudy[] = [
  {
    uuid: "RIS-P1",
    modelUncertaintyId: "MU-P1",
    name: "RFH-ESWR-2 95th percentile frequency",
    description: "The two published values of the RFH-ESWR-2 95th percentile frequency.",
    variedParameters: ["RFH-ESWR-2 95th percentile frequency"],
    parameterRanges: { "RFH-ESWR-2 95th percentile frequency": [1.31e-4, 1.61e-4] },
    results: "With 1.31E-4 per plant-year the 95th percentile frequency margin is 7.53, as PSAR Table 4.2-2 prints. With 1.61E-4, from Section 3.8.5.4.3 and RCI-3, it is 6.12. The LBE stays risk-significant and inside the target either way.",
    implementsSrs: srs("RI-C3"),
  },
  {
    uuid: "RIS-P2",
    name: "BDBE floor statistic",
    description: "The BDBE lower bound read on the mean, as the PSAR does, or on the 95th percentile, as RG 1.233 states.",
    variedParameters: ["BDBE floor statistic, 0 for the mean and 1 for the 95th percentile"],
    parameterRanges: { "BDBE floor statistic, 0 for the mean and 1 for the 95th percentile": [0, 1] },
    results: "Reading the floor on the 95th percentile adds RFH-OERC-EX1 and IPI-IHEL-EX1 as BDBEs (RCI-1). Neither is risk-significant. RFH-OERC-EX1 adds 1.1E-6 rem per plant-year to the dose total, under 0.1%.",
    implementsSrs: srs("RI-A3"),
  },
];

const publishedDocumentation: RiDocumentation = {
  processDescription: "The published LBE frequencies and doses are entered by hand, sorted into AOOs, DBEs and BDBEs, tested against the F-C target, totaled where the data allows, propagated and handed back with the gaps, per ASME/ANS RA-S-1.4 HLR-RI-A through D.",
  inputsDescription: "87 LBEs: the 85 of PSAR Rev. 1 Tables 3.5-1 to 3.5-3 and two BDBEs from RCI-1. 85 have published frequencies and 35 a published 30-day EAB dose. OTH-LMAC-3 and OTH-LMAC-4 have no published frequency.",
  appliedMethods: "The NEI 18-04 category bands and F-C target, a sum of mean products for the dose total, and a Monte Carlo propagation of lognormals fitted to each LBE's 5th and 95th percentiles.",
  resultsSummary: "11 AOOs, 27 DBEs and 47 BDBEs. 11 LBEs are risk-significant, all fuel handling events, as in PSAR Tables 3.5-2 and 3.5-3. The LBE dose total is 1.69E-3 rem per plant-year.",
  riskSignificanceCriteriaUsed: "NEI 18-04 as endorsed by RG 1.233: the F-C target, the 2.5 mrem and 1 percent LBE test, and the 95th percentile BDBE floor.",
  resultsAndInsights: "Every LBE lies inside the F-C target. RFH-LMCA-2 and RFH-ESWR-2 have the smallest 95th percentile margins, about 6 in frequency. The three risk-significant DBEs carry two thirds of the dose total.",
  scopeLimitations: "Internal events only. The early and latent risks, the chance above 100 mrem, the sequences and the cut-set contributors are not published per LBE, so those totals and Step 06 stay empty.",
  traceabilityToUpstreamContributions: "Each family and each dose names its table and response in its source field.",
  acceptanceCriteriaComparison: "The PSAR's own totals are 3.12E-3 per plant-year above 100 mrem against 1, an early fatality risk of 0 against 5E-7 and a latent cancer risk of 3.86E-9 against 2E-6, all with the OQEs included.",
  keyUncertaintySources: "The LBE frequency bands, the generic meteorological data and the EVHM passive failure probability lead the register.",
  designFeatureInsights: "The fuel handling barriers decide risk significance. Eight of the 11 risk-significant LBEs have no function left to credit.",
  integratedContributorRollup: "The 11 risk-significant LBEs come from seven fuel handling families and carry 85 percent of the dose total.",
  modelUncertaintySourcesDocumentation: "The register compiles the PSAR Table 3.1-1 assumptions, the source term and consequence assumptions and the review findings. The ledger lists what the published set leaves out.",
  praTaskInterfaces: "No workbook is linked. RI takes its inputs by hand from the published documents and hands back what each element should publish.",
  implementsSrs: srs("RI-D1", "RI-D2"),
};

export const RI_ANALYSIS_PUBLISHED: RiskIntegration = {
  uuid: RI_PUBLISHED_SLUG,
  name: RI_PUBLISHED_LABEL,
  type: TechnicalElementTypes.RISK_INTEGRATION,
  version: "1",
  created: PUBLISHED_DATE,
  modified: PUBLISHED_DATE,
  owner: PUBLISHED_OWNER,
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: PUBLISHED_DATE, actor: PUBLISHED_OWNER }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: PUBLISHED_DATE, schemaVersion: "0.0.1" },
    analysisDate: PUBLISHED_DATE,
    analysts: [PUBLISHED_OWNER],
    reviewers: [],
    scope: "Expert review of the published risk integration inputs for Kemmerer Power Station Unit 1 at the construction permit stage.",
    limitations: [
      "The early and latent risks are published only as plant totals, so they cannot be rebuilt from the LBEs.",
      "No chance above 100 mrem, event sequence or cut-set contributor is published for the LBEs.",
      "Internal events only. The other hazard groups are outside the published LBE set.",
    ],
    lastModifiedDate: PUBLISHED_DATE,
    lastModifiedBy: PUBLISHED_OWNER,
  },
  conformanceMatrix: publishedConformance,
  internalReviewComments: { openCount: 0, resolvedCount: 0, comments: [] },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Expert review of the published risk integration inputs for Kemmerer Power Station Unit 1, a sodium-cooled fast reactor at the construction permit stage, under NEI 18-04 as endorsed by RG 1.233. It takes the 85 non-DBA LBEs of PSAR Rev. 1 and the two BDBEs RCI-1 adds, with the frequencies and 30-day EAB doses the applicant confirmed in its RCI response. The 21 DBAs are deterministic and outside the integration.",
  applicationContext: { applicationType: "FIXED_RISK_TARGET", licensingAction: "CONSTRUCTION_PERMIT", siteBasis: "BOUNDING_SITE", linkedWorkbooks: {} },
  inputs: publishedInputs,
  scopeDefinition: {
    consequenceMeasures: [
      { name: PUBLISHED_DOSE, description: "The 30-day TEDE at the exclusion area boundary, the dose each LBE is tested with against the F-C target. The PSAR gives its 5th, mean and 95th percentile for each LBE.", role: "EAB_DOSE", quantity: "INDIVIDUAL_DOSE", receptor: { kind: "EAB_MAXIMUM" }, window: { seconds: 2592000, start: "RELEASE_ONSET" }, protectiveActionsCredited: false },
      { name: PUBLISHED_EARLY, description: "The average individual early fatality risk within 1 mile of the EAB, summed against 5E-7 per plant-year. The PSAR gives it only as a plant total.", role: "EARLY_FATALITY_RISK", quantity: "INDIVIDUAL_EARLY_FATALITY_RISK", receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: 1.609344 }, protectiveActionsCredited: false },
      { name: PUBLISHED_LATENT, description: "The average individual latent cancer fatality risk within 10 miles of the EAB, summed against 2E-6 per plant-year. The PSAR gives it only as a plant total, without the long-term phase.", role: "LATENT_CANCER_RISK", quantity: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", receptor: { kind: "AVERAGE_BEYOND_EAB", distanceKm: 16.09344 }, protectiveActionsCredited: false },
    ],
    plantOperatingStateRefs: ["Low power", "Shutdown", "Mode not stated"],
    hazardGroups: ["Internal events"],
    radioactiveMaterialSources: PUBLISHED_SOURCES,
    scopeExclusions: [
      { aspect: "HAZARD_GROUP", item: "Internal floods", reason: PUBLISHED_HAZARD_REASON },
      { aspect: "HAZARD_GROUP", item: "Internal fires", reason: PUBLISHED_HAZARD_REASON },
      { aspect: "HAZARD_GROUP", item: "Seismic events", reason: `${PUBLISHED_HAZARD_REASON} The seismic DBA, SEV-SSE-CN, is deterministic and has no release (PSAR Table 3.5-4).` },
      { aspect: "HAZARD_GROUP", item: "High winds", reason: PUBLISHED_HAZARD_REASON },
      { aspect: "HAZARD_GROUP", item: "External floods", reason: PUBLISHED_HAZARD_REASON },
      { aspect: "HAZARD_GROUP", item: "Other internal and external hazards", reason: PUBLISHED_HAZARD_REASON },
    ],
  },
  riskSignificanceCriteria,
  reportingThresholds: {
    minimumReportingFrequencyPerPlantYear: 1e-7,
    frequencyBasis: "STANDARD_DEFAULT",
    minimumReportingConsequenceDescription: "10% of background-radiation dose",
    consequenceBasis: "STANDARD_DEFAULT",
    implementsSrs: srs("RI-A4", "RI-A5"),
  },
  compiledRiskInputs: [],
  integratedRiskResults: publishedResults,
  groupingAdequacyReview: {
    variationNotSignificantJustification: "Each LBE is its own release category with its own published dose, so RI groups nothing. The variation inside each LBE is the PSAR's own family grouping.",
    releaseCategorySelectionSufficiency: "The PSAR assigns a mechanistic source term to each release category (Section 3.1.1.13) but does not publish the categories. Using the LBE as the category keeps every published dose.",
    familyAssignmentSufficiency: "The 85 PSAR LBEs fall into 32 initiating event families. The -BL event is the success case, and each higher number adds a failure (NRC SE p. 3-76).",
    groupingUncertaintyReview: {
      performed: true,
      artificialSignificanceFound: false,
      findings: "No LBE is significant only because of grouping. Several LBEs share one published dose distribution, such as 10, 14 and 21 rem for RFH-ESWR-3, RFH-FDBL-2 and RFH-FDPI-1, which points to a bounding source term reused across them.",
    },
    implementsSrs: srs("RI-B5", "RI-C2"),
  },
  significantContributors: {
    uuid: "RI-SC-PUBLISHED",
    metricType: "INDIVIDUAL_DOSE",
    description: "The 11 LBEs that PSAR Tables 3.5-2 and 3.5-3 mark as risk-significant, which the NEI 18-04 test here reproduces.",
    significantEventSequenceFamilies: PUBLISHED_SIGNIFICANT.map((s) => ({ uuid: `RSC-${s.id}`, name: s.id, contributorType: "Licensing basis event", sourceElement: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION, sourceId: s.id, importanceLevel: ImportanceLevel.HIGH, insights: [s.insight] })),
    insightDerivationBasis: "The NEI 18-04 test of each LBE's 95th percentile frequency and dose against the F-C target.",
    insights: ["All 11 risk-significant LBEs are fuel handling events."],
    implementsSrs: srs("RI-B6"),
  },
  integrationMethods: [
    { uuid: "RIM-P1", name: "Sum of mean products", description: "Add each LBE's mean frequency times its mean dose.", scopeJustification: "Applies to the dose measure, the one measure with LBE results.", verificationStatus: { verified: true, verificationMethod: "Reconciled against the published LBE values." }, implementsSrs: srs("RI-B2", "RI-B7") },
    { uuid: "RIM-P2", name: "F-C target test", description: "Test each LBE at its mean and its 95th percentile against the NEI 18-04 F-C target.", scopeJustification: "Applies to every LBE with a published dose.", verificationStatus: { verified: true, verificationMethod: "Reproduces the margins of PSAR Tables 4.2-1 and 4.2-2." }, implementsSrs: srs("RI-B2", "RI-B7") },
    { uuid: "RIM-P3", name: "Monte Carlo propagation", description: "Sample lognormals fitted to each LBE's 5th and 95th percentiles, 10,000 times.", scopeJustification: "Applies to the dose total.", limitations: ["The LBEs are sampled independently."], implementsSrs: srs("RI-C4", "RI-B7") },
  ],
  modelUncertaintySources: publishedRegister,
  screenedItemsLedger: publishedLedger,
  uncertaintyAnalyses: publishedUncertainty,
  sensitivityStudies: publishedSensitivities,
  riskIntegrationFeedbackDispatch: {
    dispatchDate: PUBLISHED_DATE,
    eventSequenceQuantificationFeedback: {
      familyFeedback: PUBLISHED_SIGNIFICANT.map((s) => ({ familyRef: s.id, riskSignificance: ImportanceLevel.HIGH, insights: [s.insight], recommendations: [s.esq, PUBLISHED_TRACE] })),
      generalFeedback: "Eleven LBEs are risk-significant under NEI 18-04, all fuel handling events. Publish their sequences and top cut sets, and reconcile the RFH-ESWR-2 95th percentile frequency.",
    },
    mechanisticSourceTermFeedback: {
      releaseCategoryFeedback: PUBLISHED_SIGNIFICANT.map((s) => ({ releaseCategoryRef: s.id, riskSignificance: ImportanceLevel.HIGH, insights: [s.dose], recommendations: [s.ms] })),
      generalFeedback: "Eleven LBE releases are risk-significant. Several LBEs share one dose distribution, so show the source term behind each and whether a bounding one is reused.",
    },
    radiologicalConsequenceFeedback: {
      metricFeedback: [
        { metric: PUBLISHED_DOSE, riskSignificance: ImportanceLevel.HIGH, insights: ["11 LBEs are risk-significant through this measure.", "The LBE mean dose total is 1.69E-3 rem per plant-year. RFH-FDIV-3 carries 25.8% of it."], recommendations: ["Report the chance above 100 mrem for each LBE, so the 100 mrem frequency can be rebuilt from the LBEs.", "Justify the generic meteorological data as representative of the site. The NRC staff expects this at the OL stage."] },
        { metric: PUBLISHED_EARLY, riskSignificance: ImportanceLevel.LOW, insights: ["The PSAR gives a plant total of 0 per plant-year."], recommendations: ["Report the early fatality risk for each LBE."] },
        { metric: PUBLISHED_LATENT, riskSignificance: ImportanceLevel.LOW, insights: ["The PSAR gives a plant total of 3.86E-9 per plant-year against 2E-6."], recommendations: ["Report the latent cancer risk for each LBE.", "Evaluate the long-term phase, which Section 3.3.2.2 leaves out at the CP stage."] },
      ],
      generalFeedback: "Report the chance above 100 mrem, the early fatality risk and the latent cancer risk for each LBE, so RI can rebuild the cumulative totals from the LBEs.",
    },
    additionalElementFeedback: [
      { elementCode: "POS", riskSignificance: ImportanceLevel.HIGH, insights: ["All 11 risk-significant LBEs are fuel handling events with no stated operating state."], recommendations: ["State the operating state of each LBE. Only the nine SUD LBE titles give one."], generalFeedback: "Every risk-significant LBE is a fuel handling event, and none states its operating state. Give the state of each LBE so the totals can be split by state." },
      { elementCode: "IE", riskSignificance: ImportanceLevel.HIGH, insights: ["Seven RFH initiating event families hold the 11 risk-significant LBEs."], recommendations: ["Hold the seven RFH initiating event frequencies against data, since they set every risk-significant LBE."], generalFeedback: "Seven fuel handling initiating event families, RFH-FDIV, RFH-FDSP, RFH-ESWR, RFH-FDBL, RFH-FDPI, RFH-LMCA and RFH-FDEM, hold all 11 risk-significant LBEs." },
      { elementCode: "ES", riskSignificance: ImportanceLevel.HIGH, insights: ["The NRC staff found one event missing from the LBE set, and RCI-1 adds two BDBEs."], recommendations: ["Add the reactor vessel leak into the guard vessel annulus as an LBE. The NRC staff found its mean frequency in the BDBE range (SE p. 3-77).", "Carry RFH-OERC-EX1 and IPI-IHEL-EX1 as BDBEs. Their 95th percentile frequencies reach 5E-7 per plant-year (RCI-1)."], generalFeedback: "The LBE set needs one more event, and two more BDBEs under RG 1.233. The 11 risk-significant LBEs come from seven fuel handling families." },
      { elementCode: "SC", riskSignificance: ImportanceLevel.LOW, insights: ["No function test is run here. PSAR Tables 4.2-3 and 4.2-4 list the DL functions of the risk-significant LBEs."], recommendations: ["Publish the success criteria of the barriers whose failure defines the risk-significant LBEs."], generalFeedback: "Eight of the 11 risk-significant LBEs have no function left to credit (PSAR Tables 4.2-3 and 4.2-4). The success criteria of the barriers they fail set the LBE boundaries." },
      { elementCode: "SY", riskSignificance: ImportanceLevel.LOW, insights: ["No cut-set contributor is published, so no SSC is tested here."], recommendations: ["Publish the importance measures of the risk-significant LBEs, so their SSCs can be tested."], generalFeedback: "No system contributor can be tested from the published data. The PSAR classifies the SSCs through their functions in Section 5.2." },
      { elementCode: "HR", riskSignificance: ImportanceLevel.LOW, insights: ["No human failure event is published for the LBEs."], recommendations: ["Publish the human failure events in the risk-significant LBEs."], generalFeedback: "No human failure event can be tested from the published data." },
      { elementCode: "DA", riskSignificance: ImportanceLevel.LOW, insights: ["PSAR Table 3.1-1 lists five data assumptions as potentially more than minor."], recommendations: ["Hold the EVHM passive failure probability, the control rod insertion failure rate, the CRA common-cause groups, the NIC software common-cause factor and the molten salt data against data."], generalFeedback: "Five data assumptions in Table 3.1-1 are potentially more than minor. The EVHM passive failure probability matters most, since it bears on the two high-consequence BDBEs." },
    ],
  },
  modelUncertainty: {
    uuid: "ri-mu-published",
    name: "RI model uncertainty documentation",
    uncertaintySources: [
      { source: "LBE frequency bands", impact: "Set the spread of every total." },
      { source: "Generic meteorological data and uniform population", impact: "Set every published dose." },
      { source: "Long-term phase not evaluated", impact: "Leaves chronic exposure out of the latent cancer risk." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions: [
    {
      uuid: "RI-PA-P1",
      assumptionId: "RI-PA-P1",
      description: "Every published dose uses generic URD meteorological data, a uniform population and no emergency response credit.",
      influenceOnDefinition: "Consequence inputs",
      status: "OPEN",
      limitations: ["Not yet justified as representative of the site."],
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "Justify the data as representative of the site at the OL stage, as the NRC staff expects.",
      plannedClosureActions: ["Recompile the LBE doses with site data at the OL stage."],
      affectedElementIds: ["inputs"],
      implementsSrs: srs("RI-B1"),
    },
    {
      uuid: "RI-PA-P2",
      assumptionId: "RI-PA-P2",
      description: "The long-term phase is not evaluated at the CP stage, so the latent cancer risk leaves out chronic exposure (PSAR Section 3.3.2.2).",
      influenceOnDefinition: "Latent cancer risk",
      status: "OPEN",
      limitations: ["The latent cancer total is incomplete."],
      riskImpact: ImportanceLevel.LOW,
      closureBasis: "Evaluate the long-term phase at the OL stage.",
      plannedClosureActions: ["Add the long-term phase to the consequence analysis."],
      affectedElementIds: ["inputs"],
      implementsSrs: srs("RI-B1"),
    },
    {
      uuid: "RI-PA-P3",
      assumptionId: "RI-PA-P3",
      description: "The OQE local sodium boiling source term assumes no bulk boiling, which PSAR Section 4.1 says may underestimate the QHO results.",
      influenceOnDefinition: "Published plant totals",
      status: "OPEN",
      limitations: ["Bears on the published early and latent totals."],
      riskImpact: ImportanceLevel.LOW,
      closureBasis: "Confirm the boiling regime or bound it at the OL stage.",
      plannedClosureActions: ["Recompute the OQE source term with bulk boiling."],
      affectedElementIds: ["integratedRiskResults"],
      implementsSrs: srs("RI-B2"),
    },
  ],
  documentation: publishedDocumentation,
  exampleDocuments: [
    { id: "RI-PUB-DOC-01", name: "Kemmerer Power Station Unit 1 Preliminary Safety Analysis Report, Revision 1", kind: "doc", sizeLabel: "NRC ADAMS", uploadedLabel: "ML25276A288", extracted: "The LBE lists and their risk significance (Tables 3.5-1 to 3.5-3), the plant totals (Section 4.1), the margins and DL functions (Tables 4.2-1 to 4.2-5) and the more-than-minor assumptions (Table 3.1-1)", linked: 85, url: "https://www.nrc.gov/docs/ML2527/ML25276A288.pdf" },
    { id: "RI-PUB-DOC-02", name: "Response to NRC requests for confirmation of information for the Kemmerer Unit 1 construction permit application", kind: "doc", sizeLabel: "NRC ADAMS", uploadedLabel: "ML25259A180", extracted: "The 5th, mean and 95th percentile frequency and 30-day EAB dose of every LBE (RCI-3) and the two BDBEs under the 95th percentile floor (RCI-1)", linked: 120, url: "https://www.nrc.gov/docs/ML2525/ML25259A180.pdf" },
    { id: "RI-PUB-DOC-03", name: "Safety evaluation for the Kemmerer Unit 1 construction permit, hearing exhibit NRC-003A", kind: "doc", sizeLabel: "NRC ADAMS", uploadedLabel: "ML26026A333", extracted: "The staff findings on the LBE set, the BDBE floor, the plant totals and the consequence data", linked: 6, url: "https://www.nrc.gov/docs/ML2602/ML26026A333.pdf" },
    { id: "RI-PUB-DOC-04", name: "ACRS letter report on the Kemmerer Unit 1 construction permit", kind: "doc", sizeLabel: "NRC ADAMS", uploadedLabel: "ML25311A150", extracted: "The OQE criteria and the need to quantify uncertainties and margins at the OL stage", linked: 2, url: "https://www.nrc.gov/docs/ML2531/ML25311A150.pdf" },
    { id: "RI-PUB-DOC-05", name: "Risk-Informed Performance-Based Technology Inclusive Guidance for Non-Light Water Reactor Licensing Basis Development", kind: "doc", sizeLabel: "NEI", uploadedLabel: "NEI 18-04 Rev. 1", extracted: "The F-C target, the category bands, the LBE risk significance test and the cumulative targets", linked: 5 },
    { id: "RI-PUB-DOC-06", name: "Guidance for a Technology-Inclusive, Risk-Informed and Performance-Based Methodology", kind: "doc", sizeLabel: "NRC", uploadedLabel: "Regulatory Guide 1.233", extracted: "The 95th percentile frequency that sets the lower bound of the BDBEs", linked: 3 },
  ],
};

import {
  type EventSequenceQuantification,
  type EventSequenceFamilyQuantification,
  type ModelIntegration,
  type QuantificationMethods,
  type CircularLogicResolution,
  type MutuallyExclusiveEventRule,
  type FlagEventSetting,
  type ModuleUsageRecord,
  type MultiHfeCutsetIdentification,
  type HfeDependencyApplication,
  type LinkingTransferRecord,
  type PhenomenaDependencyAssessment,
  type RadionuclideBarrierQuantification,
  type PostReleaseHfeTreatment,
  type EquipmentSurvivabilityAssessment,
  type CutsetLogicReviewRecord,
  type ConsistencyReviewRecord,
  type RuleLogicReviewRecord,
  type SimilarPlantComparison,
  type NonSignificantSampleReview,
  type RiskSignificantContributor,
  type ImportanceAnalysisRecord,
  type ImportanceReviewRecord,
  type ModelUncertaintySourceAssessment,
  type UncertaintyPropagation,
  type DependencyTreatment,
  type EsqBarrierWork,
  type EsqDocumentation,
  type EsqHandoffWork,
  type EsqLogic,
  type EsqModelDecisions,
  type EsqPostWork,
  type EsqRegisterDecision,
  type EsqReviewWork,
  type EsqSensitivityWork,
  type EsqUncertaintyWork,
  DependencyType,
  TruncationMethod,
  QuantificationApproach,
  RiskSignificantContributorType,
  ESQ_SR_CATALOG,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { registerEntryId } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import { esqRecoveryEventId } from "interfaces-mef-types/esq/esq-post-inputs";
import {
  createExampleDependencyNetwork,
  createExampleHclConfiguration,
} from "./dependency-model-seed";
import { SY_ANALYSIS_HTGR } from "./sy-seed-htgr";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-06-09T12:00:00.000Z";
const CREATED = "2026-06-04T09:00:00.000Z";
const DA_LINK = "example-da-htgr";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(4) as HlrId }));
}

const WARN_SRS = new Set<string>(["ESQ-A1", "ESQ-C4", "ESQ-D7"]);

const SR_EVIDENCE: Record<string, string> = {
  "ESQ-A1": "Six hundred twenty delineated sequences carried into six family quantifications across the five end-state families, with the cross-source grouping of the moisture-ingress family still under review.",
  "ESQ-A2": "The sequences, system logic, data and human reliability are integrated across three sources, twenty-one groups and nine states.",
  "ESQ-A4": "Each family carries a quantified frequency with its percentiles.",
  "ESQ-A5": "The risk-significant families carry means propagated with the state-of-knowledge correlation.",
  "ESQ-B1": "Two codes demonstrated against accepted algorithms, with the limitations identified.",
  "ESQ-B3": "The truncation limit is set by an iterative convergence demonstration down to 1E-13 per year.",
  "ESQ-B4": "Families are solved by the minimal cutset upper bound, with the rare-event approximation not relied on for the risk-significant families.",
  "ESQ-B7": "Two mutually exclusive combinations are identified and corrected.",
  "ESQ-B9": "Three logic flags are set to true or false before cutset generation.",
  "ESQ-C4": "The instrument-cabinet independence assumption still needs the separation distance and the thermal basis shown.",
  "ESQ-C10": "Three barriers are evaluated for their gross and localized failure modes.",
  "ESQ-D6": "Five risk-significant contributors are identified using the risk-integration criteria.",
  "ESQ-D7": "The room-cooling ranking is traced to the shared cooling dependency and the reconciliation is being recorded.",
  "ESQ-D8": "The cumulative effect of the screened-out initiating events stays below the significance threshold.",
  "ESQ-E1": "Eight element uncertainty streams are assessed for their effect on the family frequencies.",
  "ESQ-E2": "The family-frequency uncertainty is propagated with the state-of-knowledge correlation accounted for.",
  "ESQ-F5": "The pre-operational assumptions are documented against the dependency and documentation requirements.",
};

function pathForHlr(hlr: HlrId): string {
  if (hlr === "A") return "familyQuantifications";
  if (hlr === "B") return "quantificationMethods";
  if (hlr === "C") return "barrierQuantifications";
  if (hlr === "D") return "riskSignificantContributors";
  if (hlr === "E") return "uncertaintyPropagation";
  return "documentation";
}

const conformanceMatrix: SRConformance[] = Object.keys(ESQ_SR_CATALOG).flatMap((code) => {
  const meta = ESQ_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const stages: PlantStage[] = meta.stages;
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the event sequence quantification.";
  const hlr = meta.hlr;
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr,
    capabilityCategory,
    applicableToStage: stages,
    status,
    satisfiedByElementPaths: [pathForHlr(hlr)],
    evidence,
  }));
});

const familyQuantifications: EventSequenceFamilyQuantification[] = [
  {
    uuid: "EFQ-1",
    name: "Pressurized loss of forced cooling",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped across the at-power and reduced-power states, since the pressurized loss-of-forced-cooling response is the same.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "The headline family, the pressurized loss-of-forced-cooling sequences where active shutdown cooling is lost and the passive cavity cooling is the backstop. The Event Sequence screening sum for ESF-LATE is 4.3e-5 per year across the family, and the refined means carry the quantified recovery and human-error credit the screening does not.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 3.2e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.6e-7, errorFactor: 3 },
    percentile05: 8.7e-8,
    percentile50: 2.6e-7,
    percentile95: 7.8e-7,
    significantUncertaintySources: ["Shutdown-cooling train common-cause parameter (CCF-SCS-TRAIN)", "Borrowed gas-cooled population prior (Data Analysis GS-2)"],
    contributionBreakdown: [
      { contributorRef: "Shutdown-cooling train common-cause failure (CCF-SCS-TRAIN)", contributorType: "CCF", fractionalContribution: 0.41 },
      { contributorRef: "Cavity-cooling duct group common-cause failure (CCF-RCCS-DUCT)", contributorType: "CCF", fractionalContribution: 0.27 },
      { contributorRef: "Operator fails to start the second shutdown-cooling train (HR-POST-018)", contributorType: "HUMAN_FAILURE_EVENT", fractionalContribution: 0.18 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.14 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "EFQ-2",
    name: "Depressurized loss of forced cooling",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped within the at-power state only, so no cross-state grouping is taken.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A depressurized loss-of-forced-cooling family where a helium-boundary breach removes the pressurized margin and the passive conduction cooldown carries the core, inside the ESF-LATE screening envelope of 4.3e-5 per year.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 1.1e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 8.8e-8, errorFactor: 3 },
    percentile05: 2.9e-8,
    percentile50: 8.8e-8,
    percentile95: 2.6e-7,
    significantUncertaintySources: ["Helium-boundary isolation reliability (HPI-VA-FC)"],
    contributionBreakdown: [
      { contributorRef: "Helium boundary isolation common-cause failure (CCF-HPBI-VLV)", contributorType: "CCF", fractionalContribution: 0.38 },
      { contributorRef: "Cavity-cooling duct group common-cause failure (CCF-RCCS-DUCT)", contributorType: "CCF", fractionalContribution: 0.34 },
      { contributorRef: "Loss of helium inventory and pressure control (IE-40)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.2 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.08 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "EFQ-3",
    name: "Helium boundary leak, filtered leakage",
    eventSequenceFamilyRef: "ESF-LEAK",
    crossPosGroupingJustification: "Grouped within the at-power state only.",
    crossSourceGroupingJustification: "Grouped across the primary-circuit plateout and the circulating coolant-activity sources, with the grouping justified by the shared building-filtration response. The cross-source grouping justification is under review.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A boundary-leak family where a helium-boundary or configuration fault releases circulating activity into the reactor building, which holds and filters it. Refined from the ESF-LEAK screening sum of 1.1e-3 per year by the isolation and filtration credit the screening carries at bounding values.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 3.3e-5,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.3e-5, errorFactor: 4 },
    percentile05: 5.8e-6,
    percentile50: 2.3e-5,
    percentile95: 9.2e-5,
    significantUncertaintySources: ["Helium-boundary isolation reliability (HPI-VA-FC)", "Building filtration reliability (RB-FLT-FR)"],
    contributionBreakdown: [
      { contributorRef: "Loss of helium inventory and pressure control (IE-40)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.45 },
      { contributorRef: "Helium boundary isolation common-cause failure (CCF-HPBI-VLV)", contributorType: "CCF", fractionalContribution: 0.3 },
      { contributorRef: "Depressurization detection common-cause failure (CCF-DET-PCH)", contributorType: "CCF", fractionalContribution: 0.19 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.06 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
  },
  {
    uuid: "EFQ-4",
    name: "Loss of offsite power with cooling challenge",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped across the at-power and the hot-standby states, since the response is the same.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A station-blackout family driven by the backup gas-turbine generator and battery availability and the recovery timing, inside the ESF-LATE screening envelope of 4.3e-5 per year.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 2.4e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 1.9e-7, errorFactor: 3 },
    percentile05: 6.3e-8,
    percentile50: 1.9e-7,
    percentile95: 5.7e-7,
    significantUncertaintySources: ["Backup generator common-cause parameter (CCF-AC-GTG)", "Station battery common-cause parameter (CCF-DC-BATT)"],
    contributionBreakdown: [
      { contributorRef: "Backup gas-turbine generator common-cause failure (CCF-AC-GTG)", contributorType: "CCF", fractionalContribution: 0.36 },
      { contributorRef: "Station battery common-cause failure (CCF-DC-BATT)", contributorType: "CCF", fractionalContribution: 0.29 },
      { contributorRef: "Loss of offsite power (IE-06)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.22 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.13 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "EFQ-5",
    name: "Reactivity insertion transient",
    eventSequenceFamilyRef: "ESF-ATWS",
    crossPosGroupingJustification: "Grouped within the at-power state only.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A non-risk-significant family carried as a point estimate, as ESQ-A5 permits for non-significant families at CC-II. The Event Sequence family carries a provisional 9.0e-8 per year pending this quantification, which supersedes it.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 4.5e-8,
    contributionBreakdown: [
      { contributorRef: "Reactor trip divisions fail (CCF-RPS-DIV)", contributorType: "CCF", fractionalContribution: 0.52 },
      { contributorRef: "Control rods fail to insert (CCF-RPS-ROD)", contributorType: "CCF", fractionalContribution: 0.33 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.15 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
  },
  {
    uuid: "EFQ-6",
    name: "Building isolation failure, early release",
    eventSequenceFamilyRef: "ESF-EARLY",
    crossPosGroupingJustification: "Grouped across the shutdown-configuration states where the building boundary is most challenged.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "The early-release family, where forced cooling and the building isolation both fail and a graphite-oxidation chimney can open. Refined from the ESF-EARLY screening sum of 1.1e-5 per year by the building-isolation and filtration credit the screening carries at bounding values.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 5.2e-8,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 3.2e-8, errorFactor: 5 },
    percentile05: 6.4e-9,
    percentile50: 3.2e-8,
    percentile95: 1.6e-7,
    significantUncertaintySources: ["Building damper common-cause parameter (CCF-RB-DMP)", "Functional-containment capacity (BAR-3)"],
    contributionBreakdown: [
      { contributorRef: "Building isolation damper common-cause failure (CCF-RB-DMP)", contributorType: "CCF", fractionalContribution: 0.34 },
      { contributorRef: "Operator fails to start the standby filtration train (HR-POST-028)", contributorType: "HUMAN_FAILURE_EVENT", fractionalContribution: 0.22 },
      { contributorRef: "Cavity-cooling duct group common-cause failure (CCF-RCCS-DUCT)", contributorType: "CCF", fractionalContribution: 0.19 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.25 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
];

const modelIntegration: ModelIntegration = {
  integrationMethod: "Linked fault-tree and event-tree quantification across the operating states.",
  softwareTools: ["Cutset quantification code", "Uncertainty propagation code"],
  integrationSteps: [
    "Substitute the system fault trees for each event-tree branch question.",
    "Bind the basic-event parameters and the common-cause parameters from the data analysis.",
    "Apply the human error probabilities and the joint-dependency rules at the sequence leaves.",
    "Weight the linked model by the initiating-event group frequencies per operating state.",
  ],
  integrationVerification: "The integrated model is checked against the sequence delineation and the system models before quantification.",
  scopeCoverage: {
    radionuclideSources: ["In-core TRISO fuel", "Primary circuit plateout", "In-core TRISO fuel (decay)", "Primary helium (vented)", "Spent fuel blocks in transfer"],
    initiatingEventGroups: ["IEG-01", "IEG-02", "IEG-03", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13", "IEG-14", "IEG-15", "IEG-16", "IEG-17", "IEG-18", "IEG-19", "IEG-20", "IEG-21"],
    hazardGroups: ["Internal events"],
    plantOperatingStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
    plantEvolutions: ["EV-01", "EV-02", "EV-03", "EV-04", "EV-05"],
  },
  scopeExclusions: [
    { aspect: "HAZARD_GROUP", item: "Internal floods", reason: "Quantified in the internal flood PRA workbook." },
    { aspect: "HAZARD_GROUP", item: "Internal fires", reason: "Quantified in the internal fire PRA workbook." },
    { aspect: "HAZARD_GROUP", item: "Seismic events", reason: "Quantified in the seismic PRA workbook." },
    { aspect: "HAZARD_GROUP", item: "High winds", reason: "Quantified in the high winds PRA workbook." },
    { aspect: "HAZARD_GROUP", item: "External floods", reason: "Quantified in the external flood PRA workbook." },
    { aspect: "HAZARD_GROUP", item: "Other internal and external hazards", reason: "Screened in the hazards screening analysis, with the rest quantified in the other hazards PRA workbook." },
    { aspect: "INITIATOR_GROUP", item: "IEG-DEPENDENCY-DEMO", reason: "Initiator of the protection dependency demonstration tree in ES, not a plant initiator." },
  ],
  systemDependenciesAccounted: true,
  multiReactorSequencesIncluded: false,
  multiReactorInclusionBasis: "Single-unit site, so multi-reactor sequences are not in scope per ES-A9.",
  implementsSrs: srs("ESQ-A2"),
};

const quantificationMethods: QuantificationMethods = {
  approach: QuantificationApproach.FAULT_TREE_LINKING,
  methodDiscriminationJustification: "The linked fault-tree quantification discriminates the risk-significant contributors at the basic-event level.",
  cutsetSolutionMethod: "MCUB",
  computerCodes: [
    {
      name: "Cutset quantification code",
      version: "2.4",
      verificationDocumentation: "Verified against the accepted minimal-cutset algorithm on a reference model.",
      validationDocumentation: "Validated on the benchmark sequence set with known results (ESQ-DOC-03).",
      benchmarkComparison: "Benchmarked against the accepted minimal-cutset algorithm on a reference model.",
      methodSpecificLimitations: [
        "The rare-event approximation is available but is not used for risk-significant families.",
        "Cutset merging requires a confirming truncation pass.",
      ],
      methodSpecificFeatures: ["Solves the linked logic into cutsets and family frequencies"],
      implementsSrs: srs("ESQ-B1"),
    },
    {
      name: "Uncertainty propagation code",
      version: "1.8",
      verificationDocumentation: "Verified against an analytic lognormal product on a reference case.",
      validationDocumentation: "Validated against the analytic percentiles of the reference case.",
      benchmarkComparison: "Benchmarked against an analytic lognormal product on a reference case.",
      methodSpecificLimitations: ["The correlation between shared estimates is handled by a common random seed."],
      methodSpecificFeatures: ["Propagates the parameter distributions into the family-frequency distribution"],
      implementsSrs: srs("ESQ-B1"),
    },
  ],
  truncation: {
    truncationMethod: TruncationMethod.ABSOLUTE_FREQUENCY,
    finalTruncationValue: 1e-13,
    truncationProgression: [1e-9, 1e-10, 1e-11, 1e-12, 1e-13],
    frequencyAtTruncation: { 1e-9: 2.71e-7, 1e-10: 3.05e-7, 1e-11: 3.18e-7, 1e-12: 3.22e-7, 1e-13: 3.23e-7 },
    percentageChangeAtTruncation: { 1e-10: 12.5, 1e-11: 4.3, 1e-12: 1.3, 1e-13: 0.3 },
    basisForSelection: "The cutoff is lowered until the tracked family frequency changes by less than half a percent between successive cutoffs.",
    convergenceDemonstration: "The pressurized loss-of-forced-cooling family frequency settles at 3.23E-7 per year at a cutoff of 1E-13 per year.",
    dependenciesPreservedAtTruncation: true,
    mergedCutsetTruncationConfirmed: true,
    mergedCutsetConfirmationBasis: "The system-level cutsets are re-confirmed after merging to the sequence level.",
    truncationSensitivity: "The family frequencies hold within a few percent below the chosen cutoff.",
    demonstratedFamilyRef: "EFQ-1",
    implementsSrs: srs("ESQ-B2", "ESQ-B3"),
  },
  postInitiatorHfeHandling: "The post-initiator human failure events are carried into the cutsets with their joint-dependency rules applied.",
  implementsSrs: srs("ESQ-A6", "ESQ-B4"),
};

const dependencyTreatment: DependencyTreatment = {
  dependenciesByType: [
    { type: DependencyType.FUNCTIONAL, treatmentDescription: "Support-system dependencies are carried explicitly in the linked logic.", modelingMethod: "Shared fault-tree logic with explicit support gates.", examples: ["Cooling-water support of the shutdown-cooling trains"] },
    { type: DependencyType.HUMAN, treatmentDescription: "Multiple human failure events in one cutset are assessed for their joint dependency.", modelingMethod: "Joint human error probabilities per the human reliability assessments.", examples: ["The shutdown-cooling start, isolation and recovery actions"] },
    { type: DependencyType.PHENOMENOLOGICAL, treatmentDescription: "Phenomenological dependencies on credited equipment are assessed, with independence justified.", modelingMethod: "Phenomena logic included in the family models.", examples: ["Graphite-oxidation heat against the cavity that houses the passive cooling path"] },
    { type: DependencyType.COMMON_CAUSE, treatmentDescription: "Common-cause failures are modeled with the parameters supplied by the data analysis.", modelingMethod: "Common-cause basic events inside the system logic.", examples: ["The four-group cavity-cooling common-cause group"] },
  ],
  postInitiatorHfeDependencyMethod: "The joint dependency of co-occurring human failure events is assessed per the human reliability requirements.",
  postInitiatorHfeDependencyBasis: "The joint-HEP floor built in the human reliability analysis binds the product at the cutset level.",
  ccfTreatment: {
    modelingApproach: "Common-cause basic events carried inside the system fault trees.",
    parameterBasis: "The alpha-factor and MGL parameters supplied by the data analysis.",
    ccfGroupRefs: ["CCF-SCS-TRAIN", "CCF-DC-BATT"],
  },
  recoveryDependencyTreatment: "Recovery actions are applied with their dependence on the cause carried explicitly.",
  implementsSrs: srs("ESQ-C1", "ESQ-C2"),
};

const circularLogicResolutions: CircularLogicResolution[] = [];

const mutuallyExclusiveEventRules: MutuallyExclusiveEventRule[] = [
  {
    uuid: "MX-1",
    description: "Two cavity-cooling duct groups in staggered surveillance at once",
    eventIds: ["HE-RCC-DUCT1-MAINT", "HE-RCC-DUCT2-MAINT"],
    basis: "The surveillance plan staggers the duct groups so two are never out together.",
    identifiedInResults: true,
    treatment: "LOGIC_ELIMINATION",
    implementsSrs: srs("ESQ-B7", "ESQ-B8"),
  },
  {
    uuid: "MX-2",
    description: "Refueling alignment with at-power initiator",
    eventIds: ["HE-REFUEL", "IE-14"],
    basis: "The refuelling alignment cannot coexist with the at-power circulator-trip initiator.",
    identifiedInResults: true,
    treatment: "CUTSET_DELETION",
    implementsSrs: srs("ESQ-B7", "ESQ-B8"),
  },
];

const flagEventSettings: FlagEventSetting[] = [
  {
    uuid: "FL-1",
    name: "Shutdown-cooling train A maintenance alignment",
    purpose: "Selects the train-A-out configuration for the family",
    state: false,
    effect: "Removes the train-A shutdown-cooling failure logic from this family's model.",
    basis: "The maintenance alignment is a configuration choice, so the flag restructures the logic rather than carrying a probability.",
    isTemporary: false,
    applicableFamilyRefs: ["EFQ-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-2",
    name: "Passive cavity-cooling path",
    purpose: "Enables the passive cavity cooling path credited as the backstop",
    state: true,
    effect: "Includes the passive reactor-cavity cooling path in the family model.",
    basis: "The passive cavity cooling is always aligned, so the flag selects the conduction-cooldown logic per state.",
    isTemporary: false,
    applicableFamilyRefs: ["EFQ-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-3",
    name: "At-power circulator logic",
    purpose: "Selects the at-power forced-circulation logic",
    state: true,
    effect: "Includes the main-circulator forced-flow logic in the at-power model.",
    basis: "The forced circulation applies only at power, so the flag selects the at-power logic.",
    isTemporary: false,
    applicableFamilyRefs: ["EFQ-2"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
];

const moduleUsageRecords: ModuleUsageRecord[] = [
  {
    uuid: "MOD-1",
    moduleType: "MODULE",
    processDescription: "Shared support modules are referenced by name across the sequence models.",
    sharedEventsIdentified: true,
    trueIndependenceVerified: true,
    perEventInterpretabilityMaintained: true,
    implementsSrs: srs("ESQ-B10"),
  },
];

const multiHfeCutsetIdentifications: MultiHfeCutsetIdentification[] = [
  {
    uuid: "MH-1",
    cutsetDescription: "CS-SCS-0142, three human failure events appear together in a loss-of-forced-cooling cutset.",
    hfeRefs: ["HR-POST-018", "HR-POST-020", "REC-1"],
    potentialRiskImpact: "The cutset is risk-significant, so the joint dependency is assessed per HR and the joint floor binds the product.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
  {
    uuid: "MH-2",
    cutsetDescription: "CS-MOIST-0033, two human failure events appear together in a moisture-ingress cutset.",
    hfeRefs: ["HR-POST-022", "HR-POST-032"],
    potentialRiskImpact: "The cutset is risk-significant, and the two actions share the same crew and timeline, so the dependence is not negligible.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
];

const hfeDependencyApplications: HfeDependencyApplication[] = [
  {
    uuid: "HD-1",
    hrDependencyAssessmentRef: "DEP-3",
    cutsetContext: "CS-SCS-0142",
    appliedJointHep: 3.5e-4,
    implementsSrs: srs("ESQ-C2"),
  },
  {
    uuid: "HD-2",
    hrDependencyAssessmentRef: "DEP-5",
    cutsetContext: "CS-MOIST-0033",
    appliedJointHep: 4.5e-4,
    implementsSrs: srs("ESQ-C2"),
  },
];

const linkingTransferRecords: LinkingTransferRecord[] = [
  {
    uuid: "LT-1",
    sourceTreeDescription: "Loss-of-forced-cooling tree",
    targetTreeDescription: "Cavity-cooling tree",
    failedEquipmentTransferred: ["Main circulator A", "Shutdown-cooling train A"],
    flagSettingsTransferred: ["HE-SCS-OUT"],
    otherCharacteristicsTransferred: ["The failed circulator and the shutdown-cooling flag carry into the cavity-cooling tree."],
    frequencyTransferred: true,
    implementsSrs: srs("ESQ-C3"),
  },
  {
    uuid: "LT-2",
    sourceTreeDescription: "Loss-of-offsite-power tree",
    targetTreeDescription: "Station-blackout tree",
    failedEquipmentTransferred: ["Offsite power"],
    flagSettingsTransferred: ["HE-GTG-OUT"],
    otherCharacteristicsTransferred: ["The offsite-power state and the backup generator and battery alignment carry into the blackout tree."],
    frequencyTransferred: true,
    implementsSrs: srs("ESQ-C3"),
  },
];

const phenomenaDependencyAssessments: PhenomenaDependencyAssessment[] = [
  {
    uuid: "PD-1",
    phenomenon: "Graphite oxidation heat and aerosol",
    affectedSscRefs: ["SYS-RCCS", "Cavity liner"],
    dependencyAssessment: "The oxidation heat challenges the same cavity that houses the passive cooling path, so the two are not independent.",
    implementsSrs: srs("ESQ-C4"),
  },
  {
    uuid: "PD-2",
    phenomenon: "Helium depressurization loads",
    affectedSscRefs: ["SYS-HPBI", "Relief line"],
    dependencyAssessment: "The depressurization loads are assessed against the boundary and the relief path.",
    independenceJustifications: ["The instrument cabinet is assumed independent, with the separation distance recorded."],
    implementsSrs: srs("ESQ-C4"),
  },
];

const barrierQuantifications: RadionuclideBarrierQuantification[] = [
  {
    uuid: "BAR-1",
    name: "TRISO-coated fuel particles",
    applicableSourceRefs: ["SRC-H1"],
    failureModes: [
      { failureMode: "Gross coating failure", failureType: "GROSS", mechanisms: ["Kernel migration and coating overtemperature"], probability: 1.0e-3 },
      { failureMode: "Localized particle failure", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Manufacturing defect fraction"], probability: 3.0e-3 },
    ],
    challengingPhenomena: ["Coating overtemperature", "Kernel migration"],
    designSpecificDegradationMechanisms: ["Silicon-carbide thermal degradation"],
    screenedOutMechanisms: [
      { mechanism: "Fast-fluence damage beyond the design limit", criterion: "SCR-3", justification: "Bounded by the fluence limit, so it is screened per SCR-3." },
    ],
    challengeAssessment: {
      basis: "REALISTIC_PLANT_SPECIFIC_CALCULATION",
      challenges: ["Overtemperature transients", "Coating failure fraction at temperature"],
    },
    capacityEvaluation: {
      basis: "REALISTIC",
      description: "The first barrier, evaluated realistically with in-service aging at CC-II.",
      inServiceAgingIncluded: true,
    },
    externalHazardCapacity: [{ hazard: "Seismic", basis: "FRAGILITY_CURVES" }],
    implementsSrs: srs("ESQ-C10", "ESQ-C12", "ESQ-C14"),
  },
  {
    uuid: "BAR-2",
    name: "Primary helium boundary",
    applicableSourceRefs: ["SRC-H1", "SRC-H2"],
    failureModes: [
      { failureMode: "Gross boundary rupture", failureType: "GROSS", mechanisms: ["Vessel overpressure"], probability: 1.0e-5 },
      { failureMode: "Localized penetration leak", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Thermal fatigue at the penetration welds"], probability: 5.0e-4 },
    ],
    challengingPhenomena: ["Vessel overpressure", "Thermal fatigue"],
    designSpecificDegradationMechanisms: ["Thermal fatigue at the penetration welds"],
    challengeAssessment: {
      basis: "REALISTIC_PLANT_SPECIFIC_CALCULATION",
      challenges: ["Overpressure at the relief setpoint", "Thermal fatigue at the hot-duct penetration"],
    },
    capacityEvaluation: {
      basis: "REALISTIC",
      description: "The boundary holds the pressurized margin, so the localized mode dominates the challenge.",
      inServiceAgingIncluded: true,
    },
    externalHazardCapacity: [{ hazard: "Seismic", basis: "FRAGILITY_CURVES" }],
    implementsSrs: srs("ESQ-C10", "ESQ-C12", "ESQ-C13", "ESQ-C14"),
  },
  {
    uuid: "BAR-3",
    name: "Reactor building, functional containment",
    applicableSourceRefs: ["SRC-H1", "SRC-H2", "SRC-H3"],
    failureModes: [
      { failureMode: "Gross confinement bypass", failureType: "GROSS", mechanisms: ["Building overpressure"], probability: 2.0e-4 },
      { failureMode: "Localized penetration leak", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Penetration seal degradation"], probability: 1.0e-3 },
    ],
    challengingPhenomena: ["Building overpressure", "Aerosol loading"],
    designSpecificDegradationMechanisms: ["Penetration seal degradation"],
    screenedOutMechanisms: [
      { mechanism: "Overpressure beyond design", criterion: "SCR-2", justification: "Below the screening frequency, so it is screened per SCR-2." },
    ],
    challengeAssessment: {
      basis: "CONSERVATIVE_GENERIC_ESTIMATE",
      challenges: ["Building pressurization from a graphite-oxidation event"],
    },
    capacityEvaluation: {
      basis: "CONSERVATIVE",
      description: "A functional-containment barrier, carried conservatively while it is not risk-significant.",
    },
    externalHazardCapacity: [{ hazard: "External flood", basis: "ESTIMATED" }],
    implementsSrs: srs("ESQ-C10", "ESQ-C11", "ESQ-C15"),
  },
];

const postReleaseHfeTreatments: PostReleaseHfeTreatment[] = [
  {
    uuid: "PR-1",
    hfeRefs: ["HR-POST-025", "HR-POST-030"],
    treatment: "DETAILED_RISK_SIGNIFICANT",
    basis: "A detailed analysis is performed, since the action affects a risk-significant family.",
    implementsSrs: srs("ESQ-C7"),
  },
  {
    uuid: "PR-2",
    hfeRefs: ["HR-POST-022"],
    treatment: "CONSERVATIVE",
    basis: "A conservative screening value is used, since the action is not risk-significant.",
    implementsSrs: srs("ESQ-C7"),
  },
];

const equipmentSurvivabilityAssessments: EquipmentSurvivabilityAssessment[] = [
  {
    uuid: "SURV-1",
    equipmentRefs: ["Leak-detection cabinet in the affected cell"],
    environmentalConditions: [{ type: "Thermal", severity: "Elevated temperature from the graphite-oxidation reaction" }],
    survivabilityCriteria: "The cabinet stays within its qualification limit under the oxidation environment.",
    assessmentResults: [
      { equipmentRef: "Leak-detection cabinet in the affected cell", survives: true, basis: "A thermal analysis shows the cabinet stays within its limit." },
    ],
    creditTaken: true,
    creditJustification: "A thermal analysis shows the cabinet stays within its limit, so the action is credited at CC-II.",
    requirementsSatisfied: { syA29: true, hrH2: true, esqC2: true, esqC4: true },
    implementsSrs: srs("ESQ-C8", "ESQ-C9"),
  },
];

const phenomenaModelLogic = {
  logicIncluded: true,
  description: "The phenomena model logic is included in the family models.",
  scrubbingEffectsIncluded: true,
  scrubbingJustification: "Aerosol plateout on the primary-circuit surfaces is credited at CC-II with technical justification.",
  beneficialFailuresIncluded: true,
  beneficialFailureJustification: "A beneficial early relief failure is included where omitting it would distort the result.",
  implementsSrs: srs("ESQ-C6"),
};

const cutsetLogicReviews: CutsetLogicReviewRecord[] = [
  {
    uuid: "CR-1",
    sampleDescription: "Top ten risk-significant cutsets in the loss-of-forced-cooling family",
    logicCorrect: true,
    findings: "The cutset logic matches the system models and the dependencies are present.",
    implementsSrs: srs("ESQ-D1"),
  },
  {
    uuid: "CR-2",
    sampleDescription: "Top five cutsets in the station-blackout family",
    logicCorrect: true,
    findings: "The recovery, the backup generator and the station-battery common-cause terms appear as expected.",
    implementsSrs: srs("ESQ-D1"),
  },
];

const nonSignificantSampleReviews: NonSignificantSampleReview[] = [
  {
    uuid: "CR-3",
    sampleDescription: "Sample of low-frequency cutsets across the families",
    physicallyMeaningful: true,
    findings: "The small cutsets are physically meaningful, so nothing small is small for the wrong reason.",
    implementsSrs: srs("ESQ-D5"),
  },
];

const consistencyReviews: ConsistencyReviewRecord[] = [
  {
    uuid: "CON-1",
    modelingConsistencyConfirmed: true,
    modelingFindings: "The results are consistent with the upstream system and sequence models.",
    operationalConsistencyConfirmed: true,
    operationalFindings: "The results match the expected operational response of the plant.",
    implementsSrs: srs("ESQ-D2"),
  },
];

const ruleLogicReviews: RuleLogicReviewRecord[] = [
  {
    uuid: "RUL-1",
    flagSettingsReviewed: true,
    mutuallyExclusiveRulesReviewed: true,
    recoveryRulesReviewed: true,
    logicalResultsConfirmed: true,
    findings: "The flag settings, the mutually exclusive rules and the recovery rules all produce logical results.",
    implementsSrs: srs("ESQ-D3"),
  },
];

const similarPlantComparisons: SimilarPlantComparison[] = [
  {
    uuid: "SIM-1",
    comparisonPlants: ["Reference high-temperature gas reactor PRA"],
    keyDifferences: ["The passive cavity cooling lowers the loss-of-forced-cooling family relative to the reference."],
    differenceCauses: ["The passive RCCS conduction cooldown reduces the dependence on active cooling."],
    implementsSrs: srs("ESQ-D4"),
  },
];

const riskSignificantContributors: RiskSignificantContributor[] = [
  {
    uuid: "RC-1",
    contributorType: RiskSignificantContributorType.CCF,
    entityRef: "Shutdown-cooling train common-cause failure",
    applicableFamilyRefs: ["EFQ-1"],
    fractionalContribution: 0.22,
    riskSignificanceCriteriaBasis: "Above the risk-integration significance threshold.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The common-cause group dominates the loss-of-forced-cooling family.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-2",
    contributorType: RiskSignificantContributorType.EQUIPMENT_FAILURE,
    entityRef: "Loss of cooling-water support",
    applicableFamilyRefs: ["EFQ-1", "EFQ-4"],
    fractionalContribution: 0.15,
    riskSignificanceCriteriaBasis: "Above the threshold across two families.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The shared cooling dependency raises the support system across two families.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-3",
    contributorType: RiskSignificantContributorType.HUMAN_FAILURE_EVENT,
    entityRef: "Operator fails to start the second shutdown-cooling train",
    applicableFamilyRefs: ["EFQ-1"],
    fractionalContribution: 0.12,
    riskSignificanceCriteriaBasis: "Risk-significant human failure event.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The headline response action carries a risk-significant share.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-4",
    contributorType: RiskSignificantContributorType.CCF,
    entityRef: "Backup gas-turbine generator common-cause failure",
    applicableFamilyRefs: ["EFQ-4"],
    fractionalContribution: 0.1,
    riskSignificanceCriteriaBasis: "Drives the station-blackout family.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The backup generator common-cause group drives the blackout family.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-5",
    contributorType: RiskSignificantContributorType.INITIATING_EVENT,
    entityRef: "Loss of helium inventory and pressure control (IE-40)",
    applicableFamilyRefs: ["EFQ-3"],
    fractionalContribution: 0.08,
    riskSignificanceCriteriaBasis: "Risk-significant initiator.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "INITIATING_EVENT_OCCURRENCE",
    basis: "The helium-boundary initiator carries the boundary-leak family.",
    implementsSrs: srs("ESQ-D6"),
  },
];

const importanceAnalyses: ImportanceAnalysisRecord[] = [
  {
    uuid: "IMP-1",
    scope: "OVERALL",
    measures: [
      { entityType: "CCF_GROUP", entityRef: "Shutdown-cooling train common-cause group", fussellVesely: 0.22, riskAchievementWorth: 8.4, dataAnalysisParameterRef: "DA-CCF-08" },
      { entityType: "SYSTEM", entityRef: "Cooling-water support", fussellVesely: 0.15, riskAchievementWorth: 5.1 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts the second shutdown-cooling train", fussellVesely: 0.12, riskAchievementWorth: 4.2 },
      { entityType: "CCF_GROUP", entityRef: "Backup gas-turbine generator common-cause group", fussellVesely: 0.1, riskAchievementWorth: 3.6, dataAnalysisParameterRef: "DA-CCF-06" },
      { entityType: "BASIC_EVENT", entityRef: "Reactor protection channel", fussellVesely: 0.04, riskAchievementWorth: 1.9, dataAnalysisParameterRef: "DA-BE-201" },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
  {
    uuid: "IMP-2",
    scope: "PER_FAMILY",
    familyRef: "EFQ-1",
    measures: [
      { entityType: "CCF_GROUP", entityRef: "Shutdown-cooling train common-cause group", fussellVesely: 0.41, riskAchievementWorth: 12.5, dataAnalysisParameterRef: "DA-CCF-08" },
      { entityType: "SYSTEM", entityRef: "Cooling-water support", fussellVesely: 0.27, riskAchievementWorth: 6.8 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts the second shutdown-cooling train", fussellVesely: 0.18, riskAchievementWorth: 4.4 },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
];

const importanceReviews: ImportanceReviewRecord[] = [
  {
    uuid: "IMPR-1",
    scope: "Overall importance results",
    riCriteriaBasis: "The importance results are reviewed against the risk-integration criteria.",
    consistentWithExpectations: false,
    unexpectedResults: [
      {
        entityRef: "Cooling-water support",
        description: "The support system ranks higher than expected.",
        reconciliation: "The ranking is traced to the shared cooling dependency, which is correct and is retained.",
      },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
];

const screenedEventCumulativeAssessment = {
  screenedInitiatingEventRefs: ["IE-35"],
  cumulativeImpactAssessment: "The combined contribution of the screened-out initiating events stays well below the significance threshold.",
  affectsRiskSignificantContributors: false,
  basis: "Each screened initiator is bounded, and their sum does not change the risk-significant contributors.",
  implementsSrs: srs("ESQ-D8"),
};

const modelUncertaintySourceAssessments: ModelUncertaintySourceAssessment[] = [
  { uuid: "UF-1", sourceElementCode: "POS", uncertaintySource: "Operating-state time fractions", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Shifts the weighting between the states.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-2", sourceElementCode: "IE", uncertaintySource: "Initiating-event group frequencies", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Scales the family frequencies directly.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-3", sourceElementCode: "ES", uncertaintySource: "Sequence timing and end-state binning", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Affects which family a borderline sequence joins.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-4", sourceElementCode: "SC", uncertaintySource: "Success-criteria margins", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Affects the branch outcomes near the threshold.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-5", sourceElementCode: "SY", uncertaintySource: "System-logic completeness", relatedAssumptions: [], evaluationType: "QUALITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Affects the cutset structure.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-6", sourceElementCode: "HR", uncertaintySource: "Human-error probabilities", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Drives the human-action cutsets.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-7", sourceElementCode: "DA", uncertaintySource: "Parameter distributions", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Sets the spread of the family-frequency distribution.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-8", sourceElementCode: "ESQ", uncertaintySource: "Truncation and approximation", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Bounds the residual computational error.", implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-9", sourceElementCode: "DA", uncertaintySource: "Similar-equipment adjustment for the moisture monitors", relatedAssumptions: ["Nonnuclear moisture analyzers fail like the helium moisture monitors once the sampling factor is applied."], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "The monitors take nonnuclear moisture-analyzer data adjusted for sampling helium at pressure. Over the factor's range the monitor probability runs from 1.80E-3 to 1.08E-2.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-1" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-10", sourceElementCode: "DA", uncertaintySource: "Fort St. Vrain circulator incidents and the circulator prior", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Two of fifteen incidents count. Counting every removal would raise the circulator rate about six times, and the published compressor prior would raise it 9.2 times.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-2" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-11", sourceElementCode: "DA", uncertaintySource: "Planned demand, exposure and maintenance counts", relatedAssumptions: ["The planned surveillance and maintenance schedule stands in for operating records."], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Demands, run hours and maintenance hours come from the planned schedule until operating records exist. Each train unavailability moves in proportion to its maintenance hours.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-3" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-12", sourceElementCode: "DA", uncertaintySource: "Coincident-maintenance assumption", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "The joint equalizing charge takes both battery banks out together for 22 h a year. The value is assumed until plant experience confirms it.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-4" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-13", sourceElementCode: "DA", uncertaintySource: "Initiating-event frequencies for a design with no operating history", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Twenty-one group frequencies rest on IE fault trees, generic data and design-based estimates. At the 2020 industry rates loss of offsite power would drop 2.8 times.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-5" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-14", sourceElementCode: "DA", uncertaintySource: "Common cause factors from the CCF 2020 data", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Each group takes generic factors for its size, and its testing scheme decides what Systems Analysis receives. Testing the shutdown-cooling trains on one day would make both failing together 2.0 times more likely.", dataAnalysisSourceRef: { workbookId: "example-da-htgr", sourceId: "MU-6" }, implementsSrs: srs("ESQ-E1") },
];

const uncertaintyPropagation: UncertaintyPropagation = {
  uuid: "esq-up-1",
  propagationMethod: "MONTE_CARLO",
  numberOfSamples: 100000,
  modelUncertainties: [
    { uncertaintyId: "MU-1", description: "Graphite-oxidation phenomena model", impact: "Carried as an uncertainty source and tested by sensitivity.", isQuantified: false, treatmentApproach: "Sensitivity study across the phenomena range." },
    { uncertaintyId: "MU-2", description: "Cavity-cooling duct blockage mode", impact: "Bounded by a conservative capacity until the design is confirmed.", isQuantified: false, treatmentApproach: "Conservative bound carried until the as-built confirmation." },
    { uncertaintyId: "MU-3", description: "State-of-knowledge correlation handling", impact: "Handled by a common random seed, with the impact assessed.", isQuantified: true, treatmentApproach: "Common random seed across shared estimates." },
  ],
  characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT_SOKC",
  parameterUncertainties: [
    { parameterRef: "DA-BE-205", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-205" } }, basis: "The risk-significant shutdown-cooling circulator parameter from the data analysis (DA-BE-205)." },
    { parameterRef: "DA-BE-241", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-241" } }, basis: "The battery-train run parameter from the data analysis (DA-BE-241)." },
    { parameterRef: "DA-BE-201", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-201" } }, basis: "The protection division parameter from the data analysis (DA-BE-201)." },
  ],
  stateOfKnowledgeCorrelation: {
    isConsidered: true,
    handlingMethod: "SAME_RANDOM_SEED",
    handlingDescription: "Shared estimates are sampled with a common random seed, so their uncertainty stays correlated.",
    correlatedParameterGroups: [
      ["SCS-TRA-FR", "SCS-TRB-FR"],
      ["DC-BAT-A-FR", "DC-BAT-B-FR"],
    ],
    impactAssessment: "Ignoring the correlation would understate the loss-of-forced-cooling mean by about a third.",
  },
  implementsSrs: srs("ESQ-E2"),
};

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "Truncation sensitivity", description: "Sweep of the truncation cutoff below the chosen value.", variedParameters: ["Truncation cutoff"], parameterRanges: { "Truncation cutoff": [1e-14, 1e-12] }, results: "The family frequencies hold within a few percent below the chosen cutoff." },
  { uuid: "SS-2", name: "State-of-knowledge correlation sweep", description: "Sweep of the correlation handling between shared estimates.", variedParameters: ["Correlation"], parameterRanges: { Correlation: [0, 1] }, results: "Ignoring the correlation would understate the loss-of-forced-cooling mean by about a third." },
  { uuid: "SS-3", name: "Barrier-capacity sweep", description: "Sweep of the functional-containment capacity range.", variedParameters: ["Capacity factor"], parameterRanges: { "Capacity factor": [0.5, 2] }, results: "The early-release family stays below the threshold across the capacity range." },
  { uuid: "DA-SS-1", name: "Similar-equipment sweep", description: "The moisture monitors rest on nonnuclear moisture analyzers. Their sampling factor goes to its bounds of 0.5 and 3.", variedParameters: ["DA-BE-249"], parameterRanges: { "DA-BE-249": [0.001799877471427639, 0.010739690083886403] }, results: "The monitor probability runs from 1.80E-3 to 1.07E-2 per demand, against 3.60E-3 for the nominal factor.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-1" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-2", name: "Prior-form comparison", description: "The circulator update repeated with the published compressor prior in place of the constrained noninformative one.", variedParameters: ["DA-BE-205"], parameterRanges: { "DA-BE-205": [0.00023233029579251133, 0.002134622783285125] }, results: "With the published prior the 24 h circulator probability is 2.13E-3, 9.2 times the 2.32E-4 of the base case. The published prior conflicts with the Fort St. Vrain counts, so it stays a sensitivity case.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-2" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-3", name: "Train maintenance sweep", description: "Shutdown-cooling train maintenance between half and twice the planned 35 h a year.", variedParameters: ["DA-UA-11"], parameterRanges: { "DA-UA-11": [0.001997716894977169, 0.007990867579908675] }, results: "The train unavailability runs from 2.00E-3 to 7.99E-3, against 4.00E-3 for the plan.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-3" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-4", name: "Coincident-maintenance sweep", description: "The joint battery equalization unavailability from none to 5.0E-3.", variedParameters: ["DA-UA-16"], parameterRanges: { "DA-UA-16": [0, 0.005] }, results: "The planned joint charge gives 2.51E-3, inside the swept range.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-4" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-5", name: "Offsite power at the 2020 rates", description: "Loss of offsite power at the 2020 industry rates, power and shutdown, against the IE group that also holds loss of normal AC.", variedParameters: ["DA-IE-03"], parameterRanges: { "DA-IE-03": [0.034228276390151025, 0.0975] }, results: "The 2020 rates give 3.42E-2 per year over the group's states, 2.8 times below the IE group frequency of 9.75E-2.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-5" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-6", name: "Shutdown-cooling testing scheme", description: "The two shutdown-cooling trains tested on one day instead of staggered.", variedParameters: ["DA-CCF-08"], parameterRanges: { "DA-CCF-08": [0.0000016882749759740017, 0.0000033521905826454723] }, results: "Both trains failing together rises from 1.69E-6 to 3.35E-6, 2.0 times the staggered value.", dataAnalysisCaseRef: { workbookId: "example-da-htgr", caseId: "SS-6" }, implementsSrs: srs("ESQ-E2") },
];

const preOperationalAssumptions = [
  { id: "PA-1", area: "Dependencies", desc: "Phenomenological dependencies rest on design analyses, to confirm against the as-built plant.", path: "phenomenaDependencyAssessments" },
  { id: "PA-2", area: "Barriers", desc: "Barrier capacities use design values, to replace with as-built confirmation.", path: "barrierQuantifications" },
  { id: "PA-3", area: "Documentation", desc: "The quantification rests on inherited pre-operational parameters, recorded as limitations.", path: "documentation" },
].map((a) => ({
  uuid: a.id,
  assumptionId: a.id,
  description: a.desc,
  influenceOnDefinition: a.area,
  status: "OPEN" as const,
  limitations: ["Pre-operational, pending as-built and as-operated confirmation."],
  riskImpact: ImportanceLevel.MEDIUM,
  closureBasis: "Confirm against the operating plant.",
  plannedClosureActions: ["Re-check at the operating stage."],
  affectedElementIds: [a.path],
}));

const documentation: EsqDocumentation = {
  processDescription: "The event sequences, system models, data and human reliability are integrated and quantified into the frequencies of event-sequence families, per ASME/ANS RA-S-1.4 HLR-ESQ-A through F.",
  inputsDescription: "The quantification consumes the sequence topology from ES, the system logic from SY, the human failure events from HR, the parameters from DA, the frequencies from IE and the success criteria from SC, weighted across the POS states.",
  appliedMethods: "Linked fault-tree quantification with a minimal cutset upper bound solution, exact spot checks and Monte Carlo uncertainty propagation, each one accepted way to do its sub-task.",
  resultsSummary: "Five event-sequence families are quantified, four of them risk-significant, with the pressurized loss-of-forced-cooling family at 3.2E-7 per year.",
  nonRecoveryTermsProcess: "Recovery actions are applied at the family and cutset level per the human reliability requirements, with their dependence carried explicitly.",
  cutsetReviewProcess: "The risk-significant cutsets are sampled and checked for correct logic, and a sample of the small cutsets is checked for physical meaning.",
  quantificationProcessDescription: "The linked model is solved into cutsets and family frequencies, with the flags set before generation and the mutually exclusive combinations corrected.",
  truncationConvergenceProcess: "The truncation limit is set by an iterative convergence demonstration, lowering the cutoff until the family frequency changes by less than half a percent.",
  familyFrequenciesAndContributions: "Each family carries its mean frequency, its percentiles and its contribution breakdown by contributor type.",
  aggregationDisaggregationInsights: "The family results disaggregate by operating state, initiating-event group and contributor, so the aggregation does not mask a contributor.",
  sequenceBinningMethod: "Sequences are grouped into families with like end states and like dependencies, with cross-state and cross-source grouping justified.",
  intermediateStateDependencyTreatment: "On each transfer to a downstream tree, the failed equipment and the flag settings travel with the handoff, not only the frequency.",
  nonSignificanceDrivingFactors: "The non-significant families are traced to their driving factors, so nothing small is small for the wrong reason.",
  releaseCategoryResolutionInputs: "The plant damage states and the release-category resolution behind each family are recorded for the source term.",
  barrierChallengeTreatment: "Each barrier is evaluated for its gross and localized failure modes and its challenging phenomena, with screening justified.",
  barrierCapacityBasis: "Barrier capacity is evaluated conservatively at CC-I or realistically with in-service aging at CC-II, with external-hazard capacity by fragility curves where required and the design capacities from the plant hazard summary (ESQ-DOC-04).",
  uncertaintySensitivityResults: "The family-frequency uncertainty is propagated with the state-of-knowledge correlation accounted for, and the sensitivity studies bound the open questions.",
  importanceResults: "The importance measures are read at the model's level of detail against the reference plant ranking (ESQ-DOC-01), and the one unexpected ranking is reconciled rather than rationalized.",
  mutuallyExclusiveEventsEliminated: "Cutsets containing events that cannot coexist are identified and corrected by logic or by deletion.",
  modelingAsymmetries: "Asymmetries between the trains and the states are carried by the flag settings, so the per-configuration models stay honest.",
  codeVerificationProcess: "The quantification codes are demonstrated against accepted algorithms, with the method-specific limitations identified.",
  undocumentedParameterEstimatesBasis: "Every parameter estimate used by the quantification traces to the data analysis, so no undocumented estimate enters the model.",
  pdsPreservationApproach: "The plant damage state attributes are preserved through the family grouping, so the source-term resolution stays possible.",
  scopeAssumptionDrivenContributors: "The contributors that rest on scope assumptions are flagged, so an assumption-driven ranking is visible.",
  similarPlantComparison: "The results are compared to the reference high-temperature gas reactor PRA (ESQ-DOC-01), and the differences are explained by the passive cavity-cooling path.",
  riskSignificantContributorsDocumentation: "The risk-significant contributors are identified using the risk-integration criteria, with the single-reactor scope noted.",
  uncertaintySourcesDocumentation: "The model-uncertainty sources from every technical element are assessed at the quantification, qualitatively or quantitatively.",
  limitationsForApplications: "The limitations that would affect applications are recorded, including the conservative functional-containment capacity.",
  asBuiltLimitations: "Pre-operational: the quantification rests on inherited pre-operational parameters and design analyses pending as-built confirmation.",
  praTaskInterfaces: "ESQ takes the operating states from POS and the work of IE, ES, SC, SY, HR and DA, and delivers the family frequencies to Risk Integration and the release inputs to the Mechanistic Source Term, with a risk-significance feedback loop to every input. The family means carry the quantified human-error and recovery credit the Event Sequence screening sums do not.",
  implementsSrs: srs("ESQ-F1", "ESQ-F2", "ESQ-F3", "ESQ-F4", "ESQ-F5"),
};


function syEventId(code: string): string {
  const event = SY_ANALYSIS_HTGR.systemBasicEvents.find((candidate) => candidate.code === code);
  if (event === undefined) throw new Error(`The SY example has no event ${code}.`);
  return event.uuid;
}

function syGate(systemId: string, code: string): { modelId: string; id: string } {
  const model = SY_ANALYSIS_HTGR.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  const gate = model?.gates.find((candidate) => candidate.code === code);
  if (model === undefined || gate === undefined) throw new Error(`The SY example has no gate ${code} in ${systemId}.`);
  return { modelId: model.uuid, id: gate.id };
}

const NORMAL_POWER_GROUPS = ["IEG-01", "IEG-02", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13", "IEG-14", "IEG-15", "IEG-16", "IEG-17", "IEG-18", "IEG-19", "IEG-20", "IEG-21"];

const modelDecisions: EsqModelDecisions = {
  familyChoices: [
    { familyId: "ESF-OK", groupingReason: "Every member ends in a safe stable state with no release. The operating state changes only how often a sequence occurs, and each sequence keeps its own state frequency." },
    { familyId: "ESF-LEAK", groupingReason: "Every member releases circulating activity into an intact, filtered reactor building, so the release path and RC-3 are the same in each state. The state sets the decay heat and the timing, which MS takes per sequence." },
    { familyId: "ESF-LATE", groupingReason: "Every member loses forced and passive heat removal with the building intact, giving the delayed filtered release of RC-2. Step 04 carries the heat-up window as a timing attribute." },
    { familyId: "ESF-EARLY", groupingReason: "Every member reaches a reactor building whose isolation or filtration has failed, so the release is unfiltered (RC-1) in each state. The state changes the source inventory, not the release path." },
    { familyId: "ESF-ATWS", groupingReason: "Every member is a failure to trip at full power, load follow or hot standby. Negative temperature feedback caps the power in each of these states, so the response and the release path are the same." },
  ],
};

const logic: EsqLogic = {
  flags: [
    {
      id: "FL-1",
      name: "Normal power available",
      target: { kind: "GATE", ...syGate("SYS-AC", "AC-AND") },
      state: false,
      groupIds: NORMAL_POWER_GROUPS,
      stateIds: [],
      basis: "Only IEG-03 loses offsite and normal AC power. In every other group the normal buses stay energized, so the backup generators are never demanded and only the motor control center can cut the shutdown-cooling supply. The SY tree assumes normal power is lost, which overstates the shutdown-cooling failure for these groups.",
    },
  ],
  exclusions: [
    {
      id: "EX-1",
      eventIds: [syEventId("DC-BAT-A-TM"), syEventId("DC-BAT-B-TM")],
      basis: "The equalizing procedure takes one battery bank off float at a time. Both banks on charge together is the joint equalization, which SY models as its own event (DC-BAT-AB-TM), so the two single-bank events never occur together.",
    },
  ],
};

const barrierWork: EsqBarrierWork = {
  barriers: [
    {
      barrierId: "TRISO coating",
      criterionId: "BAR-TRISO",
      modes: [
        { id: "FM-1", name: "Silicon carbide layer failure in a core heat-up", kind: "GROSS", location: "Hottest fuel blocks of the active core" },
        { id: "FM-2", name: "As-fabricated and in-service particle failure", kind: "LOCALIZED", location: "Fuel compacts across the core" },
      ],
    },
    {
      barrierId: "Primary boundary",
      criterionId: "BAR-HPB",
      impactRefs: ["RCB"],
      modes: [
        { id: "FM-3", name: "Gross boundary rupture", kind: "GROSS", location: "Reactor and steam-generator vessels and the cross duct" },
        { id: "FM-4", name: "Relief valve lift or penetration leak", kind: "LOCALIZED", location: "Relief train and instrument penetrations" },
      ],
    },
    {
      barrierId: "Containment",
      criterionId: "BAR-RB",
      modes: [
        { id: "FM-5", name: "Building isolation or filtration bypassed", kind: "GROSS", location: "Building isolation dampers and the filtered vent path" },
        { id: "FM-6", name: "Penetration seal leak", kind: "LOCALIZED", location: "Building penetrations and door seals" },
      ],
    },
  ],
  mechanisms: [
    { id: "PH-1", barrierId: "TRISO coating", modeIds: ["FM-1"], kind: "PHENOMENON", name: "Conduction cooldown with both cooling paths lost", familyIds: ["ESF-LATE"], basis: "SC heat-up runs at full power: the fuel reaches the 1600 C limit 25.8 to 42.8 h after cooling is lost (5th to 95th percentile, TF-CALC-H01)." },
    { id: "PH-2", barrierId: "Primary boundary", modeIds: ["FM-4"], kind: "PHENOMENON", name: "Pressure spike from a large water ingress with relief lift", familyIds: ["ESF-LATE"], basis: "SC load EHU-2 drives the primary pressure to the relief setpoint. The relief train lifts and limits the pressure below the design pressure (ST-CALC-H01)." },
    { id: "PH-3", barrierId: "Containment", modeIds: ["FM-5"], kind: "PHENOMENON", name: "Blowdown pressure and dust load from a large depressurization", familyIds: ["ESF-EARLY"], basis: "SC load EHG-2 pressurizes the building and loads the filters with graphite dust. SY carries the damper failure in that environment as a dependent failure (SPC-3)." },
    { id: "PH-4", barrierId: "TRISO coating", modeIds: ["FM-2"], kind: "DEGRADATION", name: "Fast-fluence damage beyond the design limit", familyIds: [], screening: { criterion: "SCR-3", basis: "The core design holds the fast fluence below the coating limit, so the damage mechanism cannot occur in service." }, basis: "" },
    { id: "PH-5", barrierId: "Containment", modeIds: ["FM-5"], kind: "PHENOMENON", name: "Building overpressure beyond its design", familyIds: [], screening: { criterion: "SCR-3", basis: "The largest blowdown stays below the building design pressure, so an overpressure failure needs a load the plant cannot produce." }, basis: "" },
  ],
  phenomenaLogic: {
    included: true,
    basis: "The fuel heat-up, the relief lift and the building blowdown enter the families through the ES branches and the Step 04 cells.",
    scrubbing: { credited: true, basis: "Aerosol plateout on the primary-circuit surfaces is credited at CC-II from the source term analysis." },
    beneficial: { credited: true, basis: "An early relief lift that limits the primary pressure is kept, since dropping it would distort the boundary-leak family." },
  },
  cells: [
    {
      id: "BC-1",
      barrierId: "TRISO coating",
      modeId: "FM-1",
      familyId: "ESF-LATE",
      mechanismIds: ["PH-1"],
      variable: "Time to the 1600 C fuel limit",
      unit: "h",
      basis: "REALISTIC",
      load: {
        source: "TYPED",
        variable: { law: { family: "POINT", value: 24 }, fields: [] },
        basis: "ES defines RC-2 as a release that starts more than 24 h after the initiator. A fuel limit reached sooner moves the release out of RC-2.",
      },
      capacity: {
        source: "TYPED",
        variable: {
          law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 },
          fields: [{ field: "mean", value: { node: "VALUE", value: { unit: "QUANTITY", law: { family: "LOGNORMAL", mean: 33.95262229796478, errorFactor: 1.2, level: 0.95 } } } }],
        },
        basis: "Heat-up window from the SC runs at full power: 5th 25.82 h, median 33.35 h, 95th 42.76 h, fitted as a lognormal with an error factor of 1.287. The window scale carries its own state-of-knowledge spread with an error factor of 1.2.",
      },
      aging: "The window runs use end-of-cycle burnup and fluence, so graphite conductivity loss with irradiation is inside the window.",
      use: "END_STATE_ATTRIBUTE",
      assumption: {
        calculation: "Core heat-up calculation for the design-stage core loading (TF-CALC-H01).",
        closure: "Repeat with the as-built core loading and measured graphite properties before operation.",
      },
    },
  ],
  credits: [
    {
      id: "CR-1",
      kind: "EQUIPMENT",
      qualificationId: "SPC-3",
      name: "Building isolation dampers in the blowdown environment",
      familyIds: ["ESF-EARLY"],
      environment: "Blowdown pressure, temperature and graphite dust from a large depressurization (IEG-10, IEG-11)",
      beyondQualification: true,
      credited: false,
      analysis: "",
      basis: "No survivability analysis covers the dampers beyond their qualification, so ESQ takes no credit. SY already carries the damper failure in that environment as a dependent failure.",
    },
  ],
};

const postWork: EsqPostWork = {
  recoveries: [
    { id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "HR shows cues, time, crew, procedure and access for the remote-panel restart (REC-Q-1). It applies wherever the second shutdown-cooling train fails to start." },
    { id: "REC-2", groupIds: [], stateIds: [], credited: false, basis: "HR has not shown the crew for the off-shift case, so the manual line-up is not credited." },
    { id: "REC-3", groupIds: [], stateIds: [], credited: false, basis: "Local access during the event is still under review against the as-built layout, so the re-alignment is not credited." },
  ],
  combinations: [
    { id: "HC-1", eventIds: [syEventId("SCS-HFE"), esqRecoveryEventId("REC-1")], dependencyId: "DEP-5", ofRecord: "HRA", groupIds: [], stateIds: [], basis: "The crew that failed to start the second train performs the remote-panel restart. HR rates the pair moderate (DEP-5)." },
  ],
};

const RELEASE_FAMILIES = ["ESF-LEAK", "ESF-LATE", "ESF-EARLY", "ESF-ATWS"];

const review: EsqReviewWork = {
  comparison: {
    possible: false,
    reason: "No operating plant shares this design, and the published PRAs of other gas-cooled designs differ in fuel form, operating states and release categories, so their family frequencies cannot be compared with these (ESQ-N-16). The reference gas-reactor methodology (ESQ-DOC-01) is used only to check that the passive heat sink and the reactor trip lead the contributors.",
    plants: [],
  },
  screened: [
    {
      groupId: "IE-35",
      familyId: "ESF-LEAK",
      frequency: 0.1,
      conditional: 5e-7,
      basis: "Loss of helium purification causes slow chemical attack over days. The technical specifications shut the reactor down on high impurity, and a release also needs the boundary-leak sequence failures, whose conditional probability in the ES trees stays below 5E-7. The frequency bounds the purification-system trips.",
    },
    {
      groupId: "IEG-DEPENDENCY-DEMO",
      frequency: 0,
      conditional: 1,
      basis: "Not a plant initiator. The group exists only to demonstrate the protection dependency in ES, so it adds no frequency.",
    },
  ],
};

const HR_ERROR_FACTORS: [string, number][] = [
  ["HFE:HR-PRE-014", 5],
  ["HFE:HR-PRE-018", 6],
  ["HFE:HR-PRE-031", 6],
  ["HFE:HR-PRE-041", 5],
  ["HFE:HR-POST-018", 4],
  ["HFE:HR-POST-022", 5],
  ["HFE:HR-POST-025", 5],
  ["HFE:HR-POST-026", 5],
  ["RECOVERY:REC-1", 4],
];

const uncertaintyWork: EsqUncertaintyWork = {
  spreads: HR_ERROR_FACTORS.map(([key, errorFactor]) => ({
    key,
    errorFactor,
    source: `HR quantification of ${key.split(":")[1] ?? key}: lognormal with an error factor of ${errorFactor}, given in its uncertainty note.`,
  })),
};

const HS_REASON = "Concerns the hazard groups that Step 01 leaves to their own PRA workbooks, so it moves no internal-events family.";

const decisions: EsqRegisterDecision[] = [
  { id: "DA:SOURCE:MU-2", familyIds: ["ESF-LEAK", "ESF-LATE"], key: true, caseIds: ["SS-2-HIGH"], reason: "" },
  { id: "DA:SOURCE:MU-3", familyIds: ["ESF-LEAK", "ESF-LATE"], caseIds: ["SS-3-LOW", "SS-3-HIGH"], reason: "" },
  { id: "DA:SOURCE:MU-5", familyIds: RELEASE_FAMILIES, key: true, caseIds: [], reason: "The group frequencies enter from IE, and each scales its own sequences in proportion, so Step 07 reads the effect from the initiator shares. A case on one DA frequency parameter would leave the run unchanged." },
  { id: "DA:SOURCE:MU-6", familyIds: ["ESF-LEAK", "ESF-LATE"], key: true, caseIds: ["SS-6-HIGH"], reason: "" },
  { id: "SY:SOURCE:MU-RCC-2", familyIds: RELEASE_FAMILIES, key: true, caseIds: ["SC-1", "SC-5"], reason: "" },
  { id: registerEntryId("HR", "SOURCE", "Borrowed nonnuclear human-performance data"), familyIds: RELEASE_FAMILIES, key: true, caseIds: ["SC-4"], reason: "" },
  { id: registerEntryId("ESQ", "SOURCE", "Cavity-cooling duct blockage mode"), familyIds: RELEASE_FAMILIES, key: true, caseIds: ["SC-5"], reason: "" },
  { id: registerEntryId("ESQ", "SOURCE", "State-of-knowledge correlation handling"), familyIds: RELEASE_FAMILIES, key: false, caseIds: [], reason: "Step 08 samples with shared draws and repeats the sampling with independent draws to show the effect." },
  { id: "HS:SOURCE:HS-UNC-001", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-002", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-003", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-004", familyIds: [], caseIds: [], reason: "The hazard PRAs model the correlated hazard failures. The internal-events families hold no hazard-induced failure, so none of them moves." },
  { id: "HS:SOURCE:HS-UNC-005", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-006", familyIds: [], caseIds: [], reason: "Hazard-induced initiators are quantified in the hazard PRAs and are not added to the internal-events initiator frequencies, so no family counts them twice. RI checks the overlap when it sums the hazard groups." },
];

const sensitivityWork: EsqSensitivityWork = {
  decisions,
  cases: [
    { id: "SC-1", name: "Stack blockage at ten times its estimate", kind: "PARAMETER", target: "DA-BE-211", factor: 10, basis: "SY takes duct and stack blockage from gas-cooled test facility experience (MU-RCC-2). Ten times the estimate spans the spread of that experience." },
    { id: "SS-2-HIGH", name: "Prior-form comparison · high", kind: "PARAMETER", target: "DA-BE-205", value: 2.13e-3, basis: "The circulator update repeated with the published compressor prior in place of the constrained noninformative one.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-2" } },
    { id: "SS-3-LOW", name: "Train maintenance sweep · low", kind: "PARAMETER", target: "DA-UA-11", value: 0.001997716894977169, basis: "Shutdown-cooling train maintenance between half and twice the planned 35 h a year.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-3" } },
    { id: "SS-3-HIGH", name: "Train maintenance sweep · high", kind: "PARAMETER", target: "DA-UA-11", value: 0.007990867579908675, basis: "Shutdown-cooling train maintenance between half and twice the planned 35 h a year.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-3" } },
    { id: "SS-6-HIGH", name: "Shutdown-cooling testing scheme · high", kind: "CCF_TOTAL", target: "CCF-SCS-TRAIN", factor: 3.35e-6 / 1.69e-6, basis: "The two shutdown-cooling trains tested on one day instead of staggered. The group total scales by DA's all-members ratio.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-6" } },
    { id: "SC-4", name: "Every HEP at its 95th percentile", kind: "HEP_95TH", basis: "HR borrows nonnuclear performance data for a crew that does not yet exist. The 95th percentile of each HEP bounds that applicability gap." },
    { id: "SC-5", name: "Cavity cooling duct groups failed", kind: "GROUP_FAILED", target: "CCF_GROUP:CCF-RCCS-DUCT", basis: "Bounds the shared-riser failure that SY has not yet modeled (SY-B8) by failing all four duct groups together." },
    { id: "SC-6", name: "No recovery and no HFE dependency", kind: "LOGIC", logic: { recovery: false, dependency: false }, basis: "Shows what the remote-panel restart credit and the joint HEPs change, the dependency treatment that ESQ-C16 asks to be tested." },
  ],
};

const handoffWork: EsqHandoffWork = {
  responses: [
    { id: "FAMILY:ESF-EARLY", kind: "FAMILY", ref: "ESF-EARLY", response: "The linked run puts ESF-EARLY at 3.77E-5 per year. The joint battery equalization (DA-UA-16, FV 0.55) and the equalization error (HR-PRE-041, FV 0.44) set almost all of it through the shutdown water ingress trees (IEG-16), while the building damper group has an FV of 9.3E-5. SY decides how the building isolation responds to a loss of DC.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "FAMILY:ESF-ATWS", kind: "FAMILY", ref: "ESF-ATWS", response: "The family now comes from the linked trees at 1.27E-4 per year, and Step 08 samples it (mean 1.27E-4, 95th 4.08E-4). SY's bound that a loss of DC fails the trip (MU-RPS-2) sets about 80% of it and the RPS miscalibration (HR-PRE-031) about 19%. The dedicated failure-to-trip tree goes to SY with that bound.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "FAMILY:ESF-LATE", kind: "FAMILY", ref: "ESF-LATE", response: "One linked run now gives the family, 2.65E-4 per year over the 96 trees, with its sequences and cut sets in Step 05 and the -5.86% of the recovery and HFE rules in Step 06. The common stack blockage (DA-BE-211, FV 0.66) and the cavity-cooling damper misalignment (HR-PRE-018, FV 0.32) lead it.", status: "COMPLETED" },
    { id: "FAMILY:ESF-LEAK", kind: "FAMILY", ref: "ESF-LEAK", response: "Kept under review. The linked run makes ESF-LEAK the largest release family at 9.28E-4 per year, led by the helium make-up action (HR-POST-026, 19%) and the steam generator isolation action (HR-POST-022, 12%). Its grouping reason stays in Step 02, and the building leak-rate data goes to MS.", status: "IN_PROGRESS", sentTo: "MS" },
    { id: "CONTRIBUTOR:Reactor trip divisions fail (CCF-RPS-DIV)", kind: "CONTRIBUTOR", ref: "Reactor trip divisions fail (CCF-RPS-DIV)", response: "The linked run gives the division group an FV of 2.2E-3 and a RAW of 177 on ESF-ATWS, far below the DC bound and the miscalibration HFE. Held against DA-CCF-04 with the generic demand factors and staggered testing until the CC-II software model is set.", status: "IN_PROGRESS", sentTo: "DA" },
    { id: "CONTRIBUTOR:Building isolation damper common-cause failure (CCF-RB-DMP)", kind: "CONTRIBUTOR", ref: "Building isolation damper common-cause failure (CCF-RB-DMP)", response: "The linked run gives the damper group an FV of 9.3E-5 and a RAW of 29 on ESF-EARLY, since a loss of DC fails the isolation first. Held against DA-CCF-30, with the coupling factors under review.", status: "IN_PROGRESS", sentTo: "DA" },
    { id: "CONTRIBUTOR:Control rods fail to insert (CCF-RPS-ROD)", kind: "CONTRIBUTOR", ref: "Control rods fail to insert (CCF-RPS-ROD)", response: "The linked run gives the rod group an FV of 5.2E-3 and a RAW of 177 on ESF-ATWS. It goes to SY with the failure-to-trip tree, behind the DC bound and the miscalibration HFE that outrank it.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "CONTRIBUTOR:Operator fails to start the standby filtration train (HR-POST-028)", kind: "CONTRIBUTOR", ref: "Operator fails to start the standby filtration train (HR-POST-028)", response: "The linked run puts it at 0.1% of ESF-EARLY (FV 1.0E-3, RAW 1.07), since a loss of DC fails the building isolation first. HR keeps it queued for detailed treatment, and the screening value stays until then.", status: "IN_PROGRESS", sentTo: "HR" },
    { id: "CONTRIBUTOR:Cavity-cooling duct group common-cause failure (CCF-RCCS-DUCT)", kind: "CONTRIBUTOR", ref: "Cavity-cooling duct group common-cause failure (CCF-RCCS-DUCT)", response: "The duct group has an FV of 0.023 and a RAW of 214 on ESF-LATE. Step 09 case SC-5 fails all four duct groups together and raises the release total from 1.36E-3 to 1.14E-1 per year. The common stack blockage (DA-BE-211, FV 0.66 on ESF-LATE) matters more, so both go to DA.", status: "IN_PROGRESS", sentTo: "DA" },
    { id: "CONTRIBUTOR:Shutdown-cooling train common-cause failure (CCF-SCS-TRAIN)", kind: "CONTRIBUTOR", ref: "Shutdown-cooling train common-cause failure (CCF-SCS-TRAIN)", response: "Held against DA-CCF-08. The group has an FV of 0.025 and a RAW of 54 on ESF-LATE, and Step 09 case SS-6-HIGH (both trains tested on one day) leaves the release total at 1.36E-3 per year.", status: "COMPLETED", sentTo: "DA" },
    { id: "CONTRIBUTOR:Operator fails to start the second shutdown-cooling train (HR-POST-018)", kind: "CONTRIBUTOR", ref: "Operator fails to start the second shutdown-cooling train (HR-POST-018)", response: "Kept at detailed treatment. The linked run gives it an FV of 5.4E-3 and a RAW of 5.2 on ESF-LATE.", status: "COMPLETED", sentTo: "HR" },
    { id: "GENERAL", kind: "GENERAL", ref: "GENERAL", response: "The linked quantification changes the ranking RI used. The release total is 1.36E-3 per year (95th 3.36E-3), led by the joint battery equalization, the common stack blockage and the RPS miscalibration, and ESF-LEAK is the largest release family. The DC and RPS decisions are open in SY, and RI recomputes from this package once they close.", status: "IN_PROGRESS", sentTo: "SY" },
  ],
};

export const ESQ_ANALYSIS_HTGR: EventSequenceQuantification = {
  uuid: "esq-generic-2",
  name: "ESQ Workbook 1",
  type: TechnicalElementTypes.EVENT_SEQUENCE_QUANTIFICATION,
  version: "2",
  created: CREATED,
  modified: NOW,
  owner: "mfeld",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "mfeld" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["mfeld", "ytanaka", "abensalem"],
    reviewers: [
      { id: "rev-1", name: "Dr. Hossein Ardakani", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Lena Hoffmann", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Event Sequence reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Aakash Patel", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Initiating Events reviewer", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Event sequence quantification for the Generic HTGR, a helium-cooled prismatic high-temperature gas reactor, integrating the seven upstream elements into the frequencies of event-sequence families, the only numbers the model exists to produce.",
    limitations: ["Pre-operational: the quantification inherits its pre-operational character through the upstream parameters and models, with two assumptions of its own."],
    lastModifiedDate: NOW,
    lastModifiedBy: "mfeld",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "esqc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-07T09:14:00.000Z", associatedSr: "ESQ-C4", text: "The instrument cabinet is assumed independent of the graphite-oxidation reaction, so ESQ-C4 needs the separation distance and the thermal basis shown before the independence assumption holds.", severity: "MAJOR", resolved: false },
      { uuid: "esqc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-06-07T10:30:00.000Z", associatedSr: "ESQ-D7", text: "The cooling-water support ranks higher than expected, so ESQ-D7 needs the reconciliation recorded so the high ranking is shown to be correct rather than an artifact.", severity: "MAJOR", resolved: false },
      { uuid: "esqc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-06-08T14:05:00.000Z", associatedSr: "ESQ-A1", text: "The helium-boundary-leak family groups across two sources, so ESQ-A1 needs the cross-source grouping justified so it does not mask a contributor.", severity: "MINOR", resolved: false },
      { uuid: "esqc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-08T15:20:00.000Z", associatedSr: "ESQ-B3", text: "The truncation convergence is demonstrated cleanly down to the chosen cutoff.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the convergence demonstration is complete.", resolvedAt: "2026-06-08T16:30:00.000Z", resolvedBy: "rev-2" },
      { uuid: "esqc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-06-08T16:00:00.000Z", associatedSr: "ESQ-D8", text: "The screened initiators are bounded individually, so ESQ-D8 needs the cumulative sum shown against the threshold, not just the individual bounds.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Internal-events event sequence quantification for the single-module Generic HTGR at the pre-operational stage, capability category CC-II. It covers all nine plant operating states, the 21 initiator groups of the IE workbook, and the radioactive sources POS lists: the in-core TRISO fuel at power and in decay, the primary circuit plateout, the vented primary helium and the spent fuel blocks in transfer. It quantifies the 620 sequences of the 96 ES event trees and their five families, from successful mitigation to the early release of RC-1. The other six hazard groups are quantified in their own hazard PRA workbooks.",
  linkedWorkbooks: { ES: "example-es-htgr", SY: "example-sy-htgr", DA: "example-da-htgr", HRA: "example-hr-htgr", IE: "example-ie-htgr", POS: "example-pos-htgr", SC: "example-sc-htgr", RI: "example-ri-htgr", HS: "example-hs-htgr" },
  modelDecisions,
  logic,
  barrierWork,
  postWork,
  review,
  uncertaintyWork,
  sensitivityWork,
  handoffWork,
  quantificationPlan: { modulesPerPlant: { value: 1, link: { element: "IE", workbookId: "example-ie-htgr", field: "numberOfModules" } } },
  bayesianNetworks: [createExampleDependencyNetwork()],
  hclConfigurations: [createExampleHclConfiguration()],
  familyQuantifications,
  modelIntegration,
  quantificationMethods,
  parameterConsistency: {
    capabilityCategory: "CC_II",
    hrParameterConsistency: true,
    daParameterConsistency: true,
    sequenceConditionsConsidered: true,
    harshEnvironmentsConsidered: true,
    basis: "The parameters are selected at the same capability category as the human reliability and data requirements, with the sequence conditions and harsh environments considered.",
    implementsSrs: srs("ESQ-A8"),
  },
  phenomenaParameterBases: [
    {
      uuid: "PPB-1",
      familyRef: "EFQ-3",
      isRiskSignificant: true,
      basis: "REALISTIC",
      justification: "Realistic phenomena parameters are used for the risk-significant boundary-leak family at CC-II.",
      implementsSrs: srs("ESQ-A9"),
    },
    {
      uuid: "PPB-2",
      familyRef: "EFQ-5",
      isRiskSignificant: false,
      basis: "CONSERVATIVE",
      justification: "Conservative phenomena parameters suffice for the non-risk-significant transient family.",
      implementsSrs: srs("ESQ-A9"),
    },
  ],
  recoveryActionApplications: [
    {
      uuid: "RA-1",
      recoveryActionRef: "REC-1",
      appliedAtLevel: "SEQUENCE",
      applicableFamilyRefs: ["EFQ-1"],
      hrFeasibilityRequirementsSatisfied: true,
      hrDependencyRequirementsSatisfied: true,
      implementsSrs: srs("ESQ-A7"),
    },
  ],
  circularLogicResolutions,
  systemSuccessTreatment: {
    treatmentMethod: "The success branches of modeled events are kept, not only the failure branches.",
    systemsWithSuccessModeled: ["SYS-SCS", "SYS-RPS"],
    impactOnResults: "Keeping the success complements avoids an overestimate of the risk-significant family frequencies.",
    modelingExamples: ["The shutdown-cooling success path is retained in the loss-of-forced-cooling sequences, consistent with the demonstrated passive-cooldown transients (ESQ-DOC-02)."],
    implementsSrs: srs("ESQ-B6"),
  },
  mutuallyExclusiveEventRules,
  flagEventSettings,
  moduleUsageRecords,
  dependencyTreatment,
  multiHfeCutsetIdentifications,
  hfeDependencyApplications,
  linkingTransferRecords,
  phenomenaDependencyAssessments,
  barrierQuantifications,
  phenomenaModelLogic,
  postReleaseHfeTreatments,
  equipmentSurvivabilityAssessments,
  cutsetLogicReviews,
  consistencyReviews,
  ruleLogicReviews,
  similarPlantComparisons,
  nonSignificantSampleReviews,
  riskSignificantContributors,
  importanceAnalyses,
  importanceReviews,
  screenedEventCumulativeAssessment,
  modelUncertaintySourceAssessments,
  uncertaintyPropagation,
  sensitivityStudies,
  riskIntegrationFeedback: {
    analysisRef: "ri-generic-2",
    feedbackDate: NOW,
    sequenceFeedback: [
      { sequenceRef: "ESF-EARLY", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Carries 52.9% of the 100 mrem frequency and 47% of the latent cancer risk."], recommendations: ["Refine the building isolation and recovery terms."] },
      { sequenceRef: "ESF-ATWS", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Carries 45.8% of the 100 mrem frequency and 40.7% of the latent cancer risk."], recommendations: ["Carry the dedicated failure-to-trip tree to final quantification and give the family a frequency distribution."] },
      { sequenceRef: "ESF-LATE", riskSignificance: ImportanceLevel.LOW, insights: ["Carries 8.84% of the latent cancer risk and 1.32% of the 100 mrem frequency."], recommendations: ["Keep the three-quantification aggregation visible so the family total stays auditable."] },
      { sequenceRef: "ESF-LEAK", riskSignificance: ImportanceLevel.LOW, insights: ["Carries 3.49% of the latent cancer risk."], recommendations: ["Keep the helium-leak grouping under review as the building leak-rate data matures."] },
    ],
    generalFeedback: "No family or contributor is risk-significant under NEI 18-04, and every total sits far below its target. The early-release pair still carries most of both totals, led by the reactor-trip and building-damper common-cause groups, so refine the building isolation terms and finalize the failure-to-trip tree.",
    response: {
      description: "The reactor-trip and building-damper groups are held against their data-analysis parameters and the failure-to-trip tree is scheduled for final quantification.",
      changes: ["CCF-RPS-DIV and CCF-RB-DMP held against DA-CCF-04 and DA-CCF-30", "HR-POST-028 queued for detailed treatment with the human-reliability analysis", "Dedicated failure-to-trip tree scheduled"],
      status: "IN_PROGRESS",
    },
  },
  modelUncertainty: {
    uuid: "esq-mu-1",
    name: "ESQ model uncertainty documentation",
    uncertaintySources: [
      { source: "Graphite-oxidation phenomena model", impact: "Carried as an uncertainty source and tested by sensitivity." },
      { source: "Cavity-cooling duct blockage mode", impact: "Bounded by a conservative capacity until the design is confirmed." },
      { source: "State-of-knowledge correlation handling", impact: "Handled by a common random seed, with the impact assessed." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  documentation,
  exampleDocuments: [
    { id: "ESQ-DOC-01", name: "Gas-reactor probabilistic risk assessment methodology", kind: "doc", sizeLabel: "INL", uploadedLabel: "INL-EXT-11-21270", extracted: "The reference gas-reactor quantification whose family frequencies, contributors and importance rankings anchor the results review", linked: 2, url: "/api/example-documents/esq/ngnp-pra" },
    { id: "ESQ-DOC-02", name: "High-temperature gas reactor core-design benchmark", kind: "doc", sizeLabel: "OECD-NEA", uploadedLabel: "INL-EXT-13-30176", extracted: "Transient benchmark data behind the passive-cooldown success branches kept in the sequence logic", linked: 1, url: "/api/example-documents/esq/mhtgr-benchmark" },
    { id: "ESQ-DOC-03", name: "High-temperature gas reactor multi-physics analysis", kind: "doc", sizeLabel: "ISN", uploadedLabel: "ISN-0022-3131", extracted: "Validated transient analyses backing the quantification-code validation cases", linked: 1, url: "/api/example-documents/esq/mhtgr-analysis" },
    { id: "ESQ-DOC-04", name: "Modular high-temperature gas reactor safety characterization", kind: "doc", sizeLabel: "ORNL", uploadedLabel: "ORNL-TM-2014-187", extracted: "Plant design data behind the source scope and the barrier capacity evaluations", linked: 1, url: "/api/example-documents/esq/htgr-safety" },
  ],
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-070", "NM-074", "NM-078"],
};

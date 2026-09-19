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
  type EsqDocumentation,
  DependencyType,
  TruncationMethod,
  QuantificationApproach,
  CircularLogicResolutionMethod,
  RiskSignificantContributorType,
  ESQ_SR_CATALOG,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import {
  createExampleDependencyNetwork,
  createExampleHclConfiguration,
} from "./dependency-model-seed";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-06-09T12:00:00.000Z";
const CREATED = "2026-06-04T09:00:00.000Z";

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
      { contributorRef: "Loss of helium inventory control (IE-40)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.2 },
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
    representativeSequenceSelectionBasis: "A station-blackout family driven by the diesel and battery availability and the recovery timing, inside the ESF-LATE screening envelope of 4.3e-5 per year.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 2.4e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 1.9e-7, errorFactor: 3 },
    percentile05: 6.3e-8,
    percentile50: 1.9e-7,
    percentile95: 5.7e-7,
    significantUncertaintySources: ["Diesel common-cause parameter (CCF-AC-DG)", "Station battery common-cause parameter (CCF-DC-BATT)"],
    contributionBreakdown: [
      { contributorRef: "Class 1E diesel common-cause failure (CCF-AC-DG)", contributorType: "CCF", fractionalContribution: 0.36 },
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
    radionuclideSources: ["SRC-H1", "SRC-H2", "SRC-H3"],
    initiatingEventGroups: ["IEG-01", "IEG-02", "IEG-03", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13", "IEG-14", "IEG-15", "IEG-16", "IEG-17", "IEG-18", "IEG-19", "IEG-20", "IEG-21"],
    hazardGroups: ["Internal events"],
    plantOperatingStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
    plantEvolutions: ["EV-01", "EV-02", "EV-03", "EV-04", "EV-05"],
  },
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
    parameterBasis: "The alpha-factor and beta-factor parameters supplied by the data analysis.",
    ccfGroupRefs: ["CCF-SCS-TRAIN", "CCF-DC-BATT"],
  },
  recoveryDependencyTreatment: "Recovery actions are applied with their dependence on the cause carried explicitly.",
  implementsSrs: srs("ESQ-C1", "ESQ-C2"),
};

const circularLogicResolutions: CircularLogicResolution[] = [
  {
    uuid: "CL-1",
    description: "Cooling-water support and electrical support each need the other",
    involvedElementIds: ["SYS-CCW", "SYS-1E-AC"],
    detectionMethod: "Detected during fault-tree linking as a logic loop.",
    resolutionMethod: CircularLogicResolutionMethod.LOGIC_TRANSFORMATION,
    resolutionDescription: "The loop is broken by a logic transformation that preserves both support paths.",
    neutralityJustification: "The break adds neither conservatism nor non-conservatism, since both directions are retained.",
    implementsSrs: srs("ESQ-B5"),
  },
];

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
    flagSettingsTransferred: ["HE-DG-OUT"],
    otherCharacteristicsTransferred: ["The offsite-power state and the diesel and battery alignment carry into the blackout tree."],
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
    findings: "The recovery, the diesel and the station-battery common-cause terms appear as expected.",
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
    entityRef: "Class 1E diesel common-cause failure",
    applicableFamilyRefs: ["EFQ-4"],
    fractionalContribution: 0.1,
    riskSignificanceCriteriaBasis: "Drives the station-blackout family.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The diesel common-cause group drives the blackout family.",
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
      { entityType: "CCF_GROUP", entityRef: "Shutdown-cooling train common-cause group", fussellVesely: 0.22, riskAchievementWorth: 8.4 },
      { entityType: "SYSTEM", entityRef: "Cooling-water support", fussellVesely: 0.15, riskAchievementWorth: 5.1 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts the second shutdown-cooling train", fussellVesely: 0.12, riskAchievementWorth: 4.2 },
      { entityType: "CCF_GROUP", entityRef: "Class 1E diesel common-cause group", fussellVesely: 0.1, riskAchievementWorth: 3.6 },
      { entityType: "BASIC_EVENT", entityRef: "Reactor protection channel", fussellVesely: 0.04, riskAchievementWorth: 1.9 },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
  {
    uuid: "IMP-2",
    scope: "PER_FAMILY",
    familyRef: "EFQ-1",
    measures: [
      { entityType: "CCF_GROUP", entityRef: "Shutdown-cooling train common-cause group", fussellVesely: 0.41, riskAchievementWorth: 12.5 },
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
  screenedInitiatingEventRefs: ["IE-35", "IE-47"],
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
    { parameterRef: "SCS-TRA-FR", distribution: { type: DistributionType.LOGNORMAL, median: 5.0e-3, errorFactor: 5 }, basis: "The risk-significant shutdown-cooling circulator parameter from the data analysis (DA-BE-205)." },
    { parameterRef: "DC-BAT-A-FR", distribution: { type: DistributionType.LOGNORMAL, median: 4.2e-3, errorFactor: 4 }, basis: "The battery-train run parameter from the data analysis (DA-BE-241)." },
    { parameterRef: "RPS-DVA-FS", distribution: { type: DistributionType.LOGNORMAL, median: 1.1e-3, errorFactor: 4 }, basis: "The protection division parameter from the data analysis (DA-BE-201)." },
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
  praScope: "Full-scope event sequence quantification for the Generic HTGR, pre-operational stage, capability category CC-II.",
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
      { sequenceRef: "ESF-EARLY", riskSignificance: ImportanceLevel.HIGH, insights: ["Drives the integrated latent risk through the building-isolation failure."], recommendations: ["Refine the building isolation and recovery terms."] },
      { sequenceRef: "ESF-ATWS", riskSignificance: ImportanceLevel.HIGH, insights: ["The second driver of the integrated risk, carried as a point estimate."], recommendations: ["Carry the dedicated failure-to-trip tree to final quantification."] },
      { sequenceRef: "ESF-LATE", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Aggregated from three family quantifications."], recommendations: ["Keep the three-quantification aggregation visible so the family total stays auditable."] },
      { sequenceRef: "ESF-LEAK", riskSignificance: ImportanceLevel.MEDIUM, insights: ["The highest-frequency family, above the one percent family threshold on the latent metric."], recommendations: ["Keep the helium-leak grouping under review as the building leak-rate data matures."] },
    ],
    generalFeedback: "Risk Integration returns the family significance at the family level, the early-release pair high, with the reactor-trip and building-damper common-cause groups and the standby-filtration action flagged behind them.",
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

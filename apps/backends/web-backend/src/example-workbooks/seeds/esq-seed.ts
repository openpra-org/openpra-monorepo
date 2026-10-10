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
  DependencyType,
  TruncationMethod,
  QuantificationApproach,
  CircularLogicResolutionMethod,
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
import { SY_ANALYSIS } from "./sy-seed";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-05-26T12:00:00.000Z";
const CREATED = "2026-05-21T09:00:00.000Z";
const DA_LINK = "example-da-sfr";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(4) as HlrId }));
}

const WARN_SRS = new Set<string>(["ESQ-A1", "ESQ-C4", "ESQ-D7"]);

const SR_EVIDENCE: Record<string, string> = {
  "ESQ-A1": "Three hundred twenty-three delineated sequences carried into six family quantifications across the five end-state families, with the cross-source grouping of the leak family still under review.",
  "ESQ-A2": "The sequences, system logic, data and human reliability are integrated across two sources, fifteen groups, three hazard groups and nine states.",
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
    name: "Loss of decay-heat removal",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped across the standby and reduced-power states, since the end state and the dependencies match.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "The headline family, the loss-of-decay-heat sequences from the vertical slice. The Event Sequence screening sum for ESF-LATE is 2.8e-5 per year across the family, and the refined means carry the quantified recovery and human-error credit the screening does not.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 3.2e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.6e-7, errorFactor: 3 },
    percentile05: 8.7e-8,
    percentile50: 2.6e-7,
    percentile95: 7.8e-7,
    significantUncertaintySources: ["DRACS loop common-cause parameter (CCF-DRACS-LOOP)", "Borrowed sodium-facility prior (Data Analysis GS-2)"],
    contributionBreakdown: [
      { contributorRef: "DRACS loop common-cause failure (CCF-DRACS-LOOP)", contributorType: "CCF", fractionalContribution: 0.41 },
      { contributorRef: "Loss of room cooling support (SYS-HVAC)", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.27 },
      { contributorRef: "Operator fails to start backup decay heat removal (HR-POST-005)", contributorType: "HUMAN_FAILURE_EVENT", fractionalContribution: 0.18 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.14 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "EFQ-2",
    name: "Protected loss of primary flow",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped within the at-power state only, so no cross-state grouping is taken.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A protected flow-loss family that relies on the flow-coastdown and decay-heat functions, inside the ESF-LATE screening envelope of 2.8e-5 per year.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 1.1e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 8.8e-8, errorFactor: 3 },
    percentile05: 2.9e-8,
    percentile50: 8.8e-8,
    percentile95: 2.6e-7,
    significantUncertaintySources: ["Auxiliary-pump battery supply reliability (DC-BAT-A-FR)"],
    contributionBreakdown: [
      { contributorRef: "Primary flow coastdown fails (CCF-PCS-FLOW)", contributorType: "CCF", fractionalContribution: 0.38 },
      { contributorRef: "Auxiliary-pump battery supply fails (DC-BAT-A-FR)", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.34 },
      { contributorRef: "Single primary-pump loss of flow (IE-01)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.2 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.08 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "EFQ-3",
    name: "Primary sodium boundary leak",
    eventSequenceFamilyRef: "ESF-LEAK",
    crossPosGroupingJustification: "Grouped within the at-power state only.",
    crossSourceGroupingJustification: "Grouped across the primary and the cover-gas sources, with the grouping justified by the shared barrier response. The cross-source grouping justification is under review.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A boundary-leak family where the barrier challenge and capacity drive the result. Refined from the ESF-LEAK screening sum of 1.7e-3 per year by the leak-isolation and make-up credit the screening carries at bounding values.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 3.3e-5,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.3e-5, errorFactor: 4 },
    percentile05: 5.8e-6,
    percentile50: 2.3e-5,
    percentile95: 9.2e-5,
    significantUncertaintySources: ["Guard-vessel localized failure mode (BAR-2)", "Sodium-air reaction phenomena (PD-1)"],
    contributionBreakdown: [
      { contributorRef: "Slow primary sodium level drop (IE-15)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.45 },
      { contributorRef: "Guard-vessel localized failure (BAR-2)", contributorType: "BARRIER_FAILURE_MODE", fractionalContribution: 0.3 },
      { contributorRef: "Leak detection and isolation failure (SYS-ISOL)", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.19 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.06 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
  },
  {
    uuid: "EFQ-4",
    name: "Loss of offsite power with DHR challenge",
    eventSequenceFamilyRef: "ESF-LATE",
    crossPosGroupingJustification: "Grouped across the at-power and the hot-standby states, since the response is the same.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A station-blackout family driven by the recovery timing, inside the ESF-LATE screening envelope of 2.8e-5 per year.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 2.4e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 1.9e-7, errorFactor: 3 },
    percentile05: 6.3e-8,
    percentile50: 1.9e-7,
    percentile95: 5.7e-7,
    significantUncertaintySources: ["Offsite-power recovery time (Data Analysis DA-RC-01)", "Station battery common-cause parameter (CCF-DC-BATT)"],
    contributionBreakdown: [
      { contributorRef: "Station battery common-cause failure (CCF-DC-BATT)", contributorType: "CCF", fractionalContribution: 0.36 },
      { contributorRef: "Battery depletion before offsite-power recovery (Data Analysis DA-RC-01)", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.29 },
      { contributorRef: "Loss of normal (off-site) power (IE-04)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.22 },
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
    representativeSequenceSelectionBasis: "A non-risk-significant family carried as a point estimate, as ESQ-A5 permits for non-significant families at CC-II. The Event Sequence family carries a provisional 1.9e-8 per year pending this quantification, which supersedes it.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 4.5e-8,
    contributionBreakdown: [
      { contributorRef: "Erroneous control-rod withdrawal (IE-07)", contributorType: "INITIATING_EVENT", fractionalContribution: 0.52 },
      { contributorRef: "Shutdown system fails to trip (CCF-RPS-DIV)", contributorType: "CCF", fractionalContribution: 0.33 },
      { contributorRef: "Distributed small contributors", contributorType: "OTHER", fractionalContribution: 0.15 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
  },
  {
    uuid: "EFQ-6",
    name: "Confinement failure, early release",
    eventSequenceFamilyRef: "ESF-EARLY",
    crossPosGroupingJustification: "Grouped across the shutdown-configuration states where the confinement boundary is most challenged.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "The early-release family, where decay-heat removal and the confinement both fail. Refined from the ESF-EARLY screening sum of 7.2e-6 per year by the confinement-isolation and clean-up credit the screening carries at bounding values.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 5.2e-8,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 3.2e-8, errorFactor: 5 },
    percentile05: 6.4e-9,
    percentile50: 3.2e-8,
    percentile95: 1.6e-7,
    significantUncertaintySources: ["Confinement damper common-cause parameter (CCF-CIS-DMP)", "Functional-containment capacity (BAR-3)"],
    contributionBreakdown: [
      { contributorRef: "Confinement isolation damper common-cause failure (CCF-CIS-DMP)", contributorType: "CCF", fractionalContribution: 0.34 },
      { contributorRef: "Operator fails to start standby clean-up train (HR-POST-022)", contributorType: "HUMAN_FAILURE_EVENT", fractionalContribution: 0.22 },
      { contributorRef: "DRACS loop common-cause failure (CCF-DRACS-LOOP)", contributorType: "CCF", fractionalContribution: 0.19 },
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
    radionuclideSources: ["In-core metallic driver fuel", "Activated primary sodium", "In-core metallic driver fuel (decay)", "Spent subassemblies in in-tank storage"],
    initiatingEventGroups: ["IEG-01", "IEG-02", "IEG-03", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13", "HZ-FIRE", "HZ-SEIS"],
    hazardGroups: ["Internal events", "Internal fires", "Seismic events"],
    plantOperatingStates: ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
    plantEvolutions: ["EV-01", "EV-02", "EV-03", "EV-04", "EV-05"],
  },
  scopeExclusions: [
    { aspect: "HAZARD_GROUP", item: "Internal floods", reason: "Quantified in the internal flood PRA workbook." },
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
    convergenceDemonstration: "The loss-of-decay-heat family frequency settles at 3.23E-7 per year at a cutoff of 1E-13 per year.",
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
    { type: DependencyType.FUNCTIONAL, treatmentDescription: "Support-system dependencies are carried explicitly in the linked logic.", modelingMethod: "Shared fault-tree logic with explicit support gates.", examples: ["Room cooling support of the safety I&C"] },
    { type: DependencyType.HUMAN, treatmentDescription: "Multiple human failure events in one cutset are assessed for their joint dependency.", modelingMethod: "Joint human error probabilities per the human reliability assessments.", examples: ["The decay-heat start, alignment and recovery actions"] },
    { type: DependencyType.PHENOMENOLOGICAL, treatmentDescription: "Phenomenological dependencies on credited equipment are assessed, with independence justified.", modelingMethod: "Phenomena logic included in the family models.", examples: ["Sodium-air reaction heat against the cell that houses the decay-heat path"] },
    { type: DependencyType.COMMON_CAUSE, treatmentDescription: "Common-cause failures are modeled with the parameters supplied by the data analysis.", modelingMethod: "Common-cause basic events inside the system logic.", examples: ["The three-loop DRACS common-cause group"] },
  ],
  postInitiatorHfeDependencyMethod: "The joint dependency of co-occurring human failure events is assessed per the human reliability requirements.",
  postInitiatorHfeDependencyBasis: "The joint-HEP floor built in the human reliability analysis binds the product at the cutset level.",
  ccfTreatment: {
    modelingApproach: "Common-cause basic events carried inside the system fault trees.",
    parameterBasis: "The alpha-factor and MGL parameters supplied by the data analysis.",
    ccfGroupRefs: ["CCF-DRACS-LOOP", "CCF-DC-BATT"],
  },
  recoveryDependencyTreatment: "Recovery actions are applied with their dependence on the cause carried explicitly.",
  implementsSrs: srs("ESQ-C1", "ESQ-C2"),
};

const circularLogicResolutions: CircularLogicResolution[] = [
  {
    uuid: "CL-1",
    description: "Cooling support and electrical support each need the other",
    involvedElementIds: ["SYS-HVAC", "SYS-1E-DC"],
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
    description: "Two DRACS loops in staggered surveillance at once",
    eventIds: ["HE-DRC-LP1-MAINT", "HE-DRC-LP2-MAINT"],
    basis: "The surveillance plan staggers the loops so two are never out together.",
    identifiedInResults: true,
    treatment: "LOGIC_ELIMINATION",
    implementsSrs: srs("ESQ-B7", "ESQ-B8"),
  },
  {
    uuid: "MX-2",
    description: "Refueling alignment with at-power initiator",
    eventIds: ["HE-REFUEL", "IE-01"],
    basis: "The refueling alignment cannot coexist with the at-power initiator.",
    identifiedInResults: true,
    treatment: "CUTSET_DELETION",
    implementsSrs: srs("ESQ-B7", "ESQ-B8"),
  },
];

const flagEventSettings: FlagEventSetting[] = [
  {
    uuid: "FL-1",
    name: "Train A maintenance alignment",
    purpose: "Selects the train-A-out configuration for the family",
    state: false,
    effect: "Removes the train-A failure logic from this family's model.",
    basis: "The maintenance alignment is a configuration choice, so the flag restructures the logic rather than carrying a probability.",
    isTemporary: false,
    applicableFamilyRefs: ["EFQ-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-2",
    name: "Shutdown-state SDHR path",
    purpose: "Enables the intermediate-loop shutdown cooling path credited only in the shutdown states",
    state: true,
    effect: "Includes the intermediate-loop shutdown heat-removal path in the shutdown-state model.",
    basis: "The intermediate-loop shutdown cooling is aligned only in the shutdown states, so the flag selects it per state.",
    isTemporary: false,
    applicableFamilyRefs: ["EFQ-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-3",
    name: "At-power flow-coastdown logic",
    purpose: "Selects the at-power flow-coastdown logic",
    state: true,
    effect: "Includes the primary flow-coastdown logic in the at-power model.",
    basis: "The primary flow coastdown applies only at power, so the flag selects the at-power logic.",
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
    cutsetDescription: "CS-DHR-0142, three human failure events appear together in a loss-of-decay-heat cutset.",
    hfeRefs: ["HR-POST-004", "HR-POST-005", "REC-1"],
    potentialRiskImpact: "The cutset is risk-significant, so the joint dependency is assessed per HR and the joint floor binds the product.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
  {
    uuid: "MH-2",
    cutsetDescription: "CS-DRAIN-0033, two human failure events appear together in a refuelling drain-down cutset.",
    hfeRefs: ["HR-POST-028", "HR-POST-026"],
    potentialRiskImpact: "The cutset is risk-significant, and the two actions share the same crew and timeline, so the dependence is not negligible.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
];

const hfeDependencyApplications: HfeDependencyApplication[] = [
  {
    uuid: "HD-1",
    hrDependencyAssessmentRef: "DEP-3",
    cutsetContext: "CS-DHR-0142",
    appliedJointHep: 3.5e-4,
    implementsSrs: srs("ESQ-C2"),
  },
  {
    uuid: "HD-2",
    hrDependencyAssessmentRef: "DEP-5",
    cutsetContext: "CS-DRAIN-0033",
    appliedJointHep: 4.5e-4,
    implementsSrs: srs("ESQ-C2"),
  },
];

const linkingTransferRecords: LinkingTransferRecord[] = [
  {
    uuid: "LT-1",
    sourceTreeDescription: "Loss-of-flow tree",
    targetTreeDescription: "Decay-heat-removal tree",
    failedEquipmentTransferred: ["Primary pump A", "Flow-coastdown path A"],
    flagSettingsTransferred: ["HE-FLOW-COAST"],
    otherCharacteristicsTransferred: ["The failed pump and the flow-coastdown flag carry into the decay-heat tree."],
    frequencyTransferred: true,
    implementsSrs: srs("ESQ-C3"),
  },
  {
    uuid: "LT-2",
    sourceTreeDescription: "Loss-of-offsite-power tree",
    targetTreeDescription: "Station-blackout tree",
    failedEquipmentTransferred: ["Offsite power"],
    flagSettingsTransferred: ["HE-DC-DEPLETED"],
    otherCharacteristicsTransferred: ["The offsite-power state and the battery-train alignment carry into the blackout tree."],
    frequencyTransferred: true,
    implementsSrs: srs("ESQ-C3"),
  },
];

const phenomenaDependencyAssessments: PhenomenaDependencyAssessment[] = [
  {
    uuid: "PD-1",
    phenomenon: "Sodium-air reaction heat and aerosol",
    affectedSscRefs: ["SYS-DRACS", "Cell liner"],
    dependencyAssessment: "The reaction heat challenges the same cell that houses the decay-heat path, so the two are not independent.",
    implementsSrs: srs("ESQ-C4"),
  },
  {
    uuid: "PD-2",
    phenomenon: "Cover-gas pressurization",
    affectedSscRefs: ["Primary boundary", "Cover-gas line"],
    dependencyAssessment: "The pressurization is assessed against the boundary and the cover-gas relief path.",
    independenceJustifications: ["The instrument cabinet is assumed independent, with the separation distance recorded."],
    implementsSrs: srs("ESQ-C4"),
  },
];

const barrierQuantifications: RadionuclideBarrierQuantification[] = [
  {
    uuid: "BAR-1",
    name: "Metallic fuel matrix and cladding",
    applicableSourceRefs: ["SRC-1"],
    failureModes: [
      { failureMode: "Gross cladding breach", failureType: "GROSS", mechanisms: ["Fuel-cladding eutectic"], probability: 1.0e-3 },
      { failureMode: "Localized pin perforation", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Cladding overtemperature"], probability: 3.0e-3 },
    ],
    challengingPhenomena: ["Fuel-cladding eutectic", "Cladding overtemperature"],
    designSpecificDegradationMechanisms: ["Fuel-cladding chemical interaction"],
    screenedOutMechanisms: [
      { mechanism: "Irradiation swelling beyond burnup limit", criterion: "SCR-3", justification: "Bounded by the burnup limit, so it is screened per SCR-3." },
    ],
    challengeAssessment: {
      basis: "REALISTIC_PLANT_SPECIFIC_CALCULATION",
      challenges: ["Overtemperature transients", "Eutectic formation at the cladding interface"],
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
    name: "Primary boundary and sodium pool",
    applicableSourceRefs: ["SRC-1", "SRC-2"],
    failureModes: [
      { failureMode: "Gross boundary rupture", failureType: "GROSS", mechanisms: ["Thermal striping"], probability: 1.0e-5 },
      { failureMode: "Localized weld leak", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Thermal fatigue at the nozzle welds"], probability: 5.0e-4 },
    ],
    challengingPhenomena: ["Thermal striping", "Sodium-air reaction loads"],
    designSpecificDegradationMechanisms: ["Thermal fatigue at the nozzle welds"],
    challengeAssessment: {
      basis: "REALISTIC_PLANT_SPECIFIC_CALCULATION",
      challenges: ["Thermal striping at the mixing tees", "Reaction loads on the guard vessel"],
    },
    capacityEvaluation: {
      basis: "REALISTIC",
      description: "The guard vessel catches a localized leak, so the localized mode dominates the challenge.",
      inServiceAgingIncluded: true,
    },
    externalHazardCapacity: [{ hazard: "Seismic", basis: "FRAGILITY_CURVES" }],
    implementsSrs: srs("ESQ-C10", "ESQ-C12", "ESQ-C13", "ESQ-C14"),
  },
  {
    uuid: "BAR-3",
    name: "Guard vessel",
    applicableSourceRefs: ["SRC-1", "SRC-2"],
    failureModes: [
      { failureMode: "Gross guard-vessel failure", failureType: "GROSS", mechanisms: ["Thermal challenge from the sodium pool"], probability: 5.0e-5 },
      { failureMode: "Localized annulus leak", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Weld degradation in the annulus"], probability: 8.0e-4 },
    ],
    challengingPhenomena: ["Thermal challenge from the sodium pool", "Sodium-air reaction loads"],
    designSpecificDegradationMechanisms: ["Weld degradation in the annulus"],
    challengeAssessment: {
      basis: "REALISTIC_PLANT_SPECIFIC_CALCULATION",
      challenges: ["Sodium reaction loads in the annulus"],
    },
    capacityEvaluation: {
      basis: "REALISTIC",
      description: "The guard vessel catches primary-boundary leakage and holds a share of the aerosol before the confinement.",
      inServiceAgingIncluded: true,
    },
    externalHazardCapacity: [{ hazard: "Seismic", basis: "FRAGILITY_CURVES" }],
    implementsSrs: srs("ESQ-C10", "ESQ-C12", "ESQ-C14"),
  },
  {
    uuid: "BAR-4",
    name: "Reactor building, functional containment",
    applicableSourceRefs: ["SRC-1", "SRC-2", "SRC-3"],
    failureModes: [
      { failureMode: "Gross confinement bypass", failureType: "GROSS", mechanisms: ["Cell pressurization"], probability: 2.0e-4 },
      { failureMode: "Localized penetration leak", failureType: "LOCALIZED_DEGRADED", mechanisms: ["Penetration seal degradation"], probability: 1.0e-3 },
    ],
    challengingPhenomena: ["Cell pressurization", "Aerosol loading"],
    designSpecificDegradationMechanisms: ["Penetration seal degradation"],
    screenedOutMechanisms: [
      { mechanism: "Overpressure beyond design", criterion: "SCR-2", justification: "Below the screening frequency, so it is screened per SCR-2." },
    ],
    challengeAssessment: {
      basis: "CONSERVATIVE_GENERIC_ESTIMATE",
      challenges: ["Cell pressurization from a sodium-air reaction"],
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
    hfeRefs: ["HR-POST-011", "HR-POST-025"],
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
    environmentalConditions: [{ type: "Thermal", severity: "Elevated temperature from the sodium reaction" }],
    survivabilityCriteria: "The cabinet stays within its qualification limit under the reaction environment.",
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
  scrubbingJustification: "Aerosol scrubbing across the sodium pool is credited at CC-II with technical justification.",
  beneficialFailuresIncluded: true,
  beneficialFailureJustification: "A beneficial early relief failure is included where omitting it would distort the result.",
  implementsSrs: srs("ESQ-C6"),
};

const cutsetLogicReviews: CutsetLogicReviewRecord[] = [
  {
    uuid: "CR-1",
    sampleDescription: "Top ten risk-significant cutsets in the loss-of-decay-heat family",
    logicCorrect: true,
    findings: "The cutset logic matches the system models and the dependencies are present.",
    implementsSrs: srs("ESQ-D1"),
  },
  {
    uuid: "CR-2",
    sampleDescription: "Top five cutsets in the station-blackout family",
    logicCorrect: true,
    findings: "The recovery and the station-battery common-cause terms appear as expected.",
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
    comparisonPlants: ["Reference sodium-cooled fast reactor PRA"],
    keyDifferences: ["The passive decay-heat path lowers the loss-of-cooling family relative to the reference."],
    differenceCauses: ["The natural-circulation DRACS reduces the dependence on active cooling."],
    implementsSrs: srs("ESQ-D4"),
  },
];

const riskSignificantContributors: RiskSignificantContributor[] = [
  {
    uuid: "RC-1",
    contributorType: RiskSignificantContributorType.CCF,
    entityRef: "DRACS loop common-cause failure",
    applicableFamilyRefs: ["EFQ-1"],
    fractionalContribution: 0.22,
    riskSignificanceCriteriaBasis: "Above the risk-integration significance threshold.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The common-cause group dominates the loss-of-decay-heat family.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-2",
    contributorType: RiskSignificantContributorType.EQUIPMENT_FAILURE,
    entityRef: "Loss of room cooling support",
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
    entityRef: "Operator fails to start backup DHR",
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
    entityRef: "Station battery common-cause failure",
    applicableFamilyRefs: ["EFQ-4"],
    fractionalContribution: 0.1,
    riskSignificanceCriteriaBasis: "Drives the station-blackout family.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "MITIGATION_FAILURE",
    basis: "The station-battery common-cause group drives the blackout family.",
    implementsSrs: srs("ESQ-D6"),
  },
  {
    uuid: "RC-5",
    contributorType: RiskSignificantContributorType.INITIATING_EVENT,
    entityRef: "Slow primary sodium level drop (IE-15)",
    applicableFamilyRefs: ["EFQ-3"],
    fractionalContribution: 0.08,
    riskSignificanceCriteriaBasis: "Risk-significant initiator.",
    reactorScope: "SINGLE_REACTOR",
    contributionPhase: "INITIATING_EVENT_OCCURRENCE",
    basis: "The leak initiator carries the boundary-leak family.",
    implementsSrs: srs("ESQ-D6"),
  },
];

const importanceAnalyses: ImportanceAnalysisRecord[] = [
  {
    uuid: "IMP-1",
    scope: "OVERALL",
    measures: [
      { entityType: "CCF_GROUP", entityRef: "DRACS loop common-cause group", fussellVesely: 0.22, riskAchievementWorth: 8.4, dataAnalysisParameterRef: "DA-CCF-12" },
      { entityType: "SYSTEM", entityRef: "Room cooling support", fussellVesely: 0.15, riskAchievementWorth: 5.1 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts backup DHR", fussellVesely: 0.12, riskAchievementWorth: 4.2 },
      { entityType: "CCF_GROUP", entityRef: "Station battery common-cause group", fussellVesely: 0.1, riskAchievementWorth: 3.6, dataAnalysisParameterRef: "DA-CCF-08" },
      { entityType: "BASIC_EVENT", entityRef: "Reactor protection channel", fussellVesely: 0.04, riskAchievementWorth: 1.9, dataAnalysisParameterRef: "DA-BE-007" },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
  {
    uuid: "IMP-2",
    scope: "PER_FAMILY",
    familyRef: "EFQ-1",
    measures: [
      { entityType: "CCF_GROUP", entityRef: "DRACS loop common-cause group", fussellVesely: 0.41, riskAchievementWorth: 12.5, dataAnalysisParameterRef: "DA-CCF-12" },
      { entityType: "SYSTEM", entityRef: "Room cooling support", fussellVesely: 0.27, riskAchievementWorth: 6.8 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts backup DHR", fussellVesely: 0.18, riskAchievementWorth: 4.4 },
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
        entityRef: "Room cooling support",
        description: "The support system ranks higher than expected.",
        reconciliation: "The ranking is traced to the shared cooling dependency, which is correct and is retained.",
      },
    ],
    implementsSrs: srs("ESQ-D7"),
  },
];

const screenedEventCumulativeAssessment = {
  screenedInitiatingEventRefs: ["IE-22", "IE-23"],
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
  { uuid: "UF-9", sourceElementCode: "DA", uncertaintySource: "Similar-equipment adjustment for sodium service", relatedAssumptions: ["LWR pumps, level probes and detectors fail like their sodium-service counterparts once the service factor is applied."], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "LWR pump, level and fire-detection data are adjusted for sodium service. Over the factor's range the make-up pump probability runs from 5.88E-4 to 2.94E-3.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-1" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-10", sourceElementCode: "DA", uncertaintySource: "EBR-II shutdown-system hours read through the planned test interval", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "The module probability depends on the hours each demand covers. Monthly to semiannual tests give 2.36E-4 to 3.05E-4 per demand.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-2" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-11", sourceElementCode: "DA", uncertaintySource: "Planned demand, exposure and maintenance counts", relatedAssumptions: ["The planned surveillance and maintenance schedule stands in for operating records."], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Demands, run hours and maintenance hours come from the planned schedule until operating records exist. Each train unavailability moves in proportion to its maintenance hours.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-3" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-12", sourceElementCode: "DA", uncertaintySource: "Coincident-maintenance assumption", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "The joint equalizing charge takes both battery banks out together for 22 h a year. The value is assumed until plant experience confirms it.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-4" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-13", sourceElementCode: "DA", uncertaintySource: "Initiating-event frequencies from EBR-II experience and design estimates", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Thirteen group frequencies rest on EBR-II counts, EBR-II fault trees and design-based estimates. At the LWR offsite power rate, loss of electric power would drop 9.9 times.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-5" }, implementsSrs: srs("ESQ-E1") },
  { uuid: "UF-14", sourceElementCode: "DA", uncertaintySource: "Common cause factors from the CCF 2020, NUREG/CR-4550 and EBR-II data", relatedAssumptions: [], evaluationType: "QUANTITATIVE", evaluationScope: "INDIVIDUAL", effectOnFamilyFrequencies: "Each group takes generic factors for its size, and its testing scheme decides what Systems Analysis receives. Testing the DRACS loops on one day would make all three failing together 2.9 times more likely.", dataAnalysisSourceRef: { workbookId: "example-da-sfr", sourceId: "MU-6" }, implementsSrs: srs("ESQ-E1") },
];

const uncertaintyPropagation: UncertaintyPropagation = {
  uuid: "esq-up-1",
  propagationMethod: "MONTE_CARLO",
  numberOfSamples: 100000,
  modelUncertainties: [
    { uncertaintyId: "MU-1", description: "Sodium-air reaction phenomena model", impact: "Carried as an uncertainty source and tested by sensitivity.", isQuantified: false, treatmentApproach: "Sensitivity study across the phenomena range." },
    { uncertaintyId: "MU-2", description: "Guard-vessel localized failure mode", impact: "Bounded by a conservative capacity until the design is confirmed.", isQuantified: false, treatmentApproach: "Conservative bound carried until the as-built confirmation." },
    { uncertaintyId: "MU-3", description: "State-of-knowledge correlation handling", impact: "Handled by a common random seed, with the impact assessed.", isQuantified: true, treatmentApproach: "Common random seed across shared estimates." },
  ],
  characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT_SOKC",
  parameterUncertainties: [
    { parameterRef: "DA-BE-031", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-031" } }, basis: "The risk-significant natural-circulation loop parameter from the data analysis (DA-BE-031)." },
    { parameterRef: "DA-BE-071", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-071" } }, basis: "The battery-train run parameter from the data analysis (DA-BE-071)." },
    { parameterRef: "DA-BE-007", estimate: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA_LINK, entityId: "DA-BE-007" } }, basis: "The protection division parameter from the data analysis (DA-BE-007)." },
  ],
  stateOfKnowledgeCorrelation: {
    isConsidered: true,
    handlingMethod: "SAME_RANDOM_SEED",
    handlingDescription: "Shared estimates are sampled with a common random seed, so their uncertainty stays correlated.",
    correlatedParameterGroups: [
      ["DRC-LP1-FR", "DRC-LP2-FR", "DRC-LP3-FR"],
      ["DC-BAT-A-FR", "DC-BAT-B-FR"],
    ],
    impactAssessment: "Ignoring the correlation would understate the loss-of-cooling mean by about a third.",
  },
  implementsSrs: srs("ESQ-E2"),
};

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "Truncation sensitivity", description: "Sweep of the truncation cutoff below the chosen value.", variedParameters: ["Truncation cutoff"], parameterRanges: { "Truncation cutoff": [1e-14, 1e-12] }, results: "The family frequencies hold within a few percent below the chosen cutoff." },
  { uuid: "SS-2", name: "State-of-knowledge correlation sweep", description: "Sweep of the correlation handling between shared estimates.", variedParameters: ["Correlation"], parameterRanges: { Correlation: [0, 1] }, results: "Ignoring the correlation would understate the loss-of-cooling mean by about a third." },
  { uuid: "SS-3", name: "Barrier-capacity sweep", description: "Sweep of the guard-vessel capacity range.", variedParameters: ["Capacity factor"], parameterRanges: { "Capacity factor": [0.5, 2] }, results: "The leak family stays below the threshold across the capacity range." },
  { uuid: "DA-SS-1", name: "Similar-equipment sweep", description: "The sodium make-up pump rests on LWR pump data adjusted for sodium service. The factor goes to its bounds of 1 and 5.", variedParameters: ["DA-BE-111"], parameterRanges: { "DA-BE-111": [0.0005877225608803913, 0.0029386128044019567] }, results: "The pump probability runs from 5.88E-4 to 2.94E-3 per demand, against 1.41E-3 for the factor law.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-1" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-2", name: "Test-interval sweep", description: "The sensor input module estimate with monthly and semiannual channel tests in place of quarterly ones.", variedParameters: ["DA-BE-082"], parameterRanges: { "DA-BE-082": [0.00023558505611735828, 0.00030480034508374184] }, results: "The module probability is 2.36E-4 per demand with monthly tests and 3.05E-4 with semiannual tests, against 2.86E-4 for the planned quarterly tests.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-2" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-3", name: "Pump maintenance sweep", description: "Intermediate pump maintenance between half and twice the planned 26 h a year.", variedParameters: ["DA-UA-03"], parameterRanges: { "DA-UA-03": [0.0014840182648401827, 0.005936073059360731] }, results: "The pump unavailability runs from 1.48E-3 to 5.94E-3, against 2.92E-3 for the Bayes estimate.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-3" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-4", name: "Coincident-maintenance sweep", description: "The joint battery equalization unavailability from none to 5.0E-3.", variedParameters: ["DA-UA-05"], parameterRanges: { "DA-UA-05": [0, 0.005] }, results: "The planned joint charge gives 2.51E-3, inside the swept range.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-4" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-5", name: "Electric power at the LWR rate", description: "Loss of electric power at the 2020 LWR offsite power rate, against the EBR-II record of no losses in five years.", variedParameters: ["DA-IE-02"], parameterRanges: { "DA-IE-02": [0.020220548035077744, 0.2] }, results: "The LWR rate gives 2.02E-2 per year over the group's power states, 9.9 times below the EBR-II based value of 0.2.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-5" }, implementsSrs: srs("ESQ-E2") },
  { uuid: "DA-SS-6", name: "DRACS loop testing scheme", description: "The three DRACS loops tested on one day instead of staggered.", variedParameters: ["DA-CCF-12"], parameterRanges: { "DA-CCF-12": [5.935197205668143e-05, 0.00017300976092140088] }, results: "All three loops failing together rises from 5.94E-5 to 1.73E-4, 2.9 times the staggered value.", dataAnalysisCaseRef: { workbookId: "example-da-sfr", caseId: "SS-6" }, implementsSrs: srs("ESQ-E2") },
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
  resultsSummary: "Five event-sequence families are quantified, four of them risk-significant, with the loss-of-decay-heat family at 3.2E-7 per year.",
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
  similarPlantComparison: "The results are compared to the reference sodium-cooled fast reactor PRA (ESQ-DOC-01), and the differences are explained by the passive decay-heat path.",
  riskSignificantContributorsDocumentation: "The risk-significant contributors are identified using the risk-integration criteria, with the single-reactor scope noted.",
  uncertaintySourcesDocumentation: "The model-uncertainty sources from every technical element are assessed at the quantification, qualitatively or quantitatively.",
  limitationsForApplications: "The limitations that would affect applications are recorded, including the conservative functional-containment capacity.",
  asBuiltLimitations: "Pre-operational: the quantification rests on inherited pre-operational parameters and design analyses pending as-built confirmation.",
  praTaskInterfaces: "ESQ takes the operating states from POS and the work of IE, ES, SC, SY, HR and DA, and delivers the family frequencies to Risk Integration and the release inputs to the Mechanistic Source Term, with a risk-significance feedback loop to every input. The family means carry the quantified human-error and recovery credit the Event Sequence screening sums do not.",
  implementsSrs: srs("ESQ-F1", "ESQ-F2", "ESQ-F3", "ESQ-F4", "ESQ-F5"),
};

function syEventId(code: string): string {
  const event = SY_ANALYSIS.systemBasicEvents.find((candidate) => candidate.code === code);
  if (event === undefined) throw new Error(`The SY example has no event ${code}.`);
  return event.uuid;
}

const RELEASE_FAMILIES = ["ESF-LEAK", "ESF-LATE", "ESF-EARLY", "ESF-ATWS"];

const modelDecisions: EsqModelDecisions = {
  familyChoices: [
    { familyId: "ESF-OK", groupingReason: "Every member ends in a safe stable state with no release. The operating state changes only how often a sequence occurs, and each sequence keeps its own state frequency." },
    { familyId: "ESF-LEAK", groupingReason: "Every member loses cooling or a boundary function while the confinement holds, so the release is the design leakage of RC-3 in each state. The state sets the decay heat and the timing, which MS takes per sequence." },
    { familyId: "ESF-LATE", groupingReason: "Every member loses decay heat removal with the confinement intact and filtering, giving the delayed release of RC-2. The heat-up time grows in the low-power states, which Step 04 carries as a timing attribute." },
    { familyId: "ESF-EARLY", groupingReason: "Every member reaches a confinement that has failed to isolate or clean up, so the release is unfiltered (RC-1) in each state. The state changes the source inventory, not the release path." },
    { familyId: "ESF-ATWS", groupingReason: "Every member is a failure to insert the rods at full or reduced power. Inherent reactivity feedback lowers the power in each of these states, so the response and the release path are the same." },
  ],
};

const logic: EsqLogic = {
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
      barrierId: "Stainless steel cladding",
      criterionId: "BAR-CLAD",
      modes: [
        { id: "FM-1", name: "Cladding breach by fuel-cladding eutectic", kind: "GROSS", location: "Hottest driver subassemblies of the core" },
        { id: "FM-2", name: "Local pin perforation", kind: "LOCALIZED", location: "Single pins across the core" },
      ],
    },
    {
      barrierId: "Primary sodium boundary",
      criterionId: "BAR-PB",
      impactRefs: ["PSB"],
      modes: [
        { id: "FM-3", name: "Gross boundary rupture", kind: "GROSS", location: "Primary tank and its piping" },
        { id: "FM-4", name: "Weld leak from thermal fatigue", kind: "LOCALIZED", location: "Nozzle welds at the mixing tees" },
      ],
    },
    {
      barrierId: "Reactor cover gas boundary",
      criterionId: "BAR-CG",
      modes: [
        { id: "FM-5", name: "Cover-gas boundary breach", kind: "GROSS", location: "Cover-gas piping and the clean-up loop" },
        { id: "FM-6", name: "Seal leak at a rotating plug", kind: "LOCALIZED", location: "Rotating plug and penetration seals" },
      ],
    },
    {
      barrierId: "Containment",
      criterionId: "BAR-CONF",
      modes: [
        { id: "FM-7", name: "Confinement isolation or clean-up bypassed", kind: "GROSS", location: "Isolation dampers and the clean-up trains" },
        { id: "FM-8", name: "Penetration seal leak", kind: "LOCALIZED", location: "Building penetrations and door seals" },
      ],
    },
  ],
  mechanisms: [
    { id: "PH-1", barrierId: "Stainless steel cladding", modeIds: ["FM-1"], kind: "PHENOMENON", name: "Heat-up with decay heat removal lost", familyIds: ["ESF-LATE"], basis: "SC load ESL-3: a loss of heat sink with the intermediate loop and DRACS lost. At full power the cladding reaches the 650 C limit about 200 min after decay heat removal stops (TF-CALC-06)." },
    { id: "PH-2", barrierId: "Primary sodium boundary", modeIds: ["FM-4"], kind: "PHENOMENON", name: "Bulk sodium heat-up and thermal stress", familyIds: ["ESF-LATE"], basis: "SC load ESL-3 raises the bulk sodium toward the 550 C structural limit, which loads the nozzle welds (TF-CALC-06)." },
    { id: "PH-3", barrierId: "Reactor cover gas boundary", modeIds: ["FM-5"], kind: "PHENOMENON", name: "Activated argon transport on a cover-gas challenge", familyIds: ["ESF-LEAK"], basis: "SC load ESG-2 carries activated argon into the cover-gas piping, and the isolation must hold it (ST-CALC-05)." },
    { id: "PH-4", barrierId: "Containment", modeIds: ["FM-7"], kind: "PHENOMENON", name: "Confinement pressure from a sodium fire", familyIds: ["ESF-EARLY"], basis: "SC load ESI-3 pressurizes the confinement and loads the clean-up filters with aerosol. SY carries the damper failure in that environment as a dependent failure (SPC-3)." },
    { id: "PH-5", barrierId: "Containment", modeIds: ["FM-7"], kind: "HAZARD", name: "Sodium fire in the reactor building", hazardGroup: "Internal fires", familyIds: [], basis: "The sodium fire tree (HZ-FIRE) asks fire suppression before DRACS and the confinement, so the fire load reaches the confinement through those branches." },
    { id: "PH-6", barrierId: "Primary sodium boundary", modeIds: ["FM-3"], kind: "HAZARD", name: "Inertial and sloshing loads from the design ground motion", hazardGroup: "Seismic events", familyIds: [], basis: "SC load ESS-1 checks the primary tank against the response spectrum. The seismic tree (HZ-SEIS) carries the plant response, and the fragility of the tank sits with the seismic PRA." },
    { id: "PH-7", barrierId: "Stainless steel cladding", modeIds: ["FM-2"], kind: "DEGRADATION", name: "Irradiation swelling beyond the burnup limit", familyIds: [], screening: { criterion: "SCR-3", basis: "The fuel management keeps burnup below the swelling limit, so the mechanism cannot occur in service." }, basis: "" },
  ],
  phenomenaLogic: {
    included: true,
    basis: "The cladding heat-up, the cover-gas challenge and the sodium fire load enter the families through the ES branches and the Step 04 cells.",
    scrubbing: { credited: true, basis: "Aerosol scrubbing across the sodium pool is credited at CC-II from the source term analysis." },
    beneficial: { credited: true, basis: "An early relief that limits the cover-gas pressure is kept, since dropping it would distort the cover-gas leak family." },
  },
  cells: [
    {
      id: "BC-1",
      barrierId: "Stainless steel cladding",
      modeId: "FM-1",
      familyId: "ESF-LATE",
      mechanismIds: ["PH-1"],
      variable: "Time to restart decay heat removal",
      unit: "min",
      basis: "REALISTIC",
      load: {
        source: "TYPED",
        variable: { law: { family: "POINT", value: 60 }, fields: [] },
        basis: "HR-POST-005: the low DRACS flow alarm comes 25 min after the loss and the start takes 35 min, so backup decay heat removal restarts 60 min after it is lost.",
      },
      capacity: {
        source: "TYPED",
        variable: { law: { family: "UNIFORM", lower: 180, upper: 210 }, fields: [] },
        basis: "SC probes at full power with two DRACS loops: a start at 180 min keeps the cladding below 650 C and a start at 210 min does not (TF-CALC-06, TF-CALC-09).",
      },
      aging: "The probes use the end-of-cycle decay heat, so the heat-up window already holds its largest in-service load.",
      use: "END_STATE_ATTRIBUTE",
      assumption: {
        calculation: "DRACS start-window probes of the coupled dynamic campaign for the design-stage core (TF-CALC-09).",
        closure: "Repeat with the as-built DRACS air-side performance before operation.",
      },
    },
  ],
  credits: [
    {
      id: "CR-1",
      kind: "EQUIPMENT",
      qualificationId: "SPC-3",
      name: "Confinement isolation dampers in the sodium-fire environment",
      familyIds: ["ESF-EARLY"],
      environment: "Heat and sodium aerosol from a sodium leak (IEG-07, IEG-09)",
      beyondQualification: true,
      credited: false,
      analysis: "",
      basis: "No survivability analysis covers the dampers beyond their qualification, so ESQ takes no credit. SY already carries the damper failure in that environment as a dependent failure.",
    },
  ],
};

const postWork: EsqPostWork = {
  recoveries: [
    { id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "HR shows cues, time, crew, procedure and access for restoring decay heat removal from the remote panel (REC-Q-1). It applies wherever the backup decay heat removal fails to start." },
    { id: "REC-2", groupIds: [], stateIds: [], credited: false, basis: "HR has not shown the crew for the off-shift case, so the manual cross-tie is not credited." },
    { id: "REC-3", groupIds: [], stateIds: [], credited: false, basis: "Local access during the event is still under review against the as-built layout, so re-opening the damper is not credited." },
  ],
  combinations: [
    { id: "HC-1", eventIds: [syEventId("SDR-HFE"), esqRecoveryEventId("REC-1")], dependencyId: "DEP-7", ofRecord: "HRA", groupIds: [], stateIds: [], basis: "The crew that failed to start backup decay heat removal performs the remote-panel restoration. HR rates the pair moderate (DEP-7)." },
  ],
};

const review: EsqReviewWork = {
  comparison: {
    possible: false,
    reason: "The reference sodium reactor PRA (ESQ-DOC-01) reports core damage sequences, not release families with these release categories, and the Generic SFR differs in its decay heat removal and confinement. So its frequencies cannot be compared with these. It is used only to check that the loss of heat sink and the decay heat removal systems lead the contributors.",
    plants: [],
  },
  screened: [
    {
      groupId: "IE-22",
      familyId: "ESF-LATE",
      frequency: 3.3e-2,
      conditional: 7.0e-5,
      basis: "IE bounds the loss of shield cooling at 3.3E-2 per year from zero events. The plant shuts down with both decay heat removal paths in service, so a release needs the intermediate loop and DRACS to fail, as in the loss of heat sink tree, whose late-release conditional is 7.0E-5 at full power.",
    },
    {
      groupId: "IE-23",
      familyId: "ESF-LATE",
      frequency: 0.18,
      conditional: 7.0e-5,
      basis: "IE gives 0.18 per year from EBR-II data. The air loss forces a shutdown with a loss of feedwater, which is a loss of heat sink, so the bound takes the late-release conditional of that tree, 7.0E-5 at full power.",
    },
    {
      groupId: "IEG-DEPENDENCY-DEMO",
      frequency: 0,
      conditional: 1,
      basis: "Not a plant initiator. The group exists only to demonstrate the protection dependency in ES, so it adds no frequency.",
    },
  ],
};

const HS_REASON = "Concerns hazards that Step 01 leaves to their own PRA workbooks, so it moves no family quantified here.";

const decisions: EsqRegisterDecision[] = [
  { id: "DA:SOURCE:MU-1", familyIds: ["ESF-LEAK", "ESF-EARLY"], caseIds: [], reason: "The adjustment moves the make-up pump, which only the drain-down trees ask. Step 07 shows its importance, and DA's sweep (SS-1) bounds it at five times the estimate." },
  { id: "DA:SOURCE:MU-2", familyIds: ["ESF-ATWS"], caseIds: ["SS-2-HIGH"], reason: "" },
  { id: "DA:SOURCE:MU-3", familyIds: ["ESF-LATE"], caseIds: ["SS-3-LOW", "SS-3-HIGH"], reason: "" },
  { id: "DA:SOURCE:MU-4", familyIds: RELEASE_FAMILIES, key: true, caseIds: ["SS-4-LOW", "SS-4-HIGH"], reason: "" },
  { id: "DA:SOURCE:MU-5", familyIds: RELEASE_FAMILIES, key: true, caseIds: [], reason: "The group frequencies enter from IE, and each scales its own sequences in proportion, so Step 07 reads the effect from the initiator shares. A case on one DA frequency parameter would leave the run unchanged." },
  { id: "DA:SOURCE:MU-6", familyIds: ["ESF-LATE", "ESF-EARLY"], key: true, caseIds: ["SS-6-HIGH"], reason: "" },
  { id: "SY:SOURCE:MU-DRC-2", familyIds: ["ESF-LATE", "ESF-EARLY"], key: true, caseIds: ["SC-1"], reason: "" },
  { id: "SY:SOURCE:DU-DRC-1", familyIds: ["ESF-LATE", "ESF-EARLY"], key: true, caseIds: ["SC-5"], reason: "" },
  { id: registerEntryId("HR", "SOURCE", "Borrowed nonnuclear human-performance data"), familyIds: RELEASE_FAMILIES, key: true, caseIds: ["SC-4"], reason: "" },
  { id: registerEntryId("ESQ", "SOURCE", "Sodium-air reaction phenomena model"), familyIds: ["ESF-EARLY"], key: true, caseIds: [], reason: "Step 04 carries the sodium fire load on the confinement without a load and capacity cell yet, so there is no parameter to vary. The case follows once the cell exists." },
  { id: registerEntryId("ESQ", "SOURCE", "Guard-vessel localized failure mode"), familyIds: [], key: false, caseIds: [], reason: "SY models the guard vessel only at the system level, with no fault tree in the linked model, so no family takes its failure. MS carries the localized leak in the source term." },
  { id: registerEntryId("ESQ", "SOURCE", "State-of-knowledge correlation handling"), familyIds: RELEASE_FAMILIES, key: false, caseIds: [], reason: "Step 08 samples with shared draws and repeats the sampling with independent draws to show the effect." },
  { id: "HS:SOURCE:HS-UNC-001", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-002", familyIds: [], caseIds: [], reason: HS_REASON },
  { id: "HS:SOURCE:HS-UNC-003", familyIds: RELEASE_FAMILIES, key: false, caseIds: [], reason: "The sodium fire and seismic trees take their frequencies from IE, so a change scales their sequences in proportion. Step 07 reads the effect from the initiator shares." },
  { id: "HS:SOURCE:HS-UNC-004", familyIds: [], caseIds: [], reason: "The fire and seismic trees ask the plant functions directly, and the hazard-induced failures of the other groups sit in their own hazard PRAs, so no internal-events family moves." },
  { id: "HS:SOURCE:HS-UNC-005", familyIds: [], caseIds: [], reason: "Concerns the consequence surrogate HS used for screening, which ESQ does not use." },
  { id: "HS:SOURCE:HS-UNC-006", familyIds: [], caseIds: [], reason: "The fire and seismic trees are quantified here once and their initiators are not added to the internal-events frequencies, so no family counts them twice. RI checks the overlap with the other hazard PRAs." },
];

const sensitivityWork: EsqSensitivityWork = {
  decisions,
  cases: [
    { id: "SC-1", name: "DRACS loop failure at ten times its estimate", kind: "PARAMETER", target: "DA-BE-031", factor: 10, basis: "SY takes the loop natural-circulation failures from sodium test facility experience (MU-DRC-2). Ten times the estimate spans the spread of that experience." },
    { id: "SS-2-HIGH", name: "Test-interval sweep · high", kind: "PARAMETER", target: "DA-BE-082", value: 3.0480034508374184e-4, basis: "The sensor input module estimate with semiannual channel tests in place of quarterly ones.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-2" } },
    { id: "SS-3-LOW", name: "Pump maintenance sweep · low", kind: "PARAMETER", target: "DA-UA-03", value: 0.0014840182648401827, basis: "Intermediate pump maintenance between half and twice the planned 26 h a year.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-3" } },
    { id: "SS-3-HIGH", name: "Pump maintenance sweep · high", kind: "PARAMETER", target: "DA-UA-03", value: 0.005936073059360731, basis: "Intermediate pump maintenance between half and twice the planned 26 h a year.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-3" } },
    { id: "SS-4-LOW", name: "Coincident-maintenance sweep · low", kind: "PARAMETER", target: "DA-UA-05", value: 0, basis: "The joint battery equalization unavailability from none to 5.0E-3.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-4" } },
    { id: "SS-4-HIGH", name: "Coincident-maintenance sweep · high", kind: "PARAMETER", target: "DA-UA-05", value: 5.0e-3, basis: "The joint battery equalization unavailability from none to 5.0E-3.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-4" } },
    { id: "SS-6-HIGH", name: "DRACS loop testing scheme · high", kind: "CCF_TOTAL", target: "CCF-DRACS-LOOP", factor: 1.73e-4 / 5.94e-5, basis: "The three DRACS loops tested on one day instead of staggered. The group total scales by DA's all-members ratio.", daCaseRef: { workbookId: DA_LINK, caseId: "SS-6" } },
    { id: "SC-4", name: "Every HEP at its 95th percentile", kind: "HEP_95TH", basis: "HR borrows nonnuclear performance data for a crew that does not yet exist. The 95th percentile of each HEP bounds that applicability gap." },
    { id: "SC-5", name: "DRACS loops failed together", kind: "GROUP_FAILED", target: "CCF_GROUP:CCF-DRACS-LOOP", basis: "Bounds the shared north penetration room failure that SY has not yet modeled (SY-B8) by failing the three loops together." },
    { id: "SC-6", name: "No recovery and no HFE dependency", kind: "LOGIC", logic: { recovery: false, dependency: false }, basis: "Shows what the remote-panel restoration credit and the joint HEPs change, the dependency treatment that ESQ-C16 asks to be tested." },
  ],
};

const handoffWork: EsqHandoffWork = {
  responses: [
    { id: "FAMILY:ESF-LATE", kind: "FAMILY", ref: "ESF-LATE", response: "One linked run now gives the family, 2.66E-4 per year over the 54 trees, with its sequences and cut sets in Step 05. The DRACS damper misalignment (HR-PRE-022, FV 0.77) leads it. The restoration credit (REC-1) and its joint HEP with the backup start (HC-1 at HR's DEP-7) lower it by 7.06% in Step 06.", status: "COMPLETED" },
    { id: "FAMILY:ESF-EARLY", kind: "FAMILY", ref: "ESF-EARLY", response: "The linked run puts ESF-EARLY at 5.07E-3 per year. The joint battery equalization (DA-UA-05, FV 0.55) and the equalization error (HR-PRE-041, FV 0.44) set almost all of it through the drained-state trees, while the confinement damper group has an FV of 9.2E-6. SY decides how confinement isolation responds to a loss of DC.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "FAMILY:ESF-ATWS", kind: "FAMILY", ref: "ESF-ATWS", response: "The family now comes from the linked trees at 1.55E-2 per year, and Step 08 samples it (mean 1.55E-2, 95th 4.74E-2). SY's bound that a loss of DC fails the trip (MU-RPS-2) sets 99% of it. The failure-to-trip tree goes to SY with that bound.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "FAMILY:ESF-LEAK", kind: "FAMILY", ref: "ESF-LEAK", response: "Kept under review. The linked run makes ESF-LEAK the largest release family at 3.56E-2 per year, led by the loss of DC (61%) and the DRACS damper misalignment (HR-PRE-022, 30%). Its grouping reason stays in Step 02, and the cover-gas leak-rate data goes to MS.", status: "IN_PROGRESS", sentTo: "MS" },
    { id: "CONTRIBUTOR:Erroneous control-rod withdrawal (IE-07)", kind: "CONTRIBUTOR", ref: "Erroneous control-rod withdrawal (IE-07)", response: "IE-07 sits in IEG-04, which ESQ takes at 0.31 per year from DA (DA-IE-04). Its trees put 1.38E-3 per year into ESF-ATWS, 8.9% of the family, at a conditional of 4.5E-3 that the DC bound sets. The frequency and the binning go to IE.", status: "IN_PROGRESS", sentTo: "IE" },
    { id: "CONTRIBUTOR:DRACS loop common-cause failure (CCF-DRACS-LOOP)", kind: "CONTRIBUTOR", ref: "DRACS loop common-cause failure (CCF-DRACS-LOOP)", response: "Held against DA. The group has an FV of 0.039 and a RAW of 77 on ESF-LATE. Step 09 case SS-6-HIGH (loops tested on one day) raises the release total from 5.65E-2 to 5.83E-2 per year, and SC-5 (all loops failed) to 1.13 per year, since the drained states then lose all heat removal.", status: "IN_PROGRESS", sentTo: "DA" },
    { id: "CONTRIBUTOR:Confinement isolation damper common-cause failure (CCF-CIS-DMP)", kind: "CONTRIBUTOR", ref: "Confinement isolation damper common-cause failure (CCF-CIS-DMP)", response: "The linked run gives the damper group an FV of 9.2E-6 and a RAW of 3.8 on ESF-EARLY, since a loss of DC fails confinement isolation first. The group stays as it is until SY settles that response.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "CONTRIBUTOR:Shutdown system fails to trip (CCF-RPS-DIV)", kind: "CONTRIBUTOR", ref: "Shutdown system fails to trip (CCF-RPS-DIV)", response: "The linked run gives the division group an FV of 3.7E-5 and a RAW of 3.9 on ESF-ATWS. The loss of DC sets 99% of that family, so the group goes to SY with the failure-to-trip tree.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "CONTRIBUTOR:Operator fails to start standby clean-up train (HR-POST-022)", kind: "CONTRIBUTOR", ref: "Operator fails to start standby clean-up train (HR-POST-022)", response: "The linked run gives it an FV of 5.3E-5 and a RAW of 1.01 on ESF-EARLY, below both significance thresholds. HR keeps the screening value.", status: "COMPLETED", sentTo: "HR" },
    { id: "CONTRIBUTOR:Loss of room cooling support (SYS-HVAC)", kind: "CONTRIBUTOR", ref: "Loss of room cooling support (SYS-HVAC)", response: "Kept visible. Step 07 marks the HVAC system significant on its RAW of 3.9 on ESF-ATWS and 3.7 on ESF-EARLY, though its FV is only 1.4E-3.", status: "COMPLETED" },
    { id: "CONTRIBUTOR:Station battery common-cause failure (CCF-DC-BATT)", kind: "CONTRIBUTOR", ref: "Station battery common-cause failure (CCF-DC-BATT)", response: "Held against DA. The battery group has an FV of 8.1E-5 and a RAW of 221. The joint equalizing charge (DA-UA-05, FV 0.55) and the equalization error (HR-PRE-041, FV 0.44) dominate class 1E DC instead, and Step 09's DA-UA-05 sweep moves the release total from 3.30E-2 to 7.96E-2 per year. SY decides whether the joint equalization stays one event.", status: "IN_PROGRESS", sentTo: "SY" },
    { id: "CONTRIBUTOR:Operator fails to start backup decay heat removal (HR-POST-005)", kind: "CONTRIBUTOR", ref: "Operator fails to start backup decay heat removal (HR-POST-005)", response: "Kept at detailed treatment. The linked run gives it an FV of 6.6E-3 and a RAW of 10.6 on ESF-LATE, with its joint HEP with the restoration credit (HC-1) taken from HR's DEP-7.", status: "COMPLETED", sentTo: "HR" },
    { id: "GENERAL", kind: "GENERAL", ref: "GENERAL", response: "The linked quantification changes what RI used. The release total is 5.65E-2 per year (95th 1.46E-1), and the loss of class 1E DC sets 75% of it through the trip, the DRACS dampers and confinement isolation. ES records that the DRACS dampers fail open on a loss of DC (DEP-1), so SY decides the fail-safe response before RI recomputes from this package.", status: "IN_PROGRESS", sentTo: "SY" },
  ],
};

export const ESQ_ANALYSIS: EventSequenceQuantification = {
  uuid: "esq-generic-1",
  name: "ESQ Workbook 2",
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
    scope: "Event sequence quantification for the Generic-1 sodium-cooled fast reactor, integrating the seven upstream elements into the frequencies of event-sequence families, the only numbers the model exists to produce.",
    limitations: ["Pre-operational: the quantification inherits its pre-operational character through the upstream parameters and models, with two assumptions of its own."],
    lastModifiedDate: NOW,
    lastModifiedBy: "mfeld",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "esqc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-24T09:14:00.000Z", associatedSr: "ESQ-C4", text: "The instrument cabinet is assumed independent of the sodium-air reaction, so ESQ-C4 needs the separation distance and the thermal basis shown before the independence assumption holds.", severity: "MAJOR", resolved: false },
      { uuid: "esqc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-24T10:30:00.000Z", associatedSr: "ESQ-D7", text: "The room cooling support ranks higher than expected, so ESQ-D7 needs the reconciliation recorded so the high ranking is shown to be correct rather than an artifact.", severity: "MAJOR", resolved: false },
      { uuid: "esqc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-25T14:05:00.000Z", associatedSr: "ESQ-A1", text: "The boundary-leak family groups across two sources, so ESQ-A1 needs the cross-source grouping justified so it does not mask a contributor.", severity: "MINOR", resolved: false },
      { uuid: "esqc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-25T15:20:00.000Z", associatedSr: "ESQ-B3", text: "The truncation convergence is demonstrated cleanly down to the chosen cutoff.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the convergence demonstration is complete.", resolvedAt: "2026-05-25T16:30:00.000Z", resolvedBy: "rev-2" },
      { uuid: "esqc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-25T16:00:00.000Z", associatedSr: "ESQ-D8", text: "The screened initiators are bounded individually, so ESQ-D8 needs the cumulative sum shown against the threshold, not just the individual bounds.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Event sequence quantification for the single-module Generic SFR at the pre-operational stage, capability category CC-II. It covers all nine plant operating states, the 13 internal initiator groups of the IE workbook, and the sodium fire and seismic drivers that ES models as their own event trees. The radioactive sources are those POS lists: the in-core metallic driver fuel at power and in decay, the activated primary sodium and the spent subassemblies in in-tank storage. It quantifies the 323 sequences of the 54 ES event trees and their five families. Internal floods, high winds, external floods and the other hazards are quantified in their own hazard PRA workbooks.",
  linkedWorkbooks: { ES: "example-es-sfr", SY: "example-sy-sfr", DA: "example-da-sfr", HRA: "example-hr-sfr", IE: "example-ie-sfr", POS: "example-pos-sfr", SC: "example-sc-sfr", RI: "example-ri-sfr", HS: "example-hs-sfr" },
  modelDecisions,
  logic,
  barrierWork,
  postWork,
  review,
  sensitivityWork,
  handoffWork,
  quantificationPlan: { modulesPerPlant: { value: 1, link: { element: "IE", workbookId: "example-ie-sfr", field: "numberOfModules" } } },
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
    systemsWithSuccessModeled: ["SYS-DRACS", "SYS-RPS"],
    impactOnResults: "Keeping the success complements avoids an overestimate of the risk-significant family frequencies.",
    modelingExamples: ["The decay-heat removal success path is retained in the loss-of-flow sequences, consistent with the demonstrated natural-circulation transients (ESQ-DOC-02)."],
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
    analysisRef: "ri-generic-1",
    feedbackDate: NOW,
    sequenceFeedback: [
      { sequenceRef: "ESF-LATE", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Carries 87.3% of the 100 mrem frequency and 25.2% of the latent cancer risk."], recommendations: ["Keep the three-quantification aggregation visible so the family total stays auditable.", "Refine the decay-heat removal recovery terms behind the late release."] },
      { sequenceRef: "ESF-EARLY", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Carries 53.6% of the early fatality risk and 39.1% of the latent cancer risk."], recommendations: ["Refine the confinement isolation and recovery terms."] },
      { sequenceRef: "ESF-ATWS", riskSignificance: ImportanceLevel.MEDIUM, insights: ["Carries 46.4% of the early fatality risk and 33.8% of the latent cancer risk."], recommendations: ["Carry the dedicated failure-to-trip tree to final quantification and give the family a frequency distribution."] },
      { sequenceRef: "ESF-LEAK", riskSignificance: ImportanceLevel.LOW, insights: ["Carries 1.98% of the latent cancer risk."], recommendations: ["Keep the cover-gas leak grouping under review as the leak-rate data matures."] },
    ],
    generalFeedback: "No family or contributor is risk-significant under NEI 18-04, and every total sits far below its target. The late release carries most of the 100 mrem frequency and the early-release pair most of the latent and early fatality risk, so refine the decay-heat removal and confinement isolation terms and finalize the failure-to-trip tree.",
    response: {
      description: "The DRACS loop and confinement damper groups are held against their data-analysis parameters and the failure-to-trip tree is scheduled for final quantification.",
      changes: ["CCF-DRACS-LOOP and CCF-CIS-DMP held against their data-analysis parameters", "HR-POST-022 queued for detailed treatment with the human-reliability analysis", "Dedicated failure-to-trip tree scheduled"],
      status: "IN_PROGRESS",
    },
  },
  modelUncertainty: {
    uuid: "esq-mu-1",
    name: "ESQ model uncertainty documentation",
    uncertaintySources: [
      { source: "Sodium-air reaction phenomena model", impact: "Carried as an uncertainty source and tested by sensitivity." },
      { source: "Guard-vessel localized failure mode", impact: "Bounded by a conservative capacity until the design is confirmed." },
      { source: "State-of-knowledge correlation handling", impact: "Handled by a common random seed, with the impact assessed." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  documentation,
  exampleDocuments: [
    { id: "ESQ-DOC-01", name: "EBR-II Level 1 PRA", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-NSE-2", extracted: "The reference plant quantification whose family frequencies, contributors and importance rankings anchor the results review", linked: 2, url: "/api/example-documents/esq/sfr-pra" },
    { id: "ESQ-DOC-02", name: "EBR-II SHRT Benchmark Specifications", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-ARC-226", extracted: "Transient benchmark data behind the passive decay-heat success branches kept in the sequence logic", linked: 1, url: "/api/example-documents/esq/sfr-benchmark" },
    { id: "ESQ-DOC-03", name: "Benchmark Analysis of EBR-II SHRT", kind: "doc", sizeLabel: "IAEA", uploadedLabel: "IAEA-TECDOC-1819", extracted: "Validated transient analyses backing the quantification-code validation cases", linked: 1, url: "/api/example-documents/esq/sfr-shrt-analysis" },
    { id: "ESQ-DOC-04", name: "EBR-II Hazard Summary Report", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-5719", extracted: "Plant design data behind the hazard-group scope and the barrier capacity evaluations", linked: 1, url: "/api/example-documents/esq/sfr-hazard" },
  ],
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-070", "NM-074", "NM-078"],
};

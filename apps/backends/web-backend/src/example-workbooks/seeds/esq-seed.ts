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
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-05-26T12:00:00.000Z";
const CREATED = "2026-05-21T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(4) as HlrId }));
}

const WARN_SRS = new Set<string>(["ESQ-C4", "ESQ-D7"]);

const SR_EVIDENCE: Record<string, string> = {
  "ESQ-A1": "Twenty-four sequences grouped into five families with like end states and like dependencies.",
  "ESQ-A2": "The sequences, system logic, data and human reliability are integrated across two sources, six groups, three hazard groups and nine states.",
  "ESQ-A4": "Each family carries a quantified frequency with its percentiles.",
  "ESQ-A5": "The risk-significant families carry means propagated with the state-of-knowledge correlation.",
  "ESQ-B1": "Two codes demonstrated against accepted algorithms, with the limitations identified.",
  "ESQ-B3": "The truncation limit is set by an iterative convergence demonstration down to 1E-13 per year.",
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
    uuid: "ESF-1",
    name: "Loss of decay-heat removal",
    eventSequenceFamilyRef: "FAM-DHR-LOSS",
    crossPosGroupingJustification: "Grouped across the standby and reduced-power states, since the end state and the dependencies match.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "The headline family, the loss-of-decay-heat sequences from the vertical slice.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 3.2e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 2.6e-7, errorFactor: 3 },
    percentile05: 9.0e-8,
    percentile50: 2.6e-7,
    percentile95: 9.4e-7,
    significantUncertaintySources: ["DHR pump common-cause parameter", "Borrowed sodium-facility prior"],
    contributionBreakdown: [
      { contributorRef: "DHR pump common-cause failure", contributorType: "CCF", fractionalContribution: 0.41 },
      { contributorRef: "Loss of room cooling support", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.27 },
      { contributorRef: "Operator fails to start backup DHR", contributorType: "HUMAN_FAILURE_EVENT", fractionalContribution: 0.18 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "ESF-2",
    name: "Protected loss of primary flow",
    eventSequenceFamilyRef: "FAM-PLOF",
    crossPosGroupingJustification: "Grouped within the at-power state only, so no cross-state grouping is taken.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A protected flow-loss family that relies on the shutdown and flow-coastdown functions.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 1.1e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 8.8e-8, errorFactor: 3 },
    percentile05: 3.1e-8,
    percentile50: 8.8e-8,
    percentile95: 3.3e-7,
    significantUncertaintySources: ["Pony-motor transfer reliability"],
    contributionBreakdown: [
      { contributorRef: "Reactor protection channel failure", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.38 },
      { contributorRef: "Pony-motor failure to transfer", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.34 },
      { contributorRef: "Primary pump trip frequency", contributorType: "INITIATING_EVENT", fractionalContribution: 0.2 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "ESF-3",
    name: "Primary sodium boundary leak",
    eventSequenceFamilyRef: "FAM-NA-LEAK",
    crossPosGroupingJustification: "Grouped within the at-power state only.",
    crossSourceGroupingJustification: "Grouped across the primary and the cover-gas sources, with the grouping justified by the shared barrier response. The cross-source grouping justification is under review.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A boundary-leak family where the barrier challenge and capacity drive the result.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 8.0e-8,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 6.2e-8, errorFactor: 4 },
    percentile05: 2.0e-8,
    percentile50: 6.2e-8,
    percentile95: 2.5e-7,
    significantUncertaintySources: ["Guard-vessel localized failure mode", "Sodium-air reaction phenomena"],
    contributionBreakdown: [
      { contributorRef: "Sodium-to-air heat exchanger leak", contributorType: "INITIATING_EVENT", fractionalContribution: 0.45 },
      { contributorRef: "Guard-vessel localized failure", contributorType: "BARRIER_FAILURE_MODE", fractionalContribution: 0.3 },
      { contributorRef: "Leak-detection and isolation failure", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.19 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
  },
  {
    uuid: "ESF-4",
    name: "Loss of offsite power with DHR challenge",
    eventSequenceFamilyRef: "FAM-LOOP-DHR",
    crossPosGroupingJustification: "Grouped across the at-power and the hot-standby states, since the response is the same.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A station-blackout family driven by the recovery timing.",
    quantificationBasis: "MEAN_PROPAGATED_SOKC",
    meanFrequency: 2.4e-7,
    frequencyDistribution: { type: DistributionType.LOGNORMAL, median: 1.9e-7, errorFactor: 3 },
    percentile05: 6.6e-8,
    percentile50: 1.9e-7,
    percentile95: 7.2e-7,
    significantUncertaintySources: ["Offsite-power recovery time", "Diesel common-cause parameter"],
    contributionBreakdown: [
      { contributorRef: "Diesel generator common-cause failure", contributorType: "CCF", fractionalContribution: 0.36 },
      { contributorRef: "Battery depletion before recovery", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.29 },
      { contributorRef: "Offsite-power non-recovery", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.22 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4", "ESQ-A5"),
  },
  {
    uuid: "ESF-5",
    name: "Reactivity insertion transient",
    eventSequenceFamilyRef: "FAM-RIT",
    crossPosGroupingJustification: "Grouped within the at-power state only.",
    dependenciesConsideredInGrouping: true,
    representativeSequenceSelectionBasis: "A non-risk-significant transient carried at a point estimate at CC-I.",
    quantificationBasis: "POINT_ESTIMATE",
    meanFrequency: 4.5e-8,
    contributionBreakdown: [
      { contributorRef: "Control-rod withdrawal frequency", contributorType: "INITIATING_EVENT", fractionalContribution: 0.52 },
      { contributorRef: "Shutdown system failure", contributorType: "EQUIPMENT_FAILURE", fractionalContribution: 0.33 },
    ],
    implementsSrs: srs("ESQ-A1", "ESQ-A4"),
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
    radionuclideSources: ["SRC-CORE", "SRC-COVER-GAS"],
    initiatingEventGroups: ["IEG-01", "IEG-02", "IEG-03", "IEG-04", "IEG-05", "IEG-06", "IEG-07", "IEG-08", "IEG-09", "IEG-10", "IEG-11", "IEG-12", "IEG-13", "HZ-FIRE", "HZ-SEIS"],
    hazardGroups: ["Internal events", "Seismic", "External flood"],
    plantOperatingStates: ["POS-1", "POS-2", "POS-3", "POS-4", "POS-5", "POS-6", "POS-7", "POS-8", "POS-9"],
    plantEvolutions: ["EVOL-STARTUP", "EVOL-FULL-POWER", "EVOL-SHUTDOWN", "EVOL-REFUELING"],
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
  rareEventJustification: "The rare-event approximation is not relied on for risk-significant families, since MCUB and exact solutions are used there.",
  computerCodes: [
    {
      name: "Cutset quantification code",
      version: "2.4",
      verificationDocumentation: "Verified against the accepted minimal-cutset algorithm on a reference model.",
      validationDocumentation: "Validated on the benchmark sequence set with known results.",
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
    basisForSelection: "The limit is lowered until the family frequency changes by less than half a percent.",
    convergenceDemonstration: "The loss-of-decay-heat family frequency settles at 3.23E-7 per year at a cutoff of 1E-13 per year.",
    dependenciesPreservedAtTruncation: true,
    mergedCutsetTruncationConfirmed: true,
    mergedCutsetConfirmationBasis: "The system-level cutsets are re-confirmed after merging to the sequence level.",
    truncationSensitivity: "The family frequencies hold within a few percent below the chosen cutoff.",
    implementsSrs: srs("ESQ-B2", "ESQ-B3"),
  },
  postInitiatorHfeHandling: "The post-initiator human failure events are carried into the cutsets with their joint-dependency rules applied.",
  implementsSrs: srs("ESQ-A6", "ESQ-B4"),
};

const dependencyTreatment: DependencyTreatment = {
  dependenciesByType: [
    { type: DependencyType.FUNCTIONAL, treatmentDescription: "Support-system dependencies are carried explicitly in the linked logic.", modelingMethod: "Shared fault-tree logic with explicit support gates.", examples: ["Room cooling support of the decay-heat pumps"] },
    { type: DependencyType.HUMAN, treatmentDescription: "Multiple human failure events in one cutset are assessed for their joint dependency.", modelingMethod: "Joint human error probabilities per the human reliability assessments.", examples: ["The decay-heat start, alignment and recovery actions"] },
    { type: DependencyType.PHENOMENOLOGICAL, treatmentDescription: "Phenomenological dependencies on credited equipment are assessed, with independence justified.", modelingMethod: "Phenomena logic included in the family models.", examples: ["Sodium-air reaction heat against the cell that houses the decay-heat path"] },
    { type: DependencyType.COMMON_CAUSE, treatmentDescription: "Common-cause failures are modeled with the parameters supplied by the data analysis.", modelingMethod: "Common-cause basic events inside the system logic.", examples: ["The three-pump decay-heat common-cause group"] },
  ],
  postInitiatorHfeDependencyMethod: "The joint dependency of co-occurring human failure events is assessed per the human reliability requirements.",
  postInitiatorHfeDependencyBasis: "The joint-HEP floor built in the human reliability analysis binds the product at the cutset level.",
  ccfTreatment: {
    modelingApproach: "Common-cause basic events carried inside the system fault trees.",
    parameterBasis: "The alpha-factor and beta-factor parameters supplied by the data analysis.",
    ccfGroupRefs: ["CCFG-DHR-FTS", "CCFG-DC-CHG"],
  },
  recoveryDependencyTreatment: "Recovery actions are applied with their dependence on the cause carried explicitly.",
  implementsSrs: srs("ESQ-C1", "ESQ-C2"),
};

const circularLogicResolutions: CircularLogicResolution[] = [
  {
    uuid: "CL-1",
    description: "Cooling support and electrical support each need the other",
    involvedElementIds: ["SYS-HVAC", "SYS-DC"],
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
    description: "Two redundant trains in maintenance at once",
    eventIds: ["HE-MAINT-A", "HE-MAINT-B"],
    basis: "The technical specifications forbid both trains out together.",
    identifiedInResults: true,
    treatment: "LOGIC_ELIMINATION",
    implementsSrs: srs("ESQ-B7", "ESQ-B8"),
  },
  {
    uuid: "MX-2",
    description: "Refueling alignment with at-power initiator",
    eventIds: ["HE-REFUEL", "IE-PHTS-TRIP"],
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
    applicableFamilyRefs: ["ESF-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-2",
    name: "Standby state cover-gas path",
    purpose: "Enables the cover-gas path that exists only in standby",
    state: true,
    effect: "Includes the cover-gas heat path in the standby-state model.",
    basis: "The cover-gas path exists only in the standby configuration, so the flag selects it per state.",
    isTemporary: false,
    applicableFamilyRefs: ["ESF-1"],
    setPriorToCutsetGeneration: true,
    implementsSrs: srs("ESQ-B9"),
  },
  {
    uuid: "FL-3",
    name: "At-power pony-motor logic",
    purpose: "Selects the at-power flow-coastdown logic",
    state: true,
    effect: "Includes the pony-motor transfer logic in the at-power model.",
    basis: "The pony-motor transfer applies only at power, so the flag selects the at-power logic.",
    isTemporary: false,
    applicableFamilyRefs: ["ESF-2"],
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
    hfeRefs: ["HFE-START-DHR", "HFE-ALIGN-BACKUP", "HFE-RECOVER-COOLING"],
    potentialRiskImpact: "The cutset is risk-significant, so the joint dependency is assessed per HR and the joint floor binds the product.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
  {
    uuid: "MH-2",
    cutsetDescription: "CS-LOOP-0098, two human failure events appear together in a station-blackout cutset.",
    hfeRefs: ["HFE-LOAD-SHED", "HFE-RECOVER-OFFSITE"],
    potentialRiskImpact: "The cutset is risk-significant, and the two actions share the same crew and timeline, so the dependence is not negligible.",
    implementsSrs: srs("ESQ-C1", "ESQ-C2"),
  },
];

const hfeDependencyApplications: HfeDependencyApplication[] = [
  {
    uuid: "HD-1",
    hrDependencyAssessmentRef: "HR-G12",
    cutsetContext: "CS-DHR-0142",
    appliedJointHep: 1.0e-3,
    implementsSrs: srs("ESQ-C2"),
  },
  {
    uuid: "HD-2",
    hrDependencyAssessmentRef: "HR-G7",
    cutsetContext: "CS-LOOP-0098",
    appliedJointHep: 4.0e-3,
    implementsSrs: srs("ESQ-C2"),
  },
];

const linkingTransferRecords: LinkingTransferRecord[] = [
  {
    uuid: "LT-1",
    sourceTreeDescription: "Loss-of-flow tree",
    targetTreeDescription: "Decay-heat-removal tree",
    failedEquipmentTransferred: ["Primary pump A", "Pony motor A"],
    flagSettingsTransferred: ["HE-PONY"],
    otherCharacteristicsTransferred: ["The failed pump and the pony-motor flag carry into the decay-heat tree."],
    frequencyTransferred: true,
    implementsSrs: srs("ESQ-C3"),
  },
  {
    uuid: "LT-2",
    sourceTreeDescription: "Loss-of-offsite-power tree",
    targetTreeDescription: "Station-blackout tree",
    failedEquipmentTransferred: ["Offsite power"],
    flagSettingsTransferred: ["HE-DG-OUT"],
    otherCharacteristicsTransferred: ["The offsite-power state and the diesel alignment carry into the blackout tree."],
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
    name: "Metallic fuel cladding",
    applicableSourceRefs: ["Core inventory"],
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
    name: "Primary boundary and guard vessel",
    applicableSourceRefs: ["Primary sodium", "Cover gas"],
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
    name: "Functional containment",
    applicableSourceRefs: ["Reactor building atmosphere"],
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
    hfeRefs: ["Operator isolates the affected cell after a leak"],
    treatment: "DETAILED_RISK_SIGNIFICANT",
    basis: "A detailed analysis is performed, since the action affects a risk-significant family.",
    implementsSrs: srs("ESQ-C7"),
  },
  {
    uuid: "PR-2",
    hfeRefs: ["Operator aligns the backup filtration"],
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
    findings: "The recovery and the diesel common-cause terms appear as expected.",
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
    entityRef: "Decay-heat pump common-cause failure",
    applicableFamilyRefs: ["ESF-1"],
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
    applicableFamilyRefs: ["ESF-1", "ESF-4"],
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
    applicableFamilyRefs: ["ESF-1"],
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
    entityRef: "Diesel generator common-cause failure",
    applicableFamilyRefs: ["ESF-4"],
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
    entityRef: "Sodium-to-air heat exchanger leak",
    applicableFamilyRefs: ["ESF-3"],
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
      { entityType: "CCF_GROUP", entityRef: "DHR pump common-cause group", fussellVesely: 0.22, riskAchievementWorth: 8.4 },
      { entityType: "SYSTEM", entityRef: "Room cooling support", fussellVesely: 0.15, riskAchievementWorth: 5.1 },
      { entityType: "HUMAN_FAILURE_EVENT", entityRef: "Operator starts backup DHR", fussellVesely: 0.12, riskAchievementWorth: 4.2 },
      { entityType: "CCF_GROUP", entityRef: "Diesel generator common-cause group", fussellVesely: 0.1, riskAchievementWorth: 3.6 },
      { entityType: "BASIC_EVENT", entityRef: "Reactor protection channel", fussellVesely: 0.04, riskAchievementWorth: 1.9 },
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
  screenedInitiatingEventRefs: ["IE-SCR-03", "IE-SCR-07", "IE-SCR-11", "IE-SCR-14"],
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
    { uncertaintyId: "MU-1", description: "Sodium-air reaction phenomena model", impact: "Carried as an uncertainty source and tested by sensitivity.", isQuantified: false, treatmentApproach: "Sensitivity study across the phenomena range." },
    { uncertaintyId: "MU-2", description: "Guard-vessel localized failure mode", impact: "Bounded by a conservative capacity until the design is confirmed.", isQuantified: false, treatmentApproach: "Conservative bound carried until the as-built confirmation." },
    { uncertaintyId: "MU-3", description: "State-of-knowledge correlation handling", impact: "Handled by a common random seed, with the impact assessed.", isQuantified: true, treatmentApproach: "Common random seed across shared estimates." },
  ],
  characterizationLevel: "PROPAGATED_RISK_SIGNIFICANT_SOKC",
  parameterUncertainties: [
    { parameterRef: "DHR-PMP-A-FTS", distribution: { type: DistributionType.LOGNORMAL, median: 2.3e-3, errorFactor: 5 }, basis: "The risk-significant pump demand parameter from the data analysis." },
    { parameterRef: "DG-A-FTS", distribution: { type: DistributionType.LOGNORMAL, median: 1.2e-2, errorFactor: 4 }, basis: "The diesel start parameter from the data analysis." },
    { parameterRef: "RPS-CH-FTD", distribution: { type: DistributionType.LOGNORMAL, median: 8.0e-4, errorFactor: 4 }, basis: "The protection channel parameter from the data analysis." },
  ],
  stateOfKnowledgeCorrelation: {
    isConsidered: true,
    handlingMethod: "SAME_RANDOM_SEED",
    handlingDescription: "Shared estimates are sampled with a common random seed, so their uncertainty stays correlated.",
    correlatedParameterGroups: [
      ["DHR-PMP-A-FTS", "DHR-PMP-B-FTS", "DHR-PMP-C-FTS"],
      ["DG-A-FTS", "DG-B-FTS"],
    ],
    impactAssessment: "Ignoring the correlation would understate the loss-of-cooling mean by about a third.",
  },
  implementsSrs: srs("ESQ-E2"),
};

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "Truncation sensitivity", description: "Sweep of the truncation cutoff below the chosen value.", variedParameters: ["Truncation cutoff"], parameterRanges: { "Truncation cutoff": [1e-14, 1e-12] }, results: "The family frequencies hold within a few percent below the chosen cutoff." },
  { uuid: "SS-2", name: "State-of-knowledge correlation sweep", description: "Sweep of the correlation handling between shared estimates.", variedParameters: ["Correlation"], parameterRanges: { Correlation: [0, 1] }, results: "Ignoring the correlation would understate the loss-of-cooling mean by about a third." },
  { uuid: "SS-3", name: "Barrier-capacity sweep", description: "Sweep of the guard-vessel capacity range.", variedParameters: ["Capacity factor"], parameterRanges: { "Capacity factor": [0.5, 2] }, results: "The leak family stays below the threshold across the capacity range." },
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
  barrierCapacityBasis: "Barrier capacity is evaluated conservatively at CC-I or realistically with in-service aging at CC-II, with external-hazard capacity by fragility curves where required.",
  uncertaintySensitivityResults: "The family-frequency uncertainty is propagated with the state-of-knowledge correlation accounted for, and the sensitivity studies bound the open questions.",
  importanceResults: "The importance measures are read at the model's level of detail, and the one unexpected ranking is reconciled rather than rationalized.",
  mutuallyExclusiveEventsEliminated: "Cutsets containing events that cannot coexist are identified and corrected by logic or by deletion.",
  modelingAsymmetries: "Asymmetries between the trains and the states are carried by the flag settings, so the per-configuration models stay honest.",
  codeVerificationProcess: "The quantification codes are demonstrated against accepted algorithms, with the method-specific limitations identified.",
  undocumentedParameterEstimatesBasis: "Every parameter estimate used by the quantification traces to the data analysis, so no undocumented estimate enters the model.",
  pdsPreservationApproach: "The plant damage state attributes are preserved through the family grouping, so the source-term resolution stays possible.",
  scopeAssumptionDrivenContributors: "The contributors that rest on scope assumptions are flagged, so an assumption-driven ranking is visible.",
  similarPlantComparison: "The results are compared to a reference sodium-cooled fast reactor PRA, and the differences are explained by the passive decay-heat path.",
  riskSignificantContributorsDocumentation: "The risk-significant contributors are identified using the risk-integration criteria, with the single-reactor scope noted.",
  uncertaintySourcesDocumentation: "The model-uncertainty sources from every technical element are assessed at the quantification, qualitatively or quantitatively.",
  limitationsForApplications: "The limitations that would affect applications are recorded, including the conservative functional-containment capacity.",
  asBuiltLimitations: "Pre-operational: the quantification rests on inherited pre-operational parameters and design analyses pending as-built confirmation.",
  praTaskInterfaces: "ESQ takes the work of IE, ES, SC, SY, HR and DA, weights it across the POS states, and delivers the family frequencies to Risk Integration and the release inputs to the Mechanistic Source Term, with a risk-significance feedback loop to every input.",
  implementsSrs: srs("ESQ-F1", "ESQ-F2", "ESQ-F3", "ESQ-F4", "ESQ-F5"),
};

export const ESQ_ANALYSIS: EventSequenceQuantification = {
  uuid: "esq-generic-1",
  name: "Generic-1 Event Sequence Quantification",
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
    scope: "Event sequence quantification for the Generic-1 sodium-cooled fast reactor, integrating the six upstream elements into the frequencies of event-sequence families, the only numbers the model exists to produce.",
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
  praScope: "Full-scope event sequence quantification for the Generic-1 SFR, pre-operational stage, capability category CC-II.",
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
      familyRef: "ESF-3",
      isRiskSignificant: true,
      basis: "REALISTIC",
      justification: "Realistic phenomena parameters are used for the risk-significant boundary-leak family at CC-II.",
      implementsSrs: srs("ESQ-A9"),
    },
    {
      uuid: "PPB-2",
      familyRef: "ESF-5",
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
      appliedAtLevel: "CUTSET",
      applicableFamilyRefs: ["ESF-1"],
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
    modelingExamples: ["The decay-heat removal success path is retained in the loss-of-flow sequences."],
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
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-070", "NM-074", "NM-078"],
};

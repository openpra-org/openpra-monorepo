import {
  type DataAnalysis,
  type DataAnalysisParameter,
  type ComponentBoundary,
  type ComponentGrouping,
  type OutlierComponent,
  type ExternalDataSource,
  type FailureEventClassification,
  type DemandCountRecord,
  type ExposureTimeRecord,
  type TestCredibilityReview,
  type UnavailabilityDataRecord,
  type CoincidentMaintenanceRecord,
  type RepairTimeRecord,
  type RecoveryTimeRecord,
  type LpsdOutageDataRecord,
  type CcfParameterEstimation,
  type DataModificationAdjustment,
  type DaDocumentation,
  DA_SR_CATALOG,
} from "interfaces-mef-types/da/data-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-05-12T12:00:00.000Z";
const CREATED = "2026-04-23T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["DA-A2", "DA-C25", "DA-D2"]);

const SR_EVIDENCE: Record<string, string> = {
  "DA-A1": "Nine basic events taken from the Systems Analysis form the parameter slots to fill.",
  "DA-A2": "One component boundary, the battery charger, still has an overlap open against the Systems Analysis.",
  "DA-A3": "Each event carries a probability model that fits how it is demanded, demand or time.",
  "DA-B1": "Components pooled into three homogeneous groups by type and service.",
  "DA-B2": "Two outliers, a mothballed spare and a test charger, held out of the pools.",
  "DA-C2": "Three generic and other-facility sources collected, applicable at the pre-operational stage.",
  "DA-C9": "Demands estimated from the planned surveillance and maintenance schedule.",
  "DA-C25": "Reuse of the pump generic estimate across the standby and reduced-power states is still open.",
  "DA-D1": "Realistic combined estimates for the risk-significant events, generic estimates elsewhere.",
  "DA-D2": "The sodium check-valve adjustment from a water valve is under review.",
  "DA-D5": "The decay-heat pump posterior is checked against the borrowed technology evidence.",
  "DA-D8": "An alpha-factor model placed on the three decay-heat pumps where the Systems Analysis demanded.",
  "DA-E3": "Pre-operational limitations documented against the parameter and assumption requirements.",
};

function pathForHlr(hlr: HlrId): string {
  if (hlr === "A") return "componentBoundaries";
  if (hlr === "B") return "componentGroupings";
  if (hlr === "C") return "demandCountRecords";
  if (hlr === "D") return "parameters";
  return "documentation";
}

const conformanceMatrix: SRConformance[] = Object.keys(DA_SR_CATALOG).flatMap((code) => {
  const meta = DA_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const stages: PlantStage[] = meta.stages;
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the data analysis.";
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

const parameters: DataAnalysisParameter[] = [
  {
    uuid: "DA-P-014",
    name: "DHR pump A fails to start",
    description: "The headline standby pump on demand, the slot the whole vertical slice fills.",
    parameterType: "PROBABILITY",
    value: 2.3e-3,
    valueType: "MEAN",
    estimationApproach: "REALISTIC_COMBINED",
    isRiskSignificant: true,
    basicEventRef: "DHR-PMP-A-FTS",
    componentGroupRef: "CG-1",
    systemReference: "SYS-DRACS",
    plantOperatingStateRef: "POS-1",
    multiPosApplicabilityJustification: "Applies to POS-1 and POS-6, with applicability verified for each state before reuse.",
    componentBoundaryRef: "CB-1",
    probabilityModel: {
      distribution: { type: DistributionType.BETA, alpha: 2, betaParam: 868 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "A standby component that is asked to start, estimated per demand.",
    requiredData: "Failures and demands for the decay-heat pump group.",
    genericEvidence: {
      source: "Sodium test facility experience",
      applicability: "Technology experience from sodium facilities, applicable because the plant is pre-operational.",
      timePeriod: { startDate: "2001-01-01", endDate: "2024-12-31" },
      events: 3,
      exposureTime: 16,
    },
    bayesianUpdate: {
      performed: true,
      method: "Bayesian update with an empirical-Bayes population prior",
      prior: {
        distribution: { type: DistributionType.LOGNORMAL, median: 2.0e-3, errorFactor: 8 },
        source: "Sodium-facility population prior",
      },
      posterior: {
        distribution: { type: DistributionType.LOGNORMAL, median: 2.3e-3, errorFactor: 5 },
      },
      posteriorReasonablenessCheck: {
        evidenceStage: "TECHNOLOGY_SPECIFIC",
        evidenceWeightAssessment: "The technology evidence outweighs the thin prior.",
        reasonable: true,
        basis: "The posterior sits between the prior and the evidence.",
      },
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 2.3e-3, errorFactor: 5 },
      modelUncertaintySources: ["Borrowed sodium-facility population prior"],
      riskImplications: { affectedMetrics: ["CDF"], significanceLevel: "HIGH" },
    },
    dataSources: [
      { source: "Sodium test facility experience", sourceType: "OTHER_FACILITY_EXPERIENCE", applicabilityAssessment: "Applicability established for the standby and the reduced-power states." },
    ],
    implementsSrs: srs("DA-A1", "DA-A3", "DA-D1", "DA-D3", "DA-D5"),
  },
  {
    uuid: "DA-P-015",
    name: "DHR pump fails to run",
    description: "The same pump running, which is a rate per hour and a different object from the demand slot.",
    parameterType: "OTHER",
    value: 3.0e-5,
    valueType: "MEAN",
    estimationApproach: "REALISTIC_COMBINED",
    isRiskSignificant: true,
    basicEventRef: "DHR-PMP-A-FTR",
    componentGroupRef: "CG-1",
    systemReference: "SYS-DRACS",
    plantOperatingStateRef: "POS-1",
    multiPosApplicabilityJustification: "Applies to POS-1 and POS-6.",
    componentBoundaryRef: "CB-1",
    probabilityModel: {
      distribution: { type: DistributionType.GAMMA, shape: 1, rate: 33333 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "A running or standby component failing over time, estimated per hour.",
    requiredData: "Failures and run hours for the decay-heat pump group.",
    genericEvidence: {
      source: "Sodium test facility experience",
      applicability: "Run-hour experience from sodium facilities.",
      timePeriod: { startDate: "2001-01-01", endDate: "2024-12-31" },
      events: 1,
      exposureTime: 360,
    },
    dataSources: [
      { source: "Sodium test facility experience", sourceType: "OTHER_FACILITY_EXPERIENCE" },
    ],
    implementsSrs: srs("DA-A3", "DA-D1"),
  },
  {
    uuid: "DA-P-022",
    name: "DRACS damper fails to open",
    description: "A generic estimate carried at CC-I, since the damper is not risk-significant.",
    parameterType: "PROBABILITY",
    value: 1.2e-3,
    valueType: "MEAN",
    estimationApproach: "GENERIC",
    isRiskSignificant: false,
    basicEventRef: "DRACS-DMP-FTO",
    componentGroupRef: "CG-2",
    systemReference: "SYS-DRACS",
    plantOperatingStateRef: "POS-1",
    componentBoundaryRef: "CB-2",
    probabilityModel: {
      distribution: { type: DistributionType.BETA, alpha: 1, betaParam: 832 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "A valve or channel asked to change state, estimated per demand.",
    requiredData: "Failures and stroke-test demands for the clean-service valves.",
    genericEvidence: {
      source: "Industry component reliability database",
      applicability: "Generic estimate collected per operating state, with boundaries verified against HLR-A.",
      timePeriod: { startDate: "1990-01-01", endDate: "2022-12-31" },
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 1.2e-3, errorFactor: 10 },
    },
    dataSources: [
      { source: "Industry component reliability database", sourceType: "GENERIC_INDUSTRY" },
    ],
    implementsSrs: srs("DA-A1", "DA-C1", "DA-D1", "DA-D3"),
  },
  {
    uuid: "DA-P-031",
    name: "Battery charger fails to operate",
    description: "Technology experience stands in until plant records exist.",
    parameterType: "OTHER",
    value: 4.0e-6,
    valueType: "MEAN",
    estimationApproach: "TECHNOLOGY_SPECIFIC",
    isRiskSignificant: false,
    basicEventRef: "DC-CHG-FTOP",
    componentGroupRef: "CG-3",
    systemReference: "SYS-DC",
    plantOperatingStateRef: "POS-1",
    multiPosApplicabilityJustification: "Applies to POS-1 and POS-2.",
    componentBoundaryRef: "CB-3",
    probabilityModel: {
      distribution: { type: DistributionType.GAMMA, shape: 1, rate: 250000 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "A continuously operating component, estimated per hour.",
    requiredData: "Failures and run hours for the battery chargers.",
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 4.0e-6, errorFactor: 8 },
    },
    implementsSrs: srs("DA-C1", "DA-C2"),
  },
  {
    uuid: "DA-P-009",
    name: "Check valve fails to close",
    description: "No sodium check-valve data exists, so a water check valve is adjusted with the adjustment recorded.",
    parameterType: "PROBABILITY",
    value: 1.0e-3,
    valueType: "POINT_ESTIMATE",
    estimationApproach: "SIMILAR_EQUIPMENT_ADJUSTED",
    isRiskSignificant: false,
    basicEventRef: "PHTS-CKV-FTC",
    systemReference: "SYS-PHTS",
    plantOperatingStateRef: "POS-1",
    probabilityModel: {
      distribution: { type: DistributionType.BETA, alpha: 1, betaParam: 999 },
      source: "MANUAL",
    },
    modelSelectionBasis: "A valve asked to change state, estimated per demand.",
    requiredData: "Most similar equipment failure data, adjusted.",
    similarEquipmentAdjustment: {
      sourceEquipment: "Water check valve, clean service",
      adjustments: "Adjusted up for the sodium service and the higher reseat load.",
      justification: "No sodium check-valve data exists, so the most similar equipment is adjusted and the basis recorded.",
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 1.0e-3, errorFactor: 10 },
    },
    dataSources: [
      { source: "Nonnuclear pump and valve experience", sourceType: "OTHER_FACILITY_EXPERIENCE", applicabilityAssessment: "Single state, with no reuse across states." },
    ],
    implementsSrs: srs("DA-D2", "DA-D3"),
  },
  {
    uuid: "DA-P-040",
    name: "Primary sodium pump trip frequency",
    description: "An initiating-event frequency supplied sideways to the Initiating Events analysis.",
    parameterType: "FREQUENCY",
    value: 1.2e-2,
    valueType: "MEAN",
    estimationApproach: "GENERIC",
    isRiskSignificant: true,
    basicEventRef: "IE-PHTS-TRIP",
    systemReference: "SYS-PHTS",
    plantOperatingStateRef: "POS-1",
    probabilityModel: {
      distribution: { type: DistributionType.GAMMA, shape: 6, rate: 500 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "An initiating event counted over calendar time, estimated per year.",
    requiredData: "Trip events and calendar time from generic experience.",
    genericEvidence: {
      source: "Industry component reliability database",
      applicability: "Generic estimate collected per operating state.",
      timePeriod: { startDate: "1990-01-01", endDate: "2022-12-31" },
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 1.2e-2, errorFactor: 6 },
      riskImplications: { affectedMetrics: ["CDF"], significanceLevel: "HIGH" },
    },
    dataSources: [
      { source: "Industry component reliability database", sourceType: "GENERIC_INDUSTRY" },
    ],
    implementsSrs: srs("DA-A1", "DA-C1"),
  },
  {
    uuid: "DA-P-051",
    name: "RPS channel fails on demand",
    description: "A risk-significant protection slot estimated from generic data updated with test evidence.",
    parameterType: "PROBABILITY",
    value: 8.0e-4,
    valueType: "MEAN",
    estimationApproach: "REALISTIC_COMBINED",
    isRiskSignificant: true,
    basicEventRef: "RPS-CH-FTD",
    systemReference: "SYS-RPS",
    plantOperatingStateRef: "POS-1",
    probabilityModel: {
      distribution: { type: DistributionType.BETA, alpha: 1, betaParam: 1249 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "A channel asked to change state, estimated per demand.",
    requiredData: "Failures and test demands for the protection channel.",
    genericEvidence: {
      source: "Industry component reliability database",
      applicability: "Generic prior updated with plant test evidence.",
      timePeriod: { startDate: "1990-01-01", endDate: "2022-12-31" },
    },
    bayesianUpdate: {
      performed: true,
      method: "Bayesian update with a Jeffreys noninformative prior",
      prior: {
        distribution: { type: DistributionType.LOGNORMAL, median: 9.0e-4, errorFactor: 6 },
        source: "Generic industry prior",
      },
      posterior: {
        distribution: { type: DistributionType.LOGNORMAL, median: 8.0e-4, errorFactor: 4 },
      },
      posteriorReasonablenessCheck: {
        evidenceStage: "TECHNOLOGY_SPECIFIC",
        evidenceWeightAssessment: "The prior and the test evidence agree.",
        reasonable: true,
        basis: "The prior and the test evidence agree, so the posterior is reasonable.",
      },
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 8.0e-4, errorFactor: 4 },
      riskImplications: { affectedMetrics: ["CDF"], significanceLevel: "HIGH" },
    },
    dataSources: [
      { source: "Industry component reliability database", sourceType: "GENERIC_INDUSTRY" },
    ],
    implementsSrs: srs("DA-D1", "DA-D4", "DA-D3", "DA-D5"),
  },
  {
    uuid: "DA-P-066",
    name: "Sodium-to-air HX leak frequency",
    description: "A leak frequency adjusted from sodium-facility experience and supplied to the Initiating Events analysis.",
    parameterType: "FREQUENCY",
    value: 5.0e-3,
    valueType: "MEAN",
    estimationApproach: "SIMILAR_EQUIPMENT_ADJUSTED",
    isRiskSignificant: true,
    basicEventRef: "IE-NA-LEAK",
    systemReference: "SYS-DRACS",
    plantOperatingStateRef: "POS-1",
    probabilityModel: {
      distribution: { type: DistributionType.GAMMA, shape: 1, rate: 200 },
      source: "ESTIMATED",
    },
    modelSelectionBasis: "An event counted over calendar time, estimated per year.",
    requiredData: "Leak events and exposure time from sodium-facility experience.",
    similarEquipmentAdjustment: {
      sourceEquipment: "Sodium-facility heat-exchanger experience",
      adjustments: "Adjusted for the sodium-to-air boundary and the design flow.",
      justification: "The most similar equipment is sodium-facility experience, adjusted with the basis recorded.",
    },
    genericEvidence: {
      source: "Sodium test facility experience",
      applicability: "Technology experience from sodium facilities.",
      timePeriod: { startDate: "2001-01-01", endDate: "2024-12-31" },
    },
    uncertainty: {
      distribution: { type: DistributionType.LOGNORMAL, median: 5.0e-3, errorFactor: 7 },
      riskImplications: { affectedMetrics: ["CDF"], significanceLevel: "MEDIUM" },
    },
    dataSources: [
      { source: "Sodium test facility experience", sourceType: "OTHER_FACILITY_EXPERIENCE" },
    ],
    implementsSrs: srs("DA-C2", "DA-D2"),
  },
];

const componentBoundaries: ComponentBoundary[] = [
  {
    uuid: "CB-1",
    name: "Decay-heat removal pump",
    systemId: "SYS-DRACS",
    description: "The decay-heat removal pump with its control circuit, matched to the Systems Analysis basic event SY-A12.",
    boundaries: ["Consistent with SY-A12"],
    includedItems: ["Pump and motor", "Local breaker", "Control circuit", "Suction and discharge to the first weld"],
    excludedItems: ["Upstream sodium tank", "Remote control power supply"],
    boundaryBasis: "The generic database reports the pump with its control circuit, so the model boundary includes it.",
    implementsSrs: srs("DA-A2"),
  },
  {
    uuid: "CB-2",
    name: "Air damper",
    systemId: "SYS-DRACS",
    description: "The air damper and its position switch, matched to the Systems Analysis basic event SY-A12.",
    boundaries: ["Consistent with SY-A12"],
    includedItems: ["Damper and operator", "Position switch"],
    excludedItems: ["Instrument-air header", "Actuation logic"],
    boundaryBasis: "The boundary matches the Systems Analysis basic-event definition for the damper.",
    implementsSrs: srs("DA-A2"),
  },
  {
    uuid: "CB-3",
    name: "Class-1E battery charger",
    systemId: "SYS-DC",
    description: "The charger and its output breaker, drawn to avoid overlap with the battery basic event.",
    boundaries: ["Reconcile with SY-A14"],
    includedItems: ["Charger and rectifier", "Output breaker"],
    excludedItems: ["Battery bank", "Incoming AC supply"],
    boundaryBasis: "Overlap with the battery basic event is under review against the Systems Analysis before the charger parameter is used.",
    implementsSrs: srs("DA-A2"),
  },
];

const componentGroupings: ComponentGrouping[] = [
  {
    uuid: "CG-1",
    name: "Decay-heat removal pumps",
    systemId: "SYS-DRACS",
    groupId: "CG-1",
    componentIds: ["DHR pump A", "DHR pump B", "DHR pump C"],
    groupingBasis: "TYPE_AND_SERVICE_CONDITIONS",
    designCharacteristics: ["Electromagnetic sodium pump", "Same rated flow"],
    environmentalConditions: ["Hot cell, inert cover gas"],
    serviceConditions: ["Primary sodium service", "Standby duty"],
    groupingJustification: "Three identical pumps in the same sodium service and duty form one homogeneous pool.",
    excludedOutliers: ["OL-1"],
    implementsSrs: srs("DA-B1"),
  },
  {
    uuid: "CG-2",
    name: "Motor-operated valves, clean service",
    systemId: "SYS-DRACS",
    groupId: "CG-2",
    componentIds: ["Damper MOV 1", "Damper MOV 2"],
    groupingBasis: "TYPE_AND_SERVICE_CONDITIONS",
    designCharacteristics: ["Motor-operated damper"],
    environmentalConditions: ["Ambient cell"],
    serviceConditions: ["Clean instrument air"],
    groupingJustification: "Clean-air valves are kept separate from raw-sodium valves at CC-II, since the service differs.",
    implementsSrs: srs("DA-B1"),
  },
  {
    uuid: "CG-3",
    name: "Battery chargers",
    systemId: "SYS-DC",
    groupId: "CG-3",
    componentIds: ["Charger A", "Charger B"],
    groupingBasis: "TYPE_ONLY",
    designCharacteristics: ["Switch-mode charger"],
    environmentalConditions: ["Conditioned switchgear room"],
    serviceConditions: ["Continuous float duty"],
    groupingJustification: "Two identical chargers are grouped by type at CC-I, since they are not risk-significant.",
    excludedOutliers: ["OL-2"],
    implementsSrs: srs("DA-B1"),
  },
];

const outlierComponents: OutlierComponent[] = [
  {
    uuid: "OL-1",
    systemId: "SYS-DRACS",
    componentId: "DHR pump D (mothballed spare)",
    potentialGroupId: "CG-1",
    exclusionReason: "Long-term layup, never placed in service.",
    exclusionJustification: "Held out of the pool and tracked separately until it is returned to service.",
    differentiatingCharacteristics: ["No demands", "No run hours", "Preservation atmosphere"],
    alternativeHandling: "Held out of the pool and tracked separately until it is returned to service.",
    status: "CONFIRMED",
    implementsSrs: srs("DA-B2"),
  },
  {
    uuid: "OL-2",
    systemId: "SYS-DC",
    componentId: "Charger C (test rig)",
    potentialGroupId: "CG-3",
    exclusionReason: "Bench unit exercised far more often than the installed chargers.",
    exclusionJustification: "Excluded from the installed-charger pool, since its demand profile is not representative.",
    differentiatingCharacteristics: ["Test-bench duty cycle", "Different demand profile"],
    alternativeHandling: "Excluded from the installed-charger pool, since its demand profile is not representative.",
    status: "CONFIRMED",
    implementsSrs: srs("DA-B2"),
  },
];

const externalDataSources: ExternalDataSource[] = [
  {
    uuid: "GS-1",
    name: "Industry component reliability database",
    sourceType: "INDUSTRY_DATABASE",
    sourceLocation: "Recognized industry reliability data compilation",
    timePeriod: { start: "1990", end: "2022" },
    accessMethod: "Licensed database export",
    dataFormat: "Tabular reliability parameters",
    qualityAssurance: "Generic estimates collected per operating state, with boundaries verified against HLR-A.",
    limitations: ["Applicability verified separately for each operating state before reuse."],
    referenceDocumentation: ["DOC-DA-02"],
    implementsSrs: srs("DA-C1", "DA-C25"),
  },
  {
    uuid: "GS-2",
    name: "Sodium test facility experience",
    sourceType: "OTHER_FACILITY_EXPERIENCE",
    sourceLocation: "Sodium test facility operating records",
    timePeriod: { start: "2001", end: "2024" },
    accessMethod: "Facility operating-experience report",
    dataFormat: "Event and exposure records",
    qualityAssurance: "Technology experience from sodium facilities, applicable because the plant is pre-operational.",
    limitations: ["Applicability established for the standby and the reduced-power states."],
    referenceDocumentation: ["DOC-DA-03"],
    implementsSrs: srs("DA-C2"),
  },
  {
    uuid: "GS-3",
    name: "Nonnuclear pump and valve experience",
    sourceType: "OTHER_FACILITY_EXPERIENCE",
    sourceLocation: "Nonnuclear facility maintenance records",
    timePeriod: { start: "2010", end: "2023" },
    accessMethod: "Industry experience compilation",
    dataFormat: "Event and exposure records",
    qualityAssurance: "Nonnuclear experience used where no nuclear sodium data exists, with the adjustment recorded.",
    limitations: ["Nonnuclear experience, used as a last resort with the adjustment recorded.", "Single state, with no reuse across states."],
    referenceDocumentation: ["DOC-DA-03"],
    implementsSrs: srs("DA-C2", "DA-D2"),
  },
];

const failureEventClassifications: FailureEventClassification[] = [
  {
    uuid: "FD-1",
    failureDefinitionBasis: "A component state is a failure when it cannot perform its modeled function on demand or over its mission.",
    degradedStatesCountedAsFailures: ["Pump fails to reach rated flow", "Valve fails to fully reseat", "Charger output below the float band"],
    degradedStatesNotCounted: ["Slow start that still completes within the allowed time", "Cosmetic seal weep with the function intact"],
    repeatedFailureCountingApplied: true,
    basisDocuments: ["DOC-DA-01"],
    implementsSrs: srs("DA-C5", "DA-C6"),
  },
];

const demandCountRecords: DemandCountRecord[] = [
  {
    uuid: "DM-1",
    componentGroupRef: "CG-1",
    surveillanceTestDemands: 12,
    maintenanceActDemands: 4,
    operationalDemands: 0,
    totalDemands: 16,
    basis: "PREOP_EXPECTED_PERFORMANCE",
    sourceRecords: ["DOC-DA-06"],
    implementsSrs: srs("DA-C7", "DA-C9"),
  },
  {
    uuid: "DM-2",
    componentGroupRef: "CG-2",
    surveillanceTestDemands: 4,
    maintenanceActDemands: 1,
    operationalDemands: 0,
    totalDemands: 5,
    basis: "PREOP_EXPECTED_PERFORMANCE",
    sourceRecords: ["DOC-DA-06"],
    implementsSrs: srs("DA-C9"),
  },
  {
    uuid: "DM-3",
    componentGroupRef: "CG-3",
    surveillanceTestDemands: 1,
    maintenanceActDemands: 1,
    operationalDemands: 0,
    totalDemands: 2,
    basis: "PREOP_EXPECTED_PERFORMANCE",
    sourceRecords: ["DOC-DA-06"],
    implementsSrs: srs("DA-C9"),
  },
];

const exposureTimeRecords: ExposureTimeRecord[] = [
  {
    uuid: "EX-1",
    componentGroupRef: "CG-1",
    standbyHours: 8400,
    operatingHours: 360,
    basis: "ESTIMATED_FROM_TEST_PRACTICES",
    sourceRecords: ["DOC-DA-06"],
    implementsSrs: srs("DA-C10", "DA-C11"),
  },
  {
    uuid: "EX-2",
    componentGroupRef: "CG-3",
    standbyHours: 0,
    operatingHours: 8760,
    basis: "ESTIMATED_FROM_TEST_PRACTICES",
    sourceRecords: ["DOC-DA-06"],
    implementsSrs: srs("DA-C11"),
  },
];

const testCredibilityReviews: TestCredibilityReview[] = [
  {
    uuid: "TC-1",
    testProcedureReference: "Quarterly DHR pump start test",
    componentGroupRef: "CG-1",
    failureModesExercised: ["Fails to start"],
    failureModesNotExercised: ["Fails to deliver full flow"],
    demandCreditingDecision: "The quarterly start test credits the start mode only, not full-flow performance.",
    implementsSrs: srs("DA-C12"),
  },
  {
    uuid: "TC-2",
    testProcedureReference: "MOV full stroke test",
    componentGroupRef: "CG-2",
    failureModesExercised: ["Fails to open", "Fails to close"],
    failureModesNotExercised: [],
    demandCreditingDecision: "The full stroke test credits both change-of-state modes.",
    implementsSrs: srs("DA-C12"),
  },
];

const unavailabilityDataRecords: UnavailabilityDataRecord[] = [
  {
    uuid: "UA-1",
    componentOrTrainReference: "DHR pump A",
    systemReference: "SYS-DRACS",
    contributingActivities: [
      { activity: "Planned pump overhaul", durationHours: 72, disablesFunction: true },
      { activity: "Instrument calibration", durationHours: 4, disablesFunction: false },
    ],
    preOperationalGenericJustification: "Generic unavailability assumed from the maintenance plan.",
    preOperationalAssumptionsBasis: "Only the overhaul disables the function, so only it counts toward unavailability.",
    implementsSrs: srs("DA-C13", "DA-C14"),
  },
  {
    uuid: "UA-2",
    componentOrTrainReference: "DHR pump B",
    systemReference: "SYS-DRACS",
    contributingActivities: [
      { activity: "Room cooling outage", durationHours: 24, disablesFunction: true },
    ],
    assignedToSupportSystem: "SYS-HVAC",
    preOperationalAssumptionsBasis: "The pump is down because its room cooling is down, so the unavailability is assigned to the support system.",
    implementsSrs: srs("DA-C15"),
  },
];

const coincidentMaintenanceRecords: CoincidentMaintenanceRecord[] = [
  {
    uuid: "CM-1",
    redundantEquipmentIds: ["DHR pump A", "DHR pump B"],
    scope: "INTRASYSTEM",
    plannedActivityDescription: "Shared cover-gas maintenance takes two redundant trains down together.",
    unavailabilityValue: 2.0e-3,
    basis: "PREOP_ASSUMPTION",
    systemsAnalysisSimultaneousEventRef: "SY-A27",
    implementsSrs: srs("DA-C18", "DA-C19"),
  },
];

const repairTimeRecords: RepairTimeRecord[] = [
  {
    uuid: "RP-1",
    sscReference: "DHR pump",
    repairEvents: [{ identificationToRestorationHours: 48 }],
    preOperationalAssumptionsBasis: "Repair time runs from identification of the failure to restoration, not wrench time alone, assumed pre-operationally and tied to SY-A31.",
    plantOperatingStateInfluences: "A repair that is easy at cold shutdown may be impossible mid-accident.",
    implementsSrs: srs("DA-C20", "DA-C21"),
  },
];

const recoveryTimeRecords: RecoveryTimeRecord[] = [
  {
    uuid: "RC-1",
    functionLost: "Offsite power",
    recoveryEvents: [{ identificationToRestorationHours: 8 }],
    genericSourceReferences: ["Offsite-power recovery generic sources"],
    implementsSrs: srs("DA-C22", "DA-C23"),
  },
  {
    uuid: "RC-2",
    functionLost: "Service water",
    recoveryEvents: [{ identificationToRestorationHours: 6 }],
    genericSourceReferences: ["Service-water recovery generic sources"],
    implementsSrs: srs("DA-C22"),
  },
];

const lpsdOutageDataRecords: LpsdOutageDataRecord[] = [
  {
    uuid: "OG-1",
    plantOperatingStateRef: "POS-5",
    outageType: "Refueling outage",
    durationHours: 720,
    outagesPerCalendarYear: 0.5,
    posDataLinkBasis: "The outage timeline and count behind the POS time fractions and the IE-C8 frequencies, linked to POS-C1.",
    implementsSrs: srs("DA-C24", "DA-C26"),
  },
  {
    uuid: "OG-2",
    plantOperatingStateRef: "POS-3",
    outageType: "Maintenance outage",
    durationHours: 168,
    outagesPerCalendarYear: 1.0,
    posDataLinkBasis: "A shorter maintenance outage, with the count per calendar year recorded, linked to POS-C1.",
    implementsSrs: srs("DA-C24", "DA-C26"),
  },
];

const ccfParameterEstimations: CcfParameterEstimation[] = [
  {
    uuid: "CCF-1",
    ccfGroupReference: "CCFG-DHR-FTS",
    modelType: "ALPHA_FACTOR",
    parameters: { "alpha-2": 0.05, "alpha-3": 0.02 },
    isRiskSignificant: true,
    parameterSource: "PLANT_EXPERIENCE_CONSISTENT",
    componentBoundaryConsistencyBasis: "Parameters consistent with the decay-heat pump boundary CB-1.",
    genericExclusionConsistencyConfirmed: true,
    genericExclusionConsistencyBasis: "Events excluded from the independent database are excluded from the CCF database too.",
    dataSources: [
      { source: "Common-cause failure parameter database", context: "Three decay-heat pumps fail to start", notes: "A multi-parameter model for a risk-significant CCF event, landing where SY-B4 demanded.", sourceType: "PLANT_SPECIFIC" },
    ],
    implementsSrs: srs("DA-D8", "DA-D9"),
  },
  {
    uuid: "CCF-2",
    ccfGroupReference: "CCFG-DC-CHG",
    modelType: "BETA_FACTOR",
    parameters: { beta: 0.1 },
    isRiskSignificant: false,
    parameterSource: "GENERIC",
    componentBoundaryConsistencyBasis: "Generic beta-factor consistent with the charger boundary CB-3.",
    genericExclusionConsistencyConfirmed: true,
    genericExclusionConsistencyBasis: "No plant-specific exclusions were applied.",
    dataSources: [
      { source: "Common-cause failure parameter database", context: "Two battery chargers fail", notes: "A beta-factor model suffices at CC-I for a group that is not risk-significant.", sourceType: "GENERIC_INDUSTRY" },
    ],
    implementsSrs: srs("DA-D7"),
  },
];

const dataModificationAdjustments: DataModificationAdjustment[] = [
  {
    uuid: "DMOD-1",
    modificationDescription: "Pump impeller redesign",
    affectedParameterIds: ["DA-P-014", "DA-P-015"],
    pastDataDisposition: "ADJUSTED",
    basis: "Past failure data is adjusted where the modification changes the failure mechanism.",
    implementsSrs: srs("DA-D10"),
  },
];

const preOperationalAssumptions = [
  { id: "PA-1", area: "Parameter definition", desc: "Boundaries taken from design information, to confirm against the as-built plant.", sr: "DA-A6", path: "componentBoundaries" },
  { id: "PA-2", area: "Generic collection", desc: "Technology experience borrowed from other facilities, with applicability recorded.", sr: "DA-C2", path: "externalDataSources" },
  { id: "PA-3", area: "Demand and exposure", desc: "Counts taken from the planned schedule, to replace with records once operating.", sr: "DA-C9", path: "demandCountRecords" },
  { id: "PA-4", area: "Unavailability and repair", desc: "Generic and assumed values logged where no records exist.", sr: "DA-C17", path: "unavailabilityDataRecords" },
  { id: "PA-5", area: "Estimation", desc: "Bayesian priors rest on technology evidence, to update with plant data.", sr: "DA-D5", path: "parameters" },
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
  implementsSrs: srs(a.sr),
}));

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "Similar-equipment sweep", description: "Sweep of the similar-equipment adjustment range.", variedParameters: ["Adjustment factor"], parameterRanges: { "Adjustment factor": [1, 5] }, results: "The sequence result holds within a factor of two across the adjustment range." },
  { uuid: "SS-2", name: "Prior-weight sweep", description: "Sweep of the Bayesian prior weight.", variedParameters: ["Prior weight"], parameterRanges: { "Prior weight": [0, 1] }, results: "The risk-significant pump estimate stays within its error factor across prior weights." },
];

const documentation: DaDocumentation = {
  processDescription: "Parameters defined, grouped, collected, estimated and documented by a systematic process, per ASME/ANS RA-S-1.4 HLR-DA-A through E, with each number carrying a pedigree on the evidence ladder.",
  systemComponentBoundaries: "Each component boundary, failure mode and success criterion is matched to the Systems Analysis basic-event definition, so the model boundary and the data boundary agree.",
  basicEventProbabilityModels: "Each basic event carries a probability model that fits how it is demanded, a demand probability for components asked to start and a failure rate for components failing over time.",
  genericParameterSources: "Generic estimates are collected from recognized industry sources per operating state, with applicable experience from other facilities including nonnuclear ones at the pre-operational stage.",
  plantSpecificDataSourcesAndPeriods: "The plant is pre-operational and has no records, so plant-specific collection is replaced by disciplined borrowing with the applicability recorded.",
  dataExclusionJustifications: "Any exclusion of data from the collection is justified, and an event excluded from the independent database is excluded from the common-cause database too.",
  demandAndExposureCounting: "Demands are estimated from the planned surveillance and maintenance schedule, and exposure hours from the planned test practices, since no operating records exist.",
  unavailabilityTreatment: "Only activities that disable the function are counted, and an unavailability caused by a support system is assigned to that support system so the dependency is not buried.",
  repairAndRecoveryData: "Repair time runs from identification of the failure to restoration, and recovery times for offsite power and service water are taken from generic sources.",
  lpsdOutageData: "Outage timelines and counts per calendar year are collected as the raw material behind the POS time fractions and the initiating-event frequencies.",
  componentGroupingAndOutliers: "Components are pooled into homogeneous groups by type and service, with outliers such as a mothballed spare and a test rig held out of the pools.",
  ccfParameterBasis: "Common-cause parameters use a beta-factor model at CC-I and a multi-parameter model for risk-significant events at CC-II, consistent with the component boundaries.",
  bayesianPriorRationales: "Bayesian priors rest on technology evidence at the pre-operational stage, and each posterior is checked for reasonableness against the evidence that informed it.",
  parameterEstimatesWithUncertainty: "Point estimates with uncertainty are provided at CC-I and realistic mean estimates for risk-significant events at CC-II, each with a characterized distribution.",
  multiPosGenericUse: "The applicability of a generic estimate to each operating state is established before the estimate is reused across states.",
  modelUncertaintySources: "Model-uncertainty sources include the similar-equipment adjustment, the borrowed population prior, the planned demand and exposure counts and the coincident-maintenance assumption.",
  asBuiltLimitations: "Pre-operational: boundaries, counts, priors and assumed values rest on design and planning information pending as-built and as-operated confirmation.",
  praTaskInterfaces: "DA takes the basic-event list from SY and the outage timelines from POS, and supplies failure rates, demand probabilities, unavailabilities and CCF parameters to IE, SY and HR, with everything converging on ESQ.",
  implementsSrs: srs("DA-E1", "DA-E2", "DA-E3"),
};

export const DA_ANALYSIS: DataAnalysis = {
  uuid: "da-generic-1",
  name: "Generic-1 Data Analysis",
  type: TechnicalElementTypes.DATA_ANALYSIS,
  version: "2",
  created: CREATED,
  modified: NOW,
  owner: "praman",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "praman" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["praman", "dokonkwo", "slindqvist"],
    reviewers: [
      { id: "rev-1", name: "Dr. Hossein Ardakani", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Mei-Ling Chen", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Reliability Data", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Gregor Pavlov", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Bayesian Methods & CCF", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Data analysis for the Generic-1 sodium-cooled fast reactor, supplying the basic-event probabilities, initiating-event frequencies and common-cause parameters that fill the empty numeric slots from the other elements.",
    limitations: ["Pre-operational: the plant has no records, so the parameters rest on generic and technology evidence and disciplined assumptions pending as-built and as-operated confirmation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "praman",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "dac-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-10T09:14:00.000Z", associatedSr: "DA-A2", text: "The battery charger boundary CB-3 may overlap the battery basic event, so DA-A2 needs the boundary reconciled with the Systems Analysis before the charger parameter is used.", severity: "MAJOR", resolved: false },
      { uuid: "dac-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-10T10:30:00.000Z", associatedSr: "DA-D2", text: "The sodium check-valve parameter is adjusted from a water valve, so DA-D2 needs the adjustment basis documented and bounded by a sensitivity study.", severity: "MAJOR", resolved: false },
      { uuid: "dac-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-11T14:05:00.000Z", associatedSr: "DA-D5", text: "The decay-heat pump posterior leans on a borrowed sodium-facility prior, so DA-D5 needs the relative weight of prior versus evidence shown to be reasonable.", severity: "MAJOR", resolved: false },
      { uuid: "dac-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-11T15:20:00.000Z", associatedSr: "DA-C25", text: "The pump generic estimate is reused across the standby and reduced-power states, so DA-C25 needs the applicability to each state established before reuse.", severity: "MINOR", resolved: false },
      { uuid: "dac-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-11T16:00:00.000Z", associatedSr: "DA-B2", text: "The mothballed spare and the test charger are held out of the pools consistently.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the outlier rule is applied consistently.", resolvedAt: "2026-05-11T17:30:00.000Z", resolvedBy: "rev-1" },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope data analysis for the Generic-1 SFR, pre-operational stage, capability category CC-II.",
  parameters,
  componentBoundaries,
  componentGroupings,
  outlierComponents,
  externalDataSources,
  failureEventClassifications,
  demandCountRecords,
  exposureTimeRecords,
  testCredibilityReviews,
  unavailabilityDataRecords,
  coincidentMaintenanceRecords,
  repairTimeRecords,
  recoveryTimeRecords,
  lpsdOutageDataRecords,
  ccfParameterEstimations,
  dataModificationAdjustments,
  modelUncertainty: {
    uuid: "da-mu-1",
    name: "DA model uncertainty documentation",
    uncertaintySources: [
      { source: "Similar-equipment adjustment for sodium service", impact: "Carried as an uncertainty source and tested by sensitivity." },
      { source: "Borrowed sodium-facility population prior", impact: "Applicability bounded until plant-specific records exist." },
      { source: "Planned demand and exposure counts", impact: "Schedule-based counts carried until operating records are collected." },
      { source: "Coincident-maintenance assumption", impact: "Assumed value carried until plant experience confirms it." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  sensitivityStudies,
  documentation,
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-052", "NM-058", "NM-061"],
};

import { TechnicalElementTypes } from "../technical-element";
import {
  OperatingState,
  BarrierStatus,
  ModuleState,
  SourceLocationType,
  SystemStatus,
  TimeVaryingCondition,
  TransitionEvent,
  PlantEvolution,
  TimeBoundary,
  TransitionParameter,
  Instrument,
  DecayHeatRemovalSystems,
  ReactorCoolantSystemParameters,
  RadionuclideTransportBarriers,
  OperatingStateRisk,
  PlantOperatingState,
  PlantOperatingStatesTable,
  OperatingStatesFrequencyDuration,
  PlantOperatingStatesGroup,
  AssumptionsLackOfDetail,
  SubsumedPOS,
  SafetyFunction,
  RadionuclideBarrier,
  RadioactiveSource,
  HazardousSources,
  POSValidationRules,
  ModelUncertaintyInfo,
  PeerReviewFinding,
  TransitionRisk,
  PlantRepresentationAccuracy,
  PlantOperatingStatesDocumentation,
  PlantOperatingStatesAnalysis,
} from "./plant-operating-states-analysis";
import { DistributionType, Frequency, FrequencyWithDistribution, InitiatingEvent, FrequencyUnit } from "../core/events";
import { ImportanceLevel, ScreeningStatus, SuccessCriteriaId } from "../core/shared-patterns";
import { createVersionInfo, SCHEMA_VERSION } from "../core/version";
function getFrequencyValue(frequency: Frequency | FrequencyWithDistribution | undefined): number {
  if (typeof frequency === "number") {
    return frequency;
  } else if (frequency && "value" in frequency) {
    return frequency.value;
  }
  return 1;
}
const loopInitiatingEvent: InitiatingEvent = {
  uuid: "550e8400-e29b-41d4-a716-446655440001",
  name: "Loss of Offsite Power (LOOP)",
  description:
    "Complete loss of external 13.8kV grid connection to the plant, challenging power supply to primary pumps and support systems.",
  frequency: {
    value: 0.08,
    units: FrequencyUnit.PER_CALENDAR_YEAR,
    distribution: {
      type: DistributionType.LOGNORMAL,
      parameters: [0.03, 0.15],
    },
    source: "Generic LMR Data & Site History Review NUREG/CR-XXXX",
  },
  eventType: "INITIATING",
};
const auxPumpRef = { componentId: "AUX-PUMP-01", systemId: "PRIMARY-COOLANT" };
const sdCoolerARef = { componentId: "SDC-A-01", systemId: "SHUTDOWN-COOLING" };
const controlRodBank1Ref = { componentId: "CR-BANK-01", systemId: "RSS" };
const safetyRodRef = { componentId: "SAFETY-ROD-01", systemId: "RSS" };
const priPumpARef = { componentId: "PRI-PUMP-A", systemId: "PRIMARY-COOLANT" };
const powerLevelTransitionParam: TransitionParameter = {
  parameter: "Power Level",
  value: "100%",
};
const shutdownPowerTransitionParam: TransitionParameter = {
  parameter: "Power Level",
  value: "0%",
};
const tempLowTransitionParam: TransitionParameter = {
  parameter: "Temperature",
  value: "Low",
};
const coreOutletTC: Instrument = {
  uuid: "550e8400-e29b-41d4-a716-446655440002",
  name: "Core Outlet Thermocouple Array",
  parameter: "Core Outlet Temperature",
  safetyRelated: true,
  calibrationRequirements: "Annual calibration per Procedure CAL-TC-005",
  location: "IN_CORE_SOURCE" as SourceLocationType,
  accuracy: 0.5,
  availability: true,
};
const primaryFlowMeter: Instrument = {
  uuid: "550e8400-e29b-41d4-a716-446655440003",
  name: "Primary Sodium Flow Meter (EM Type)",
  parameter: "Primary Sodium Flow Rate",
  safetyRelated: true,
  location: "IN_CORE_SOURCE" as SourceLocationType,
  accuracy: 0.8,
  availability: true,
};
const shutdownCoolerFlow: Instrument = {
  uuid: "550e8400-e29b-41d4-a716-446655440004",
  name: "Shutdown Cooler A Flow Monitor",
  parameter: "NaK Flow Rate",
  safetyRelated: true,
  location: "OUT_OF_CORE_SOURCE" as SourceLocationType,
  accuracy: 1.0,
  availability: true,
};
const reactivityControlSF: SafetyFunction = {
  uuid: "550e8400-e29b-41d4-a716-446655440005",
  name: "Reactivity Control",
  successCriteriaIds: ["SC-SCRAM-001"],
  state: "SUCCESS",
  category: "Reactivity Control",
  implementationMechanisms: [
    {
      name: "Control Rods",
      description: "Mechanical control rods for reactivity control",
      status: "Operational",
      type: "Active",
    },
    {
      name: "Safety Rods",
      description: "Emergency shutdown rods",
      status: "Standby",
      type: "Active",
    },
    {
      name: "Inherent Reactivity Feedback",
      description: "Negative temperature coefficient of reactivity",
      status: "Passive",
      type: "Passive",
    },
  ],
};
const decayHeatRemovalSF_FP: SafetyFunction = {
  uuid: "550e8400-e29b-41d4-a716-446655440006",
  name: "Decay Heat Removal (Full Power Availability)",
  successCriteriaIds: ["SC-DHR-AVAIL-001"],
  state: "SUCCESS",
  category: "Heat Removal",
  implementationMechanisms: [
    {
      name: "Shutdown Cooling System",
      description: "Active cooling system for decay heat removal",
      status: "Standby",
      type: "Active",
    },
    {
      name: "Emergency Cooling System",
      description: "Backup cooling capability",
      status: "Standby",
      type: "Active",
    },
  ],
};
const decayHeatRemovalSF_SD: SafetyFunction = {
  uuid: "550e8400-e29b-41d4-a716-446655440007",
  name: "Decay Heat Removal (Shutdown Operation)",
  successCriteriaIds: ["SC-DHR-OPERATE-001", "SC-NATCIRC-001", "SC-AUX-PUMP-001"],
  state: "SUCCESS",
  category: "Heat Removal",
  implementationMechanisms: [
    {
      name: "Shutdown Cooling System",
      description: "Active cooling system for decay heat removal",
      status: "Operating",
      type: "Active",
    },
    {
      name: "Natural Circulation",
      description: "Passive cooling through natural circulation",
      status: "Available",
      type: "Passive",
    },
    {
      name: "Auxiliary Cooling System",
      description: "Supplementary cooling capability",
      status: "Standby",
      type: "Active",
    },
  ],
};
const coreSource: RadioactiveSource = {
  uuid: "550e8400-e29b-41d4-a716-446655440008",
  name: "EBR-II Reactor Core",
  screeningStatus: ScreeningStatus.RETAINED,
  location: "IN_VESSEL",
  description: "The reactor core containing fuel assemblies and reflector",
  radionuclides: ["Cs-137", "Sr-90", "Pu-239", "I-131"],
  status: "Active",
};
const spentFuelSource: RadioactiveSource = {
  uuid: "550e8400-e29b-41d4-a716-446655440009",
  name: "In-Tank Spent Fuel Storage Basket",
  screeningStatus: ScreeningStatus.RETAINED,
  location: "IN_VESSEL",
  description: "Storage basket for spent fuel assemblies within the primary tank",
  radionuclides: ["Cs-137", "Sr-90", "Pu-239", "I-131"],
  status: "Stored",
};
const activatedSodiumSource: RadioactiveSource = {
  uuid: "550e8400-e29b-41d4-a716-44665544000a",
  name: "Activated Primary Sodium Coolant",
  screeningStatus: ScreeningStatus.RETAINED,
  location: "IN_VESSEL",
  description: "Primary sodium coolant with activation products",
  radionuclides: ["Na-24", "Na-22"],
  status: "Circulating",
};
const activatedSteelSource: RadioactiveSource = {
  uuid: "550e8400-e29b-41d4-a716-44665544000b",
  name: "Activated Structural Components",
  screeningStatus: ScreeningStatus.SCREENED_OUT,
  location: "IN_VESSEL",
  description: "Activated structural steel components within the primary system",
  radionuclides: ["Co-60", "Fe-55", "Mn-54"],
  status: "Fixed",
};
const decayHeatTVC: TimeVaryingCondition = {
  uuid: "550e8400-e29b-41d4-a716-446655440011",
  name: "EBR-II Decay Heat - First 24 Hours",
  uncertainty: 0.05,
  time: 0,
  parameter: "Core Decay Heat Level",
  value: 5.0,
  impact: "Determines required DHR capacity",
  requiresMonitoring: true,
};
const decayHeatTVC_Late: TimeVaryingCondition = {
  uuid: "550e8400-e29b-41d4-a716-446655440012",
  name: "EBR-II Decay Heat - Beyond 24 Hours",
  uncertainty: 0.03,
  time: 24,
  parameter: "Core Decay Heat Level",
  value: 2.0,
  impact: "May allow transition to standby DHR systems",
  requiresMonitoring: true,
};
const fullPowerPOS = {
  uuid: "550e8400-e29b-41d4-a716-44665544000e",
  name: "Full Power Operation",
  radioactiveMaterialSources: [
    coreSource.uuid as string,
    spentFuelSource.uuid as string,
    activatedSodiumSource.uuid as string,
    activatedSteelSource.uuid as string,
  ],
  detailedRadioactiveSources: [coreSource, spentFuelSource, activatedSodiumSource, activatedSteelSource],
  initiatingEvents: [loopInitiatingEvent],
  safetyFunctions: [reactivityControlSF, decayHeatRemovalSF_FP],
  meanFrequency: 1.5 as Frequency,
  successCriteriaIds: ["SC-SCRAM-001", "SC-DHR-AVAIL-001"],
  riskSignificance: {
    stateId: "pos-fp-ebr2-001",
    stateName: "Full Power Operation",
    riskContribution: 0.85,
    riskMetrics: {
      CDF: 1e-6 as Frequency,
      LERF: 5e-8 as Frequency,
    },
    riskSignificantContributors: [
      "LOOP Initiating Event",
      "Failure of Shutdown Coolers",
      "Failure to Scram (ATWS)",
      "Primary Pump Failure leading to LOF",
    ],
    importanceMeasures: [
      { componentId: controlRodBank1Ref.componentId, fussellVesely: 0.15, RAW: 100, RRW: 1.2 },
      { componentId: safetyRodRef.componentId, fussellVesely: 0.05, RAW: 80, RRW: 1.1 },
      { componentId: sdCoolerARef.componentId, fussellVesely: 0.1, RAW: 50, RRW: 1.1 },
    ],
  },
  plantRepresentationAccuracy: {
    accuracy: ImportanceLevel.HIGH,
    basis: "Extensive operational history, design docs, SHRT test data.",
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Key safety systems and passive features well-characterized.",
  },
} as unknown as PlantOperatingState;
const controlledShutdownPOS = {
  uuid: "550e8400-e29b-41d4-a716-44665544000f",
  name: "Controlled Shutdown (Post-Trip/LOOP)",
  radioactiveMaterialSources: [
    coreSource.uuid as string,
    spentFuelSource.uuid as string,
    activatedSodiumSource.uuid as string,
    activatedSteelSource.uuid as string,
  ],
  detailedRadioactiveSources: [coreSource, spentFuelSource, activatedSodiumSource, activatedSteelSource],
  initiatingEvents: [],
  safetyFunctions: [decayHeatRemovalSF_SD],
  meanFrequency: 5 as Frequency,
  successCriteriaIds: ["SC-DHR-OPERATE-001", "SC-NATCIRC-001", "SC-AUX-PUMP-001"],
  timeVaryingConditions: [decayHeatTVC, decayHeatTVC_Late],
  riskSignificance: {
    stateId: "pos-csd-ebr2-001",
    stateName: "Controlled Shutdown (Post-Trip/LOOP)",
    riskContribution: 0.1,
    riskMetrics: {
      CDF: 1e-7 as Frequency,
      LERF: 1e-8 as Frequency,
    },
    riskSignificantContributors: [
      "Failure of Shutdown Coolers (Common Cause)",
      "Loss of DC Power to Aux Pump/Instrumentation",
      "Operator error during cooldown monitoring",
    ],
    importanceMeasures: [{ componentId: sdCoolerARef.componentId, fussellVesely: 0.25, RAW: 80, RRW: 1.3 }],
  },
  plantRepresentationAccuracy: {
    accuracy: ImportanceLevel.HIGH,
    basis: "Extensive operational history, design docs, SHRT test data.",
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Key safety systems and passive features well-characterized.",
  },
} as unknown as PlantOperatingState;
const ebr2HazardousSources: HazardousSources = {
  sourceDefinition: {
    IN_CORE_SOURCE: ScreeningStatus.RETAINED,
    OUT_OF_CORE_SOURCE: ScreeningStatus.RETAINED,
  },
  detailedSources: [coreSource, spentFuelSource, activatedSodiumSource, activatedSteelSource],
  operatingStates: {
    startUp: {} as PlantOperatingState,
    controlledShutdown: controlledShutdownPOS,
    fullPower: fullPowerPOS,
    ColdShutdown: {} as PlantOperatingState,
  },
  operatingStatesFrequencyDuration: {
    outagePlansRecords: [
      {
        startDate: "1989-10-01",
        endDate: "1989-10-20",
        description: "Scheduled Refueling Outage",
        frequencyPerYear: 1 as Frequency,
      },
    ],
    maintenancePlansRecords: [
      {
        startDate: "1989-03-01",
        endDate: "1989-03-05",
        description: "Primary Pump #1 Maintenance",
        frequencyPerYear: 0.5 as Frequency,
      },
    ],
    operationsData: [{ startDate: "1989-01-01", endDate: "1989-12-31" }],
    tripHistory: [
      { date: "1989-05-15", description: "Manual Scram due to BOP fault signal" },
      { date: "1989-08-22", description: "Automatic Scram on high flux channel" },
    ],
    summary: [
      {
        posName: fullPowerPOS.name,
        averageDuration: fullPowerPOS.meanDuration / getFrequencyValue(fullPowerPOS.meanFrequency),
        entriesPerYear: getFrequencyValue(fullPowerPOS.meanFrequency),
        fractionOfTime: 0.7,
      },
      {
        posName: controlledShutdownPOS.name,
        averageDuration: controlledShutdownPOS.meanDuration,
        entriesPerYear: getFrequencyValue(controlledShutdownPOS.meanFrequency),
        fractionOfTime: 0.15,
      },
    ],
  },
  plantEvolution: {} as PlantEvolution,
};
const normalCycleEvolution = {
  uuid: "550e8400-e29b-41d4-a716-446655440010",
  name: "EBR-II Normal Operating Cycle",
  plantOperatingStates: [fullPowerPOS, controlledShutdownPOS],
  evolutionProperties: {
    praMode: "LPSD (Low Power Shutdown) Analysis Included",
    screeningStatus: ScreeningStatus.RETAINED,
  },
  evolutionConsiderations: {
    screeningStatus: ScreeningStatus.RETAINED,
    reactorCoolantBoundaryConfigurations: ["Sealed Primary System"],
    reactorCoolantSystemParameterRanges: ["Temperature: 350°C - 500°C", "Flow: 50% - 100%"],
    availableMonitoringDevices: ["Core Outlet TC", "Primary Flow Meter", "Shutdown Cooler Flow"],
    operatorActions: ["Monitor cooldown rate", "Align shutdown cooling"],
    radionuclideTransportBarrierStatus: ["Fuel Cladding Intact", "Primary Boundary Intact"],
  },
  initiatingEvents: [loopInitiatingEvent],
  transitions: [],
} as unknown as PlantEvolution;
ebr2HazardousSources.plantEvolution = normalCycleEvolution;
const fpToShutdownTransitionLoop: TransitionEvent = {
  uuid: "550e8400-e29b-41d4-a716-446655440011",
  name: "Transition: Full Power to Shutdown via LOOP",
  description: "Sequence initiated by Loss of Offsite Power (LOOP)...",
  fromStateId: fullPowerPOS.uuid as string,
  toStateId: controlledShutdownPOS.uuid as string,
  risks: [],
  duration: 0.05,
  frequency: loopInitiatingEvent.frequency,
  specialConsiderations: [],
  procedureIds: ["EOP-LOOP-01", "ARP-LOSS-OF-AC-01"],
  criticalParameters: [],
  transitionParameters: [],
  riskSignificance: ImportanceLevel.HIGH,
  mitigatingActions: [],
  requiredHumanActions: [],
  requiredEquipment: [],
  potentialFailureModes: [],
};
normalCycleEvolution.transitions = [fpToShutdownTransitionLoop];
const lpsdGroup: PlantOperatingStatesGroup = {
  uuid: "550e8400-e29b-41d4-a716-446655440012",
  name: "Low Power and Shutdown (LPSD) Group",
  description: "Groups operating states where the reactor is subcritical...",
  plantOperatingStateIds: [controlledShutdownPOS.uuid as string],
  groupingJustification: "Similar DHR challenges...",
  representativeCharacteristics: ["Reactor Subcritical", "Decay Heat Removal Critical", "..."],
};
const posDocumentation = {
  processDescription: "Process used standard IEEE-XXX methodology",
  plantEvolutionsDetails: "Normal operating cycle with refueling outages",
  identificationProcessDetails: "Based on plant operating procedures and POS analysis methodology",
  groupingProcessDetails: "States grouped by similar thermal-hydraulic conditions",
  screeningCriteriaDocumentation: "Standard ASME/ANS screening criteria applied",
  stateFrequencyDocumentation: "Based on historical plant data from 1985-1990",
  stateDurationDocumentation: "Based on historical plant data and operating procedures",
  referencesToSupportingAnalyses: ["EBR-II Safety Analysis Report", "SHRT Test Series Results"],
  knownIssuesAndLimitations: "Limited operational data for some transient evolutions",
  peerReviewFindings: [
    {
      findingId: "PRF-EBR2-POS-01",
      description:
        "The transition criteria between 'Controlled Shutdown' and 'Cold Shutdown' lack a specific temperature threshold.",
      category: "POS Definition",
      significance: ImportanceLevel.MEDIUM,
      response:
        "Transition parameter 'Primary Sodium Bulk Temperature < 400°F' added to the TimeBoundary definition for entering Cold Shutdown.",
      actions: ["Updated POS definitions in documentation and model."],
      status: "CLOSED",
    },
  ],
  additionalInsights: "Natural circulation capabilities significant for safety",
  stateGroupDefinitions: "Power Operation, Shutdown, Refueling, and Maintenance groups defined",
  stateCharacteristics: "Key characteristics documented for each state including thermal conditions",
  meanDurationsDetails: "Statistical analysis of operational data from 1985-1990",
  decayHeatDetails: "Time-dependent decay heat curves developed for each POS",
  praTaskInterfaces: "Interfaces with event sequence and systems analysis documented",
  modelUncertaintySources: "Uncertainties in decay heat calculation and transition timing",
  asBuiltLimitations: "Pre-operational design information used where as-built details unavailable",
} as unknown as PlantOperatingStatesDocumentation;
const validationRules: POSValidationRules = {
  mutualExclusivityRules: {
    description: "Rules for ensuring mutual exclusivity of operating states",
    delineationParameters: ["Temperature", "Pressure", "Core Status"],
    verificationMethod: "Transition matrix analysis and boundary condition verification",
  },
  collectiveExhaustivityRules: {
    description: "Rules for ensuring all plant states are covered",
    verificationMethod: "Configuration space analysis",
    configurationCoverage: "All possible plant configurations are mapped to a defined state",
  },
  transitionRules: {
    transitionMatrix: {
      "Full Power": ["Controlled Shutdown", "Emergency Shutdown"],
      "Controlled Shutdown": ["Cold Shutdown", "Refueling"],
      "Emergency Shutdown": ["Cold Shutdown", "Controlled Shutdown"],
    },
    transitionTriggers: {
      "Full Power to Controlled Shutdown": "Manual operation, normal end of cycle",
      "Full Power to Emergency Shutdown": "Trip signals, safety system actuation",
    },
  },
};
const exampleSubsumedPOS: SubsumedPOS = {
  subsumedPOS: "Hot Standby (Post-Trip, Pre-Cooldown)",
  subsumingPOS: controlledShutdownPOS.uuid as string,
  justification: "Very short duration (<1 hr)...",
  riskImpact: ImportanceLevel.LOW,
  validationMethod: "Review of system alignments...",
  sensitivityAnalysis: {
    uuid: "sens-subsume-hsby-01",
    description: "Quantified impact...",
    variedParameters: ["Duration of Hot Standby", "HF Probability during HS"],
    parameterRanges: {
      "Duration of Hot Standby": [0.5, 2.0],
      "HF Probability during HS": [0.01, 0.05],
    },
    results: "<1% change in overall CDF/LERF.",
    insights: "Subsumption justified for baseline model.",
  },
};
const ebr2_pos_analysis: PlantOperatingStatesAnalysis = {
  type: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
  version: "POS-EBR2-EX02",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  name: "EBR-II Plant Operating States Analysis Example (Enhanced)",
  description: "Enhanced POS analysis example for EBR-II...",
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
  status: "DRAFT",
  tags: ["EBR-II", "LMR", "LMFBR", "Sodium Cooled", "Pool Type", "Metallic Fuel", "LOOP", "Example", "Enhanced"],
  additionalMetadata: {
    limitations: ["Illustrative example, not a complete PRA."],
    assumptions: ["Plant configuration corresponds to circa 1989."],
  },
  plantEvolutions: [normalCycleEvolution],
  includesAtPowerOperations: true,
  hazardousSources: ebr2HazardousSources,
  plantOperatingStatesGroups: [lpsdGroup],
  modelUncertainty: [
    {
      source: "LOOP Frequency",
      description: "Uncertainty in site-specific LOOP frequency.",
      impact: ImportanceLevel.MEDIUM,
      treatment: "Log-uniform distribution used in quantification; sensitivity study performed.",
      reasonableAlternatives: ["Use generic data only", "Use adjacent site data"],
    },
  ],
  subsumedPOSs: [exampleSubsumedPOS],
  assumptionsLackOfDetail: [
    {
      description: "Assumed standard IEEE-384 separation criteria met...",
      influence: "Affects the common-cause failure probability...",
      riskImpact: ImportanceLevel.LOW,
      justification: "EBR-II design documentation indicates...",
      affectedPOSIds: [controlledShutdownPOS.uuid as string],
      plannedActions: ["Recommend cable routing verification..."],
    },
  ],
  sscsAndOperationalCharacteristics: [],
  documentation: posDocumentation,
  posValidationRules: validationRules,
  transitionEvents: [fpToShutdownTransitionLoop],
  plantRepresentationAccuracy: {
    accuracy: ImportanceLevel.HIGH,
    basis: "Extensive operational history, design docs, SHRT test data.",
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Key safety systems and passive features well-characterized.",
    highConfidenceAreas: [
      "Passive decay heat removal performance (SDCs, Natural Circ)",
      "Reactivity feedback characteristics",
    ],
    lowerConfidenceAreas: [
      "Long-term battery performance under load",
      "Precise CCF probabilities for redundant systems",
    ],
    improvementPlans: ["Refine CCF analysis with more detailed component data if available."],
  },
};
console.log("Fixed & Enhanced Example Plant Operating States Analysis Object:");
export default ebr2_pos_analysis;

import {
  type PlantOperatingStatesAnalysis,
  type PlantOperatingState,
  type PlantEvolution,
  type PlantOperatingStateGroup,
  type PosScreeningRecord,
  type PosSeparationRecord,
  type SubsumedPosRecord,
  type DecayHeatCharacterization,
  type PlantRepresentationAccuracy,
  type ModelUncertainty,
  type PreOperationalAssumption,
  type TransitionEvent,
  type PosValidationRules,
  type PosDocumentation,
  type SRConformance,
  type Instrument,
  type SscOperationalCharacteristic,
  type SafetyFunction,
  type DecayHeatRemovalConfiguration,
  type TimeBoundary,
  type RadioactiveSource,
  type RadionuclideTransportBarrier,
  type ReactorCoolantSystemParameters,
  type ParameterRange,
  type SRReference,
  OperatingMode,
  EvolutionType,
  BarrierStatus,
  SourceLocation,
  SafetyFunctionCategory,
} from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type InitiatingEvent } from "interfaces-mef-types/core/events";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";

// hardcoded — entire PlantOperatingStatesAnalysis instance below is demo data
// for Aurora-1, a 300 MWt sodium-cooled fast reactor. It follows the OpenPRA POS
// MEF schema so it can be swapped for live data without reshaping. The type
// annotation guarantees conformance (the Zod mirror asserts schema/type equality).

// ─── Concise valid fillers for schema-required fields not surfaced in UI/report ──
function fillerInstruments(posId: string, count: number): Instrument[] {
  const out: Instrument[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push({
      uuid: `${posId}-INST-${i}`,
      name: `Instrument channel ${i}`,
      parameter: "Reactor coolant temperature",
      location: "Reactor vessel head",
      units: "°C",
      availability: true,
      safetyRelated: i % 3 === 0,
    });
  }
  return out;
}

function fillerSscs(posId: string, count: number): SscOperationalCharacteristic[] {
  const categories = [
    SafetyFunctionCategory.DECAY_HEAT_REMOVAL,
    SafetyFunctionCategory.REACTIVITY_CONTROL,
    SafetyFunctionCategory.RCS_INVENTORY_BARRIER_CONTROL,
    SafetyFunctionCategory.RADIONUCLIDE_TRANSPORT_BARRIER_CONTROL,
  ];
  const out: SscOperationalCharacteristic[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push({
      ssc: `${posId}-SSC-${i}`,
      desiredState: "In service",
      supportedSafetyFunction: categories[i % categories.length],
    });
  }
  return out;
}

const FILLER_DHR: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Primary sodium loop": "YES" },
  secondaryCoolingSystems: { "Intermediate heat-transport loop": "YES" },
  passiveMechanisms: { "DRACS (direct reactor auxiliary cooling)": "STANDBY" },
};

function fillerSafetyFunctions(posId: string): SafetyFunction[] {
  return [
    {
      uuid: `${posId}-SF-1`,
      name: "Decay heat removal",
      category: SafetyFunctionCategory.DECAY_HEAT_REMOVAL,
      description: "Remove core decay heat to the ultimate heat sink.",
      state: "SUCCESS",
      successCriterion: "Heat removal capacity exceeds decay-heat load with margin.",
      failureCriterion: "Loss of all heat-removal pathways.",
      successCriteriaIds: [`${posId}-SC-DHR`],
      implementationMechanisms: [
        {
          name: "DRACS",
          description: "Passive direct reactor auxiliary cooling.",
          status: "Available",
          type: "PASSIVE",
        },
      ],
      supportingSscs: [`${posId}-SSC-1`],
      applicableInitiatingEvents: [`${posId}-IE-LOHS`],
    },
  ];
}

function fillerInitiators(posId: string): InitiatingEvent[] {
  return [
    {
      uuid: `${posId}-IE-LOHS`,
      name: "Loss of heat sink",
      eventType: "INITIATING",
      frequency: 1e-2,
    },
  ];
}

function timeBoundary(startingCondition: string, endingCondition: string): TimeBoundary {
  return {
    startingCondition,
    endingCondition,
    transitionParameters: [
      {
        parameter: "Reactor coolant temperature",
        threshold: 260,
        units: "°C",
        monitored: true,
      },
    ],
  };
}

function fillerBarriers(specs: { name: string; status?: BarrierStatus }[]): RadionuclideTransportBarrier[] {
  return specs.map((b, i) => ({
    uuid: `BAR-${b.name.split(" ").join("-")}-${i}`,
    name: b.name,
    status: b.status,
    monitoringParameters: ["Activity monitors"],
    breachCriteria: ["Measured activity exceeds limit"],
  }));
}

function fillerSources(
  posId: string,
  specs: { name: string; location: SourceLocation; description: string; status: string }[],
): RadioactiveSource[] {
  return specs.map((s, i) => ({
    uuid: `${posId}-SRC-${i}`,
    name: s.name,
    location: s.location,
    description: s.description,
    radionuclides: ["Cs-137", "I-131", "Na-24"],
    status: s.status,
    releasePaths: ["Cover-gas path"],
    barriers: ["Cladding", "Primary boundary"],
    screeningStatus: ScreeningStatus.RETAINED,
  }));
}

function range(min: number, max: number, units: string, representative?: number): ParameterRange {
  return { min, max, representative: representative ?? (min + max) / 2, units };
}

interface StateSpec {
  uuid: string;
  name: string;
  evolutionId: string;
  operatingMode: OperatingMode;
  description: string;
  temperature: ParameterRange;
  pressure: ParameterRange;
  power: ParameterRange;
  decayHeat: ParameterRange;
  rcsConfigurationDescription: string;
  rcbConfiguration: string;
  sources: { name: string; location: SourceLocation; description: string; status: string }[];
  barriers: { name: string; status?: BarrierStatus }[];
  instrumentationCount: number;
  sscCount: number;
  meanDurationHours: number;
  meanEntryFrequency: number;
  meanTimeAfterShutdownHours?: number;
  decayHeatLevelDefined: boolean;
  decayHeatBasis?: string;
  implementsSrs: SRReference[];
}

function makeState(spec: StateSpec): PlantOperatingState {
  const rcsParameters: ReactorCoolantSystemParameters = {
    powerLevel: spec.power,
    decayHeatLevel: spec.decayHeat,
    reactorCoolantTemperature: spec.temperature,
    coolantPressure: spec.pressure,
    rcsConfigurationDescription: spec.rcsConfigurationDescription,
  };
  return {
    uuid: spec.uuid,
    name: spec.name,
    evolutionId: spec.evolutionId,
    description: spec.description,
    operatingMode: spec.operatingMode,
    radioactiveMaterialSources: fillerSources(spec.uuid, spec.sources),
    rcbConfiguration: spec.rcbConfiguration,
    rcsParameters,
    availableInstrumentation: fillerInstruments(spec.uuid, spec.instrumentationCount),
    activitiesLeadingToParameterChanges: ["Reactor power manoeuvring", "Coolant temperature change"],
    radionuclideTransportBarriers: fillerBarriers(spec.barriers),
    timeBoundary: timeBoundary(`Entry to ${spec.name}`, `Exit from ${spec.name}`),
    decayHeatRemoval: FILLER_DHR,
    sscOperationalCharacteristics: fillerSscs(spec.uuid, spec.sscCount),
    safetyFunctions: fillerSafetyFunctions(spec.uuid),
    applicableInitiatingEvents: fillerInitiators(spec.uuid),
    successCriteriaIds: [`${spec.uuid}-SC-DHR`],
    meanDurationHours: spec.meanDurationHours,
    meanTimeAfterShutdownHours: spec.meanTimeAfterShutdownHours,
    meanEntryFrequency: spec.meanEntryFrequency,
    decayHeatLevelDefined: spec.decayHeatLevelDefined,
    decayHeatBasis: spec.decayHeatBasis,
    implementsSrs: spec.implementsSrs,
  };
}

const CLADDING_INTACT = { name: "Cladding", status: BarrierStatus.INTACT };
const PRIMARY_INTACT = { name: "Primary boundary", status: BarrierStatus.INTACT };
const CONTAINMENT_INTACT = { name: "Containment", status: BarrierStatus.INTACT };

const plantOperatingStates: PlantOperatingState[] = [
  makeState({
    uuid: "POS-01",
    name: "Full power, normal alignment",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Full-power steady-state operation with both heat-transport loops and the supercritical-CO₂ power conversion train aligned for power production.",
    temperature: range(545, 545, "°C"),
    pressure: range(0.15, 0.15, "MPa"),
    power: range(100, 100, "%"),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Primary and intermediate sodium loops aligned; power conversion in service.",
    rcbConfiguration: "Reactor head closed; containment intact.",
    sources: [
      { name: "In-core fuel (operating)", location: SourceLocation.IN_CORE, description: "Operating in-core fuel inventory.", status: "Operating" },
      { name: "Cover-gas argon (operating)", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Operating" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 32,
    sscCount: 14,
    meanDurationHours: 7300,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve at full-power operation.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-02",
    name: "Load-follow (reduced power)",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Load-follow operation across the licensed power band.",
    temperature: range(535, 535, "°C"),
    pressure: range(0.14, 0.14, "MPa"),
    power: range(30, 100, "%", 65),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Loops aligned for power production; turbine following grid demand.",
    rcbConfiguration: "Reactor head closed; containment intact.",
    sources: [
      { name: "In-core fuel (operating)", location: SourceLocation.IN_CORE, description: "Operating in-core fuel inventory.", status: "Operating" },
      { name: "Cover-gas argon (operating)", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Operating" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 32,
    sscCount: 14,
    meanDurationHours: 60,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve scaled to instantaneous power.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-03",
    name: "Hot standby",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.STARTUP,
    description: "Reactor subcritical, primary sodium held hot pending cooldown or return to power.",
    temperature: range(260, 530, "°C"),
    pressure: range(0.14, 0.14, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(2, 8, "MW", 5),
    rcsConfigurationDescription: "Primary loop in natural/forced circulation; power conversion isolated.",
    rcbConfiguration: "Reactor head closed; containment intact.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Cover-gas argon", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Decay" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 30,
    sscCount: 12,
    meanDurationHours: 180,
    meanEntryFrequency: 5,
    meanTimeAfterShutdownHours: 2,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve at 2 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-04",
    name: "Cooled, head intact",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Primary sodium cooled toward refuelling temperature with the reactor head still installed.",
    temperature: range(220, 260, "°C"),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(1, 3, "MW", 2),
    rcsConfigurationDescription: "Primary loop in forced circulation; cooldown in progress.",
    rcbConfiguration: "Reactor head closed; upper containment status pending entry.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Cover-gas argon", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Decay" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, { name: "Containment" }],
    instrumentationCount: 28,
    sscCount: 11,
    meanDurationHours: 90,
    meanEntryFrequency: 5,
    meanTimeAfterShutdownHours: 24,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve at 24 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-05",
    name: "Head off, refuelling cavity dry",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.REFUELING,
    description: "Reactor head removed under cover gas; refuelling cavity dry; primary boundary open.",
    temperature: range(210, 210, "°C"),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(0.5, 1.5, "MW", 1),
    rcsConfigurationDescription: "Primary boundary open for fuel handling; cover gas maintained.",
    rcbConfiguration: "Reactor head removed; primary boundary open; containment intact.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Spent fuel under cover gas", location: SourceLocation.EX_CORE, description: "Spent fuel in ex-vessel storage under cover gas.", status: "Decay" },
      { name: "Cover-gas argon (open path)", location: SourceLocation.EX_CORE, description: "Cover-gas argon with open transfer path.", status: "Open path" },
    ],
    barriers: [CLADDING_INTACT, { name: "Primary boundary", status: BarrierStatus.OPEN }, CONTAINMENT_INTACT],
    instrumentationCount: 24,
    sscCount: 9,
    meanDurationHours: 60,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 168,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve at 168 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-06",
    name: "Fuel-handling mode",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.REFUELING,
    description: "Active in-vessel fuel handling with spent fuel in transfer; containment deinerted.",
    temperature: range(210, 210, "°C"),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(0.5, 1.5, "MW", 1),
    rcsConfigurationDescription: "Primary boundary open; fuel-handling machine engaged.",
    rcbConfiguration: "Reactor head removed; primary boundary open; containment deinerted for access.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Spent fuel in transfer", location: SourceLocation.EX_CORE, description: "Spent fuel assemblies in transfer path.", status: "In transfer" },
      { name: "Cover-gas argon", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Decay" },
    ],
    barriers: [CLADDING_INTACT, { name: "Primary boundary", status: BarrierStatus.OPEN }, { name: "Containment", status: BarrierStatus.DEINERTED }],
    instrumentationCount: 22,
    sscCount: 9,
    meanDurationHours: 120,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 240,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve at 240 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-07",
    name: "Post-trip cooldown (DRACS)",
    evolutionId: "EV-04",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Post-trip cooldown with passive DRACS carrying decay heat to ambient.",
    temperature: range(200, 540, "°C"),
    pressure: range(0.13, 0.13, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(2, 10, "MW", 6),
    rcsConfigurationDescription: "Primary loop on natural circulation; DRACS in service.",
    rcbConfiguration: "Reactor head closed; containment intact.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Cover-gas argon", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Decay" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 26,
    sscCount: 10,
    meanDurationHours: 264,
    meanEntryFrequency: 0.4,
    meanTimeAfterShutdownHours: 1,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Vendor decay-heat curve immediately post-trip.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
  }),
  makeState({
    uuid: "POS-08",
    name: "IHX loop drained, primary hot",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Intermediate heat-transport loop drained for maintenance while primary is held at refuelling temperature.",
    temperature: range(230, 230, "°C"),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(1, 2, "MW", 1.5),
    rcsConfigurationDescription: "Intermediate loop drained; primary loop on a single heat-removal pathway.",
    rcbConfiguration: "Reactor head closed; intermediate loop drained.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Cover-gas argon", location: SourceLocation.EX_CORE, description: "Cover-gas argon activity.", status: "Decay" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, { name: "Intermediate loop", status: BarrierStatus.DRAINED }],
    instrumentationCount: 22,
    sscCount: 8,
    meanDurationHours: 176,
    meanEntryFrequency: 0.5,
    meanTimeAfterShutdownHours: 336,
    decayHeatLevelDefined: false,
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-C4", hlr: "C" }],
  }),
  makeState({
    uuid: "POS-09",
    name: "Cover-gas adjustment",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Cover-gas system maintenance with a vent path open while primary is held hot.",
    temperature: range(230, 230, "°C"),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(1, 2, "MW", 1.5),
    rcsConfigurationDescription: "Cover-gas vent open for maintenance; primary loop on natural circulation.",
    rcbConfiguration: "Reactor head closed; cover-gas vent open.",
    sources: [
      { name: "In-core fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Cover-gas argon (vented)", location: SourceLocation.EX_CORE, description: "Cover-gas argon with vent path open.", status: "Vented" },
    ],
    barriers: [CLADDING_INTACT, PRIMARY_INTACT, { name: "Cover-gas vent", status: BarrierStatus.OPEN }],
    instrumentationCount: 20,
    sscCount: 7,
    meanDurationHours: 32,
    meanEntryFrequency: 2,
    meanTimeAfterShutdownHours: 336,
    decayHeatLevelDefined: false,
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
  }),
];

// ─── Plant evolutions ────────────────────────────────────────────────────
function evolutionDocs(refs: string[]): PlantEvolution["reviewedDocumentation"] {
  return {
    operatingModes: refs,
    rcbConfigurations: refs,
    rcsParameterRanges: refs,
    decayHeatRemovalMechanisms: refs,
    availableInstrumentation: refs,
    activitiesLeadingToChanges: refs,
    radionuclideTransportBarrierStatus: refs,
    sscCapabilityChanges: refs,
    operationalAssumptions: refs,
  };
}

const plantEvolutions: PlantEvolution[] = [
  {
    uuid: "EV-01",
    name: "At-power operations",
    type: EvolutionType.AT_POWER,
    description: "Full-power and load-follow operation. Both intermediate heat-transport loops and the supercritical-CO₂ power conversion train aligned for power production.",
    operatingModes: ["POWER"],
    reviewedDocumentation: evolutionDocs(["DBD §3.2"]),
    plantOperatingStateIds: ["POS-01", "POS-02"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
  },
  {
    uuid: "EV-02",
    name: "Planned shutdown to refuelling",
    type: EvolutionType.CONTROLLED_SHUTDOWN,
    description: "Controlled power reduction → hot standby → primary sodium cooled to refuelling temperature. Refuelling head removal.",
    operatingModes: ["STARTUP", "SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["DBD §3.3", "OP-002"]),
    plantOperatingStateIds: ["POS-03", "POS-04"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
  },
  {
    uuid: "EV-03",
    name: "Refuelling",
    type: EvolutionType.REFUELING_OUTAGE,
    description: "In-vessel fuel handling under cover gas. Spent fuel transferred to ex-vessel storage. Reactor head closed before sodium re-heat.",
    operatingModes: ["REFUELING"],
    reviewedDocumentation: evolutionDocs(["DBD §3.4", "OP-014"]),
    plantOperatingStateIds: ["POS-05", "POS-06"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
  },
  {
    uuid: "EV-04",
    name: "Forced outage (reactor trip)",
    type: EvolutionType.FORCED_OUTAGE,
    description: "Post-trip cooldown — DRACS (passive direct reactor auxiliary cooling) carries decay heat to ambient.",
    operatingModes: ["SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["EOP-100"]),
    plantOperatingStateIds: ["POS-07"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
  },
  {
    uuid: "EV-05",
    name: "Maintenance with reactor at zero power",
    type: EvolutionType.MAINTENANCE_CONFIG,
    description: "Intermediate heat-transport loop drained for maintenance; primary held at refuelling temperature.",
    operatingModes: ["MAINTENANCE"],
    reviewedDocumentation: evolutionDocs(["OP-211"]),
    plantOperatingStateIds: ["POS-08", "POS-09"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
  },
];

// ─── POS groups ─────────────────────────────────────────────────────────
const plantOperatingStateGroups: PlantOperatingStateGroup[] = [
  {
    uuid: "GRP-PWR",
    name: "Power group",
    evolutionType: EvolutionType.AT_POWER,
    memberPosIds: ["POS-01", "POS-02"],
    similarityBasis: "POS-01 and POS-02 share identical barrier status, instrumentation, and decay heat. POS-02 (load-follow) is bounded by POS-01 (full power) for initiator response.",
    boundingCharacteristics: ["Maximum core power · POS-01"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 7360,
    entryFrequency: 0,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-SD",
    name: "Shutdown / cooldown group",
    evolutionType: EvolutionType.CONTROLLED_SHUTDOWN,
    memberPosIds: ["POS-03", "POS-04", "POS-07"],
    similarityBasis: "Cooldown phases share the same SSCs in service. Bounded by POS-04 (lowest temperature) for thermal response.",
    boundingCharacteristics: ["Lowest sodium temperature · POS-04"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 534,
    entryFrequency: 5,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-RFG",
    name: "Refuelling group",
    evolutionType: EvolutionType.REFUELING_OUTAGE,
    memberPosIds: ["POS-05", "POS-06"],
    similarityBasis: "Refuelling states share open primary boundary and active fuel handling.",
    boundingCharacteristics: ["Pending — fuel-handling phase"],
    doesNotMaskRiskSignificantContributors: false,
    summedDurationHours: 180,
    entryFrequency: 1,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
];

// ─── Screening, separation, subsumption ──────────────────────────────────
const screeningRecords: PosScreeningRecord[] = [
  {
    posId: "POS-09",
    retained: false,
    criterion: "SCR-1",
    justification: "Cover-gas adjustment configuration is bounded by fuel-handling mode (POS-06): same barrier status, lower in-vessel inventory exposure. Subsumed.",
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-05",
    retained: true,
    justification: "Retained — dry refuelling cavity is risk-significant; cannot be bounded by other states.",
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-08",
    retained: true,
    justification: "Retained — IHX-drained configuration represents a unique heat-removal pathway loss not covered by other states.",
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
];

const separationRecords: PosSeparationRecord[] = [
  {
    separatedPosIds: ["POS-03", "POS-04"],
    differingResponseBasis: "Hot standby and cooled-head states have materially different available cooldown margins.",
    differentSuccessCriteria: true,
    differentBarrierConfiguration: false,
    moreSevereReleasePotential: false,
    implementsSrs: [{ sr: "POS-B1", hlr: "B" }],
  },
];

const subsumedPosRecords: SubsumedPosRecord[] = [
  {
    subsumedPosId: "POS-09",
    subsumingPosId: "POS-06",
    criterion: "SCR-1",
    justification: "Cover-gas adjustment is bounded by fuel-handling mode for barrier status and inventory exposure.",
    riskImpact: ImportanceLevel.LOW,
    limitations: ["Valid only while cover-gas vent duration stays below the fuel-handling exposure window."],
    validationMethod: "Qualitative comparison of barrier status and inventory exposure.",
    implementsSrs: [{ sr: "POS-B4", hlr: "B" }],
  },
];

// ─── Decay heat characterizations ────────────────────────────────────────
const decayHeatCharacterizations: DecayHeatCharacterization[] = [
  {
    posId: "POS-03",
    decayHeatLevel: range(2, 8, "MW", 5),
    timeAfterShutdownHours: 2,
    basis: "Vendor decay-heat curve at 2 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-04",
    decayHeatLevel: range(1, 3, "MW", 2),
    timeAfterShutdownHours: 24,
    basis: "Vendor decay-heat curve at 24 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-05",
    decayHeatLevel: range(0.5, 1.5, "MW", 1),
    timeAfterShutdownHours: 168,
    basis: "Vendor decay-heat curve at 168 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
];

// ─── Validation rules ────────────────────────────────────────────────────
const validationRules: PosValidationRules = {
  mutualExclusivity: {
    delineationParameters: ["Operating mode", "Barrier status", "Reactor coolant temperature"],
    verificationMethod: "Pairwise comparison of delineation parameters across all states.",
    allConditionsBelongToExactlyOnePos: true,
  },
  collectiveExhaustivity: {
    verificationMethod: "Summed state durations compared against the full operating cycle.",
    totalCycleHours: 8760,
    summedPosHours: 8760,
    coverageFraction: 1,
    allConfigurationsCovered: true,
  },
  transitions: {
    transitionMatrix: {
      "POS-01": ["POS-02", "POS-03", "POS-07"],
      "POS-03": ["POS-04"],
      "POS-04": ["POS-05"],
      "POS-05": ["POS-06"],
    },
    transitionTriggers: {
      "POS-01->POS-03": "Controlled power reduction",
      "POS-04->POS-05": "Reactor head removal",
    },
  },
  implementsSrs: [{ sr: "POS-A10", hlr: "A" }],
};

// ─── Transition events ───────────────────────────────────────────────────
const transitionEvents: TransitionEvent[] = [
  {
    uuid: "TR-01",
    name: "Power reduction to hot standby",
    fromPosId: "POS-01",
    toPosId: "POS-03",
    trigger: "Controlled power reduction per OP-002.",
    frequency: 5,
    durationHours: 6,
    transitionParameters: [
      { parameter: "Reactor power", threshold: 0, units: "%", monitored: true },
    ],
    risks: ["Thermal stratification during cooldown"],
    requiredHumanActions: ["Manual power reduction"],
    requiredEquipment: ["Control rod drives"],
    procedureIds: ["OP-002"],
  },
];

// ─── Interviews ──────────────────────────────────────────────────────────
const interviewRecords: PlantOperatingStatesAnalysis["interviewRecords"] = [
  { evolutionId: "EV-01", date: "Mar 12, 2026", personnelRoles: ["Lead Reactor Engineer", "Senior I&C Designer"], method: "TABLETOP", findings: "Confirmed steady-state envelope; flagged narrow-range thermal stratification during load-follow.", overlookedEvolutionsIdentified: [] },
  { evolutionId: "EV-02", date: "Mar 14, 2026", personnelRoles: ["Operations Lead", "Refuelling Engineer"], method: "TABLETOP", findings: "Confirmed cooldown sequence; identified need to split hot-standby and intermediate cooldown.", overlookedEvolutionsIdentified: ["Intermediate cooldown split"] },
  { evolutionId: "EV-03", date: "Mar 21, 2026", personnelRoles: ["Refuelling Lead", "Containment Engineer", "Safety Analyst"], method: "WALKDOWN", findings: "Walkdown of fuel-handling path; flagged cover-gas deinerting timing for separate POS.", overlookedEvolutionsIdentified: ["Cover-gas deinerting", "Fuel-transfer staging"] },
  { evolutionId: "EV-04", date: "Mar 28, 2026", personnelRoles: ["Lead Safety Analyst"], method: "INTERVIEW", findings: "Decay-heat profile reviewed; DRACS bypass confirmed as design intent.", overlookedEvolutionsIdentified: [] },
  { evolutionId: "EV-05", date: "Apr 02, 2026", personnelRoles: ["Maintenance Engineer", "I&C Engineer"], method: "TABLETOP", findings: "Maintenance configurations reviewed against IHX outage procedures.", overlookedEvolutionsIdentified: [] },
  { date: "Apr 08, 2026", personnelRoles: ["Reactor Designer (Argent Nuclear)"], method: "INTERVIEW", findings: "Reviewed cover-gas chemistry implications across all states.", overlookedEvolutionsIdentified: [] },
  { date: "Apr 14, 2026", personnelRoles: ["Configuration Mgmt Lead"], method: "COMPUTERIZED_WALKDOWN", findings: "Walkdown of CAD model — instrumentation locations verified for POS-05/06.", overlookedEvolutionsIdentified: [] },
];

// ─── Plant representation accuracy ───────────────────────────────────────
const plantRepresentationAccuracy: PlantRepresentationAccuracy = {
  scope: "PRE_OPERATIONAL",
  accuracy: ImportanceLevel.MEDIUM,
  basis: "Analysis built from the design-basis document and vendor data; not yet validated against as-built configuration.",
  detailConsistentWithPlant: true,
  sufficientForRiskSignificantContributors: true,
  sufficiencyJustification: "Risk-significant states (refuelling, IHX-drained) are characterised at plant-specific detail.",
  highConfidenceAreas: ["Operating modes", "Barrier status"],
  lowerConfidenceAreas: ["Decay-heat characterisation for maintenance states"],
  improvementPlans: ["Close decay-heat characterisation for LPSD states before fuel load."],
  implementsSrs: [{ sr: "POS-D1", hlr: "D" }],
};

// ─── Model uncertainties ─────────────────────────────────────────────────
const modelUncertainties: ModelUncertainty[] = [
  { source: "Decay-heat curve", description: "Vendor decay-heat curve carries ±10% uncertainty for early times after shutdown.", impact: ImportanceLevel.MEDIUM, treatment: "Bounding upper curve used pending plant-specific measurement.", reasonableAlternatives: ["Plant-specific decay-heat measurement"] },
  { source: "Cover-gas activity", description: "Cover-gas activity model based on design estimates.", impact: ImportanceLevel.LOW, treatment: "Conservative activity assumed.", reasonableAlternatives: ["Sampled cover-gas activity"] },
  { source: "Thermal stratification", description: "Stratification during load-follow not fully resolved.", impact: ImportanceLevel.LOW, treatment: "Bounded by hot-standby envelope.", reasonableAlternatives: ["CFD stratification study"] },
  { source: "DRACS performance", description: "Passive DRACS capacity based on prototype test data.", impact: ImportanceLevel.MEDIUM, treatment: "Lower-bound capacity assumed.", reasonableAlternatives: ["Plant-specific DRACS commissioning data"] },
];

// ─── Pre-operational assumptions ─────────────────────────────────────────
const preOperationalAssumptions: PreOperationalAssumption[] = [
  { description: "As-built instrumentation list matches the Rev 2 design list.", influenceOnDefinition: "Available instrumentation per state.", riskImpact: ImportanceLevel.LOW, closureBasis: "Confirm against as-built records before fuel load.", plannedClosureActions: ["As-built instrumentation walkdown"], affectedPosIds: ["POS-01", "POS-05"] },
  { description: "DRACS passive capacity meets the lower-bound design value.", influenceOnDefinition: "Post-trip cooldown state success criteria.", riskImpact: ImportanceLevel.MEDIUM, closureBasis: "DRACS commissioning test.", plannedClosureActions: ["Commissioning test", "Update success criteria"], affectedPosIds: ["POS-07"] },
  { description: "Decay-heat levels for maintenance states bounded by vendor curve.", influenceOnDefinition: "Decay-heat characterisation for POS-08/09.", riskImpact: ImportanceLevel.MEDIUM, closureBasis: "Characterise LPSD decay heat.", plannedClosureActions: ["Decay-heat characterisation"], affectedPosIds: ["POS-08", "POS-09"] },
  { description: "Refuelling cover-gas path conforms to OP-014 timing.", influenceOnDefinition: "Barrier status during refuelling.", riskImpact: ImportanceLevel.LOW, closureBasis: "Confirm against final refuelling procedure.", plannedClosureActions: ["Procedure review"], affectedPosIds: ["POS-05", "POS-06"] },
  { description: "Containment deinerting window matches design intent.", influenceOnDefinition: "Containment barrier status during fuel handling.", riskImpact: ImportanceLevel.LOW, closureBasis: "Confirm deinerting procedure.", plannedClosureActions: ["Procedure review"], affectedPosIds: ["POS-06"] },
  { description: "Upper containment barrier status to be confirmed for cooled-head state.", influenceOnDefinition: "POS-04 barrier characterisation.", riskImpact: ImportanceLevel.LOW, closureBasis: "Enter barrier status for upper containment.", plannedClosureActions: ["Complete barrier-status entry"], affectedPosIds: ["POS-04"] },
];

// ─── Documentation ───────────────────────────────────────────────────────
const documentation: PosDocumentation = {
  processDescription: "Plant operating states were defined by decomposing the design-basis plant evolutions into mutually exclusive, collectively exhaustive states.",
  evolutionSelectionAndDefinitions: "Five plant evolutions span at-power, controlled shutdown, refuelling, forced outage, and maintenance configurations.",
  posIdentificationProcessAndCriteria: "States delineated where barrier status, available SSCs, or decay-heat level change materially.",
  posGroupingProcessAndCriteria: "States grouped where response is bounded by a common worst-case member.",
  posGroupDefinitions: "Power, shutdown/cooldown, and refuelling groups defined.",
  posCharacteristics: "Each state characterised by mode, RCS parameters, sources, barriers, instrumentation, and SSC configuration.",
  durationsTimesSinceShutdownFrequencies: "Mean durations and entry frequencies captured per state from operating-cycle estimates.",
  decayHeatPerPos: "Decay-heat level characterised for shutdown and refuelling states; maintenance states pending.",
  praTaskInterfaces: "Interfaces with initiating-event and event-sequence analyses identified.",
  modelUncertaintySources: "Four sources of model uncertainty logged with treatments.",
  asBuiltLimitations: "Analysis precedes as-built validation; pre-operational assumptions track closure.",
  implementsSrs: [{ sr: "POS-D1", hlr: "D" }, { sr: "POS-D2", hlr: "D" }, { sr: "POS-D3", hlr: "D" }],
};

// ─── Conformance matrix (SR-level; internal — surfaced only in the report) ──
const conformanceMatrix: SRConformance[] = [
  { sr: "POS-A1", hlr: "A", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantEvolutions"], evidence: "Five plant evolutions identified and documented." },
  { sr: "POS-A2", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantEvolutions[].reviewedDocumentation"], evidence: "Each evolution traced to design-basis documents." },
  { sr: "POS-A3", hlr: "A", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantOperatingStates"], evidence: "All states characterised; POS-04 upper-containment barrier entry pending.", reviewNotes: "POS-04 missing barrier-status entry." },
  { sr: "POS-A8", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["interviewRecords"], evidence: "Seven design-engineering interview sessions logged." },
  { sr: "POS-A9", hlr: "A", capabilityCategory: "CC-III", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantEvolutions[].futureEvolutionReview"], evidence: "Future-evolution review pending for one evolution." },
  { sr: "POS-A11", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantOperatingStates[].sscOperationalCharacteristics"], evidence: "Required SSC configurations recorded per state." },
  { sr: "POS-A12", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["modelUncertainties"], evidence: "Four model-uncertainty sources logged." },
  { sr: "POS-A13", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["preOperationalAssumptions"], evidence: "Six pre-operational assumptions logged with closure plans." },
  { sr: "POS-B2", hlr: "B", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["screeningRecords"], evidence: "Each screened-out state has a documented justification." },
  { sr: "POS-B3", hlr: "B", capabilityCategory: "CC-III", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantOperatingStateGroups[].doesNotMaskRiskSignificantContributors"], evidence: "Grouping does not mask risk-significant contributors." },
  { sr: "POS-B6", hlr: "B", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantOperatingStateGroups[].boundingCharacteristics"], evidence: "Bounding rationale pending for the refuelling group.", reviewNotes: "Group RFG bounding rationale not yet written." },
  { sr: "POS-C1", hlr: "C", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantOperatingStates[].meanDurationHours"], evidence: "Durations and frequencies captured; one state missing duration basis." },
  { sr: "POS-C4", hlr: "C", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "NOT_MET", satisfiedByElementPaths: ["decayHeatCharacterizations"], evidence: "Decay-heat characterisation incomplete for LPSD maintenance states.", reviewNotes: "0 of 6 LPSD states characterised." },
  { sr: "POS-D1", hlr: "D", capabilityCategory: "CC-III", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["documentation"], evidence: "Inputs traceable to source documents for every claim." },
  { sr: "POS-D2", hlr: "D", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["modelUncertainties"], evidence: "Sources of model uncertainty captured." },
  { sr: "POS-D3", hlr: "D", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["preOperationalAssumptions"], evidence: "Pre-operational assumptions logged with closure plans." },
];

const POS_ANALYSIS: PlantOperatingStatesAnalysis = {
  uuid: "POS-AURORA-1",
  name: "Aurora-1 — Plant Operating States Analysis",
  type: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
  version: "2",
  created: "2026-04-02",
  modified: "2026-04-14",
  owner: "Aakash Patel",
  status: "REVIEW",
  metadata: {
    plantName: "Aurora-1",
    plantStage: "PRE_OPERATIONAL",
    capabilityCategory: "CC-II",
    praScope: "Internal events, all plant operating states, full operating cycle.",
    includesNonInternalHazardGroups: false,
    freezeDate: "2026-04-01",
    includesAtPowerOperations: true,
  },
  plantEvolutions,
  plantOperatingStates,
  plantOperatingStateGroups,
  screeningRecords,
  separationRecords,
  subsumedPosRecords,
  decayHeatCharacterizations,
  interviewRecords,
  plantRepresentationAccuracy,
  modelUncertainties,
  preOperationalAssumptions,
  transitionEvents,
  validationRules,
  documentation,
  conformanceMatrix,
};

export { POS_ANALYSIS };

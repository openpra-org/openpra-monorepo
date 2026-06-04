import {
  type PlantOperatingStatesAnalysis,
  type PlantOperatingState,
  type PlantEvolution,
  type PlantOperatingStateGroup,
  type PosScreeningRecord,
  type PosSeparationRecord,
  type SubsumedPosRecord,
  type DecayHeatCharacterization,
  type TransitionEvent,
  type PosValidationRules,
  type PosDocumentation,
  type Instrument,
  type SscOperationalCharacteristic,
  type SafetyFunction,
  type DecayHeatRemovalConfiguration,
  type TimeBoundary,
  type RadioactiveSource,
  type RadionuclideTransportBarrier,
  type ReactorCoolantSystemParameters,
  type ParameterRange,
  OperatingMode,
  EvolutionType,
  BarrierStatus,
  SourceLocation,
  SafetyFunctionCategory,
} from "interfaces-mef-types/pos/plant-operating-states-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type InitiatingEvent } from "interfaces-mef-types/core/events";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { type BaseModelUncertaintyDocumentation, type PlantRepresentationAccuracy, type PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import { type SRConformance, type SRReference } from "interfaces-mef-types/core/pra-common";

// hardcoded — entire PlantOperatingStatesAnalysis instance below is demo data
// for Generic-1, a 300 MWt sodium-cooled fast reactor. It follows the OpenPRA POS
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
  preOperationalAssumptions?: PreOperationalAssumption[];
  implementsSrs: SRReference[];
  uiStatus?: "ok" | "warn" | "draft";
  uiStatusMessage?: string;
  docsLinked?: number;
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
    preOperationalAssumptions: spec.preOperationalAssumptions,
    implementsSrs: spec.implementsSrs,
    uiStatus: spec.uiStatus,
    uiStatusMessage: spec.uiStatusMessage,
    docsLinked: spec.docsLinked,
  };
}

function mkAssumption(
  id: string,
  affected: string,
  description: string,
  influenceOnDefinition: string,
  source: string,
  closurePlan: string,
  riskImpact: ImportanceLevel,
  owner: string,
): PreOperationalAssumption {
  return {
    uuid: id,
    assumptionId: id,
    status: "OPEN",
    limitations: [],
    description,
    influenceOnDefinition,
    closureBasis: source,
    plannedClosureActions: [closurePlan],
    affectedElementIds: [affected],
    riskImpact,
    owner,
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
    uiStatus: "ok",
    docsLinked: 4,
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
    uiStatus: "ok",
    docsLinked: 3,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-03-PA-1",
        "POS-03",
        "Mean hot-standby duration of 180 h/yr taken from the assumed equilibrium-cycle plan.",
        "Mean duration",
        "Assumed cycle plan (no operating data yet)",
        "Replace with measured cycle data after the first 3 fuel cycles.",
        ImportanceLevel.MEDIUM,
        "A. Patel",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 2,
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
    uiStatus: "warn",
    uiStatusMessage: "Barrier-status field for upper containment not yet entered.",
    docsLinked: 2,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-05-PA-1",
        "POS-05",
        "Refuelling cavity-dry duration assumed from vendor refuelling-cycle baseline.",
        "Mean duration",
        "Vendor baseline NR-2024-117",
        "Replace with measured outage data after the first 3 refuelling outages.",
        ImportanceLevel.MEDIUM,
        "A. Patel",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 3,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-06-PA-1",
        "POS-06",
        "Fuel-handling phase duration assumed from vendor refuelling-cycle baseline.",
        "Mean duration",
        "Vendor baseline NR-2024-117",
        "Replace with measured outage data after the first 3 refuelling outages.",
        ImportanceLevel.MEDIUM,
        "A. Patel",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 4,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-07-PA-1",
        "POS-07",
        "DRACS passive heat-removal performance taken from prototype-scale test data.",
        "Decay-heat removal credit",
        "Prototype-scale test campaign (NR-2023-088)",
        "Re-baseline after first-of-a-kind integrated DRACS test on Generic-1 (commissioning phase 4).",
        ImportanceLevel.MEDIUM,
        "K. Ortega",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 2,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-08-PA-1",
        "POS-08",
        "IHX maintenance frequency of 0.5/yr taken from generic SFR operating data.",
        "Entry frequency",
        "Generic SFR operating data (industry experience)",
        "Replace with plant-specific maintenance history after 5 years of operation.",
        ImportanceLevel.MEDIUM,
        "M. Béland",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-C4", hlr: "C" }],
    uiStatus: "draft",
    uiStatusMessage: "Decay-heat level not yet characterised.",
    docsLinked: 1,
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
    preOperationalAssumptions: [
      mkAssumption(
        "POS-09-PA-1",
        "POS-09",
        "Cover-gas vent rate assumed bounded by the design-basis vent-flow limit.",
        "Radioactive-material release rate",
        "DBD §6.4 design-basis vent-flow limit",
        "Confirm with measured vent-rate data during commissioning chemistry tests.",
        ImportanceLevel.LOW,
        "A. Patel",
      ),
    ],
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "draft",
    docsLinked: 1,
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
    sourceDocumentRef: "DBD §3.2",
    durationFractionHint: 0.84,
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
    sourceDocumentRef: "DBD §3.3 / OP-002",
    durationFractionHint: 0.05,
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
    sourceDocumentRef: "DBD §3.4 / OP-014",
    durationFractionHint: 0.06,
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
    sourceDocumentRef: "EOP-100",
    durationFractionHint: 0.03,
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
    sourceDocumentRef: "OP-211",
    durationFractionHint: 0.02,
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
    preOperationalAssumptions: [
      mkAssumption(
        "GRP-RFG-PA-1",
        "GRP-RFG",
        "Bounding-state selection for the refuelling group will rely on NM-028 once approved; provisional bounding is by phase-duration only.",
        "Bounding characteristic",
        "NM-028 (in review)",
        "Re-select bounding state after NM-028 v1.0 is released and exercised on pre-op refuelling-sequence data.",
        ImportanceLevel.MEDIUM,
        "N. Hartwell",
      ),
    ],
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
  { date: "Apr 08, 2026", personnelRoles: ["Reactor Designer (Generic Nuclear LLC)"], method: "INTERVIEW", findings: "Reviewed cover-gas chemistry implications across all states.", overlookedEvolutionsIdentified: [] },
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

// ─── Model uncertainty (single documentation object per new schema) ──────
const modelUncertainty: BaseModelUncertaintyDocumentation = {
  uuid: "POS-MU-1",
  name: "POS model uncertainty documentation",
  uncertaintySources: [
    { source: "Decay-heat curve", impact: "Vendor decay-heat curve carries ±10% uncertainty for early times after shutdown." },
    { source: "Cover-gas activity", impact: "Cover-gas activity model based on design estimates; conservative activity assumed." },
    { source: "Thermal stratification", impact: "Stratification during load-follow not fully resolved; bounded by hot-standby envelope." },
    { source: "DRACS performance", impact: "Passive DRACS capacity based on prototype test data; lower-bound capacity assumed." },
  ],
  relatedAssumptions: [
    { assumption: "Vendor decay-heat curve is bounding for the early post-shutdown window.", basis: "Pending plant-specific measurement." },
    { assumption: "Cover-gas activity remains within design estimate.", basis: "Design analysis; not yet sampled." },
    { assumption: "DRACS performance meets prototype-test lower bound.", basis: "Prototype testing; commissioning will close." },
  ],
  reasonableAlternatives: [
    { alternative: "Plant-specific decay-heat measurement", reasonNotSelected: "Not available pre-operation." },
    { alternative: "Sampled cover-gas activity", reasonNotSelected: "Not available pre-operation." },
    { alternative: "CFD stratification study", reasonNotSelected: "Not yet performed; bounded conservatively in the meantime." },
    { alternative: "Plant-specific DRACS commissioning data", reasonNotSelected: "Not yet available." },
  ],
};

// Per-state and per-group pre-operational assumptions are attached inline to
// the relevant PlantOperatingState / PlantOperatingStateGroup objects above.

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
  { sr: "POS-A9", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantEvolutions[].futureEvolutionReview"], evidence: "Future-evolution review pending for one evolution." },
  { sr: "POS-A11", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantOperatingStates[].sscOperationalCharacteristics"], evidence: "Required SSC configurations recorded per state." },
  { sr: "POS-A12", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["modelUncertainty"], evidence: "Four model-uncertainty sources logged." },
  { sr: "POS-A13", hlr: "A", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["preOperationalAssumptions"], evidence: "Six pre-operational assumptions logged with closure plans." },
  { sr: "POS-B2", hlr: "B", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["screeningRecords"], evidence: "Each screened-out state has a documented justification." },
  { sr: "POS-B3", hlr: "B", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["plantOperatingStateGroups[].doesNotMaskRiskSignificantContributors"], evidence: "Grouping does not mask risk-significant contributors." },
  { sr: "POS-B6", hlr: "B", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantOperatingStateGroups[].boundingCharacteristics"], evidence: "Bounding rationale pending for the refuelling group.", reviewNotes: "Group RFG bounding rationale not yet written." },
  { sr: "POS-C1", hlr: "C", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "PARTIAL", satisfiedByElementPaths: ["plantOperatingStates[].meanDurationHours"], evidence: "Durations and frequencies captured; one state missing duration basis." },
  { sr: "POS-C4", hlr: "C", capabilityCategory: "CC-I", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "NOT_MET", satisfiedByElementPaths: ["decayHeatCharacterizations"], evidence: "Decay-heat characterisation incomplete for LPSD maintenance states.", reviewNotes: "0 of 6 LPSD states characterised." },
  { sr: "POS-D1", hlr: "D", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["documentation"], evidence: "Inputs traceable to source documents for every claim." },
  { sr: "POS-D2", hlr: "D", capabilityCategory: "CC-II", applicableToStage: ["OPERATIONAL", "PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["modelUncertainty"], evidence: "Sources of model uncertainty captured." },
  { sr: "POS-D3", hlr: "D", capabilityCategory: "CC-II", applicableToStage: ["PRE_OPERATIONAL"], status: "MET", satisfiedByElementPaths: ["preOperationalAssumptions"], evidence: "Pre-operational assumptions logged with closure plans." },
];

const REVIEWERS = [
  { id: "rev-1", name: "Dr. Nadia Hartwell", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Lead Technical Reviewer" },
  { id: "rev-2", name: "Marc Béland", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Independent Reviewer · Systems" },
  { id: "rev-3", name: "Priya Subramanian", role: "INTERNAL_REVIEWER" as const, organization: "Generic Nuclear LLC", title: "Independent Reviewer · HRA" },
  { id: "approver-1", name: "Dr. Ji-won Chen", role: "INTERNAL_APPROVER" as const, organization: "Generic Nuclear LLC", title: "Director, Risk Engineering", qualification: "NQA-1 §2 Lead Reviewer (certified 2022, renewal 2025)" },
];

const REVIEW_COMMENTS = [
  {
    uuid: "irc-1",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-1",
    createdAt: "2026-05-26T10:00:00Z",
    associatedSr: "pos-define",
    text: "POS-04 still missing the upper-containment barrier-status entry. The conformance check correctly flags it; please close before this can advance to approval.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-2",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-2",
    createdAt: "2026-05-26T11:00:00Z",
    associatedSr: "grp-bounding",
    text: "Group RFG (refuelling): the bounding rationale for the fuel-handling phase is not yet written. NM-028 is in review — confirm the method is far enough along to anchor this judgement, otherwise mark RFG as not-yet-bounded for now.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-3",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-3",
    createdAt: "2026-05-27T09:00:00Z",
    associatedSr: "iv-eng",
    text: "Seven sessions logged is a healthy count. Consider attaching the cover-gas chemistry interview transcript (IV-06) — currently only the finding is captured.",
    resolved: true,
    resolution: "Transcript attached to IV-06.",
    resolvedAt: "2026-05-27T16:00:00Z",
    resolvedBy: "rev-3",
    severity: "MINOR" as const,
  },
  {
    uuid: "irc-4",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-1",
    createdAt: "2026-05-27T14:00:00Z",
    associatedSr: "decay-heat",
    text: "Blocking. Six LPSD states must have decay-heat characterisation before this workbook can be approved. NM-014 is approved — run the curve fit and lock the values.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-5",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-2",
    createdAt: "2026-05-27T15:00:00Z",
    associatedSr: "freq-dur",
    text: "POS-09 (cover-gas adjustment) — duration basis is empty. NM-021 should give you a pre-op estimate; please cite it explicitly.",
    resolved: false,
    severity: "MINOR" as const,
  },
  {
    uuid: "irc-6",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-3",
    createdAt: "2026-05-28T06:00:00Z",
    text: "Cross-references to NM-014 / NM-021 / NM-028 appear inline but are not yet collected in a Methods Used appendix. Recommended for traceability.",
    resolved: false,
    severity: "OBSERVATION" as const,
  },
  {
    uuid: "irc-7",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "approver-1",
    createdAt: "2026-05-28T09:30:00Z",
    associatedSr: "decay-heat",
    text: "Approver remark — withholding signature until NM-014 decay-heat values are locked across all six LPSD states. Major item irc-4 must close first.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-8",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "approver-1",
    createdAt: "2026-05-28T09:35:00Z",
    associatedSr: "grp-bounding",
    text: "Approver remark — agreed with reviewer irc-2 that GRP-RFG bounding rationale needs to be written out. The NM-028 anchoring approach is acceptable in principle but the workbook text must call it out explicitly.",
    resolved: false,
    severity: "MINOR" as const,
  },
  {
    uuid: "irc-9",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "approver-1",
    createdAt: "2026-05-28T09:40:00Z",
    text: "Approver remark — overall structure and traceability are sound. Once the two major findings close, this workbook should be ready for sign-off.",
    resolved: false,
    severity: "OBSERVATION" as const,
  },
];

const POS_ANALYSIS: PlantOperatingStatesAnalysis = {
  uuid: "POS-GENERIC-1",
  name: "POS Workbook 1",
  type: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
  version: "2",
  created: "2026-04-02",
  modified: "2026-05-28",
  owner: "Aakash Patel",
  workflowState: "DRAFT",
  workflowHistory: [
    { state: "DRAFT", enteredAt: "2026-04-02", actor: "Aakash Patel" },
  ],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: "2026-05-28", schemaVersion: "0.0.1" },
    analysisDate: "2026-05-28",
    analysts: ["Aakash Patel"],
    reviewers: REVIEWERS,
    scope: "Internal events, all plant operating states, full operating cycle.",
    limitations: ["Pre-operational; pending as-built validation."],
    lastModifiedDate: "2026-05-28",
    lastModifiedBy: "Aakash Patel",
    plantIdentity: {
      name: "Generic-1",
      vendor: "Generic Nuclear LLC",
      reactorType: "Sodium-cooled fast reactor (SFR)",
      thermalPower: "300 MWth",
      primaryCoolant: "Liquid sodium",
      intermediateCoolant: "Liquid sodium",
      powerConversionFluid: "Supercritical CO₂",
      siteName: "INL — Eastern Idaho",
    },
  },
  conformanceMatrix,
  internalReviewComments: {
    comments: REVIEW_COMMENTS,
    openCount: REVIEW_COMMENTS.filter((c) => !c.resolved).length,
    resolvedCount: REVIEW_COMMENTS.filter((c) => c.resolved).length,
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Internal events, all plant operating states, full operating cycle.",
  includesNonInternalHazardGroups: false,
  includesAtPowerOperations: true,
  plantEvolutions,
  plantOperatingStates,
  plantOperatingStateGroups,
  screeningRecords,
  separationRecords,
  subsumedPosRecords,
  decayHeatCharacterizations,
  interviewRecords,
  plantRepresentationAccuracy,
  modelUncertainty,
  transitionEvents,
  validationRules,
  documentation,
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-014", "NM-021", "NM-028"],
  exampleDocuments: [
    { id: "DOC-01", name: "Generic-1 Design Basis Document — Rev 4", kind: "doc", sizeLabel: "12.4 MB", uploadedLabel: "Mar 4", extracted: "Operating modes · RCS parameters · Barrier list", linked: 9 },
    { id: "DOC-02", name: "P&ID — Primary sodium loop", kind: "image", sizeLabel: "2.1 MB", uploadedLabel: "Mar 4", extracted: "Components · valve states", linked: 6 },
    { id: "DOC-03", name: "P&ID — Intermediate heat-transport loop", kind: "image", sizeLabel: "1.8 MB", uploadedLabel: "Mar 4", extracted: "Components · valve states", linked: 5 },
    { id: "DOC-04", name: "P&ID — Cover-gas system", kind: "image", sizeLabel: "1.4 MB", uploadedLabel: "Mar 4", extracted: "Vent paths · barriers", linked: 4 },
    { id: "DOC-05", name: "OP-002 — Startup & shutdown procedure", kind: "doc", sizeLabel: "3.2 MB", uploadedLabel: "Mar 6", extracted: "Operating modes · transitions", linked: 4 },
    { id: "DOC-06", name: "OP-014 — Refuelling sequence", kind: "doc", sizeLabel: "5.6 MB", uploadedLabel: "Mar 6", extracted: "Refuelling activities · barrier status", linked: 3 },
    { id: "DOC-07", name: "EOP-100 — Post-trip cooldown", kind: "doc", sizeLabel: "2.4 MB", uploadedLabel: "Mar 7", extracted: "DRACS activation · timing", linked: 2 },
    { id: "DOC-08", name: "Decay-heat curves (vendor)", kind: "sheet", sizeLabel: "92 KB", uploadedLabel: "Mar 11", extracted: "Decay-heat as function of time", linked: 6 },
    { id: "DOC-09", name: "Instrumentation list — Rev 2", kind: "sheet", sizeLabel: "210 KB", uploadedLabel: "Mar 14", extracted: "Sensor list · safety classification", linked: 9 },
  ],
};

export { POS_ANALYSIS };

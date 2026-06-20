import {
  type PlantOperatingStatesAnalysis,
  type PlantOperatingState,
  type PlantEvolution,
  type PlantOperatingStateGroup,
  type PosScreeningRecord,
  type PosSeparationRecord,
  type DemandTimeBasedRecord,
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
} from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type InitiatingEvent } from "interfaces-mef-types/core/events";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { type BaseModelUncertaintyDocumentation, type PlantRepresentationAccuracy, type PreOperationalAssumption } from "interfaces-mef-types/core/documentation";
import { type SRConformance, type SRReference } from "interfaces-mef-types/core/pra-common";

// hardcoded: the PlantOperatingStatesAnalysis instance below is the worked
// example for the Generic HTGR, a 350 MWt prismatic high-temperature gas-cooled
// reactor. It follows the OpenPRA POS MEF schema so it can be swapped for live
// data without reshaping. The type annotation guarantees conformance (the Zod
// mirror asserts schema/type equality).

// ─── Concise valid fillers for schema-required fields not surfaced in UI/report ──
function fillerInstruments(posId: string, count: number): Instrument[] {
  const out: Instrument[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push({
      uuid: `${posId}-INST-${i}`,
      name: `Instrument channel ${i}`,
      parameter: "Helium coolant temperature",
      location: "Reactor vessel",
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

// Per-state decay-heat-removal line-ups. System status reflects each state's
// described cooling configuration: the forced main loop at power and hot standby,
// the Shutdown Cooling System during cooldown and refuelling, passive cavity
// cooling only when forced circulation is lost, and the Shutdown Cooling System
// out of service during its maintenance outage.
const DHR_POWER: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Main helium circulator and steam generator": "YES" },
  secondaryCoolingSystems: { "Shutdown Cooling System": "STANDBY" },
  passiveMechanisms: { "Reactor Cavity Cooling System": "YES" },
};
const DHR_SCS_COOLDOWN: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Main helium circulator and steam generator": "STANDBY" },
  secondaryCoolingSystems: { "Shutdown Cooling System": "YES" },
  passiveMechanisms: { "Reactor Cavity Cooling System": "YES" },
};
const DHR_SCS_INSERVICE: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Main helium circulator and steam generator": "NO" },
  secondaryCoolingSystems: { "Shutdown Cooling System": "YES" },
  passiveMechanisms: { "Reactor Cavity Cooling System": "YES" },
};
const DHR_PASSIVE_ONLY: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Main helium circulator and steam generator": "NO" },
  secondaryCoolingSystems: { "Shutdown Cooling System": "NO" },
  passiveMechanisms: { "Reactor Cavity Cooling System": "YES" },
};
const DHR_SCS_OOS: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Main helium circulator and steam generator": "NO" },
  secondaryCoolingSystems: { "Shutdown Cooling System": "OOS" },
  passiveMechanisms: { "Reactor Cavity Cooling System": "YES" },
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
          name: "Reactor Cavity Cooling System",
          description: "Passive reactor cavity cooling by natural circulation.",
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
        parameter: "Helium coolant temperature",
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
    radionuclides: ["Cs-137", "Sr-90", "Ag-110m", "I-131"],
    status: s.status,
    releasePaths: ["Helium pressure boundary"],
    barriers: ["TRISO coating", "Primary boundary"],
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
  decayHeatRemoval?: DecayHeatRemovalConfiguration;
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
    decayHeatRemoval: spec.decayHeatRemoval ?? DHR_POWER,
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

const TRISO_INTACT = { name: "TRISO coating", status: BarrierStatus.INTACT };
const PRIMARY_INTACT = { name: "Primary boundary", status: BarrierStatus.INTACT };
const CONTAINMENT_INTACT = { name: "Containment", status: BarrierStatus.INTACT };

const plantOperatingStates: PlantOperatingState[] = [
  makeState({
    uuid: "POS-01",
    name: "Full power",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Full power steady operation. The main helium circulator drives forced flow through the steam generator for power production.",
    temperature: range(259, 687, "°C", 687),
    pressure: range(6.4, 6.4, "MPa"),
    power: range(100, 100, "%"),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Helium primary at full pressure. Forced circulation through the steam generator.",
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel", location: SourceLocation.IN_CORE, description: "Operating in-core fuel inventory.", status: "Operating" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Operating" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 32,
    sscCount: 14,
    meanDurationHours: 7300,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve at full-power operation.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 4,
  }),
  makeState({
    uuid: "POS-02",
    name: "Load follow",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Load follow across the licensed power band. Helium primary at full pressure.",
    temperature: range(259, 660, "°C", 600),
    pressure: range(6.4, 6.4, "MPa"),
    power: range(30, 100, "%", 65),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Helium primary at full pressure. Circulator speed following grid demand.",
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel", location: SourceLocation.IN_CORE, description: "Operating in-core fuel inventory.", status: "Operating" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Operating" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 32,
    sscCount: 14,
    meanDurationHours: 60,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve scaled to instantaneous power.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 3,
  }),
  makeState({
    uuid: "POS-03",
    name: "Hot standby",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.STARTUP,
    description: "Reactor subcritical and the primary still pressurised. Forced helium circulation holds temperature pending cooldown or return to power.",
    temperature: range(150, 350, "°C", 280),
    pressure: range(6.0, 6.4, "MPa", 6.4),
    power: range(0, 0, "%"),
    decayHeat: range(2.8, 3.5, "MW", 3.2),
    rcsConfigurationDescription: "Helium primary pressurised. Forced circulation on the main loop or the Shutdown Cooling System.",
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 30,
    sscCount: 12,
    meanDurationHours: 180,
    meanEntryFrequency: 5,
    meanTimeAfterShutdownHours: 2,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve at 2 h after shutdown.",
    preOperationalAssumptions: [
      mkAssumption(
        "POS-03-PA-1",
        "POS-03",
        "Mean hot-standby duration of 180 h per year taken from the assumed equilibrium-cycle plan.",
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
    name: "Forced cooldown on SCS",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Cooldown on the Shutdown Cooling System. The primary is cooling and depressurising toward shutdown conditions.",
    temperature: range(100, 300, "°C", 200),
    pressure: range(0.1, 6.0, "MPa", 3.0),
    power: range(0, 0, "%"),
    decayHeat: range(1.4, 2.0, "MW", 1.6),
    rcsConfigurationDescription: "Shutdown Cooling System in forced circulation. Primary depressurising.",
    decayHeatRemoval: DHR_SCS_COOLDOWN,
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 28,
    sscCount: 11,
    meanDurationHours: 90,
    meanEntryFrequency: 5,
    meanTimeAfterShutdownHours: 18,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve at 18 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 2,
  }),
  makeState({
    uuid: "POS-05",
    name: "Cold shutdown, primary closed",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Cold shutdown with the primary boundary closed, ready to open for refuelling. Low decay heat removed by the Shutdown Cooling System.",
    temperature: range(40, 100, "°C", 60),
    pressure: range(0.1, 0.5, "MPa", 0.1),
    power: range(0, 0, "%"),
    decayHeat: range(0.7, 1.1, "MW", 0.9),
    rcsConfigurationDescription: "Primary boundary closed and near atmospheric. Shutdown Cooling System in service.",
    decayHeatRemoval: DHR_SCS_INSERVICE,
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 26,
    sscCount: 10,
    meanDurationHours: 60,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 96,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve at 96 h after shutdown.",
    preOperationalAssumptions: [
      mkAssumption(
        "POS-05-PA-1",
        "POS-05",
        "Cold-shutdown duration before opening the vessel assumed from the design refuelling-cycle baseline.",
        "Mean duration",
        "Design refuelling baseline",
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
    name: "Refuelling, vessel open",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.REFUELING,
    description: "The reactor vessel is open and prismatic fuel blocks are being moved. The primary boundary is open to the refuelling floor.",
    temperature: range(40, 80, "°C", 60),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(0.5, 0.8, "MW", 0.65),
    rcsConfigurationDescription: "Primary boundary open for fuel handling. Cooling by the Shutdown Cooling System.",
    decayHeatRemoval: DHR_SCS_INSERVICE,
    rcbConfiguration: "Reactor vessel open. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Spent fuel blocks in transfer", location: SourceLocation.EX_CORE, description: "Spent prismatic fuel blocks in the transfer path.", status: "In transfer" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, { name: "Primary boundary", status: BarrierStatus.OPEN }, CONTAINMENT_INTACT],
    instrumentationCount: 22,
    sscCount: 9,
    meanDurationHours: 120,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 240,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve at 240 h after shutdown.",
    preOperationalAssumptions: [
      mkAssumption(
        "POS-06-PA-1",
        "POS-06",
        "Fuel-handling phase duration assumed from the design refuelling-cycle baseline.",
        "Mean duration",
        "Design refuelling baseline",
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
    name: "Post-trip, passive cooling",
    evolutionId: "EV-04",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "The reactor has tripped and forced cooling is lost. The passive Reactor Cavity Cooling System carries decay heat from the vessel. This is the risk-significant loss-of-forced-cooling state.",
    temperature: range(300, 700, "°C", 500),
    pressure: range(6.0, 6.4, "MPa", 6.4),
    power: range(0, 0, "%"),
    decayHeat: range(3.0, 7.0, "MW", 3.5),
    rcsConfigurationDescription: "Primary pressurised and intact. No forced circulation. Reactor Cavity Cooling System removing heat from the vessel.",
    decayHeatRemoval: DHR_PASSIVE_ONLY,
    rcbConfiguration: "Reactor vessel closed. Containment intact.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 26,
    sscCount: 10,
    meanDurationHours: 264,
    meanEntryFrequency: 0.4,
    meanTimeAfterShutdownHours: 1,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Design decay-heat curve immediately post-trip.",
    preOperationalAssumptions: [
      mkAssumption(
        "POS-07-PA-1",
        "POS-07",
        "Reactor Cavity Cooling System passive heat-removal performance taken from prototype-scale test data.",
        "Decay-heat removal credit",
        "Prototype-scale test campaign",
        "Re-baseline after the first-of-a-kind integrated RCCS test during commissioning.",
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
    name: "Maintenance, SCS out of service",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Reactor shut down with the Shutdown Cooling System out of service for maintenance. Decay heat removal relies on the remaining cooling path.",
    temperature: range(40, 120, "°C", 80),
    pressure: range(0.1, 0.5, "MPa", 0.1),
    power: range(0, 0, "%"),
    decayHeat: range(0.4, 0.7, "MW", 0.55),
    rcsConfigurationDescription: "Shutdown Cooling System out of service. Reactor Cavity Cooling System available as the passive path.",
    decayHeatRemoval: DHR_SCS_OOS,
    rcbConfiguration: "Reactor vessel closed. Shutdown Cooling System isolated.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary circuit plateout", location: SourceLocation.EX_CORE, description: "Activity deposited on primary circuit surfaces.", status: "Decay" },
    ],
    barriers: [TRISO_INTACT, PRIMARY_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 22,
    sscCount: 8,
    meanDurationHours: 176,
    meanEntryFrequency: 0.5,
    meanTimeAfterShutdownHours: 504,
    decayHeatLevelDefined: false,
    preOperationalAssumptions: [
      mkAssumption(
        "POS-08-PA-1",
        "POS-08",
        "Shutdown Cooling System maintenance frequency of 0.5 per year taken from generic HTGR operating data.",
        "Entry frequency",
        "Generic HTGR operating data (industry experience)",
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
    name: "Maintenance, primary depressurised",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Reactor shut down with the primary depressurised for maintenance. The primary helium boundary is open to the maintenance path.",
    temperature: range(40, 120, "°C", 80),
    pressure: range(0.1, 0.1, "MPa"),
    power: range(0, 0, "%"),
    decayHeat: range(0.4, 0.7, "MW", 0.55),
    rcsConfigurationDescription: "Primary depressurised with a maintenance opening. Cooling by the Shutdown Cooling System.",
    decayHeatRemoval: DHR_SCS_INSERVICE,
    rcbConfiguration: "Reactor vessel closed. Primary depressurised and vented for maintenance.",
    sources: [
      { name: "In-core TRISO fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Primary helium (vented)", location: SourceLocation.EX_CORE, description: "Primary helium activity with a vent path open.", status: "Vented" },
    ],
    barriers: [TRISO_INTACT, { name: "Primary boundary", status: BarrierStatus.OPEN }, CONTAINMENT_INTACT],
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
        "Primary vent rate assumed bounded by the design-basis vent-flow limit.",
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
    description: "Full power and load follow. Helium primary coolant runs at about 6.4 MPa with a core outlet near 687°C. The main helium circulator drives forced flow through the steam generator for power production.",
    operatingModes: ["POWER"],
    reviewedDocumentation: evolutionDocs(["MHTGR-350 Core Design Benchmark"]),
    plantOperatingStateIds: ["POS-01", "POS-02"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "MHTGR-350 Core Design Benchmark",
  },
  {
    uuid: "EV-02",
    name: "Planned shutdown to refuelling",
    type: EvolutionType.CONTROLLED_SHUTDOWN,
    description: "Controlled power reduction to hot standby. The Shutdown Cooling System removes decay heat by forced helium circulation. The primary is cooled and depressurised so the vessel can be opened.",
    operatingModes: ["SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["NGNP PRA White Paper"]),
    plantOperatingStateIds: ["POS-03", "POS-04"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "NGNP PRA White Paper",
  },
  {
    uuid: "EV-03",
    name: "Refuelling",
    type: EvolutionType.REFUELING_OUTAGE,
    description: "Offline refuelling of the prismatic core. The reactor is shut down and depressurised and the vessel closure is opened. Fuel handling equipment swaps hexagonal graphite fuel blocks. Spent blocks move to storage.",
    operatingModes: ["REFUELING"],
    reviewedDocumentation: evolutionDocs(["NGNP PRA White Paper"]),
    plantOperatingStateIds: ["POS-05", "POS-06"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "NGNP PRA White Paper",
  },
  {
    uuid: "EV-04",
    name: "Forced outage (reactor trip)",
    type: EvolutionType.FORCED_OUTAGE,
    description: "Post trip cooldown after an unplanned reactor trip. The Shutdown Cooling System carries decay heat when it is available. If forced cooling is lost the passive Reactor Cavity Cooling System removes heat from the reactor cavity.",
    operatingModes: ["SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["Modular HTGR Safety Characterization"]),
    plantOperatingStateIds: ["POS-07"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
    sourceDocumentRef: "Modular HTGR Safety Characterization",
  },
  {
    uuid: "EV-05",
    name: "Maintenance with reactor at zero power",
    type: EvolutionType.MAINTENANCE_CONFIG,
    description: "Reactor shut down for component maintenance. A decay heat removal train such as the Shutdown Cooling System may be out of service for the work. The core is held subcritical.",
    operatingModes: ["MAINTENANCE"],
    reviewedDocumentation: evolutionDocs(["NGNP PRA White Paper"]),
    plantOperatingStateIds: ["POS-08", "POS-09"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
    sourceDocumentRef: "NGNP PRA White Paper",
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
    boundingCharacteristics: ["Lowest helium temperature · POS-04"],
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
    similarityBasis: "POS-05 (cold shutdown) and POS-06 (vessel open) are the refuelling-evolution states. POS-06, with the primary boundary open during fuel handling, bounds POS-05 for barrier status.",
    boundingCharacteristics: ["Open primary boundary during fuel handling, POS-06"],
    doesNotMaskRiskSignificantContributors: false,
    summedDurationHours: 180,
    entryFrequency: 1,
    preOperationalAssumptions: [
      mkAssumption(
        "GRP-RFG-PA-1",
        "GRP-RFG",
        "Bounding-state selection for the refuelling group is provisional, by phase duration only. A detailed comparison of the member states is pending.",
        "Bounding characteristic",
        "Provisional, pending detailed comparison",
        "Re-select the bounding state after comparing the member states on pre-op refuelling-sequence data.",
        ImportanceLevel.MEDIUM,
        "N. Hartwell",
      ),
    ],
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-MNT",
    name: "Maintenance cooling group",
    evolutionType: EvolutionType.MAINTENANCE_CONFIG,
    memberPosIds: ["POS-08"],
    similarityBasis: "The Shutdown Cooling System out-of-service configuration is a unique loss of the active cooling path. No other retained state bounds it, so it is carried as its own group and represents itself.",
    boundingCharacteristics: ["Loss of the active shutdown-cooling path, POS-08"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 176,
    entryFrequency: 0.5,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
];

// ─── Screening, separation, subsumption ──────────────────────────────────
const screeningRecords: PosScreeningRecord[] = [
  {
    posId: "POS-09",
    retained: false,
    criterion: "SCR-1",
    justification: "Maintenance with the primary depressurised is bounded by refuelling (POS-06). Both have an open primary boundary, and POS-06 has higher inventory exposure. Subsumed.",
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-07",
    retained: true,
    justification: "Retained: the post-trip loss-of-forced-cooling state is risk-significant. The core heats up on passive cooling, so it cannot be bounded by other states.",
    riskSignificance: ImportanceLevel.HIGH,
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-08",
    retained: true,
    justification: "Retained: the Shutdown Cooling System out-of-service configuration is a unique loss of the active cooling path not covered by other states.",
    riskSignificance: ImportanceLevel.MEDIUM,
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
];

const separationRecords: PosSeparationRecord[] = [
  {
    separatedPosIds: ["POS-03", "POS-04"],
    differingResponseBasis: "Hot standby and forced-cooldown states have materially different available cooldown margins.",
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
    justification: "Maintenance with the primary depressurised is bounded by refuelling for barrier status and inventory exposure.",
    riskImpact: ImportanceLevel.LOW,
    limitations: ["Valid only while the maintenance vent duration stays below the refuelling exposure window."],
    validationMethod: "Qualitative comparison of barrier status and inventory exposure.",
    implementsSrs: [{ sr: "POS-B4", hlr: "B" }],
  },
];

// ─── Demand-based vs time-based separation ───────────────────────────────
const demandTimeBasedRecords: DemandTimeBasedRecord[] = [
  { posId: "POS-07", initiatorBasis: "DEMAND_BASED", delineatedToAvoidAveraging: true, justification: "The post-trip loss-of-forced-cooling state is entered on a reactor-trip demand. It is held separate from the time-based shutdown states so its short event-driven exposure is not averaged into the cycle-based durations.", implementsSrs: [{ sr: "POS-B5", hlr: "B" }] },
  { posId: "POS-08", initiatorBasis: "DEMAND_BASED", delineatedToAvoidAveraging: true, justification: "The Shutdown Cooling System maintenance state is entered on a maintenance demand. It is kept separate from the time-based refuelling states to avoid averaging its demand-based frequency with cycle-based durations.", implementsSrs: [{ sr: "POS-B5", hlr: "B" }] },
];

// ─── Decay heat characterizations ────────────────────────────────────────
const decayHeatCharacterizations: DecayHeatCharacterization[] = [
  {
    posId: "POS-03",
    decayHeatLevel: range(2.8, 3.5, "MWth", 3.2),
    timeAfterShutdownHours: 2,
    basis: "Design decay-heat curve at 2 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-04",
    decayHeatLevel: range(1.4, 2.0, "MWth", 1.6),
    timeAfterShutdownHours: 18,
    basis: "Design decay-heat curve at 18 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-05",
    decayHeatLevel: range(0.7, 1.1, "MWth", 0.9),
    timeAfterShutdownHours: 96,
    basis: "Design decay-heat curve at 96 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
];

// ─── Validation rules ────────────────────────────────────────────────────
const validationRules: PosValidationRules = {
  mutualExclusivity: {
    delineationParameters: ["Operating mode", "Power level", "Reactor coolant temperature", "Barrier status"],
    verificationMethod: "Pairwise comparison of delineation parameters across all states.",
    allConditionsBelongToExactlyOnePos: true,
  },
  collectiveExhaustivity: {
    verificationMethod: "Summed state durations compared against the full operating cycle.",
    totalCycleHours: 8760,
    summedPosHours: 8282,
    coverageFraction: 0.945,
    allConfigurationsCovered: false,
  },
  transitions: {
    transitionMatrix: {
      "POS-01": ["POS-02", "POS-03", "POS-07"],
      "POS-02": ["POS-01"],
      "POS-03": ["POS-04", "POS-01"],
      "POS-04": ["POS-05", "POS-03", "POS-08"],
      "POS-05": ["POS-06", "POS-04"],
      "POS-06": ["POS-05"],
      "POS-07": ["POS-03"],
      "POS-08": ["POS-04"],
    },
    transitionTriggers: {
      "POS-01->POS-03": "Controlled power reduction",
      "POS-04->POS-05": "Primary reaches cold-shutdown conditions",
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
  { uuid: "iv-01", evolutionId: "EV-01", date: "Mar 12, 2026", personnelRoles: ["Lead Reactor Engineer", "Senior I&C Designer"], method: "TABLETOP", findings: "Confirmed steady-state envelope; flagged narrow-range thermal stratification during load-follow.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-02", evolutionId: "EV-02", date: "Mar 14, 2026", personnelRoles: ["Operations Lead", "Refuelling Engineer"], method: "TABLETOP", findings: "Confirmed the cooldown sequence. Identified the need to split hot standby and forced cooldown.", overlookedEvolutionsIdentified: ["Forced-cooldown split"] },
  { uuid: "iv-03", evolutionId: "EV-03", date: "Mar 21, 2026", personnelRoles: ["Refuelling Lead", "Containment Engineer", "Safety Analyst"], method: "WALKDOWN", findings: "Walkdown of the fuel-handling path. Flagged the vessel-opening timing for a separate POS.", overlookedEvolutionsIdentified: ["Vessel-opening sequence", "Fuel-transfer staging"] },
  { uuid: "iv-04", evolutionId: "EV-04", date: "Mar 28, 2026", personnelRoles: ["Lead Safety Analyst"], method: "INTERVIEW", findings: "Decay-heat profile reviewed. Passive Reactor Cavity Cooling System heat removal confirmed as design intent.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-05", evolutionId: "EV-05", date: "Apr 02, 2026", personnelRoles: ["Maintenance Engineer", "I&C Engineer"], method: "TABLETOP", findings: "Maintenance configurations reviewed against Shutdown Cooling System outage procedures.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-06", date: "Apr 08, 2026", personnelRoles: ["Reactor Designer (Generic Nuclear LLC)"], method: "INTERVIEW", findings: "Reviewed helium coolant chemistry implications across all states.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-07", date: "Apr 14, 2026", personnelRoles: ["Configuration Mgmt Lead"], method: "COMPUTERIZED_WALKDOWN", findings: "Walkdown of CAD model — instrumentation locations verified for POS-05/06.", overlookedEvolutionsIdentified: [] },
];

// ─── Plant representation accuracy ───────────────────────────────────────
const plantRepresentationAccuracy: PlantRepresentationAccuracy = {
  scope: "PRE_OPERATIONAL",
  accuracy: ImportanceLevel.MEDIUM,
  basis: "Analysis built from the design-basis document and vendor data. Not yet validated against the as-built configuration.",
  detailConsistentWithPlant: true,
  sufficientForRiskSignificantContributors: true,
  sufficiencyJustification: "Risk-significant states (refuelling, Shutdown Cooling System out of service) are characterised at plant-specific detail.",
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
    { source: "Decay-heat curve", impact: "Design decay-heat curve carries ±10% uncertainty for early times after shutdown." },
    { source: "Helium coolant activity", impact: "Helium coolant activity model based on design estimates. Conservative activity assumed." },
    { source: "Thermal stratification", impact: "Stratification during load follow not fully resolved. Bounded by the hot-standby envelope." },
    { source: "Reactor Cavity Cooling System performance", impact: "Passive RCCS capacity based on prototype test data. Lower-bound capacity assumed." },
  ],
  relatedAssumptions: [
    { assumption: "Design decay-heat curve is bounding for the early post-shutdown window.", basis: "Pending plant-specific measurement." },
    { assumption: "Helium coolant activity remains within design estimate.", basis: "Design analysis, not yet sampled." },
    { assumption: "Reactor Cavity Cooling System performance meets prototype-test lower bound.", basis: "Prototype testing, commissioning will close." },
  ],
  reasonableAlternatives: [
    { alternative: "Plant-specific decay-heat measurement", reasonNotSelected: "Not available pre-operation." },
    { alternative: "Sampled helium coolant activity", reasonNotSelected: "Not available pre-operation." },
    { alternative: "CFD stratification study", reasonNotSelected: "Not yet performed. Bounded conservatively in the meantime." },
    { alternative: "Plant-specific RCCS commissioning data", reasonNotSelected: "Not yet available." },
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

// ─── Conformance matrix ──────────────────────────────────────────────────
// Conformance is derived live from the analysis data (deriveConformance in
// posSelectors), so completing a step turns its requirements green. The stored
// matrix is left empty so the derivation is the single source of truth.
const conformanceMatrix: SRConformance[] = [];

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
    associatedSr: "POS-A3",
    text: "POS-04 still missing the upper-containment barrier-status entry. The conformance check correctly flags it; please close before this can advance to approval.",
    resolved: true,
    resolution: "Upper-containment barrier status entered for POS-04 (Containment, intact). The conformance check now clears POS-A3.",
    resolvedAt: "2026-05-28T08:00:00Z",
    resolvedBy: "rev-1",
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-2",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-2",
    createdAt: "2026-05-26T11:00:00Z",
    associatedSr: "POS-B6",
    text: "Group RFG (refuelling): the bounding rationale for the fuel-handling phase is not yet written. Compare the member states and write out which one bounds the group, or mark RFG as not-yet-bounded for now.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-3",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-3",
    createdAt: "2026-05-27T09:00:00Z",
    associatedSr: "POS-A8",
    text: "Seven sessions logged is a healthy count. Consider attaching the helium chemistry interview transcript (IV-06). Currently only the finding is captured.",
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
    associatedSr: "POS-C4",
    text: "Blocking. Six LPSD states must have decay-heat characterisation before this workbook can be approved. Run the decay-heat curve fit and lock the values.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-5",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-2",
    createdAt: "2026-05-27T15:00:00Z",
    associatedSr: "POS-C2",
    text: "Several retained states still lack a documented duration basis. Please add the basis for each when you set durations in Step 08.",
    resolved: false,
    severity: "MINOR" as const,
  },
  {
    uuid: "irc-6",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "rev-3",
    createdAt: "2026-05-28T06:00:00Z",
    text: "The source documents are linked in Step 02. Consider adding a short note that maps each key parameter to the document it came from, for traceability.",
    resolved: false,
    severity: "OBSERVATION" as const,
  },
  {
    uuid: "irc-7",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "approver-1",
    createdAt: "2026-05-28T09:30:00Z",
    associatedSr: "POS-C4",
    text: "Approver remark. Withholding signature until the decay-heat values are locked across all six LPSD states. Major item irc-4 must close first.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "irc-8",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "approver-1",
    createdAt: "2026-05-28T09:35:00Z",
    associatedSr: "POS-B6",
    text: "Approver remark. Agreed with reviewer irc-2 that the GRP-RFG bounding rationale needs to be written out. Compare the member states and state the bounding one explicitly in the workbook text.",
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
      name: "Generic HTGR",
      vendor: "Generic Nuclear LLC",
      reactorType: "High-temperature gas-cooled reactor (prismatic)",
      thermalPower: "350 MWth",
      primaryCoolant: "Helium",
      intermediateCoolant: "None (direct steam cycle)",
      powerConversionFluid: "Steam (Rankine cycle)",
      siteName: "Generic site",
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
  includesLPSDOperations: true,
  plantEvolutions,
  plantOperatingStates,
  plantOperatingStateGroups,
  screeningRecords,
  separationRecords,
  subsumedPosRecords,
  demandTimeBasedRecords,
  decayHeatCharacterizations,
  interviewRecords,
  plantRepresentationAccuracy,
  modelUncertainty,
  transitionEvents,
  validationRules,
  documentation,
  configurationControlRecordId: "cc-2026.04.18-001",
  decayHeatOperatingDays: 540,
  newlyDevelopedMethodIds: [],
  exampleDocuments: [
    { id: "DOC-01", name: "MHTGR-350 Core Design Benchmark", kind: "doc", sizeLabel: "OECD/NEA", uploadedLabel: "MHTGR-350 benchmark", extracted: "Core thermal power, helium pressure, core inlet and outlet temperatures, mass flow, prismatic core design", linked: 5, url: "/api/example-documents/pos/mhtgr-benchmark", citation: "OECD/NEA MHTGR-350 MW Core Design Benchmark, INL results, OSTI 1129932 (https://www.osti.gov/biblio/1129932)" },
    { id: "DOC-02", name: "Multi-physics steady-state analysis of the MHTGR-350", kind: "doc", sizeLabel: "J. Nucl. Sci. Technol.", uploadedLabel: "2017", extracted: "Confirms 350 MWt, 6.4 MPa, 259 and 687 °C, 157.1 kg/s helium flow", linked: 4, url: "/api/example-documents/pos/mhtgr-analysis", citation: "Multi-physics steady-state analysis of the MHTGR-350, J. Nucl. Sci. Technol. 2017 (https://doi.org/10.1080/00223131.2017.1299649)" },
    { id: "DOC-03", name: "Modular HTGR Safety Characterization", kind: "doc", sizeLabel: "ORNL", uploadedLabel: "Pub49707", extracted: "Passive decay heat removal, the RCCS and SCS, loss of forced cooling", linked: 4, url: "/api/example-documents/pos/htgr-safety", citation: "Overview of Modular HTGR Safety Characterization, ORNL Pub49707 (https://info.ornl.gov/sites/publications/files/Pub49707.pdf)" },
    { id: "DOC-04", name: "NGNP PRA White Paper", kind: "doc", sizeLabel: "INL", uploadedLabel: "INL/EXT-11-21270", extracted: "HTGR PRA approach, plant operating states, licensing basis events", linked: 5, url: "/api/example-documents/pos/ngnp-pra", citation: "NGNP Probabilistic Risk Assessment White Paper, INL/EXT-11-21270 (http://large.stanford.edu/courses/2015/ph241/al-alami1/docs/11-21270.pdf)" },
  ],
};

export { POS_ANALYSIS };

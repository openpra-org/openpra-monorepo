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

function fillerInstruments(posId: string, count: number): Instrument[] {
  const out: Instrument[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push({
      uuid: `${posId}-INST-${i}`,
      name: `Instrument channel ${i}`,
      parameter: "Primary sodium temperature",
      location: "Reactor primary tank",
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

const DHR_POWER: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Primary sodium centrifugal pumps (forced circulation)": "YES" },
  secondaryCoolingSystems: { "Intermediate sodium loop and steam plant": "YES" },
  passiveMechanisms: { "NaK shutdown coolers": "STANDBY", "Natural circulation in the primary tank": "STANDBY" },
};
const DHR_AUX: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Auxiliary EM pump (forced circulation)": "YES" },
  secondaryCoolingSystems: { "Intermediate sodium loop (natural circulation)": "YES" },
  passiveMechanisms: { "NaK shutdown coolers": "STANDBY", "Natural circulation in the primary tank": "STANDBY" },
};
const DHR_NATCIRC: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Primary sodium centrifugal pumps (forced circulation)": "NO" },
  secondaryCoolingSystems: { "Intermediate sodium loop": "NO" },
  passiveMechanisms: { "Natural circulation in the primary tank": "YES", "NaK shutdown coolers": "YES" },
};
const DHR_SHUTDOWN_COOLERS: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Auxiliary EM pump (forced circulation)": "STANDBY" },
  secondaryCoolingSystems: { "Intermediate sodium loop": "NO" },
  passiveMechanisms: { "NaK shutdown coolers": "YES", "Natural circulation in the primary tank": "YES" },
};
const DHR_COOLER_OOS: DecayHeatRemovalConfiguration = {
  primaryCoolingSystems: { "Auxiliary EM pump (forced circulation)": "YES" },
  secondaryCoolingSystems: { "Intermediate sodium loop": "STANDBY" },
  passiveMechanisms: { "NaK shutdown cooler A": "OOS", "NaK shutdown cooler B": "YES", "Natural circulation in the primary tank": "YES" },
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
          name: "Natural circulation in the primary tank",
          description: "Passive decay-heat removal by natural convection in the sodium pool to the NaK shutdown coolers.",
          status: "Available",
          type: "PASSIVE",
        },
      ],
      supportingSscs: [`${posId}-SSC-1`],
      applicableInitiatingEvents: [`${posId}-IE-LOFC`],
    },
  ];
}

function fillerInitiators(posId: string): InitiatingEvent[] {
  return [
    {
      uuid: `${posId}-IE-LOFC`,
      name: "Loss of forced cooling",
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
        parameter: "Primary sodium temperature",
        threshold: 371,
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
    monitoringParameters: ["Activity monitors", "Cover gas monitors"],
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
    radionuclides: ["Na-24", "Cs-137", "Sr-90", "I-131", "Kr-85"],
    status: s.status,
    releasePaths: ["Primary sodium boundary", "Cover gas system"],
    barriers: ["Stainless steel cladding", "Primary sodium boundary"],
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
    activitiesLeadingToParameterChanges: ["Reactor power manoeuvring", "Primary pump transfer to the auxiliary EM pump"],
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

const CLAD_INTACT = { name: "Stainless steel cladding", status: BarrierStatus.INTACT };
const SODIUM_INTACT = { name: "Primary sodium boundary", status: BarrierStatus.INTACT };
const COVERGAS_INTACT = { name: "Reactor cover gas boundary", status: BarrierStatus.INTACT };
const CONTAINMENT_INTACT = { name: "Containment", status: BarrierStatus.INTACT };

const plantOperatingStates: PlantOperatingState[] = [
  makeState({
    uuid: "POS-01",
    name: "Full power",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Full power steady operation at 62.5 MWt. Two primary sodium centrifugal pumps drive forced flow through the core to the intermediate loop and the steam plant.",
    temperature: range(371, 473, "°C", 473),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(100, 100, "%"),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Pool-type primary near atmospheric pressure under argon cover gas. Forced circulation by the primary centrifugal pumps to the intermediate sodium loop.",
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel", location: SourceLocation.IN_CORE, description: "Operating in-core metallic fuel inventory.", status: "Operating" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity in the circulating primary sodium.", status: "Operating" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 30,
    sscCount: 14,
    meanDurationHours: 5978,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve at full-power operation.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 5,
  }),
  makeState({
    uuid: "POS-02",
    name: "Reduced and experimental power",
    evolutionId: "EV-01",
    operatingMode: OperatingMode.POWER,
    description: "Operation across the licensed power band for physics tests and experiment irradiation. Primary centrifugal pumps in forced circulation.",
    temperature: range(360, 473, "°C", 440),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(20, 100, "%", 50),
    decayHeat: range(0, 0, "MW"),
    rcsConfigurationDescription: "Pool-type primary under argon cover gas. Primary centrifugal pump speed following the test plan.",
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel", location: SourceLocation.IN_CORE, description: "Operating in-core metallic fuel inventory.", status: "Operating" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity in the circulating primary sodium.", status: "Operating" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 30,
    sscCount: 14,
    meanDurationHours: 700,
    meanEntryFrequency: 0,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve scaled to instantaneous power.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 4,
  }),
  makeState({
    uuid: "POS-03",
    name: "Hot standby",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.STARTUP,
    description: "Reactor subcritical with the primary centrifugal pumps still running. Forced circulation carries decay heat to the intermediate loop while the pool is held hot.",
    temperature: range(340, 400, "°C", 371),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.46, 0.58, "MW", 0.52),
    rcsConfigurationDescription: "Pool hot near 371 C. Forced circulation on the primary centrifugal pumps to the intermediate loop.",
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity decaying in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 28,
    sscCount: 12,
    meanDurationHours: 150,
    meanEntryFrequency: 8,
    meanTimeAfterShutdownHours: 2,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve at 2 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 2,
  }),
  makeState({
    uuid: "POS-04",
    name: "Auxiliary-pump decay heat removal",
    evolutionId: "EV-02",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Primary centrifugal pumps tripped to the auxiliary EM pump on the DC battery supply. Decay heat is carried by low forced flow with natural circulation in the intermediate loop.",
    temperature: range(320, 380, "°C", 360),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.22, 0.30, "MW", 0.26),
    rcsConfigurationDescription: "Auxiliary EM pump providing low forced flow. Intermediate loop in natural circulation.",
    decayHeatRemoval: DHR_AUX,
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity decaying in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 26,
    sscCount: 11,
    meanDurationHours: 220,
    meanEntryFrequency: 8,
    meanTimeAfterShutdownHours: 24,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve at 24 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 2,
  }),
  makeState({
    uuid: "POS-05",
    name: "Refuelling under sodium",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.REFUELING,
    description: "Reactor shut down and subassemblies moved through the rotating plugs and the gripper while the pool stays sealed at 371 C under argon. Fuel handling penetrations are active. The pool is never opened to air.",
    temperature: range(355, 390, "°C", 371),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.09, 0.13, "MW", 0.11),
    rcsConfigurationDescription: "Pool held at 371 C for fuel handling. Decay heat removed by the NaK shutdown coolers and natural circulation.",
    decayHeatRemoval: DHR_SHUTDOWN_COOLERS,
    rcbConfiguration: "Primary tank closed under argon cover gas. Cover gas boundary penetrated for fuel handling. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Spent subassemblies in in-tank storage", location: SourceLocation.EX_CORE, description: "Discharged subassemblies in the in-tank storage basket.", status: "In transfer" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, { name: "Reactor cover gas boundary", status: BarrierStatus.OPEN }, CONTAINMENT_INTACT],
    instrumentationCount: 24,
    sscCount: 10,
    meanDurationHours: 680,
    meanEntryFrequency: 8,
    meanTimeAfterShutdownHours: 240,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve at 240 h after shutdown.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-A11", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 4,
  }),
  makeState({
    uuid: "POS-06",
    name: "Long-term shutdown",
    evolutionId: "EV-03",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Extended outage with the pool cooled toward its lower maintenance band. Sodium is held well above its melting point by the shutdown coolers and trace heating.",
    temperature: range(230, 320, "°C", 280),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.07, 0.11, "MW", 0.09),
    rcsConfigurationDescription: "Pool at the lower maintenance band, sodium kept molten. NaK shutdown coolers carrying the low decay-heat load.",
    decayHeatRemoval: DHR_SHUTDOWN_COOLERS,
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 largely decayed. Residual long-lived activity in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 22,
    sscCount: 9,
    meanDurationHours: 380,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 720,
    decayHeatLevelDefined: false,
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "draft",
    uiStatusMessage: "Decay-heat level not yet characterised.",
    docsLinked: 2,
  }),
  makeState({
    uuid: "POS-07",
    name: "Post-trip natural circulation",
    evolutionId: "EV-04",
    operatingMode: OperatingMode.SHUTDOWN,
    description: "Forced flow is lost and the core is cooled by natural circulation in the sodium pool to the NaK shutdown coolers. Reactivity feedback holds the core subcritical. This is the risk-significant loss-of-forced-cooling state.",
    temperature: range(371, 510, "°C", 440),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.55, 0.95, "MW", 0.61),
    rcsConfigurationDescription: "Primary centrifugal pumps off. Natural circulation in the primary tank to the NaK shutdown coolers, which reject heat to the atmosphere.",
    decayHeatRemoval: DHR_NATCIRC,
    rcbConfiguration: "Primary tank closed under argon cover gas. Containment intact.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Na-24 activity in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 26,
    sscCount: 10,
    meanDurationHours: 24,
    meanEntryFrequency: 0.5,
    meanTimeAfterShutdownHours: 1,
    decayHeatLevelDefined: true,
    decayHeatBasis: "Decay-heat curve immediately post-trip.",
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "ok",
    docsLinked: 3,
  }),
  makeState({
    uuid: "POS-08",
    name: "Maintenance, shutdown cooler out of service",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Reactor shut down with one NaK shutdown cooler out of service for maintenance. Decay heat removal relies on the remaining cooler and natural circulation.",
    temperature: range(300, 380, "°C", 350),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.07, 0.11, "MW", 0.09),
    rcsConfigurationDescription: "One NaK shutdown cooler isolated for maintenance. Auxiliary EM pump available, second cooler and natural circulation carrying the load.",
    decayHeatRemoval: DHR_COOLER_OOS,
    rcbConfiguration: "Primary tank closed under argon cover gas. One shutdown cooler isolated.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Residual activity in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 22,
    sscCount: 8,
    meanDurationHours: 150,
    meanEntryFrequency: 1,
    meanTimeAfterShutdownHours: 504,
    decayHeatLevelDefined: false,
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }, { sr: "POS-C4", hlr: "C" }],
    uiStatus: "draft",
    uiStatusMessage: "Decay-heat level not yet characterised.",
    docsLinked: 1,
  }),
  makeState({
    uuid: "POS-09",
    name: "Maintenance, intermediate loop isolated",
    evolutionId: "EV-05",
    operatingMode: OperatingMode.MAINTENANCE,
    description: "Reactor shut down with the intermediate sodium loop isolated for maintenance. Both shutdown coolers and natural circulation remain available for decay heat removal.",
    temperature: range(300, 380, "°C", 350),
    pressure: range(0.10, 0.12, "MPa", 0.11),
    power: range(0, 0, "%"),
    decayHeat: range(0.07, 0.11, "MW", 0.09),
    rcsConfigurationDescription: "Intermediate loop isolated. Both NaK shutdown coolers and natural circulation available.",
    decayHeatRemoval: DHR_SHUTDOWN_COOLERS,
    rcbConfiguration: "Primary tank closed under argon cover gas. Intermediate loop isolated.",
    sources: [
      { name: "In-core metallic driver fuel (decay)", location: SourceLocation.IN_CORE, description: "Decaying in-core fuel inventory.", status: "Decay" },
      { name: "Activated primary sodium", location: SourceLocation.EX_CORE, description: "Residual activity in the primary sodium.", status: "Decay" },
    ],
    barriers: [CLAD_INTACT, SODIUM_INTACT, COVERGAS_INTACT, CONTAINMENT_INTACT],
    instrumentationCount: 20,
    sscCount: 7,
    meanDurationHours: 32,
    meanEntryFrequency: 2,
    meanTimeAfterShutdownHours: 336,
    decayHeatLevelDefined: false,
    implementsSrs: [{ sr: "POS-A3", hlr: "A" }],
    uiStatus: "draft",
    docsLinked: 1,
  }),
];

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
    description: "Full power and reduced experimental power. The pool-type primary runs near atmospheric pressure under argon with a core outlet near 473 C. Two primary sodium centrifugal pumps drive forced flow to the intermediate loop and the steam plant.",
    operatingModes: ["POWER"],
    reviewedDocumentation: evolutionDocs(["EBR-II SHRT Benchmark Specifications"]),
    plantOperatingStateIds: ["POS-01", "POS-02"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "EBR-II SHRT Benchmark Specifications",
  },
  {
    uuid: "EV-02",
    name: "Planned shutdown to refuelling",
    type: EvolutionType.CONTROLLED_SHUTDOWN,
    description: "Controlled shutdown to hot standby, then transfer of the primary from the main centrifugal pumps to the auxiliary EM pump. Decay heat is carried by forced and natural circulation while the pool stays hot.",
    operatingModes: ["SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["EBR-II Hazard Summary Report"]),
    plantOperatingStateIds: ["POS-03", "POS-04"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "EBR-II Hazard Summary Report",
  },
  {
    uuid: "EV-03",
    name: "Refuelling",
    type: EvolutionType.REFUELING_OUTAGE,
    description: "In-vessel fuel handling under sodium. The reactor is shut down and subassemblies are moved through the rotating plugs and the gripper to the in-tank storage basket while the pool stays sealed at 371 C under argon.",
    operatingModes: ["REFUELING"],
    reviewedDocumentation: evolutionDocs(["EBR-II Hazard Summary Report"]),
    plantOperatingStateIds: ["POS-05", "POS-06"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }, { sr: "POS-A2", hlr: "A" }],
    sourceDocumentRef: "EBR-II Hazard Summary Report",
  },
  {
    uuid: "EV-04",
    name: "Forced outage (loss of forced cooling)",
    type: EvolutionType.FORCED_OUTAGE,
    description: "Loss of forced flow after an unplanned trip. The core is cooled by natural circulation in the sodium pool to the NaK shutdown coolers. The demonstrated negative reactivity feedback holds the core subcritical.",
    operatingModes: ["SHUTDOWN"],
    reviewedDocumentation: evolutionDocs(["EBR-II Inherent Shutdown and Heat Removal Tests"]),
    plantOperatingStateIds: ["POS-07"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
    sourceDocumentRef: "EBR-II Inherent Shutdown and Heat Removal Tests",
  },
  {
    uuid: "EV-05",
    name: "Maintenance with reactor at zero power",
    type: EvolutionType.MAINTENANCE_CONFIG,
    description: "Reactor shut down for component maintenance. A decay-heat-removal path such as a NaK shutdown cooler or the intermediate loop may be isolated for the work. The core is held subcritical.",
    operatingModes: ["MAINTENANCE"],
    reviewedDocumentation: evolutionDocs(["EBR-II Level 1 PRA"]),
    plantOperatingStateIds: ["POS-08", "POS-09"],
    implementsSrs: [{ sr: "POS-A1", hlr: "A" }],
    sourceDocumentRef: "EBR-II Level 1 PRA",
  },
];

const plantOperatingStateGroups: PlantOperatingStateGroup[] = [
  {
    uuid: "GRP-PWR",
    name: "Power group",
    evolutionType: EvolutionType.AT_POWER,
    memberPosIds: ["POS-01", "POS-02"],
    similarityBasis: "POS-01 and POS-02 share identical barrier status, instrumentation, and decay heat. POS-02 (reduced and experimental power) is bounded by POS-01 (full power) for initiator response.",
    boundingCharacteristics: ["Maximum core power · POS-01"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 6678,
    entryFrequency: 0,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-SD",
    name: "Shutdown / cooldown group",
    evolutionType: EvolutionType.CONTROLLED_SHUTDOWN,
    memberPosIds: ["POS-03", "POS-04", "POS-07"],
    similarityBasis: "Hot standby, auxiliary-pump cooldown, and post-trip natural circulation share the pool heat sink. Bounded by POS-07 (loss of forced cooling) for thermal response.",
    boundingCharacteristics: ["Loss of forced cooling on the pool heat sink · POS-07"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 394,
    entryFrequency: 8,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-RFG",
    name: "Refuelling group",
    evolutionType: EvolutionType.REFUELING_OUTAGE,
    memberPosIds: ["POS-05", "POS-06"],
    similarityBasis: "POS-05 (refuelling under sodium) and POS-06 (long-term shutdown) are the refuelling-evolution states. POS-05, with the cover gas boundary penetrated for fuel handling, bounds POS-06 for barrier status.",
    boundingCharacteristics: ["Cover gas boundary penetrated during fuel handling, POS-05"],
    doesNotMaskRiskSignificantContributors: false,
    summedDurationHours: 1060,
    entryFrequency: 8,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
  {
    uuid: "GRP-MNT",
    name: "Maintenance cooling group",
    evolutionType: EvolutionType.MAINTENANCE_CONFIG,
    memberPosIds: ["POS-08"],
    similarityBasis: "The shutdown-cooler out-of-service configuration is a unique loss of a passive cooling path. No other retained state bounds it, so it is carried as its own group and represents itself.",
    boundingCharacteristics: ["Loss of one passive shutdown-cooling path, POS-08"],
    doesNotMaskRiskSignificantContributors: true,
    summedDurationHours: 150,
    entryFrequency: 1,
    implementsSrs: [{ sr: "POS-B6", hlr: "B" }],
  },
];

const screeningRecords: PosScreeningRecord[] = [
  {
    posId: "POS-09",
    retained: false,
    criterion: "SCR-1",
    justification: "Maintenance with the intermediate loop isolated is bounded by the shutdown-cooler out-of-service state (POS-08). POS-08 loses a passive decay-heat path while POS-09 keeps both shutdown coolers, so POS-08 is the more limiting configuration. Subsumed.",
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-07",
    retained: true,
    justification: "Retained: the post-trip loss-of-forced-cooling state is risk-significant. The core relies on natural circulation and reactivity feedback, so it cannot be bounded by the forced-cooling states.",
    riskSignificance: ImportanceLevel.HIGH,
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
  {
    posId: "POS-08",
    retained: true,
    justification: "Retained: the shutdown-cooler out-of-service configuration is a unique loss of a passive cooling path not covered by other states.",
    riskSignificance: ImportanceLevel.MEDIUM,
    implementsSrs: [{ sr: "POS-B2", hlr: "B" }],
  },
];

const separationRecords: PosSeparationRecord[] = [
  {
    separatedPosIds: ["POS-03", "POS-04"],
    differingResponseBasis: "Hot standby on the main centrifugal pumps and auxiliary-pump decay heat removal have materially different available flow and cooldown margins.",
    differentSuccessCriteria: true,
    differentBarrierConfiguration: false,
    moreSevereReleasePotential: false,
    implementsSrs: [{ sr: "POS-B1", hlr: "B" }],
  },
];

const subsumedPosRecords: SubsumedPosRecord[] = [
  {
    subsumedPosId: "POS-09",
    subsumingPosId: "POS-08",
    criterion: "SCR-1",
    justification: "Maintenance with the intermediate loop isolated is bounded by the shutdown-cooler out-of-service state for decay-heat-removal redundancy.",
    riskImpact: ImportanceLevel.LOW,
    limitations: ["Valid only while both shutdown coolers remain available in the intermediate-loop-isolated state."],
    validationMethod: "Qualitative comparison of decay-heat-removal redundancy.",
    implementsSrs: [{ sr: "POS-B4", hlr: "B" }],
  },
];

const demandTimeBasedRecords: DemandTimeBasedRecord[] = [
  { posId: "POS-07", initiatorBasis: "DEMAND_BASED", delineatedToAvoidAveraging: true, justification: "The post-trip natural-circulation state is entered on a reactor-trip demand. It is held separate from the time-based shutdown states so its short event-driven exposure is not averaged into the cycle-based durations.", implementsSrs: [{ sr: "POS-B5", hlr: "B" }] },
  { posId: "POS-08", initiatorBasis: "DEMAND_BASED", delineatedToAvoidAveraging: true, justification: "The shutdown-cooler maintenance state is entered on a maintenance demand. It is kept separate from the time-based refuelling states to avoid averaging its demand-based frequency with cycle-based durations.", implementsSrs: [{ sr: "POS-B5", hlr: "B" }] },
];

const decayHeatCharacterizations: DecayHeatCharacterization[] = [
  {
    posId: "POS-03",
    decayHeatLevel: range(0.46, 0.58, "MWth", 0.52),
    timeAfterShutdownHours: 2,
    basis: "Decay-heat curve at 2 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-04",
    decayHeatLevel: range(0.22, 0.30, "MWth", 0.26),
    timeAfterShutdownHours: 24,
    basis: "Decay-heat curve at 24 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-05",
    decayHeatLevel: range(0.09, 0.13, "MWth", 0.11),
    timeAfterShutdownHours: 240,
    basis: "Decay-heat curve at 240 h after shutdown.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
  {
    posId: "POS-07",
    decayHeatLevel: range(0.55, 0.95, "MWth", 0.61),
    timeAfterShutdownHours: 1,
    basis: "Decay-heat curve immediately post-trip.",
    isLpsd: true,
    implementsSrs: [{ sr: "POS-C4", hlr: "C" }],
  },
];

const validationRules: PosValidationRules = {
  mutualExclusivity: {
    delineationParameters: ["Operating mode", "Power level", "Reactor coolant temperature", "Decay heat level", "Barrier status"],
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
      "POS-04": ["POS-05", "POS-06", "POS-03", "POS-08"],
      "POS-05": ["POS-06", "POS-04"],
      "POS-06": ["POS-05", "POS-04"],
      "POS-07": ["POS-03"],
      "POS-08": ["POS-04"],
    },
    transitionTriggers: {
      "POS-01->POS-03": "Controlled power reduction",
      "POS-04->POS-05": "Pool stabilised for fuel handling",
    },
  },
  implementsSrs: [{ sr: "POS-A10", hlr: "A" }],
};

const transitionEvents: TransitionEvent[] = [
  {
    uuid: "TR-01",
    name: "Power reduction to hot standby",
    fromPosId: "POS-01",
    toPosId: "POS-03",
    trigger: "Controlled power reduction per OP-002.",
    frequency: 8,
    durationHours: 4,
    transitionParameters: [
      { parameter: "Reactor power", threshold: 0, units: "%", monitored: true },
    ],
    risks: ["Thermal transient on the intermediate loop during cooldown"],
    requiredHumanActions: ["Manual power reduction"],
    requiredEquipment: ["Control rod drives", "Primary centrifugal pumps"],
    procedureIds: ["OP-002"],
  },
];

const interviewRecords: PlantOperatingStatesAnalysis["interviewRecords"] = [
  { uuid: "iv-01", evolutionId: "EV-01", date: "Jun 02, 2026", personnelRoles: ["Lead Reactor Engineer", "Senior I&C Designer"], method: "TABLETOP", findings: "Confirmed the steady-state envelope at 62.5 MWt; flagged the reduced-power experimental band as a separate state.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-02", evolutionId: "EV-02", date: "Jun 04, 2026", personnelRoles: ["Operations Lead", "Refuelling Engineer"], method: "TABLETOP", findings: "Confirmed the shutdown sequence. Identified the need to split hot standby from auxiliary-pump cooldown.", overlookedEvolutionsIdentified: ["Auxiliary-pump-cooldown split"] },
  { uuid: "iv-03", evolutionId: "EV-03", date: "Jun 09, 2026", personnelRoles: ["Refuelling Lead", "Sodium Systems Engineer", "Safety Analyst"], method: "WALKDOWN", findings: "Walkdown of the in-vessel fuel-handling path. Confirmed the pool stays sealed under argon; flagged the cover-gas penetration window for a separate POS.", overlookedEvolutionsIdentified: ["Cover-gas penetration window", "In-tank fuel-transfer staging"] },
  { uuid: "iv-04", evolutionId: "EV-04", date: "Jun 11, 2026", personnelRoles: ["Lead Safety Analyst"], method: "INTERVIEW", findings: "Decay-heat profile reviewed. Natural-circulation decay-heat removal confirmed as the design intent for loss of forced cooling.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-05", evolutionId: "EV-05", date: "Jun 13, 2026", personnelRoles: ["Maintenance Engineer", "I&C Engineer"], method: "TABLETOP", findings: "Maintenance configurations reviewed against the shutdown-cooler and intermediate-loop outage procedures.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-06", date: "Jun 16, 2026", personnelRoles: ["Sodium Chemistry Lead"], method: "INTERVIEW", findings: "Reviewed cover-gas and primary-sodium activity implications across all states.", overlookedEvolutionsIdentified: [] },
  { uuid: "iv-07", date: "Jun 17, 2026", personnelRoles: ["Configuration Mgmt Lead"], method: "COMPUTERIZED_WALKDOWN", findings: "Walkdown of the plant model; instrumentation locations verified for POS-05 and POS-06.", overlookedEvolutionsIdentified: [] },
];

const plantRepresentationAccuracy: PlantRepresentationAccuracy = {
  scope: "OPERATING",
  accuracy: ImportanceLevel.HIGH,
  basis: "Built from the as-operated plant configuration, the benchmark specifications, and operating records. Consistent with the as-built plant.",
  detailConsistentWithPlant: true,
  sufficientForRiskSignificantContributors: true,
  sufficiencyJustification: "Risk-significant states (post-trip natural circulation, shutdown cooler out of service) are characterised from operating data.",
  highConfidenceAreas: ["Operating modes", "Barrier status", "State durations from operating records"],
  lowerConfidenceAreas: ["Decay-heat characterisation for long-term shutdown and maintenance states"],
  improvementPlans: ["Close decay-heat characterisation for the remaining LPSD states from operating-cycle data."],
  implementsSrs: [{ sr: "POS-D1", hlr: "D" }],
};

const modelUncertainty: BaseModelUncertaintyDocumentation = {
  uuid: "POS-MU-1",
  name: "POS model uncertainty documentation",
  uncertaintySources: [
    { source: "Decay-heat curve", impact: "Decay-heat curve carries about plus or minus 10 percent for early times after shutdown." },
    { source: "Primary sodium activity", impact: "Na-24 and long-lived activity from operating-cycle measurements. Conservative activity assumed." },
    { source: "Natural-circulation performance", impact: "Natural-circulation decay-heat removal credit anchored to the loss-of-flow demonstration test results." },
    { source: "Reactivity feedback coefficients", impact: "Negative feedback coefficients confirmed by operating and test data. Bounded conservatively." },
  ],
  relatedAssumptions: [
    { assumption: "Decay-heat curve is bounding for the early post-shutdown window.", basis: "Operating-cycle measurements." },
    { assumption: "Natural-circulation performance meets the demonstration-test result.", basis: "Loss-of-flow demonstration tests." },
    { assumption: "Negative reactivity feedback holds the core subcritical on loss of forced cooling.", basis: "Confirmed by the loss-of-flow-without-scram test." },
  ],
  reasonableAlternatives: [
    { alternative: "Re-measure decay heat each cycle", reasonNotSelected: "Operating-cycle data already bounds the curve." },
    { alternative: "Cycle-by-cycle primary-sodium activity sampling", reasonNotSelected: "Activity is stable across cycles and bounded conservatively." },
    { alternative: "Repeat the integrated natural-circulation test", reasonNotSelected: "The demonstration tests already establish the credit." },
    { alternative: "Re-measure reactivity feedback each cycle", reasonNotSelected: "Feedback confirmed stable by operating and test data." },
  ],
};

const documentation: PosDocumentation = {
  processDescription: "Plant operating states were defined by decomposing the design-basis plant evolutions into mutually exclusive, collectively exhaustive states.",
  evolutionSelectionAndDefinitions: "Five plant evolutions span at-power, controlled shutdown, refuelling, forced outage, and maintenance configurations.",
  posIdentificationProcessAndCriteria: "States delineated where barrier status, available SSCs, or decay-heat-removal configuration change materially.",
  posGroupingProcessAndCriteria: "States grouped where response is bounded by a common worst-case member, one analysis per group at the bounding state.",
  posGroupDefinitions: "Power, shutdown/cooldown, refuelling, and maintenance groups defined.",
  posCharacteristics: "Each state characterised by mode, sodium parameters, sources, barriers, instrumentation, and SSC configuration.",
  durationsTimesSinceShutdownFrequencies: "Mean durations and entry frequencies captured per state from operating-cycle estimates.",
  decayHeatPerPos: "Decay-heat level characterised for the early shutdown and refuelling states. Long-term shutdown and maintenance states pending.",
  praTaskInterfaces: "Interfaces with initiating-event and event-sequence analyses identified.",
  modelUncertaintySources: "Four sources of model uncertainty logged with treatments.",
  asBuiltLimitations: "Analysis reflects the as-operated plant configuration and operating records.",
  implementsSrs: [{ sr: "POS-D1", hlr: "D" }, { sr: "POS-D2", hlr: "D" }, { sr: "POS-D3", hlr: "D" }],
};

const conformanceMatrix: SRConformance[] = [];

const REVIEWERS = [
  { id: "sfr-rev-1", name: "Dr. Liam Novak", role: "INTERNAL_REVIEWER" as const, organization: "Generic Fast Reactor Co.", title: "Lead Technical Reviewer" },
  { id: "sfr-rev-2", name: "Sofia Marchetti", role: "INTERNAL_REVIEWER" as const, organization: "Generic Fast Reactor Co.", title: "Independent Reviewer · Systems" },
  { id: "sfr-rev-3", name: "Raj Anand", role: "INTERNAL_REVIEWER" as const, organization: "Generic Fast Reactor Co.", title: "Independent Reviewer · Thermal-Hydraulics" },
  { id: "sfr-approver-1", name: "Dr. Helen Cho", role: "INTERNAL_APPROVER" as const, organization: "Generic Fast Reactor Co.", title: "Director, Risk Engineering", qualification: "NQA-1 §2 Lead Reviewer (certified 2023, renewal 2026)" },
];

const REVIEW_COMMENTS = [
  {
    uuid: "src-1",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-1",
    createdAt: "2026-06-15T10:00:00Z",
    associatedSr: "POS-A3",
    text: "POS-04 was missing the cover-gas barrier-status entry. The conformance check correctly flagged it; confirm it is now closed before this advances to approval.",
    resolved: true,
    resolution: "Cover-gas boundary status entered for POS-04 (intact). The conformance check now clears POS-A3.",
    resolvedAt: "2026-06-16T08:00:00Z",
    resolvedBy: "sfr-rev-1",
    severity: "MAJOR" as const,
  },
  {
    uuid: "src-2",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-2",
    createdAt: "2026-06-15T11:00:00Z",
    associatedSr: "POS-B6",
    text: "Group RFG (refuelling): the bounding rationale for the fuel-handling phase is not yet written out. Compare the member states and state which one bounds the group, or mark RFG as not-yet-bounded for now.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "src-3",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-3",
    createdAt: "2026-06-16T09:00:00Z",
    associatedSr: "POS-A8",
    text: "Seven sessions logged is a healthy count. Consider attaching the sodium chemistry interview transcript (IV-06). Currently only the finding is captured.",
    resolved: true,
    resolution: "Transcript attached to IV-06.",
    resolvedAt: "2026-06-16T16:00:00Z",
    resolvedBy: "sfr-rev-3",
    severity: "MINOR" as const,
  },
  {
    uuid: "src-4",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-1",
    createdAt: "2026-06-16T14:00:00Z",
    associatedSr: "POS-C4",
    text: "Blocking. The retained LPSD states must all carry a decay-heat characterisation before this workbook can be approved. Long-term shutdown and the shutdown-cooler maintenance state are still open. Run the decay-heat curve fit and lock the values.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "src-5",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-2",
    createdAt: "2026-06-16T15:00:00Z",
    associatedSr: "POS-C1",
    text: "Each retained state's mean duration should cite the operating-cycle record it is drawn from. Add the source reference when you confirm durations in Step 08.",
    resolved: false,
    severity: "MINOR" as const,
  },
  {
    uuid: "src-6",
    authorRole: "INTERNAL_REVIEWER" as const,
    authorId: "sfr-rev-3",
    createdAt: "2026-06-17T06:00:00Z",
    text: "The source documents are linked in Step 02. Consider adding a short note that maps each key parameter to the document it came from, for traceability.",
    resolved: false,
    severity: "OBSERVATION" as const,
  },
  {
    uuid: "src-7",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "sfr-approver-1",
    createdAt: "2026-06-17T09:30:00Z",
    associatedSr: "POS-C4",
    text: "Approver remark. Withholding signature until the decay-heat values are locked across the remaining LPSD states. Major item src-4 must close first.",
    resolved: false,
    severity: "MAJOR" as const,
  },
  {
    uuid: "src-8",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "sfr-approver-1",
    createdAt: "2026-06-17T09:35:00Z",
    associatedSr: "POS-B6",
    text: "Approver remark. Agreed with reviewer src-2 that the GRP-RFG bounding rationale needs to be written out. Compare the member states and state the bounding one explicitly in the workbook text.",
    resolved: false,
    severity: "MINOR" as const,
  },
  {
    uuid: "src-9",
    authorRole: "INTERNAL_APPROVER" as const,
    authorId: "sfr-approver-1",
    createdAt: "2026-06-17T09:40:00Z",
    text: "Approver remark — the operating-state set and the inherent-safety basis read well. Once the two major findings close, this workbook should be ready for sign-off.",
    resolved: false,
    severity: "OBSERVATION" as const,
  },
];

const POS_ANALYSIS_SFR: PlantOperatingStatesAnalysis = {
  uuid: "POS-GENERIC-2",
  name: "POS Workbook 2",
  type: TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS,
  version: "1",
  created: "2026-06-01",
  modified: "2026-06-18",
  owner: "Dana Okafor",
  workflowState: "DRAFT",
  workflowHistory: [
    { state: "DRAFT", enteredAt: "2026-06-01", actor: "Dana Okafor" },
  ],
  capabilityCategory: "CC-II",
  plantStage: "OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: "2026-06-18", schemaVersion: "0.0.1" },
    analysisDate: "2026-06-18",
    analysts: ["Dana Okafor"],
    reviewers: REVIEWERS,
    scope: "Internal events, all plant operating states, full operating cycle.",
    limitations: ["Built from the as-operated plant configuration and operating records."],
    lastModifiedDate: "2026-06-18",
    lastModifiedBy: "Dana Okafor",
    plantIdentity: {
      name: "Generic SFR",
      vendor: "Generic Fast Reactor Co.",
      reactorType: "Sodium-cooled fast reactor (pool type)",
      thermalPower: "62.5 MWth",
      primaryCoolant: "Sodium",
      intermediateCoolant: "Sodium (intermediate loop)",
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
  decayHeatOperatingDays: 180,
  decayHeatCurve: {
    name: "Generic SFR design decay-heat curve",
    points: [
      { hours: 0.1, fractionOfPower: 0.0155 },
      { hours: 1, fractionOfPower: 0.00976 },
      { hours: 2, fractionOfPower: 0.00832 },
      { hours: 24, fractionOfPower: 0.00416 },
      { hours: 240, fractionOfPower: 0.00176 },
      { hours: 336, fractionOfPower: 0.00144 },
      { hours: 504, fractionOfPower: 0.00144 },
      { hours: 720, fractionOfPower: 0.00144 },
    ],
  },
  newlyDevelopedMethodIds: [],
  exampleDocuments: [
    { id: "DOC-01", name: "EBR-II SHRT Benchmark Specifications", kind: "doc", sizeLabel: "Argonne", uploadedLabel: "ANL-ARC-226", extracted: "Core thermal power 62.5 MWt, primary sodium flow, core inlet and outlet temperatures, pool geometry, steady full-power conditions", linked: 5, url: "/api/example-documents/pos/sfr-benchmark", citation: "Benchmark Specifications and Data Requirements for EBR-II Shutdown Heat Removal Tests SHRT-17 and SHRT-45R, Argonne ANL-ARC-226, 2012 (https://www.osti.gov/biblio/1432465)" },
    { id: "DOC-02", name: "Benchmark Analysis of EBR-II Shutdown Heat Removal Tests", kind: "doc", sizeLabel: "IAEA", uploadedLabel: "IAEA-TECDOC-1819", extracted: "Confirms the operating point and the loss-of-flow and loss-of-heat-sink transient behaviour", linked: 4, url: "/api/example-documents/pos/sfr-shrt-analysis", citation: "Benchmark Analysis of EBR-II Shutdown Heat Removal Tests, IAEA-TECDOC-1819, 2017 (https://www.iaea.org/publications/12247)" },
    { id: "DOC-03", name: "EBR-II Hazard Summary Report", kind: "doc", sizeLabel: "Argonne", uploadedLabel: "ANL-5719", extracted: "Accident set, plant configurations, decay heat removal by natural circulation in the pool", linked: 4, url: "/api/example-documents/pos/sfr-hazard", citation: "Hazard Summary Report, Experimental Breeder Reactor II (EBR-II), Argonne ANL-5719 (https://digital.library.unt.edu/ark:/67531/metadc11523/)" },
    { id: "DOC-04", name: "EBR-II Level 1 Probabilistic Risk Assessment", kind: "doc", sizeLabel: "Argonne", uploadedLabel: "ANL-NSE-2", extracted: "SFR PRA method, initiating events, plant states, risk results for this reactor", linked: 5, url: "/api/example-documents/pos/sfr-pra", citation: "Experimental Breeder Reactor II (EBR-II) Level 1 Probabilistic Risk Assessment, Argonne ANL-NSE-2, 2018 (https://www.osti.gov/biblio/1483951)" },
    { id: "DOC-05", name: "EBR-II Inherent Shutdown and Heat Removal Tests", kind: "doc", sizeLabel: "Argonne", uploadedLabel: "CONF-850410-6", extracted: "Passive shutdown by negative reactivity feedback, natural-circulation decay-heat removal", linked: 3, url: "/api/example-documents/pos/sfr-inherent", citation: "EBR-II Inherent Shutdown and Heat Removal Tests, Argonne CONF-850410-6" },
  ],
};

export { POS_ANALYSIS_SFR };

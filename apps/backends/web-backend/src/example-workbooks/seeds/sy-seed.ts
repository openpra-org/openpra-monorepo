import { type SystemsAnalysis, type SystemBasicEvent, type LegacySystemFaultTreeNode } from "interfaces-mef-types/sy/systems-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { DistributionType } from "interfaces-mef-types/core/events";
import { SY_SR_CATALOG } from "interfaces-mef-types/sy/systems-analysis";
import { createExampleDependencyNetwork, createExampleHclConfiguration } from "./dependency-model-seed";

const NOW = "2026-05-04T12:00:00.000Z";
const CREATED = "2026-04-22T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["SY-B3", "SY-B4", "SY-B8", "SY-B11", "SY-B12", "SY-B14"]);

const SR_EVIDENCE: Record<string, string> = {
  "SY-A1": "Eight systems identified from the Event Sequence safety functions.",
  "SY-A8": "Model boundaries set to include the components and the support interfaces.",
  "SY-A9": "Guard vessel modeled at the system level, the rest in detail.",
  "SY-A20": "Four components screened, each against a stated criterion.",
  "SY-A30": "One designator per component failure mode across every system and train.",
  "SY-B1": "Common cause modeled within each redundant system.",
  "SY-B2": "Two inter-system common cause groups modeled, batteries and software.",
  "SY-B3": "DRACS damper grouping basis open against the DA-D8 parameter set.",
  "SY-B4": "DRACS damper common cause parameters pending DA-D8.",
  "SY-B8": "Two DRACS loops share the north penetration room, fault tree update open.",
  "SY-B11": "Actuation software common cause modeling open at CC-II.",
  "SY-B12": "Battery depletion against the 24 hour mission open.",
  "SY-B14": "Confinement dampers in the sodium-fire environment open.",
  "SY-C3": "Pre-operational limitations logged, including freedom from design errors.",
};

const PREOP_ONLY = new Set<string>(["SY-A4", "SY-A6", "SY-A11", "SY-A13", "SY-A22", "SY-A26", "SY-A33", "SY-B10", "SY-B17", "SY-C3"]);

const conformanceMatrix: SRConformance[] = Object.keys(SY_SR_CATALOG).flatMap((code) => {
  const meta = SY_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const stages: PlantStage[] = PREOP_ONLY.has(code) ? ["PRE_OPERATIONAL"] : meta.stages;
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the systems analysis.";
  const satisfiedByElementPaths = meta.hlr === "B" ? ["commonCauseFailureGroups", "systemDependencies"] : meta.hlr === "C" ? ["documentation"] : ["systemDefinitions", "systemLogicModels"];
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr: meta.hlr,
    capabilityCategory,
    applicableToStage: stages,
    status,
    satisfiedByElementPaths,
    evidence,
  }));
});

function be(uuid: string, name: string, failureMode: string, probability: number, componentReference?: string): SystemBasicEvent {
  return {
    uuid,
    code: uuid,
    name,
    eventType: "BASIC",
    componentReference,
    failureMode,
    probability,
    repairModeled: false,
    implementsSrs: srs("SY-A19", "SY-A30"),
  };
}

function hfe(uuid: string, name: string, probability: number, hfeRef: string): SystemBasicEvent {
  return {
    uuid,
    code: uuid,
    name,
    eventType: "BASIC",
    failureMode: "HUMAN_ERROR",
    probability,
    repairModeled: false,
    attributes: [{ name: "hfeReference", value: hfeRef }],
    implementsSrs: srs("SY-A21", "SY-A23"),
  };
}

function tm(uuid: string, name: string, probability: number, basis: string, preOperational: boolean): SystemBasicEvent {
  return {
    uuid,
    code: uuid,
    name,
    eventType: "BASIC",
    failureMode: "TEST_MAINTENANCE",
    probability,
    repairModeled: false,
    attributes: [
      { name: "basis", value: basis },
      { name: "preOperational", value: preOperational ? "true" : "false" },
    ],
    implementsSrs: srs("SY-A25", "SY-A26"),
  };
}

const dracsEvents: SystemBasicEvent[] = [
  be("DRC-LP1-FR", "DRACS loop 1 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-LP2-FR", "DRACS loop 2 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-LP3-FR", "DRACS loop 3 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-DMP1-FO", "Loop 1 air damper fails to open", "FAILURE_TO_START", 0.003),
  be("DRC-DMP2-FO", "Loop 2 air damper fails to open", "FAILURE_TO_START", 0.003),
  be("DRC-DMP3-FO", "Loop 3 air damper fails to open", "FAILURE_TO_START", 0.003),
  be("DRC-AIR1-BLK", "Loop 1 air path blocked", "FAILURE_TO_RUN", 0.001),
  be("DRC-AIR2-BLK", "Loop 2 air path blocked", "FAILURE_TO_RUN", 0.001),
  be("DRC-AIR3-BLK", "Loop 3 air path blocked", "FAILURE_TO_RUN", 0.001),
  be("DRC-CCF-FR", "Common cause failure of all three loops", "COMMON_CAUSE_FAILURE", 0.00012),
  be("DRC-DMP-CCF", "Common cause failure of the air dampers", "COMMON_CAUSE_FAILURE", 0.0003),
  hfe("DRC-HFE-CAL", "DRACS channels miscalibrated after surveillance", 0.0024, "HR-PRE-014"),
  hfe("DRC-HFE-ALIGN", "Dampers left misaligned after surveillance", 0.01, "HR-PRE-022"),
  tm("DRC-LP1-TM", "Loop 1 in staggered surveillance", 0.004, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
  tm("DRC-LP2-TM", "Loop 2 in staggered surveillance", 0.004, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
  tm("DRC-LP3-TM", "Loop 3 in staggered surveillance", 0.004, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
];
const rpsEvents: SystemBasicEvent[] = [
  be("RPS-DVA-FS", "Division A fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-DVB-FS", "Division B fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-BKA-FO", "Scram breaker A fails to open", "FAILURE_TO_START", 0.0012),
  be("RPS-BKB-FO", "Scram breaker B fails to open", "FAILURE_TO_START", 0.0012),
  be("RPS-RODA-FR", "Division A rods fail to release", "FAILURE_TO_START", 0.0008),
  be("RPS-RODB-FR", "Division B rods fail to release", "FAILURE_TO_START", 0.0008),
  be("RPS-CCF-FS", "Common cause failure of both divisions", "COMMON_CAUSE_FAILURE", 0.00009),
  be("RPS-ROD-CCF", "Common cause failure of the rod release", "COMMON_CAUSE_FAILURE", 0.00004),
  hfe("RPS-HFE-CAL", "Trip setpoints miscalibrated after surveillance", 0.0011, "HR-PRE-031"),
];
const actEvents: SystemBasicEvent[] = [
  be("ACT-CH1-FS", "Voting channel 1 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH2-FS", "Voting channel 2 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH3-FS", "Voting channel 3 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH4-FS", "Voting channel 4 fails", "FAILURE_TO_START", 0.002),
  be("ACT-SW-CCF", "Common cause failure of the logic software", "COMMON_CAUSE_FAILURE", 0.0001),
  be("ACT-SEN-CCF", "Common cause failure of the sensor input modules", "COMMON_CAUSE_FAILURE", 0.0002),
  be("ACT-OUT-CCF", "Common cause failure of the output actuation modules", "COMMON_CAUSE_FAILURE", 0.00015),
];
const dcEvents: SystemBasicEvent[] = [
  be("DC-BAT-A-FR", "Battery train A fails to run", "FAILURE_TO_RUN", 0.006),
  be("DC-BAT-B-FR", "Battery train B fails to run", "FAILURE_TO_RUN", 0.006),
  be("DC-CHG-A-FLT", "Charger A fault discharges the bank", "FAILURE_TO_RUN", 0.002),
  be("DC-CHG-B-FLT", "Charger B fault discharges the bank", "FAILURE_TO_RUN", 0.002),
  be("DC-BAT-CCF", "Common cause failure of the station batteries", "COMMON_CAUSE_FAILURE", 0.0003),
  hfe("DC-HFE-CHG", "Charger left in the wrong mode after maintenance", 0.005, "HR-PRE-009"),
  hfe("DC-HFE-BNK", "Both battery banks held off float after equalization", 0.002, "HR-PRE-041"),
  tm("DC-BAT-A-TM", "Battery train A on equalize charge", 0.0025, "Pre-operational assumption from the design test plan, no operating history yet.", true),
  tm("DC-BAT-B-TM", "Battery train B on equalize charge", 0.0025, "Pre-operational assumption from the design test plan, no operating history yet.", true),
];
const cisEvents: SystemBasicEvent[] = [
  be("CIS-DMP-A-FC", "Isolation damper A fails to close", "FAILURE_TO_START", 0.0025),
  be("CIS-DMP-B-FC", "Isolation damper B fails to close", "FAILURE_TO_START", 0.0025),
  be("CIS-DMP-CCF", "Common cause failure of the isolation dampers", "COMMON_CAUSE_FAILURE", 0.0002),
  be("CIS-FAN-FR", "Running clean-up fan fails to run", "FAILURE_TO_RUN", 0.007),
  be("CIS-IV-FO", "Inlet valve fails to open", "FAILURE_TO_START", 0.0012),
  be("CIS-FAN-B-FS", "Standby clean-up fan fails to start", "FAILURE_TO_START", 0.003),
  hfe("CIS-HFE-STBY", "Operator fails to start the standby clean-up train", 0.008, "HR-POST-022"),
];
const hvacEvents: SystemBasicEvent[] = [
  be("HVC-CHA-FR", "Cooling train A fails to run", "FAILURE_TO_RUN", 0.009),
  be("HVC-CHB-FR", "Cooling train B fails to run", "FAILURE_TO_RUN", 0.009),
  be("HVC-AHA-FR", "Air handler A fails to run", "FAILURE_TO_RUN", 0.002),
  be("HVC-AHB-FR", "Air handler B fails to run", "FAILURE_TO_RUN", 0.002),
  be("HVC-CCF-FR", "Common cause failure of both trains", "COMMON_CAUSE_FAILURE", 0.00045),
  be("HVC-TS-FLT", "Temperature instruments fail to start cooling", "FAILURE_TO_START", 0.0005),
];
const pcsEvents: SystemBasicEvent[] = [
  be("PCS-L1-BLK", "Loop 1 flow path blocked", "FAILURE_TO_RUN", 0.0004),
  be("PCS-L2-BLK", "Loop 2 flow path blocked", "FAILURE_TO_RUN", 0.0004),
  be("PCS-CKV1-FO", "Loop 1 check valve fails to open", "FAILURE_TO_START", 0.001),
  be("PCS-CKV2-FO", "Loop 2 check valve fails to open", "FAILURE_TO_START", 0.001),
  be("PCS-FLOW-CCF", "Common cause blockage of both flow paths", "COMMON_CAUSE_FAILURE", 0.00008),
  be("PCS-TC-FR", "Thermal-center flow degraded below the limit", "FAILURE_TO_RUN", 0.0005),
  hfe("PCS-HFE-CAL", "Pump trip circuits miscalibrated after surveillance", 0.0015, "HR-PRE-018"),
];

const sdhrEvents: SystemBasicEvent[] = [
  be("SDR-PMP-FR", "Intermediate sodium pump fails to run", "FAILURE_TO_RUN", 0.006),
  be("SDR-SINK-FR", "Steam-side heat sink lost", "FAILURE_TO_RUN", 0.008),
  be("SDR-IV-FC", "Loop isolation valve spuriously closes", "FAILURE_TO_START", 0.0015),
  tm("SDR-PMP-TM", "Intermediate pump in maintenance", 0.003, "Planned intermediate-pump maintenance in the shutdown window.", true),
  hfe("SDH-HFE", "Operator fails to start backup decay heat removal", 0.0008, "HR-POST-005"),
];
const isolEvents: SystemBasicEvent[] = [
  be("ISO-DET-FA", "Leak detection fails to actuate isolation", "FAILURE_TO_START", 0.002),
  be("ISO-VLV-A-FC", "Isolation valve A fails to close", "FAILURE_TO_START", 0.002),
  be("ISO-VLV-B-FC", "Isolation valve B fails to close", "FAILURE_TO_START", 0.002),
  be("ISO-VLV-CCF", "Common cause failure of the isolation valves", "COMMON_CAUSE_FAILURE", 0.0002),
  hfe("ISO-HFE", "Operator fails to isolate the leak path", 0.005, "HR-POST-025"),
];
const makeupEvents: SystemBasicEvent[] = [
  be("MKU-PMP-FS", "Make-up pump fails to start", "FAILURE_TO_START", 0.004),
  be("MKU-VLV-FO", "Make-up fill valve fails to open", "FAILURE_TO_START", 0.0015),
  be("MKU-TNK-UN", "Make-up sodium tank unavailable", "FAILURE_TO_RUN", 0.001),
  hfe("MKU-HFE", "Operator fails to initiate make-up", 0.006, "HR-POST-026"),
];
const detectEvents: SystemBasicEvent[] = [
  be("DET-LVL-A-FS", "Level channel A fails", "FAILURE_TO_START", 0.003),
  be("DET-LVL-B-FS", "Level channel B fails", "FAILURE_TO_START", 0.003),
  be("DET-LVL-CCF", "Common cause failure of the level channels", "COMMON_CAUSE_FAILURE", 0.0003),
  be("DET-ALM-FS", "Level alarm fails to annunciate", "FAILURE_TO_START", 0.001),
];
const suppEvents: SystemBasicEvent[] = [
  be("SUP-DET-FA", "Sodium fire detection fails", "FAILURE_TO_START", 0.003),
  be("SUP-SUP-FS", "Suppression and drain system fails to actuate", "FAILURE_TO_START", 0.005),
  hfe("SUP-HFE", "Operator fails to respond to the fire alarm", 0.02, "HR-POST-027"),
];

interface SystemSeed {
  id: string;
  short: string;
  name: string;
  sf: string;
  modelRep: string;
  topEvent: string;
  criterion: string;
  excluded: string;
  diversion?: string;
  loops?: { loopId: string; resolution: string }[];
  missionHours: number;
  boundaries: string[];
  detailed: boolean;
  events: SystemBasicEvent[];
  modeledFailures: Record<string, { failureModes: string[]; justificationForInclusion?: string }>;
}

const SYSTEMS: SystemSeed[] = [
  { id: "SYS-RPS", short: "RPS", name: "Reactor protection system", sf: "SF-RC", modelRep: "Fault tree", topEvent: "RPS fails to insert negative reactivity on demand", criterion: "One of two divisions inserts the rods within 3 s of the trip demand.", excluded: "Spurious trip, which acts to shut the plant down rather than defeat it.", missionHours: 24, boundaries: ["Sensors and trip logic", "Two trip divisions", "Scram breakers and rod release"], detailed: true, events: rpsEvents, modeledFailures: { "Trip divisions": { failureModes: ["Division fails to trip", "Scram breaker fails open", "Rod fails to release", "Common cause of divisions"] } } },
  { id: "SYS-DRACS", short: "DRACS", name: "Direct reactor auxiliary cooling system", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "DRACS fails to remove decay heat for the mission time", criterion: "Two of three loops remove decay heat by natural circulation at full power, one of three in the other states.", excluded: "Loop overcooling, a beneficial failure that helps the function.", diversion: "Cross-connect leakage modeled as a diversion path that steals flow.", missionHours: 24, boundaries: ["Three independent NaK loops", "Sodium-to-NaK and NaK-to-air exchangers", "Air dampers and stack"], detailed: true, events: dracsEvents, modeledFailures: { "NaK loops": { failureModes: ["Loop natural-circulation loss", "Damper fails to open", "Air-path blockage", "Common cause of loops"] } } },
  { id: "SYS-PRIMARY", short: "PCS", name: "Primary loop natural circulation", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Primary natural circulation fails to establish", criterion: "Both loops stay open so buoyancy-driven flow establishes in time.", excluded: "Pump overspeed, which raises flow and helps the criterion.", diversion: "A stuck-open pump bypass diverts buoyancy-driven flow past the thermal centers, so the bypass is a modeled path.", missionHours: 24, boundaries: ["Primary pumps and check valves", "Both loop flow paths", "Thermal-center elevation"], detailed: true, events: pcsEvents, modeledFailures: { "Flow paths": { failureModes: ["Flow-path blockage", "Check valve fails to open", "Thermal-center degradation"] } } },
  { id: "SYS-CONF", short: "CIS", name: "Confinement isolation & clean-up", sf: "SF-CONF", modelRep: "Fault tree", topEvent: "Confinement fails to isolate or clean up on demand", criterion: "Isolation closes on demand and the clean-up train holds the leak rate.", excluded: "Premature isolation, which closes the boundary earlier than needed.", diversion: "Unisolated penetration modeled as a bypass leak path.", missionHours: 24, boundaries: ["Isolation dampers and valves", "Cover-gas clean-up train", "Isolation actuation signal"], detailed: true, events: cisEvents, modeledFailures: { "Isolation and clean-up": { failureModes: ["Isolation damper fails to close", "Clean-up train fails to run", "Standby train fails to start", "Signal fails to generate"] } } },
  { id: "SYS-GUARD", short: "GV", name: "Guard vessel", sf: "SF-INV", modelRep: "System-level", topEvent: "Guard vessel fails to retain sodium over the core", criterion: "The guard vessel bounds a primary leak and keeps the core covered.", excluded: "Partial leaks that keep the sodium level above the core, bounded by the shell-leak event.", missionHours: 72, boundaries: ["Guard vessel shell", "Shared support skirt", "Leak-detection interface"], detailed: false, events: [], modeledFailures: { "Guard vessel": { failureModes: ["Shell leak"], justificationForInclusion: "System-level data sufficient, no internal redundancy." } } },
  { id: "SYS-1E-DC", short: "DC", name: "Class-1E DC power", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Class-1E DC power fails to supply the trip and actuation loads", criterion: "Battery and distribution supply the DC loads for the mission time.", excluded: "A charger overvoltage trip, which disconnects the charger and leaves the battery carrying the bus.", loops: [{ loopId: "SYS-1E-DC+SYS-HVAC", resolution: "Broken by crediting the battery through the room heat-up window, so the DC tree does not call HVAC and the assumption is logged." }], missionHours: 24, boundaries: ["Station batteries", "DC distribution buses", "Battery chargers"], detailed: true, events: dcEvents, modeledFailures: { "Battery trains": { failureModes: ["Battery fails to run", "Common cause of batteries", "Charger fault"] } } },
  { id: "SYS-ACT", short: "ACT", name: "Reactor trip & actuation logic", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Actuation logic fails to generate the trip or isolation signal", criterion: "Digital logic generates the protective signal on demand.", excluded: "Spurious actuation, which generates the protective signal without a demand.", missionHours: 24, boundaries: ["Sensor input modules", "Digital voting logic", "Output actuation modules"], detailed: true, events: actEvents, modeledFailures: { "Voting logic": { failureModes: ["Channel fails", "Software common cause", "Sensor input common cause", "Output module common cause"] } } },
  { id: "SYS-HVAC", short: "HVAC", name: "Safety I&C room cooling", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Room cooling fails and I&C exceeds its temperature limit", criterion: "Room cooling keeps the I&C below its qualified temperature.", excluded: "Room overcooling, which helps the temperature criterion.", missionHours: 24, boundaries: ["Safety chillers", "Room air handlers", "Temperature instruments"], detailed: true, events: hvacEvents, modeledFailures: { "Cooling trains": { failureModes: ["Chiller fails to run", "Air handler fails to run", "Temperature instruments fail to start", "Common cause of trains"] } } },
  { id: "SYS-SDHR", short: "SDHR", name: "Intermediate-loop shutdown heat removal", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Intermediate-loop shutdown heat removal fails", criterion: "The intermediate sodium loop and the steam-side heat sink remove shutdown heat for the mission time.", excluded: "Overcooling from excess intermediate flow, a beneficial failure that helps the function.", missionHours: 24, boundaries: ["Intermediate sodium loop and pump", "Steam generators and feedwater", "Loop isolation and dump valves"], detailed: true, events: sdhrEvents, modeledFailures: { "Intermediate loop": { failureModes: ["Pump fails to run", "Heat-sink loss", "Isolation valve spurious closure"] } } },
  { id: "SYS-ISOL", short: "ISOL", name: "Leak detection and isolation", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Leak detection and isolation fail to preserve the sodium inventory", criterion: "A primary leak is detected and the affected path isolated before the sodium level drops below the IHX inlet.", excluded: "Spurious isolation, which closes the boundary without a demand.", missionHours: 72, boundaries: ["Sodium leak detectors", "Redundant line isolation valves", "Level instrumentation interface"], detailed: true, events: isolEvents, modeledFailures: { "Isolation path": { failureModes: ["Detection fails", "Isolation valve fails to close", "Common cause of valves"] } } },
  { id: "SYS-MAKEUP", short: "MKUP", name: "Sodium make-up", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Make-up fails to restore the sodium level", criterion: "The make-up path restores the pool level to keep the core covered for the mission time.", excluded: "Overfill, which the level control limits and which does not threaten the criterion.", missionHours: 72, boundaries: ["Make-up sodium tank and pump", "Fill line and valves", "Level control interface"], detailed: true, events: makeupEvents, modeledFailures: { "Make-up train": { failureModes: ["Pump fails to start", "Fill valve fails to open", "Tank unavailable"] } } },
  { id: "SYS-DETECT", short: "DET", name: "Sodium level detection", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Level detection fails to alarm on a falling level", criterion: "Redundant level instrumentation alarms so operators diagnose a falling sodium level and act.", excluded: "Spurious alarm, which prompts an unnecessary but safe operator response.", missionHours: 72, boundaries: ["Redundant sodium level probes", "Signal processing", "Control-room alarm and indication"], detailed: true, events: detectEvents, modeledFailures: { "Level detection": { failureModes: ["Level channel fails", "Common cause of channels", "Alarm fails"] } } },
  { id: "SYS-SUPP", short: "SUPP", name: "Sodium fire detection and suppression", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Fire suppression fails to protect the decay-heat-removal path", criterion: "The sodium fire is detected and suppressed before it disables the DRACS air path or the protection cabling.", excluded: "Spurious suppression actuation, a plant nuisance that does not threaten the criterion.", missionHours: 24, boundaries: ["Sodium fire and smoke detection", "Suppression and drain system", "Fire-rated cable barriers"], detailed: true, events: suppEvents, modeledFailures: { "Fire suppression": { failureModes: ["Detection fails", "Suppression fails to actuate"] } } },
];

const SYSTEM_POS: Record<string, string[]> = {
  "SYS-RPS": ["POS-01", "POS-02", "POS-03"],
  "SYS-DRACS": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-PRIMARY": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07"],
  "SYS-CONF": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-GUARD": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-1E-DC": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-ACT": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-HVAC": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-SDHR": ["POS-01", "POS-02", "POS-03", "POS-04"],
  "SYS-ISOL": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"],
  "SYS-MAKEUP": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06"],
  "SYS-DETECT": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-SUPP": ["POS-01", "POS-08"],
};

const systemDefinitions = SYSTEMS.map((s) => ({
  uuid: s.id,
  name: s.name,
  description: s.topEvent,
  boundaries: s.boundaries,
  successCriteriaIds: [`SC-${s.id}`],
  successCriterion: s.criterion,
  abbreviation: s.short,
  justificationForExclusionOfComponents: [s.excluded],
  flowDiversionConsiderations: s.diversion !== undefined ? [s.diversion] : undefined,
  missionTimeHours: s.missionHours,
  applicablePlantOperatingStates: SYSTEM_POS[s.id] ?? [],
  modeledComponentsAndFailures: s.modeledFailures,
  informationBasis: "as-designed-as-intended" as const,
  preOperationalInformationJustification: "Models from the design package, to confirm by walkdown when as-built.",
  implementsSrs: srs("SY-A1", "SY-A8"),
}));

const systemToSafetyFunctionMappings = SYSTEMS.map((s) => ({
  uuid: `MAP-${s.id}`,
  systemReference: s.id,
  safetyFunctions: [s.sf],
  eventSequences: [],
  implementsSrs: srs("SY-A1"),
}));

const FAULT_TREES: Record<string, LegacySystemFaultTreeNode> = {
  "SYS-DRACS": {
    id: "DRC-TOP", type: "OR", name: "DRACS fails to remove decay heat",
    children: [
      { id: "DRC-3FAIL", type: "KN", k: 2, name: "Two or more of the three loops fail (full-power criterion)", children: [
        { id: "DRC-LP1", type: "OR", name: "Loop 1 fails to remove heat", children: [
          { id: "be-DRC-LP1-FR", type: "BE", name: "Loop 1 fails to maintain natural circulation", be: "DRC-LP1-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
          { id: "be-DRC-DMP1-FO", type: "BE", name: "Loop 1 air damper fails to open", be: "DRC-DMP1-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "3.0E-3" },
          { id: "be-DRC-AIR1-BLK", type: "BE", name: "Loop 1 air path blocked", be: "DRC-AIR1-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "1.0E-3" },
          { id: "be-DRC-LP1-TM", type: "BE", name: "Loop 1 in staggered surveillance", be: "DRC-LP1-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-01", prob: "4.0E-3" },
        ] },
        { id: "DRC-LP2", type: "OR", name: "Loop 2 fails to remove heat", children: [
          { id: "be-DRC-LP2-FR", type: "BE", name: "Loop 2 fails to maintain natural circulation", be: "DRC-LP2-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
          { id: "be-DRC-DMP2-FO", type: "BE", name: "Loop 2 air damper fails to open", be: "DRC-DMP2-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "3.0E-3" },
          { id: "be-DRC-AIR2-BLK", type: "BE", name: "Loop 2 air path blocked", be: "DRC-AIR2-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "1.0E-3" },
          { id: "be-DRC-LP2-TM", type: "BE", name: "Loop 2 in staggered surveillance", be: "DRC-LP2-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-01", prob: "4.0E-3" },
        ] },
        { id: "DRC-LP3", type: "OR", name: "Loop 3 fails to remove heat", children: [
          { id: "be-DRC-LP3-FR", type: "BE", name: "Loop 3 fails to maintain natural circulation", be: "DRC-LP3-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
          { id: "be-DRC-DMP3-FO", type: "BE", name: "Loop 3 air damper fails to open", be: "DRC-DMP3-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "3.0E-3" },
          { id: "be-DRC-AIR3-BLK", type: "BE", name: "Loop 3 air path blocked", be: "DRC-AIR3-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "1.0E-3" },
          { id: "be-DRC-LP3-TM", type: "BE", name: "Loop 3 in staggered surveillance", be: "DRC-LP3-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-01", prob: "4.0E-3" },
        ] },
      ] },
      { id: "be-DRC-CCF-FR", type: "BE", name: "Common cause failure of all three loops", be: "DRC-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DRACS-LOOP", prob: "1.2E-4", ccf: true },
      { id: "be-DRC-HFE-CAL", type: "BE", name: "DRACS channels miscalibrated after surveillance", be: "DRC-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-014", prob: "2.4E-3" },
      { id: "DRC-ACT", type: "OR", name: "Air-side actuation fails on all loops", children: [
        { id: "be-DRC-DMP-CCF", type: "BE", name: "Common cause failure of the air dampers", be: "DRC-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DRACS-DMP", prob: "3.0E-4", ccf: true },
        { id: "be-DRC-HFE-ALIGN", type: "BE", name: "Dampers left misaligned after surveillance", be: "DRC-HFE-ALIGN", mode: "HUMAN_ERROR", source: "HR-PRE-022", prob: "1.0E-2" },
        { id: "tr-DRC-DC", type: "TR", name: "Loss of Class-1E DC to the dampers", transfer: "SYS-1E-DC" },
      ] },
    ],
  },
  "SYS-RPS": {
    id: "RPS-TOP", type: "OR", name: "RPS fails to insert on demand",
    children: [
      { id: "RPS-2FAIL", type: "AND", name: "Both trip divisions fail", children: [
        { id: "RPS-DVA", type: "OR", name: "Division A fails to insert", children: [
          { id: "be-RPS-DVA-FS", type: "BE", name: "Division A trip logic fails", be: "RPS-DVA-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "1.5E-3" },
          { id: "be-RPS-BKA-FO", type: "BE", name: "Scram breaker A fails to open", be: "RPS-BKA-FO", mode: "FAILURE_TO_START", source: "DA-BE-009", prob: "1.2E-3" },
          { id: "be-RPS-RODA-FR", type: "BE", name: "Division A rods fail to release", be: "RPS-RODA-FR", mode: "FAILURE_TO_START", source: "DA-BE-011", prob: "8.0E-4" },
        ] },
        { id: "RPS-DVB", type: "OR", name: "Division B fails to insert", children: [
          { id: "be-RPS-DVB-FS", type: "BE", name: "Division B trip logic fails", be: "RPS-DVB-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "1.5E-3" },
          { id: "be-RPS-BKB-FO", type: "BE", name: "Scram breaker B fails to open", be: "RPS-BKB-FO", mode: "FAILURE_TO_START", source: "DA-BE-009", prob: "1.2E-3" },
          { id: "be-RPS-RODB-FR", type: "BE", name: "Division B rods fail to release", be: "RPS-RODB-FR", mode: "FAILURE_TO_START", source: "DA-BE-011", prob: "8.0E-4" },
        ] },
      ] },
      { id: "be-RPS-CCF-FS", type: "BE", name: "Common cause failure of both divisions", be: "RPS-CCF-FS", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-DIV", prob: "9.0E-5", ccf: true },
      { id: "be-RPS-ROD-CCF", type: "BE", name: "Common cause failure of the rod release", be: "RPS-ROD-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-ROD", prob: "4.0E-5", ccf: true },
      { id: "be-RPS-HFE-CAL", type: "BE", name: "Trip setpoints miscalibrated after surveillance", be: "RPS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-031", prob: "1.1E-3" },
      { id: "tr-RPS-ACT", type: "TR", name: "Actuation logic fails to generate the trip", transfer: "SYS-ACT" },
    ],
  },
  "SYS-ACT": {
    id: "ACT-TOP", type: "OR", name: "Actuation logic fails to generate the signal",
    children: [
      { id: "ACT-VOTE", type: "KN", k: 3, name: "Three of four voting channels fail", children: [
        { id: "be-ACT-CH1-FS", type: "BE", name: "Voting channel 1 fails", be: "ACT-CH1-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
        { id: "be-ACT-CH2-FS", type: "BE", name: "Voting channel 2 fails", be: "ACT-CH2-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
        { id: "be-ACT-CH3-FS", type: "BE", name: "Voting channel 3 fails", be: "ACT-CH3-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
        { id: "be-ACT-CH4-FS", type: "BE", name: "Voting channel 4 fails", be: "ACT-CH4-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
      ] },
      { id: "ACT-IO", type: "OR", name: "Input or output interfaces fail", children: [
        { id: "be-ACT-SEN-CCF", type: "BE", name: "Common cause failure of the sensor input modules", be: "ACT-SEN-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ACT-SEN", prob: "2.0E-4", ccf: true },
        { id: "be-ACT-OUT-CCF", type: "BE", name: "Common cause failure of the output actuation modules", be: "ACT-OUT-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ACT-OUT", prob: "1.5E-4", ccf: true },
      ] },
      { id: "be-ACT-SW-CCF", type: "BE", name: "Common cause failure of the logic software", be: "ACT-SW-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ACT-SW", prob: "1.0E-4", ccf: true },
      { id: "tr-ACT-DC", type: "TR", name: "Loss of Class-1E DC power", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-1E-DC": {
    id: "DC-TOP", type: "OR", name: "Class-1E DC power fails to supply the loads",
    children: [
      { id: "DC-AND", type: "AND", name: "Both battery trains fail", children: [
        { id: "DC-TRA", type: "OR", name: "Train A fails to supply", children: [
          { id: "be-DC-BAT-A-FR", type: "BE", name: "Battery train A fails to run", be: "DC-BAT-A-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "6.0E-3" },
          { id: "be-DC-CHG-A-FLT", type: "BE", name: "Charger A fault discharges the bank", be: "DC-CHG-A-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-073", prob: "2.0E-3" },
          { id: "be-DC-HFE-CHG", type: "BE", name: "Charger left in the wrong mode after maintenance", be: "DC-HFE-CHG", mode: "HUMAN_ERROR", source: "HR-PRE-009", prob: "5.0E-3" },
          { id: "be-DC-BAT-A-TM", type: "BE", name: "Battery train A on equalize charge", be: "DC-BAT-A-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-02", prob: "2.5E-3" },
        ] },
        { id: "DC-TRB", type: "OR", name: "Train B fails to supply", children: [
          { id: "be-DC-BAT-B-FR", type: "BE", name: "Battery train B fails to run", be: "DC-BAT-B-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "6.0E-3" },
          { id: "be-DC-CHG-B-FLT", type: "BE", name: "Charger B fault discharges the bank", be: "DC-CHG-B-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-073", prob: "2.0E-3" },
          { id: "be-DC-BAT-B-TM", type: "BE", name: "Battery train B on equalize charge", be: "DC-BAT-B-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-02", prob: "2.5E-3" },
        ] },
      ] },
      { id: "be-DC-BAT-CCF", type: "BE", name: "Common cause failure of the station batteries", be: "DC-BAT-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DC-BATT", prob: "3.0E-4", ccf: true },
      { id: "be-DC-HFE-BNK", type: "BE", name: "Both battery banks held off float after equalization", be: "DC-HFE-BNK", mode: "HUMAN_ERROR", source: "HR-PRE-041", prob: "2.0E-3" },
    ],
  },
  "SYS-CONF": {
    id: "CIS-TOP", type: "OR", name: "Confinement fails to isolate or clean up",
    children: [
      { id: "CIS-ISO", type: "OR", name: "Isolation function fails", children: [
        { id: "CIS-DMP-AND", type: "AND", name: "Both series dampers fail to close", children: [
          { id: "be-CIS-DMP-A-FC", type: "BE", name: "Isolation damper A fails to close", be: "CIS-DMP-A-FC", mode: "FAILURE_TO_START", source: "DA-BE-061", prob: "2.5E-3" },
          { id: "be-CIS-DMP-B-FC", type: "BE", name: "Isolation damper B fails to close", be: "CIS-DMP-B-FC", mode: "FAILURE_TO_START", source: "DA-BE-061", prob: "2.5E-3" },
        ] },
        { id: "be-CIS-DMP-CCF", type: "BE", name: "Common cause failure of the isolation dampers", be: "CIS-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-CIS-DMP", prob: "2.0E-4", ccf: true },
        { id: "tr-CIS-ACT", type: "TR", name: "Isolation signal fails to generate", transfer: "SYS-ACT" },
      ] },
      { id: "CIS-CLN", type: "OR", name: "Clean-up function fails", children: [
        { id: "CIS-CLN-AND", type: "AND", name: "Running and standby trains both unavailable", children: [
          { id: "CIS-RUN", type: "OR", name: "Running train fails", children: [
            { id: "be-CIS-FAN-FR", type: "BE", name: "Running clean-up fan fails to run", be: "CIS-FAN-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-062", prob: "7.0E-3" },
            { id: "be-CIS-IV-FO", type: "BE", name: "Inlet valve fails to open", be: "CIS-IV-FO", mode: "FAILURE_TO_START", source: "DA-BE-063", prob: "1.2E-3" },
          ] },
          { id: "CIS-STBY", type: "OR", name: "Standby train unavailable", children: [
            { id: "be-CIS-FAN-B-FS", type: "BE", name: "Standby clean-up fan fails to start", be: "CIS-FAN-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-064", prob: "3.0E-3" },
            { id: "be-CIS-HFE-STBY", type: "BE", name: "Operator fails to start the standby train", be: "CIS-HFE-STBY", mode: "HUMAN_ERROR", source: "HR-POST-022", prob: "8.0E-3" },
          ] },
        ] },
      ] },
      { id: "tr-CIS-DC", type: "TR", name: "Loss of Class-1E DC power", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-HVAC": {
    id: "HVC-TOP", type: "OR", name: "Room cooling fails and I&C exceeds its limit",
    children: [
      { id: "HVC-AND", type: "AND", name: "Both cooling trains fail", children: [
        { id: "HVC-TRA", type: "OR", name: "Train A fails to cool", children: [
          { id: "be-HVC-CHA-FR", type: "BE", name: "Chiller A fails to run", be: "HVC-CHA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.0E-3" },
          { id: "be-HVC-AHA-FR", type: "BE", name: "Air handler A fails to run", be: "HVC-AHA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-052", prob: "2.0E-3" },
        ] },
        { id: "HVC-TRB", type: "OR", name: "Train B fails to cool", children: [
          { id: "be-HVC-CHB-FR", type: "BE", name: "Chiller B fails to run", be: "HVC-CHB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.0E-3" },
          { id: "be-HVC-AHB-FR", type: "BE", name: "Air handler B fails to run", be: "HVC-AHB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-052", prob: "2.0E-3" },
        ] },
      ] },
      { id: "be-HVC-CCF-FR", type: "BE", name: "Common cause failure of both trains", be: "HVC-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-HVAC-CHL", prob: "4.5E-4", ccf: true },
      { id: "be-HVC-TS-FLT", type: "BE", name: "Temperature instruments fail to start cooling", be: "HVC-TS-FLT", mode: "FAILURE_TO_START", source: "DA-BE-054", prob: "5.0E-4" },
      { id: "tr-HVC-DC", type: "TR", name: "Loss of Class-1E DC to the chillers", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-PRIMARY": {
    id: "PCS-TOP", type: "OR", name: "Primary natural circulation fails to establish",
    children: [
      { id: "PCS-LP1", type: "OR", name: "Loop 1 flow path lost", children: [
        { id: "be-PCS-L1-BLK", type: "BE", name: "Loop 1 flow path blocked", be: "PCS-L1-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-043", prob: "4.0E-4" },
        { id: "be-PCS-CKV1-FO", type: "BE", name: "Loop 1 check valve fails to open", be: "PCS-CKV1-FO", mode: "FAILURE_TO_START", source: "DA-BE-044", prob: "1.0E-3" },
      ] },
      { id: "PCS-LP2", type: "OR", name: "Loop 2 flow path lost", children: [
        { id: "be-PCS-L2-BLK", type: "BE", name: "Loop 2 flow path blocked", be: "PCS-L2-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-043", prob: "4.0E-4" },
        { id: "be-PCS-CKV2-FO", type: "BE", name: "Loop 2 check valve fails to open", be: "PCS-CKV2-FO", mode: "FAILURE_TO_START", source: "DA-BE-044", prob: "1.0E-3" },
      ] },
      { id: "be-PCS-FLOW-CCF", type: "BE", name: "Common cause blockage of both flow paths", be: "PCS-FLOW-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-PCS-FLOW", prob: "8.0E-5", ccf: true },
      { id: "be-PCS-TC-FR", type: "BE", name: "Thermal-center flow degraded below the limit", be: "PCS-TC-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-046", prob: "5.0E-4" },
      { id: "be-PCS-HFE-CAL", type: "BE", name: "Pump trip circuits miscalibrated after surveillance", be: "PCS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-018", prob: "1.5E-3" },
    ],
  },
  "SYS-SDHR": {
    id: "SDR-TOP", type: "OR", name: "Intermediate-loop shutdown heat removal fails",
    children: [
      { id: "be-SDR-PMP-FR", type: "BE", name: "Intermediate sodium pump fails to run", be: "SDR-PMP-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-101", prob: "6.0E-3" },
      { id: "be-SDR-SINK-FR", type: "BE", name: "Steam-side heat sink lost", be: "SDR-SINK-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-103", prob: "8.0E-3" },
      { id: "be-SDR-IV-FC", type: "BE", name: "Loop isolation valve spuriously closes", be: "SDR-IV-FC", mode: "FAILURE_TO_START", source: "DA-BE-105", prob: "1.5E-3" },
      { id: "be-SDR-PMP-TM", type: "BE", name: "Intermediate pump in maintenance", be: "SDR-PMP-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-03", prob: "3.0E-3" },
      { id: "be-SDH-HFE", type: "BE", name: "Operator fails to start backup decay heat removal", be: "SDH-HFE", mode: "HUMAN_ERROR", source: "HR-POST-005", prob: "8.0E-4" },
      { id: "tr-SDR-DC", type: "TR", name: "Loss of Class-1E DC to the pump", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-ISOL": {
    id: "ISO-TOP", type: "OR", name: "Leak detection and isolation fail",
    children: [
      { id: "be-ISO-DET-FA", type: "BE", name: "Leak detection fails to actuate isolation", be: "ISO-DET-FA", mode: "FAILURE_TO_START", source: "DA-BE-107", prob: "2.0E-3" },
      { id: "ISO-VLV", type: "AND", name: "Both isolation valves fail to close", children: [
        { id: "be-ISO-VLV-A-FC", type: "BE", name: "Isolation valve A fails to close", be: "ISO-VLV-A-FC", mode: "FAILURE_TO_START", source: "DA-BE-109", prob: "2.0E-3" },
        { id: "be-ISO-VLV-B-FC", type: "BE", name: "Isolation valve B fails to close", be: "ISO-VLV-B-FC", mode: "FAILURE_TO_START", source: "DA-BE-109", prob: "2.0E-3" },
      ] },
      { id: "be-ISO-VLV-CCF", type: "BE", name: "Common cause failure of the isolation valves", be: "ISO-VLV-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ISOL-VLV", prob: "2.0E-4", ccf: true },
      { id: "be-ISO-HFE", type: "BE", name: "Operator fails to isolate the leak path", be: "ISO-HFE", mode: "HUMAN_ERROR", source: "HR-POST-025", prob: "5.0E-3" },
      { id: "tr-ISO-DC", type: "TR", name: "Loss of Class-1E DC to the isolation valves", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-MAKEUP": {
    id: "MKU-TOP", type: "OR", name: "Make-up fails to restore the sodium level",
    children: [
      { id: "be-MKU-PMP-FS", type: "BE", name: "Make-up pump fails to start", be: "MKU-PMP-FS", mode: "FAILURE_TO_START", source: "DA-BE-111", prob: "4.0E-3" },
      { id: "be-MKU-VLV-FO", type: "BE", name: "Make-up fill valve fails to open", be: "MKU-VLV-FO", mode: "FAILURE_TO_START", source: "DA-BE-113", prob: "1.5E-3" },
      { id: "be-MKU-TNK-UN", type: "BE", name: "Make-up sodium tank unavailable", be: "MKU-TNK-UN", mode: "FAILURE_TO_RUN", source: "DA-BE-115", prob: "1.0E-3" },
      { id: "be-MKU-HFE", type: "BE", name: "Operator fails to initiate make-up", be: "MKU-HFE", mode: "HUMAN_ERROR", source: "HR-POST-026", prob: "6.0E-3" },
      { id: "tr-MKU-DC", type: "TR", name: "Loss of Class-1E DC to the make-up pump", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-DETECT": {
    id: "DET-TOP", type: "OR", name: "Level detection fails to alarm on a falling level",
    children: [
      { id: "DET-CH", type: "AND", name: "Both level channels fail", children: [
        { id: "be-DET-LVL-A-FS", type: "BE", name: "Level channel A fails", be: "DET-LVL-A-FS", mode: "FAILURE_TO_START", source: "DA-BE-117", prob: "3.0E-3" },
        { id: "be-DET-LVL-B-FS", type: "BE", name: "Level channel B fails", be: "DET-LVL-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-117", prob: "3.0E-3" },
      ] },
      { id: "be-DET-LVL-CCF", type: "BE", name: "Common cause failure of the level channels", be: "DET-LVL-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DET-LVL", prob: "3.0E-4", ccf: true },
      { id: "be-DET-ALM-FS", type: "BE", name: "Level alarm fails to annunciate", be: "DET-ALM-FS", mode: "FAILURE_TO_START", source: "DA-BE-119", prob: "1.0E-3" },
      { id: "tr-DET-DC", type: "TR", name: "Loss of Class-1E DC to the level channels", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-SUPP": {
    id: "SUP-TOP", type: "OR", name: "Fire suppression fails to protect the decay-heat-removal path",
    children: [
      { id: "be-SUP-DET-FA", type: "BE", name: "Sodium fire detection fails", be: "SUP-DET-FA", mode: "FAILURE_TO_START", source: "DA-BE-121", prob: "3.0E-3" },
      { id: "be-SUP-SUP-FS", type: "BE", name: "Suppression and drain system fails to actuate", be: "SUP-SUP-FS", mode: "FAILURE_TO_START", source: "DA-BE-123", prob: "5.0E-3" },
      { id: "be-SUP-HFE", type: "BE", name: "Operator fails to respond to the fire alarm", be: "SUP-HFE", mode: "HUMAN_ERROR", source: "HR-POST-027", prob: "2.0E-2" },
      { id: "tr-SUP-DC", type: "TR", name: "Loss of Class-1E DC to the suppression system", transfer: "SYS-1E-DC" },
    ],
  },
};

const systemLogicModels = SYSTEMS.map((s) => ({
  uuid: `SLM-${s.id}`,
  systemReference: s.id,
  description: s.topEvent,
  modelRepresentation: s.modelRep,
  faultTree: FAULT_TREES[s.id],
  nonDetailedModelJustification: s.detailed ? undefined : "System-level data sufficient, no internal redundancy.",
  logicLoopResolutions: s.loops,
  implementsSrs: srs("SY-A7", "SY-A14"),
}));

const systemBasicEvents = SYSTEMS.flatMap((s) => s.events);

const SUPPORT_MATRIX: { system: string; needs: { supporting: string; kind: string }[] }[] = [
  { system: "SYS-RPS", needs: [{ supporting: "SYS-1E-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }] },
  { system: "SYS-DRACS", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-CONF", needs: [{ supporting: "SYS-1E-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }, { supporting: "SYS-HVAC", kind: "cooling" }] },
  { system: "SYS-ACT", needs: [{ supporting: "SYS-1E-DC", kind: "power" }, { supporting: "SYS-HVAC", kind: "cooling" }] },
  { system: "SYS-HVAC", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-1E-DC", needs: [{ supporting: "SYS-HVAC", kind: "cooling" }] },
  { system: "SYS-SDHR", needs: [{ supporting: "SYS-1E-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }] },
  { system: "SYS-ISOL", needs: [{ supporting: "SYS-1E-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }] },
  { system: "SYS-MAKEUP", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-DETECT", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-SUPP", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
];

const systemDependencies = SUPPORT_MATRIX.flatMap((row) =>
  row.needs.map((n) => ({
    uuid: `DEP-${row.system}-${n.supporting}`,
    description: `${row.system} depends on ${n.supporting}`,
    dependentSystem: row.system,
    supportingSystem: n.supporting,
    type: "FUNCTIONAL",
    details: n.kind,
    impact: "Loss of the support system defeats the dependent system function.",
    implementsSrs: srs("SY-B5", "SY-B6"),
  })),
);

interface CcfGroupSeed {
  id: string;
  name: string;
  scope: "INTRASYSTEM" | "INTERSYSTEM";
  system: string;
  components: string[];
  events: string[];
  modelType: string;
  beta?: number;
  alpha?: Record<string, number>;
  qt: number;
  shared: { hardwareDesign?: boolean; manufacturer?: boolean; maintenance?: boolean; installation?: boolean; environment?: boolean; otherFactors?: string[] };
  defenses: string[];
  basis: string;
  risk: string;
  daRef: string;
  affects: string[];
  srs: string[];
}

const CCF_GROUP_SEEDS: CcfGroupSeed[] = [
  { id: "CCF-DRACS-LOOP", name: "DRACS natural-circulation loops", scope: "INTRASYSTEM", system: "SYS-DRACS", components: ["DRC-LP1", "DRC-LP2", "DRC-LP3"], events: ["DRC-LP1-FR", "DRC-LP2-FR", "DRC-LP3-FR", "DRC-CCF-FR"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.95, alpha2: 0.035, alpha3: 0.015 }, qt: 0.008, shared: { hardwareDesign: true, manufacturer: true, environment: true }, defenses: ["Staggered surveillance across the loops", "Physically separated loop bays"], basis: "Same make, same service conditions and same passive duty across the three loops.", risk: "The KN gate carries the two-of-three full-power criterion, and the group carries the complete common-cause term that fails all three loops together.", daRef: "DA-CCF-12", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DRACS-DMP", name: "DRACS air dampers", scope: "INTRASYSTEM", system: "SYS-DRACS", components: ["DRC-DMP1", "DRC-DMP2", "DRC-DMP3"], events: ["DRC-DMP1-FO", "DRC-DMP2-FO", "DRC-DMP3-FO", "DRC-DMP-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.003, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Staggered damper surveillance", "Position verification after each test"], basis: "Identical dampers serviced by one crew on one procedure.", risk: "The damper term dominates the DRACS air path, carried at the generic screening beta.", daRef: "DA-CCF-15", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-RPS-DIV", name: "RPS trip divisions", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-DV-A", "RPS-DV-B"], events: ["RPS-DVA-FS", "RPS-DVB-FS", "RPS-CCF-FS"], modelType: "BETA_FACTOR", beta: 0.06, qt: 0.0015, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Divisional separation", "Trip channels tested on separate schedules"], basis: "Two divisions of identical design and manufacture.", risk: "Risk significant, the divisional term sits directly under the failure-to-scram top gate.", daRef: "DA-CCF-04", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DC-BATT", name: "Class-1E station batteries", scope: "INTERSYSTEM", system: "SYS-1E-DC", components: ["DC-BAT-A", "DC-BAT-B"], events: ["DC-BAT-A-FR", "DC-BAT-B-FR", "DC-BAT-CCF"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.006, shared: { manufacturer: true, environment: true, maintenance: true }, defenses: ["Staggered equalize charging", "Train-dedicated chargers"], basis: "Two batteries of one make sharing one room and one maintenance schedule.", risk: "Risk significant, the battery term propagates through every DC-fed protective system.", daRef: "DA-CCF-08", affects: ["SYS-RPS", "SYS-ACT", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-RPS-ROD", name: "Rod-release mechanisms", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-ROD-A", "RPS-ROD-B"], events: ["RPS-RODA-FR", "RPS-RODB-FR", "RPS-ROD-CCF"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.0008, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Gravity-driven insertion with no motive power", "Periodic rod-drop timing tests"], basis: "Identical release mechanisms on both divisions.", risk: "Carried at the generic screening beta, the release path is the last mechanical link in the trip chain.", daRef: "DA-CCF-05", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-CIS-DMP", name: "Confinement isolation dampers", scope: "INTRASYSTEM", system: "SYS-CONF", components: ["CIS-DMP-A", "CIS-DMP-B"], events: ["CIS-DMP-A-FC", "CIS-DMP-B-FC", "CIS-DMP-CCF"], modelType: "BETA_FACTOR", beta: 0.08, qt: 0.0025, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Series arrangement, either damper closes the line", "Closure verification after each test"], basis: "Two series dampers of one make on one test procedure.", risk: "The series pair defeats isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-16", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-HVAC-CHL", name: "Safety chillers", scope: "INTRASYSTEM", system: "SYS-HVAC", components: ["HVC-CH-A", "HVC-CH-B"], events: ["HVC-CHA-FR", "HVC-CHB-FR", "HVC-CCF-FR"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.009, shared: { hardwareDesign: true, environment: true }, defenses: ["Alternating lead and lag rotation", "Independent refrigerant circuits"], basis: "Identical chillers in one room on one cooling-water header.", risk: "Room heat-up is slow, the group matters through the long I&C mission time.", daRef: "DA-CCF-18", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-PCS-FLOW", name: "Primary loop flow paths", scope: "INTRASYSTEM", system: "SYS-PRIMARY", components: ["PCS-L1", "PCS-L2"], events: ["PCS-L1-BLK", "PCS-L2-BLK", "PCS-FLOW-CCF"], modelType: "BETA_FACTOR", beta: 0.2, qt: 0.0004, shared: { environment: true }, defenses: ["Pool cleanliness program", "Inlet screens on both loop suctions"], basis: "Both loop paths share the pool and the same debris sources.", risk: "The elevated beta reflects the single shared debris source in the common pool.", daRef: "DA-CCF-20", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-SEN", name: "Sensor input modules", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-SEN-A", "ACT-SEN-B", "ACT-SEN-C", "ACT-SEN-D"], events: ["ACT-SEN-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.002, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated calibration", "Input comparison alarms between channels"], basis: "Identical input modules feeding every channel.", risk: "Modeled as the collapsed common term, the independent channel failures sit in the voting gate.", daRef: "DA-CCF-22", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-OUT", name: "Output actuation modules", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-OUT-A", "ACT-OUT-B", "ACT-OUT-C", "ACT-OUT-D"], events: ["ACT-OUT-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.0015, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated output relays", "Actuation surveillance each operating cycle"], basis: "Identical output modules driving the trip and isolation loads.", risk: "Modeled as the collapsed common term on the interface branch.", daRef: "DA-CCF-23", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-SW", name: "Actuation logic software", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-CPU-A", "ACT-CPU-B", "ACT-CPU-C", "ACT-CPU-D"], events: ["ACT-SW-CCF"], modelType: "BETA_FACTOR", beta: 1, qt: 0.0001, shared: { hardwareDesign: true, otherFactors: ["Common software image"] }, defenses: ["Formal software verification and validation", "Hardwired diverse trip path outside the image"], basis: "One software image runs the trip and isolation voting logic.", risk: "Beta of one, a systematic image fault fails all four channels together.", daRef: "DA-CCF-21", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B11"] },
  { id: "CCF-ISOL-VLV", name: "Leak isolation valves", scope: "INTRASYSTEM", system: "SYS-ISOL", components: ["ISO-VLV-A", "ISO-VLV-B"], events: ["ISO-VLV-A-FC", "ISO-VLV-B-FC", "ISO-VLV-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.002, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Redundant isolation on the line", "Closure verification after each stroke test"], basis: "Two isolation valves of one make on one test procedure.", risk: "The redundant pair loses isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-25", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DET-LVL", name: "Sodium level channels", scope: "INTRASYSTEM", system: "SYS-DETECT", components: ["DET-LVL-A", "DET-LVL-B"], events: ["DET-LVL-A-FS", "DET-LVL-B-FS", "DET-LVL-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.003, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated calibration", "Cross-channel comparison"], basis: "Identical level channels feeding the alarm.", risk: "Modeled as the collapsed common term, the independent channel failures sit in the AND gate.", daRef: "DA-CCF-27", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
];

const commonCauseFailureGroups = CCF_GROUP_SEEDS.map((g) => ({
  uuid: g.id,
  name: g.name,
  description: g.basis,
  scope: g.scope,
  affectedComponents: g.components,
  affectedSystems: [g.system, ...g.affects],
  modelType: g.modelType,
  modelSpecificParameters: g.alpha !== undefined
    ? { alphaFactorParameters: { alphaFactors: g.alpha, totalFailureProbability: g.qt } }
    : { betaFactorParameters: { beta: g.beta ?? 0, totalFailureProbability: g.qt } },
  dataAnalysisCCFParameterRef: g.daRef,
  members: { basicEvents: g.events.map((m) => ({ id: m })) },
  groupSelectionBasis: g.basis,
  defenseMechanisms: g.defenses,
  sharedCauseFactors: g.shared,
  riskSignificanceJustification: g.risk,
  dataSources: [{ reference: "SY-DOC-04", description: "Generic common cause parameters from the alpha-factor parameter estimates.", dataType: "generic" as const }],
  implementsSrs: srs(...g.srs),
}));

const humanFailureEventIntegrations = [
  { id: "HFE-1", system: "SYS-DRACS", ref: "HR-PRE-022", type: "PRE_INITIATOR" as const, tm: true, task: "DRACS damper left misaligned after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-2", system: "SYS-CONF", ref: "HR-POST-022", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start the standby clean-up train.", srs: ["SY-A23"] },
  { id: "HFE-3", system: "SYS-1E-DC", ref: "HR-PRE-009", type: "PRE_INITIATOR" as const, tm: true, task: "Battery charger left in the wrong mode after maintenance.", srs: ["SY-A21"] },
  { id: "HFE-4", system: "SYS-ISOL", ref: "HR-POST-025", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to isolate the leak path.", srs: ["SY-A23"] },
  { id: "HFE-5", system: "SYS-MAKEUP", ref: "HR-POST-026", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to initiate sodium make-up.", srs: ["SY-A23"] },
  { id: "HFE-6", system: "SYS-SUPP", ref: "HR-POST-027", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to respond to the sodium fire alarm.", srs: ["SY-A23"] },
  { id: "HFE-7", system: "SYS-DRACS", ref: "HR-PRE-014", type: "PRE_INITIATOR" as const, tm: true, task: "DRACS channels miscalibrated after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-8", system: "SYS-RPS", ref: "HR-PRE-031", type: "PRE_INITIATOR" as const, tm: true, task: "Trip setpoints miscalibrated after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-9", system: "SYS-PRIMARY", ref: "HR-PRE-018", type: "PRE_INITIATOR" as const, tm: true, task: "Pump trip circuits miscalibrated after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-10", system: "SYS-1E-DC", ref: "HR-PRE-041", type: "PRE_INITIATOR" as const, tm: true, task: "Both battery banks held off float after equalization.", srs: ["SY-A21"] },
  { id: "HFE-11", system: "SYS-SDHR", ref: "HR-POST-005", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start backup decay heat removal.", srs: ["SY-A23"] },
].map((h) => ({
  uuid: h.id,
  hfeReference: h.ref,
  system: h.system,
  taskDescription: h.task,
  hfeType: h.type,
  isTestMaintenance: h.tm,
  implementsSrs: srs(...h.srs),
}));

const componentScreeningJustifications = [
  { id: "CS-1", system: "SYS-DRACS", component: "DRACS instrument isolation root valve", crit: "a" as const, basis: "Passive open valve, failure probability 4E-7 over 24 h." },
  { id: "CS-2", system: "SYS-CONF", component: "Clean-up train manual vent valve", crit: "b" as const, basis: "Leakage cannot defeat the isolation criterion, downstream of the boundary." },
  { id: "CS-3", system: "SYS-RPS", component: "Trip cabinet indicating lamp", crit: "b" as const, basis: "Indication only, no path to the trip function." },
  { id: "CS-4", system: "SYS-1E-DC", component: "DC bus tie isolating link", crit: "a" as const, basis: "Failure probability 7E-7 over 24 h, support contribution checked." },
].map((c) => ({
  uuid: c.id,
  systemReference: c.system,
  componentId: c.component,
  screeningCriterion: c.crit,
  quantitativeJustification: c.basis,
  implementsSrs: srs("SY-A20"),
}));

const supportSystemSuccessCriteria = [
  { id: "SN-1", system: "SYS-1E-DC", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-ACT", "SYS-CONF"], criterion: "One battery and one bus carry the protective loads for the mission time." },
  { id: "SN-2", system: "SYS-ACT", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-CONF"], criterion: "Two of four voting channels generate the protective signal." },
  { id: "SN-3", system: "SYS-HVAC", type: "CONSERVATIVE" as const, supports: ["SYS-1E-DC", "SYS-ACT"], criterion: "One cooling train holds the I&C room below its temperature limit." },
].map((n) => ({
  uuid: n.id,
  systemReference: n.system,
  successCriteria: n.criterion,
  criteriaType: n.type,
  supportedSystems: n.supports,
  implementsSrs: srs("SY-B6", "SY-B7"),
}));

const depletionModels = [
  { id: "INV-1", resource: "Class-1E DC battery", type: "battery" as const, system: "SYS-1E-DC", capacity: 4, mission: 24, supports: false, treatment: "Load shedding extends the duty to 24 h, calculation under review." },
  { id: "INV-2", resource: "Instrument air for isolation dampers", type: "air" as const, system: "SYS-CONF", capacity: 72, mission: 72, supports: true, treatment: "Accumulator sized for the full mission time." },
  { id: "INV-3", resource: "DRACS air heat sink", type: "air" as const, system: "SYS-DRACS", capacity: 0, mission: 24, supports: true, treatment: "Atmospheric heat sink, no depletion." },
].map((d) => ({
  uuid: d.id,
  resourceType: d.type,
  description: d.resource,
  initialQuantity: d.capacity,
  consumptionRate: d.capacity > 0 ? Number((d.capacity / d.mission).toFixed(3)) : 0,
  units: "hours",
  associatedSystem: d.system,
  missionTimeSupported: d.supports,
  implementsSrs: srs("SY-B12"),
}));

const digitalInstrumentationAndControl = [
  {
    uuid: "DIC-1",
    name: "Trip and isolation voting logic",
    systemReference: "SYS-ACT",
    description: "Digital voting logic for the trip and isolation functions.",
    methodology: "Modeled per the Part II Subpart 2.7 digital I&C method, one accepted approach among others.",
    failureModes: ["Channel hardware failure", "Systematic software fault", "Common software image failure"],
    specialConsiderations: ["Software common cause modeled through CCF-ACT-SW at CC-II."],
    implementsSrs: srs("SY-B11"),
  },
];

const passiveSystemsTreatments = [
  { uuid: "PST-DRACS", name: "DRACS natural circulation", systemReference: "SYS-DRACS", description: "Decay heat removed by buoyancy-driven natural circulation, no active power.", relevantPhysicalPhenomena: ["Natural convection", "Sodium-to-air heat transfer"], uncertaintyEvaluation: "Reliability propagated by direct uncertainty quantification.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-PCS", name: "Primary loop natural circulation", systemReference: "SYS-PRIMARY", description: "Buoyancy-driven flow establishes on a pump trip.", relevantPhysicalPhenomena: ["Buoyancy-driven flow", "Loop thermal centers"], uncertaintyEvaluation: "Establishment timing carried as the sensitive variable.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-GV", name: "Guard vessel", systemReference: "SYS-GUARD", description: "Passive structural barrier that bounds a primary leak.", relevantPhysicalPhenomena: ["Structural retention"], uncertaintyEvaluation: "System-level reliability from structural analysis.", implementsSrs: srs("SY-A9") },
];

const environmentalDesignBasisConsiderations = [
  { id: "SPC-1", system: "SYS-DRACS", components: ["DRC-LP1", "DRC-LP2"], seqs: ["HZ-FIRE", "IEG-10"], text: "North penetration room. A fire or flood here fails two of the three DRACS loops at once, carried through the environment factor of the loop common cause group.", included: true },
  { id: "SPC-2", system: "SYS-HVAC", components: ["DC-BAT-A", "DC-BAT-B", "ACT-CPU-A", "ACT-CPU-B", "ACT-CPU-C", "ACT-CPU-D"], seqs: ["IEG-02"], text: "Shared safety HVAC. Loss of cooling raises the battery room and the safety I&C room temperature together, carried as the cooling dependency in the support matrix.", included: true },
  { id: "SPC-3", system: "SYS-CONF", components: ["CIS-DMP-A", "CIS-DMP-B"], seqs: ["IEG-07", "IEG-09"], text: "Sodium-fire environment. A sodium leak can push the isolation dampers beyond their environmental qualification, so the adverse condition enters as a dependent failure.", included: true },
].map((e) => ({
  uuid: e.id,
  systemReference: e.system,
  components: e.components,
  eventSequences: e.seqs,
  environmentalConditions: e.text,
  dependentFailuresIncluded: e.included,
  implementsSrs: srs("SY-B8", "SY-B14"),
}));

const systemConfirmationRecords = [
  { id: "CR-1", system: "SYS-DRACS", method: "DESIGN_REVIEW" as const, date: "2026-04-30", roles: ["Systems lead", "DRACS designer"], findings: "Model matches the design intent, walkdown deferred to as-built." },
  { id: "CR-2", system: "SYS-RPS", method: "DISCUSSIONS" as const, date: "2026-05-01", roles: ["Systems analyst", "I&C engineer"], findings: "Trip logic and divisions confirmed against the design package." },
  { id: "CR-3", system: "SYS-1E-DC", method: "DESIGN_REVIEW" as const, date: "2026-05-02", roles: ["Electrical engineer", "Systems analyst"], findings: "Bus assignments confirmed, battery duty flagged for INV-1." },
  { id: "CR-4", system: "SYS-ACT", method: "DISCUSSIONS" as const, date: "2026-05-03", roles: ["I&C engineer", "Systems analyst"], findings: "Two-of-four voting confirmed, the software common cause carried per the digital I&C method." },
  { id: "CR-5", system: "SYS-CONF", method: "DESIGN_REVIEW" as const, date: "2026-05-03", roles: ["Mechanical engineer", "Systems analyst"], findings: "Series damper arrangement and the standby clean-up train confirmed against the design package." },
  { id: "CR-6", system: "SYS-HVAC", method: "DESIGN_REVIEW" as const, date: "2026-05-04", roles: ["HVAC engineer", "Systems analyst"], findings: "Lead and lag rotation confirmed, the DC room heat-up window recorded for the logic loop." },
  { id: "CR-7", system: "SYS-PRIMARY", method: "DISCUSSIONS" as const, date: "2026-05-04", roles: ["Thermal-hydraulics analyst", "Systems lead"], findings: "Natural-circulation path and check-valve arrangement confirmed against the coastdown analysis." },
  { id: "CR-8", system: "SYS-GUARD", method: "DESIGN_REVIEW" as const, date: "2026-05-05", roles: ["Structural engineer", "Systems lead"], findings: "Guard-vessel retention confirmed, the bounding leak case documented." },
].map((c) => ({
  uuid: c.id,
  systemReference: c.system,
  method: c.method,
  date: c.date,
  personnelRoles: c.roles,
  findings: c.findings,
  implementsSrs: srs("SY-A6"),
}));

const overCapacityConsiderations = [
  { id: "OC-1", system: "SYS-DRACS", scenario: "Decay heat above the rated exchanger duty early in the sequence", treatment: "CONSERVATIVE" as const, basis: "Rated capability used at CC-I until the realistic duty is confirmed." },
  { id: "OC-2", system: "SYS-PRIMARY", scenario: "Natural-circulation flow near the loop capability", treatment: "REALISTIC_JUSTIFIED" as const, basis: "Realistic capability supported by the coastdown analysis at CC-II." },
  { id: "OC-3", system: "SYS-GUARD", scenario: "Sodium spill loads at the bounding leak size", treatment: "CONSERVATIVE" as const, basis: "Design-basis structural capability used until the spill analysis is extended." },
].map((o) => ({
  uuid: o.id,
  system: o.system,
  potentialExceedanceScenarios: [o.scenario],
  treatment: o.treatment,
  justificationForCapability: o.basis,
  implementsSrs: srs("SY-A29"),
}));

const simultaneousUnavailabilityEvents = [
  {
    uuid: "UA-3",
    description: "Clean-up train and isolation damper planned out of service together.",
    componentIds: ["CIS clean-up train", "CIS isolation damper"],
    plannedActivityBasis: "Redundant equipment planned out of service at once, parameter from DA.",
    dataAnalysisRef: "CM-1",
    implementsSrs: srs("SY-A27"),
  },
];

const uncertaintyAnalyses = [
  {
    uuid: "SUA-1",
    system: "SYS-DRACS",
    propagationMethod: "LATIN_HYPERCUBE" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-1", description: "DRACS damper common cause parameter", impact: "Sensitivity on the beta factor pending DA-D8.", isQuantified: false, treatmentApproach: "Sensitivity study on the beta-factor range." },
      { uncertaintyId: "MU-3", description: "Battery depletion duty", impact: "Load-shedding calculation carried as an open uncertainty.", isQuantified: false, treatmentApproach: "Bounded estimate until the calculation closes." },
    ],
    parameterUncertainties: [
      { parameterId: "DRC-CCF-FR", distributionType: DistributionType.BETA, distributionParameters: { alpha: 2, beta: 1800 }, basis: "Alpha-factor prior pending DA-D8.", associatedComponent: "DRACS loops" },
    ],
    implementsSrs: srs("SY-B16"),
  },
];

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "DRACS loop CCF sweep", description: "DRACS loop common cause sweep across the beta-factor range.", variedParameters: ["DRACS loop beta factor"], parameterRanges: { "Beta factor": [0.01, 0.1] }, results: "One of three holds with margin across the beta-factor range." },
  { uuid: "SS-2", name: "Battery duty sweep", description: "Battery duty against the mission time.", variedParameters: ["Battery duty hours"], parameterRanges: { "Duty hours": [4, 24] }, results: "Load shedding meets 24 h in the base case, slowest case open." },
];

const preOperationalAssumptions = [
  { id: "PA-1", area: "System models", desc: "Models from the design package, to confirm by walkdown when as-built.", risk: ImportanceLevel.MEDIUM, srs: ["SY-A33"], paths: ["systemLogicModels"] },
  { id: "PA-2", area: "Maintenance unavailability", desc: "Assumed durations until as-operated maintenance data exists.", risk: ImportanceLevel.LOW, srs: ["SY-A26"], paths: ["simultaneousUnavailabilityEvents"] },
  { id: "PA-3", area: "Dependency modeling", desc: "Support needs from design analysis, to re-check against operation.", risk: ImportanceLevel.MEDIUM, srs: ["SY-B17"], paths: ["systemDependencies"] },
  { id: "PA-4", area: "Documentation", desc: "Systems taken free of design and construction errors, to verify as-built.", risk: ImportanceLevel.LOW, srs: ["SY-C3"], paths: ["documentation"] },
].map((a) => ({
  uuid: a.id,
  assumptionId: a.id,
  description: a.desc,
  influenceOnDefinition: a.area,
  status: "OPEN" as const,
  limitations: ["Pre-operational, pending as-built confirmation."],
  riskImpact: a.risk,
  closureBasis: "Confirm against the as-built and as-operated plant.",
  plannedClosureActions: ["Re-check at the operating stage."],
  affectedElementIds: a.paths,
  implementsSrs: srs(...a.srs),
}));

const variableSuccessCriteria = [
  { uuid: "VSC-DRACS-FP", systemReference: "SYS-DRACS", plantOperatingStateId: "POS-01", scenarioCondition: "Full power", successCriteriaIds: ["SC-SYS-DRACS"], basis: "Two of three DRACS loops remove decay heat. The full-power decay curve loses the single-loop race and two loops cross it at 4.3 h. Verified by a 41-probe dynamic campaign, capacity frontier 2.38 to 2.41 MW (TF-CALC-09).", implementsSrs: srs("SY-A5", "SY-B5") },
  { uuid: "VSC-DRACS-OTHER", systemReference: "SYS-DRACS", scenarioCondition: "Operating states other than full power (POS-02 to POS-09)", successCriteriaIds: ["SC-SYS-DRACS"], basis: "One of three DRACS loops removes decay heat for the sequence mission time, since the lower decay load sits within a single loop capability.", implementsSrs: srs("SY-A5", "SY-B5") },
];

export const SY_ANALYSIS: SystemsAnalysis = SystemsAnalysisSchema.parse({
  uuid: "sy-generic-1",
  name: "SY Workbook 2",
  type: TechnicalElementTypes.SYSTEMS_ANALYSIS,
  version: "2",
  created: CREATED,
  modified: NOW,
  owner: "sreyes",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "sreyes" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["sreyes", "jpark", "lfischer"],
    reviewers: [
      { id: "rev-1", name: "Dr. Nadia Hartwell", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Marc Béland", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Electrical & I&C", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Priya Subramanian", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Dependencies & CCF", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Systems analysis for the Generic SFR across pre-operational plant operating states, building the system logic models that supply branch failure to Event Sequence Quantification.",
    limitations: ["Pre-operational: system models rest on design information pending as-built confirmation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "sreyes",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "syc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-02T09:14:00.000Z", associatedSr: "SY-B3", text: "The DRACS damper group rests on a shared crew and shared make, so SY-B3 needs the grouping basis closed against the DA-D8 parameter set before the beta factor is final.", severity: "MAJOR", resolved: false },
      { uuid: "syc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-02T10:30:00.000Z", associatedSr: "SY-B11", text: "The actuation logic carries a single software image across the trip and isolation functions, so SY-B11 needs the software common cause modeled rather than left as a bounding term.", severity: "MAJOR", resolved: false },
      { uuid: "syc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-02T11:00:00.000Z", associatedSr: "SY-B12", text: "A 4 hour battery against a 24 hour mission needs the load-shedding calculation closed under SY-B12, since the current model assumes the duty without showing it.", severity: "MAJOR", resolved: false },
      { uuid: "syc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-03T14:05:00.000Z", associatedSr: "SY-B8", text: "Two DRACS loops share the north penetration room, so SY-B8 needs the room-level dependent failure confirmed in the fault tree, not only noted in the text.", severity: "MINOR", resolved: false },
      { uuid: "syc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-03T15:20:00.000Z", associatedSr: "SY-A20", text: "The screening of the indicating lamps and root valves is clean and each exclusion cites a stated criterion.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the screening criteria are applied consistently.", resolvedAt: "2026-05-03T17:00:00.000Z", resolvedBy: "rev-2" },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope systems analysis for the Generic SFR, pre-operational stage, capability category CC-II.",
  dependencyBayesianNetworks: [createExampleDependencyNetwork()],
  dependencyHclConfigurations: [createExampleHclConfiguration()],
  systemDefinitions,
  variableSuccessCriteria,
  systemToSafetyFunctionMappings,
  systemLogicModels,
  systemBasicEvents,
  systemConfirmationRecords,
  plantRepresentationAccuracy: {
    scope: "PRE_OPERATIONAL",
    accuracy: ImportanceLevel.MEDIUM,
    basis: "Models from the design package, confirmed by design review, walkdowns deferred to the as-built plant.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Level of detail set to surface the risk-significant contributors against the available design information.",
    highConfidenceAreas: ["System boundaries", "Logic model structure"],
    lowerConfidenceAreas: ["DRACS damper common cause", "Battery depletion duty", "Actuation software common cause"],
    improvementPlans: ["Close the open items against Data Analysis and confirm by walkdown at as-built."],
    implementsSrs: srs("SY-A6", "SY-A10", "SY-A11"),
  },
  systemDependencies,
  componentDependencies: [],
  dependencySearchMethodology: {
    uuid: "DSM-1",
    name: "Support-system dependency search",
    description: "Each system row is checked against the support columns by engineering analysis, with a support-on-support loop resolved explicitly.",
    reference: "Generic SFR dependency search procedure",
    dependencyTables: [{ tableId: "DEP-MATRIX", description: "Support-system dependency matrix" }],
    systemsAnalyzed: SYSTEMS.map((s) => s.id),
    implementsSrs: srs("SY-B5", "SY-B6"),
  },
  commonCauseFailureGroups,
  supportSystemSuccessCriteria,
  humanFailureEventIntegrations,
  exampleDocuments: [
    { id: "SY-DOC-01", name: "EBR-II System Design Descriptions", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-EBR-II SDD set", extracted: "System boundaries, trains, and support dependencies for the primary, shutdown-cooling and protection systems", linked: 7, url: "/api/example-documents/sy/sfr-sdd" },
    { id: "SY-DOC-02", name: "DRACS Reliability and Natural-Circulation Basis", kind: "doc", sizeLabel: "ANL/IAEA", uploadedLabel: "IAEA-TECDOC-1531", extracted: "Passive decay-heat-removal loop reliability, damper failure modes, and natural-circulation performance", linked: 4, url: "/api/example-documents/sy/sfr-dracs" },
    { id: "SY-DOC-03", name: "Sodium Fast Reactor Component Failure Data Dossier", kind: "sheet", sizeLabel: "INL", uploadedLabel: "NUREG/CR-6928 + SFR overlay", extracted: "Basic-event failure rates and common-cause parameters for the modeled components", linked: 6, url: "/api/example-documents/sy/sfr-failure-data" },
    { id: "SY-DOC-04", name: "Common-Cause Failure Parameter Estimates (Alpha Factor)", kind: "sheet", sizeLabel: "NRC", uploadedLabel: "NUREG/CR-5485", extracted: "Alpha-factor common-cause parameters applied to the redundant loop and division groups", linked: 3, url: "/api/example-documents/sy/sfr-ccf" },
  ],
  simultaneousUnavailabilityEvents,
  componentScreeningJustifications,
  environmentalDesignBasisConsiderations,
  digitalInstrumentationAndControl,
  passiveSystemsTreatments,
  depletionModels,
  overCapacityConsiderations,
  uncertaintyAnalyses,
  sensitivityStudies,
  modelUncertainty: {
    uuid: "sy-mu-1",
    name: "SY model uncertainty documentation",
    uncertaintySources: [
      { source: "DRACS damper common cause parameter", impact: "Sensitivity on the beta factor pending DA-D8." },
      { source: "Actuation software failure mode", impact: "Bounded estimate carried until the CC-II software model is set." },
      { source: "Battery depletion duty", impact: "Load-shedding calculation carried as an open uncertainty." },
      { source: "Supercomponent boundary for the trip cabinet", impact: "Boundary checked against the data, flagged for the as-built." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  documentation: {
    processDescription: "Systems analysis built one system logic model at a time from the Event Sequence safety functions, with common cause groups, dependencies and human failure events placed in the models, per ASME/ANS RA-S-1.4 HLR-SY-A through C.",
    systemFunctionsAndBoundaries: "Eight systems modeled, each with a top event, a success criterion and a stated model boundary including the support interfaces.",
    systemSchematicsReferenced: "System design descriptions and P&IDs referenced for each modeled system.",
    modeledComponentsAndFailureModes: "Components and failure modes that defeat the system success criteria are included, with beneficial failures left out unless their omission distorts the result.",
    screeningAndExclusionJustifications: "Four components screened from detailed analysis, each against a stated screening criterion.",
    successCriteriaRelationship: "Each system top event is set by a success criterion from Success Criteria Development.",
    alignmentsAndConfigurations: "Normal and significant alternate alignments modeled per system.",
    testAndMaintenanceTreatment: "Out-of-service unavailability modeled per the maintenance plan, with simultaneous planned unavailability of redundant equipment carried explicitly.",
    dependencySearchAndTables: "Support-system dependencies set by engineering analysis in a dependency matrix, with a support-on-support loop resolved explicitly.",
    ccfGroupsAndModels: "Thirteen common cause groups, nine within a system and four across systems, consistent with the Data Analysis common cause model.",
    humanFailureEventsIncluded: "Pre-initiator and post-initiator human failure events placed in the system models and handed to Human Reliability.",
    modularizationAndLogicLoops: "One support-on-support logic loop resolved by crediting the battery for the cooling restart window.",
    nomenclatureConventions: "One designator per component failure mode across every system and train, which lets the quantifier link the trees.",
    digitalICTreatment: "Digital actuation logic modeled per the Part II Subpart 2.7 method, with software common cause modeled at CC-II.",
    passiveSystemsTreatment: "Passive functions treated with mechanistic models and direct uncertainty propagation for functional reliability.",
    evaluationResultsSummary: "Each system fault tree quantified standalone, with the full-plant quantification performed by Event Sequence Quantification.",
    informationSources: "Design descriptions, failure mode analyses, the common cause parameter dossier and the surveillance plan.",
    modelUncertaintySources: "Model-uncertainty sources include the DRACS damper common cause parameter, the actuation software failure mode and the battery depletion duty.",
    asBuiltLimitations: "Pre-operational: system models, dependencies and unavailability rest on design information pending as-built and as-operated confirmation.",
    praTaskInterfaces: "Interfaces with Event Sequence Analysis and Success Criteria for what to model, with Data Analysis for parameters, with Human Reliability for human events, and with Event Sequence Quantification which links the trees.",
    implementsSrs: srs("SY-C1"),
  },
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-072", "NM-055", "NM-061"],
});

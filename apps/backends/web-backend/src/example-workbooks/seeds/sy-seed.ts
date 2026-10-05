import { type SystemDiagram, type SystemsAnalysis, type SystemBasicEvent, type LegacySystemFaultTreeNode } from "interfaces-mef-types/sy/systems-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { SY_SR_CATALOG } from "interfaces-mef-types/sy/systems-analysis";
import { createExampleDependencyNetwork, createExampleHclConfiguration } from "./dependency-model-seed";
import { SC_ANALYSIS } from "./sc-seed";

const NOW = "2026-05-04T12:00:00.000Z";
const CREATED = "2026-04-22T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["SY-A12", "SY-B3", "SY-B4", "SY-B8", "SY-B11", "SY-B12", "SY-B14"]);

const SR_EVIDENCE: Record<string, string> = {
  "SY-A1": "Thirteen systems identified from the Event Sequence safety functions.",
  "SY-A8": "Model boundaries set to include the components and the support interfaces.",
  "SY-A9": "Guard vessel modeled at the system level, the rest in detail.",
  "SY-A16": "Every system records the failures left out, the flow diversion paths and the conditions that defeat its function.",
  "SY-A17": "Beneficial failures are listed as left out, each with why it helps or cannot defeat the function.",
  "SY-A18": "Flow diversion paths are recorded for each fluid system, and screened out only where they meet criterion a.",
  "SY-A20": "5 items screened out, each against criterion a or b with its ratio from industry-average data.",
  "SY-A21": "Pre-initiator human failure events sit in the fault trees, linked to their HR events.",
  "SY-A23": "Post-initiator human failure events sit in the fault trees, linked to their HR events.",
  "SY-A24": "6 isolation and trip signals recorded, each with where it is modeled or why it is left out.",
  "SY-A27": "Two planned activities take redundant equipment out together, modeled as joint maintenance events from the DA coincident maintenance parameters.",
  "SY-A28": "Each system lists the conditions, such as heat, electrical load or humidity, that defeat its function.",
  "SY-A30": "One code per system and one designator per failure mode, checked on every event code.",
  "SY-A32": "Each system records its model uncertainty sources and assumptions, with sensitivity studies on the loop coupling and the battery duty.",
  "SY-B16": "Each common cause group and the key dependency assumptions carry an uncertainty record, including the shared penetration room and the battery room cooling.",
  "SY-C2": "Model uncertainty sources are documented per system and across the plant, citing SY-A32 and SY-B16.",
  "SY-A6": "Each of the thirteen system models confirmed against the design intent, by design review or discussion with the designers.",
  "SY-A11": "Each system records its level of detail against the design information, set to surface the risk-significant contributors.",
  "SY-A12": "Each modeled component is checked against its DA boundary. The charger boundary is still open with DA (DA-A2).",
  "SY-A13": "Nine boundaries are flagged as not verified against the industry data, among them the rod latches, the sodium pumps and the actuation software.",
  "SY-A14": "Four supercomponents, each checked for one recovery potential and no use by another system.",
  "SY-B1": "Common cause modeled within each redundant system.",
  "SY-B2": "Four inter-system common cause groups modeled, the station batteries and the actuation sensor, output and software modules.",
  "SY-B5": "Nineteen support needs recorded. Fifteen are transfers in the fault trees, and four are left out with an engineering reason.",
  "SY-B6": "Support needs set by engineering analysis for the actuation logic, DC, DRACS and the intermediate loop.",
  "SY-B7": "Support success criteria recorded for DC, the actuation logic, HVAC and level detection, realistic where risk significant.",
  "SY-B9": "Each system carries its support interfaces for its full mission time, with the battery duty the one open item.",
  "SY-B10": "Independence assumptions logged where the design is not fixed, for the HVAC trains, the DRACS loops and the actuation channels.",
  "SY-B13": "No support is left out on a recovery procedure. Each exclusion rests on an engineering reason, including the battery room heat-up.",
  "SY-B15": "The isolation and make-up cues come from the level alarm, carried as transfers into the detection system.",
  "SY-B17": "Dependency assumptions logged for the as-built confirmation, including the HVAC power feeds.",
  "SY-B3": "DRACS damper grouping basis open against the DA-D8 parameter set.",
  "SY-B4": "DRACS damper factors taken from the air-operated valve fail-to-open data, with sodium-plant applicability open under DA-D8.",
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
  be("DRC-LP1-FR", "DRACS loop 1 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.006915089995696231),
  be("DRC-LP2-FR", "DRACS loop 2 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.006915089995696231),
  be("DRC-LP3-FR", "DRACS loop 3 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.006915089995696231),
  be("DRC-DMP1-FO", "Loop 1 air damper fails to open", "FAILURE_TO_START", 0.00022725551094614045),
  be("DRC-DMP2-FO", "Loop 2 air damper fails to open", "FAILURE_TO_START", 0.00022725551094614045),
  be("DRC-DMP3-FO", "Loop 3 air damper fails to open", "FAILURE_TO_START", 0.00022725551094614045),
  be("DRC-AIR1-PLG", "Loop 1 air path blocked", "FAILURE_TO_RUN", 0.0004791879330308914),
  be("DRC-AIR2-PLG", "Loop 2 air path blocked", "FAILURE_TO_RUN", 0.0004791879330308914),
  be("DRC-AIR3-PLG", "Loop 3 air path blocked", "FAILURE_TO_RUN", 0.0004791879330308914),
  be("DRC-CCF-FR", "Common cause failure of all three loops", "COMMON_CAUSE_FAILURE", 0.00012),
  be("DRC-DMP-CCF", "Common cause failure of the air dampers", "COMMON_CAUSE_FAILURE", 0.0003),
  hfe("DRC-HFE-CAL", "DRACS channels miscalibrated after surveillance", 0.0024, "HR-PRE-014"),
  hfe("DRC-HFE-ALIGN", "Dampers left misaligned after surveillance", 0.01, "HR-PRE-022"),
  tm("DRC-LP1-TM", "Loop 1 in staggered surveillance", 0.003995433789954338, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
  tm("DRC-LP2-TM", "Loop 2 in staggered surveillance", 0.003995433789954338, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
  tm("DRC-LP3-TM", "Loop 3 in staggered surveillance", 0.003995433789954338, "Staggered loop testing per the design surveillance plan, two loops stay available.", true),
];
const rpsEvents: SystemBasicEvent[] = [
  be("RPS-DVA-FS", "Division A fails to trip", "FAILURE_TO_START", 0.00076103500761035),
  be("RPS-DVB-FS", "Division B fails to trip", "FAILURE_TO_START", 0.00076103500761035),
  be("RPS-BKA-FO", "Scram breaker A fails to open", "FAILURE_TO_START", 0.0004127115146512588),
  be("RPS-BKB-FO", "Scram breaker B fails to open", "FAILURE_TO_START", 0.0004127115146512588),
  be("RPS-RODA-FRL", "Division A rods fail to release", "FAILURE_TO_START", 0.0009845137515645016),
  be("RPS-RODB-FRL", "Division B rods fail to release", "FAILURE_TO_START", 0.0009845137515645016),
  be("RPS-CCF-FS", "Common cause failure of both divisions", "COMMON_CAUSE_FAILURE", 0.00009),
  be("RPS-ROD-CCF", "Common cause failure of the rod release", "COMMON_CAUSE_FAILURE", 0.00004),
  hfe("RPS-HFE-CAL", "Trip setpoints miscalibrated after surveillance", 0.0011, "HR-PRE-031"),
];
const actEvents: SystemBasicEvent[] = [
  be("ACT-CH1-FS", "Voting channel 1 fails", "FAILURE_TO_START", 0.001087192868014786),
  be("ACT-CH2-FS", "Voting channel 2 fails", "FAILURE_TO_START", 0.001087192868014786),
  be("ACT-CH3-FS", "Voting channel 3 fails", "FAILURE_TO_START", 0.001087192868014786),
  be("ACT-CH4-FS", "Voting channel 4 fails", "FAILURE_TO_START", 0.001087192868014786),
  be("ACT-SEN1-FS", "Sensor input module 1 fails", "FAILURE_TO_START", 0.00028596371520024487),
  be("ACT-SEN2-FS", "Sensor input module 2 fails", "FAILURE_TO_START", 0.00028596371520024487),
  be("ACT-SEN3-FS", "Sensor input module 3 fails", "FAILURE_TO_START", 0.00028596371520024487),
  be("ACT-SEN4-FS", "Sensor input module 4 fails", "FAILURE_TO_START", 0.00028596371520024487),
  be("ACT-OUT1-FS", "Output actuation module 1 fails", "FAILURE_TO_START", 0.003284993040108412),
  be("ACT-OUT2-FS", "Output actuation module 2 fails", "FAILURE_TO_START", 0.003284993040108412),
  be("ACT-OUT3-FS", "Output actuation module 3 fails", "FAILURE_TO_START", 0.003284993040108412),
  be("ACT-OUT4-FS", "Output actuation module 4 fails", "FAILURE_TO_START", 0.003284993040108412),
  be("ACT-SW1-FS", "Actuation software channel 1 fails", "FAILURE_TO_START", 0.0001516125118545714),
  be("ACT-SW2-FS", "Actuation software channel 2 fails", "FAILURE_TO_START", 0.0001516125118545714),
  be("ACT-SW3-FS", "Actuation software channel 3 fails", "FAILURE_TO_START", 0.0001516125118545714),
  be("ACT-SW4-FS", "Actuation software channel 4 fails", "FAILURE_TO_START", 0.0001516125118545714),
  be("ACT-SW-CCF", "Common cause failure of the logic software", "COMMON_CAUSE_FAILURE", 0.0001),
  be("ACT-SEN-CCF", "Common cause failure of the sensor input modules", "COMMON_CAUSE_FAILURE", 0.0002),
  be("ACT-OUT-CCF", "Common cause failure of the output actuation modules", "COMMON_CAUSE_FAILURE", 0.00015),
];
const dcEvents: SystemBasicEvent[] = [
  be("DC-BAT-A-FR", "Battery train A fails to run", "FAILURE_TO_RUN", 9.691598410480782e-06),
  be("DC-BAT-B-FR", "Battery train B fails to run", "FAILURE_TO_RUN", 9.691598410480782e-06),
  be("DC-CHG-A-FLT", "Charger A fault discharges the bank", "FAILURE_TO_RUN", 4.235121311806847e-05),
  be("DC-CHG-B-FLT", "Charger B fault discharges the bank", "FAILURE_TO_RUN", 4.235121311806847e-05),
  be("DC-BUS-A-FLT", "DC bus A fails", "FAILURE_TO_RUN", 1.7142612013365198e-05),
  be("DC-BUS-B-FLT", "DC bus B fails", "FAILURE_TO_RUN", 1.7142612013365198e-05),
  be("DC-BAT-CCF", "Common cause failure of the station batteries", "COMMON_CAUSE_FAILURE", 0.0003),
  hfe("DC-HFE-CHG", "Charger left in the wrong mode after maintenance", 0.005, "HR-PRE-009"),
  hfe("DC-HFE-BNK", "Both battery banks held off float after equalization", 0.002, "HR-PRE-041"),
  tm("DC-BAT-A-TM", "Battery train A on equalize charge", 0.002511415525114155, "Pre-operational assumption from the design test plan, no operating history yet.", true),
  tm("DC-BAT-B-TM", "Battery train B on equalize charge", 0.002511415525114155, "Pre-operational assumption from the design test plan, no operating history yet.", true),
  tm("DC-BAT-AB-TM", "Both battery banks on one joint equalizing charge", 0.002511415525114155, "Coincident maintenance parameter DA-UA-05 in Data Analysis, one joint equalization a year.", true),
];
const cisEvents: SystemBasicEvent[] = [
  be("CIS-DMP-A-FC", "Isolation damper A fails to close", "FAILURE_TO_START", 7.575183698204681e-05),
  be("CIS-DMP-B-FC", "Isolation damper B fails to close", "FAILURE_TO_START", 7.575183698204681e-05),
  be("CIS-DMP-CCF", "Common cause failure of the isolation dampers", "COMMON_CAUSE_FAILURE", 0.0002),
  be("CIS-FAN-FR", "Running clean-up fan fails to run", "FAILURE_TO_RUN", 7.738968858725315e-05),
  be("CIS-IV-FO", "Inlet valve fails to open", "FAILURE_TO_START", 0.0003041243477134968),
  be("CIS-IDMP-SO", "Clean-up train inlet damper closes spuriously", "FAILURE_TO_RUN", 3.859979556495536e-06),
  be("CIS-FAN-B-FS", "Standby clean-up fan fails to start", "FAILURE_TO_START", 0.00027551462195457945),
  hfe("CIS-HFE-STBY", "Operator fails to start the standby clean-up train", 0.008, "HR-POST-022"),
  tm("CIS-FAN-DMP-TM", "Clean-up train and isolation damper A out for a filter change", 0.001997716894977169, "Coincident maintenance parameter DA-UA-04 in Data Analysis, one filter change a year at power.", true),
];
const hvacEvents: SystemBasicEvent[] = [
  be("HVC-CHA-FR", "Cooling train A fails to run", "FAILURE_TO_RUN", 0.0009302954163715795),
  be("HVC-CHB-FR", "Cooling train B fails to run", "FAILURE_TO_RUN", 0.0009302954163715795),
  be("HVC-AHA-FR", "Air handler A fails to run", "FAILURE_TO_RUN", 6.277943631116934e-05),
  be("HVC-AHB-FR", "Air handler B fails to run", "FAILURE_TO_RUN", 6.277943631116934e-05),
  be("HVC-CCF-FR", "Common cause failure of both trains", "COMMON_CAUSE_FAILURE", 0.00045),
  be("HVC-TS-FS", "Temperature instruments fail to start cooling", "FAILURE_TO_START", 0.00043196544276457883),
];
const pcsEvents: SystemBasicEvent[] = [
  be("PCS-L1-PLG", "Loop 1 flow path blocked", "FAILURE_TO_RUN", 0.00038346708353456405),
  be("PCS-L2-PLG", "Loop 2 flow path blocked", "FAILURE_TO_RUN", 0.00038346708353456405),
  be("PCS-CKV1-FO", "Loop 1 check valve fails to open", "FAILURE_TO_START", 1.1160589725561099e-05),
  be("PCS-CKV2-FO", "Loop 2 check valve fails to open", "FAILURE_TO_START", 1.1160589725561099e-05),
  be("PCS-FLOW-CCF", "Common cause blockage of both flow paths", "COMMON_CAUSE_FAILURE", 0.00008),
  be("PCS-TC-FR", "Thermal-center flow degraded below the limit", "FAILURE_TO_RUN", 0.0006915089995696232),
  hfe("PCS-HFE-CAL", "Pump trip circuits miscalibrated after surveillance", 0.0015, "HR-PRE-018"),
];

const sdhrEvents: SystemBasicEvent[] = [
  be("SDR-PMP-FR", "Intermediate sodium pump fails to run", "FAILURE_TO_RUN", 0.0006237980911986262),
  be("SDR-SINK-FR", "Steam-side heat sink lost", "FAILURE_TO_RUN", 0.0010039701601406304),
  be("SDR-IV-SO", "Loop isolation valve spuriously closes", "FAILURE_TO_START", 3.3600000000000004e-06),
  tm("SDR-PMP-TM", "Intermediate pump in maintenance", 0.0029680365296803654, "Planned intermediate-pump maintenance in the shutdown window.", true),
  hfe("SDR-HFE", "Operator fails to start backup decay heat removal", 0.0008, "HR-POST-005"),
];
const isolEvents: SystemBasicEvent[] = [
  be("ISO-DET-FS", "Leak detection fails to actuate isolation", "FAILURE_TO_START", 0.0008153946510110894),
  be("ISO-VLV-A-FC", "Isolation valve A fails to close", "FAILURE_TO_START", 0.00022811696486153864),
  be("ISO-VLV-B-FC", "Isolation valve B fails to close", "FAILURE_TO_START", 0.00022811696486153864),
  be("ISO-VLV-CCF", "Common cause failure of the isolation valves", "COMMON_CAUSE_FAILURE", 0.0002),
  hfe("ISO-HFE", "Operator fails to isolate the leak path", 0.005, "HR-POST-025"),
];
const makeupEvents: SystemBasicEvent[] = [
  be("MKU-PMP-FS", "Make-up pump fails to start", "FAILURE_TO_START", 0.0011754451217607827),
  be("MKU-VLV-FO", "Make-up fill valve fails to open", "FAILURE_TO_START", 0.00034337235963270235),
  be("MKU-TNK-UN", "Make-up sodium tank unavailable", "FAILURE_TO_RUN", 1.4273003185933263e-05),
  hfe("MKU-HFE", "Operator fails to initiate make-up", 0.006, "HR-POST-026"),
];
const detectEvents: SystemBasicEvent[] = [
  be("DET-LVL-A-FS", "Level channel A fails", "FAILURE_TO_START", 0.001629460648525338),
  be("DET-LVL-B-FS", "Level channel B fails", "FAILURE_TO_START", 0.001629460648525338),
  be("DET-LVL-CCF", "Common cause failure of the level channels", "COMMON_CAUSE_FAILURE", 0.0003),
  be("DET-ALM-FS", "Level alarm fails to annunciate", "FAILURE_TO_START", 0.00035999854889555183),
];
const suppEvents: SystemBasicEvent[] = [
  be("SUP-DET-FS", "Sodium fire detection fails", "FAILURE_TO_START", 0.0032850001906496876),
  be("SUP-SUP-FS", "Suppression and drain system fails to actuate", "FAILURE_TO_START", 0.0052778920854694945),
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
  missionHours: number;
  boundaries: string[];
  detailed: boolean;
  events: SystemBasicEvent[];
  modeledFailures: Record<string, { failureModes: string[]; justificationForInclusion?: string }>;
}

const SYSTEMS: SystemSeed[] = [
  { id: "SYS-RPS", short: "RPS", name: "Reactor protection system", sf: "SF-RC", modelRep: "Fault tree", topEvent: "RPS fails to insert negative reactivity on demand", criterion: "One of two divisions inserts the rods within 3 s of the trip demand.", missionHours: 24, boundaries: ["Sensors and trip logic", "Two trip divisions", "Scram breakers and rod release"], detailed: true, events: rpsEvents, modeledFailures: { "Trip divisions": { failureModes: ["Division fails to trip", "Scram breaker fails open", "Rod fails to release", "Common cause of divisions"] } } },
  { id: "SYS-DRACS", short: "DRACS", name: "Direct reactor auxiliary cooling system", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "DRACS fails to remove decay heat for the mission time", criterion: "Two of three loops remove decay heat by natural circulation at full power, one of three in the other states.", missionHours: 24, boundaries: ["Three independent NaK loops", "Sodium-to-NaK and NaK-to-air exchangers", "Air dampers and stack"], detailed: true, events: dracsEvents, modeledFailures: { "NaK loops": { failureModes: ["Loop natural-circulation loss", "Damper fails to open", "Air-path blockage", "Common cause of loops"] } } },
  { id: "SYS-PRIMARY", short: "PCS", name: "Primary loop natural circulation", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Primary natural circulation fails to establish", criterion: "Both loops stay open so buoyancy-driven flow establishes in time.", missionHours: 24, boundaries: ["Primary pumps and check valves", "Both loop flow paths", "Thermal-center elevation"], detailed: true, events: pcsEvents, modeledFailures: { "Flow paths": { failureModes: ["Flow-path blockage", "Check valve fails to open", "Thermal-center degradation"] } } },
  { id: "SYS-CONF", short: "CIS", name: "Confinement isolation & clean-up", sf: "SF-CONF", modelRep: "Fault tree", topEvent: "Confinement fails to isolate or clean up on demand", criterion: "Isolation closes on demand and the clean-up train holds the leak rate.", missionHours: 24, boundaries: ["Isolation dampers and valves", "Cover-gas clean-up train", "Isolation actuation signal"], detailed: true, events: cisEvents, modeledFailures: { "Isolation and clean-up": { failureModes: ["Isolation damper fails to close", "Clean-up train fails to run", "Inlet damper closes spuriously", "Standby train fails to start", "Signal fails to generate"] } } },
  { id: "SYS-GUARD", short: "GV", name: "Guard vessel", sf: "SF-INV", modelRep: "System-level", topEvent: "Guard vessel fails to retain sodium over the core", criterion: "The guard vessel bounds a primary leak and keeps the core covered.", missionHours: 72, boundaries: ["Guard vessel shell", "Shared support skirt", "Leak-detection interface"], detailed: false, events: [], modeledFailures: { "Guard vessel": { failureModes: ["Shell leak"], justificationForInclusion: "System-level data sufficient, no internal redundancy." } } },
  { id: "SYS-1E-DC", short: "DC", name: "Class-1E DC power", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Class-1E DC power fails to supply the trip and actuation loads", criterion: "Battery and distribution supply the DC loads for the mission time.", missionHours: 24, boundaries: ["Station batteries", "DC distribution buses", "Battery chargers"], detailed: true, events: dcEvents, modeledFailures: { "Battery trains": { failureModes: ["Battery fails to run", "Common cause of batteries", "Charger fault", "Bus fault"] } } },
  { id: "SYS-ACT", short: "ACT", name: "Reactor trip & actuation logic", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Actuation logic fails to generate the trip or isolation signal", criterion: "Digital logic generates the protective signal on demand.", missionHours: 24, boundaries: ["Sensor input modules", "Digital voting logic", "Output actuation modules"], detailed: true, events: actEvents, modeledFailures: { "Voting logic": { failureModes: ["Channel fails", "Software common cause", "Sensor input common cause", "Output module common cause"] } } },
  { id: "SYS-HVAC", short: "HVAC", name: "Safety I&C room cooling", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Room cooling fails and I&C exceeds its temperature limit", criterion: "Room cooling keeps the I&C below its qualified temperature.", missionHours: 24, boundaries: ["Safety chillers", "Room air handlers", "Temperature instruments"], detailed: true, events: hvacEvents, modeledFailures: { "Cooling trains": { failureModes: ["Chiller fails to run", "Air handler fails to run", "Temperature instruments fail to start", "Common cause of trains"] } } },
  { id: "SYS-SDHR", short: "SDHR", name: "Intermediate-loop shutdown heat removal", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Intermediate-loop shutdown heat removal fails", criterion: "The intermediate sodium loop and the steam-side heat sink remove shutdown heat for the mission time.", missionHours: 24, boundaries: ["Intermediate sodium loop and pump", "Steam generators and feedwater", "Loop isolation and dump valves"], detailed: true, events: sdhrEvents, modeledFailures: { "Intermediate loop": { failureModes: ["Pump fails to run", "Heat-sink loss", "Isolation valve spurious closure"] } } },
  { id: "SYS-ISOL", short: "ISOL", name: "Leak detection and isolation", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Leak detection and isolation fail to preserve the sodium inventory", criterion: "A primary leak is detected and the affected path isolated before the sodium level drops below the IHX inlet.", missionHours: 72, boundaries: ["Sodium leak detectors", "Redundant line isolation valves", "Level instrumentation interface"], detailed: true, events: isolEvents, modeledFailures: { "Isolation path": { failureModes: ["Detection fails", "Isolation valve fails to close", "Common cause of valves"] } } },
  { id: "SYS-MAKEUP", short: "MKUP", name: "Sodium make-up", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Make-up fails to restore the sodium level", criterion: "The make-up path restores the pool level to keep the core covered for the mission time.", missionHours: 72, boundaries: ["Make-up sodium tank and pump", "Fill line and valves", "Level control interface"], detailed: true, events: makeupEvents, modeledFailures: { "Make-up train": { failureModes: ["Pump fails to start", "Fill valve fails to open", "Tank unavailable"] } } },
  { id: "SYS-DETECT", short: "DET", name: "Sodium level detection", sf: "SF-INV", modelRep: "Fault tree", topEvent: "Level detection fails to alarm on a falling level", criterion: "Redundant level instrumentation alarms so operators diagnose a falling sodium level and act.", missionHours: 72, boundaries: ["Redundant sodium level probes", "Signal processing", "Control-room alarm and indication"], detailed: true, events: detectEvents, modeledFailures: { "Level detection": { failureModes: ["Level channel fails", "Common cause of channels", "Alarm fails"] } } },
  { id: "SYS-SUPP", short: "SUPP", name: "Sodium fire detection and suppression", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Fire suppression fails to protect the decay-heat-removal path", criterion: "The sodium fire is detected and suppressed before it disables the DRACS air path or the protection cabling.", missionHours: 24, boundaries: ["Sodium fire and smoke detection", "Suppression and drain system", "Fire-rated cable barriers"], detailed: true, events: suppEvents, modeledFailures: { "Fire suppression": { failureModes: ["Detection fails", "Suppression fails to actuate"] } } },
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

interface SystemOperationSeed {
  alignments: { name: string; normal: boolean; modeled: boolean; description: string; whyNot?: string }[];
  procedures: string[];
  testMaintenance: string[];
  limits: string[];
}

const SYSTEM_OPERATION: Record<string, SystemOperationSeed> = {
  "SYS-RPS": {
    alignments: [
      { name: "Both divisions in service", normal: true, modeled: true, description: "Either division opens its scram breakers and releases the rods." },
      { name: "One division bypassed for testing", normal: false, modeled: true, description: "The remaining division must trip alone while the other is under surveillance." },
    ],
    procedures: ["Reactor trip response procedure", "Manual scram procedure"],
    testMaintenance: ["Quarterly channel functional test, one division at a time", "Scram breaker trip test and rod release timing at each refueling outage"],
    limits: ["One trip division may be bypassed for no more than 6 hours for testing."],
  },
  "SYS-DRACS": {
    alignments: [
      { name: "All three loops in standby", normal: true, modeled: true, description: "NaK loops filled and the air dampers closed, ready to open on demand." },
      { name: "One loop out of service for maintenance", normal: false, modeled: true, description: "Two loops must still carry the decay heat in the states that need them." },
    ],
    procedures: ["Decay heat removal response procedure", "DRACS damper manual opening procedure"],
    testMaintenance: ["Quarterly air damper stroke test", "Air path and stack inspection each outage"],
    limits: ["One DRACS loop may be out of service for up to 7 days at power."],
  },
  "SYS-PRIMARY": {
    alignments: [
      { name: "Both primary loops on pumped flow", normal: true, modeled: true, description: "Primary pumps running with both check valves open." },
      { name: "Coastdown to natural circulation after a pump trip", normal: false, modeled: true, description: "Both loop flow paths must stay open for buoyancy-driven flow." },
    ],
    procedures: ["Loss of primary flow response procedure"],
    testMaintenance: ["Check valve inspection at each outage", "Pump coastdown test after pump maintenance"],
    limits: ["Both loop flow paths must stay open whenever natural circulation is credited."],
  },
  "SYS-CONF": {
    alignments: [
      { name: "Clean-up train running with isolation dampers open", normal: true, modeled: true, description: "The standby clean-up fan starts if the running fan stops." },
      { name: "Running clean-up fan out of service", normal: false, modeled: true, description: "The standby fan carries the clean-up train alone." },
    ],
    procedures: ["Confinement isolation procedure", "Cover-gas clean-up operating procedure"],
    testMaintenance: ["Quarterly damper closure test", "Clean-up filter test every 18 months"],
    limits: ["The standby clean-up fan must be available whenever the running fan is out of service."],
  },
  "SYS-GUARD": {
    alignments: [
      { name: "Guard vessel dry with leak detection in service", normal: true, modeled: true, description: "The passive shell has no active alignment to change." },
    ],
    procedures: ["Primary sodium leak response procedure"],
    testMaintenance: ["Guard vessel gap and shell inspection at each outage"],
    limits: ["Leak detection must be in service whenever the primary vessel holds sodium."],
  },
  "SYS-1E-DC": {
    alignments: [
      { name: "Chargers carry the buses", normal: true, modeled: true, description: "Batteries float on the chargers and pick up the load on a charger loss." },
      { name: "One charger out of service", normal: false, modeled: true, description: "Its battery carries the bus until the charger returns." },
    ],
    procedures: ["DC bus undervoltage response procedure", "Battery load-shedding procedure"],
    testMaintenance: ["Weekly pilot-cell check", "Battery service test at each outage"],
    limits: ["Each battery must carry the trip and actuation loads for the mission time."],
  },
  "SYS-ACT": {
    alignments: [
      { name: "Four channels in two-out-of-four voting", normal: true, modeled: true, description: "Any two channels generate the trip or isolation signal." },
      { name: "One channel bypassed for testing", normal: false, modeled: true, description: "The logic votes two out of the three remaining channels." },
    ],
    procedures: ["Actuation logic surveillance procedure", "Manual trip and isolation procedure"],
    testMaintenance: ["Quarterly channel functional test", "Software configuration check at each outage"],
    limits: ["Only one channel may be bypassed at a time."],
  },
  "SYS-HVAC": {
    alignments: [
      { name: "One cooling train running, one in standby", normal: true, modeled: true, description: "The standby train starts on high room temperature." },
      { name: "One cooling train out of service", normal: false, modeled: true, description: "The remaining train must hold the room below its limit alone." },
    ],
    procedures: ["Loss of room cooling response procedure"],
    testMaintenance: ["Monthly standby train run", "Chiller maintenance at each outage"],
    limits: ["Safety I&C room temperature must stay below its qualified limit."],
  },
  "SYS-SDHR": {
    alignments: [
      { name: "Intermediate loop in service with the steam side as heat sink", normal: true, modeled: true, description: "The intermediate pump runs and feedwater keeps the steam generators supplied." },
      { name: "Intermediate loop drained for maintenance", normal: false, modeled: false, description: "The loop is unavailable as a heat path.", whyNot: "Draining is allowed only in the cold shutdown states outside this model's scope, where DRACS carries the heat." },
    ],
    procedures: ["Shutdown heat removal through the steam generators procedure"],
    testMaintenance: ["Intermediate pump inspection at each outage", "Loop isolation valve stroke test each quarter"],
    limits: ["Feedwater must be available whenever the intermediate loop is credited."],
  },
  "SYS-ISOL": {
    alignments: [
      { name: "Line isolation valves open with leak detectors in service", normal: true, modeled: true, description: "Detection closes the affected line automatically." },
    ],
    procedures: ["Sodium leak isolation procedure"],
    testMaintenance: ["Quarterly isolation valve stroke test", "Leak detector calibration at each outage"],
    limits: ["A leaking path must be isolated before the sodium level drops below the IHX inlet."],
  },
  "SYS-MAKEUP": {
    alignments: [
      { name: "Make-up pump in standby with the tank filled", normal: true, modeled: true, description: "The fill valve opens when the pump starts." },
    ],
    procedures: ["Sodium make-up procedure"],
    testMaintenance: ["Monthly pump run on recirculation", "Make-up tank level check each shift"],
    limits: ["The make-up tank must hold enough sodium to restore the pool level once."],
  },
  "SYS-DETECT": {
    alignments: [
      { name: "All level probes in service", normal: true, modeled: true, description: "Redundant probes feed the control-room alarm." },
      { name: "One probe bypassed for calibration", normal: false, modeled: true, description: "The remaining probes must detect the falling level." },
    ],
    procedures: ["Low sodium level alarm response procedure"],
    testMaintenance: ["Level probe calibration at each outage", "Monthly alarm annunciation test"],
    limits: ["One level probe may be bypassed for no more than 8 hours."],
  },
  "SYS-SUPP": {
    alignments: [
      { name: "Detection armed and suppression charged", normal: true, modeled: true, description: "Detection starts the suppression and drain system automatically." },
      { name: "Suppression isolated during hot work", normal: false, modeled: false, description: "Automatic discharge is blocked while hot work is under way.", whyNot: "Hot work is barred in the decay-heat-removal areas at power, so the alignment does not occur in the modeled states." },
    ],
    procedures: ["Sodium fire response procedure"],
    testMaintenance: ["Semiannual detector test", "Suppression charge check at each outage"],
    limits: ["Suppression must be charged whenever sodium is in the protected areas."],
  },
};

const SC_CRITERION_IDS = new Set((SC_ANALYSIS.systemSuccessCriteria ?? []).map((criterion) => criterion.uuid));

const MISSION_TIME_REFS: Record<string, string> = { "SYS-PRIMARY": "MT-LOFA", "SYS-SUPP": "MT-FIRE", "SYS-GUARD": "MT-RCB", "SYS-ISOL": "MT-RCB", "SYS-MAKEUP": "MT-RCB", "SYS-DETECT": "MT-RCB" };

const SYSTEM_DIAGRAMS: Record<string, SystemDiagram[]> = {
  "SYS-RPS": [{ uuid: "DGM-SYS-RPS-1", title: "Fig. 6.2. Reactor shutdown system simplified schematic", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 368, region: { x: 0.1628, y: 0.1016, width: 0.7994, height: 0.7496 } }],
  "SYS-DRACS": [{ uuid: "DGM-SYS-DRACS-1", title: "Fig. 3.19. Shutdown cooling system", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 96, region: { x: 0.1038, y: 0.0551, width: 0.7334, height: 0.8359 } }],
  "SYS-PRIMARY": [{ uuid: "DGM-SYS-PRIMARY-1", title: "Fig. 2. EBR-II primary system components and sodium flow paths", documentId: "SY-DOC-04", filename: "Benchmark analysis of EBR-II shutdown heat removal tests", page: 17, region: { x: 0.179, y: 0.259, width: 0.6226, height: 0.5504 } }],
  "SYS-CONF": [{ uuid: "DGM-SYS-CONF-1", title: "Fig. 6.6. Shield cooling system pictorial flow diagram", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 400, region: { x: 0.087, y: 0.1711, width: 0.8944, height: 0.6448 } }],
  "SYS-GUARD": [{ uuid: "DGM-SYS-GUARD-1", title: "Figure 5.2.1.1. EBR-II primary tank vessel", documentId: "SY-DOC-03", filename: "EBR-II shutdown heat removal test benchmark specifications", page: 128, region: { x: 0.1728, y: 0.1285, width: 0.6367, height: 0.484 } }],
  "SYS-1E-DC": [{ uuid: "DGM-SYS-1E-DC-1", title: "Fig. 6.8. Single line electrical diagram, EBR-II electrical power distribution", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 413, region: { x: 0.1638, y: 0.0978, width: 0.65, height: 0.6933 } }],
  "SYS-ACT": [{ uuid: "DGM-SYS-ACT-1", title: "Fig. 6.2. Reactor shutdown system simplified schematic", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 368, region: { x: 0.1628, y: 0.1016, width: 0.7994, height: 0.7496 } }],
  "SYS-SDHR": [{ uuid: "DGM-SYS-SDHR-1", title: "Fig. 3.7. EBR-II systems, simplified", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 75, region: { x: 0.2472, y: 0.0759, width: 0.5963, height: 0.8464 }, rotation: 90 }],
  "SYS-ISOL": [{ uuid: "DGM-SYS-ISOL-1", title: "Fig. 35. Sodium cleanup system flow diagram", documentId: "SY-DOC-01", filename: "EBR-II hazard summary report", page: 174, region: { x: 0.1058, y: 0.1713, width: 0.6684, height: 0.6638 }, rotation: 90 }],
  "SYS-DETECT": [{ uuid: "DGM-SYS-DETECT-1", title: "Fig. 18. EBR-II instrument flow sheet", documentId: "SY-DOC-01", filename: "EBR-II hazard summary report", page: 157, region: { x: 0.0765, y: 0.0207, width: 0.8464, height: 0.8978 }, rotation: 90 }],
  "SYS-SUPP": [{ uuid: "DGM-SYS-SUPP-1", title: "Fig. 10.2. Reactor building operating floor fire detectors", documentId: "SY-DOC-02", filename: "EBR-II level 1 probabilistic risk assessment", page: 692, region: { x: 0.0979, y: 0.057, width: 0.7818, height: 0.803 }, rotation: 90 }],
};

const SYSTEM_FAILURE_MODES: Record<string, { leftOut: string[]; diversion: string[]; conditions: string[] }> = {
  "SYS-RPS": {
    leftOut: [
      "Spurious reactor trip, which shuts the plant down rather than defeating the trip.",
      "Rods released without a trip demand, which adds negative reactivity and helps the function.",
    ],
    diversion: [
      "None. The protection system carries signals and rods, not a process fluid.",
    ],
    conditions: [
      "Protection cabinets above their qualified temperature after a loss of safety I&C room cooling.",
    ],
  },
  "SYS-DRACS": {
    leftOut: [
      "A spurious damper opening, which starts natural circulation early and helps the function.",
    ],
    diversion: [
      "None. Each NaK loop is closed, with no branch line that could divert flow.",
    ],
    conditions: [
      "Outdoor air above the design temperature, which lowers the air-cooler heat removal.",
      "NaK cooled below its freezing margin in a long cold shutdown with the dampers open.",
    ],
  },
  "SYS-PRIMARY": {
    leftOut: [
      "A longer pump coastdown than designed, which adds forced flow and eases the transition to natural circulation.",
    ],
    diversion: [
      "Core bypass flow through the inlet plenum leakage paths, which lowers the flow at the thermal centers. It is part of the thermal-center flow event.",
    ],
    conditions: [
      "Pool stratification after a long pump coastdown, which weakens the buoyancy head.",
    ],
  },
  "SYS-CONF": {
    leftOut: [
      "Premature isolation, which closes the boundary earlier than needed.",
    ],
    diversion: [
      "Leakage through an unisolated penetration, which bypasses the clean-up train. The design leak rate in the success criterion covers it.",
    ],
    conditions: [
      "Sodium aerosol loading the clean-up filters past the fan capacity after a sodium fire.",
    ],
  },
  "SYS-GUARD": {
    leftOut: [
      "Partial leaks that keep the sodium level above the core, bounded by the shell-leak event.",
    ],
    diversion: [
      "None. The guard vessel is a passive shell with no flow path.",
    ],
    conditions: [
      "Guard vessel shell above its design temperature from a large sodium spill held for the mission time.",
    ],
  },
  "SYS-1E-DC": {
    leftOut: [
      "A charger overvoltage trip, which disconnects the charger and leaves the battery carrying the bus.",
    ],
    diversion: [
      "None. The DC system carries electrical power, not a process fluid.",
    ],
    conditions: [
      "Battery room below the minimum electrolyte temperature in winter, which cuts the battery capacity.",
      "Loads added after the load-shedding calculation, which shorten the battery duty below the mission time.",
    ],
  },
  "SYS-ACT": {
    leftOut: [
      "Spurious actuation, which generates the protective signal without a demand.",
    ],
    diversion: [
      "None. The actuation logic carries signals, not a process fluid.",
    ],
    conditions: [
      "Safety I&C room above the qualified temperature after a room-cooling loss, which can fail the logic processors.",
      "Electromagnetic interference from portable radios near open cabinets.",
    ],
  },
  "SYS-HVAC": {
    leftOut: [
      "Room overcooling, which helps the temperature criterion.",
    ],
    diversion: [
      "Chilled water bypassing the air handler coil through a spuriously opened chiller bypass valve. It is screened out under criterion a.",
    ],
    conditions: [
      "Outdoor air above the chiller condenser design temperature, which cuts the chiller capacity.",
    ],
  },
  "SYS-SDHR": {
    leftOut: [
      "Excess intermediate flow, which removes more heat and helps the function.",
    ],
    diversion: [
      "Intermediate sodium drained to the dump tank through a spuriously opened dump valve. It is screened out under criterion a.",
    ],
    conditions: [
      "Feedwater below the sodium freezing margin, which can freeze sodium in the steam-generator tubes.",
    ],
  },
  "SYS-ISOL": {
    leftOut: [
      "Spurious isolation, which closes the boundary without a demand.",
    ],
    diversion: [
      "None. The isolation valves stop a leak rather than carry a flow.",
    ],
    conditions: [
      "Sodium aerosol from the leak coating the leak detectors, which can mask the leak signal.",
    ],
  },
  "SYS-MAKEUP": {
    leftOut: [
      "Overfill, which the level control limits and which does not threaten the criterion.",
    ],
    diversion: [
      "Make-up sodium returned to the tank through a recirculation line valve that transfers open. It is screened out under criterion a.",
    ],
    conditions: [
      "Loss of the fill line trace heating in cold weather, which freezes the sodium in the line.",
    ],
  },
  "SYS-DETECT": {
    leftOut: [
      "Spurious alarm, which prompts an unnecessary but safe operator response.",
    ],
    diversion: [
      "None. The level channels carry signals, not a process fluid.",
    ],
    conditions: [
      "Sodium vapor deposits on the level probes over time, which shift the reading.",
    ],
  },
  "SYS-SUPP": {
    leftOut: [
      "Spurious suppression actuation, a plant nuisance that does not threaten the criterion.",
    ],
    diversion: [
      "None. The drain and suppression paths are dedicated to each cell.",
    ],
    conditions: [
      "A sodium fire burning faster than the design drain rate, which outruns the suppression.",
    ],
  },
};

const systemDefinitions = SYSTEMS.map((s) => ({
  uuid: s.id,
  name: s.name,
  description: s.topEvent,
  boundaries: s.boundaries,
  successCriteriaIds: SC_CRITERION_IDS.has(s.id) ? [s.id] : [],
  successCriterion: s.criterion,
  abbreviation: s.short,
  justificationForExclusionOfComponents: SYSTEM_FAILURE_MODES[s.id]?.leftOut,
  flowDiversionConsiderations: SYSTEM_FAILURE_MODES[s.id]?.diversion,
  functionLossConditions: SYSTEM_FAILURE_MODES[s.id]?.conditions,
  missionTimeHours: s.missionHours,
  ...(MISSION_TIME_REFS[s.id] === undefined ? {} : { missionTimeRef: MISSION_TIME_REFS[s.id] }),
  ...(SYSTEM_DIAGRAMS[s.id] === undefined ? {} : { diagrams: SYSTEM_DIAGRAMS[s.id] }),
  applicablePlantOperatingStates: SYSTEM_POS[s.id] ?? [],
  alignments: (SYSTEM_OPERATION[s.id]?.alignments ?? []).map((alignment, index) => ({
    uuid: `ALN-${s.id}-${index + 1}`,
    name: alignment.name,
    systemReference: s.id,
    isNormalAlignment: alignment.normal,
    description: alignment.description,
    modeled: alignment.modeled,
    justificationIfNotModeled: alignment.whyNot,
    implementsSrs: srs("SY-A7"),
  })),
  operatingProcedures: SYSTEM_OPERATION[s.id]?.procedures,
  testAndMaintenanceProcedures: SYSTEM_OPERATION[s.id]?.testMaintenance,
  operatingLimitations: SYSTEM_OPERATION[s.id]?.limits,
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
          { id: "be-DRC-LP1-FR", type: "BE", name: "Loop 1 fails to maintain natural circulation", be: "DRC-LP1-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "6.9E-3" },
          { id: "be-DRC-DMP1-FO", type: "BE", name: "Loop 1 air damper fails to open", be: "DRC-DMP1-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "2.3E-4" },
          { id: "be-DRC-AIR1-PLG", type: "BE", name: "Loop 1 air path blocked", be: "DRC-AIR1-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "4.8E-4" },
          { id: "be-DRC-LP1-TM", type: "BE", name: "Loop 1 in staggered surveillance", be: "DRC-LP1-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-01", prob: "4.0E-3" },
        ] },
        { id: "DRC-LP2", type: "OR", name: "Loop 2 fails to remove heat", children: [
          { id: "be-DRC-LP2-FR", type: "BE", name: "Loop 2 fails to maintain natural circulation", be: "DRC-LP2-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "6.9E-3" },
          { id: "be-DRC-DMP2-FO", type: "BE", name: "Loop 2 air damper fails to open", be: "DRC-DMP2-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "2.3E-4" },
          { id: "be-DRC-AIR2-PLG", type: "BE", name: "Loop 2 air path blocked", be: "DRC-AIR2-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "4.8E-4" },
          { id: "be-DRC-LP2-TM", type: "BE", name: "Loop 2 in staggered surveillance", be: "DRC-LP2-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-01", prob: "4.0E-3" },
        ] },
        { id: "DRC-LP3", type: "OR", name: "Loop 3 fails to remove heat", children: [
          { id: "be-DRC-LP3-FR", type: "BE", name: "Loop 3 fails to maintain natural circulation", be: "DRC-LP3-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "6.9E-3" },
          { id: "be-DRC-DMP3-FO", type: "BE", name: "Loop 3 air damper fails to open", be: "DRC-DMP3-FO", mode: "FAILURE_TO_START", source: "DA-BE-033", prob: "2.3E-4" },
          { id: "be-DRC-AIR3-PLG", type: "BE", name: "Loop 3 air path blocked", be: "DRC-AIR3-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-035", prob: "4.8E-4" },
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
          { id: "be-RPS-DVA-FS", type: "BE", name: "Division A trip logic fails", be: "RPS-DVA-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "7.6E-4" },
          { id: "be-RPS-BKA-FO", type: "BE", name: "Scram breaker A fails to open", be: "RPS-BKA-FO", mode: "FAILURE_TO_START", source: "DA-BE-009", prob: "4.1E-4" },
          { id: "be-RPS-RODA-FRL", type: "BE", name: "Division A rods fail to release", be: "RPS-RODA-FRL", mode: "FAILURE_TO_START", source: "DA-BE-011", prob: "9.8E-4" },
        ] },
        { id: "RPS-DVB", type: "OR", name: "Division B fails to insert", children: [
          { id: "be-RPS-DVB-FS", type: "BE", name: "Division B trip logic fails", be: "RPS-DVB-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "7.6E-4" },
          { id: "be-RPS-BKB-FO", type: "BE", name: "Scram breaker B fails to open", be: "RPS-BKB-FO", mode: "FAILURE_TO_START", source: "DA-BE-009", prob: "4.1E-4" },
          { id: "be-RPS-RODB-FRL", type: "BE", name: "Division B rods fail to release", be: "RPS-RODB-FRL", mode: "FAILURE_TO_START", source: "DA-BE-011", prob: "9.8E-4" },
        ] },
      ] },
      { id: "be-RPS-CCF-FS", type: "BE", name: "Common cause failure of both divisions", be: "RPS-CCF-FS", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-DIV", prob: "9.0E-5", ccf: true },
      { id: "be-RPS-ROD-CCF", type: "BE", name: "Common cause failure of the rod release", be: "RPS-ROD-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-ROD", prob: "4.0E-5", ccf: true },
      { id: "be-RPS-HFE-CAL", type: "BE", name: "Trip setpoints miscalibrated after surveillance", be: "RPS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-031", prob: "1.1E-3" },
      { id: "tr-RPS-ACT", type: "TR", name: "Actuation logic fails to generate the trip", transfer: "SYS-ACT" },
      { id: "tr-RPS-DC", type: "TR", name: "Loss of Class-1E DC to the trip logic", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-ACT": {
    id: "ACT-TOP", type: "OR", name: "Actuation logic fails to generate the signal",
    children: [
      { id: "ACT-VOTE", type: "KN", k: 3, name: "Three of four voting channels fail", children: [
        { id: "be-ACT-CH1-FS", type: "BE", name: "Voting channel 1 fails", be: "ACT-CH1-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "1.1E-3" },
        { id: "be-ACT-CH2-FS", type: "BE", name: "Voting channel 2 fails", be: "ACT-CH2-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "1.1E-3" },
        { id: "be-ACT-CH3-FS", type: "BE", name: "Voting channel 3 fails", be: "ACT-CH3-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "1.1E-3" },
        { id: "be-ACT-CH4-FS", type: "BE", name: "Voting channel 4 fails", be: "ACT-CH4-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "1.1E-3" },
      ] },
      { id: "ACT-IO", type: "OR", name: "Input or output interfaces fail", children: [
        { id: "ACT-SEN-VOTE", type: "KN", k: 3, name: "Three of four sensor input modules fail", children: [
          { id: "be-ACT-SEN1-FS", type: "BE", name: "Sensor input module 1 fails", be: "ACT-SEN1-FS", mode: "FAILURE_TO_START", source: "DA-BE-082", prob: "2.9E-4" },
          { id: "be-ACT-SEN2-FS", type: "BE", name: "Sensor input module 2 fails", be: "ACT-SEN2-FS", mode: "FAILURE_TO_START", source: "DA-BE-082", prob: "2.9E-4" },
          { id: "be-ACT-SEN3-FS", type: "BE", name: "Sensor input module 3 fails", be: "ACT-SEN3-FS", mode: "FAILURE_TO_START", source: "DA-BE-082", prob: "2.9E-4" },
          { id: "be-ACT-SEN4-FS", type: "BE", name: "Sensor input module 4 fails", be: "ACT-SEN4-FS", mode: "FAILURE_TO_START", source: "DA-BE-082", prob: "2.9E-4" },
        ] },
        { id: "ACT-OUT-VOTE", type: "KN", k: 3, name: "Three of four output actuation modules fail", children: [
          { id: "be-ACT-OUT1-FS", type: "BE", name: "Output actuation module 1 fails", be: "ACT-OUT1-FS", mode: "FAILURE_TO_START", source: "DA-BE-083", prob: "3.3E-3" },
          { id: "be-ACT-OUT2-FS", type: "BE", name: "Output actuation module 2 fails", be: "ACT-OUT2-FS", mode: "FAILURE_TO_START", source: "DA-BE-083", prob: "3.3E-3" },
          { id: "be-ACT-OUT3-FS", type: "BE", name: "Output actuation module 3 fails", be: "ACT-OUT3-FS", mode: "FAILURE_TO_START", source: "DA-BE-083", prob: "3.3E-3" },
          { id: "be-ACT-OUT4-FS", type: "BE", name: "Output actuation module 4 fails", be: "ACT-OUT4-FS", mode: "FAILURE_TO_START", source: "DA-BE-083", prob: "3.3E-3" },
        ] },
      ] },
      { id: "ACT-SW-VOTE", type: "KN", k: 3, name: "Three of four software channels fail", children: [
        { id: "be-ACT-SW1-FS", type: "BE", name: "Actuation software channel 1 fails", be: "ACT-SW1-FS", mode: "FAILURE_TO_START", source: "DA-BE-084", prob: "1.5E-4" },
        { id: "be-ACT-SW2-FS", type: "BE", name: "Actuation software channel 2 fails", be: "ACT-SW2-FS", mode: "FAILURE_TO_START", source: "DA-BE-084", prob: "1.5E-4" },
        { id: "be-ACT-SW3-FS", type: "BE", name: "Actuation software channel 3 fails", be: "ACT-SW3-FS", mode: "FAILURE_TO_START", source: "DA-BE-084", prob: "1.5E-4" },
        { id: "be-ACT-SW4-FS", type: "BE", name: "Actuation software channel 4 fails", be: "ACT-SW4-FS", mode: "FAILURE_TO_START", source: "DA-BE-084", prob: "1.5E-4" },
      ] },
      { id: "tr-ACT-DC", type: "TR", name: "Loss of Class-1E DC power", transfer: "SYS-1E-DC" },
      { id: "tr-ACT-HVAC", type: "TR", name: "Loss of room cooling to the I&C cabinets", transfer: "SYS-HVAC" },
    ],
  },
  "SYS-1E-DC": {
    id: "DC-TOP", type: "OR", name: "Class-1E DC power fails to supply the loads",
    children: [
      { id: "DC-AND", type: "AND", name: "Both battery trains fail", children: [
        { id: "DC-TRA", type: "OR", name: "Train A fails to supply", children: [
          { id: "be-DC-BAT-A-FR", type: "BE", name: "Battery train A fails to run", be: "DC-BAT-A-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "9.7E-6" },
          { id: "be-DC-CHG-A-FLT", type: "BE", name: "Charger A fault discharges the bank", be: "DC-CHG-A-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-073", prob: "4.2E-5" },
          { id: "be-DC-BUS-A-FLT", type: "BE", name: "DC bus A fails", be: "DC-BUS-A-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-075", prob: "1.7E-5" },
          { id: "be-DC-HFE-CHG", type: "BE", name: "Charger left in the wrong mode after maintenance", be: "DC-HFE-CHG", mode: "HUMAN_ERROR", source: "HR-PRE-009", prob: "5.0E-3" },
          { id: "be-DC-BAT-A-TM", type: "BE", name: "Battery train A on equalize charge", be: "DC-BAT-A-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-02", prob: "2.5E-3" },
        ] },
        { id: "DC-TRB", type: "OR", name: "Train B fails to supply", children: [
          { id: "be-DC-BAT-B-FR", type: "BE", name: "Battery train B fails to run", be: "DC-BAT-B-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "9.7E-6" },
          { id: "be-DC-CHG-B-FLT", type: "BE", name: "Charger B fault discharges the bank", be: "DC-CHG-B-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-073", prob: "4.2E-5" },
          { id: "be-DC-BUS-B-FLT", type: "BE", name: "DC bus B fails", be: "DC-BUS-B-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-075", prob: "1.7E-5" },
          { id: "be-DC-BAT-B-TM", type: "BE", name: "Battery train B on equalize charge", be: "DC-BAT-B-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-02", prob: "2.5E-3" },
        ] },
      ] },
      { id: "be-DC-BAT-CCF", type: "BE", name: "Common cause failure of the station batteries", be: "DC-BAT-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DC-BATT", prob: "3.0E-4", ccf: true },
      { id: "be-DC-HFE-BNK", type: "BE", name: "Both battery banks held off float after equalization", be: "DC-HFE-BNK", mode: "HUMAN_ERROR", source: "HR-PRE-041", prob: "2.0E-3" },
      { id: "be-DC-BAT-AB-TM", type: "BE", name: "Both battery banks on one joint equalizing charge", be: "DC-BAT-AB-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-05", prob: "2.5E-3" },
    ],
  },
  "SYS-CONF": {
    id: "CIS-TOP", type: "OR", name: "Confinement fails to isolate or clean up",
    children: [
      { id: "CIS-ISO", type: "OR", name: "Isolation function fails", children: [
        { id: "CIS-DMP-AND", type: "AND", name: "Both series dampers fail to close", children: [
          { id: "CIS-DMP-A", type: "OR", name: "Isolation damper A unavailable", children: [
            { id: "be-CIS-DMP-A-FC", type: "BE", name: "Isolation damper A fails to close", be: "CIS-DMP-A-FC", mode: "FAILURE_TO_START", source: "DA-BE-061", prob: "7.6E-5" },
            { id: "be-CIS-FAN-DMP-TM-A", type: "BE", name: "Clean-up train and isolation damper A out for a filter change", be: "CIS-FAN-DMP-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-04", prob: "2.0E-3" },
          ] },
          { id: "be-CIS-DMP-B-FC", type: "BE", name: "Isolation damper B fails to close", be: "CIS-DMP-B-FC", mode: "FAILURE_TO_START", source: "DA-BE-061", prob: "7.6E-5" },
        ] },
        { id: "be-CIS-DMP-CCF", type: "BE", name: "Common cause failure of the isolation dampers", be: "CIS-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-CIS-DMP", prob: "2.0E-4", ccf: true },
        { id: "tr-CIS-ACT", type: "TR", name: "Isolation signal fails to generate", transfer: "SYS-ACT" },
      ] },
      { id: "CIS-CLN", type: "OR", name: "Clean-up function fails", children: [
        { id: "CIS-CLN-AND", type: "AND", name: "Running and standby trains both unavailable", children: [
          { id: "CIS-RUN", type: "OR", name: "Running train fails", children: [
            { id: "be-CIS-FAN-FR", type: "BE", name: "Running clean-up fan fails to run", be: "CIS-FAN-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-062", prob: "7.7E-5" },
            { id: "be-CIS-IV-FO", type: "BE", name: "Inlet valve fails to open", be: "CIS-IV-FO", mode: "FAILURE_TO_START", source: "DA-BE-063", prob: "3.0E-4" },
            { id: "be-CIS-IDMP-SO", type: "BE", name: "Clean-up train inlet damper closes spuriously", be: "CIS-IDMP-SO", mode: "FAILURE_TO_RUN", source: "DA-BE-065", prob: "3.9E-6" },
            { id: "be-CIS-FAN-DMP-TM-R", type: "BE", name: "Clean-up train and isolation damper A out for a filter change", be: "CIS-FAN-DMP-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-04", prob: "2.0E-3" },
          ] },
          { id: "CIS-STBY", type: "OR", name: "Standby train unavailable", children: [
            { id: "be-CIS-FAN-B-FS", type: "BE", name: "Standby clean-up fan fails to start", be: "CIS-FAN-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-064", prob: "2.8E-4" },
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
          { id: "be-HVC-CHA-FR", type: "BE", name: "Chiller A fails to run", be: "HVC-CHA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.3E-4" },
          { id: "be-HVC-AHA-FR", type: "BE", name: "Air handler A fails to run", be: "HVC-AHA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-052", prob: "6.3E-5" },
        ] },
        { id: "HVC-TRB", type: "OR", name: "Train B fails to cool", children: [
          { id: "be-HVC-CHB-FR", type: "BE", name: "Chiller B fails to run", be: "HVC-CHB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.3E-4" },
          { id: "be-HVC-AHB-FR", type: "BE", name: "Air handler B fails to run", be: "HVC-AHB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-052", prob: "6.3E-5" },
        ] },
      ] },
      { id: "be-HVC-CCF-FR", type: "BE", name: "Common cause failure of both trains", be: "HVC-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-HVAC-CHL", prob: "4.5E-4", ccf: true },
      { id: "be-HVC-TS-FS", type: "BE", name: "Temperature instruments fail to start cooling", be: "HVC-TS-FS", mode: "FAILURE_TO_START", source: "DA-BE-054", prob: "4.3E-4" },
      { id: "tr-HVC-DC", type: "TR", name: "Loss of Class-1E DC to the chillers", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-PRIMARY": {
    id: "PCS-TOP", type: "OR", name: "Primary natural circulation fails to establish",
    children: [
      { id: "PCS-LP1", type: "OR", name: "Loop 1 flow path lost", children: [
        { id: "be-PCS-L1-PLG", type: "BE", name: "Loop 1 flow path blocked", be: "PCS-L1-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-043", prob: "3.8E-4" },
        { id: "be-PCS-CKV1-FO", type: "BE", name: "Loop 1 check valve fails to open", be: "PCS-CKV1-FO", mode: "FAILURE_TO_START", source: "DA-BE-044", prob: "1.1E-5" },
      ] },
      { id: "PCS-LP2", type: "OR", name: "Loop 2 flow path lost", children: [
        { id: "be-PCS-L2-PLG", type: "BE", name: "Loop 2 flow path blocked", be: "PCS-L2-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-043", prob: "3.8E-4" },
        { id: "be-PCS-CKV2-FO", type: "BE", name: "Loop 2 check valve fails to open", be: "PCS-CKV2-FO", mode: "FAILURE_TO_START", source: "DA-BE-044", prob: "1.1E-5" },
      ] },
      { id: "be-PCS-FLOW-CCF", type: "BE", name: "Common cause blockage of both flow paths", be: "PCS-FLOW-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-PCS-FLOW", prob: "8.0E-5", ccf: true },
      { id: "be-PCS-TC-FR", type: "BE", name: "Thermal-center flow degraded below the limit", be: "PCS-TC-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-046", prob: "6.9E-4" },
      { id: "be-PCS-HFE-CAL", type: "BE", name: "Pump trip circuits miscalibrated after surveillance", be: "PCS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-018", prob: "1.5E-3" },
    ],
  },
  "SYS-SDHR": {
    id: "SDR-TOP", type: "OR", name: "Intermediate-loop shutdown heat removal fails",
    children: [
      { id: "be-SDR-PMP-FR", type: "BE", name: "Intermediate sodium pump fails to run", be: "SDR-PMP-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-101", prob: "6.2E-4" },
      { id: "be-SDR-SINK-FR", type: "BE", name: "Steam-side heat sink lost", be: "SDR-SINK-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-103", prob: "1.0E-3" },
      { id: "be-SDR-IV-SO", type: "BE", name: "Loop isolation valve spuriously closes", be: "SDR-IV-SO", mode: "FAILURE_TO_START", source: "DA-BE-105", prob: "3.4E-6" },
      { id: "be-SDR-PMP-TM", type: "BE", name: "Intermediate pump in maintenance", be: "SDR-PMP-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-03", prob: "3.0E-3" },
      { id: "be-SDR-HFE", type: "BE", name: "Operator fails to start backup decay heat removal", be: "SDR-HFE", mode: "HUMAN_ERROR", source: "HR-POST-005", prob: "8.0E-4" },
      { id: "tr-SDR-DC", type: "TR", name: "Loss of Class-1E DC to the pump", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-ISOL": {
    id: "ISO-TOP", type: "OR", name: "Leak detection and isolation fail",
    children: [
      { id: "be-ISO-DET-FS", type: "BE", name: "Leak detection fails to actuate isolation", be: "ISO-DET-FS", mode: "FAILURE_TO_START", source: "DA-BE-107", prob: "8.2E-4" },
      { id: "ISO-VLV", type: "AND", name: "Both isolation valves fail to close", children: [
        { id: "be-ISO-VLV-A-FC", type: "BE", name: "Isolation valve A fails to close", be: "ISO-VLV-A-FC", mode: "FAILURE_TO_START", source: "DA-BE-109", prob: "2.3E-4" },
        { id: "be-ISO-VLV-B-FC", type: "BE", name: "Isolation valve B fails to close", be: "ISO-VLV-B-FC", mode: "FAILURE_TO_START", source: "DA-BE-109", prob: "2.3E-4" },
      ] },
      { id: "be-ISO-VLV-CCF", type: "BE", name: "Common cause failure of the isolation valves", be: "ISO-VLV-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ISOL-VLV", prob: "2.0E-4", ccf: true },
      { id: "be-ISO-HFE", type: "BE", name: "Operator fails to isolate the leak path", be: "ISO-HFE", mode: "HUMAN_ERROR", source: "HR-POST-025", prob: "5.0E-3" },
      { id: "tr-ISO-DC", type: "TR", name: "Loss of Class-1E DC to the isolation valves", transfer: "SYS-1E-DC" },
      { id: "tr-ISO-DET", type: "TR", name: "Loss of the level alarm that cues the isolation", transfer: "SYS-DETECT" },
    ],
  },
  "SYS-MAKEUP": {
    id: "MKU-TOP", type: "OR", name: "Make-up fails to restore the sodium level",
    children: [
      { id: "be-MKU-PMP-FS", type: "BE", name: "Make-up pump fails to start", be: "MKU-PMP-FS", mode: "FAILURE_TO_START", source: "DA-BE-111", prob: "1.2E-3" },
      { id: "be-MKU-VLV-FO", type: "BE", name: "Make-up fill valve fails to open", be: "MKU-VLV-FO", mode: "FAILURE_TO_START", source: "DA-BE-113", prob: "3.4E-4" },
      { id: "be-MKU-TNK-UN", type: "BE", name: "Make-up sodium tank unavailable", be: "MKU-TNK-UN", mode: "FAILURE_TO_RUN", source: "DA-BE-115", prob: "1.4E-5" },
      { id: "be-MKU-HFE", type: "BE", name: "Operator fails to initiate make-up", be: "MKU-HFE", mode: "HUMAN_ERROR", source: "HR-POST-026", prob: "6.0E-3" },
      { id: "tr-MKU-DC", type: "TR", name: "Loss of Class-1E DC to the make-up pump", transfer: "SYS-1E-DC" },
      { id: "tr-MKU-DET", type: "TR", name: "Loss of the level alarm that cues make-up", transfer: "SYS-DETECT" },
    ],
  },
  "SYS-DETECT": {
    id: "DET-TOP", type: "OR", name: "Level detection fails to alarm on a falling level",
    children: [
      { id: "DET-CH", type: "AND", name: "Both level channels fail", children: [
        { id: "be-DET-LVL-A-FS", type: "BE", name: "Level channel A fails", be: "DET-LVL-A-FS", mode: "FAILURE_TO_START", source: "DA-BE-117", prob: "1.6E-3" },
        { id: "be-DET-LVL-B-FS", type: "BE", name: "Level channel B fails", be: "DET-LVL-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-117", prob: "1.6E-3" },
      ] },
      { id: "be-DET-LVL-CCF", type: "BE", name: "Common cause failure of the level channels", be: "DET-LVL-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DET-LVL", prob: "3.0E-4", ccf: true },
      { id: "be-DET-ALM-FS", type: "BE", name: "Level alarm fails to annunciate", be: "DET-ALM-FS", mode: "FAILURE_TO_START", source: "DA-BE-119", prob: "3.6E-4" },
      { id: "tr-DET-DC", type: "TR", name: "Loss of Class-1E DC to the level channels", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-SUPP": {
    id: "SUP-TOP", type: "OR", name: "Fire suppression fails to protect the decay-heat-removal path",
    children: [
      { id: "be-SUP-DET-FS", type: "BE", name: "Sodium fire detection fails", be: "SUP-DET-FS", mode: "FAILURE_TO_START", source: "DA-BE-121", prob: "3.3E-3" },
      { id: "be-SUP-SUP-FS", type: "BE", name: "Suppression and drain system fails to actuate", be: "SUP-SUP-FS", mode: "FAILURE_TO_START", source: "DA-BE-123", prob: "5.3E-3" },
      { id: "be-SUP-HFE", type: "BE", name: "Operator fails to respond to the fire alarm", be: "SUP-HFE", mode: "HUMAN_ERROR", source: "HR-POST-027", prob: "2.0E-2" },
      { id: "tr-SUP-DC", type: "TR", name: "Loss of Class-1E DC to the suppression system", transfer: "SYS-1E-DC" },
    ],
  },
};

function withoutCollapsedCcfEvents(node: LegacySystemFaultTreeNode): LegacySystemFaultTreeNode | null {
  if (node.type === "BE") return node.mode === "COMMON_CAUSE_FAILURE" || node.ccf === true ? null : node;
  if (node.type === "TR") return node;
  const children = node.children.map(withoutCollapsedCcfEvents).filter((child): child is LegacySystemFaultTreeNode => child !== null);
  return children.length === 0 ? null : { ...node, children };
}

const systemLogicModels = SYSTEMS.map((s) => ({
  uuid: `SLM-${s.id}`,
  systemReference: s.id,
  description: s.topEvent,
  modelRepresentation: s.modelRep,
  faultTree: FAULT_TREES[s.id] === undefined ? undefined : withoutCollapsedCcfEvents(FAULT_TREES[s.id]!),
  nonDetailedModelJustification: s.detailed ? undefined : "System-level data sufficient, no internal redundancy.",
  implementsSrs: srs("SY-A7", "SY-A14"),
}));

const allSystemBasicEvents = SYSTEMS.flatMap((s) => s.events);
const collapsedCcfEventIds = new Set(allSystemBasicEvents.filter((event) => event.failureMode === "COMMON_CAUSE_FAILURE").map((event) => event.uuid));
const systemBasicEvents = allSystemBasicEvents.filter((event) => !collapsedCcfEventIds.has(event.uuid));

type SupportKindSeed = "ACTUATION" | "CONTROL" | "MOTIVE_POWER" | "COOLING" | "OPERATOR_INTERFACE" | "OTHER";

interface SupportNeedSeed {
  supporting: string;
  kind: SupportKindSeed;
  details: string;
  impact: string;
  leftOut?: string;
}

const SUPPORT_MATRIX: { system: string; needs: SupportNeedSeed[] }[] = [
  { system: "SYS-RPS", needs: [
    { supporting: "SYS-1E-DC", kind: "CONTROL", details: "Class 1E DC power for the trip logic.", impact: "Both divisions lose their trip logic." },
    { supporting: "SYS-ACT", kind: "ACTUATION", details: "Trip signal from the two-of-four voting logic.", impact: "No trip signal reaches the rod release." },
  ] },
  { system: "SYS-DRACS", needs: [{ supporting: "SYS-1E-DC", kind: "MOTIVE_POWER", details: "DC power to open the air dampers.", impact: "The air dampers stay shut, so no loop starts natural circulation on the air side." }] },
  { system: "SYS-CONF", needs: [
    { supporting: "SYS-1E-DC", kind: "CONTROL", details: "Isolation signal and power for the clean-up train.", impact: "The dampers get no close signal and the clean-up fans stop." },
    { supporting: "SYS-ACT", kind: "ACTUATION", details: "Isolation signal from the voting logic.", impact: "The isolation dampers get no close signal." },
    {
      supporting: "SYS-HVAC",
      kind: "COOLING",
      details: "Room cooling for the confinement isolation equipment.",
      impact: "None within the mission, since the dampers and accumulators need no room cooling.",
      leftOut: "The isolation dampers and their air accumulators sit outside the cooled I&C rooms and need no room cooling. The voting logic that drives them carries its own room-cooling transfer.",
    },
  ] },
  { system: "SYS-ACT", needs: [
    { supporting: "SYS-1E-DC", kind: "CONTROL", details: "DC power for the voting logic and the output modules.", impact: "All four channels lose power, so no trip or isolation signal is generated." },
    { supporting: "SYS-HVAC", kind: "COOLING", details: "Room cooling for the safety I&C cabinets.", impact: "The cabinets pass their temperature limit within the mission, which fails the channels together." },
  ] },
  { system: "SYS-HVAC", needs: [{ supporting: "SYS-1E-DC", kind: "CONTROL", details: "DC control power for the chillers and air handlers.", impact: "Both cooling trains lose their controls and stop." }] },
  { system: "SYS-1E-DC", needs: [{
    supporting: "SYS-HVAC",
    kind: "COOLING",
    details: "Room cooling for the battery rooms.",
    impact: "The battery rooms heat up slowly after a loss of room cooling.",
    leftOut: "The battery rooms stay below their temperature limit for the 24 h mission after a loss of room cooling, per the room heat-up analysis. Leaving this direction out also breaks the loop between DC and HVAC.",
  }] },
  { system: "SYS-SDHR", needs: [
    { supporting: "SYS-1E-DC", kind: "MOTIVE_POWER", details: "DC power for the intermediate pump.", impact: "The intermediate pump stops, so the loop cannot carry decay heat." },
    {
      supporting: "SYS-ACT",
      kind: "ACTUATION",
      details: "Start signal for the intermediate loop.",
      impact: "None, since no automatic start is credited.",
      leftOut: "The operator starts the intermediate loop from the control room. No automatic start signal is credited, so the voting logic is not in the start path.",
    },
  ] },
  { system: "SYS-ISOL", needs: [
    { supporting: "SYS-1E-DC", kind: "MOTIVE_POWER", details: "DC power for the isolation valves.", impact: "The isolation valves cannot close." },
    {
      supporting: "SYS-ACT",
      kind: "ACTUATION",
      details: "Isolation signal for the leak isolation valves.",
      impact: "None, since the valves close on their own local detectors.",
      leftOut: "The leak isolation valves close on their own local leak detectors, which the fault tree carries as a basic event. The voting logic is not in the isolation path.",
    },
    { supporting: "SYS-DETECT", kind: "OPERATOR_INTERFACE", details: "Falling-level alarm that cues the operator to isolate the leak.", impact: "The operator gets no cue, so the manual isolation backup is lost." },
  ] },
  { system: "SYS-MAKEUP", needs: [
    { supporting: "SYS-1E-DC", kind: "MOTIVE_POWER", details: "DC power for the make-up pump.", impact: "The make-up pump cannot start." },
    { supporting: "SYS-DETECT", kind: "OPERATOR_INTERFACE", details: "Falling-level alarm that cues the operator to start make-up.", impact: "The operator gets no cue, so make-up is not started." },
  ] },
  { system: "SYS-DETECT", needs: [{ supporting: "SYS-1E-DC", kind: "CONTROL", details: "DC power for the level channels and the alarm.", impact: "No level signal and no alarm on a falling level." }] },
  { system: "SYS-SUPP", needs: [{ supporting: "SYS-1E-DC", kind: "CONTROL", details: "DC power for sodium fire detection and suppression actuation.", impact: "The fire is not detected and the suppression does not actuate." }] },
];

const systemDependencies = SUPPORT_MATRIX.flatMap((row) =>
  row.needs.map((n) => ({
    uuid: `DEP-${row.system}-${n.supporting}`,
    description: `${row.system} depends on ${n.supporting}`,
    dependentSystem: row.system,
    supportingSystem: n.supporting,
    type: n.kind === "OPERATOR_INTERFACE" ? "HUMAN" : "FUNCTIONAL",
    details: n.details,
    impact: n.impact,
    supportKind: n.kind,
    modeledIn: n.leftOut === undefined ? "SYSTEM_MODEL" : "EXCLUDED",
    ...(n.leftOut === undefined ? {} : { exclusionJustification: n.leftOut }),
    implementsSrs: n.kind === "OPERATOR_INTERFACE" ? srs("SY-B5", "SY-B15") : n.leftOut === undefined ? srs("SY-B5", "SY-B9") : srs("SY-B5", "SY-B13"),
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
  alpha?: Record<string, number>;
  mgl?: { beta: number; gamma?: number };
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
  { id: "CCF-DRACS-LOOP", name: "DRACS natural-circulation loops", scope: "INTRASYSTEM", system: "SYS-DRACS", components: ["DRC-LP1", "DRC-LP2", "DRC-LP3"], events: ["DRC-LP1-FR", "DRC-LP2-FR", "DRC-LP3-FR", "DRC-CCF-FR"], modelType: "MGL", mgl: { beta: 0.020886043269479012, gamma: 0.3964771322620519 }, qt: 0.006915089995696231, shared: { hardwareDesign: true, manufacturer: true, environment: true }, defenses: ["Staggered surveillance across the loops", "Physically separated loop bays"], basis: "Same make, same service conditions and same passive duty across the three loops.", risk: "The KN gate carries the two-of-three full-power criterion, and the group carries the complete common-cause term that fails all three loops together.", daRef: "DA-CCF-12", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DRACS-DMP", name: "DRACS air dampers", scope: "INTRASYSTEM", system: "SYS-DRACS", components: ["DRC-DMP1", "DRC-DMP2", "DRC-DMP3"], events: ["DRC-DMP1-FO", "DRC-DMP2-FO", "DRC-DMP3-FO", "DRC-DMP-CCF"], modelType: "MGL", mgl: { beta: 0.027398885067014593, gamma: 0.3432282003710575 }, qt: 0.00022725551094614045, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Staggered damper surveillance", "Position verification after each test"], basis: "Identical dampers serviced by one crew on one procedure.", risk: "The damper terms dominate the DRACS air path, carried at the air-operated valve factors.", daRef: "DA-CCF-15", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-RPS-DIV", name: "RPS trip divisions", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-DV-A", "RPS-DV-B"], events: ["RPS-DVA-FS", "RPS-DVB-FS", "RPS-CCF-FS"], modelType: "MGL", mgl: { beta: 0.013462465391039222 }, qt: 0.00076103500761035, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Divisional separation", "Trip channels tested on separate schedules"], basis: "Two divisions of identical design and manufacture.", risk: "Risk significant, the divisional term sits directly under the failure-to-scram top gate.", daRef: "DA-CCF-04", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DC-BATT", name: "Class-1E station batteries", scope: "INTERSYSTEM", system: "SYS-1E-DC", components: ["DC-BAT-A", "DC-BAT-B"], events: ["DC-BAT-A-FR", "DC-BAT-B-FR", "DC-BAT-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9857247581155114, alpha2: 0.014275241884488617 }, qt: 9.691598410480782e-06, shared: { manufacturer: true, environment: true, maintenance: true }, defenses: ["Staggered equalize charging", "Train-dedicated chargers"], basis: "Two batteries of one make sharing one room and one maintenance schedule.", risk: "Risk significant, the battery term propagates through every DC-fed protective system.", daRef: "DA-CCF-08", affects: ["SYS-RPS", "SYS-ACT", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-RPS-ROD", name: "Rod-release mechanisms", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-ROD-A", "RPS-ROD-B"], events: ["RPS-RODA-FRL", "RPS-RODB-FRL", "RPS-ROD-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9865375346089608, alpha2: 0.013462465391039222 }, qt: 0.0009845137515645016, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Gravity-driven insertion with no motive power", "Periodic rod-drop timing tests"], basis: "Identical release mechanisms on both divisions.", risk: "Carried at the generic demand factors, the release path is the last mechanical link in the trip chain.", daRef: "DA-CCF-05", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-CIS-DMP", name: "Confinement isolation dampers", scope: "INTRASYSTEM", system: "SYS-CONF", components: ["CIS-DMP-A", "CIS-DMP-B"], events: ["CIS-DMP-A-FC", "CIS-DMP-B-FC", "CIS-DMP-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9787123632853133, alpha2: 0.021287636714686763 }, qt: 7.575183698204681e-05, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Series arrangement, either damper closes the line", "Closure verification after each test"], basis: "Two series dampers of one make on one test procedure.", risk: "The series pair defeats isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-16", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-HVAC-CHL", name: "Safety chillers", scope: "INTRASYSTEM", system: "SYS-HVAC", components: ["HVC-CH-A", "HVC-CH-B"], events: ["HVC-CHA-FR", "HVC-CHB-FR", "HVC-CCF-FR"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9783497527354854, alpha2: 0.02165024726451462 }, qt: 0.0009302954163715795, shared: { hardwareDesign: true, environment: true }, defenses: ["Alternating lead and lag rotation", "Independent refrigerant circuits"], basis: "Identical chillers in one room on one cooling-water header.", risk: "Room heat-up is slow, the group matters through the long I&C mission time.", daRef: "DA-CCF-18", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-PCS-FLOW", name: "Primary loop flow paths", scope: "INTRASYSTEM", system: "SYS-PRIMARY", components: ["PCS-L1", "PCS-L2"], events: ["PCS-L1-PLG", "PCS-L2-PLG", "PCS-FLOW-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9783497527354854, alpha2: 0.02165024726451462 }, qt: 0.00038346708353456405, shared: { environment: true }, defenses: ["Pool cleanliness program", "Inlet screens on both loop suctions"], basis: "Both loop paths share the pool and the same debris sources.", risk: "The single shared debris source in the common pool drives the common term, carried at the generic rate factors.", daRef: "DA-CCF-20", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-SEN", name: "Sensor input modules", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-SEN-A", "ACT-SEN-B", "ACT-SEN-C", "ACT-SEN-D"], events: ["ACT-SEN1-FS", "ACT-SEN2-FS", "ACT-SEN3-FS", "ACT-SEN4-FS"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9805832898351681, alpha2: 0.009684892680069099, alpha3: 0.006201814393530763, alpha4: 0.003530003091231979 }, qt: 0.00028596371520024487, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated calibration", "Input comparison alarms between channels"], basis: "Identical input modules feeding every channel.", risk: "The sensor input events carry the module contribution through their three-of-four voting gate.", daRef: "DA-CCF-22", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-OUT", name: "Output actuation modules", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-OUT-A", "ACT-OUT-B", "ACT-OUT-C", "ACT-OUT-D"], events: ["ACT-OUT1-FS", "ACT-OUT2-FS", "ACT-OUT3-FS", "ACT-OUT4-FS"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9856683273015218, alpha2: 0.00851484907954592, alpha3: 0.004096183558500105, alpha4: 0.0017206400604322363 }, qt: 0.003284993040108412, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated output relays", "Actuation surveillance each operating cycle"], basis: "Identical output modules driving the trip and isolation loads.", risk: "The output actuation events carry the module contribution through their three-of-four voting gate.", daRef: "DA-CCF-23", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-ACT-SW", name: "Actuation logic software", scope: "INTERSYSTEM", system: "SYS-ACT", components: ["ACT-CPU-A", "ACT-CPU-B", "ACT-CPU-C", "ACT-CPU-D"], events: ["ACT-SW1-FS", "ACT-SW2-FS", "ACT-SW3-FS", "ACT-SW4-FS"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0, alpha2: 0, alpha3: 0, alpha4: 1 }, qt: 0.0001516125118545714, shared: { hardwareDesign: true, otherFactors: ["Common software image"] }, defenses: ["Formal software verification and validation", "Hardwired diverse trip path outside the image"], basis: "One software image runs the trip and isolation voting logic.", risk: "An alpha factor of one on the four-channel term makes the software contribution fully dependent across all four channel events.", daRef: "DA-CCF-21", affects: ["SYS-RPS", "SYS-CONF"], srs: ["SY-B2", "SY-B11"] },
  { id: "CCF-ISOL-VLV", name: "Leak isolation valves", scope: "INTRASYSTEM", system: "SYS-ISOL", components: ["ISO-VLV-A", "ISO-VLV-B"], events: ["ISO-VLV-A-FC", "ISO-VLV-B-FC", "ISO-VLV-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9914999083149469, alpha2: 0.00850009168505297 }, qt: 0.00022811696486153864, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Redundant isolation on the line", "Closure verification after each stroke test"], basis: "Two isolation valves of one make on one test procedure.", risk: "The redundant pair loses isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-25", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DET-LVL", name: "Sodium level channels", scope: "INTRASYSTEM", system: "SYS-DETECT", components: ["DET-LVL-A", "DET-LVL-B"], events: ["DET-LVL-A-FS", "DET-LVL-B-FS", "DET-LVL-CCF"], modelType: "ALPHA_FACTOR", alpha: { alpha1: 0.9865375346089608, alpha2: 0.013462465391039222 }, qt: 0.001629460648525338, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated calibration", "Cross-channel comparison"], basis: "Identical level channels feeding the alarm.", risk: "PRAXIS expands the two independent channel events into the dependent combinations during quantification.", daRef: "DA-CCF-27", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
];

const commonCauseFailureGroups = CCF_GROUP_SEEDS.map((g) => ({
  uuid: g.id,
  name: g.name,
  description: g.basis,
  scope: g.scope,
  affectedComponents: g.components,
  affectedSystems: [g.system, ...g.affects],
  modelType: g.modelType,
  modelSpecificParameters: g.mgl !== undefined
    ? { mglParameters: { ...g.mgl, totalFailureProbability: g.qt } }
    : { alphaFactorParameters: { alphaFactors: g.alpha ?? {}, totalFailureProbability: g.qt } },
  dataAnalysisCCFParameterRef: g.daRef,
  members: { basicEvents: g.events.filter((id) => !collapsedCcfEventIds.has(id)).map((id) => ({ id })) },
  groupSelectionBasis: g.basis,
  defenseMechanisms: g.defenses,
  sharedCauseFactors: g.shared,
  riskSignificanceJustification: g.risk,
  implementsSrs: srs(...g.srs),
}));

const humanFailureEventIntegrations = [
  { id: "HFI-RPS-HFE-CAL", event: "RPS-HFE-CAL", system: "SYS-RPS", ref: "HR-PRE-031", type: "PRE_INITIATOR" as const, tm: true, task: "Trip setpoints miscalibrated after surveillance", impact: "Setpoints miscalibrated in both divisions delay or block the trip on demand.", srs: ["SY-A21"] },
  { id: "HFI-DRC-HFE-CAL", event: "DRC-HFE-CAL", system: "SYS-DRACS", ref: "HR-PRE-014", type: "PRE_INITIATOR" as const, tm: true, task: "DRACS channels miscalibrated after surveillance", impact: "Miscalibrated channels delay the damper opening on the loops.", srs: ["SY-A21"] },
  { id: "HFI-DRC-HFE-ALIGN", event: "DRC-HFE-ALIGN", system: "SYS-DRACS", ref: "HR-PRE-022", type: "PRE_INITIATOR" as const, tm: true, task: "Dampers left misaligned after surveillance", impact: "Dampers left misaligned cut the air flow through the affected loops.", srs: ["SY-A21"] },
  { id: "HFI-PCS-HFE-CAL", event: "PCS-HFE-CAL", system: "SYS-PRIMARY", ref: "HR-PRE-018", type: "PRE_INITIATOR" as const, tm: true, task: "Pump trip circuits miscalibrated after surveillance", impact: "Miscalibrated trip circuits delay the pump trip and the start of natural circulation.", srs: ["SY-A21"] },
  { id: "HFI-CIS-HFE-STBY", event: "CIS-HFE-STBY", system: "SYS-CONF", ref: "HR-POST-022", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start the standby clean-up train", impact: "No clean-up flow after the running train stops.", srs: ["SY-A23"] },
  { id: "HFI-DC-HFE-CHG", event: "DC-HFE-CHG", system: "SYS-1E-DC", ref: "HR-PRE-009", type: "PRE_INITIATOR" as const, tm: true, task: "Charger left in the wrong mode after maintenance", impact: "Charger A left in the wrong mode, so bank A discharges instead of floating.", srs: ["SY-A21"] },
  { id: "HFI-DC-HFE-BNK", event: "DC-HFE-BNK", system: "SYS-1E-DC", ref: "HR-PRE-041", type: "PRE_INITIATOR" as const, tm: true, task: "Both battery banks held off float after equalization", impact: "Both banks stay off float after the joint equalization, so neither can carry its bus on a charger loss.", srs: ["SY-A21"] },
  { id: "HFI-SDR-HFE", event: "SDR-HFE", system: "SYS-SDHR", ref: "HR-POST-005", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start backup decay heat removal", impact: "Backup decay heat removal stays off when the intermediate loop is lost.", srs: ["SY-A23"] },
  { id: "HFI-ISO-HFE", event: "ISO-HFE", system: "SYS-ISOL", ref: "HR-POST-025", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to isolate the leak path", impact: "The leak path stays open, so the pool level keeps falling.", srs: ["SY-A23"] },
  { id: "HFI-MKU-HFE", event: "MKU-HFE", system: "SYS-MAKEUP", ref: "HR-POST-026", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to initiate make-up", impact: "No make-up flow, so the pool level keeps falling.", srs: ["SY-A23"] },
  { id: "HFI-SUP-HFE", event: "SUP-HFE", system: "SYS-SUPP", ref: "HR-POST-027", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to respond to the fire alarm", impact: "The fire grows past the cell before the operators respond.", srs: ["SY-A23"] },
].map((h) => ({
  uuid: h.id,
  hfeReference: h.ref,
  basicEventId: h.event,
  system: h.system,
  taskDescription: h.task,
  hfeType: h.type,
  isTestMaintenance: h.tm,
  impact: h.impact,
  implementsSrs: srs(...h.srs),
}));

const componentScreeningJustifications = [
  { id: "SCR-DRACS-1", system: "SYS-DRACS", component: "Loop 1 air damper closes spuriously", crit: "a" as const, basis: "3.9E-6 over 24 h from the industry-average air-operated damper spurious operation rate (AOD-SOP) of 1.61E-7 per hour, against 6.9E-3 for loop 1 failing to maintain natural circulation. The ratio is 1,790, above 100." },
  { id: "SCR-HVAC-1", system: "SYS-HVAC", component: "Train A chiller bypass valve opens spuriously", crit: "a" as const, basis: "6.1E-7 over 24 h from the industry-average motor-operated valve spurious operation rate (MOV-SOP) of 2.54E-8 per hour, against 9.3E-4 for cooling train A failing to run. The ratio is 1,530, above 100." },
  { id: "SCR-SDHR-1", system: "SYS-SDHR", component: "Intermediate loop dump valve opens spuriously", crit: "a" as const, basis: "6.1E-7 over 24 h from the industry-average motor-operated valve spurious operation rate (MOV-SOP) of 2.54E-8 per hour, against 6.2E-4 for the intermediate sodium pump failing to run. The ratio is 1,020, above 100." },
  { id: "SCR-ISOL-1", system: "SYS-ISOL", component: "Isolation valve A small external leakage", crit: "b" as const, basis: "1.4E-6 over 72 h from the industry-average motor-operated valve small external leakage rate (MOV-ELS) of 1.88E-8 per hour, against 2.3E-4 for valve A failing to close. That is 0.59 percent of the component's failures, under 1 percent, and both leave the leak path open." },
  { id: "SCR-MAKEUP-1", system: "SYS-MAKEUP", component: "Recirculation line manual valve transfers open", crit: "a" as const, basis: "1.4E-6 over 72 h from the industry-average manual valve spurious operation rate (XVM-SOP) of 1.88E-8 per hour, against 1.2E-3 for the make-up pump failing to start. The ratio is 868, above 100." },
].map((c) => ({
  uuid: c.id,
  systemReference: c.system,
  componentId: c.component,
  screeningCriterion: c.crit,
  quantitativeJustification: c.basis,
  implementsSrs: srs("SY-A20"),
}));

const supportSystemSuccessCriteria = [
  { id: "SN-1", system: "SYS-1E-DC", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-DRACS", "SYS-CONF", "SYS-ACT", "SYS-HVAC", "SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP"], criterion: "One battery and one bus carry the protective loads for the 24 h mission, with load shedding done within 30 minutes of a charger loss." },
  { id: "SN-2", system: "SYS-ACT", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-CONF"], criterion: "Two of four voting channels generate the trip or isolation signal early enough for the rods to insert within 3 s of the trip demand." },
  { id: "SN-3", system: "SYS-HVAC", type: "CONSERVATIVE" as const, supports: ["SYS-ACT"], criterion: "One cooling train holds the safety I&C room below its temperature limit for the 24 h mission." },
  { id: "SN-4", system: "SYS-DETECT", type: "CONSERVATIVE" as const, supports: ["SYS-ISOL", "SYS-MAKEUP"], criterion: "One of the two level channels and the control-room alarm cue the operator on a falling sodium level." },
].map((n) => ({
  uuid: n.id,
  systemReference: n.system,
  successCriteria: n.criterion,
  criteriaType: n.type,
  supportedSystems: n.supports,
  implementsSrs: srs("SY-B7", "SY-B9"),
}));

const supportSystemNeedAnalyses = [
  { id: "NA-ACT", system: "SYS-ACT", analysis: "Safety I&C room heat-up calculation", conditions: ["One cooling train lost: the other train holds the room below its limit", "Both trains lost: the cabinets pass their limit within the mission, so room cooling is modeled"] },
  { id: "NA-DC", system: "SYS-1E-DC", analysis: "Battery duty and load-shedding calculation", conditions: ["Loss of normal AC with the chargers off", "Load shedding done within 30 minutes of the charger loss", "Battery rooms without cooling for the 24 h mission"] },
  { id: "NA-DRACS", system: "SYS-DRACS", analysis: "DRACS damper support review", conditions: ["The air dampers open on DC motive power", "Natural circulation needs no power once the dampers are open"] },
  { id: "NA-SDHR", system: "SYS-SDHR", analysis: "Intermediate loop start review", conditions: ["Operator start from the control room", "No automatic start signal credited"] },
].map((a) => ({
  uuid: a.id,
  systemReference: a.system,
  analysisReference: a.analysis,
  conditionsRepresented: a.conditions,
  implementsSrs: srs("SY-B6"),
}));

const depletionModels = [
  { id: "INV-1", resource: "Class 1E DC battery", type: "battery" as const, system: "SYS-1E-DC", hours: 4, supports: false, impact: "immediate-failure" as const, basis: "Lasts 4 h at the full protective load. Load shedding within 30 minutes extends the duty to the 24 h mission, and that calculation is under review." },
  { id: "INV-2", resource: "Instrument air accumulators for the isolation dampers", type: "air" as const, system: "SYS-CONF", hours: 72, supports: true, impact: "immediate-failure" as const, basis: "The accumulators hold the dampers closed for 72 h, three times the 24 h mission." },
  { id: "INV-3", resource: "DRACS air heat sink", type: "air" as const, system: "SYS-DRACS", hours: 0, supports: true, impact: undefined, basis: "The atmosphere is the heat sink, so there is no inventory to run out." },
].map((d) => ({
  uuid: d.id,
  resourceType: d.type,
  description: d.resource,
  initialQuantity: d.hours,
  consumptionRate: 1,
  units: "hours",
  associatedSystem: d.system,
  ...(d.impact === undefined ? {} : { depletionImpact: d.impact }),
  missionTimeSupported: d.supports,
  basis: d.basis,
  implementsSrs: srs("SY-B12"),
}));

const digitalInstrumentationAndControl = [
  {
    uuid: "DIC-1",
    name: "Trip and isolation voting logic",
    systemReference: "SYS-ACT",
    description: "Digital voting logic for the trip and isolation functions.",
    methodology: "Channel-level sensor, output and software events voted two of four, with the common software image in CCF-ACT-SW.",
    failureModes: ["Channel hardware failure", "Systematic software fault", "Common software image failure"],
    specialConsiderations: ["Software common cause modeled through CCF-ACT-SW at CC-II."],
    implementsSrs: srs("SY-B11"),
  },
];

const initiationActuationSystems = [
  { id: "IA-RPS", name: "Reactor trip actuation", system: "SYS-RPS", description: "Flux, flow and temperature channels vote two of four in the actuation logic, which releases the rods.", detailed: true, software: "Common software image modeled as CCF-ACT-SW across the four channels." },
  { id: "IA-CONF", name: "Confinement isolation actuation", system: "SYS-CONF", description: "The voting logic closes the series isolation dampers on high activity or a sodium-fire signal.", detailed: true, software: "Same software image as the trip, in CCF-ACT-SW." },
  { id: "IA-SDHR", name: "Backup decay heat removal start", system: "SYS-SDHR", description: "The operator starts the intermediate loop from the control room.", detailed: true, software: "No software in the start path." },
  { id: "IA-ISOL", name: "Leak isolation actuation", system: "SYS-ISOL", description: "Local leak detectors close the isolation valves, with an operator backup cued by the level alarm.", detailed: true, software: "No software in the isolation path." },
].map((a) => ({
  uuid: a.id,
  name: a.name,
  systemReference: a.system,
  description: a.description,
  detailedModeling: a.detailed,
  softwareModelingApproach: a.software,
  implementsSrs: srs("SY-B11"),
}));

const passiveSystemsTreatments = [
  { uuid: "PST-DRACS", name: "DRACS natural circulation", systemReference: "SYS-DRACS", description: "Decay heat removed by buoyancy-driven natural circulation, no active power.", relevantPhysicalPhenomena: ["Natural convection", "Sodium-to-air heat transfer"], uncertaintyEvaluation: "Reliability propagated by direct uncertainty quantification.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-PCS", name: "Primary loop natural circulation", systemReference: "SYS-PRIMARY", description: "Buoyancy-driven flow establishes on a pump trip.", relevantPhysicalPhenomena: ["Buoyancy-driven flow", "Loop thermal centers"], uncertaintyEvaluation: "Establishment timing carried as the sensitive variable.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-GV", name: "Guard vessel", systemReference: "SYS-GUARD", description: "Passive structural barrier that bounds a primary leak.", relevantPhysicalPhenomena: ["Structural retention"], uncertaintyEvaluation: "System-level reliability from structural analysis.", implementsSrs: srs("SY-A9") },
];

const environmentalDesignBasisConsiderations = [
  { id: "SPC-1", system: "SYS-DRACS", components: ["DRC-LP1", "DRC-LP2"], events: ["DRC-LP1-FR", "DRC-LP2-FR"], initiators: ["HZ-FIRE", "IEG-10"], text: "North penetration room. A fire or flood here fails two of the three DRACS loops at once, carried through the environment factor of the loop common cause group.", included: true, beyond: false },
  { id: "SPC-2", system: "SYS-HVAC", components: ["ACT-SEN-A", "ACT-SEN-B", "ACT-SEN-C", "ACT-SEN-D", "ACT-OUT-A", "ACT-OUT-B", "ACT-OUT-C", "ACT-OUT-D"], events: ["ACT-SEN1-FS", "ACT-SEN2-FS", "ACT-SEN3-FS", "ACT-SEN4-FS", "ACT-OUT1-FS", "ACT-OUT2-FS", "ACT-OUT3-FS", "ACT-OUT4-FS"], initiators: ["IEG-02"], text: "Shared safety HVAC. A loss of room cooling heats the safety I&C cabinets in all four channels together, carried as the room-cooling transfer in the actuation fault tree.", included: true, beyond: false },
  { id: "SPC-3", system: "SYS-CONF", components: ["CIS-DMP-A", "CIS-DMP-B"], events: ["CIS-DMP-A-FC", "CIS-DMP-B-FC"], initiators: ["IEG-07", "IEG-09"], text: "Sodium-fire environment. A sodium leak can push the isolation dampers beyond their environmental qualification, so the adverse condition enters as a dependent failure.", included: true, beyond: true },
].map((e) => ({
  uuid: e.id,
  systemReference: e.system,
  components: e.components,
  eventSequences: [],
  environmentalConditions: e.text,
  dependentFailuresIncluded: e.included,
  basicEventIds: e.events,
  initiatingEventIds: e.initiators,
  ...(e.beyond ? { beyondQualification: true } : {}),
  implementsSrs: e.beyond ? srs("SY-B8", "SY-B14") : srs("SY-B8"),
}));

const systemConfirmationRecords = [
  { id: "CR-1", system: "SYS-DRACS", method: "DESIGN_REVIEW" as const, date: "2026-04-30", roles: ["Systems lead", "DRACS designer"], findings: "Model matches the design intent, walkdown deferred to as-built." },
  { id: "CR-2", system: "SYS-RPS", method: "DISCUSSIONS" as const, date: "2026-05-01", roles: ["Systems analyst", "I&C engineer"], findings: "Trip logic and divisions confirmed against the design package." },
  { id: "CR-3", system: "SYS-1E-DC", method: "DESIGN_REVIEW" as const, date: "2026-05-02", roles: ["Electrical engineer", "Systems analyst"], findings: "Bus assignments confirmed, battery duty flagged for INV-1." },
  { id: "CR-4", system: "SYS-ACT", method: "DISCUSSIONS" as const, date: "2026-05-03", roles: ["I&C engineer", "Systems analyst"], findings: "Two-of-four voting confirmed, the software common cause carried per the digital I&C method." },
  { id: "CR-5", system: "SYS-CONF", method: "DESIGN_REVIEW" as const, date: "2026-05-03", roles: ["Mechanical engineer", "Systems analyst"], findings: "Series damper arrangement and the standby clean-up train confirmed against the design package." },
  { id: "CR-6", system: "SYS-HVAC", method: "DESIGN_REVIEW" as const, date: "2026-05-04", roles: ["HVAC engineer", "Systems analyst"], findings: "Lead and lag rotation confirmed, the DC room heat-up window recorded for the logic loop." },
  { id: "CR-7", system: "SYS-PRIMARY", method: "DISCUSSIONS" as const, date: "2026-05-04", roles: ["Thermal-hydraulics analyst", "Systems lead"], findings: "Natural-circulation path and check-valve arrangement confirmed against the coastdown analysis." },
  { id: "CR-8", system: "SYS-GUARD", method: "DESIGN_REVIEW" as const, date: "2026-05-04", roles: ["Structural engineer", "Systems lead"], findings: "Guard-vessel retention confirmed, the bounding leak case documented." },
  { id: "CR-9", system: "SYS-SDHR", method: "DESIGN_REVIEW" as const, date: "2026-05-02", roles: ["Mechanical engineer", "Systems analyst"], findings: "Intermediate pump, loop isolation valve and steam-side heat sink confirmed against the design package, the steam side carried as one train." },
  { id: "CR-10", system: "SYS-ISOL", method: "DESIGN_REVIEW" as const, date: "2026-05-03", roles: ["Mechanical engineer", "I&C engineer"], findings: "Guard-vessel gap leak detectors and the two isolation valves confirmed against the design package." },
  { id: "CR-11", system: "SYS-MAKEUP", method: "DISCUSSIONS" as const, date: "2026-05-03", roles: ["Mechanical engineer", "Systems analyst"], findings: "Make-up pump, fill valve and heated tank confirmed with the designers, the operator start cued by the level alarm." },
  { id: "CR-12", system: "SYS-DETECT", method: "DISCUSSIONS" as const, date: "2026-05-04", roles: ["I&C engineer", "Systems analyst"], findings: "Two induction level channels and the control room alarm confirmed with the instrumentation designers." },
  { id: "CR-13", system: "SYS-SUPP", method: "DESIGN_REVIEW" as const, date: "2026-05-04", roles: ["Fire protection engineer", "Systems analyst"], findings: "Catch pans, drains and inert gas flooding confirmed against the fire protection design, with detection on Class 1E DC." },
].map((c) => ({
  uuid: c.id,
  systemReference: c.system,
  method: c.method,
  date: c.date,
  personnelRoles: c.roles,
  findings: c.findings,
  implementsSrs: srs("SY-A6"),
}));

const modelValidations = [
  { uuid: "LOD-DRACS", name: "Level of detail", systemReference: "SYS-DRACS", description: "Three loops, each with its loop, air damper and air path, with loop surveillance, the loop and damper common cause and the channel and damper errors. Class 1E DC enters by transfer.", techniques: ["Compared with the DRACS design description", "Checked the two-of-three full-power criterion against the model logic"], results: "Loop-level detail matches the sodium test facility data and carries the variable success criteria.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-RPS", name: "Level of detail", systemReference: "SYS-RPS", description: "Each division modeled as its trip logic, scram breaker and rod latch, with the division and rod common cause and the setpoint miscalibration. Actuation logic and Class 1E DC enter by transfer.", techniques: ["Compared with the protection system design description", "Checked each division event against its DA boundary"], results: "Division-level detail surfaces the contributors that matter, the division and rod common cause and the miscalibration.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-ACT", name: "Level of detail", systemReference: "SYS-ACT", description: "Four voting channels, each with its sensor input, output module and software, voted two of four, with common cause for each module type and for the software.", techniques: ["Compared with the digital I&C design description", "Applied the digital I&C method at CC-II"], results: "Module-level detail meets the CC-II software requirement, with the software boundary flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-1E-DC", name: "Level of detail", systemReference: "SYS-1E-DC", description: "Two battery trains, each with its battery, charger and DC bus, with the battery common cause, the equalizing outages and the charger and float errors.", techniques: ["Compared with the electrical power design information", "Checked the charger and battery boundaries against DA"], results: "Train-level detail matches the data except at the charger-to-battery interface.", issuesIdentified: ["Charger-to-battery boundary still under reconciliation with DA (DA-A2)"], implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-CONF", name: "Level of detail", systemReference: "SYS-CONF", description: "Two isolation dampers, the running and standby clean-up fans, and the inlet valve and inlet damper, with the damper common cause, the joint filter change and the operator start. Actuation and Class 1E DC enter by transfer.", techniques: ["Compared with the confinement design information", "Checked the joint outage against the DA coincident maintenance record"], results: "Damper, fan and valve detail matches the data.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-HVAC", name: "Level of detail", systemReference: "SYS-HVAC", description: "Two cooling trains, each with its chiller and air handler, with the train common cause and the temperature channel that starts the standby train. Class 1E DC enters by transfer.", techniques: ["Compared with the room cooling design information"], results: "Component-level detail matches the data.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-PRIMARY", name: "Level of detail", systemReference: "SYS-PRIMARY", description: "Two loop flow paths and check valves and the thermal center, with the flow common cause and the pump trip miscalibration.", techniques: ["Compared with the coastdown and natural-circulation analysis"], results: "Loop-level detail matches the natural-circulation analysis.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-GUARD", name: "Level of detail", systemReference: "SYS-GUARD", description: "A system-level model from the structural analysis. The guard vessel is a passive barrier with no active parts.", techniques: ["Compared with the structural analysis of the bounding leak"], results: "A system-level model is enough because failure is set by the structural retention itself.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-SDHR", name: "Level of detail", systemReference: "SYS-SDHR", description: "The intermediate pump, the steam-side heat sink and the loop isolation valve, with pump maintenance and the operator start. Class 1E DC enters by transfer.", techniques: ["Compared with the intermediate loop design information"], results: "Component-level detail on the sodium side. The steam side stays one event because it is a backup path, with its boundary flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-ISOL", name: "Level of detail", systemReference: "SYS-ISOL", description: "The leak detection channel and two isolation valves, with the valve common cause and the operator isolation. Class 1E DC and the level alarm enter by transfer.", techniques: ["Compared with the leak detection and isolation design information"], results: "Valve-level detail matches the data, with the leak detectors flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-MAKEUP", name: "Level of detail", systemReference: "SYS-MAKEUP", description: "The make-up pump, fill valve and tank, with the operator start. Class 1E DC and the level alarm enter by transfer.", techniques: ["Compared with the make-up design information"], results: "Component-level detail matches the data, with the pump boundary flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-DETECT", name: "Level of detail", systemReference: "SYS-DETECT", description: "Two level channels and the alarm, with the channel common cause. Class 1E DC enters by transfer.", techniques: ["Compared with the level instrumentation design information"], results: "Channel-level detail matches the design, with the probe boundary flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
  { uuid: "LOD-SUPP", name: "Level of detail", systemReference: "SYS-SUPP", description: "The fire detection and the suppression and drain, with the operator response. Class 1E DC enters by transfer.", techniques: ["Compared with the fire protection design"], results: "Function-level detail is enough for a single-train system, with both boundaries flagged under SY-A13.", implementsSrs: srs("SY-A9", "SY-A11") },
];

const componentBoundaryReviews = [
  { uuid: "CBR-DRACS-CB-1", systemReference: "SYS-DRACS", componentBoundaryRef: "CB-1", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-DRACS-CB-2", systemReference: "SYS-DRACS", componentBoundaryRef: "CB-2", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-DRACS-CB-8", systemReference: "SYS-DRACS", componentBoundaryRef: "CB-8", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-RPS-CB-5", systemReference: "SYS-RPS", componentBoundaryRef: "CB-5", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-RPS-CB-6", systemReference: "SYS-RPS", componentBoundaryRef: "CB-6", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-RPS-CB-7", systemReference: "SYS-RPS", componentBoundaryRef: "CB-7", status: "NOT_VERIFIED" as const, note: "The rod data come from pressurized-water reactor rods. The latch release is outside that population, so the boundary cannot be checked until design-specific data exist.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-ACT-CB-18", systemReference: "SYS-ACT", componentBoundaryRef: "CB-18", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-ACT-CB-19", systemReference: "SYS-ACT", componentBoundaryRef: "CB-19", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-ACT-CB-20", systemReference: "SYS-ACT", componentBoundaryRef: "CB-20", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-ACT-CB-21", systemReference: "SYS-ACT", componentBoundaryRef: "CB-21", status: "NOT_VERIFIED" as const, note: "Software has no industry data boundary. The estimate follows the digital I&C method, so the fit is flagged until platform data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-1E-DC-CB-3", systemReference: "SYS-1E-DC", componentBoundaryRef: "CB-3", status: "OPEN" as const, note: "The charger event covers a charger fault that the output breaker fails to isolate from the bank. DA still has the charger-to-battery interface under reconciliation (DA-A2), so the boundary stays open until both sides agree.", implementsSrs: srs("SY-A12") },
  { uuid: "CBR-1E-DC-CB-4", systemReference: "SYS-1E-DC", componentBoundaryRef: "CB-4", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-1E-DC-CB-34", systemReference: "SYS-1E-DC", componentBoundaryRef: "CB-34", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-CONF-CB-15", systemReference: "SYS-CONF", componentBoundaryRef: "CB-15", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-CONF-CB-16", systemReference: "SYS-CONF", componentBoundaryRef: "CB-16", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-CONF-CB-17", systemReference: "SYS-CONF", componentBoundaryRef: "CB-17", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-CONF-CB-35", systemReference: "SYS-CONF", componentBoundaryRef: "CB-35", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-HVAC-CB-12", systemReference: "SYS-HVAC", componentBoundaryRef: "CB-12", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-HVAC-CB-13", systemReference: "SYS-HVAC", componentBoundaryRef: "CB-13", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-HVAC-CB-14", systemReference: "SYS-HVAC", componentBoundaryRef: "CB-14", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-PRIMARY-CB-9", systemReference: "SYS-PRIMARY", componentBoundaryRef: "CB-9", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-PRIMARY-CB-10", systemReference: "SYS-PRIMARY", componentBoundaryRef: "CB-10", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-PRIMARY-CB-11", systemReference: "SYS-PRIMARY", componentBoundaryRef: "CB-11", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-SDHR-CB-22", systemReference: "SYS-SDHR", componentBoundaryRef: "CB-22", status: "NOT_VERIFIED" as const, note: "The pump data come from water service. The sodium pump cooling and seals are outside that population, so the fit is flagged until vendor data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-SDHR-CB-23", systemReference: "SYS-SDHR", componentBoundaryRef: "CB-23", status: "NOT_VERIFIED" as const, note: "No industry boundary covers a whole steam-side train. Flagged until the train is split into components or plant data exist.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-SDHR-CB-24", systemReference: "SYS-SDHR", componentBoundaryRef: "CB-24", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-ISOL-CB-25", systemReference: "SYS-ISOL", componentBoundaryRef: "CB-25", status: "NOT_VERIFIED" as const, note: "Sodium leak detectors have no industry data boundary. Flagged until vendor data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-ISOL-CB-26", systemReference: "SYS-ISOL", componentBoundaryRef: "CB-26", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-MAKEUP-CB-27", systemReference: "SYS-MAKEUP", componentBoundaryRef: "CB-27", status: "NOT_VERIFIED" as const, note: "The pump data come from water service. The sodium pump cooling and seals are outside that population, so the fit is flagged until vendor data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-MAKEUP-CB-28", systemReference: "SYS-MAKEUP", componentBoundaryRef: "CB-28", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-MAKEUP-CB-29", systemReference: "SYS-MAKEUP", componentBoundaryRef: "CB-29", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-DETECT-CB-30", systemReference: "SYS-DETECT", componentBoundaryRef: "CB-30", status: "NOT_VERIFIED" as const, note: "Induction level probes in sodium are outside the industry sensor records. Flagged until vendor data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-DETECT-CB-31", systemReference: "SYS-DETECT", componentBoundaryRef: "CB-31", status: "MATCHES" as const, implementsSrs: srs("SY-A12") },
  { uuid: "CBR-SUPP-CB-32", systemReference: "SYS-SUPP", componentBoundaryRef: "CB-32", status: "NOT_VERIFIED" as const, note: "Sodium fire detectors have no industry data boundary. Flagged until vendor data are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
  { uuid: "CBR-SUPP-CB-33", systemReference: "SYS-SUPP", componentBoundaryRef: "CB-33", status: "NOT_VERIFIED" as const, note: "No industry component matches a sodium fire suppression system. Flagged until test data for the catch pans and flooding are in hand.", implementsSrs: srs("SY-A12", "SY-A13") },
];

const modularizationRecords = [
  { uuid: "MOD-RPS-DIV", moduleId: "Protection division channel", systemReference: "SYS-RPS", representedComponentIds: ["Trip logic channel", "Channel power supply"], basicEventIds: ["RPS-DVA-FS", "RPS-DVB-FS"], avoidsMixedRecoveryPotential: true, avoidsEventsRequiredByOtherSystems: true, justification: "Neither part of a division can be recovered once the trip demand passes, and no other system draws on the division logic. The breakers and rods stay apart because they fail in different ways.", implementsSrs: srs("SY-A14") },
  { uuid: "MOD-DRC-LOOP", moduleId: "DRACS natural-circulation loop", systemReference: "SYS-DRACS", representedComponentIds: ["Loop piping and sodium-to-air heat exchanger", "Loop inlet and outlet welds", "Damper interface flange"], basicEventIds: ["DRC-LP1-FR", "DRC-LP2-FR", "DRC-LP3-FR"], avoidsMixedRecoveryPotential: true, avoidsEventsRequiredByOtherSystems: true, justification: "A loop cannot be recovered once natural circulation fails, and no other system uses the loops. The air dampers and air paths stay apart because they fail in different ways and carry their own data.", implementsSrs: srs("SY-A14") },
  { uuid: "MOD-SDR-SINK", moduleId: "Steam-side heat sink", systemReference: "SYS-SDHR", representedComponentIds: ["Steam generator", "Feedwater supply", "Steam dump to the condenser"], basicEventIds: ["SDR-SINK-FR"], avoidsMixedRecoveryPotential: true, avoidsEventsRequiredByOtherSystems: true, justification: "The steam side is restored as one train, and no other modeled system draws on it. The intermediate pump and the isolation valve stay apart because the sodium side has its own data.", implementsSrs: srs("SY-A14") },
  { uuid: "MOD-SUP-DRAIN", moduleId: "Sodium fire suppression and drain", systemReference: "SYS-SUPP", representedComponentIds: ["Catch pans and drain lines", "Inert gas flooding valves", "Actuation circuit"], basicEventIds: ["SUP-SUP-FS"], avoidsMixedRecoveryPotential: true, avoidsEventsRequiredByOtherSystems: true, justification: "The suppression acts once and cannot be recovered after the fire spreads, and no other system uses it.", implementsSrs: srs("SY-A14") },
];

const nomenclatureDesignators = [
  { uuid: "NOM-SYS-RPS", designator: "RPS", kind: "SYSTEM" as const, meaning: "Reactor protection system", systemReference: "SYS-RPS" },
  { uuid: "NOM-SYS-DRC", designator: "DRC", kind: "SYSTEM" as const, meaning: "Direct reactor auxiliary cooling system", systemReference: "SYS-DRACS" },
  { uuid: "NOM-SYS-PCS", designator: "PCS", kind: "SYSTEM" as const, meaning: "Primary loop natural circulation", systemReference: "SYS-PRIMARY" },
  { uuid: "NOM-SYS-CIS", designator: "CIS", kind: "SYSTEM" as const, meaning: "Confinement isolation and clean-up", systemReference: "SYS-CONF" },
  { uuid: "NOM-SYS-GV", designator: "GV", kind: "SYSTEM" as const, meaning: "Guard vessel", systemReference: "SYS-GUARD" },
  { uuid: "NOM-SYS-DC", designator: "DC", kind: "SYSTEM" as const, meaning: "Class 1E DC power", systemReference: "SYS-1E-DC" },
  { uuid: "NOM-SYS-ACT", designator: "ACT", kind: "SYSTEM" as const, meaning: "Reactor trip and actuation logic", systemReference: "SYS-ACT" },
  { uuid: "NOM-SYS-HVC", designator: "HVC", kind: "SYSTEM" as const, meaning: "Safety I&C room cooling", systemReference: "SYS-HVAC" },
  { uuid: "NOM-SYS-SDR", designator: "SDR", kind: "SYSTEM" as const, meaning: "Intermediate-loop shutdown heat removal", systemReference: "SYS-SDHR" },
  { uuid: "NOM-SYS-ISO", designator: "ISO", kind: "SYSTEM" as const, meaning: "Leak detection and isolation", systemReference: "SYS-ISOL" },
  { uuid: "NOM-SYS-MKU", designator: "MKU", kind: "SYSTEM" as const, meaning: "Sodium make-up", systemReference: "SYS-MAKEUP" },
  { uuid: "NOM-SYS-DET", designator: "DET", kind: "SYSTEM" as const, meaning: "Sodium level detection", systemReference: "SYS-DETECT" },
  { uuid: "NOM-SYS-SUP", designator: "SUP", kind: "SYSTEM" as const, meaning: "Sodium fire detection and suppression", systemReference: "SYS-SUPP" },
  { uuid: "NOM-FM-FS", designator: "FS", kind: "FAILURE_MODE" as const, meaning: "Fails on demand to start, trip or operate", failureModeRefs: ["FM-FTS", "FM-FTT", "FM-FTOP"] },
  { uuid: "NOM-FM-FR", designator: "FR", kind: "FAILURE_MODE" as const, meaning: "Fails to run", failureModeRefs: ["FM-FTR"] },
  { uuid: "NOM-FM-FO", designator: "FO", kind: "FAILURE_MODE" as const, meaning: "Fails to open", failureModeRefs: ["FM-FTO"] },
  { uuid: "NOM-FM-FC", designator: "FC", kind: "FAILURE_MODE" as const, meaning: "Fails to close", failureModeRefs: ["FM-FTC"] },
  { uuid: "NOM-FM-FRL", designator: "FRL", kind: "FAILURE_MODE" as const, meaning: "Fails to release", failureModeRefs: ["FM-FTRL"] },
  { uuid: "NOM-FM-SO", designator: "SO", kind: "FAILURE_MODE" as const, meaning: "Spurious operation", failureModeRefs: ["FM-SO"] },
  { uuid: "NOM-FM-PLG", designator: "PLG", kind: "FAILURE_MODE" as const, meaning: "Plugged, blocked or fouled", failureModeRefs: ["FM-PLG"] },
  { uuid: "NOM-FM-UN", designator: "UN", kind: "FAILURE_MODE" as const, meaning: "Unavailable", failureModeRefs: ["FM-UNAV"] },
  { uuid: "NOM-FM-FLT", designator: "FLT", kind: "FAILURE_MODE" as const, meaning: "Faults in operation", failureModeRefs: ["FM-FLT"] },
  { uuid: "NOM-EV-HFE", designator: "HFE", kind: "EVENT_TYPE" as const, meaning: "Human failure event", eventType: "HUMAN_ERROR" as const },
  { uuid: "NOM-EV-TM", designator: "TM", kind: "EVENT_TYPE" as const, meaning: "Out of service for test or maintenance", eventType: "TEST_MAINTENANCE" as const },
  { uuid: "NOM-EV-CCF", designator: "CCF", kind: "EVENT_TYPE" as const, meaning: "Common cause failure", eventType: "COMMON_CAUSE_FAILURE" as const },
];

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
  { uuid: "SU-CONF-FILTER", systemReference: "SYS-CONF", description: "Filter change on the clean-up train", componentIds: ["CIS-FAN-DMP-TM"], dataAnalysisRef: "DA-UA-04", plannedActivityBasis: "The filter change isolates the clean-up train at damper A, so both are out for the change. Pre-operational assumption from the design maintenance plan, about 18 hours a year at power.", implementsSrs: srs("SY-A27") },
  { uuid: "SU-DC-EQUALIZE", systemReference: "SYS-1E-DC", description: "Joint equalizing charge of both battery banks", componentIds: ["DC-BAT-AB-TM"], dataAnalysisRef: "DA-UA-05", plannedActivityBasis: "The design test plan equalizes both banks in one evolution once a year. The chargers carry the buses meanwhile, so both batteries are unavailable for about 22 hours.", implementsSrs: srs("SY-A27") },
];

const isolationTripConditions = [
  { uuid: "ITC-PRIMARY-1", systemReference: "SYS-PRIMARY", condition: "Primary pump trip on the reactor trip signal, which starts natural circulation.", modeledIn: "EVENT_SEQUENCE" as const, implementsSrs: srs("SY-A24") },
  { uuid: "ITC-CONF-1", systemReference: "SYS-CONF", condition: "Clean-up fan trip on high filter differential pressure, counted in the running fan fails-to-run data.", modeledIn: "SYSTEM_MODEL" as const, implementsSrs: srs("SY-A24") },
  { uuid: "ITC-1E-DC-1", systemReference: "SYS-1E-DC", condition: "Battery output breaker trip on a downstream bus fault, counted in the battery train fails-to-run data.", modeledIn: "SYSTEM_MODEL" as const, implementsSrs: srs("SY-A24") },
  { uuid: "ITC-HVAC-1", systemReference: "SYS-HVAC", condition: "Chiller trip on high condenser pressure, counted in the cooling train fails-to-run data.", modeledIn: "SYSTEM_MODEL" as const, implementsSrs: srs("SY-A24") },
  { uuid: "ITC-SDHR-1", systemReference: "SYS-SDHR", condition: "Intermediate loop isolation on a sodium-water reaction signal in the steam generator.", modeledIn: "EVENT_SEQUENCE" as const, implementsSrs: srs("SY-A24") },
  { uuid: "ITC-MAKEUP-1", systemReference: "SYS-MAKEUP", condition: "Make-up pump trip on low tank level.", modeledIn: "EXCLUDED" as const, exclusionJustification: "The tank holds more than the design make-up volume, so the trip cannot actuate within the mission time.", implementsSrs: srs("SY-A24") },
];

const uncertaintyAnalyses = [
  {
    uuid: "SUA-RPS",
    system: "SYS-RPS",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-RPS-1", description: "No credit is taken for inherent reactivity feedback on a failure to insert the rods.", impact: "Metal fuel feedback could limit power without a trip, so the model overstates the failure-to-trip consequences.", isQuantified: false, treatmentApproach: "Conservative and consistent with the SC criterion." },
      { uncertaintyId: "MU-RPS-2", description: "Rod release uses pressurized-water reactor rod data, flagged under SY-A13.", impact: "Latched rods released by opening a holding circuit could fail more or less often than the industry drives.", isQuantified: false, treatmentApproach: "Carried through the DA distribution until design-specific data exist." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-RPS-1", ccfGroupId: "CCF-RPS-DIV", description: "The division group uses the generic demand factors for the trip logic, with staggered testing.", impact: "Divisions of one design could couple more strongly after a common maintenance error." },
      { uncertaintyId: "CU-RPS-2", ccfGroupId: "CCF-RPS-ROD", description: "The rod release group uses the generic demand factors, since no rod latch template exists.", impact: "Latches of one design in one sodium environment may couple more strongly." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-RPS-1", supportingSystem: "SYS-ACT", description: "Both divisions take their trip signal from the shared actuation logic through one transfer.", impact: "The division redundancy does not extend to the actuation logic, so its common cause sets a floor on RPS failure." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-DRACS",
    system: "SYS-DRACS",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-DRC-1", description: "Two of three loops are needed at full power, from the dynamic campaign (TF-CALC-09).", impact: "A one-of-three criterion would cut the two-of-three loop term, a small part of DRACS failure.", isQuantified: false, treatmentApproach: "Criterion from SC. The damper misalignment, DC and the channel miscalibration dominate DRACS failure." },
      { uncertaintyId: "MU-DRC-2", description: "Loop natural circulation failures come from sodium test facility experience.", impact: "A small facility population gives a wide loop estimate.", isQuantified: false, treatmentApproach: "Carried through the DA distribution." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-DRC-1", ccfGroupId: "CCF-DRACS-LOOP", description: "Loop factors come from the generic rate data for three-member groups, passed as staggered MGL values.", impact: "Coupling between the passive loops sets the two-of-three loop term." },
      { uncertaintyId: "CU-DRC-2", ccfGroupId: "CCF-DRACS-DMP", description: "The damper grouping basis and its air-operated valve factors are open against DA-D8 (SY-B3, B4).", impact: "Stronger damper coupling would fail two or more loops at once." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-DRC-1", description: "Two DRACS loops share the north penetration room, and the fault tree update is open (SY-B8).", impact: "A room hazard could fail two loops together and defeat the two-of-three criterion." },
      { uncertaintyId: "DU-DRC-2", supportingSystem: "SYS-1E-DC", description: "The dampers need Class 1E DC to open, carried as one transfer for all three loops.", impact: "Loss of DC fails every loop, so the DC failure probability adds directly to DRACS failure." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-PRIMARY",
    system: "SYS-PRIMARY",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-PCS-1", description: "Natural circulation is credited from the coastdown analysis, with the thermal-center margin as the sensitive variable.", impact: "A smaller elevation margin would slow or prevent natural circulation.", isQuantified: true, treatmentApproach: "Margin uncertainty is propagated in the passive system analysis (PST-PCS)." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-PCS-1", ccfGroupId: "CCF-PCS-FLOW", description: "Blockage of both flow paths uses the generic rate factors.", impact: "Debris in the pool couples the loops. One shared debris source may couple them more strongly than the generic rate pool." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-CONF",
    system: "SYS-CONF",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-CIS-1", description: "Clean-up filtration is modeled as running or failed, with no credit for degraded efficiency.", impact: "Degraded filtration raises releases without failing the function, which the model does not capture.", isQuantified: false, treatmentApproach: "Outside the SY success criterion and left to the radiological consequence analysis." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-CIS-1", ccfGroupId: "CCF-CIS-DMP", description: "The series isolation dampers use the air-operated valve fail-to-close factors.", impact: "Dampers of one make tested together may couple more strongly than the generic factor." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-CIS-1", description: "Confinement dampers in the sodium-fire environment may operate beyond their qualification (SY-B14).", impact: "A sodium fire could fail both dampers together, which the model does not yet capture." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-GUARD",
    system: "SYS-GUARD",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-GV-1", description: "The guard vessel is modeled at the system level from the structural analysis of the bounding leak.", impact: "A leak larger than the bounding case or a weld flaw could defeat retention.", isQuantified: false, treatmentApproach: "System-level reliability from the structural analysis, not sampled in a fault tree." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-1E-DC",
    system: "SYS-1E-DC",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-DC-1", description: "Battery duty against the 24 hour mission rests on the load-shedding calculation (SY-B12).", impact: "If the batteries fall short, DC is lost late in the mission, which fails the trip logic, the dampers and the actuation.", isQuantified: true, treatmentApproach: "Tested in the battery duty sweep." },
      { uncertaintyId: "MU-DC-2", description: "The charger boundary is still open against DA (SY-A12, DA-A2).", impact: "A charger fault that the output breaker fails to isolate could be counted twice or missed.", isQuantified: false, treatmentApproach: "Resolve with DA before the charger estimate is final." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-DC-1", ccfGroupId: "CCF-DC-BATT", description: "The station batteries use the battery fail-to-operate factors across both trains.", impact: "Batteries of one make on one equalizing practice may couple more strongly." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-DC-1", supportingSystem: "SYS-HVAC", description: "Battery room cooling is left out on the room heat-up calculation, which breaks the DC and HVAC loop.", impact: "If the room heats faster than calculated, battery capacity drops within the mission." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-ACT",
    system: "SYS-ACT",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-ACT-1", description: "Software failure is estimated per the digital I&C method at 1.5E-4 per demand per channel, from expert elicitation EJ-04, flagged under SY-A13.", impact: "No industry data stand behind the software estimate, so its error factor of 7.2 may understate the spread.", isQuantified: false, treatmentApproach: "Carried through the DA distribution, with the software common cause in its own group." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-ACT-1", ccfGroupId: "CCF-ACT-SW", description: "Software common cause is modeled as all four channels failing together, with the CC-II software model open (SY-B11).", impact: "The software group sets the floor on actuation failure." },
      { uncertaintyId: "CU-ACT-2", ccfGroupId: "CCF-ACT-SEN", description: "Sensor input modules use the generic rate alpha factors for four-member groups.", impact: "Modules of one platform may couple more strongly than the industry pool." },
      { uncertaintyId: "CU-ACT-3", ccfGroupId: "CCF-ACT-OUT", description: "Output modules use the generic demand alpha factors for four-member groups.", impact: "Modules of one platform may couple more strongly than the industry pool." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-ACT-1", supportingSystem: "SYS-HVAC", description: "The I&C cabinets need room cooling, carried as a transfer to HVAC.", impact: "If the cabinets tolerate a higher temperature than assumed, the HVAC transfer overstates actuation failure." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-HVAC",
    system: "SYS-HVAC",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-HVC-1", description: "The room heat-up time without cooling comes from the design heat load, with no credit for opening doors.", impact: "Operators could slow the heat-up, so the model overstates the effect of losing room cooling.", isQuantified: false, treatmentApproach: "Conservative." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-HVC-1", ccfGroupId: "CCF-HVAC-CHL", description: "The chillers use the generic rate factors.", impact: "Chillers of one make in one room may couple more strongly than the generic factor." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-SDHR",
    system: "SYS-SDHR",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-SDR-1", description: "The steam-side heat sink is one train-level event, flagged under SY-A13.", impact: "Failures inside the steam train and their support needs are not separated.", isQuantified: false, treatmentApproach: "Split the train into components when the design matures." },
      { uncertaintyId: "MU-SDR-2", description: "The intermediate pump uses water-service pump data, flagged under SY-A13.", impact: "Sodium pump cooling and seals are outside that population.", isQuantified: false, treatmentApproach: "Carried through the DA distribution until vendor data exist." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-ISOL",
    system: "SYS-ISOL",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-ISO-1", description: "Sodium leak detectors in the guard-vessel gap have no industry data, flagged under SY-A13.", impact: "The detectors could fail more or less often than the generic estimate.", isQuantified: false, treatmentApproach: "Carried through the DA distribution until vendor data exist." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-ISO-1", ccfGroupId: "CCF-ISOL-VLV", description: "The isolation valve pair uses the motor-operated valve fail-to-close factors.", impact: "Valves of one make on one stroke-test schedule may couple more strongly than the generic factor." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-ISO-1", supportingSystem: "SYS-DETECT", description: "The operator's cue to isolate comes from the level alarm in the detection system.", impact: "A detection failure removes the cue, so the operator backup is not independent." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-MAKEUP",
    system: "SYS-MAKEUP",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-MKU-1", description: "The make-up tank is modeled as available or unavailable, with the trace heaters inside its boundary.", impact: "A partly frozen tank could still deliver some sodium, so the model overstates make-up failure.", isQuantified: false, treatmentApproach: "Conservative." },
      { uncertaintyId: "MU-MKU-2", description: "The make-up pump uses water-service pump data, flagged under SY-A13.", impact: "Sodium pump cooling and seals are outside that population.", isQuantified: false, treatmentApproach: "Carried through the DA distribution until vendor data exist." },
    ],
    dependencyUncertainties: [
      { uncertaintyId: "DU-MKU-1", supportingSystem: "SYS-DETECT", description: "The operator starts make-up on the level alarm from the detection system.", impact: "A detection failure removes the cue, so the make-up action fails with it." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-DETECT",
    system: "SYS-DETECT",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-DET-1", description: "Induction level probes in sodium have no industry data, flagged under SY-A13.", impact: "The probes could fail more or less often than the generic estimate.", isQuantified: false, treatmentApproach: "Carried through the DA distribution until vendor data exist." },
    ],
    ccfUncertainties: [
      { uncertaintyId: "CU-DET-1", ccfGroupId: "CCF-DET-LVL", description: "The two level channels use the generic demand factors and share one calibration practice.", impact: "A shared calibration error couples the channels beyond the generic factor." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
  {
    uuid: "SUA-SUPP",
    system: "SYS-SUPP",
    propagationMethod: "MONTE_CARLO" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-SUP-1", description: "Sodium fire detection and suppression have no industry data, flagged under SY-A13.", impact: "The estimates could be far from the real performance of the catch pans and the inert gas flooding.", isQuantified: false, treatmentApproach: "Carried through the DA distributions until test data exist." },
    ],
    parameterUncertainties: [],
    implementsSrs: srs("SY-A32", "SY-B16"),
  },
];

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "DRACS loop coupling sweep", description: "Three-loop alpha 3 set to the 5th and 95th percentiles of the generic rate distribution (INL/EXT-21-62940 Rev. 1), with alpha 2 at its mean and alpha 1 taking the rest, passed as staggered MGL values.", variedParameters: ["Alpha 3"], parameterRanges: { "Alpha 3": [0.00489, 0.0124] }, results: "DRACS failure moves from 1.740E-2 to 1.745E-2, against 1.742E-2 at the means, a change under half a percent. The two-of-three loop term runs from 5.63E-4 to 6.12E-4.", insights: "The damper misalignment, DC and the channel miscalibration dominate DRACS failure, so loop coupling is not a key source.", modelUncertaintyId: "CU-DRC-1", implementsSrs: srs("SY-A32") },
  { uuid: "SS-2", name: "Battery duty sweep", description: "Battery duty against the mission time.", variedParameters: ["Duty hours"], parameterRanges: { "Duty hours": [4, 24] }, results: "Load shedding meets 24 h in the base case. The slowest case is still open under SY-B12.", insights: "The load-shedding calculation decides whether DC holds for the mission.", modelUncertaintyId: "MU-DC-1", implementsSrs: srs("SY-A32") },
];

const preOperationalAssumptions = [
  { id: "PA-1", area: "System models", desc: "Models from the design package, to confirm by walkdown when as-built.", risk: ImportanceLevel.MEDIUM, srs: ["SY-A33"], paths: ["systemLogicModels"] },
  { id: "PA-2", area: "Maintenance unavailability", desc: "Assumed durations until as-operated maintenance data exists.", risk: ImportanceLevel.LOW, srs: ["SY-A26"], paths: ["simultaneousUnavailabilityEvents"] },
  { id: "PA-3", area: "Dependency modeling", desc: "Support needs from design analysis, to re-check against operation.", risk: ImportanceLevel.MEDIUM, srs: ["SY-B17"], paths: ["systemDependencies"] },
  { id: "PA-4", area: "Documentation", desc: "Systems taken free of design and construction errors, to verify as-built.", risk: ImportanceLevel.LOW, srs: ["SY-C3"], paths: ["documentation"] },
  { id: "PA-5", area: "Dependency modeling", desc: "The two HVAC trains are taken as fed from separate DC divisions, pending the as-built electrical design.", risk: ImportanceLevel.MEDIUM, srs: ["SY-B10", "SY-B17"], paths: ["SYS-HVAC", "SYS-1E-DC"] },
  { id: "PA-6", area: "Dependency modeling", desc: "The three DRACS loops are taken as independent apart from the north penetration room and their common cause group.", risk: ImportanceLevel.MEDIUM, srs: ["SY-B10"], paths: ["SYS-DRACS"] },
  { id: "PA-7", area: "Dependency modeling", desc: "The four actuation channels are taken as independent apart from the shared room cooling and the common software image.", risk: ImportanceLevel.MEDIUM, srs: ["SY-B10"], paths: ["SYS-ACT"] },
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
  { uuid: "VSC-DRACS-FP", systemReference: "SYS-DRACS", plantOperatingStateId: "POS-01", scenarioCondition: "Full power", successCriteriaIds: ["SYS-DRACS"], basis: "Two of three DRACS loops remove decay heat. The full-power decay curve loses the single-loop race and two loops cross it at 4.3 h. Verified by a 41-probe dynamic campaign, capacity frontier 2.38 to 2.41 MW (TF-CALC-09).", implementsSrs: srs("SY-A5", "SY-B5") },
  { uuid: "VSC-DRACS-OTHER", systemReference: "SYS-DRACS", scenarioCondition: "Operating states other than full power (POS-02 to POS-09)", successCriteriaIds: ["SYS-DRACS"], basis: "One of three DRACS loops removes decay heat for the sequence mission time, since the lower decay load sits within a single loop capability.", implementsSrs: srs("SY-A5", "SY-B5") },
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
      { uuid: "syc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-02T09:14:00.000Z", associatedSr: "SY-B3", text: "The DRACS damper group rests on a shared crew and shared make, so SY-B3 needs the grouping basis closed against the DA-D8 parameter set before the alpha factors are final.", severity: "MAJOR", resolved: false },
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
  modelValidations,
  componentBoundaryReviews,
  modularizationRecords,
  nomenclatureDesignators,
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
    description: "Every system is checked against every other system for control power, motive power, actuation signals, cooling and operator cues. Each need found is traced to a transfer in the fault trees or left out with an engineering reason, and the DC and HVAC loop is broken the same way.",
    reference: "NUREG-1860 dependency search approach for new designs",
    dependencyTables: [{ tableId: "DEP-MATRIX", description: "Support-system dependency matrix" }],
    systemsAnalyzed: SYSTEMS.map((s) => s.id),
    implementsSrs: srs("SY-B5", "SY-B6"),
  },
  commonCauseFailureGroups,
  supportSystemNeedAnalyses,
  supportSystemSuccessCriteria,
  humanFailureEventIntegrations,
  exampleDocuments: [
    { id: "SY-DOC-01", name: "EBR-II hazard summary report", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-5719", extracted: "Plant, primary and secondary sodium systems, shutdown coolers, instrumentation and safety systems", linked: 2, url: "/api/example-documents/sy/sfr-hazard" },
    { id: "SY-DOC-02", name: "EBR-II level 1 probabilistic risk assessment", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-NSE-2", extracted: "System models, support dependencies and the event and fault trees behind the PRA", linked: 7, url: "/api/example-documents/sy/sfr-pra" },
    { id: "SY-DOC-03", name: "EBR-II shutdown heat removal test benchmark specifications", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-ARC-226", extracted: "Primary and intermediate loop geometry, pumps and natural circulation paths", linked: 1, url: "/api/example-documents/sy/sfr-benchmark" },
    { id: "SY-DOC-04", name: "Benchmark analysis of EBR-II shutdown heat removal tests", kind: "doc", sizeLabel: "IAEA", uploadedLabel: "IAEA-TECDOC-1819", extracted: "Loss-of-flow test conditions and primary system behavior", linked: 1, url: "/api/example-documents/sy/sfr-shrt-analysis" },
    { id: "SY-DOC-05", name: "EBR-II inherent safety demonstration tests", kind: "doc", sizeLabel: "ANL", uploadedLabel: "CONF-850410-6", extracted: "Unprotected loss-of-flow and loss-of-heat-sink demonstrations", linked: 0, url: "/api/example-documents/sy/sfr-inherent" },
    { id: "SY-DOC-06", name: "Component failure data", kind: "sheet", sizeLabel: "NRC", uploadedLabel: "NUREG/CR-6928", extracted: "Basic-event failure rates for the modeled components", linked: 6 },
    { id: "SY-DOC-07", name: "Common-cause failure parameter estimates", kind: "sheet", sizeLabel: "INL", uploadedLabel: "INL/EXT-21-62940 Rev. 1", extracted: "Generic alpha factors for demand and rate failures in common cause groups of two to eight", linked: 3 },
  ],
  simultaneousUnavailabilityEvents,
  isolationTripConditions,
  componentScreeningJustifications,
  environmentalDesignBasisConsiderations,
  initiationActuationSystems,
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
      { source: "Industry component data from light-water reactors applied to sodium-service pumps, valves and instruments", impact: "These estimates may not reflect sodium service, which shifts the heat removal, isolation, make-up and detection results.", applicableElements: ["SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP", "SYS-PRIMARY"] },
      { source: "Generic common cause factors from light-water reactor experience", impact: "Coupling in sodium-service and passive groups may differ, which shifts every redundant system.", applicableElements: ["SYS-RPS", "SYS-DRACS", "SYS-PRIMARY", "SYS-CONF", "SYS-1E-DC", "SYS-ACT", "SYS-HVAC", "SYS-ISOL", "SYS-DETECT"] },
      { source: "Design information in place of the as-built plant", impact: "Models, boundaries and support needs may change at the as-built confirmation (SY-A6).", applicableElements: ["SYS-RPS", "SYS-DRACS", "SYS-PRIMARY", "SYS-CONF", "SYS-GUARD", "SYS-1E-DC", "SYS-ACT", "SYS-HVAC", "SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP"] },
    ],
    relatedAssumptions: [
      { assumption: "No repair of failed equipment is credited within the mission time (SY-A31).", basis: "No plant repair data exist before operation.", applicableElements: ["SYS-RPS", "SYS-DRACS", "SYS-PRIMARY", "SYS-CONF", "SYS-GUARD", "SYS-1E-DC", "SYS-ACT", "SYS-HVAC", "SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP"] },
      { assumption: "Each support system enters a fault tree through one transfer to its top event.", basis: "Train assignments of the support buses are not final in the design package.", applicableElements: ["SYS-RPS", "SYS-DRACS", "SYS-CONF", "SYS-ACT", "SYS-HVAC", "SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP"] },
      { assumption: "Mission times come from the SC workbook for each sequence family, with 72 hours for the guard vessel.", basis: "SC mission times per sequence family.", applicableElements: ["SYS-DRACS", "SYS-PRIMARY", "SYS-GUARD", "SYS-1E-DC", "SYS-HVAC", "SYS-SDHR"] },
    ],
    reasonableAlternatives: [
      { alternative: "Technology-specific data from sodium facilities for all sodium-service components", reasonNotSelected: "The facility records cover only the DRACS loops, air paths, flow paths and thermal center, so the other sodium components use industry data.", applicableElements: ["SYS-SDHR", "SYS-ISOL", "SYS-MAKEUP", "SYS-DETECT", "SYS-SUPP"] },
      { alternative: "Train-level transfers to the support systems", reasonNotSelected: "The bus and train assignments are not final, so system-level transfers stand until the as-built single-line diagrams exist.", applicableElements: ["SYS-RPS", "SYS-DRACS", "SYS-CONF", "SYS-ACT", "SYS-ISOL", "SYS-DETECT"] },
    ],
    requirementReference: "SY-A32, SY-B16, SY-C2",
  },
  preOperationalAssumptions,
  documentation: {
    processDescription: "Systems analysis built one system logic model at a time from the Event Sequence safety functions, with common cause groups, dependencies and human failure events placed in the models, per ASME/ANS RA-S-1.4 HLR-SY-A through C.",
    systemFunctionsAndBoundaries: "Eight systems modeled, each with a top event, a success criterion and a stated model boundary including the support interfaces.",
    systemSchematicsReferenced: "System design descriptions and P&IDs referenced for each modeled system.",
    modeledComponentsAndFailureModes: "Components and failure modes that defeat the system success criteria are included, with beneficial failures left out unless their omission distorts the result.",
    screeningAndExclusionJustifications: "Five components screened from detailed analysis, each against a stated screening criterion.",
    successCriteriaRelationship: "Each system top event is set by a success criterion from Success Criteria Development.",
    alignmentsAndConfigurations: "Normal and significant alternate alignments modeled per system.",
    testAndMaintenanceTreatment: "Out-of-service unavailability modeled per the maintenance plan, with simultaneous planned unavailability of redundant equipment carried explicitly.",
    dependencySearchAndTables: "Support-system dependencies set by engineering analysis in a dependency matrix, with a support-on-support loop resolved explicitly.",
    ccfGroupsAndModels: "Thirteen common cause groups, nine within a system and four across systems, consistent with the Data Analysis common cause model.",
    humanFailureEventsIncluded: "Pre-initiator and post-initiator human failure events placed in the system models and handed to Human Reliability.",
    modularizationAndLogicLoops: "Supercomponents stand for the protection division channels, the DRACS loops, the steam-side heat sink and the fire suppression, each with one recovery potential and no use by another system. One support-on-support logic loop resolved by crediting the battery for the cooling restart window.",
    nomenclatureConventions: "Event codes read system, component and failure mode, such as RPS-DVA-FS. Each system has one code and each failure mode one designator, so the same failure carries the same designator in every system and train and the quantifier links the trees.",
    digitalICTreatment: "Digital actuation logic modeled per the Part II Subpart 2.7 method, with software common cause modeled at CC-II.",
    passiveSystemsTreatment: "Passive functions treated with mechanistic models and direct uncertainty propagation for functional reliability.",
    evaluationResultsSummary: "Each system fault tree quantified standalone, with the full-plant quantification performed by Event Sequence Quantification.",
    informationSources: "Design descriptions, failure mode analyses, the common cause parameter dossier and the surveillance plan.",
    modelUncertaintySources: "Model uncertainty sources are recorded per system and across the plant, among them the feedback credit, the loop and damper coupling, the battery duty and the actuation software.",
    asBuiltLimitations: "Pre-operational: system models, dependencies and unavailability rest on design information pending as-built and as-operated confirmation.",
    praTaskInterfaces: "Interfaces with Event Sequence Analysis and Success Criteria for what to model, with Data Analysis for parameters, with Human Reliability for human events, and with Event Sequence Quantification which links the trees.",
    implementsSrs: srs("SY-C1"),
  },
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-072", "NM-055", "NM-061"],
});

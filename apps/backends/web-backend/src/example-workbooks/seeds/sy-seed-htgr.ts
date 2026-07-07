import { type SystemsAnalysis, type SystemBasicEvent, type SystemFaultTreeNode } from "interfaces-mef-types/sy/systems-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { DistributionType } from "interfaces-mef-types/core/events";
import { SY_SR_CATALOG } from "interfaces-mef-types/sy/systems-analysis";

const NOW = "2026-05-04T12:00:00.000Z";
const CREATED = "2026-04-22T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["SY-B3", "SY-B4", "SY-B8", "SY-B11", "SY-B12", "SY-B14"]);

const SR_EVIDENCE: Record<string, string> = {
  "SY-A1": "Twelve systems identified from the Event Sequence safety functions.",
  "SY-A8": "Model boundaries set to include the components and the support interfaces.",
  "SY-A9": "Cavity cooling modeled from its duct groups, the rest in detail.",
  "SY-A20": "Four components screened, each against a stated criterion.",
  "SY-A30": "One designator per component failure mode across every system and train.",
  "SY-B1": "Common cause modeled within each redundant system.",
  "SY-B2": "Two inter-system common cause groups modeled, batteries and diesels.",
  "SY-B3": "RCCS duct grouping basis open against the DA-D8 parameter set.",
  "SY-B4": "RCCS duct common cause parameters pending DA-D8.",
  "SY-B8": "Two RCCS duct groups share the cavity riser, fault tree update open.",
  "SY-B11": "Protection software common cause modeling open at CC-II.",
  "SY-B12": "Battery depletion against the 24 hour mission open.",
  "SY-B14": "Building dampers in the depressurization environment open.",
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
    name,
    eventType: "BASIC",
    componentReference,
    failureMode,
    probability,
    repairModeled: false,
    dataAnalysisBasicEventRef: probability > 0 ? "DA-BE" : undefined,
    implementsSrs: srs("SY-A19", "SY-A30"),
  };
}

function hfe(uuid: string, name: string, probability: number, hfeRef: string): SystemBasicEvent {
  return {
    uuid,
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

const rpsEvents: SystemBasicEvent[] = [
  be("RPS-DVA-FS", "Division A fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-DVB-FS", "Division B fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-RODA-FR", "Division A control rods fail to insert", "FAILURE_TO_START", 0.0008),
  be("RPS-RODB-FR", "Division B control rods fail to insert", "FAILURE_TO_START", 0.0008),
  be("RPS-CCF-FS", "Common cause failure of both divisions", "COMMON_CAUSE_FAILURE", 0.00009),
  be("RPS-ROD-CCF", "Common cause failure of the rod insertion", "COMMON_CAUSE_FAILURE", 0.00004),
  hfe("RPS-HFE-CAL", "Protection setpoints miscalibrated after surveillance", 0.0011, "HR-PRE-031"),
];
const scsEvents: SystemBasicEvent[] = [
  be("SCS-TRA-FR", "Shutdown-cooling train A circulator fails to run", "FAILURE_TO_RUN", 0.008),
  be("SCS-TRB-FR", "Shutdown-cooling train B circulator fails to run", "FAILURE_TO_RUN", 0.008),
  be("SCS-HXA-PLG", "Train A shutdown cooler fouled", "FAILURE_TO_RUN", 0.002),
  be("SCS-HXB-PLG", "Train B shutdown cooler fouled", "FAILURE_TO_RUN", 0.002),
  be("SCS-CCF-FR", "Common cause failure of both trains", "COMMON_CAUSE_FAILURE", 0.0004),
  hfe("SCS-HFE", "Operator fails to start the second shutdown-cooling train", 0.0015, "HR-POST-018"),
  tm("SCS-TR-TM", "One shutdown-cooling train in maintenance", 0.004, "Staggered train testing per the design surveillance plan, one train stays available.", true),
];
const rccsEvents: SystemBasicEvent[] = [
  be("RCC-DUCT1-BLK", "Duct group 1 air path blocked", "FAILURE_TO_RUN", 0.002),
  be("RCC-DUCT2-BLK", "Duct group 2 air path blocked", "FAILURE_TO_RUN", 0.002),
  be("RCC-DUCT3-BLK", "Duct group 3 air path blocked", "FAILURE_TO_RUN", 0.002),
  be("RCC-DUCT4-BLK", "Duct group 4 air path blocked", "FAILURE_TO_RUN", 0.002),
  be("RCC-CCF-BLK", "Common cause blockage of the duct groups", "COMMON_CAUSE_FAILURE", 0.0002),
  be("RCC-STK-BLK", "Common exhaust stack blocked", "FAILURE_TO_RUN", 0.001),
  hfe("RCC-HFE-DMP", "Cavity-cooling duct dampers left misaligned after surveillance", 0.0015, "HR-PRE-018"),
];
const sgisoEvents: SystemBasicEvent[] = [
  be("SGI-IVA-FC", "Loop A steam and feedwater isolation fails to close", "FAILURE_TO_START", 0.002),
  be("SGI-IVB-FC", "Loop B steam and feedwater isolation fails to close", "FAILURE_TO_START", 0.002),
  be("SGI-DMP-FO", "Steam-generator dump valve fails to open", "FAILURE_TO_START", 0.0015),
  be("SGI-IV-CCF", "Common cause failure of the isolation valves", "COMMON_CAUSE_FAILURE", 0.00016),
  hfe("SGI-HFE", "Operator fails to isolate the affected steam generator", 0.0045, "HR-POST-022"),
];
const hpbiEvents: SystemBasicEvent[] = [
  be("HPI-VA-FC", "Segment isolation valve A fails to close", "FAILURE_TO_START", 0.002),
  be("HPI-VB-FC", "Segment isolation valve B fails to close", "FAILURE_TO_START", 0.002),
  be("HPI-VLV-CCF", "Common cause failure of the isolation valves", "COMMON_CAUSE_FAILURE", 0.0002),
  be("HPI-DET-FA", "Leak detection fails to actuate isolation", "FAILURE_TO_START", 0.002),
  hfe("HPI-HFE", "Operator fails to isolate the leaking helium segment", 0.005, "HR-POST-025"),
];
const detectEvents: SystemBasicEvent[] = [
  be("DET-PCH-A-FS", "Primary pressure channel A fails", "FAILURE_TO_START", 0.003),
  be("DET-PCH-B-FS", "Primary pressure channel B fails", "FAILURE_TO_START", 0.003),
  be("DET-PCH-CCF", "Common cause failure of the pressure channels", "COMMON_CAUSE_FAILURE", 0.0003),
  be("DET-ALM-FS", "Depressurization alarm fails to annunciate", "FAILURE_TO_START", 0.001),
];
const hicEvents: SystemBasicEvent[] = [
  be("HIC-CMP-FS", "Helium make-up compressor fails to start", "FAILURE_TO_START", 0.004),
  be("HIC-VLV-FO", "Pressure-control valve fails to open", "FAILURE_TO_START", 0.0015),
  be("HIC-STG-UN", "Helium storage unavailable", "FAILURE_TO_RUN", 0.001),
  hfe("HIC-HFE", "Operator fails to initiate helium make-up", 0.006, "HR-POST-026"),
];
const rbEvents: SystemBasicEvent[] = [
  be("RB-DMP-A-FC", "Building isolation damper A fails to close", "FAILURE_TO_START", 0.0025),
  be("RB-DMP-B-FC", "Building isolation damper B fails to close", "FAILURE_TO_START", 0.0025),
  be("RB-DMP-CCF", "Common cause failure of the isolation dampers", "COMMON_CAUSE_FAILURE", 0.0002),
  be("RB-FLT-FR", "Running filtration train fails to run", "FAILURE_TO_RUN", 0.006),
  be("RB-FLT-B-FS", "Standby filtration train fails to start", "FAILURE_TO_START", 0.003),
  hfe("RB-HFE", "Operator fails to start the standby filtration train", 0.015, "HR-POST-028"),
];
const acEvents: SystemBasicEvent[] = [
  be("AC-DGA-FS", "Class 1E diesel A fails to start", "FAILURE_TO_START", 0.02),
  be("AC-DGB-FS", "Class 1E diesel B fails to start", "FAILURE_TO_START", 0.02),
  be("AC-DGA-FR", "Class 1E diesel A fails to run", "FAILURE_TO_RUN", 0.008),
  be("AC-DGB-FR", "Class 1E diesel B fails to run", "FAILURE_TO_RUN", 0.008),
  be("AC-DG-CCF", "Common cause failure of the diesels", "COMMON_CAUSE_FAILURE", 0.001),
  tm("AC-DG-TM", "One diesel in maintenance", 0.005, "Staggered diesel maintenance per the design test plan, one division stays available.", true),
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
const ccwEvents: SystemBasicEvent[] = [
  be("CCW-PMP-A-FR", "Cooling-water pump A fails to run", "FAILURE_TO_RUN", 0.006),
  be("CCW-PMP-B-FR", "Cooling-water pump B fails to run", "FAILURE_TO_RUN", 0.006),
  be("CCW-CCF-FR", "Common cause failure of both pumps", "COMMON_CAUSE_FAILURE", 0.00036),
  be("CCW-HXA-PLG", "Train A cooling-water heat exchanger fouled", "FAILURE_TO_RUN", 0.002),
  be("CCW-HXB-PLG", "Train B cooling-water heat exchanger fouled", "FAILURE_TO_RUN", 0.002),
  tm("CCW-TM", "One cooling-water train in maintenance", 0.004, "Staggered pump maintenance per the design plan, one train stays available.", true),
];
const mmsEvents: SystemBasicEvent[] = [
  be("MMS-MON-A-FS", "Loop A moisture monitor fails", "FAILURE_TO_START", 0.003),
  be("MMS-MON-B-FS", "Loop B moisture monitor fails", "FAILURE_TO_START", 0.003),
  be("MMS-CCF-FS", "Common cause failure of the moisture monitors", "COMMON_CAUSE_FAILURE", 0.0003),
  hfe("MMS-HFE-CAL", "Moisture monitors miscalibrated after surveillance", 0.0024, "HR-PRE-014"),
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
  { id: "SYS-RPS", short: "RPS", name: "Reactor protection system", sf: "SF-RC", modelRep: "Fault tree", topEvent: "RPS fails to trip the reactor on demand", criterion: "One of two divisions trips the reactor, or the negative temperature feedback caps power at 5 percent of nominal.", excluded: "Spurious trip, which acts to shut the plant down rather than defeat it.", missionHours: 24, boundaries: ["Flux and process sensors", "Two trip divisions", "Reserve shutdown and rod insertion"], detailed: true, events: rpsEvents, modeledFailures: { "Trip divisions": { failureModes: ["Division fails to trip", "Rods fail to insert", "Common cause of divisions"] } } },
  { id: "SYS-SCS", short: "SCS", name: "Shutdown cooling system", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Shutdown cooling fails to remove core heat for the mission time", criterion: "Two of two trains start within 33 hours at full power, one of two in the other states.", excluded: "A single-train overcool, a beneficial failure that helps the function.", missionHours: 24, boundaries: ["Two shutdown-cooling circulators", "Shutdown heat exchangers", "Cooling-water and Class 1E supplies"], detailed: true, events: scsEvents, modeledFailures: { "Cooling trains": { failureModes: ["Circulator fails to run", "Heat exchanger fouled", "Common cause of trains"] } } },
  { id: "SYS-RCCS", short: "RCCS", name: "Reactor cavity cooling system", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Cavity cooling fails to carry the conduction cooldown", criterion: "The passive ducts carry at least half the nominal capacity at power, a quarter shut down.", excluded: "Overcooling from excess draft, a beneficial failure.", missionHours: 72, boundaries: ["Four natural-draft duct groups", "Cavity cooling panels", "Common intake and exhaust stack"], detailed: true, events: rccsEvents, modeledFailures: { "Duct groups": { failureModes: ["Duct air path blocked", "Common cause blockage", "Stack blocked"] } } },
  { id: "SYS-SGISO", short: "SGISO", name: "Steam-generator isolation and dump", sf: "SF-HPB", modelRep: "Fault tree", topEvent: "Steam-generator isolation and dump fails on a moisture alarm", criterion: "The affected steam generator isolates and dumps within 2 hours of the moisture alarm.", excluded: "Spurious isolation, which trips a healthy loop.", missionHours: 24, boundaries: ["Steam and feedwater isolation valves", "Steam-generator dump path", "Moisture-detection interface"], detailed: true, events: sgisoEvents, modeledFailures: { "Isolation and dump": { failureModes: ["Isolation valve fails to close", "Dump valve fails to open", "Common cause of valves"] } } },
  { id: "SYS-HPBI", short: "HPBI", name: "Helium boundary isolation", sf: "SF-HPB", modelRep: "Fault tree", topEvent: "Helium boundary isolation fails to isolate the leaking segment", criterion: "The leaking helium segment or interfacing line is isolated at its boundary valves before the inventory reaches the depressurized band.", excluded: "Spurious isolation of a healthy segment.", missionHours: 24, boundaries: ["Segment isolation valves", "Interfacing-system boundary valves", "Leak-detection interface"], detailed: true, events: hpbiEvents, modeledFailures: { "Isolation path": { failureModes: ["Detection fails", "Isolation valve fails to close", "Common cause of valves"] } } },
  { id: "SYS-DETECT", short: "DET", name: "Depressurization and leak detection", sf: "SF-HPB", modelRep: "Fault tree", topEvent: "Detection fails to alarm on a falling helium pressure", criterion: "Redundant pressure and leak instrumentation alarms so operators diagnose a depressurization and act.", excluded: "Spurious alarm, which prompts an unnecessary but safe operator response.", missionHours: 24, boundaries: ["Redundant primary pressure channels", "Leak and activity monitors", "Control-room alarm and indication"], detailed: true, events: detectEvents, modeledFailures: { "Detection": { failureModes: ["Pressure channel fails", "Common cause of channels", "Alarm fails"] } } },
  { id: "SYS-HIC", short: "HIC", name: "Helium inventory and pressure control", sf: "SF-HPB", modelRep: "Fault tree", topEvent: "Helium inventory control fails to restore pressure", criterion: "The make-up path restores helium inventory, or the slow depressurization proceeds to conduction cooldown.", excluded: "Overpressure, which the relief path limits and which does not threaten the criterion.", missionHours: 24, boundaries: ["Helium make-up compressor and storage", "Pressure-control valves", "Purification interface"], detailed: true, events: hicEvents, modeledFailures: { "Make-up train": { failureModes: ["Compressor fails to start", "Control valve fails to open", "Storage unavailable"] } } },
  { id: "SYS-RB", short: "RB", name: "Reactor building isolation and filtration", sf: "SF-CONF", modelRep: "Fault tree", topEvent: "The reactor building fails to isolate or filter on demand", criterion: "The reactor building isolates on demand and holds the design leak rate with filtration.", excluded: "Premature isolation, which closes the boundary earlier than needed.", diversion: "An unisolated penetration modeled as a bypass leak path.", missionHours: 72, boundaries: ["Building isolation dampers", "Filtered ventilation trains", "Isolation actuation signal"], detailed: true, events: rbEvents, modeledFailures: { "Isolation and filtration": { failureModes: ["Damper fails to close", "Filtration train fails to run", "Standby train fails to start", "Common cause of dampers"] } } },
  { id: "SYS-1E-AC", short: "AC", name: "Class 1E AC power", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Class 1E AC power fails to supply the circulator and cooling loads", criterion: "One of two Class 1E AC divisions supplies the shutdown-cooling loads for the mission time.", excluded: "A spurious diesel start, which loads a healthy division.", missionHours: 24, boundaries: ["Class 1E buses", "Standby diesel generators", "AC distribution"], detailed: true, events: acEvents, modeledFailures: { "AC divisions": { failureModes: ["Diesel fails to start", "Diesel fails to run", "Common cause of diesels"] } } },
  { id: "SYS-1E-DC", short: "DC", name: "Class 1E DC power", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Class 1E DC power fails to supply the protection and actuation loads", criterion: "Battery and distribution supply the DC loads for the mission time.", excluded: "A charger overvoltage trip, which disconnects the charger and leaves the battery carrying the bus.", loops: [{ loopId: "SYS-1E-AC+SYS-1E-DC", resolution: "Broken by crediting the battery through the diesel start and load-sequencing window, so the DC tree does not call AC and the assumption is logged." }], missionHours: 24, boundaries: ["Station batteries", "DC distribution buses", "Battery chargers"], detailed: true, events: dcEvents, modeledFailures: { "Battery trains": { failureModes: ["Battery fails to run", "Common cause of batteries", "Charger fault"] } } },
  { id: "SYS-CCW", short: "CCW", name: "Component cooling water", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Component cooling water fails to cool the shutdown coolers", criterion: "One of two cooling-water trains removes heat from the shutdown coolers.", excluded: "Overcooling from excess flow, a beneficial failure.", missionHours: 24, boundaries: ["Two cooling-water pumps", "Cooling-water heat exchangers", "Distribution headers"], detailed: true, events: ccwEvents, modeledFailures: { "Cooling-water trains": { failureModes: ["Pump fails to run", "Heat exchanger fouled", "Common cause of pumps"] } } },
  { id: "SYS-MMS", short: "MMS", name: "Moisture-monitoring system", sf: "SF-HPB", modelRep: "Fault tree", topEvent: "Moisture monitoring fails to generate the isolation signal", criterion: "Redundant moisture monitors on both loops generate the isolation signal on demand.", excluded: "A spurious moisture signal, which isolates a healthy loop.", missionHours: 24, boundaries: ["Redundant moisture monitors", "Signal processing", "Isolation-signal interface"], detailed: true, events: mmsEvents, modeledFailures: { "Moisture monitors": { failureModes: ["Monitor fails", "Common cause of monitors"] } } },
];

const SYSTEM_POS: Record<string, string[]> = {
  "SYS-RPS": ["POS-01", "POS-02", "POS-03"],
  "SYS-SCS": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-RCCS": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-SGISO": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
  "SYS-HPBI": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
  "SYS-DETECT": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-HIC": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
  "SYS-RB": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-1E-AC": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-1E-DC": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-CCW": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-07", "POS-08", "POS-09"],
  "SYS-MMS": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-05", "POS-06", "POS-08"],
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

const FAULT_TREES: Record<string, SystemFaultTreeNode> = {
  "SYS-RPS": {
    id: "RPS-TOP", type: "OR", name: "RPS fails to trip on demand",
    children: [
      { id: "RPS-2FAIL", type: "AND", name: "Both trip divisions fail", children: [
        { id: "RPS-DVA", type: "OR", name: "Division A fails to insert", children: [
          { id: "be-RPS-DVA-FS", type: "BE", name: "Division A trip logic fails", be: "RPS-DVA-FS", mode: "FAILURE_TO_START", source: "DA-BE-201", prob: "1.5E-3" },
          { id: "be-RPS-RODA-FR", type: "BE", name: "Division A control rods fail to insert", be: "RPS-RODA-FR", mode: "FAILURE_TO_START", source: "DA-BE-203", prob: "8.0E-4" },
        ] },
        { id: "RPS-DVB", type: "OR", name: "Division B fails to insert", children: [
          { id: "be-RPS-DVB-FS", type: "BE", name: "Division B trip logic fails", be: "RPS-DVB-FS", mode: "FAILURE_TO_START", source: "DA-BE-201", prob: "1.5E-3" },
          { id: "be-RPS-RODB-FR", type: "BE", name: "Division B control rods fail to insert", be: "RPS-RODB-FR", mode: "FAILURE_TO_START", source: "DA-BE-203", prob: "8.0E-4" },
        ] },
      ] },
      { id: "be-RPS-CCF-FS", type: "BE", name: "Common cause failure of both divisions", be: "RPS-CCF-FS", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-DIV", prob: "9.0E-5", ccf: true },
      { id: "be-RPS-ROD-CCF", type: "BE", name: "Common cause failure of the rod insertion", be: "RPS-ROD-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-ROD", prob: "4.0E-5", ccf: true },
      { id: "be-RPS-HFE-CAL", type: "BE", name: "Protection setpoints miscalibrated after surveillance", be: "RPS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-031", prob: "1.1E-3" },
      { id: "tr-RPS-DC", type: "TR", name: "Loss of Class-1E DC to the trip logic", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-SCS": {
    id: "SCS-TOP", type: "OR", name: "Either of the two trains fails (full-power criterion)",
    children: [
      { id: "SCS-TRA", type: "OR", name: "Train A fails to cool", children: [
        { id: "be-SCS-TRA-FR", type: "BE", name: "Train A circulator fails to run", be: "SCS-TRA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-205", prob: "8.0E-3" },
        { id: "be-SCS-HXA-PLG", type: "BE", name: "Train A shutdown cooler fouled", be: "SCS-HXA-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-207", prob: "2.0E-3" },
        { id: "be-SCS-TR-TM", type: "BE", name: "One shutdown-cooling train in maintenance", be: "SCS-TR-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-11", prob: "4.0E-3" },
      ] },
      { id: "SCS-TRB", type: "OR", name: "Train B fails to cool", children: [
        { id: "be-SCS-TRB-FR", type: "BE", name: "Train B circulator fails to run", be: "SCS-TRB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-205", prob: "8.0E-3" },
        { id: "be-SCS-HXB-PLG", type: "BE", name: "Train B shutdown cooler fouled", be: "SCS-HXB-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-207", prob: "2.0E-3" },
      ] },
      { id: "be-SCS-CCF-FR", type: "BE", name: "Common cause failure of both trains", be: "SCS-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-SCS-TRAIN", prob: "4.0E-4", ccf: true },
      { id: "be-SCS-HFE", type: "BE", name: "Operator fails to start the second train", be: "SCS-HFE", mode: "HUMAN_ERROR", source: "HR-POST-018", prob: "1.5E-3" },
      { id: "tr-SCS-AC", type: "TR", name: "Loss of Class-1E AC to the circulators", transfer: "SYS-1E-AC" },
      { id: "tr-SCS-CCW", type: "TR", name: "Loss of cooling water to the shutdown coolers", transfer: "SYS-CCW" },
    ],
  },
  "SYS-RCCS": {
    id: "RCC-TOP", type: "OR", name: "Cavity cooling fails to carry the cooldown",
    children: [
      { id: "RCC-DUCTS", type: "KN", k: 3, name: "Three or more of four duct groups blocked (half-capacity criterion)", children: [
        { id: "be-RCC-DUCT1-BLK", type: "BE", name: "Duct group 1 air path blocked", be: "RCC-DUCT1-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-209", prob: "2.0E-3" },
        { id: "be-RCC-DUCT2-BLK", type: "BE", name: "Duct group 2 air path blocked", be: "RCC-DUCT2-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-209", prob: "2.0E-3" },
        { id: "be-RCC-DUCT3-BLK", type: "BE", name: "Duct group 3 air path blocked", be: "RCC-DUCT3-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-209", prob: "2.0E-3" },
        { id: "be-RCC-DUCT4-BLK", type: "BE", name: "Duct group 4 air path blocked", be: "RCC-DUCT4-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-209", prob: "2.0E-3" },
      ] },
      { id: "be-RCC-CCF-BLK", type: "BE", name: "Common cause blockage of the duct groups", be: "RCC-CCF-BLK", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RCCS-DUCT", prob: "2.0E-4", ccf: true },
      { id: "be-RCC-STK-BLK", type: "BE", name: "Common exhaust stack blocked", be: "RCC-STK-BLK", mode: "FAILURE_TO_RUN", source: "DA-BE-211", prob: "1.0E-3" },
      { id: "be-RCC-HFE-DMP", type: "BE", name: "Cavity-cooling duct dampers left misaligned after surveillance", be: "RCC-HFE-DMP", mode: "HUMAN_ERROR", source: "HR-PRE-018", prob: "1.5E-3" },
    ],
  },
  "SYS-SGISO": {
    id: "SGI-TOP", type: "OR", name: "Steam-generator isolation and dump fails",
    children: [
      { id: "be-SGI-IVA-FC", type: "BE", name: "Loop A isolation fails to close", be: "SGI-IVA-FC", mode: "FAILURE_TO_START", source: "DA-BE-213", prob: "2.0E-3" },
      { id: "be-SGI-IVB-FC", type: "BE", name: "Loop B isolation fails to close", be: "SGI-IVB-FC", mode: "FAILURE_TO_START", source: "DA-BE-213", prob: "2.0E-3" },
      { id: "be-SGI-DMP-FO", type: "BE", name: "Steam-generator dump valve fails to open", be: "SGI-DMP-FO", mode: "FAILURE_TO_START", source: "DA-BE-215", prob: "1.5E-3" },
      { id: "be-SGI-IV-CCF", type: "BE", name: "Common cause failure of the isolation valves", be: "SGI-IV-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-SGISO-IV", prob: "1.6E-4", ccf: true },
      { id: "be-SGI-HFE", type: "BE", name: "Operator fails to isolate the affected steam generator", be: "SGI-HFE", mode: "HUMAN_ERROR", source: "HR-POST-022", prob: "4.5E-3" },
      { id: "tr-SGI-MMS", type: "TR", name: "Loss of the moisture-monitoring isolation signal", transfer: "SYS-MMS" },
      { id: "tr-SGI-DC", type: "TR", name: "Loss of Class-1E DC to the isolation valves", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-HPBI": {
    id: "HPI-TOP", type: "OR", name: "Helium boundary isolation fails",
    children: [
      { id: "be-HPI-DET-FA", type: "BE", name: "Leak detection fails to actuate isolation", be: "HPI-DET-FA", mode: "FAILURE_TO_START", source: "DA-BE-217", prob: "2.0E-3" },
      { id: "HPI-VLV", type: "AND", name: "Both isolation valves fail to close", children: [
        { id: "be-HPI-VA-FC", type: "BE", name: "Isolation valve A fails to close", be: "HPI-VA-FC", mode: "FAILURE_TO_START", source: "DA-BE-219", prob: "2.0E-3" },
        { id: "be-HPI-VB-FC", type: "BE", name: "Isolation valve B fails to close", be: "HPI-VB-FC", mode: "FAILURE_TO_START", source: "DA-BE-219", prob: "2.0E-3" },
      ] },
      { id: "be-HPI-VLV-CCF", type: "BE", name: "Common cause failure of the isolation valves", be: "HPI-VLV-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-HPBI-VLV", prob: "2.0E-4", ccf: true },
      { id: "be-HPI-HFE", type: "BE", name: "Operator fails to isolate the leaking segment", be: "HPI-HFE", mode: "HUMAN_ERROR", source: "HR-POST-025", prob: "5.0E-3" },
      { id: "tr-HPI-DC", type: "TR", name: "Loss of Class-1E DC to the isolation valves", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-DETECT": {
    id: "DET-TOP", type: "OR", name: "Detection fails to alarm on a falling pressure",
    children: [
      { id: "DET-CH", type: "AND", name: "Both pressure channels fail", children: [
        { id: "be-DET-PCH-A-FS", type: "BE", name: "Pressure channel A fails", be: "DET-PCH-A-FS", mode: "FAILURE_TO_START", source: "DA-BE-221", prob: "3.0E-3" },
        { id: "be-DET-PCH-B-FS", type: "BE", name: "Pressure channel B fails", be: "DET-PCH-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-221", prob: "3.0E-3" },
      ] },
      { id: "be-DET-PCH-CCF", type: "BE", name: "Common cause failure of the pressure channels", be: "DET-PCH-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DET-PCH", prob: "3.0E-4", ccf: true },
      { id: "be-DET-ALM-FS", type: "BE", name: "Depressurization alarm fails to annunciate", be: "DET-ALM-FS", mode: "FAILURE_TO_START", source: "DA-BE-223", prob: "1.0E-3" },
      { id: "tr-DET-DC", type: "TR", name: "Loss of Class-1E DC to the pressure channels", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-HIC": {
    id: "HIC-TOP", type: "OR", name: "Helium inventory control fails to restore pressure",
    children: [
      { id: "be-HIC-CMP-FS", type: "BE", name: "Make-up compressor fails to start", be: "HIC-CMP-FS", mode: "FAILURE_TO_START", source: "DA-BE-225", prob: "4.0E-3" },
      { id: "be-HIC-VLV-FO", type: "BE", name: "Pressure-control valve fails to open", be: "HIC-VLV-FO", mode: "FAILURE_TO_START", source: "DA-BE-227", prob: "1.5E-3" },
      { id: "be-HIC-STG-UN", type: "BE", name: "Helium storage unavailable", be: "HIC-STG-UN", mode: "FAILURE_TO_RUN", source: "DA-BE-229", prob: "1.0E-3" },
      { id: "be-HIC-HFE", type: "BE", name: "Operator fails to initiate helium make-up", be: "HIC-HFE", mode: "HUMAN_ERROR", source: "HR-POST-026", prob: "6.0E-3" },
      { id: "tr-HIC-AC", type: "TR", name: "Loss of Class-1E AC to the compressor", transfer: "SYS-1E-AC" },
    ],
  },
  "SYS-RB": {
    id: "RB-TOP", type: "OR", name: "Reactor building fails to isolate or filter",
    children: [
      { id: "RB-ISO", type: "AND", name: "Both isolation dampers fail to close", children: [
        { id: "be-RB-DMP-A-FC", type: "BE", name: "Isolation damper A fails to close", be: "RB-DMP-A-FC", mode: "FAILURE_TO_START", source: "DA-BE-231", prob: "2.5E-3" },
        { id: "be-RB-DMP-B-FC", type: "BE", name: "Isolation damper B fails to close", be: "RB-DMP-B-FC", mode: "FAILURE_TO_START", source: "DA-BE-231", prob: "2.5E-3" },
      ] },
      { id: "be-RB-DMP-CCF", type: "BE", name: "Common cause failure of the isolation dampers", be: "RB-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RB-DMP", prob: "2.0E-4", ccf: true },
      { id: "RB-FLT", type: "AND", name: "Both filtration trains fail", children: [
        { id: "be-RB-FLT-FR", type: "BE", name: "Running filtration train fails to run", be: "RB-FLT-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-233", prob: "6.0E-3" },
        { id: "RB-FLT-B", type: "OR", name: "Standby filtration train fails", children: [
          { id: "be-RB-FLT-B-FS", type: "BE", name: "Standby filtration train fails to start", be: "RB-FLT-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-235", prob: "3.0E-3" },
          { id: "be-RB-HFE", type: "BE", name: "Operator fails to start the standby train", be: "RB-HFE", mode: "HUMAN_ERROR", source: "HR-POST-028", prob: "1.5E-2" },
        ] },
      ] },
      { id: "tr-RB-DC", type: "TR", name: "Loss of Class-1E DC to the isolation signal", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-1E-AC": {
    id: "AC-TOP", type: "OR", name: "Class 1E AC power fails to supply the loads",
    children: [
      { id: "AC-AND", type: "AND", name: "Both AC divisions fail", children: [
        { id: "AC-DVA", type: "OR", name: "Division A fails to supply", children: [
          { id: "be-AC-DGA-FS", type: "BE", name: "Diesel A fails to start", be: "AC-DGA-FS", mode: "FAILURE_TO_START", source: "DA-BE-237", prob: "2.0E-2" },
          { id: "be-AC-DGA-FR", type: "BE", name: "Diesel A fails to run", be: "AC-DGA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-239", prob: "8.0E-3" },
          { id: "be-AC-DG-TM", type: "BE", name: "One diesel in maintenance", be: "AC-DG-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-12", prob: "5.0E-3" },
        ] },
        { id: "AC-DVB", type: "OR", name: "Division B fails to supply", children: [
          { id: "be-AC-DGB-FS", type: "BE", name: "Diesel B fails to start", be: "AC-DGB-FS", mode: "FAILURE_TO_START", source: "DA-BE-237", prob: "2.0E-2" },
          { id: "be-AC-DGB-FR", type: "BE", name: "Diesel B fails to run", be: "AC-DGB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-239", prob: "8.0E-3" },
        ] },
      ] },
      { id: "be-AC-DG-CCF", type: "BE", name: "Common cause failure of the diesels", be: "AC-DG-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-AC-DG", prob: "1.0E-3", ccf: true },
      { id: "tr-AC-DC", type: "TR", name: "Loss of Class-1E DC to the diesel controls", transfer: "SYS-1E-DC" },
    ],
  },
  "SYS-1E-DC": {
    id: "DC-TOP", type: "OR", name: "Class-1E DC power fails to supply the loads",
    children: [
      { id: "DC-AND", type: "AND", name: "Both battery trains fail", children: [
        { id: "DC-TRA", type: "OR", name: "Train A fails to supply", children: [
          { id: "be-DC-BAT-A-FR", type: "BE", name: "Battery train A fails to run", be: "DC-BAT-A-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-241", prob: "6.0E-3" },
          { id: "be-DC-CHG-A-FLT", type: "BE", name: "Charger A fault discharges the bank", be: "DC-CHG-A-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-243", prob: "2.0E-3" },
          { id: "be-DC-HFE-CHG", type: "BE", name: "Charger left in the wrong mode after maintenance", be: "DC-HFE-CHG", mode: "HUMAN_ERROR", source: "HR-PRE-009", prob: "5.0E-3" },
          { id: "be-DC-BAT-A-TM", type: "BE", name: "Battery train A on equalize charge", be: "DC-BAT-A-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-13", prob: "2.5E-3" },
        ] },
        { id: "DC-TRB", type: "OR", name: "Train B fails to supply", children: [
          { id: "be-DC-BAT-B-FR", type: "BE", name: "Battery train B fails to run", be: "DC-BAT-B-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-241", prob: "6.0E-3" },
          { id: "be-DC-CHG-B-FLT", type: "BE", name: "Charger B fault discharges the bank", be: "DC-CHG-B-FLT", mode: "FAILURE_TO_RUN", source: "DA-BE-243", prob: "2.0E-3" },
          { id: "be-DC-BAT-B-TM", type: "BE", name: "Battery train B on equalize charge", be: "DC-BAT-B-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-13", prob: "2.5E-3" },
        ] },
      ] },
      { id: "be-DC-BAT-CCF", type: "BE", name: "Common cause failure of the station batteries", be: "DC-BAT-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DC-BATT", prob: "3.0E-4", ccf: true },
      { id: "be-DC-HFE-BNK", type: "BE", name: "Both battery banks held off float after equalization", be: "DC-HFE-BNK", mode: "HUMAN_ERROR", source: "HR-PRE-041", prob: "2.0E-3" },
    ],
  },
  "SYS-CCW": {
    id: "CCW-TOP", type: "OR", name: "Component cooling water fails to cool the shutdown coolers",
    children: [
      { id: "CCW-AND", type: "AND", name: "Both cooling-water trains fail", children: [
        { id: "CCW-TRA", type: "OR", name: "Train A fails to cool", children: [
          { id: "be-CCW-PMP-A-FR", type: "BE", name: "Pump A fails to run", be: "CCW-PMP-A-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-245", prob: "6.0E-3" },
          { id: "be-CCW-HXA-PLG", type: "BE", name: "Train A heat exchanger fouled", be: "CCW-HXA-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-247", prob: "2.0E-3" },
          { id: "be-CCW-TM", type: "BE", name: "One cooling-water train in maintenance", be: "CCW-TM", mode: "TEST_MAINTENANCE", source: "DA-UA-14", prob: "4.0E-3" },
        ] },
        { id: "CCW-TRB", type: "OR", name: "Train B fails to cool", children: [
          { id: "be-CCW-PMP-B-FR", type: "BE", name: "Pump B fails to run", be: "CCW-PMP-B-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-245", prob: "6.0E-3" },
          { id: "be-CCW-HXB-PLG", type: "BE", name: "Train B heat exchanger fouled", be: "CCW-HXB-PLG", mode: "FAILURE_TO_RUN", source: "DA-BE-247", prob: "2.0E-3" },
        ] },
      ] },
      { id: "be-CCW-CCF-FR", type: "BE", name: "Common cause failure of both pumps", be: "CCW-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-CCW-PMP", prob: "3.6E-4", ccf: true },
      { id: "tr-CCW-AC", type: "TR", name: "Loss of Class-1E AC to the pumps", transfer: "SYS-1E-AC" },
    ],
  },
  "SYS-MMS": {
    id: "MMS-TOP", type: "OR", name: "Moisture monitoring fails to generate the isolation signal",
    children: [
      { id: "MMS-CH", type: "AND", name: "Both moisture monitors fail", children: [
        { id: "be-MMS-MON-A-FS", type: "BE", name: "Loop A moisture monitor fails", be: "MMS-MON-A-FS", mode: "FAILURE_TO_START", source: "DA-BE-249", prob: "3.0E-3" },
        { id: "be-MMS-MON-B-FS", type: "BE", name: "Loop B moisture monitor fails", be: "MMS-MON-B-FS", mode: "FAILURE_TO_START", source: "DA-BE-249", prob: "3.0E-3" },
      ] },
      { id: "be-MMS-CCF-FS", type: "BE", name: "Common cause failure of the moisture monitors", be: "MMS-CCF-FS", mode: "COMMON_CAUSE_FAILURE", source: "CCF-MMS-MON", prob: "3.0E-4", ccf: true },
      { id: "be-MMS-HFE-CAL", type: "BE", name: "Moisture monitors miscalibrated after surveillance", be: "MMS-HFE-CAL", mode: "HUMAN_ERROR", source: "HR-PRE-014", prob: "2.4E-3" },
      { id: "tr-MMS-DC", type: "TR", name: "Loss of Class-1E DC to the monitors", transfer: "SYS-1E-DC" },
    ],
  },
};

const systemLogicModels = SYSTEMS.map((s) => ({
  uuid: `SLM-${s.id}`,
  systemReference: s.id,
  description: s.topEvent,
  modelRepresentation: s.modelRep,
  faultTree: FAULT_TREES[s.id],
  basicEvents: s.events,
  nonDetailedModelJustification: s.detailed ? undefined : "System-level data sufficient, no internal redundancy.",
  logicLoopResolutions: s.loops,
  implementsSrs: srs("SY-A7", "SY-A14"),
}));

const systemBasicEvents = SYSTEMS.flatMap((s) => s.events);

const SUPPORT_MATRIX: { system: string; needs: { supporting: string; kind: string }[] }[] = [
  { system: "SYS-RPS", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-SCS", needs: [{ supporting: "SYS-1E-AC", kind: "power" }, { supporting: "SYS-CCW", kind: "cooling" }] },
  { system: "SYS-SGISO", needs: [{ supporting: "SYS-MMS", kind: "signal" }, { supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-HPBI", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-DETECT", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-HIC", needs: [{ supporting: "SYS-1E-AC", kind: "power" }] },
  { system: "SYS-RB", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
  { system: "SYS-1E-AC", needs: [{ supporting: "SYS-1E-DC", kind: "signal" }] },
  { system: "SYS-CCW", needs: [{ supporting: "SYS-1E-AC", kind: "power" }] },
  { system: "SYS-MMS", needs: [{ supporting: "SYS-1E-DC", kind: "power" }] },
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
  { id: "CCF-RPS-DIV", name: "RPS trip divisions", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-DV-A", "RPS-DV-B"], events: ["RPS-DVA-FS", "RPS-DVB-FS", "RPS-CCF-FS"], modelType: "BETA_FACTOR", beta: 0.06, qt: 0.0015, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Divisional separation", "Trip channels tested on separate schedules"], basis: "Two divisions of identical design and manufacture.", risk: "Risk significant, the divisional term sits directly under the failure-to-trip top gate.", daRef: "DA-CCF-04", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-RPS-ROD", name: "Control-rod insertion", scope: "INTRASYSTEM", system: "SYS-RPS", components: ["RPS-ROD-A", "RPS-ROD-B"], events: ["RPS-RODA-FR", "RPS-RODB-FR", "RPS-ROD-CCF"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.0008, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Gravity-assisted insertion", "Periodic rod-drop timing tests"], basis: "Identical rod-insertion drives on both divisions.", risk: "Carried at the generic screening beta, the insertion path is the last mechanical link in the trip chain.", daRef: "DA-CCF-05", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-SCS-TRAIN", name: "Shutdown-cooling trains", scope: "INTRASYSTEM", system: "SYS-SCS", components: ["SCS-TR-A", "SCS-TR-B"], events: ["SCS-TRA-FR", "SCS-TRB-FR", "SCS-CCF-FR"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.008, shared: { hardwareDesign: true, manufacturer: true, maintenance: true }, defenses: ["Alternating lead and lag rotation", "Train-dedicated cooling water"], basis: "Two circulator trains of one make on one maintenance schedule.", risk: "Risk significant, at full power both trains are required so the common term drives the top gate.", daRef: "DA-CCF-08", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-RCCS-DUCT", name: "Cavity cooling duct groups", scope: "INTRASYSTEM", system: "SYS-RCCS", components: ["RCC-DUCT1", "RCC-DUCT2", "RCC-DUCT3", "RCC-DUCT4"], events: ["RCC-DUCT1-BLK", "RCC-DUCT2-BLK", "RCC-DUCT3-BLK", "RCC-DUCT4-BLK", "RCC-CCF-BLK"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.002, shared: { hardwareDesign: true, environment: true }, defenses: ["Physically separated duct risers", "Debris screens on each intake"], basis: "Four duct groups share the cavity environment and the same debris sources.", risk: "The passive path fails mainly through the common blockage term, carried at the generic beta.", daRef: "DA-CCF-12", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-SGISO-IV", name: "Steam-generator isolation valves", scope: "INTRASYSTEM", system: "SYS-SGISO", components: ["SGI-IV-A", "SGI-IV-B"], events: ["SGI-IVA-FC", "SGI-IVB-FC", "SGI-IV-CCF"], modelType: "BETA_FACTOR", beta: 0.08, qt: 0.002, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Loop-dedicated valves", "Closure verification after each test"], basis: "Two isolation valves of one make on one test procedure.", risk: "The isolation pair defeats the boundary function through the common term, so the group carries the path.", daRef: "DA-CCF-16", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-HPBI-VLV", name: "Helium boundary isolation valves", scope: "INTRASYSTEM", system: "SYS-HPBI", components: ["HPI-V-A", "HPI-V-B"], events: ["HPI-VA-FC", "HPI-VB-FC", "HPI-VLV-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.002, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Redundant isolation on the segment", "Closure verification after each stroke test"], basis: "Two isolation valves of one make on one test procedure.", risk: "The redundant pair loses isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-25", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-DET-PCH", name: "Primary pressure channels", scope: "INTRASYSTEM", system: "SYS-DETECT", components: ["DET-PCH-A", "DET-PCH-B"], events: ["DET-PCH-A-FS", "DET-PCH-B-FS", "DET-PCH-CCF"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.003, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Channel-dedicated calibration", "Cross-channel comparison"], basis: "Identical pressure channels feeding the alarm.", risk: "Modeled as the collapsed common term, the independent channel failures sit in the AND gate.", daRef: "DA-CCF-27", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-RB-DMP", name: "Building isolation dampers", scope: "INTRASYSTEM", system: "SYS-RB", components: ["RB-DMP-A", "RB-DMP-B"], events: ["RB-DMP-A-FC", "RB-DMP-B-FC", "RB-DMP-CCF"], modelType: "BETA_FACTOR", beta: 0.08, qt: 0.0025, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Series arrangement, either damper closes the line", "Closure verification after each test"], basis: "Two series dampers of one make on one test procedure.", risk: "The series pair defeats isolation only through the common term, so the group carries the path.", daRef: "DA-CCF-30", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-AC-DG", name: "Class 1E diesel generators", scope: "INTERSYSTEM", system: "SYS-1E-AC", components: ["AC-DG-A", "AC-DG-B"], events: ["AC-DGA-FS", "AC-DGB-FS", "AC-DG-CCF"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.02, shared: { manufacturer: true, environment: true, maintenance: true }, defenses: ["Staggered diesel testing", "Division-dedicated fuel and cooling"], basis: "Two diesels of one make sharing one building and one maintenance schedule.", risk: "Risk significant, the diesel term propagates through every AC-fed cooling system.", daRef: "DA-CCF-08", affects: ["SYS-SCS", "SYS-CCW", "SYS-HIC"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-DC-BATT", name: "Class-1E station batteries", scope: "INTERSYSTEM", system: "SYS-1E-DC", components: ["DC-BAT-A", "DC-BAT-B"], events: ["DC-BAT-A-FR", "DC-BAT-B-FR", "DC-BAT-CCF"], modelType: "BETA_FACTOR", beta: 0.05, qt: 0.006, shared: { manufacturer: true, environment: true, maintenance: true }, defenses: ["Staggered equalize charging", "Train-dedicated chargers"], basis: "Two batteries of one make sharing one room and one maintenance schedule.", risk: "Risk significant, the battery term propagates through every DC-fed protective system.", daRef: "DA-CCF-09", affects: ["SYS-RPS", "SYS-SGISO", "SYS-RB", "SYS-DETECT"], srs: ["SY-B2", "SY-B3", "SY-B4"] },
  { id: "CCF-CCW-PMP", name: "Cooling-water pumps", scope: "INTRASYSTEM", system: "SYS-CCW", components: ["CCW-PMP-A", "CCW-PMP-B"], events: ["CCW-PMP-A-FR", "CCW-PMP-B-FR", "CCW-CCF-FR"], modelType: "BETA_FACTOR", beta: 0.06, qt: 0.006, shared: { hardwareDesign: true, maintenance: true }, defenses: ["Alternating lead and lag rotation", "Independent suctions"], basis: "Two pumps of one make on one maintenance schedule.", risk: "The cooling-water term feeds the shutdown-cooling trains, carried at the generic beta.", daRef: "DA-CCF-18", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
  { id: "CCF-MMS-MON", name: "Moisture monitors", scope: "INTRASYSTEM", system: "SYS-MMS", components: ["MMS-MON-A", "MMS-MON-B"], events: ["MMS-MON-A-FS", "MMS-MON-B-FS", "MMS-CCF-FS"], modelType: "BETA_FACTOR", beta: 0.1, qt: 0.003, shared: { hardwareDesign: true, manufacturer: true }, defenses: ["Loop-dedicated monitors", "Cross-loop comparison"], basis: "Identical moisture monitors on both loops.", risk: "Modeled as the collapsed common term, the independent monitor failures sit in the AND gate.", daRef: "DA-CCF-22", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"] },
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
  { id: "HFE-1", system: "SYS-SCS", ref: "HR-POST-018", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start the second shutdown-cooling train.", srs: ["SY-A23"] },
  { id: "HFE-2", system: "SYS-SGISO", ref: "HR-POST-022", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to isolate the affected steam generator.", srs: ["SY-A23"] },
  { id: "HFE-3", system: "SYS-HPBI", ref: "HR-POST-025", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to isolate the leaking helium segment.", srs: ["SY-A23"] },
  { id: "HFE-4", system: "SYS-HIC", ref: "HR-POST-026", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to initiate helium make-up.", srs: ["SY-A23"] },
  { id: "HFE-5", system: "SYS-RB", ref: "HR-POST-028", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start the standby filtration train.", srs: ["SY-A23"] },
  { id: "HFE-6", system: "SYS-1E-DC", ref: "HR-PRE-009", type: "PRE_INITIATOR" as const, tm: true, task: "Battery charger left in the wrong mode after maintenance.", srs: ["SY-A21"] },
  { id: "HFE-7", system: "SYS-MMS", ref: "HR-PRE-014", type: "PRE_INITIATOR" as const, tm: true, task: "Moisture monitors miscalibrated after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-8", system: "SYS-RPS", ref: "HR-PRE-031", type: "PRE_INITIATOR" as const, tm: true, task: "Protection setpoints miscalibrated after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-9", system: "SYS-RCCS", ref: "HR-PRE-018", type: "PRE_INITIATOR" as const, tm: true, task: "Cavity-cooling duct dampers left misaligned after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-10", system: "SYS-1E-DC", ref: "HR-PRE-041", type: "PRE_INITIATOR" as const, tm: true, task: "Both battery banks held off float after equalization.", srs: ["SY-A21"] },
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
  { id: "CS-1", system: "SYS-RCCS", component: "Cavity cooling instrument isolation root valve", crit: "a" as const, basis: "Passive open valve, failure probability 4E-7 over 72 h." },
  { id: "CS-2", system: "SYS-RB", component: "Filtration train manual balancing damper", crit: "b" as const, basis: "Leakage cannot defeat the isolation criterion, downstream of the boundary." },
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
  { id: "SN-1", system: "SYS-1E-DC", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-SGISO", "SYS-RB", "SYS-DETECT"], criterion: "One battery and one bus carry the protective loads for the mission time." },
  { id: "SN-2", system: "SYS-1E-AC", type: "REALISTIC" as const, supports: ["SYS-SCS", "SYS-CCW", "SYS-HIC"], criterion: "One of two Class 1E divisions carries the shutdown-cooling loads." },
  { id: "SN-3", system: "SYS-CCW", type: "CONSERVATIVE" as const, supports: ["SYS-SCS"], criterion: "One cooling-water train removes heat from the shutdown coolers." },
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
  { id: "INV-2", resource: "Helium make-up storage", type: "other" as const, system: "SYS-HIC", capacity: 24, mission: 24, supports: true, treatment: "Storage sized for the make-up demand across the mission time." },
  { id: "INV-3", resource: "Cavity cooling air heat sink", type: "air" as const, system: "SYS-RCCS", capacity: 0, mission: 72, supports: true, treatment: "Atmospheric heat sink, no depletion." },
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
    name: "Protection and isolation logic",
    systemReference: "SYS-RPS",
    description: "Digital protection logic for the trip and isolation functions.",
    methodology: "Modeled per the Part II Subpart 2.7 digital I&C method, one accepted approach among others.",
    failureModes: ["Channel hardware failure", "Systematic software fault", "Common software image failure"],
    specialConsiderations: ["Software common cause carried as a bounding term, to be modeled at CC-II (SY-B11)."],
    implementsSrs: srs("SY-B11"),
  },
];

const passiveSystemsTreatments = [
  { uuid: "PST-RCCS", name: "Reactor cavity cooling", systemReference: "SYS-RCCS", description: "Decay heat rejected from the vessel to the cavity ducts by natural-draft air flow and thermal radiation, no active power.", relevantPhysicalPhenomena: ["Natural-draft air flow", "Vessel thermal radiation", "Core conduction"], uncertaintyEvaluation: "Reliability propagated by direct uncertainty quantification.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-FEEDBACK", name: "Negative temperature feedback", systemReference: "SYS-RPS", description: "The strong negative temperature coefficient caps power at about 5 percent of nominal on a failure to trip.", relevantPhysicalPhenomena: ["Doppler feedback", "Graphite and fuel thermal expansion"], uncertaintyEvaluation: "Capped power absorbed in every sampled case.", implementsSrs: srs("SY-A9") },
];

const systemConfirmationRecords = [
  { id: "CR-1", system: "SYS-RCCS", method: "DESIGN_REVIEW" as const, date: "2026-04-30", roles: ["Systems lead", "RCCS designer"], findings: "Model matches the design intent, walkdown deferred to as-built." },
  { id: "CR-2", system: "SYS-RPS", method: "DISCUSSIONS" as const, date: "2026-05-01", roles: ["Systems analyst", "I&C engineer"], findings: "Trip logic and divisions confirmed against the design package." },
  { id: "CR-3", system: "SYS-1E-DC", method: "DESIGN_REVIEW" as const, date: "2026-05-02", roles: ["Electrical engineer", "Systems analyst"], findings: "Bus assignments confirmed, battery duty flagged for INV-1." },
  { id: "CR-4", system: "SYS-SCS", method: "DISCUSSIONS" as const, date: "2026-05-03", roles: ["Mechanical engineer", "Systems analyst"], findings: "Two-train arrangement confirmed, the full-power two-of-two criterion recorded for the variable success criteria." },
  { id: "CR-5", system: "SYS-SGISO", method: "DESIGN_REVIEW" as const, date: "2026-05-03", roles: ["I&C engineer", "Systems analyst"], findings: "Moisture-monitor isolation signal and dump path confirmed against the design package." },
  { id: "CR-6", system: "SYS-1E-AC", method: "DESIGN_REVIEW" as const, date: "2026-05-04", roles: ["Electrical engineer", "Systems analyst"], findings: "Diesel divisions confirmed, the DC start and load-sequencing window recorded for the logic loop." },
  { id: "CR-7", system: "SYS-RB", method: "DISCUSSIONS" as const, date: "2026-05-04", roles: ["HVAC engineer", "Systems lead"], findings: "Series dampers and the standby filtration train confirmed against the design package." },
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
  { id: "OC-1", system: "SYS-SCS", scenario: "Decay heat above the rated train duty early in the sequence", treatment: "CONSERVATIVE" as const, basis: "Rated capability used at CC-I until the realistic duty is confirmed." },
  { id: "OC-2", system: "SYS-RCCS", scenario: "Conduction cooldown near the duct capability", treatment: "REALISTIC_JUSTIFIED" as const, basis: "Realistic capability supported by the conduction-cooldown analysis at CC-II." },
].map((o) => ({
  uuid: o.id,
  system: o.system,
  potentialExceedanceScenarios: [o.scenario],
  treatment: o.treatment,
  justificationForCapability: o.basis,
  implementsSrs: srs("SY-A29"),
}));

const environmentalDesignBasisConsiderations = [
  { id: "SPC-1", system: "SYS-RCCS", components: ["RCC-DUCT1", "RCC-DUCT2"], seqs: ["IEG-11", "IEG-01"], text: "Cavity riser. A depressurization heats the cavity and can degrade two of the four duct groups on the same riser, carried through the environment factor of the duct common cause group.", included: true },
  { id: "SPC-2", system: "SYS-SCS", components: ["SCS-TR-A", "SCS-TR-B"], seqs: ["IEG-05"], text: "Shared support cooling. Loss of component cooling water or mechanical support raises the shutdown-cooling room temperature for both trains together, carried as the cooling dependency in the support matrix.", included: true },
  { id: "SPC-3", system: "SYS-RB", components: ["RB-DMP-A", "RB-DMP-B"], seqs: ["IEG-10", "IEG-17"], text: "Depressurization environment. A blowdown into the building can push the isolation dampers beyond their environmental qualification, so the adverse condition enters as a dependent failure.", included: true },
].map((e) => ({
  uuid: e.id,
  systemReference: e.system,
  components: e.components,
  eventSequences: e.seqs,
  environmentalConditions: e.text,
  dependentFailuresIncluded: e.included,
  implementsSrs: srs("SY-B8", "SY-B14"),
}));

const simultaneousUnavailabilityEvents = [
  { uuid: "UA-3", description: "Both shutdown-cooling trains credited while one is in planned maintenance", componentIds: ["SCS-TR-A", "SCS-TR-B"], dataAnalysisRef: "DA-UA-11", plannedActivityBasis: "The surveillance plan staggers train maintenance so the second train is never out at the same time; the record confirms the planned unavailability is not simultaneous.", implementsSrs: srs("SY-A27") },
];

const uncertaintyAnalyses = [
  {
    uuid: "SUA-1",
    system: "SYS-RCCS",
    propagationMethod: "LATIN_HYPERCUBE" as const,
    modelUncertainties: [
      { uncertaintyId: "MU-1", description: "RCCS duct common cause parameter", impact: "Sensitivity on the beta factor pending DA-D8.", isQuantified: false, treatmentApproach: "Sensitivity study on the beta-factor range." },
      { uncertaintyId: "MU-3", description: "Battery depletion duty", impact: "Load-shedding calculation carried as an open uncertainty.", isQuantified: false, treatmentApproach: "Bounded estimate until the calculation closes." },
    ],
    parameterUncertainties: [
      { parameterId: "RCC-CCF-BLK", distributionType: DistributionType.BETA, distributionParameters: { alpha: 2, beta: 1800 }, basis: "Beta-factor prior pending DA-D8.", associatedComponent: "Cavity cooling ducts" },
    ],
    implementsSrs: srs("SY-B16"),
  },
];

const sensitivityStudies: SensitivityStudy[] = [
  { uuid: "SS-1", name: "SCS train count sensitivity", description: "Shutdown-cooling train count sweep across the operating states.", variedParameters: ["Shutdown-cooling trains credited"], parameterRanges: { "Trains": [1, 2] }, results: "At full power two of two trains are required, since one 7 MW train loses the decay-heat race; in the other states one of two meets the criterion with margin. Both trains catch the decay curve at 7.6 h (TF-CALC-H01)." },
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
  { uuid: "VSC-SCS-FP", systemReference: "SYS-SCS", plantOperatingStateId: "POS-01", scenarioCondition: "Full power", successCriteriaIds: ["SC-SYS-SCS"], basis: "Two of two shutdown-cooling trains start within 33 hours. One 7 MW train cannot catch the full-power decay curve; both trains catch it at 7.6 h. Verified by a 76-probe dynamic campaign (TF-CALC-H01).", implementsSrs: srs("SY-A5", "SY-B5") },
  { uuid: "VSC-SCS-OTHER", systemReference: "SYS-SCS", scenarioCondition: "Operating states other than full power (POS-02 to POS-09)", successCriteriaIds: ["SC-SYS-SCS"], basis: "One of two shutdown-cooling trains starts before the state fuel limit, since the lower decay load sits within a single 7 MW train.", implementsSrs: srs("SY-A5", "SY-B5") },
  { uuid: "VSC-RCCS-FP", systemReference: "SYS-RCCS", plantOperatingStateId: "POS-01", scenarioCondition: "At power", successCriteriaIds: ["SC-SYS-RCCS"], basis: "At least half of the nominal duct capacity carries the depressurized conduction cooldown at power.", implementsSrs: srs("SY-A5", "SY-B5") },
  { uuid: "VSC-RCCS-OTHER", systemReference: "SYS-RCCS", scenarioCondition: "Shutdown states (POS-04 to POS-09)", successCriteriaIds: ["SC-SYS-RCCS"], basis: "At least a quarter of the nominal duct capacity carries the shutdown conduction cooldown.", implementsSrs: srs("SY-A5", "SY-B5") },
];

export const SY_ANALYSIS_HTGR: SystemsAnalysis = {
  uuid: "sy-generic-2",
  name: "SY Workbook 1",
  type: TechnicalElementTypes.SYSTEMS_ANALYSIS,
  version: "1",
  created: CREATED,
  modified: NOW,
  owner: "sreyes",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "sreyes" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["sreyes", "jpark", "lfischer"],
    reviewers: [
      { id: "rev-1", name: "Dr. Nadia Hartwell", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Marc Béland", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Electrical & I&C", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Priya Subramanian", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Dependencies & CCF", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Nuclear LLC" },
    ],
    scope: "Systems analysis for the Generic HTGR across pre-operational plant operating states, building the system logic models that supply branch failure to Event Sequence Quantification.",
    limitations: ["Pre-operational: system models rest on design information pending as-built confirmation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "sreyes",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "syc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-02T09:14:00.000Z", associatedSr: "SY-B3", text: "The RCCS duct group rests on a shared cavity environment and shared make, so SY-B3 needs the grouping basis closed against the DA-D8 parameter set before the beta factor is final.", severity: "MAJOR", resolved: false },
      { uuid: "syc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-02T10:30:00.000Z", associatedSr: "SY-B11", text: "The protection logic carries a single software image across the trip and isolation functions, so SY-B11 needs the software common cause modeled rather than left as a bounding term.", severity: "MAJOR", resolved: false },
      { uuid: "syc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-02T11:00:00.000Z", associatedSr: "SY-B12", text: "A 4 hour battery against a 24 hour mission needs the load-shedding calculation closed under SY-B12, since the current model assumes the duty without showing it.", severity: "MAJOR", resolved: false },
      { uuid: "syc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-03T14:05:00.000Z", associatedSr: "SY-B8", text: "Two RCCS duct groups share the cavity riser, so SY-B8 needs the riser-level dependent failure confirmed in the fault tree, not only noted in the text.", severity: "MINOR", resolved: false },
      { uuid: "syc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-03T15:20:00.000Z", associatedSr: "SY-A20", text: "The screening of the indicating lamps and root valves is clean and each exclusion cites a stated criterion.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the screening criteria are applied consistently.", resolvedAt: "2026-05-03T17:00:00.000Z", resolvedBy: "rev-2" },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope systems analysis for the Generic HTGR, pre-operational stage, capability category CC-II.",
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
    lowerConfidenceAreas: ["RCCS duct common cause", "Battery depletion duty", "Protection software common cause"],
    improvementPlans: ["Close the open items against Data Analysis and confirm by walkdown at as-built."],
    implementsSrs: srs("SY-A6", "SY-A10", "SY-A11"),
  },
  systemDependencies,
  componentDependencies: [],
  dependencySearchMethodology: {
    uuid: "DSM-1",
    name: "Support-system dependency search",
    description: "Each system row is checked against the support columns by engineering analysis, with a support-on-support loop resolved explicitly.",
    reference: "Generic HTGR dependency search procedure",
    dependencyTables: [{ tableId: "DEP-MATRIX", description: "Support-system dependency matrix" }],
    systemsAnalyzed: SYSTEMS.map((s) => s.id),
    implementsSrs: srs("SY-B5", "SY-B6"),
  },
  commonCauseFailureGroups,
  supportSystemSuccessCriteria,
  humanFailureEventIntegrations,
  exampleDocuments: [
    { id: "SY-DOC-01", name: "Generic HTGR System Design Descriptions", kind: "doc", sizeLabel: "PRA", uploadedLabel: "Generic HTGR SDD set", extracted: "System boundaries, trains, and support dependencies for the protection, shutdown-cooling and cavity-cooling systems", linked: 7, url: "/api/example-documents/sy/htgr-sdd" },
    { id: "SY-DOC-02", name: "Passive Cavity Cooling and Conduction-Cooldown Basis", kind: "doc", sizeLabel: "IAEA", uploadedLabel: "Gas-cooled reactor passive-cooling basis", extracted: "Reactor cavity cooling reliability, duct blockage modes, and conduction-cooldown performance", linked: 4, url: "/api/example-documents/sy/htgr-rccs" },
    { id: "SY-DOC-03", name: "Gas-Cooled Reactor Component Failure Data Dossier", kind: "sheet", sizeLabel: "NRC", uploadedLabel: "NUREG/CR-6928 + HTGR overlay", extracted: "Basic-event failure rates and common-cause parameters for the modeled components", linked: 6, url: "/api/example-documents/sy/htgr-failure-data" },
    { id: "SY-DOC-04", name: "Common-Cause Failure Parameter Estimates (Alpha Factor)", kind: "sheet", sizeLabel: "NRC", uploadedLabel: "NUREG/CR-5485", extracted: "Alpha-factor common-cause parameters applied to the redundant train and division groups", linked: 3, url: "/api/example-documents/sy/htgr-ccf" },
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
      { source: "RCCS duct common cause parameter", impact: "Sensitivity on the beta factor pending DA-D8." },
      { source: "Protection software failure mode", impact: "Bounded estimate carried until the CC-II software model is set." },
      { source: "Battery depletion duty", impact: "Load-shedding calculation carried as an open uncertainty." },
      { source: "Supercomponent boundary for the trip cabinet", impact: "Boundary checked against the data, flagged for the as-built." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  documentation: {
    processDescription: "Systems analysis built one system logic model at a time from the Event Sequence safety functions, with common cause groups, dependencies and human failure events placed in the models, per ASME/ANS RA-S-1.4 HLR-SY-A through C.",
    systemFunctionsAndBoundaries: "Twelve systems modeled, each with a top event, a success criterion and a stated model boundary including the support interfaces.",
    systemSchematicsReferenced: "System design descriptions and P&IDs referenced for each modeled system.",
    modeledComponentsAndFailureModes: "Components and failure modes that defeat the system success criteria are included, with beneficial failures left out unless their omission distorts the result.",
    screeningAndExclusionJustifications: "Four components screened from detailed analysis, each against a stated screening criterion.",
    successCriteriaRelationship: "Each system top event is set by a success criterion from Success Criteria Development.",
    alignmentsAndConfigurations: "Normal and significant alternate alignments modeled per system.",
    testAndMaintenanceTreatment: "Out-of-service unavailability modeled per the maintenance plan, with simultaneous planned unavailability of redundant equipment carried explicitly.",
    dependencySearchAndTables: "Support-system dependencies set by engineering analysis in a dependency matrix, with a support-on-support loop resolved explicitly.",
    ccfGroupsAndModels: "Twelve common cause groups, ten within a system and two across systems, consistent with the Data Analysis common cause model.",
    humanFailureEventsIncluded: "Pre-initiator and post-initiator human failure events placed in the system models and handed to Human Reliability.",
    modularizationAndLogicLoops: "One support-on-support logic loop resolved by crediting the battery for the diesel start window.",
    nomenclatureConventions: "One designator per component failure mode across every system and train, which lets the quantifier link the trees.",
    digitalICTreatment: "Digital protection logic modeled per the Part II Subpart 2.7 method, with software common cause modeled at CC-II.",
    passiveSystemsTreatment: "Passive functions treated with mechanistic models and direct uncertainty propagation for functional reliability.",
    evaluationResultsSummary: "Each system fault tree quantified standalone, with the full-plant quantification performed by Event Sequence Quantification.",
    informationSources: "Design descriptions, failure mode analyses, the common cause parameter dossier and the surveillance plan.",
    modelUncertaintySources: "Model-uncertainty sources include the RCCS duct common cause parameter, the protection software failure mode and the battery depletion duty.",
    asBuiltLimitations: "Pre-operational: system models, dependencies and unavailability rest on design information pending as-built and as-operated confirmation.",
    praTaskInterfaces: "Interfaces with Event Sequence Analysis and Success Criteria for what to model, with Data Analysis for parameters, with Human Reliability for human events, and with Event Sequence Quantification which links the trees.",
    implementsSrs: srs("SY-C1"),
  },
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-072", "NM-055", "NM-061"],
};

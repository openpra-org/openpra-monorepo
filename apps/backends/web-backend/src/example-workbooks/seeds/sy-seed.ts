import { type SystemsAnalysis, type SystemBasicEvent } from "interfaces-mef-types/sy/systems-analysis";
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

const dracsEvents: SystemBasicEvent[] = [
  be("DRC-LP1-FR", "DRACS loop 1 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-LP2-FR", "DRACS loop 2 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-LP3-FR", "DRACS loop 3 fails to maintain natural circulation", "FAILURE_TO_RUN", 0.008),
  be("DRC-CCF-FR", "Common cause failure of all three loops", "COMMON_CAUSE_FAILURE", 0.00012),
  be("DRC-DMP-CCF", "Common cause failure of the air dampers", "COMMON_CAUSE_FAILURE", 0.0005),
];
const rpsEvents: SystemBasicEvent[] = [
  be("RPS-DVA-FS", "Division A fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-DVB-FS", "Division B fails to trip", "FAILURE_TO_START", 0.0015),
  be("RPS-CCF-FS", "Common cause failure of both divisions", "COMMON_CAUSE_FAILURE", 0.00009),
  be("RPS-ROD-CCF", "Common cause failure of the rod release", "COMMON_CAUSE_FAILURE", 0.00003),
];
const actEvents: SystemBasicEvent[] = [
  be("ACT-CH1-FS", "Voting channel 1 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH2-FS", "Voting channel 2 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH3-FS", "Voting channel 3 fails", "FAILURE_TO_START", 0.002),
  be("ACT-CH4-FS", "Voting channel 4 fails", "FAILURE_TO_START", 0.002),
  be("ACT-SW-CCF", "Common cause failure of the logic software", "COMMON_CAUSE_FAILURE", 0.0001),
];
const dcEvents: SystemBasicEvent[] = [
  be("DC-BAT-A-FR", "Battery train A fails to run", "FAILURE_TO_RUN", 0.006),
  be("DC-BAT-B-FR", "Battery train B fails to run", "FAILURE_TO_RUN", 0.006),
  be("DC-BAT-CCF", "Common cause failure of the station batteries", "COMMON_CAUSE_FAILURE", 0.00025),
];
const cisEvents: SystemBasicEvent[] = [
  be("CIS-DMP-CCF", "Common cause failure of the isolation dampers", "COMMON_CAUSE_FAILURE", 0.0004),
  be("CIS-FAN-FR", "Clean-up fan fails to run", "FAILURE_TO_RUN", 0.007),
  be("CIS-IV-FO", "Inlet valve fails to open", "FAILURE_TO_START", 0.0012),
];
const hvacEvents: SystemBasicEvent[] = [
  be("HVC-CHA-FR", "Cooling train A fails to run", "FAILURE_TO_RUN", 0.009),
  be("HVC-CHB-FR", "Cooling train B fails to run", "FAILURE_TO_RUN", 0.009),
  be("HVC-CCF-FR", "Common cause failure of both trains", "COMMON_CAUSE_FAILURE", 0.0003),
];
const pcsEvents: SystemBasicEvent[] = [
  be("PCS-FLOW-CCF", "Common cause blockage of both flow paths", "COMMON_CAUSE_FAILURE", 0.0002),
  be("PCS-CKV-FO", "Loop check valve fails to open", "FAILURE_TO_START", 0.001),
  be("PCS-TC-FR", "Thermal-center flow degraded below the limit", "FAILURE_TO_RUN", 0.0005),
];

interface SystemSeed {
  id: string;
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
  { id: "SYS-RPS", name: "Reactor protection system", sf: "SF-RC", modelRep: "Fault tree", topEvent: "RPS fails to insert negative reactivity on demand", criterion: "One of two divisions inserts the rods within 3 s of the trip demand.", missionHours: 24, boundaries: ["Sensors and trip logic", "Two trip divisions", "Scram breakers and rod release"], detailed: true, events: rpsEvents, modeledFailures: { "Trip divisions": { failureModes: ["Division fails to trip", "Scram breaker fails open", "Rod fails to release", "Common cause of divisions"] } } },
  { id: "SYS-DRACS", name: "Direct reactor auxiliary cooling system", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "DRACS fails to remove decay heat for the mission time", criterion: "One of three loops removes decay heat by natural circulation.", missionHours: 24, boundaries: ["Three independent NaK loops", "Sodium-to-NaK and NaK-to-air exchangers", "Air dampers and stack"], detailed: true, events: dracsEvents, modeledFailures: { "NaK loops": { failureModes: ["Loop natural-circulation loss", "Damper fails to open", "Air-path blockage", "Common cause of loops"] } } },
  { id: "SYS-PCS", name: "Primary loop natural circulation", sf: "SF-DHR", modelRep: "Fault tree", topEvent: "Primary natural circulation fails to establish", criterion: "Both loops stay open so buoyancy-driven flow establishes in time.", missionHours: 24, boundaries: ["Primary pumps and check valves", "Both loop flow paths", "Thermal-center elevation"], detailed: true, events: pcsEvents, modeledFailures: { "Flow paths": { failureModes: ["Flow-path blockage", "Check valve fails to open", "Thermal-center degradation"] } } },
  { id: "SYS-CIS", name: "Confinement isolation & clean-up", sf: "SF-CONF", modelRep: "Fault tree", topEvent: "Confinement fails to isolate or clean up on demand", criterion: "Isolation closes on demand and the clean-up train holds the leak rate.", missionHours: 72, boundaries: ["Isolation dampers and valves", "Cover-gas clean-up train", "Isolation actuation signal"], detailed: true, events: cisEvents, modeledFailures: { "Isolation and clean-up": { failureModes: ["Isolation damper fails to close", "Clean-up train fails to run", "Signal fails to generate"] } } },
  { id: "SYS-GV", name: "Guard vessel", sf: "SF-INV", modelRep: "System-level", topEvent: "Guard vessel fails to retain sodium over the core", criterion: "The guard vessel bounds a primary leak and keeps the core covered.", missionHours: 72, boundaries: ["Guard vessel shell", "Shared support skirt", "Leak-detection interface"], detailed: false, events: [], modeledFailures: { "Guard vessel": { failureModes: ["Shell leak"], justificationForInclusion: "System-level data sufficient, no internal redundancy." } } },
  { id: "SYS-DC", name: "Class-1E DC power", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Class-1E DC power fails to supply the trip and actuation loads", criterion: "Battery and distribution supply the DC loads for the mission time.", missionHours: 24, boundaries: ["Station batteries", "DC distribution buses", "Battery chargers"], detailed: true, events: dcEvents, modeledFailures: { "Battery trains": { failureModes: ["Battery fails to run", "Common cause of batteries", "Charger fault"] } } },
  { id: "SYS-ACT", name: "Reactor trip & actuation logic", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Actuation logic fails to generate the trip or isolation signal", criterion: "Digital logic generates the protective signal on demand.", missionHours: 24, boundaries: ["Sensor input modules", "Digital voting logic", "Output actuation modules"], detailed: true, events: actEvents, modeledFailures: { "Voting logic": { failureModes: ["Channel fails", "Software common cause"] } } },
  { id: "SYS-HVAC", name: "Safety I&C room cooling", sf: "SF-RC", modelRep: "Fault tree", topEvent: "Room cooling fails and I&C exceeds its temperature limit", criterion: "Room cooling keeps the I&C below its qualified temperature.", missionHours: 24, boundaries: ["Safety chillers", "Room air handlers", "Temperature instruments"], detailed: true, events: hvacEvents, modeledFailures: { "Cooling trains": { failureModes: ["Train fails to run", "Common cause of trains"] } } },
];

const systemDefinitions = SYSTEMS.map((s) => ({
  uuid: s.id,
  name: s.name,
  description: s.topEvent,
  boundaries: s.boundaries,
  successCriteriaIds: [`SC-${s.id}`],
  missionTimeHours: s.missionHours,
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

const systemLogicModels = SYSTEMS.map((s) => ({
  uuid: `SLM-${s.id}`,
  systemReference: s.id,
  description: s.topEvent,
  modelRepresentation: s.modelRep,
  basicEvents: s.events,
  nonDetailedModelJustification: s.detailed ? undefined : "System-level data sufficient, no internal redundancy.",
  implementsSrs: srs("SY-A7", "SY-A14"),
}));

const systemBasicEvents = SYSTEMS.flatMap((s) => s.events);

const SUPPORT_MATRIX: { system: string; needs: { supporting: string; kind: string }[] }[] = [
  { system: "SYS-RPS", needs: [{ supporting: "SYS-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }] },
  { system: "SYS-DRACS", needs: [{ supporting: "SYS-DC", kind: "power" }] },
  { system: "SYS-CIS", needs: [{ supporting: "SYS-DC", kind: "power" }, { supporting: "SYS-ACT", kind: "signal" }, { supporting: "SYS-HVAC", kind: "cooling" }] },
  { system: "SYS-ACT", needs: [{ supporting: "SYS-DC", kind: "power" }, { supporting: "SYS-HVAC", kind: "cooling" }] },
  { system: "SYS-HVAC", needs: [{ supporting: "SYS-DC", kind: "power" }] },
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

const commonCauseFailureGroups = [
  { id: "CCF-DRACS-LOOP", name: "DRACS natural-circulation loops", scope: "INTRASYSTEM" as const, system: "SYS-DRACS", members: ["DRC-LP1-FR", "DRC-LP2-FR", "DRC-LP3-FR"], modelType: "ALPHA_FACTOR", shared: { hardwareDesign: true, manufacturer: true, environment: true }, basis: "Same make, same service conditions and same passive duty across the three loops.", daRef: "DA-CCF-12", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"], warn: false },
  { id: "CCF-DRACS-DMP", name: "DRACS air dampers", scope: "INTRASYSTEM" as const, system: "SYS-DRACS", members: ["DRC-DMP-1", "DRC-DMP-2", "DRC-DMP-3"], modelType: "BETA_FACTOR", shared: { hardwareDesign: true, maintenance: true }, basis: "Identical dampers serviced by one crew on one procedure.", daRef: "DA-CCF-15", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"], warn: true },
  { id: "CCF-RPS-DIV", name: "RPS trip divisions", scope: "INTRASYSTEM" as const, system: "SYS-RPS", members: ["RPS-DVA-FS", "RPS-DVB-FS"], modelType: "BETA_FACTOR", shared: { hardwareDesign: true, manufacturer: true }, basis: "Two divisions of identical design and manufacture.", daRef: "DA-CCF-04", affects: [], srs: ["SY-B1", "SY-B3", "SY-B4"], warn: false },
  { id: "CCF-DC-BATT", name: "Class-1E station batteries", scope: "INTERSYSTEM" as const, system: "SYS-DC", members: ["DC-BAT-A-FR", "DC-BAT-B-FR"], modelType: "BETA_FACTOR", shared: { manufacturer: true, environment: true, maintenance: true }, basis: "Two batteries of one make sharing one room and one maintenance schedule.", daRef: "DA-CCF-08", affects: ["SYS-RPS", "SYS-ACT", "SYS-CIS"], srs: ["SY-B2", "SY-B3", "SY-B4"], warn: false },
  { id: "CCF-ACT-SW", name: "Actuation logic software", scope: "INTERSYSTEM" as const, system: "SYS-ACT", members: ["ACT-SW-CCF"], modelType: "BETA_FACTOR", shared: { hardwareDesign: true, otherFactors: ["Common software image"] }, basis: "One software image runs the trip and isolation voting logic.", daRef: "DA-CCF-21", affects: ["SYS-RPS", "SYS-CIS"], srs: ["SY-B2", "SY-B11"], warn: true },
].map((g) => ({
  uuid: g.id,
  name: g.name,
  description: g.basis,
  scope: g.scope,
  affectedComponents: g.members,
  affectedSystems: [g.system, ...g.affects],
  modelType: g.modelType,
  dataAnalysisCCFParameterRef: g.daRef,
  members: { basicEvents: g.members.map((m) => ({ id: m })) },
  groupSelectionBasis: g.basis,
  sharedCauseFactors: g.shared,
  riskSignificanceJustification: g.warn ? "Open item against the Data Analysis parameter set." : "Modeled at CC-II as a risk-significant contributor.",
  implementsSrs: srs(...g.srs),
}));

const humanFailureEventIntegrations = [
  { id: "HFE-1", system: "SYS-DRACS", ref: "HR-PRE-014", type: "PRE_INITIATOR" as const, tm: true, task: "DRACS damper left misaligned after surveillance.", srs: ["SY-A21"] },
  { id: "HFE-2", system: "SYS-CIS", ref: "HR-POST-022", type: "POST_INITIATOR" as const, tm: false, task: "Operator fails to start the standby clean-up train.", srs: ["SY-A23"] },
  { id: "HFE-3", system: "SYS-DC", ref: "HR-PRE-009", type: "PRE_INITIATOR" as const, tm: true, task: "Battery charger left in the wrong mode after maintenance.", srs: ["SY-A21"] },
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
  { id: "CS-2", system: "SYS-CIS", component: "Clean-up train manual vent valve", crit: "b" as const, basis: "Leakage cannot defeat the isolation criterion, downstream of the boundary." },
  { id: "CS-3", system: "SYS-RPS", component: "Trip cabinet indicating lamp", crit: "b" as const, basis: "Indication only, no path to the trip function." },
  { id: "CS-4", system: "SYS-DC", component: "DC bus tie isolating link", crit: "a" as const, basis: "Failure probability 7E-7 over 24 h, support contribution checked." },
].map((c) => ({
  uuid: c.id,
  systemReference: c.system,
  componentId: c.component,
  screeningCriterion: c.crit,
  quantitativeJustification: c.basis,
  implementsSrs: srs("SY-A20"),
}));

const supportSystemSuccessCriteria = [
  { id: "SN-1", system: "SYS-DC", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-ACT", "SYS-CIS"], criterion: "One battery and one bus carry the protective loads for the mission time." },
  { id: "SN-2", system: "SYS-ACT", type: "REALISTIC" as const, supports: ["SYS-RPS", "SYS-CIS"], criterion: "Two of four voting channels generate the protective signal." },
  { id: "SN-3", system: "SYS-HVAC", type: "CONSERVATIVE" as const, supports: ["SYS-DC", "SYS-ACT"], criterion: "One cooling train holds the I&C room below its temperature limit." },
].map((n) => ({
  uuid: n.id,
  systemReference: n.system,
  successCriteria: n.criterion,
  criteriaType: n.type,
  supportedSystems: n.supports,
  implementsSrs: srs("SY-B6", "SY-B7"),
}));

const depletionModels = [
  { id: "INV-1", resource: "Class-1E DC battery", type: "battery" as const, system: "SYS-DC", capacity: 4, mission: 24, supports: false, treatment: "Load shedding extends the duty to 24 h, calculation under review." },
  { id: "INV-2", resource: "Instrument air for isolation dampers", type: "air" as const, system: "SYS-CIS", capacity: 72, mission: 72, supports: true, treatment: "Accumulator sized for the full mission time." },
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
  { uuid: "PST-PCS", name: "Primary loop natural circulation", systemReference: "SYS-PCS", description: "Buoyancy-driven flow establishes on a pump trip.", relevantPhysicalPhenomena: ["Buoyancy-driven flow", "Loop thermal centers"], uncertaintyEvaluation: "Establishment timing carried as the sensitive variable.", implementsSrs: srs("SY-A9") },
  { uuid: "PST-GV", name: "Guard vessel", systemReference: "SYS-GV", description: "Passive structural barrier that bounds a primary leak.", relevantPhysicalPhenomena: ["Structural retention"], uncertaintyEvaluation: "System-level reliability from structural analysis.", implementsSrs: srs("SY-A9") },
];

const systemConfirmationRecords = [
  { id: "CR-1", system: "SYS-DRACS", method: "DESIGN_REVIEW" as const, date: "2026-04-30", roles: ["Systems lead", "DRACS designer"], findings: "Model matches the design intent, walkdown deferred to as-built." },
  { id: "CR-2", system: "SYS-RPS", method: "DISCUSSIONS" as const, date: "2026-05-01", roles: ["Systems analyst", "I&C engineer"], findings: "Trip logic and divisions confirmed against the design package." },
  { id: "CR-3", system: "SYS-DC", method: "DESIGN_REVIEW" as const, date: "2026-05-02", roles: ["Electrical engineer", "Systems analyst"], findings: "Bus assignments confirmed, battery duty flagged for INV-1." },
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
  { id: "OC-2", system: "SYS-PCS", scenario: "Natural-circulation flow near the loop capability", treatment: "REALISTIC_JUSTIFIED" as const, basis: "Realistic capability supported by the coastdown analysis at CC-II." },
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
    dataAnalysisRef: "DA-UA-03",
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

export const SY_ANALYSIS: SystemsAnalysis = {
  uuid: "sy-generic-1",
  name: "Generic-1 Systems Analysis",
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
    scope: "Systems analysis for the Generic-1 sodium-cooled fast reactor across pre-operational plant operating states, building the system logic models that supply branch failure to Event Sequence Quantification.",
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
  praScope: "Full-scope systems analysis for the Generic-1 SFR, pre-operational stage, capability category CC-II.",
  systemDefinitions,
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
    reference: "Generic-1 dependency search procedure",
    dependencyTables: [{ tableId: "DEP-MATRIX", description: "Support-system dependency matrix" }],
    systemsAnalyzed: SYSTEMS.map((s) => s.id),
    implementsSrs: srs("SY-B5", "SY-B6"),
  },
  commonCauseFailureGroups,
  supportSystemSuccessCriteria,
  humanFailureEventIntegrations,
  simultaneousUnavailabilityEvents,
  componentScreeningJustifications,
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
    ccfGroupsAndModels: "Five common cause groups, three within a system and two across systems, consistent with the Data Analysis common cause model.",
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
};

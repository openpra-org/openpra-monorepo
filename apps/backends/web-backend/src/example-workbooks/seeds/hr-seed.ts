import {
  type HumanReliabilityAnalysis,
  type HumanFailureEvent,
  type HepQuantification,
  type HfeDependencyAssessment,
  type RecoveryAction,
} from "interfaces-mef-types/hr/human-reliability-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { type SRReference, type SRConformance, type HlrId, type PlantStage, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { HR_SR_CATALOG } from "interfaces-mef-types/hr/human-reliability-analysis";

const NOW = "2026-05-08T12:00:00.000Z";
const CREATED = "2026-04-22T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["HR-A6", "HR-G8", "HR-G12", "HR-H2"]);

const SR_EVIDENCE: Record<string, string> = {
  "HR-A7": "Operator contributions included in four support-system initiator fault trees.",
  "HR-A6": "Diverse-system reach of the RPS setpoint calibration under review.",
  "HR-B1": "Pre-initiator events screened with screening-grade criteria per state, one screened out.",
  "HR-B3": "Two multi-train calibrations protected from screening.",
  "HR-D7": "DRACS channel miscalibrations evaluated as a same-crew joint probability.",
  "HR-E4": "Five response actions identified, including an aggravating action.",
  "HR-G8": "Simulator runs for the required time of the decay-heat action pending.",
  "HR-G11": "Joint probability floor defined and justified.",
  "HR-G12": "Within-sequence dependence for one sequence still open.",
  "HR-H2": "Feasibility of two recovery actions open against the as-built plant.",
};

const conformanceMatrix: SRConformance[] = Object.keys(HR_SR_CATALOG).flatMap((code) => {
  const meta = HR_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const stages: PlantStage[] = meta.stages;
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the human reliability analysis.";
  const hlr = meta.hlr;
  const path = hlr === "A" || hlr === "B" ? "routineActivities" : hlr === "C" || hlr === "F" ? "humanFailureEvents" : hlr === "D" || hlr === "G" ? "hepQuantifications" : hlr === "E" ? "responseIdentificationReviews" : hlr === "H" ? "recoveryActions" : "documentation";
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr,
    capabilityCategory,
    applicableToStage: stages,
    status,
    satisfiedByElementPaths: [path],
    evidence,
  }));
});

const routineActivities = [
  { id: "RA-1", name: "DRACS channel calibration", activityType: "CALIBRATION" as const, description: "Quarterly calibration of the DRACS loop flow and level transmitters by one instrument crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-DRACS"], components: ["Loop 1 to 3 transmitters"], states: ["POS-1", "POS-2", "POS-6"], multiTrain: true, mechanism: "One crew on common calibration equipment across the three redundant channels.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-2", name: "DRACS damper restoration", activityType: "REALIGNMENT" as const, description: "Restoration of a single DRACS air damper to standby after surveillance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-DRACS"], components: ["Air damper, one loop"], states: ["POS-1"], multiTrain: false, srs: ["HR-A1"] },
  { id: "RA-3", name: "Battery charger restoration", activityType: "REALIGNMENT" as const, description: "Restoration of the Class-1E battery charger to the normal mode after maintenance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-DC"], components: ["Charger train A or B"], states: ["POS-1", "POS-2"], multiTrain: false, srs: ["HR-A1"] },
  { id: "RA-4", name: "RPS setpoint calibration", activityType: "CALIBRATION" as const, description: "Calibration of the RPS trip setpoints across both protection divisions.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE", "DESIGN_ENGINEER_INTERVIEW"], systems: ["SYS-RPS"], components: ["Division A and B setpoints"], states: ["POS-1"], multiTrain: true, mechanism: "Common calibration procedure and equipment applied to both divisions.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-5", name: "Confinement damper stroke test", activityType: "REALIGNMENT" as const, description: "Restoration of the confinement isolation dampers after a stroke test.", sources: ["PROCEDURES"], systems: ["SYS-CIS"], components: ["Isolation dampers"], states: ["POS-1", "POS-3"], multiTrain: false, srs: ["HR-A1"] },
  { id: "RA-6", name: "Primary pump trip-circuit calibration", activityType: "CALIBRATION" as const, description: "Calibration of the trip circuits on both primary sodium pumps by one instrument crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-PHTS"], components: ["Pump 1 and 2 trip circuits"], states: ["POS-1", "POS-2"], multiTrain: true, mechanism: "One crew on a common calibration procedure across the two primary pump trip channels.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-7", name: "Class-1E battery bank equalization", activityType: "REALIGNMENT" as const, description: "Equalization of both Class-1E battery banks in one maintenance evolution.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-DC"], components: ["Battery bank A and B"], states: ["POS-1"], multiTrain: true, mechanism: "One crew aligns both redundant battery banks in sequence during the same window.", srs: ["HR-A5"] },
].map((a) => ({
  uuid: a.id,
  name: a.name,
  activityType: a.activityType,
  description: a.description,
  identificationSources: a.sources as ("PROCEDURES" | "PLANT_PRACTICES" | "INDUSTRY_EXPERIENCE" | "DESIGN_ENGINEER_INTERVIEW")[],
  affectedSystems: a.systems,
  affectedComponents: a.components,
  applicablePlantOperatingStates: a.states,
  affectsMultipleTrainsOrDiverseSystems: a.multiTrain,
  multiTrainMechanism: a.mechanism,
  implementsSrs: srs(...a.srs),
}));

const preInitiatorScreeningRecords = [
  { id: "PS-1", activityId: "RA-1", screenedOut: false, justification: "Touches three redundant channels at once, so the multi-train prohibition forbids screening it.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-2", activityId: "RA-2", screenedOut: false, justification: "Restoration error can leave one loop unavailable, so it is carried as a defined event.", srs: ["HR-B1"] },
  { id: "PS-3", activityId: "RA-3", screenedOut: false, justification: "Charger left in the wrong mode can deplete a DC train, so it is carried forward.", srs: ["HR-B1"] },
  { id: "PS-4", activityId: "RA-4", screenedOut: false, justification: "Common calibration across both divisions is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-5", activityId: "RA-5", screenedOut: true, justification: "Stroke-test misalignment is caught by the post-test indication before any state transition.", multiState: "Administrative control detects the error before the state changes.", srs: ["HR-B1", "HR-B2"] },
].map((s) => ({
  uuid: s.id,
  activityId: s.activityId,
  screenedOut: s.screenedOut,
  criterion: "SCR-3" as const,
  justification: s.justification,
  applicableStatesVerified: true,
  multiStateAdministrativeDetectionJustification: s.multiState,
  multiTrainProhibitionRespected: true,
  implementsSrs: srs(...s.srs),
}));

const supportSystemInitiatorOperatorContributions = [
  { id: "SIC-1", system: "SYS-DC", ft: "IE-FT-DC" },
  { id: "SIC-2", system: "SYS-HVAC", ft: "IE-FT-HVAC" },
  { id: "SIC-3", system: "SYS-CW", ft: "IE-FT-CW" },
  { id: "SIC-4", system: "SYS-IA", ft: "IE-FT-IA" },
].map((s) => ({
  uuid: s.id,
  systemReference: s.system,
  faultTreeReference: s.ft,
  included: true,
  implementsSrs: srs("HR-A7"),
}));

const preHfes: HumanFailureEvent[] = [
  { id: "HR-PRE-014", name: "DRACS channel miscalibration", source: "RA-1", impact: "FUNCTION", systems: ["SYS-DRACS"], states: ["POS-1", "POS-2", "POS-6"], detect: 2160, basis: "Error sits until the next quarterly calibration.", modes: ["Flow indication biased low", "Spurious loop trip on a false reading"], miscal: true, note: "Miscalibration across the three channels from one crew on one procedure.", srs: ["HR-C1", "HR-C2", "HR-C5"] },
  { id: "HR-PRE-022", name: "DRACS damper left misaligned", source: "RA-2", impact: "TRAIN", systems: ["SYS-DRACS"], states: ["POS-1"], detect: 168, basis: "Detected at the weekly position verification.", modes: ["One loop air path blocked"], miscal: false, note: "Single-loop restoration error from the surveillance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-009", name: "Battery charger wrong mode", source: "RA-3", impact: "TRAIN", systems: ["SYS-DC"], states: ["POS-1", "POS-2"], detect: 720, basis: "Detected at the monthly battery surveillance.", modes: ["DC train slowly depletes under load"], miscal: false, note: "Charger left off the normal float mode after maintenance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-031", name: "RPS setpoint miscalibration", source: "RA-4", impact: "SYSTEM", systems: ["SYS-RPS"], states: ["POS-1"], detect: 2160, basis: "Error sits until the next quarterly setpoint check.", modes: ["Both divisions trip late or fail to trip"], miscal: true, note: "Common miscalibration of both protection divisions.", srs: ["HR-C1", "HR-C5"] },
].map((h) => ({
  uuid: h.id,
  name: h.name,
  hfeTiming: "PRE_INITIATOR" as const,
  description: h.note,
  impactLevel: h.impact as "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT",
  affectedSystems: h.systems,
  applicablePlantOperatingStates: h.states,
  preInitiatorDetail: {
    sourceActivityId: h.source,
    averageTimeToDetectionHours: h.detect,
    detectionBasis: h.basis,
    unavailabilityModes: h.modes,
    miscalibrationImpactIncluded: h.miscal,
  },
  implementsSrs: srs(...h.srs),
}));

const postHfes: HumanFailureEvent[] = [
  { id: "HR-POST-005", name: "Fails to start backup decay heat removal", timing: "POST_INITIATOR", respType: "INITIATE", impact: "FUNCTION", sc: ["SC-DHR-2"], proc: ["EOP-3 step 12"], cue: "Low DRACS flow alarm with rising core-outlet temperature.", timing2: [{ state: "POS-1", cue: 5, window: 40, basis: "Realistic thermal-hydraulics from SC-B1." }, { state: "POS-6", cue: 8, window: 55, basis: "Longer window at reduced power." }], es: "ES-SEQ-07", note: "The headline response action, demonstrated by talk-through and simulator.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-022", name: "Fails to start standby clean-up train", timing: "POST_INITIATOR", respType: "INITIATE", impact: "SYSTEM", sc: ["SC-CONF-1"], proc: ["AOP-7 step 4"], cue: "Confinement activity alarm after isolation.", timing2: [{ state: "POS-1", cue: 15, window: 120, basis: "Slow confinement build-up." }], es: "ES-SEQ-11", note: "Placed by SY unless the sequence model already carries it.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-011", name: "Fails to isolate the leaking penetration", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["SC-INV-1"], proc: ["EOP-5 step 8"], cue: "Cell leak-detection alarm with falling level.", timing2: [{ state: "POS-1", cue: 10, window: 30, basis: "Realistic level transient." }], es: "ES-SEQ-04", note: "Grouped with similar isolation actions where conditions are comparable.", srs: ["HR-F1", "HR-F3", "HR-F4"] },
  { id: "HR-AG-001", name: "Trips a running DRACS loop in error", timing: "POST_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "TRAIN", sc: [], proc: ["EOP-3 caution note"], cue: "Misread loop indication during the response.", timing2: [{ state: "POS-1", cue: null, window: null, basis: "Action that worsens the sequence, not a recovery." }], es: "ES-SEQ-07", note: "An action that makes the sequence worse is in scope, not only failure to help.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-AT-003", name: "Operator error initiates loss of DC", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Maintenance work order"], cue: "Error during DC bus maintenance.", timing2: [{ state: "POS-2", cue: null, window: null, basis: "Human-caused initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE support-system initiator.", srs: ["HR-F1"] },
].map((h) => ({
  uuid: h.id,
  name: h.name,
  hfeTiming: h.timing as "POST_INITIATOR" | "AT_INITIATOR",
  description: h.note,
  impactLevel: h.impact as "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT",
  affectedSystems: [],
  applicablePlantOperatingStates: h.timing2.map((t) => t.state),
  applicableEventSequences: h.es !== null ? [h.es] : [],
  responseDetail: {
    requiredResponse: h.name,
    responseType: h.respType as "INITIATE" | "OPERATE" | "CONTROL" | "ISOLATE" | "TERMINATE" | "AGGRAVATING_ACTION",
    successCriteriaIds: h.sc,
    procedureReferences: h.proc,
    cueDescription: h.cue,
    cueTimingBySequence: h.timing2.map((t) => ({
      eventSequenceId: h.es ?? "",
      plantOperatingStateId: t.state,
      cueTimeMinutes: t.cue ?? undefined,
      timeWindowMinutes: t.window ?? undefined,
      basis: t.basis,
    })),
  },
  implementsSrs: srs(...h.srs),
}));

const humanFailureEvents = [...preHfes, ...postHfes];

const responseIdentificationReviews = [
  { id: "RR-1", scope: "EMERGENCY_AND_ABNORMAL_PROCEDURES", sources: ["Emergency operating procedures", "Abnormal operating procedures", "Annunciator response procedures"], findings: "Found the actions to start backup decay heat removal and to start confinement clean-up.", hfes: ["HR-POST-005", "HR-POST-022"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-2", scope: "TRAINING_MATERIALS", sources: ["Operator training program", "Simulator scenario set"], findings: "Found the diagnosis cues and the isolation action for a primary leak.", hfes: ["HR-POST-011"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-3", scope: "NONNUCLEAR_FACILITY_EXPERIENCE", sources: ["Sodium test facility records", "Chemical plant control-room studies"], findings: "Borrowed diagnosis and execution evidence where the operating crew does not yet exist.", hfes: ["HR-POST-005"], srs: ["HR-E3"] },
  { id: "RR-4", scope: "OPERATIONAL_EVENTS", sources: ["Research reactor operating events", "Sodium-facility upset reports"], findings: "Identified an aggravating action where an operator trips a running loop in error.", hfes: ["HR-AG-001"], srs: ["HR-E4"] },
].map((r) => ({
  uuid: r.id,
  reviewScope: r.scope as "EMERGENCY_AND_ABNORMAL_PROCEDURES" | "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH" | "OPERATIONAL_EVENTS" | "TRAINING_MATERIALS" | "SIMILAR_FACILITY_EXPERIENCE" | "NONNUCLEAR_FACILITY_EXPERIENCE",
  sourcesReviewed: r.sources,
  findings: r.findings,
  identifiedHfeIds: r.hfes,
  implementsSrs: srs(...r.srs),
}));

const responseConfirmations = [
  { id: "CF-1", hfes: ["HR-POST-005", "HR-POST-011"], method: "PERSONNEL_REVIEW", roles: ["Operations supervisor", "Training instructor"], date: "2026-04-28", findings: "The action interpretation is consistent with operations and training intent.", srs: ["HR-E5"] },
  { id: "CF-2", hfes: ["HR-POST-005"], method: "TALK_THROUGH", roles: ["Reactor operator", "Human factors analyst"], date: "2026-05-01", findings: "Walked the decay-heat action step by step against the event sequence.", srs: ["HR-E7"] },
  { id: "CF-3", hfes: ["HR-POST-005"], method: "SIMULATION_OBSERVATION", roles: ["Crew of two", "Observer"], date: "2026-05-04", findings: "Observed the diagnosis and the execution on the engineering simulator.", srs: ["HR-E7", "HR-G8"] },
].map((c) => ({
  uuid: c.id,
  hfeIds: c.hfes,
  method: c.method as "PERSONNEL_REVIEW" | "TALK_THROUGH" | "SIMULATION_OBSERVATION",
  personnelRoles: c.roles,
  date: c.date,
  findings: c.findings,
  interpretationConsistent: true,
  implementsSrs: srs(...c.srs),
}));

const preQuant: HepQuantification[] = [
  { id: "HR-PRE-014", methodology: "Time-reliability screening, then a detailed task analysis where risk-significant.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 2.4e-3, factors: ["Common procedure step", "No independent channel readback", "Shared calibration standard"], unc: "Lognormal distribution with an error factor of 5, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
  { id: "HR-PRE-022", methodology: "Conservative screening value for a single-train restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 1.0e-2, mean: null, factors: ["Post-maintenance test credited"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D2", "HR-D5"] },
  { id: "HR-PRE-009", methodology: "Conservative screening value for a charger restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 5.0e-3, mean: null, factors: ["Monthly surveillance credited"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D6"] },
  { id: "HR-PRE-031", methodology: "Detailed assessment of a common setpoint miscalibration.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 1.1e-3, factors: ["Common procedure", "Diverse actuation provides partial backup"], unc: "Lognormal distribution with an error factor of 6, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
].map((q) => ({
  uuid: `HEPQ-${q.id}`,
  hfeId: q.id,
  methodology: q.methodology,
  assessmentType: q.type as "CONSERVATIVE_ESTIMATE" | "DETAILED_ASSESSMENT",
  isRiskSignificant: q.rs,
  pointEstimateHep: q.point ?? undefined,
  meanHep: q.mean ?? undefined,
  plantSpecificInformationUsed: q.factors,
  uncertaintyCharacterization: { riskSignificant: q.rs, method: q.unc, probabilisticRepresentationProvided: q.rs },
  implementsSrs: srs(...q.srs),
}));

const postQuant: HepQuantification[] = [
  { id: "HR-POST-005", methodology: "Detailed time-reliability analysis with performance factors.", type: "DETAILED_ASSESSMENT", rs: true, cog: 6.0e-4, exe: 2.0e-4, mean: 8.0e-4, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 40, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 5, req: 22, reqBasis: "MEASURED_SIMULATOR", psfs: [{ factor: "Workload", evaluation: "Single dedicated action, low competing demand.", impact: "DECREASE" }, { factor: "Stress", evaluation: "Elevated during the early transient.", impact: "INCREASE" }, { factor: "Training", evaluation: "Action is a trained scenario.", impact: "DECREASE" }, { factor: "Human-system interface", evaluation: "Clear alarm and dedicated control.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 4, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G4", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-022", methodology: "Conservative screening value for a slow confinement action.", type: "CONSERVATIVE_ESTIMATE", rs: false, cog: 1.0e-2, exe: 5.0e-3, mean: null, point: 1.5e-2, ind: "ASSUMED_AVAILABLE", avail: 120, availBasis: "GENERIC_STUDY", cueArr: 15, req: 30, reqBasis: "ESTIMATED", psfs: [{ factor: "Time available", evaluation: "Long window relative to the action.", impact: "DECREASE" }], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G3", "HR-G5", "HR-G7"] },
  { id: "HR-POST-011", methodology: "Detailed analysis of a short-window isolation action.", type: "DETAILED_ASSESSMENT", rs: true, cog: 3.0e-3, exe: 1.5e-3, mean: 4.5e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 30, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 10, req: 18, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short window against the required time.", impact: "INCREASE" }, { factor: "Accessibility", evaluation: "Local action in a normal-access cell.", impact: "NEUTRAL" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
].map((q) => ({
  uuid: `HEPQ-${q.id}`,
  hfeId: q.id,
  methodology: q.methodology,
  assessmentType: q.type as "CONSERVATIVE_ESTIMATE" | "DETAILED_ASSESSMENT",
  isRiskSignificant: q.rs,
  pointEstimateHep: q.point ?? undefined,
  meanHep: q.mean ?? undefined,
  cognitionContribution: q.cog,
  executionContribution: q.exe,
  performanceShapingFactors: q.psfs.map((p) => ({ factor: p.factor, evaluation: p.evaluation, impactOnHep: p.impact as "INCREASE" | "DECREASE" | "NEUTRAL" })),
  indicationsTreatment: q.ind as "ASSUMED_AVAILABLE" | "EVALUATED_PER_SEQUENCE",
  timeAvailableMinutes: q.avail,
  timeAvailableBasis: q.availBasis as "GENERIC_STUDY" | "REALISTIC_PLANT_SPECIFIC_ANALYSIS",
  cueArrivalTimeMinutes: q.cueArr,
  timeRequiredMinutes: q.req,
  timeRequiredBasis: q.reqBasis as "ESTIMATED" | "MEASURED_TALK_THROUGH" | "MEASURED_SIMULATOR",
  uncertaintyCharacterization: { riskSignificant: q.rs, method: q.unc, probabilisticRepresentationProvided: q.rs },
  implementsSrs: srs(...q.srs),
}));

const hepQuantifications = [...preQuant, ...postQuant];

const preInitiatorRecoveryCredits = [
  { id: "HR-PRE-014", credit: "INDEPENDENT_VERIFICATION", max: 0.1, srs: ["HR-D5", "HR-D6"] },
  { id: "HR-PRE-022", credit: "POST_MAINTENANCE_TEST", max: 0.1, srs: ["HR-D5"] },
  { id: "HR-PRE-009", credit: "WORK_SUPERVISION_CHECK", max: 0.1, srs: ["HR-D6"] },
  { id: "HR-PRE-031", credit: "INDEPENDENT_VERIFICATION", max: 0.1, srs: ["HR-D5", "HR-D6"] },
].map((r) => ({
  uuid: `PRC-${r.id}`,
  hfeId: r.id,
  recoveryFactorsMethodologyConsistent: true,
  maximumCreditSpecified: r.max,
  creditBases: [r.credit] as ("POST_MAINTENANCE_TEST" | "INDEPENDENT_VERIFICATION" | "WORK_SUPERVISION_CHECK" | "OPERATOR_ROUNDS")[],
  implementsSrs: srs(...r.srs),
}));

const dependencyAssessments: HfeDependencyAssessment[] = [
  {
    uuid: "PD-1",
    scope: "PRE_INITIATOR_SET",
    hfeIds: ["HR-PRE-014"],
    commonElements: ["Same crew", "Same shift", "One procedure", "Shared standard"],
    dependenceLevel: "HIGH",
    jointHep: 1.8e-3,
    implementsSrs: srs("HR-D7"),
  },
  {
    uuid: "DEP-1",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-005", "HR-POST-011"],
    eventSequenceId: "ES-SEQ-07",
    commonElements: ["Same crew", "Same timeframe", "Shared diagnosis"],
    dependenceLevel: "MODERATE",
    jointHep: 4.0e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-2",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-AT-003", "REC-2"],
    eventSequenceId: "ES-SEQ-02",
    commonElements: ["Same operator", "Same DC work", "Recovery of a self-caused loss"],
    dependenceLevel: "HIGH",
    jointHep: 1.0e-5,
    belowFloor: true,
    floorAppliedOrJustification: "Held at the floor under HR-G13.",
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: true,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
];

const recoveryActions: RecoveryAction[] = [
  { id: "REC-1", name: "Restore decay heat removal from the remote panel", hfeId: "HR-POST-005", level: "SEQUENCE", fn: "Decay-heat removal", seqs: ["ES-SEQ-07"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: true, equipment: true }, preop: null, hep: "REC-Q-1", dep: null, srs: ["HR-H1", "HR-H2", "HR-H4"] },
  { id: "REC-2", name: "Recover DC by manual cross-tie", hfeId: "HR-AT-003", level: "SEQUENCE", fn: "Class-1E DC power", seqs: ["ES-SEQ-02"], feas: { procedure: true, training: true, cues: true, manpower: false, time: true, accessibility: true, equipment: true }, preop: "Manpower assumption for the off-shift case logged until staffing is set.", hep: "REC-Q-2", dep: "DEP-2", srs: ["HR-H2", "HR-H3", "HR-H5"] },
  { id: "REC-3", name: "Re-open a mis-restored DRACS damper", hfeId: "HR-PRE-022", level: "CUTSET", fn: "DRACS air path", seqs: ["ES-SEQ-07"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: false, equipment: true }, preop: "Local access during the event under review against the as-built layout.", hep: "REC-Q-3", dep: null, srs: ["HR-H2", "HR-H3"] },
].map((r) => ({
  uuid: r.id,
  name: r.name,
  hfeId: r.hfeId,
  appliedAtLevel: r.level as "CUTSET" | "SCENARIO" | "SEQUENCE",
  restoredFunction: r.fn,
  appliedToSequenceIds: r.seqs,
  feasibility: {
    procedureOrGuidanceAvailable: r.feas.procedure,
    trainingIncluded: r.feas.training,
    cuesAvailable: r.feas.cues,
    manpowerAvailable: r.feas.manpower,
    timeAvailable: r.feas.time,
    accessibilityConfirmed: r.feas.accessibility,
    equipmentAvailable: r.feas.equipment,
  },
  preOperationalFeasibilityJustification: r.preop ?? undefined,
  hepQuantificationId: r.hep,
  dependencyAssessmentId: r.dep ?? undefined,
  implementsSrs: srs(...r.srs),
}));

const preOperationalAssumptions = [
  { id: "PA-1", area: "Pre-initiator identification", desc: "Activities taken from planned procedures, to confirm against operation.", sr: "HR-A10", path: "routineActivities" },
  { id: "PA-2", area: "Response identification", desc: "Actions taken from planned procedures and borrowed experience.", sr: "HR-E9", path: "responseIdentificationReviews" },
  { id: "PA-3", area: "Quantification", desc: "Timing from design analysis, to re-measure on the as-built simulator.", sr: "HR-G16", path: "hepQuantifications" },
  { id: "PA-4", area: "Recovery", desc: "Feasibility assumptions logged where they cannot yet be shown.", sr: "HR-H6", path: "recoveryActions" },
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

export const HR_ANALYSIS: HumanReliabilityAnalysis = {
  uuid: "hr-generic-1",
  name: "Generic-1 Human Reliability Analysis",
  type: TechnicalElementTypes.HUMAN_RELIABILITY_ANALYSIS,
  version: "2",
  created: CREATED,
  modified: NOW,
  owner: "aosei",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "aosei" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "2", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["aosei", "tvrba", "ytanaka"],
    reviewers: [
      { id: "rev-1", name: "Dr. Nadia Hartwell", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Claire Dubois", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Operations & Procedures", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Raj Malhotra", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, Human Reliability & Dependence", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Human reliability analysis for the Generic-1 sodium-cooled fast reactor, modeling human failure events before, at and after the initiating event and quantifying their probabilities.",
    limitations: ["Pre-operational: activities, actions and timing rest on planned procedures and borrowed experience pending as-built confirmation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "aosei",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "hrc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T09:14:00.000Z", associatedSr: "HR-G8", text: "The decay-heat action is risk-significant, so HR-G8 needs the required time measured on the simulator rather than estimated, with enough runs to characterize the spread.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T10:30:00.000Z", associatedSr: "HR-G12", text: "The diagnosis error and the isolation error share a crew and a timeframe, so HR-G12 needs the within-sequence joint probability calculated and checked against the floor under HR-G13.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-07T14:05:00.000Z", associatedSr: "HR-H2", text: "The DC cross-tie recovery rests on an off-shift manpower assumption, so HR-H2 needs the feasibility shown or HR-H3 applied to leave it out until staffing is set.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-07T15:20:00.000Z", associatedSr: "HR-A6", text: "The RPS setpoint calibration may reach the diverse actuation, so HR-A6 needs the diverse-system reach confirmed so the activity stays protected from screening under HR-B3.", severity: "MINOR", resolved: false },
      { uuid: "hrc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-07T16:00:00.000Z", associatedSr: "HR-B3", text: "The multi-train prohibition is applied consistently to the DRACS and RPS calibrations.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the prohibition is applied consistently.", resolvedAt: "2026-05-07T17:30:00.000Z", resolvedBy: "rev-1" },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope human reliability analysis for the Generic-1 SFR, pre-operational stage, capability category CC-II.",
  routineActivities,
  preInitiatorScreeningRecords,
  supportSystemInitiatorOperatorContributions,
  humanFailureEvents,
  responseIdentificationReviews,
  responseConfirmations,
  hepQuantifications,
  preInitiatorRecoveryCredits,
  jointHepFloor: {
    uuid: "JHF-1",
    minimumJointProbability: 1.0e-5,
    justification: "A crew that has already made an error is not independent, so the joint value is held at or above this floor unless a lower value is justified.",
    implementsSrs: srs("HR-G11"),
  },
  dependencyAssessments,
  hepConsistencyReviews: [
    {
      uuid: "HCR-1",
      hfeIdsReviewed: ["HR-POST-005", "HR-POST-011", "HR-POST-022", "HR-PRE-014"],
      relativeReasonablenessConfirmed: true,
      basis: "SIMILAR_PLANT_AND_SCENARIO_CONTEXT",
      findings: "The short-window actions carry higher values than the long-window actions, which is reasonable.",
      implementsSrs: srs("HR-G9", "HR-G10"),
    },
  ],
  recoveryActions,
  plantRepresentationAccuracy: {
    scope: "PRE_OPERATIONAL",
    accuracy: ImportanceLevel.MEDIUM,
    basis: "Activities and actions rest on planned procedures and borrowed experience, confirmed by personnel review and, where risk-significant, by talk-through and simulator observation.",
    detailConsistentWithPlant: true,
    sufficientForRiskSignificantContributors: true,
    sufficiencyJustification: "Level of detail set against the available design and procedure information, sufficient to surface the risk-significant human failure events.",
    highConfidenceAreas: ["Pre-initiator identification", "Response identification"],
    lowerConfidenceAreas: ["Measured required time", "Within-sequence dependence", "Recovery feasibility"],
    improvementPlans: ["Measure required times on the as-built simulator and confirm recovery feasibility against the as-built plant."],
    implementsSrs: srs("HR-A8", "HR-G2", "HR-G10"),
  },
  modelUncertainty: {
    uuid: "hr-mu-1",
    name: "HR model uncertainty documentation",
    uncertaintySources: [
      { source: "Pre to post-initiator dependence", impact: "Carried as an uncertainty source and tested by sensitivity." },
      { source: "Borrowed nonnuclear human-performance data", impact: "Applicability bounded until plant-specific evidence exists." },
      { source: "Required-time measurement spread", impact: "Simulator spread carried until more runs are collected." },
      { source: "Pre-initiator detection interval", impact: "Exposure window assumed from the surveillance plan." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  sensitivityStudies: [
    { uuid: "SS-1", name: "Dependence sweep", description: "Dependence sweep across the human action set.", variedParameters: ["Dependence level"], parameterRanges: { "Dependence level": [0, 1] }, results: "The sequence result holds within a factor of two across the dependence range." },
    { uuid: "SS-2", name: "Time-available sweep", description: "Time available against the required time.", variedParameters: ["Time available minutes"], parameterRanges: { "Time available (min)": [30, 60] }, results: "The decay-heat action stays below the screening value across the timing band." },
  ],
  documentation: {
    processDescription: "Human failure events modeled at three moments relative to the initiating event, identified, defined and quantified by a systematic process, per ASME/ANS RA-S-1.4 HLR-HR-A through I.",
    preInitiatorIdentificationProcess: "Routine realignment and calibration activities found through procedures, plant practices and industry experience, with the multi-train work flagged.",
    screeningCriteriaAndResults: "Pre-initiator events screened with screening-grade criteria per operating state, with the multi-train activities protected from screening.",
    hfeDefinitions: "Each human failure event defined at the function, system, train or component level, with its undetected interval, unavailability modes, cue timing, time window and context.",
    responseIdentificationReviews: "Procedures, system information and training reviewed to find the response actions, with applicable nonnuclear experience borrowed at the pre-operational stage.",
    confirmationActivities: "Action interpretation reviewed with staff at CC-I and confirmed by talk-through and simulator observation at CC-II.",
    hepMethodologies: "Conservative estimates at CC-I and detailed assessments for risk-significant events at CC-II, with the cognition and the execution addressed and the methods cited.",
    performanceShapingFactorTreatment: "Plant and scenario-specific performance factors evaluated for the detailed assessments at CC-II.",
    timingAnalysisBases: "Time available from generic studies at CC-I and realistic design-specific analysis at CC-II, with the required time measured for risk-significant events.",
    dependenceTreatmentAndJointFloor: "Dependence handled at five points, with a minimum joint probability floor applied where the calculated joint falls below it.",
    recoveryActionFeasibilityAndCredit: "Recovery credited only where feasibility is demonstrated, with the coupling to the cause carried explicitly.",
    consistencyReviewResults: "Human error probabilities confirmed to make relative sense across the scenario set.",
    modelUncertaintySources: "Model-uncertainty sources include pre to post dependence, borrowed nonnuclear data, the required-time spread and the pre-initiator detection interval.",
    asBuiltLimitations: "Pre-operational: activities, actions, timing and recovery feasibility rest on design and procedure information pending as-built and as-operated confirmation.",
    praTaskInterfaces: "Interfaces with POS, ES, SC and SY for context and placement, with IE for operator-caused initiators, with DA for parameters, and with ESQ which multiplies the probabilities through the sequences.",
    implementsSrs: srs("HR-I1"),
  },
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-081", "NM-066", "NM-074"],
};

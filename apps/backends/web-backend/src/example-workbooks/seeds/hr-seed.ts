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

const WARN_SRS = new Set<string>(["HR-A6", "HR-G8", "HR-H2"]);

const SR_EVIDENCE: Record<string, string> = {
  "HR-A7": "Operator contributions included in two support-system initiator fault trees.",
  "HR-A6": "Diverse-system reach of the RPS setpoint calibration under review.",
  "HR-B1": "Pre-initiator events screened with screening-grade criteria per state, one screened out.",
  "HR-B3": "Multi-train work practices protected from screening and carried as defined events.",
  "HR-D7": "DRACS channel miscalibrations evaluated as a same-crew joint probability.",
  "HR-E4": "Every response action identified across procedure, planned-procedure, training and operational-event reviews, including two aggravating actions.",
  "HR-G8": "Simulator runs for the required time of the decay-heat action pending.",
  "HR-G11": "Joint probability floor defined and justified.",
  "HR-G12": "Within-sequence dependence assessed for the diagnosis-alignment pair and the leak-family chains, with the recovery couplings carried explicitly.",
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
  { id: "RA-1", name: "DRACS channel calibration", activityType: "CALIBRATION" as const, description: "Quarterly calibration of the DRACS loop flow and level transmitters by one instrument crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-DRACS"], components: ["Loop 1 to 3 transmitters"], states: ["POS-01", "POS-02", "POS-06"], multiTrain: true, mechanism: "One crew on common calibration equipment across the three redundant channels.", preOp: "Taken from the draft DRACS calibration and surveillance procedures and the loop instrument list, to be confirmed against the surveillance schedule in operation.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-2", name: "DRACS damper restoration", activityType: "REALIGNMENT" as const, description: "Restoration of a single DRACS air damper to standby after surveillance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-DRACS"], components: ["Air damper, one loop"], states: ["POS-01"], multiTrain: false, preOp: "Taken from the draft DRACS surveillance restoration steps, to be confirmed against the position-verification practice in operation.", srs: ["HR-A1"] },
  { id: "RA-3", name: "Battery charger restoration", activityType: "REALIGNMENT" as const, description: "Restoration of the Class-1E battery charger to the normal mode after maintenance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-1E-DC"], components: ["Charger train A or B"], states: ["POS-01", "POS-02"], multiTrain: false, preOp: "Taken from the draft Class-1E DC maintenance procedure, to be confirmed against the charger line-up practice in operation.", srs: ["HR-A1"] },
  { id: "RA-4", name: "RPS setpoint calibration", activityType: "CALIBRATION" as const, description: "Calibration of the RPS trip setpoints across both protection divisions.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE", "DESIGN_ENGINEER_INTERVIEW"], systems: ["SYS-RPS"], components: ["Division A and B setpoints"], states: ["POS-01"], multiTrain: true, mechanism: "Common calibration procedure and equipment applied to both divisions.", preOp: "Taken from the draft RPS setpoint calibration procedure and a design-engineer interview on the two-division setup, to be confirmed against operation.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-5", name: "Confinement damper stroke test", activityType: "REALIGNMENT" as const, description: "Restoration of the confinement isolation dampers after a stroke test.", sources: ["PROCEDURES"], systems: ["SYS-CONF"], components: ["Isolation dampers"], states: ["POS-01", "POS-03"], multiTrain: false, preOp: "Taken from the draft confinement isolation surveillance procedure, to be confirmed against the post-test verification practice in operation.", srs: ["HR-A1"] },
  { id: "RA-6", name: "Primary pump trip-circuit calibration", activityType: "CALIBRATION" as const, description: "Calibration of the trip circuits on both primary sodium pumps by one instrument crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-PRIMARY"], components: ["Pump 1 and 2 trip circuits"], states: ["POS-01", "POS-02"], multiTrain: true, mechanism: "One crew on a common calibration procedure across the two primary pump trip channels.", preOp: "Taken from the draft primary-pump trip-circuit calibration procedure and the pump protection design, to be confirmed against operation.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-7", name: "Class-1E battery bank equalization", activityType: "REALIGNMENT" as const, description: "Equalization of both Class-1E battery banks in one maintenance evolution.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-1E-DC"], components: ["Battery bank A and B"], states: ["POS-01"], multiTrain: true, mechanism: "One crew aligns both redundant battery banks in sequence during the same window.", preOp: "Taken from the draft Class-1E battery equalization procedure, to be confirmed against the maintenance-window practice in operation.", srs: ["HR-A5"] },
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
  preOperationalIdentificationProcess: a.preOp,
  implementsSrs: srs(...a.srs),
}));

const preInitiatorScreeningRecords = [
  { id: "PS-1", activityId: "RA-1", screenedOut: false, justification: "Touches three redundant channels at once, so the multi-train prohibition forbids screening it.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-2", activityId: "RA-2", screenedOut: false, justification: "Restoration error can leave one loop unavailable, so it is carried as a defined event.", srs: ["HR-B1"] },
  { id: "PS-3", activityId: "RA-3", screenedOut: false, justification: "Charger left in the wrong mode can deplete a DC train, so it is carried forward.", srs: ["HR-B1"] },
  { id: "PS-4", activityId: "RA-4", screenedOut: false, justification: "Common calibration across both divisions is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-5", activityId: "RA-5", screenedOut: true, justification: "Stroke-test misalignment is caught by the post-test indication before any state transition (Data Analysis TC-2, both change-of-state modes exercised).", multiState: "Administrative control detects the error before the state changes.", srs: ["HR-B1", "HR-B2"] },
  { id: "PS-6", activityId: "RA-6", screenedOut: false, justification: "Common calibration across both primary pump trip channels is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-7", activityId: "RA-7", screenedOut: false, justification: "Aligning both redundant battery banks in one evolution is multi-train, so it may not be screened out (coincident two-train work carried in Data Analysis CM-1).", srs: ["HR-B1", "HR-B3"] },
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
  { id: "SIC-1", system: "SYS-1E-DC", ft: "IE-20" },
  { id: "SIC-2", system: "SYS-SDHR", ft: "IE-21" },
].map((s) => ({
  uuid: s.id,
  systemReference: s.system,
  faultTreeReference: s.ft,
  included: true,
  implementsSrs: srs("HR-A7"),
}));

const preHfes: HumanFailureEvent[] = [
  { id: "HR-PRE-014", name: "DRACS channel miscalibration", source: "RA-1", impact: "FUNCTION", systems: ["SYS-DRACS"], components: ["Loop 1 to 3 transmitters"], states: ["POS-01", "POS-02", "POS-06"], detect: 2160, basis: "Error sits until the next quarterly calibration.", modes: ["Flow indication biased low", "Spurious loop trip on a false reading"], miscal: true, note: "Miscalibration across the three channels from one crew on one procedure.", srs: ["HR-C1", "HR-C2", "HR-C5"] },
  { id: "HR-PRE-022", name: "DRACS damper left misaligned", source: "RA-2", impact: "TRAIN", systems: ["SYS-DRACS"], components: ["Air damper, one loop"], states: ["POS-01"], detect: 168, basis: "Detected at the weekly position verification.", modes: ["One loop air path blocked"], miscal: false, note: "Single-loop restoration error from the surveillance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-009", name: "Battery charger wrong mode", source: "RA-3", impact: "TRAIN", systems: ["SYS-1E-DC"], components: ["Charger train A or B"], states: ["POS-01", "POS-02"], detect: 720, basis: "Detected at the monthly battery surveillance.", modes: ["DC train slowly depletes under load"], miscal: false, note: "Charger left off the normal float mode after maintenance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-031", name: "RPS setpoint miscalibration", source: "RA-4", impact: "SYSTEM", systems: ["SYS-RPS"], components: ["Division A and B setpoints"], states: ["POS-01"], detect: 2160, basis: "Error sits until the next quarterly setpoint check.", modes: ["Both divisions trip late or fail to trip"], miscal: true, note: "Common miscalibration of both protection divisions.", srs: ["HR-C1", "HR-C5"] },
  { id: "HR-PRE-018", name: "Primary pump trip-circuit miscalibration", source: "RA-6", impact: "SYSTEM", systems: ["SYS-PRIMARY"], components: ["Pump 1 and 2 trip circuits"], states: ["POS-01", "POS-02"], detect: 2160, basis: "Error sits until the next quarterly trip-circuit calibration.", modes: ["Both pump trip setpoints biased", "Pump trip on demand delayed or blocked"], miscal: true, note: "Common miscalibration of both primary pump trip channels from one crew on one procedure.", srs: ["HR-C1", "HR-C2", "HR-C5"] },
  { id: "HR-PRE-041", name: "Battery bank equalization error", source: "RA-7", impact: "SYSTEM", systems: ["SYS-1E-DC"], components: ["Battery bank A and B"], states: ["POS-01"], detect: 720, basis: "Detected at the monthly battery surveillance.", modes: ["Both DC banks held off the normal float mode", "Reduced DC capacity under load"], miscal: false, note: "Both redundant battery banks aligned by one crew in the same maintenance evolution.", srs: ["HR-C1", "HR-C4"] },
].map((h) => ({
  uuid: h.id,
  name: h.name,
  hfeTiming: "PRE_INITIATOR" as const,
  description: h.note,
  impactLevel: h.impact as "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT",
  affectedSystems: h.systems,
  affectedComponents: h.components,
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
  { id: "HR-POST-004", systems: ["SYS-SDHR"], name: "Fails to diagnose the loss of heat sink", timing: "POST_INITIATOR", respType: "CONTROL", impact: "FUNCTION", sc: ["HAC-1"], proc: ["EOP-3 step 4"], cue: "Loss-of-heat-sink alarm with falling intermediate-loop flow.", timing2: [{ state: "POS-01", cue: 10, window: 200, basis: "Diagnosis window from the loss-of-heat-sink alarm, 12 minutes required (HAC-1)." }, { state: "POS-02", cue: 10, window: 190, basis: "Diagnosis window in reduced and experimental power (ET-OCOOL-P02)." }, { state: "POS-03", cue: 10, window: 200, basis: "Diagnosis window in hot standby (ET-TRANS-P03)." }], es: "ESF-LATE", note: "The loss-of-heat-sink diagnosis the backup alignment depends on, carried as HFE-08 in the Event Sequence action windows and the Success Criteria.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-005", systems: ["SYS-SDHR", "SYS-DRACS"], name: "Fails to start backup decay heat removal", timing: "POST_INITIATOR", respType: "INITIATE", impact: "FUNCTION", sc: ["HAC-2"], proc: ["EOP-3 step 12"], cue: "Low DRACS flow alarm with rising core-outlet temperature.", timing2: [{ state: "POS-07", cue: 30, window: 240, basis: "Post-trip natural circulation, the risk-significant state, with a wide window at low decay heat (ET-LDHR)." }, { state: "POS-01", cue: 25, window: 160, basis: "Cue arrival and window consistent with the Event Sequence action window and the Success Criteria time available (HAC-2)." }, { state: "POS-02", cue: 25, window: 150, basis: "Reduced and experimental power, shorter window at higher decay heat (ET-OCOOL)." }, { state: "POS-03", cue: 25, window: 180, basis: "Hot standby decay-heat window (ET-TRANS)." }, { state: "POS-04", cue: 28, window: 210, basis: "Auxiliary-pump decay heat removal window (ET-LDHR-P04)." }, { state: "POS-05", cue: 35, window: 300, basis: "Cold shutdown, wide window at low decay heat (ET-LDHR)." }, { state: "POS-06", cue: 30, window: 200, basis: "Longer window in long-term shutdown with low decay heat." }], es: "ESF-LATE", note: "The headline response action, demonstrated by talk-through and simulator, following the loss-of-heat-sink diagnosis (HR-POST-004) and carried as HFE-12 in the Event Sequence action windows and the Success Criteria.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-022", systems: ["SYS-CONF"], name: "Fails to start standby clean-up train", timing: "POST_INITIATOR", respType: "INITIATE", impact: "SYSTEM", sc: ["SYS-CONF"], proc: ["AOP-7 step 4"], cue: "Confinement activity alarm after isolation.", timing2: [{ state: "POS-01", cue: 15, window: 120, basis: "Slow confinement build-up." }, { state: "POS-02", cue: 15, window: 120, basis: "Confinement clean-up window in reduced power (ET-RCB-P02)." }, { state: "POS-03", cue: 15, window: 125, basis: "Confinement clean-up window in hot standby (ET-RCB-P03)." }, { state: "POS-04", cue: 16, window: 130, basis: "Confinement clean-up window on auxiliary-pump cooling (ET-RCB-P04)." }, { state: "POS-05", cue: 18, window: 140, basis: "Confinement clean-up window during refuelling (ET-CGAS-P05)." }, { state: "POS-06", cue: 18, window: 140, basis: "Confinement clean-up window in long-term shutdown (ET-CGAS-P06)." }, { state: "POS-07", cue: 16, window: 130, basis: "Confinement clean-up window in post-trip natural circulation (ET-RCB-P07)." }, { state: "POS-08", cue: 16, window: 130, basis: "Confinement clean-up window in the maintenance state (ET-RCB-P08)." }, { state: "POS-09", cue: 18, window: 150, basis: "Confinement clean-up window with the intermediate loop isolated (ET-CGAS-P09)." }], es: "ESF-LEAK", note: "Placed by SY unless the sequence model already carries it.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-011", systems: ["SYS-ISOL", "SYS-GUARD"], name: "Fails to isolate the leaking penetration", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["SYS-GUARD"], proc: ["EOP-5 step 8"], cue: "Cell leak-detection alarm with falling level.", timing2: [{ state: "POS-01", cue: 10, window: 30, basis: "Realistic level transient." }, { state: "POS-02", cue: 10, window: 30, basis: "Penetration isolation window in reduced power (ET-RCB-P02)." }, { state: "POS-03", cue: 10, window: 32, basis: "Penetration isolation window in hot standby (ET-RCB-P03)." }, { state: "POS-04", cue: 11, window: 34, basis: "Penetration isolation window on auxiliary-pump cooling (ET-RCB-P04)." }, { state: "POS-05", cue: 12, window: 38, basis: "Penetration isolation window during refuelling (ET-RCB-P05)." }, { state: "POS-06", cue: 12, window: 38, basis: "Penetration isolation window in long-term shutdown (ET-RCB-P06)." }, { state: "POS-07", cue: 11, window: 34, basis: "Penetration isolation window in post-trip natural circulation (ET-RCB-P07)." }, { state: "POS-08", cue: 11, window: 34, basis: "Penetration isolation window in the maintenance state (ET-RCB-P08)." }], es: "ESF-LEAK", note: "Grouped with similar isolation actions where conditions are comparable.", srs: ["HR-F1", "HR-F3", "HR-F4"] },
  { id: "HR-AG-001", systems: ["SYS-DRACS"], name: "Trips a running DRACS loop in error", timing: "POST_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "TRAIN", sc: [], proc: ["EOP-3 caution note"], cue: "Misread loop indication during the response.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Action that worsens the sequence, not a recovery." }], es: "ESF-LATE", note: "An action that makes the sequence worse is in scope, not only failure to help.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-AT-003", systems: ["SYS-1E-DC"], name: "Operator error initiates loss of constant power", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Maintenance work order"], cue: "Error during constant-power supply maintenance.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused loss-of-constant-power initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused loss-of-constant-power initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused loss-of-constant-power initiator quantified here and supplied to IE." }, { state: "POS-04", cue: null, window: null, basis: "Human-caused loss-of-constant-power initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE loss-of-constant-power initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-004", systems: ["SYS-PRIMARY"], name: "Operator-induced overcooling maneuver", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Primary flow-control work order"], cue: "Error during a primary or secondary flow-control maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused overcooling initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused overcooling initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator overcooling moment, connected to the IE operator-induced overcooling initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-005", systems: ["SYS-CONF"], name: "Operator refuelling subassembly mis-loading", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Refuelling line-up work order"], cue: "Error during a refuelling subassembly loading or orificing step.", timing2: [{ state: "POS-05", cue: null, window: null, basis: "Human-caused refuelling initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator refuelling commission moment, connected to the IE fuel-handling initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-006", systems: ["SYS-SDHR"], name: "Operator inadvertent secondary-sodium dump", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Secondary sodium line-up work order"], cue: "Error during a secondary-sodium line-up or dump-valve maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused loss-of-intermediate-heat-removal initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused loss-of-intermediate-heat-removal initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused loss-of-intermediate-heat-removal initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE inadvertent secondary-sodium dump initiator and the operator-induced heat-removal trees (ET-OPIHR).", srs: ["HR-F1"] },
  { id: "HR-AT-007", systems: ["SYS-RPS"], name: "Erroneous control rod withdrawal at power", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Rod maneuver procedure"], cue: "Error during a rod or rod-group maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator rod-withdrawal moment, connected to the IE erroneous-withdrawal initiator, terminated by the protection system.", srs: ["HR-F1"] },
  { id: "HR-POST-025", systems: ["SYS-ISOL"], name: "Fails to isolate the primary leak segment", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["SYS-GUARD"], proc: ["EOP-5 step 10"], cue: "Guard-vessel level and cell leak-detection alarm.", timing2: [{ state: "POS-01", cue: 12, window: 45, basis: "Realistic level transient from the guard-vessel analysis." }, { state: "POS-02", cue: 12, window: 45, basis: "Segment isolation window in reduced power (ET-RCB-P02, ET-LOCF-P02)." }, { state: "POS-03", cue: 12, window: 48, basis: "Segment isolation window in hot standby (ET-RCB-P03)." }, { state: "POS-04", cue: 13, window: 50, basis: "Segment isolation window on auxiliary-pump cooling (ET-RCB-P04)." }, { state: "POS-05", cue: 14, window: 55, basis: "Segment isolation window during refuelling (ET-RCB-P05)." }, { state: "POS-06", cue: 14, window: 55, basis: "Segment isolation window in long-term shutdown (ET-RCB-P06)." }, { state: "POS-07", cue: 13, window: 50, basis: "Segment isolation window in post-trip natural circulation (ET-RCB-P07)." }, { state: "POS-08", cue: 13, window: 50, basis: "Segment isolation window in the maintenance state (ET-RCB-P08)." }], es: "ESF-LEAK", note: "Placed by Systems Analysis in the leak-isolation model (SYS-ISOL).", srs: ["HR-F1", "HR-F3", "HR-F4"] },
  { id: "HR-POST-026", systems: ["SYS-MAKEUP"], name: "Fails to initiate sodium make-up", timing: "POST_INITIATOR", respType: "INITIATE", impact: "SYSTEM", sc: ["OSC-RCB"], proc: ["EOP-6 step 3"], cue: "Falling pool level after a confirmed drain-down.", timing2: [{ state: "POS-05", cue: 20, window: 90, basis: "Refuelling drain-down make-up window against the bounded rate (ET-DRAIN-P05, IEG-12)." }, { state: "POS-06", cue: 25, window: 120, basis: "Refuelling drain-down make-up window in long-term shutdown (ET-DRAIN-P06, IEG-12)." }], es: "ESF-LEAK", note: "Placed by Systems Analysis in the sodium make-up model (SYS-MAKEUP); credited in the refuelling drain-down sequences.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-027", systems: ["SYS-SUPP"], name: "Fails to respond to the sodium fire", timing: "POST_INITIATOR", respType: "CONTROL", impact: "FUNCTION", sc: ["OSC-HZ"], proc: ["AOP-9 step 2"], cue: "Sodium fire and smoke detection alarm in the cell.", timing2: [{ state: "POS-01", cue: 5, window: 30, basis: "Detection-to-suppression window from the fire analysis." }, { state: "POS-08", cue: 5, window: 25, basis: "Sodium fire during the shutdown-cooler-out-of-service maintenance state (ET-FIRE-P08)." }], es: "ESF-LEAK", note: "Placed by Systems Analysis in the fire-suppression model (SYS-SUPP).", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-028", systems: ["SYS-ISOL"], name: "Fails to detect and terminate the drain-down on the level alarm", timing: "POST_INITIATOR", respType: "TERMINATE", impact: "TRAIN", sc: ["OSC-RCB"], proc: ["EOP-4 step 2"], cue: "Cell level alarm indicating a drain-down.", timing2: [{ state: "POS-01", cue: 5, window: 30, basis: "Detect and terminate the source before the drain propagates (ET-LOCF)." }, { state: "POS-02", cue: 5, window: 30, basis: "Detection window in reduced power (ET-LOCF-P02)." }, { state: "POS-05", cue: 8, window: 45, basis: "Refuelling drain-down detection window (ET-DRAIN)." }, { state: "POS-06", cue: 8, window: 45, basis: "Refuelling drain-down detection window (ET-DRAIN)." }], es: "ESF-LEAK", note: "Detect the level fault on the alarm and terminate the source, preceding the isolation and make-up branches.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-031", systems: ["SYS-ISOL"], name: "Fails to isolate the sodium-water reaction", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: [], proc: ["SWR procedure step 2"], cue: "Sodium-water reaction detection alarm.", timing2: [{ state: "POS-01", cue: 5, window: 30, basis: "Isolate the affected steam-generator module before the reaction propagates (ET-SWR-P01)." }, { state: "POS-02", cue: 5, window: 30, basis: "Sodium-water reaction isolation window in reduced power (ET-SWR-P02)." }, { state: "POS-03", cue: 5, window: 35, basis: "Sodium-water reaction isolation window in hot standby (ET-SWR-P03)." }, { state: "POS-04", cue: 6, window: 40, basis: "Sodium-water reaction isolation window on auxiliary-pump cooling (ET-SWR-P04)." }], es: "ESF-LEAK", note: "Isolate and blow down the affected module on the reaction alarm, the isolation branch of the sodium-water reaction trees.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-032", systems: ["SYS-CONF"], name: "Fails to isolate the cover-gas breach", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "SYSTEM", sc: [], proc: ["Cover-gas procedure step 3"], cue: "Cover-gas activity and pressure alarm.", timing2: [{ state: "POS-01", cue: 8, window: 40, basis: "Cover-gas isolation window at power (ET-CGAS-P01)." }, { state: "POS-02", cue: 8, window: 40, basis: "Cover-gas isolation window in reduced power (ET-CGAS-P02)." }, { state: "POS-03", cue: 8, window: 42, basis: "Cover-gas isolation window in hot standby (ET-CGAS-P03)." }, { state: "POS-04", cue: 9, window: 45, basis: "Cover-gas isolation window on auxiliary-pump cooling (ET-CGAS-P04)." }, { state: "POS-05", cue: 10, window: 50, basis: "Cover-gas isolation window with the boundary open for refuelling (ET-CGAS-P05)." }, { state: "POS-06", cue: 10, window: 50, basis: "Cover-gas isolation window in long-term shutdown (ET-CGAS-P06)." }, { state: "POS-07", cue: 9, window: 45, basis: "Cover-gas isolation window in post-trip natural circulation (ET-CGAS-P07)." }, { state: "POS-08", cue: 9, window: 45, basis: "Cover-gas isolation window in the maintenance state (ET-CGAS-P08)." }, { state: "POS-09", cue: 10, window: 50, basis: "Cover-gas isolation window with the intermediate loop isolated (ET-CGAS-P09)." }], es: "ESF-LEAK", note: "Isolate the cover-gas path on the activity alarm, the isolation branch of the cover-gas breach trees.", srs: ["HR-F1", "HR-F4"] },
].map((h) => ({
  uuid: h.id,
  name: h.name,
  hfeTiming: h.timing as "POST_INITIATOR" | "AT_INITIATOR",
  description: h.note,
  impactLevel: h.impact as "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT",
  affectedSystems: h.systems,
  applicablePlantOperatingStates: h.timing2.map((t) => t.state),
  applicableEventSequences: h.es !== null ? [h.es] : [],
  applicableInitiatingEvents: h.id === "HR-AT-003" ? ["IE-20"] : h.id === "HR-AT-004" ? ["IE-31"] : h.id === "HR-AT-005" ? ["IE-29"] : h.id === "HR-AT-006" ? ["IE-30"] : h.id === "HR-AT-007" ? ["IE-28"] : undefined,
  groupedResponses: h.id === "HR-POST-011" ? ["HR-POST-025"] : undefined,
  crossPosGroupingBasis: h.id === "HR-POST-011" ? "EQUIVALENT_BOUNDARY_CONDITIONS" : undefined,
  groupingJustification: h.id === "HR-POST-011" ? "The two leak-isolation actions share equivalent boundary conditions in the guard-vessel leak sequence, so they are grouped where the conditions match." : undefined,
  responseDetail: {
    requiredResponse: h.name,
    responseType: h.respType as "INITIATE" | "OPERATE" | "CONTROL" | "ISOLATE" | "TERMINATE" | "AGGRAVATING_ACTION",
    successCriteriaIds: h.sc,
    procedureReferences: h.proc,
    cueDescription: h.cue,
    cueTimingBySequence: h.es !== null ? h.timing2.map((t) => ({
      eventSequenceId: h.es ?? "",
      plantOperatingStateId: t.state,
      cueTimeMinutes: t.cue ?? undefined,
      timeWindowMinutes: t.window ?? undefined,
      basis: t.basis,
    })) : [],
  },
  implementsSrs: srs(...h.srs),
}));

const humanFailureEvents = [...preHfes, ...postHfes];

const responseIdentificationReviews = [
  { id: "RR-1", scope: "EMERGENCY_AND_ABNORMAL_PROCEDURES", date: "2026-04-24", sources: ["Emergency operating procedures", "Abnormal operating procedures", "Annunciator response procedures"], findings: "Found the actions to diagnose the loss of heat sink, detect and terminate a drain-down, start backup decay heat removal, start confinement clean-up, isolate the leaking penetration, the primary leak segment, the sodium-water reaction and the cover-gas breach, initiate sodium make-up, and respond to a sodium fire.", hfes: ["HR-POST-004", "HR-POST-028", "HR-POST-005", "HR-POST-022", "HR-POST-011", "HR-POST-025", "HR-POST-031", "HR-POST-032", "HR-POST-026", "HR-POST-027"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-2", scope: "TRAINING_MATERIALS", date: "2026-04-25", sources: ["Operator training program", "Simulator scenario set"], findings: "Found the diagnosis cues and the isolation actions for a primary leak.", hfes: ["HR-POST-011", "HR-POST-025"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-3", scope: "NONNUCLEAR_FACILITY_EXPERIENCE", date: "2026-04-25", sources: ["Sodium test facility records", "Chemical plant control-room studies"], findings: "Borrowed diagnosis and execution evidence where the operating crew does not yet exist.", hfes: ["HR-POST-005"], srs: ["HR-E3"] },
  { id: "RR-4", scope: "OPERATIONAL_EVENTS", date: "2026-04-26", sources: ["Research reactor operating events", "Sodium-facility upset reports", "Maintenance work-order history"], findings: "Identified the aggravating and operator-caused at-initiator actions: an operator trips a running decay-heat loop in error, a maintenance error initiates a loss of constant power, an operator-induced overcooling maneuver, a refuelling mis-loading, an inadvertent secondary-sodium dump, and an erroneous rod withdrawal.", hfes: ["HR-AG-001", "HR-AT-003", "HR-AT-004", "HR-AT-005", "HR-AT-006", "HR-AT-007"], srs: ["HR-E4"] },
  { id: "RR-5", scope: "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH", date: "2026-04-24", sources: ["Draft emergency operating procedures", "Draft abnormal operating procedures", "Operational-approach description"], findings: "Confirmed from the planned procedures that the decay-heat and leak-isolation actions are the primary operator responses for the modeled sequences.", hfes: ["HR-POST-005", "HR-POST-025"], srs: ["HR-E1", "HR-E9"] },
].map((r) => ({
  uuid: r.id,
  reviewScope: r.scope as "EMERGENCY_AND_ABNORMAL_PROCEDURES" | "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH" | "OPERATIONAL_EVENTS" | "TRAINING_MATERIALS" | "SIMILAR_FACILITY_EXPERIENCE" | "NONNUCLEAR_FACILITY_EXPERIENCE",
  sourcesReviewed: r.sources,
  date: r.date,
  findings: r.findings,
  identifiedHfeIds: r.hfes,
  implementsSrs: srs(...r.srs),
}));

const responseConfirmations = [
  { id: "CF-1", hfes: ["HR-POST-004", "HR-POST-005", "HR-POST-011", "HR-POST-025"], method: "PERSONNEL_REVIEW", roles: ["Operations supervisor", "Training instructor"], date: "2026-04-28", findings: "The action interpretation is consistent with operations and training intent.", srs: ["HR-E5"] },
  { id: "CF-2", hfes: ["HR-POST-004", "HR-POST-005", "HR-POST-011", "HR-POST-025"], method: "TALK_THROUGH", roles: ["Reactor operator", "Human factors analyst"], date: "2026-05-01", findings: "Walked the diagnosis, decay-heat and leak-isolation actions step by step against the event sequence.", srs: ["HR-E7"] },
  { id: "CF-3", hfes: ["HR-POST-005"], method: "SIMULATION_OBSERVATION", roles: ["Crew of two", "Observer"], date: "2026-05-04", findings: "Observed the diagnosis and the execution on the engineering simulator.", srs: ["HR-E7", "HR-G8"] },
  { id: "CF-4", hfes: ["HR-AT-003"], method: "PERSONNEL_REVIEW", roles: ["Operations supervisor", "Maintenance lead"], date: "2026-04-29", findings: "Reviewed the operator-caused loss-of-constant-power error against the work-control practice and the support-system initiator model.", srs: ["HR-E5"] },
  { id: "CF-5", hfes: ["HR-POST-026", "HR-POST-028"], method: "TALK_THROUGH", roles: ["Reactor operator", "Human factors analyst"], date: "2026-05-02", findings: "Walked the drain-down detection and the sodium make-up actions step by step against the refuelling sequences.", srs: ["HR-E7"] },
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
  { id: "HR-PRE-022", methodology: "Conservative screening value for a single-train restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 1.0e-2, mean: null, factors: ["Post-maintenance test credited (Data Analysis TC-2)"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D2", "HR-D5"] },
  { id: "HR-PRE-009", methodology: "Conservative screening value for a charger restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 5.0e-3, mean: null, factors: ["Monthly surveillance credited"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D6"] },
  { id: "HR-PRE-031", methodology: "Detailed assessment of a common setpoint miscalibration.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 1.1e-3, factors: ["Common procedure", "Diverse actuation provides partial backup"], unc: "Lognormal distribution with an error factor of 6, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
  { id: "HR-PRE-018", methodology: "Detailed assessment of a common trip-circuit miscalibration.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 1.5e-3, factors: ["Common procedure", "Shared trip-test equipment", "Diverse reactor trip provides partial backup"], unc: "Lognormal distribution with an error factor of 6, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
  { id: "HR-PRE-041", methodology: "Detailed assessment of a common battery equalization error.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 2.0e-3, factors: ["Both banks in one evolution", "Monthly surveillance credited as partial recovery"], unc: "Lognormal distribution with an error factor of 5, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
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
  { id: "HR-POST-004", methodology: "Detailed diagnosis analysis for the loss-of-heat-sink recognition.", type: "DETAILED_ASSESSMENT", rs: true, cog: 2.0e-3, exe: 4.0e-4, mean: 2.4e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 200, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 10, req: 12, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Wide window against a 12 minute diagnosis.", impact: "DECREASE" }, { factor: "Human-system interface", evaluation: "Dedicated loss-of-heat-sink alarm.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-005", methodology: "Detailed time-reliability analysis with performance factors.", type: "DETAILED_ASSESSMENT", rs: true, cog: 6.0e-4, exe: 2.0e-4, mean: 8.0e-4, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 150, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 25, req: 35, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Workload", evaluation: "Single dedicated action, low competing demand.", impact: "DECREASE" }, { factor: "Stress", evaluation: "Elevated during the early transient.", impact: "INCREASE" }, { factor: "Training", evaluation: "Action is a trained scenario.", impact: "DECREASE" }, { factor: "Human-system interface", evaluation: "Clear alarm and dedicated control.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 4, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G4", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-022", methodology: "Conservative screening value for a slow confinement action, set below the total confinement-function failure probability in the sequence model.", type: "CONSERVATIVE_ESTIMATE", rs: false, cog: 5.0e-3, exe: 3.0e-3, mean: null, point: 8.0e-3, ind: "ASSUMED_AVAILABLE", avail: 120, availBasis: "GENERIC_STUDY", cueArr: 15, req: 30, reqBasis: "ESTIMATED", psfs: [{ factor: "Time available", evaluation: "Long window relative to the action.", impact: "DECREASE" }], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G3", "HR-G5", "HR-G7"] },
  { id: "HR-POST-011", methodology: "Detailed analysis of a short-window isolation action.", type: "DETAILED_ASSESSMENT", rs: true, cog: 3.0e-3, exe: 1.5e-3, mean: 4.5e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 30, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 10, req: 18, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short window against the required time.", impact: "INCREASE" }, { factor: "Accessibility", evaluation: "Local action in a normal-access cell.", impact: "NEUTRAL" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-025", methodology: "Detailed analysis of a short-window isolation action.", type: "DETAILED_ASSESSMENT", rs: true, cog: 3.5e-3, exe: 1.5e-3, mean: 5.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 45, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 12, req: 22, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Adequate window against the required time.", impact: "DECREASE" }, { factor: "Accessibility", evaluation: "Local isolation valves in a normal-access cell.", impact: "NEUTRAL" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-026", methodology: "Detailed analysis of a long-window make-up action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 4.0e-3, exe: 2.0e-3, mean: 6.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 90, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 20, req: 30, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Long window relative to the action.", impact: "DECREASE" }], unc: "Stated error factor of 5, distribution to be propagated at the operating stage.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-028", methodology: "Detailed analysis of a short-window detection and termination action.", type: "DETAILED_ASSESSMENT", rs: true, cog: 2.0e-3, exe: 1.0e-3, mean: 3.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 30, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 5, req: 15, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short detection window against the required time.", impact: "INCREASE" }, { factor: "Human-system interface", evaluation: "Clear level alarm.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-027", methodology: "Conservative screening value for a fire-response action, bounded by the shortest applicable state window.", type: "CONSERVATIVE_ESTIMATE", rs: false, cog: 1.5e-2, exe: 5.0e-3, mean: null, point: 2.0e-2, ind: "ASSUMED_AVAILABLE", avail: 25, availBasis: "GENERIC_STUDY", cueArr: 5, req: 18, reqBasis: "ESTIMATED", psfs: [{ factor: "Stress", evaluation: "High stress during a sodium fire.", impact: "INCREASE" }], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G3", "HR-G5", "HR-G7"] },
  { id: "HR-POST-031", methodology: "Detailed analysis of a short-window reaction-isolation action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 4.0e-3, exe: 2.0e-3, mean: 6.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 30, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 5, req: 15, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short window against the required time.", impact: "INCREASE" }, { factor: "Human-system interface", evaluation: "Dedicated reaction detection alarm.", impact: "DECREASE" }], unc: "Stated error factor of 5, distribution to be propagated at the operating stage.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-032", methodology: "Detailed analysis of a cover-gas isolation action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 3.0e-3, exe: 1.5e-3, mean: 4.5e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 40, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 8, req: 18, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Adequate window against the required time.", impact: "DECREASE" }, { factor: "Accessibility", evaluation: "Isolation from the control room.", impact: "NEUTRAL" }], unc: "Stated error factor of 5, distribution to be propagated at the operating stage.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
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


const specialQuant: HepQuantification[] = [
  { id: "HR-AT-003", methodology: "Human-error-probability times demand for the operator-caused loss of constant power, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 3.0e-3, factors: ["Maintenance work order without independent verification of the constant-power line-up", "Battery-backed supply provides partial backup"], unc: "Lognormal with an error factor of 5, supplied to the IE loss-of-constant-power initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-004", methodology: "Human-error-probability times demand for the operator-caused overcooling maneuver, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Flow-control maneuver under procedure", "Reactor trip provides partial backup"], unc: "Stated error factor of 5, supplied to the IE overcooling initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-005", methodology: "Human-error-probability times demand for the operator refuelling mis-loading, supplied to Initiating Events, with the demand rate from the Data Analysis refuelling outage schedule (OG-1).", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 1.0e-3, factors: ["Refuelling line-up under independent verification", "Interlocks provide partial backup"], unc: "Stated error factor of 5, supplied to the IE fuel-handling initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-006", methodology: "Human-error-probability times demand for the inadvertent secondary-sodium dump, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Secondary line-up under procedure", "Dump-valve interlocks provide partial backup"], unc: "Stated error factor of 5, supplied to the IE secondary-sodium dump initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-007", methodology: "Human-error-probability times demand for the erroneous rod withdrawal, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Rod maneuver under procedure", "Protection system terminates the withdrawal"], unc: "Stated error factor of 5, supplied to the IE rod-withdrawal initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AG-001", methodology: "Conservative screening value for an aggravating action that trips a running loop in error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 1.0e-2, mean: null, factors: ["Clear loop indication", "Caution note in the procedure"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G5"] },
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

const recoveryQuant: HepQuantification[] = [
  { id: "REC-Q-1", hfe: "HR-POST-005", methodology: "Detailed recovery credit for restoring decay-heat removal from the remote panel, with the restoration-time basis from Data Analysis RP-1 (48 h decay-heat pump restoration).", mean: 8.0e-2, unc: "Stated error factor of 4 on the recovery action.", srs: ["HR-H4", "HR-G1"] },
  { id: "REC-Q-2", hfe: "HR-AT-003", methodology: "Recovery credit for the manual constant-power cross-tie, with high dependence carried explicitly for a self-caused loss.", mean: 2.0e-1, unc: "Point recovery value, high dependence on the self-caused loss carried in DEP-2.", srs: ["HR-H4", "HR-H5"] },
  { id: "REC-Q-3", hfe: "HR-PRE-022", methodology: "Recovery credit for re-opening a mis-restored DRACS damper during the event.", mean: 1.5e-1, unc: "Point recovery value, local access under review.", srs: ["HR-H4"] },
].map((q) => ({
  uuid: q.id,
  hfeId: q.hfe,
  methodology: q.methodology,
  assessmentType: "DETAILED_ASSESSMENT" as const,
  isRiskSignificant: false,
  meanHep: q.mean,
  uncertaintyCharacterization: { riskSignificant: false, method: q.unc, probabilisticRepresentationProvided: false },
  implementsSrs: srs(...q.srs),
}));

const hepQuantifications = [...preQuant, ...postQuant, ...specialQuant, ...recoveryQuant];

const preInitiatorRecoveryCredits = [
  { id: "HR-PRE-014", credit: "INDEPENDENT_VERIFICATION", max: 0.05, srs: ["HR-D5", "HR-D6"] },
  { id: "HR-PRE-022", credit: "POST_MAINTENANCE_TEST", max: 0.03, srs: ["HR-D5"] },
  { id: "HR-PRE-009", credit: "WORK_SUPERVISION_CHECK", max: 0.1, srs: ["HR-D6"] },
  { id: "HR-PRE-031", credit: "INDEPENDENT_VERIFICATION", max: 0.05, srs: ["HR-D5", "HR-D6"] },
  { id: "HR-PRE-018", credit: "INDEPENDENT_VERIFICATION", max: 0.05, srs: ["HR-D5", "HR-D6"] },
  { id: "HR-PRE-041", credit: "WORK_SUPERVISION_CHECK", max: 0.1, srs: ["HR-D6"] },
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
    hfeIds: ["HR-PRE-014", "HR-PRE-018", "HR-PRE-031"],
    commonElements: ["Same instrument crew across the DRACS, primary-pump-trip and RPS calibrations", "Common calibration procedure", "Shared calibration standard", "Same shift"],
    dependenceLevel: "HIGH",
    jointHep: 1.2e-3,
    implementsSrs: srs("HR-D7"),
  },
  {
    uuid: "DEP-2",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-AT-003"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same operator", "Same constant-power work", "Recovery of a self-caused loss"],
    dependenceLevel: "HIGH",
    jointHep: 6.0e-4,
    belowFloor: false,
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: true,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
  {
    uuid: "DEP-3",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-004", "HR-POST-005"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same crew", "Same loss-of-heat-sink sequence", "Alignment conditioned on the diagnosis"],
    dependenceLevel: "MODERATE",
    jointHep: 3.5e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-4",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-028", "HR-POST-025"],
    eventSequenceId: "ESF-LEAK",
    commonElements: ["Same crew", "Detection preceding the isolation", "Same leak sequence"],
    dependenceLevel: "MODERATE",
    jointHep: 7.5e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-5",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-028", "HR-POST-026"],
    eventSequenceId: "ESF-LEAK",
    commonElements: ["Same crew", "Detection preceding the make-up", "Same drain-down sequence"],
    dependenceLevel: "MODERATE",
    jointHep: 4.5e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-6",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-005", "HR-AG-001"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same crew", "Same loss-of-heat-sink response", "Wrong-loop action against the start action"],
    dependenceLevel: "LOW",
    jointHep: 1.0e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-7",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-005"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same crew for the failed start and the remote-panel restoration"],
    dependenceLevel: "MODERATE",
    jointHep: 6.4e-5,
    belowFloor: false,
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
  {
    uuid: "DEP-8",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-PRE-022"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Restoration error and its in-event re-opening by the same maintenance crew"],
    dependenceLevel: "MODERATE",
    jointHep: 1.5e-3,
    belowFloor: false,
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
  {
    uuid: "DEP-9",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-022", "HR-POST-028"],
    eventSequenceId: "ESF-LEAK",
    commonElements: ["Same crew", "Same leak sequence", "Different functions and timeframes"],
    dependenceLevel: "LOW",
    jointHep: 2.5e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
];

const recoveryActions: RecoveryAction[] = [
  { id: "REC-1", name: "Restore decay heat removal from the remote panel", hfeId: "HR-POST-005", level: "SEQUENCE", fn: "Decay-heat removal", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: true, equipment: true }, preop: null, hep: "REC-Q-1", dep: "DEP-7", srs: ["HR-H1", "HR-H2", "HR-H4"] },
  { id: "REC-2", name: "Recover constant power by manual cross-tie", hfeId: "HR-AT-003", level: "SEQUENCE", fn: "Constant power supply", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: false, time: true, accessibility: true, equipment: true }, preop: "Manpower assumption for the off-shift case logged until staffing is set.", hep: "REC-Q-2", dep: "DEP-2", srs: ["HR-H2", "HR-H3", "HR-H5"] },
  { id: "REC-3", name: "Re-open a mis-restored DRACS damper", hfeId: "HR-PRE-022", level: "CUTSET", fn: "DRACS air path", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: false, equipment: true }, preop: "Local access during the event under review against the as-built layout.", hep: "REC-Q-3", dep: "DEP-8", srs: ["HR-H2", "HR-H3"] },
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
  { id: "PA-3", area: "Quantification", desc: "Timing from design analysis and the Data Analysis surveillance and exposure schedule (DM-1 to DM-3, EX-1, EX-2, TC-1), to re-measure on the as-built simulator.", sr: "HR-G16", path: "hepQuantifications" },
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
  name: "HR Workbook 2",
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
    openCount: 3,
    resolvedCount: 2,
    comments: [
      { uuid: "hrc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T09:14:00.000Z", associatedSr: "HR-G8", text: "The decay-heat action is risk-significant, so HR-G8 needs the required time measured on the simulator rather than estimated, with enough runs to characterize the spread.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T10:30:00.000Z", associatedSr: "HR-G12", text: "The diagnosis error and the isolation error share a crew and a timeframe, so HR-G12 needs the within-sequence joint probability calculated and checked against the floor under HR-G13.", severity: "MAJOR", resolved: true, resolution: "The diagnosis-alignment joint probability is carried in DEP-3 at 3.5e-4 and the leak-family chains in DEP-4, DEP-5 and DEP-9, all checked against the floor.", resolvedAt: "2026-05-08T09:00:00.000Z", resolvedBy: "rev-3" },
      { uuid: "hrc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-07T14:05:00.000Z", associatedSr: "HR-H2", text: "The constant-power cross-tie recovery rests on an off-shift manpower assumption, so HR-H2 needs the feasibility shown or HR-H3 applied to leave it out until staffing is set.", severity: "MAJOR", resolved: false },
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
      hfeIdsReviewed: ["HR-POST-004", "HR-POST-005", "HR-POST-011", "HR-POST-022", "HR-PRE-014"],
      relativeReasonablenessConfirmed: true,
      basis: "SIMILAR_PLANT_AND_SCENARIO_CONTEXT",
      findings: "The detailed short-window actions carry higher values than the long-window actions, and the conservative screening values sit above the detailed values, both of which are reasonable.",
      implementsSrs: srs("HR-G9", "HR-G10"),
    },
  ],
  errorForcingContexts: [
    { uuid: "EFC-1", hfeId: "HR-POST-005", unsafeAction: "Holds the decay-heat action believing the plant is already stable.", plantConditions: ["Misleading low core-outlet reading", "Slow temperature rise"], performanceShapingFactors: ["Ambiguous indication", "High early workload"], vulnerability: "A slow heat-up can be read as a stable state, so the crew holds the action.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
    { uuid: "EFC-2", hfeId: "HR-AG-001", unsafeAction: "Trips a running DRACS loop believing it is the faulted one.", plantConditions: ["Two loops alarming at once", "Look-alike loop indications"], performanceShapingFactors: ["Adjacent identical controls", "Time pressure"], vulnerability: "Identical adjacent controls invite a wrong-loop action under pressure.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
    { uuid: "EFC-3", hfeId: "HR-AT-003", unsafeAction: "De-energizes the live constant-power feed during maintenance.", plantConditions: ["Supply work in progress", "Partial labeling"], performanceShapingFactors: ["Procedure not place-kept", "Shift-handover gap"], vulnerability: "A labeling and handover gap can route the action to the live feed.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
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
    relatedAssumptions: [
      { assumption: "The operating crew does not yet exist, so response evidence is borrowed from nonnuclear facilities.", basis: "Pre-operational stage, plant-specific crew evidence pending.", applicableElements: ["responseIdentificationReviews"] },
      { assumption: "Required action times are taken from design analysis until measured on the as-built simulator.", basis: "Simulator not yet available at the pre-operational stage.", applicableElements: ["hepQuantifications"] },
    ],
    reasonableAlternatives: [
      { alternative: "Use a plant-specific dependence model instead of the screening dependence levels once operating data exists.", reasonNotSelected: "Plant-specific dependence data does not yet exist, so screening levels are carried and swept by sensitivity." },
      { alternative: "Adopt a measured time-reliability curve for the decay-heat action in place of the design-analysis timing.", reasonNotSelected: "The as-built simulator is not yet available to measure the required-time spread." },
    ],
  },
  preOperationalAssumptions,
  sensitivityStudies: [
    { uuid: "SS-1", name: "Dependence sweep", description: "Dependence sweep across the human action set.", variedParameters: ["Dependence level"], parameterRanges: { "Dependence level": [0, 1] }, results: "The sequence result holds within a factor of two across the dependence range.", modelUncertaintyId: "hr-mu-1" },
    { uuid: "SS-2", name: "Time-available sweep", description: "Time available against the required time for the decay-heat action.", variedParameters: ["Time available (min)"], parameterRanges: { "Time available (min)": [35, 300] }, results: "The decay-heat action stays below the screening value across the 35 to 300 minute band, above the 35 minute required time.", modelUncertaintyId: "hr-mu-1" },
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
    implementsSrs: srs("HR-I1", "HR-I2", "HR-I3"),
  },
  exampleDocuments: [
    { id: "HR-DOC-01", name: "EBR-II Level 1 PRA", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-NSE-2", extracted: "The plant Level 1 PRA: its human failure events and the operator-caused support-system initiator contributions the analysis draws on", linked: 4, url: "/api/example-documents/hr/sfr-pra" },
    { id: "HR-DOC-02", name: "EBR-II Inherent Safety Demonstration Tests", kind: "doc", sizeLabel: "ANL", uploadedLabel: "CONF-850410-6", extracted: "The 1986 loss-of-flow and loss-of-heat-sink-without-scram tests, the operator-action and passive-response context for the response actions", linked: 3, url: "/api/example-documents/hr/sfr-inherent" },
    { id: "HR-DOC-03", name: "EBR-II SHRT Benchmark Specifications", kind: "doc", sizeLabel: "ANL", uploadedLabel: "ANL-ARC-226", extracted: "Plant, system and transient data supporting the cue timing and the time available for the modeled actions", linked: 3, url: "/api/example-documents/hr/sfr-benchmark" },
    { id: "HR-DOC-04", name: "Benchmark Analysis of EBR-II SHRT", kind: "doc", sizeLabel: "IAEA", uploadedLabel: "IAEA-TECDOC-1819", extracted: "The transient timing analysis supporting the required-time bases for the risk-significant actions", linked: 2, url: "/api/example-documents/hr/sfr-shrt-analysis" },
  ],
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-081", "NM-066", "NM-074"],
};

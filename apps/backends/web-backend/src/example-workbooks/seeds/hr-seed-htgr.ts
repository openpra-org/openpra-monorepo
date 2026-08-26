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
import { createExampleDependencyNetwork } from "./dependency-model-seed";
import { HR_SR_CATALOG } from "interfaces-mef-types/hr/human-reliability-analysis";

const NOW = "2026-05-08T12:00:00.000Z";
const CREATED = "2026-04-22T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => ({ sr: code, hlr: code.charAt(3) as HlrId }));
}

const WARN_SRS = new Set<string>(["HR-A6", "HR-G8", "HR-H2"]);

const SR_EVIDENCE: Record<string, string> = {
  "HR-A7": "Operator contributions included in five support-system initiator fault trees.",
  "HR-A6": "Diverse-system reach of the RPS setpoint calibration under review.",
  "HR-B1": "Pre-initiator events screened with screening-grade criteria per state, one screened out.",
  "HR-B3": "Multi-train work practices protected from screening and carried as defined events.",
  "HR-D7": "Instrument-channel miscalibrations evaluated as a same-crew joint probability.",
  "HR-E4": "Every response action identified across procedure, planned-procedure, training and operational-event reviews, including two aggravating actions.",
  "HR-G8": "Simulator runs for the required time of the shutdown-cooling start action pending.",
  "HR-G11": "Joint probability floor defined and justified.",
  "HR-G12": "Within-sequence dependence assessed for the leak and the loss-of-forced-cooling sequences, with the recovery couplings carried explicitly.",
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
  { id: "RA-1", name: "RPS setpoint calibration", activityType: "CALIBRATION" as const, description: "Calibration of the reactor protection system trip setpoints across both protection divisions.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE", "DESIGN_ENGINEER_INTERVIEW"], systems: ["SYS-RPS"], components: ["Division A and B setpoints"], states: ["POS-01", "POS-03"], multiTrain: true, mechanism: "Common calibration procedure and equipment applied to both protection divisions.", preOp: "Taken from the draft RPS setpoint calibration procedure and a design-engineer interview on the two-division setup, to be confirmed against operation.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-2", name: "Moisture-monitor calibration", activityType: "CALIBRATION" as const, description: "Calibration of the primary-coolant moisture monitors on both sampling loops by one instrument crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-MMS"], components: ["Loop A and B moisture monitors"], states: ["POS-01"], multiTrain: true, mechanism: "One crew on a common calibration procedure across the two moisture-monitor loops.", preOp: "Taken from the draft moisture-monitoring calibration procedure and the monitor design, to be confirmed against operation.", srs: ["HR-A3", "HR-A5"] },
  { id: "RA-3", name: "Battery charger restoration", activityType: "REALIGNMENT" as const, description: "Restoration of the Class-1E battery charger to the normal float mode after maintenance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-1E-DC"], components: ["Charger train A or B"], states: ["POS-01", "POS-03"], multiTrain: false, preOp: "Taken from the draft Class-1E DC maintenance procedure, to be confirmed against the charger line-up practice in operation.", srs: ["HR-A1"] },
  { id: "RA-4", name: "Shutdown-cooling train restoration", activityType: "REALIGNMENT" as const, description: "Restoration of a shutdown cooling system train to standby after surveillance.", sources: ["PROCEDURES", "PLANT_PRACTICES"], systems: ["SYS-SCS"], components: ["SCS train A or B"], states: ["POS-01", "POS-04"], multiTrain: false, preOp: "Taken from the draft SCS surveillance restoration steps, to be confirmed against the line-up practice in operation.", srs: ["HR-A1"] },
  { id: "RA-5", name: "Steam-generator isolation-valve stroke test", activityType: "REALIGNMENT" as const, description: "Restoration of the steam-generator isolation and dump valves after a stroke test.", sources: ["PROCEDURES"], systems: ["SYS-SGISO"], components: ["Isolation and dump valves"], states: ["POS-01", "POS-04"], multiTrain: false, preOp: "Taken from the draft SG isolation surveillance procedure, to be confirmed against the post-test verification practice in operation.", srs: ["HR-A1"] },
  { id: "RA-6", name: "RCCS duct-damper alignment", activityType: "CALIBRATION" as const, description: "Alignment check and calibration of the reactor cavity cooling system duct dampers across the four passive cooling ducts by one crew.", sources: ["PROCEDURES", "INDUSTRY_EXPERIENCE"], systems: ["SYS-RCCS"], components: ["Duct 1 to 4 dampers"], states: ["POS-01"], multiTrain: true, mechanism: "One crew on a common alignment procedure across the four passive cooling ducts.", preOp: "Taken from the draft RCCS surveillance procedure and the passive-cooling design, to be confirmed against operation.", srs: ["HR-A3", "HR-A5"] },
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
  { id: "PS-1", activityId: "RA-1", screenedOut: false, justification: "Common calibration across both protection divisions is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-2", activityId: "RA-2", screenedOut: false, justification: "Common calibration of both moisture-monitor loops is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-3", activityId: "RA-3", screenedOut: false, justification: "Charger left in the wrong mode can deplete a DC train, so it is carried forward.", srs: ["HR-B1"] },
  { id: "PS-4", activityId: "RA-4", screenedOut: false, justification: "Restoration error can leave one shutdown-cooling train unavailable, so it is carried as a defined event.", srs: ["HR-B1"] },
  { id: "PS-5", activityId: "RA-5", screenedOut: true, justification: "Stroke-test misalignment is caught by the post-test indication before any state transition (Data Analysis TC-4, both change-of-state modes exercised).", multiState: "Administrative control detects the error before the state changes.", srs: ["HR-B1", "HR-B2"] },
  { id: "PS-6", activityId: "RA-6", screenedOut: false, justification: "Common alignment across the four passive cooling ducts is multi-train, so it may not be screened out.", srs: ["HR-B1", "HR-B3"] },
  { id: "PS-7", activityId: "RA-7", screenedOut: false, justification: "Aligning both redundant battery banks in one evolution is multi-train, so it may not be screened out (coincident two-train work carried in Data Analysis CM-2).", srs: ["HR-B1", "HR-B3"] },
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
  { id: "SIC-1", system: "SYS-1E-DC", ft: "IE-29" },
  { id: "SIC-2", system: "SYS-1E-AC", ft: "IE-27" },
  { id: "SIC-3", system: "SYS-CCW", ft: "IE-31" },
  { id: "SIC-4", system: "SYS-HIC", ft: "IE-40" },
  { id: "SIC-5", system: "SYS-1E-DC", ft: "IE-30" },
].map((s) => ({
  uuid: s.id,
  systemReference: s.system,
  faultTreeReference: s.ft,
  included: true,
  implementsSrs: srs("HR-A7"),
}));

const preHfes: HumanFailureEvent[] = [
  { id: "HR-PRE-014", name: "Moisture-monitor miscalibration", source: "RA-2", impact: "FUNCTION", systems: ["SYS-MMS"], components: ["Loop A and B moisture monitors"], states: ["POS-01"], detect: 2160, basis: "Error sits until the next quarterly calibration.", modes: ["Moisture indication biased low", "Delayed or missed ingress alarm"], miscal: true, note: "Common miscalibration of both moisture-monitor loops from one crew on one procedure, masking a moisture-ingress cue.", srs: ["HR-C1", "HR-C2", "HR-C5"] },
  { id: "HR-PRE-009", name: "Battery charger wrong mode", source: "RA-3", impact: "TRAIN", systems: ["SYS-1E-DC"], components: ["Charger train A or B"], states: ["POS-01", "POS-03"], detect: 720, basis: "Detected at the monthly battery surveillance.", modes: ["DC train slowly depletes under load"], miscal: false, note: "Charger left off the normal float mode after maintenance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-022", name: "Shutdown-cooling train left misaligned", source: "RA-4", impact: "TRAIN", systems: ["SYS-SCS"], components: ["SCS train A or B"], states: ["POS-01", "POS-04"], detect: 168, basis: "Detected at the weekly position verification.", modes: ["One shutdown-cooling train unavailable on demand"], miscal: false, note: "Single-train restoration error from the surveillance.", srs: ["HR-C1", "HR-C4"] },
  { id: "HR-PRE-031", name: "RPS setpoint miscalibration", source: "RA-1", impact: "SYSTEM", systems: ["SYS-RPS"], components: ["Division A and B setpoints"], states: ["POS-01", "POS-03"], detect: 2160, basis: "Error sits until the next quarterly setpoint check.", modes: ["Both divisions trip late or fail to trip"], miscal: true, note: "Common miscalibration of both protection divisions.", srs: ["HR-C1", "HR-C5"] },
  { id: "HR-PRE-018", name: "RCCS duct-damper misalignment", source: "RA-6", impact: "SYSTEM", systems: ["SYS-RCCS"], components: ["Duct 1 to 4 dampers"], states: ["POS-01"], detect: 2160, basis: "Error sits until the next quarterly RCCS surveillance.", modes: ["Reduced passive-cooling duct flow across the ducts"], miscal: true, note: "Common misalignment of the four passive cooling ducts from one crew on one procedure, degrading the passive backstop.", srs: ["HR-C1", "HR-C2", "HR-C5"] },
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
  { id: "HR-POST-018", systems: ["SYS-SCS"], name: "Fails to start the second shutdown-cooling train", timing: "POST_INITIATOR", respType: "INITIATE", impact: "FUNCTION", sc: ["HAC-H1", "SYS-SCS"], proc: ["LOFC procedure step 8"], cue: "Loss-of-forced-cooling alarm with rising core-outlet temperature.", timing2: [{ state: "POS-07", cue: 10, window: 1980, basis: "Very wide window from graphite thermal inertia, 33 h at the median (HAC-H1)." }, { state: "POS-01", cue: 10, window: 1980, basis: "Wide window at power from graphite thermal inertia." }, { state: "POS-02", cue: 10, window: 1800, basis: "Wide window in reduced and experimental power (ET-PLOFC-P02, ET-HLOOP-P02)." }, { state: "POS-03", cue: 10, window: 1900, basis: "Hot standby window from graphite thermal inertia (ET-PLOFC-P03, ET-HTOP-P03)." }, { state: "POS-04", cue: 10, window: 2100, basis: "Second-train start window in forced cooldown (ET-SCSL-P04)." }, { state: "POS-05", cue: 12, window: 2600, basis: "Cold-shutdown window at low decay heat (ET-SCSL-P05, ET-SFC-P05)." }, { state: "POS-06", cue: 12, window: 2800, basis: "Refuelling window at low decay heat (ET-LODC-P06, ET-SFC-P06)." }, { state: "POS-09", cue: 15, window: 3000, basis: "Widest window at the lowest decay heat with the primary depressurised (ET-SCSL-P09)." }], es: "ESF-LATE", note: "The headline response action for a loss of forced cooling, demonstrated by talk-through and simulator, carried as HFE-H1 in the Event Sequence action windows and the Success Criteria.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-020", systems: ["SYS-MMS"], name: "Fails to diagnose primary-coolant moisture ingress", timing: "POST_INITIATOR", respType: "CONTROL", impact: "SYSTEM", sc: ["HAC-H2"], proc: ["Moisture-ingress procedure step 2"], cue: "Primary-coolant moisture-monitor alarm.", timing2: [{ state: "POS-01", cue: 5, window: 30, basis: "Short diagnosis window before committing to isolation." }, { state: "POS-02", cue: 5, window: 30, basis: "Diagnosis window in reduced and experimental power (ET-SMI-P02)." }, { state: "POS-03", cue: 5, window: 32, basis: "Diagnosis window in hot standby (ET-SMI-P03)." }, { state: "POS-04", cue: 6, window: 35, basis: "Diagnosis window in forced cooldown (ET-SMI-P04, ET-HSGTR-P04)." }, { state: "POS-05", cue: 6, window: 40, basis: "Diagnosis window in cold shutdown (ET-HSGTR-P05)." }], es: "ESF-LEAK", note: "The moisture-ingress diagnosis the isolation action depends on, coupled within the sequence and sharing the HAC-H2 window.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-022", systems: ["SYS-SGISO"], name: "Fails to isolate and dump the affected steam generator", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["HAC-H2", "SYS-SGISO"], proc: ["Moisture-ingress procedure step 5"], cue: "Primary-coolant moisture-monitor alarm with confirmed ingress.", timing2: [{ state: "POS-01", cue: 5, window: 120, basis: "Isolation before the graphite-oxidation bound, 2 h from the alarm (HAC-H2)." }, { state: "POS-02", cue: 5, window: 120, basis: "Isolation window in reduced and experimental power (ET-SMI-P02, ET-HSGTR-P02)." }, { state: "POS-03", cue: 5, window: 125, basis: "Isolation window in hot standby (ET-SMI-P03, ET-LSGTR-P03)." }, { state: "POS-04", cue: 6, window: 135, basis: "Isolation window in forced cooldown (ET-HSGTR-P04, ET-LSGTR-P04)." }, { state: "POS-05", cue: 6, window: 150, basis: "Isolation window in cold shutdown (ET-HSGTR-P05)." }], es: "ESF-LEAK", note: "Isolate and dump the affected steam generator on a moisture alarm, grouped with the helium-boundary isolation and carried as HFE-H2 in the Event Sequence action windows and the Success Criteria.", srs: ["HR-F1", "HR-F3", "HR-F4"] },
  { id: "HR-AG-001", systems: ["SYS-SCS"], name: "Trips a running shutdown-cooling train in error", timing: "POST_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "TRAIN", sc: [], proc: ["LOFC procedure caution note"], cue: "Misread train indication during the response.", timing2: [{ state: "POS-07", cue: null, window: null, basis: "Action that worsens the sequence, not a recovery." }, { state: "POS-01", cue: null, window: null, basis: "The same wrong-train action during the at-power response (ET-PLOFC)." }], es: "ESF-LATE", note: "An action that trips the running cooling train and worsens the sequence is in scope, not only failure to help.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-AT-003", systems: ["SYS-SCS"], name: "Operator inadvertent trip of the operating forced-cooling train", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Forced-cooling maneuver work order"], cue: "Error during a forced-cooling train maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused loss-of-forced-cooling initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused loss-of-forced-cooling initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused loss-of-forced-cooling initiator quantified here and supplied to IE." }, { state: "POS-04", cue: null, window: null, basis: "Human-caused loss-of-forced-cooling initiator quantified here and supplied to IE." }, { state: "POS-07", cue: null, window: null, basis: "Human-caused loss-of-forced-cooling initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE loss-of-forced-cooling initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-004", systems: ["SYS-HIC"], name: "Operator inadvertent depressurization during shutdown maintenance", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Maintenance vent line-up work order"], cue: "Error during a vent or relief line-up in shutdown.", timing2: [{ state: "POS-04", cue: null, window: null, basis: "Human-caused depressurization initiator quantified here and supplied to IE." }, { state: "POS-05", cue: null, window: null, basis: "Human-caused depressurization initiator quantified here and supplied to IE." }, { state: "POS-08", cue: null, window: null, basis: "Human-caused depressurization initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE maintenance depressurization initiator and the shutdown depressurization trees.", srs: ["HR-F1"] },
  { id: "HR-AT-005", systems: ["SYS-SGISO"], name: "Operator secondary mis-line-up causing moisture ingress", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Secondary line-up work order"], cue: "Error during a steam-generator or secondary line-up.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused moisture-ingress initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused moisture-ingress initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused moisture-ingress initiator quantified here and supplied to IE." }, { state: "POS-04", cue: null, window: null, basis: "Human-caused moisture-ingress initiator quantified here and supplied to IE." }, { state: "POS-05", cue: null, window: null, basis: "Human-caused moisture-ingress initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator moment, connected to the IE operator-caused moisture-ingress initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-006", systems: ["SYS-RB"], name: "Operator fuel-handling mis-positioning during refuelling", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Refuelling line-up work order"], cue: "Error during a fuel-handling or refuelling line-up step.", timing2: [{ state: "POS-06", cue: null, window: null, basis: "Human-caused refuelling initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator refuelling moment, connected to the IE fuel-handling initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-007", systems: ["SYS-RPS"], name: "Erroneous control rod withdrawal at power", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Rod maneuver procedure"], cue: "Error during a rod or rod-group maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused reactivity initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator rod-withdrawal moment, connected to the IE erroneous-withdrawal initiator, terminated by the protection system and the negative temperature feedback.", srs: ["HR-F1"] },
  { id: "HR-AT-008", systems: ["SYS-RPS"], name: "Erroneous shutdown-margin line-up during startup", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Startup line-up procedure"], cue: "Error during a startup rod or reserve-shutdown line-up.", timing2: [{ state: "POS-03", cue: null, window: null, basis: "Human-caused startup reactivity initiator quantified here and supplied to IE." }, { state: "POS-05", cue: null, window: null, basis: "Human-caused startup reactivity initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator startup mis-positioning moment, connected to the IE startup reactivity initiator.", srs: ["HR-F1"] },
  { id: "HR-AT-009", systems: ["SYS-SGISO"], name: "Operator-induced overcooling transient", timing: "AT_INITIATOR", respType: "AGGRAVATING_ACTION", impact: "SYSTEM", sc: [], proc: ["Secondary flow-control procedure"], cue: "Error during a secondary flow or feedwater maneuver.", timing2: [{ state: "POS-01", cue: null, window: null, basis: "Human-caused overcooling initiator quantified here and supplied to IE." }, { state: "POS-02", cue: null, window: null, basis: "Human-caused overcooling initiator quantified here and supplied to IE." }, { state: "POS-03", cue: null, window: null, basis: "Human-caused overcooling initiator quantified here and supplied to IE." }], es: null, note: "The at-initiator overcooling moment, connected to the IE operator-induced overcooling initiator.", srs: ["HR-F1"] },
  { id: "HR-POST-025", systems: ["SYS-HPBI"], name: "Fails to isolate the leaking helium segment", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["SYS-HPBI"], proc: ["Depressurization isolation procedure step 4"], cue: "Depressurization and leak-detection alarm with falling pressure.", timing2: [{ state: "POS-01", cue: 12, window: 60, basis: "Realistic pressure transient from the depressurization analysis." }, { state: "POS-02", cue: 12, window: 60, basis: "Small-leak isolation window in reduced and experimental power (ET-SHEL-P02)." }, { state: "POS-03", cue: 12, window: 65, basis: "Small-leak isolation window in hot standby (ET-SHEL-P03)." }, { state: "POS-04", cue: 12, window: 70, basis: "Isolation window in forced cooldown (ET-SHEL-P04)." }, { state: "POS-05", cue: 14, window: 80, basis: "Isolation window in cold shutdown (ET-SHEL-P05)." }, { state: "POS-06", cue: 14, window: 90, basis: "Interfacing-release isolation during refuelling (ET-IFR-P06)." }, { state: "POS-08", cue: 12, window: 60, basis: "Isolation window with the shutdown-cooling train out of service (ET-SHEL-P08)." }], es: "ESF-LEAK", note: "Placed by Systems Analysis in the helium-boundary isolation model (SYS-HPBI).", srs: ["HR-F1", "HR-F3", "HR-F4"] },
  { id: "HR-POST-026", systems: ["SYS-HIC"], name: "Fails to initiate helium make-up", timing: "POST_INITIATOR", respType: "INITIATE", impact: "SYSTEM", sc: ["SYS-HIC"], proc: ["Helium make-up procedure step 3"], cue: "Falling helium pressure after a confirmed leak.", timing2: [{ state: "POS-01", cue: 20, window: 180, basis: "Long make-up window against the bounded leak rate." }, { state: "POS-02", cue: 20, window: 180, basis: "Make-up window in reduced and experimental power (ET-HINV-P02)." }, { state: "POS-03", cue: 20, window: 190, basis: "Make-up window in hot standby (ET-HINV-P03)." }, { state: "POS-04", cue: 22, window: 200, basis: "Make-up window after a shutdown depressurization (ET-HINV-P04, ET-ODEP-P04)." }, { state: "POS-05", cue: 24, window: 220, basis: "Make-up window in cold shutdown (ET-HINV-P05, ET-ODEP-P05)." }, { state: "POS-08", cue: 22, window: 200, basis: "Make-up window with the shutdown-cooling train out of service (ET-HINV-P08, ET-ODEP-P08)." }], es: "ESF-LEAK", note: "Placed by Systems Analysis in the helium inventory and pressure control model (SYS-HIC).", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-028", systems: ["SYS-RB"], name: "Fails to start the standby reactor-building filtration train", timing: "POST_INITIATOR", respType: "INITIATE", impact: "SYSTEM", sc: ["SYS-RB"], proc: ["Confinement filtration procedure step 2"], cue: "Reactor-building activity alarm after a release.", timing2: [{ state: "POS-01", cue: 15, window: 120, basis: "Slow reactor-building activity build-up." }], es: "ESF-LEAK", note: "Placed by Systems Analysis as the standby-train start inside the reactor-building filtration model (SYS-RB), backing the automatic alignment credited in the Event Sequence confinement function.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-030", systems: ["SYS-DETECT"], name: "Fails to detect and stop the inadvertent depressurization", timing: "POST_INITIATOR", respType: "TERMINATE", impact: "SYSTEM", sc: [], proc: ["Depressurization response procedure step 1"], cue: "Depressurization and leak-detection alarm during shutdown maintenance.", timing2: [{ state: "POS-04", cue: 3, window: 20, basis: "Detect and stop the maintenance depressurization before the inventory loss propagates (ET-ODEP-P04)." }, { state: "POS-05", cue: 3, window: 20, basis: "Detect-and-stop window in cold shutdown (ET-ODEP-P05)." }, { state: "POS-08", cue: 3, window: 15, basis: "Shortest window with the shutdown-cooling train out of service (ET-ODEP-P08)." }, { state: "POS-06", cue: 2, window: 10, basis: "Detect and stop the fuel-handling release (ET-FHE-P06)." }], es: "ESF-LEAK", note: "Detect the depressurization on the monitors and stop the source, the detect-and-stop branch of the shutdown depressurization trees.", srs: ["HR-F1", "HR-F4"] },
  { id: "HR-POST-032", systems: ["SYS-SCS"], name: "Fails to isolate the shutdown-cooling heat-exchanger water ingress", timing: "POST_INITIATOR", respType: "ISOLATE", impact: "TRAIN", sc: ["SYS-SCS"], proc: ["SCS water-ingress procedure step 3"], cue: "Moisture alarm with the shutdown-cooling system in service.", timing2: [{ state: "POS-04", cue: 6, window: 90, basis: "Water-ingress isolation in forced cooldown (ET-SCSI-P04)." }, { state: "POS-05", cue: 6, window: 100, basis: "Water-ingress isolation in cold shutdown (ET-SCSI-P05)." }, { state: "POS-06", cue: 8, window: 110, basis: "Water-ingress isolation during refuelling (ET-SCSI-P06)." }, { state: "POS-08", cue: 6, window: 90, basis: "Water-ingress isolation in the maintenance state (ET-SCSI-P08)." }], es: "ESF-LEAK", note: "Isolate the shutdown-cooling heat exchanger on a moisture alarm in the shutdown states, the isolation branch of the SCS water-ingress trees.", srs: ["HR-F1", "HR-F4"] },
].map((h) => ({
  uuid: h.id,
  name: h.name,
  hfeTiming: h.timing as "POST_INITIATOR" | "AT_INITIATOR",
  description: h.note,
  impactLevel: h.impact as "FUNCTION" | "SYSTEM" | "TRAIN" | "COMPONENT",
  affectedSystems: h.systems,
  applicablePlantOperatingStates: h.timing2.map((t) => t.state),
  applicableEventSequences: h.es !== null ? [h.es] : [],
  applicableInitiatingEvents: h.id === "HR-AT-003" ? ["IE-46"] : h.id === "HR-AT-004" ? ["IE-43"] : h.id === "HR-AT-005" ? ["IE-47"] : h.id === "HR-AT-006" ? ["IE-44"] : h.id === "HR-AT-007" ? ["IE-41"] : h.id === "HR-AT-008" ? ["IE-42"] : h.id === "HR-AT-009" ? ["IE-45"] : undefined,
  groupedResponses: h.id === "HR-POST-022" ? ["HR-POST-025"] : undefined,
  crossPosGroupingBasis: h.id === "HR-POST-022" ? "EQUIVALENT_BOUNDARY_CONDITIONS" : undefined,
  groupingJustification: h.id === "HR-POST-022" ? "The steam-generator isolation and the helium-boundary isolation share equivalent boundary conditions in the leak sequence, so they are grouped where the conditions match." : undefined,
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
  { id: "RR-1", scope: "EMERGENCY_AND_ABNORMAL_PROCEDURES", date: "2026-04-24", sources: ["Emergency operating procedures", "Abnormal operating procedures", "Annunciator response procedures"], findings: "Found the actions to start the second shutdown-cooling train, diagnose and isolate a primary-coolant moisture ingress, isolate a leaking helium segment, isolate the shutdown-cooling heat-exchanger ingress, detect and stop an inadvertent depressurization, initiate helium make-up, and start the standby filtration train.", hfes: ["HR-POST-018", "HR-POST-020", "HR-POST-022", "HR-POST-025", "HR-POST-032", "HR-POST-030", "HR-POST-026", "HR-POST-028"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-2", scope: "TRAINING_MATERIALS", date: "2026-04-25", sources: ["Operator training program", "Simulator scenario set"], findings: "Found the diagnosis cues and the isolation action for a moisture ingress.", hfes: ["HR-POST-020", "HR-POST-022"], srs: ["HR-E1", "HR-E4"] },
  { id: "RR-3", scope: "NONNUCLEAR_FACILITY_EXPERIENCE", date: "2026-04-25", sources: ["Gas-facility operating records", "Chemical plant control-room studies"], findings: "Borrowed diagnosis and execution evidence where the operating crew does not yet exist.", hfes: ["HR-POST-018"], srs: ["HR-E3"] },
  { id: "RR-4", scope: "OPERATIONAL_EVENTS", date: "2026-04-26", sources: ["Research reactor operating events", "Gas-facility upset reports", "Maintenance work-order history"], findings: "Identified the aggravating and operator-caused at-initiator actions: the wrong-train trip during a response, the operator trip of the operating forced-cooling train during a maneuver, the shutdown depressurization, the secondary mis-line-up moisture ingress, the fuel-handling mis-positioning, the erroneous rod withdrawal, the startup mis-positioning, and the operator-induced overcooling.", hfes: ["HR-AG-001", "HR-AT-003", "HR-AT-004", "HR-AT-005", "HR-AT-006", "HR-AT-007", "HR-AT-008", "HR-AT-009"], srs: ["HR-E4"] },
  { id: "RR-5", scope: "PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH", date: "2026-04-24", sources: ["Draft emergency operating procedures", "Draft abnormal operating procedures", "Operational-approach description"], findings: "Confirmed from the planned procedures that the shutdown-cooling start and leak-isolation actions are the primary operator responses for the modeled sequences.", hfes: ["HR-POST-018", "HR-POST-025"], srs: ["HR-E1", "HR-E9"] },
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
  { id: "CF-1", hfes: ["HR-POST-018", "HR-POST-020", "HR-POST-022"], method: "PERSONNEL_REVIEW", roles: ["Operations supervisor", "Training instructor"], date: "2026-04-28", findings: "The action interpretation is consistent with operations and training intent.", srs: ["HR-E5"] },
  { id: "CF-2", hfes: ["HR-POST-018", "HR-POST-020", "HR-POST-022"], method: "TALK_THROUGH", roles: ["Reactor operator", "Human factors analyst"], date: "2026-05-01", findings: "Walked the shutdown-cooling start and the moisture isolation actions step by step against the event sequence.", srs: ["HR-E7"] },
  { id: "CF-3", hfes: ["HR-POST-018"], method: "SIMULATION_OBSERVATION", roles: ["Crew of two", "Observer"], date: "2026-05-04", findings: "Observed the diagnosis and the execution on the engineering simulator.", srs: ["HR-E7", "HR-G8"] },
  { id: "CF-4", hfes: ["HR-AT-003"], method: "PERSONNEL_REVIEW", roles: ["Operations supervisor", "Maintenance lead"], date: "2026-04-29", findings: "Reviewed the operator-caused forced-cooling trip against the work-control practice and the support-system initiator model.", srs: ["HR-E5"] },
  { id: "CF-5", hfes: ["HR-AT-003"], method: "TALK_THROUGH", roles: ["Reactor operator", "Human factors analyst"], date: "2026-05-02", findings: "Walked the forced-cooling maneuver step by step to confirm the at-initiator moment and its recovery path.", srs: ["HR-E7"] },
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
  { id: "HR-PRE-014", methodology: "Detailed assessment of a common moisture-monitor miscalibration.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 2.4e-3, factors: ["Common procedure step", "No independent channel readback", "Shared calibration standard"], unc: "Lognormal distribution with an error factor of 5, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
  { id: "HR-PRE-009", methodology: "Conservative screening value for a charger restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 5.0e-3, mean: null, factors: ["Monthly surveillance credited"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D6"] },
  { id: "HR-PRE-022", methodology: "Conservative screening value for a single-train restoration error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 1.0e-2, mean: null, factors: ["Post-maintenance test credited"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-D1", "HR-D2", "HR-D5"] },
  { id: "HR-PRE-031", methodology: "Detailed assessment of a common setpoint miscalibration.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 1.1e-3, factors: ["Common procedure", "Diverse feedback provides partial backup"], unc: "Lognormal distribution with an error factor of 6, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
  { id: "HR-PRE-018", methodology: "Detailed assessment of a common passive-cooling duct misalignment.", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 1.5e-3, factors: ["Common procedure", "Shared surveillance equipment", "Passive natural circulation provides partial backup"], unc: "Lognormal distribution with an error factor of 6, risk-significant.", srs: ["HR-D1", "HR-D2", "HR-D4", "HR-D8"] },
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
  { id: "HR-POST-018", methodology: "Detailed time-reliability analysis with performance factors.", type: "DETAILED_ASSESSMENT", rs: true, cog: 1.0e-3, exe: 5.0e-4, mean: 1.5e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 1980, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 10, req: 30, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Very wide window from graphite thermal inertia.", impact: "DECREASE" }, { factor: "Workload", evaluation: "Single dedicated action, low competing demand.", impact: "DECREASE" }, { factor: "Training", evaluation: "Action is a trained scenario.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 4, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G4", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-020", methodology: "Detailed diagnosis analysis for the moisture-ingress recognition.", type: "DETAILED_ASSESSMENT", rs: true, cog: 2.5e-3, exe: 5.0e-4, mean: 3.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 30, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 5, req: 12, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short diagnosis window against the required time.", impact: "INCREASE" }, { factor: "Human-system interface", evaluation: "Clear moisture-monitor alarm.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-022", methodology: "Detailed analysis of a short-window isolation action.", type: "DETAILED_ASSESSMENT", rs: true, cog: 3.0e-3, exe: 1.5e-3, mean: 4.5e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 120, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 5, req: 20, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Moderate window before the oxidation bound.", impact: "NEUTRAL" }, { factor: "Accessibility", evaluation: "Local action in a normal-access area.", impact: "NEUTRAL" }], unc: "Lognormal with an error factor of 5, risk-significant.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G8", "HR-G14"] },
  { id: "HR-POST-025", methodology: "Detailed analysis of a short-window isolation action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 3.5e-3, exe: 1.5e-3, mean: 5.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 60, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 12, req: 22, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Adequate window against the required time.", impact: "DECREASE" }, { factor: "Accessibility", evaluation: "Local isolation valves in a normal-access area.", impact: "NEUTRAL" }], unc: "Lognormal with an error factor of 5.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-026", methodology: "Detailed analysis of a long-window make-up action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 4.0e-3, exe: 2.0e-3, mean: 6.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 180, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 20, req: 30, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Long window relative to the action.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 5.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-030", methodology: "Detailed analysis of a short-window detect-and-stop action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 8.0e-3, exe: 4.0e-3, mean: 1.2e-2, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 20, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 3, req: 10, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Short detection window against the required time.", impact: "INCREASE" }, { factor: "Human-system interface", evaluation: "Clear leak-detection alarm.", impact: "DECREASE" }], unc: "Lognormal with an error factor of 5.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-032", methodology: "Detailed analysis of a shutdown water-ingress isolation action.", type: "DETAILED_ASSESSMENT", rs: false, cog: 4.0e-3, exe: 2.0e-3, mean: 6.0e-3, point: null, ind: "EVALUATED_PER_SEQUENCE", avail: 90, availBasis: "REALISTIC_PLANT_SPECIFIC_ANALYSIS", cueArr: 6, req: 25, reqBasis: "MEASURED_TALK_THROUGH", psfs: [{ factor: "Time available", evaluation: "Adequate window against the required time.", impact: "DECREASE" }, { factor: "Workload", evaluation: "Shutdown maintenance activity in the area.", impact: "INCREASE" }], unc: "Lognormal with an error factor of 5.", srs: ["HR-G1", "HR-G3", "HR-G6", "HR-G7"] },
  { id: "HR-POST-028", methodology: "Conservative screening value for a slow filtration action.", type: "CONSERVATIVE_ESTIMATE", rs: false, cog: 1.0e-2, exe: 5.0e-3, mean: null, point: 1.5e-2, ind: "ASSUMED_AVAILABLE", avail: 120, availBasis: "GENERIC_STUDY", cueArr: 15, req: 30, reqBasis: "ESTIMATED", psfs: [{ factor: "Time available", evaluation: "Long window relative to the action.", impact: "DECREASE" }], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G3", "HR-G5", "HR-G7"] },
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
  { id: "HR-AT-003", methodology: "Human-error-probability times demand for the operator-caused loss of forced cooling, supplied to Initiating Events (IE-A5).", type: "DETAILED_ASSESSMENT", rs: true, point: null, mean: 3.0e-3, factors: ["Forced-cooling maneuver work order without independent verification", "Diverse cooling alignment provides partial backup"], unc: "Lognormal with an error factor of 5, supplied to the IE loss-of-forced-cooling initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-004", methodology: "Human-error-probability times demand for the operator-caused shutdown depressurization, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Vent line-up under a maintenance work order", "Leak detection provides a short recovery path"], unc: "Lognormal with an error factor of 5, supplied to the IE maintenance depressurization initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-005", methodology: "Human-error-probability times demand for the operator secondary mis-line-up, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 1.5e-3, factors: ["Secondary line-up under procedure", "Moisture monitors provide the detection backstop"], unc: "Lognormal with an error factor of 5, supplied to the IE operator-caused moisture-ingress initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-006", methodology: "Human-error-probability times demand for the refuelling mis-positioning, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 1.0e-3, factors: ["Refuelling line-up under independent verification", "Fuel-handling interlocks provide partial backup"], unc: "Lognormal with an error factor of 5, supplied to the IE fuel-handling initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-007", methodology: "Human-error-probability times demand for the erroneous rod withdrawal, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Rod maneuver under procedure", "Protection system and temperature feedback terminate the withdrawal"], unc: "Lognormal with an error factor of 5, supplied to the IE erroneous-withdrawal initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-008", methodology: "Human-error-probability times demand for the startup mis-positioning, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 1.5e-3, factors: ["Startup line-up under independent verification", "Startup interlocks provide partial backup"], unc: "Lognormal with an error factor of 5, supplied to the IE startup reactivity initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AT-009", methodology: "Human-error-probability times demand for the operator-induced overcooling, supplied to Initiating Events.", type: "DETAILED_ASSESSMENT", rs: false, point: null, mean: 2.0e-3, factors: ["Secondary flow maneuver under procedure", "Reactor trip provides partial backup"], unc: "Lognormal with an error factor of 5, supplied to the IE operator-induced overcooling initiator.", srs: ["HR-G1", "HR-G3", "HR-G14"] },
  { id: "HR-AG-001", methodology: "Conservative screening value for an aggravating action that trips a running cooling train in error.", type: "CONSERVATIVE_ESTIMATE", rs: false, point: 1.0e-2, mean: null, factors: ["Clear train indication", "Caution note in the procedure"], unc: "Point value with a stated bound at CC-I.", srs: ["HR-G1", "HR-G5"] },
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
  { id: "REC-Q-1", hfe: "HR-POST-018", methodology: "Detailed recovery credit for restarting shutdown cooling from the remote panel, with the recovery-time basis from Data Analysis RC-3 (remote-panel shutdown-cooling restart).", mean: 8.0e-2, unc: "Lognormal with an error factor of 4 on the recovery action.", srs: ["HR-H4", "HR-G1"] },
  { id: "REC-Q-2", hfe: "HR-AT-003", methodology: "Recovery credit for restarting the forced-cooling train, with high dependence carried explicitly for a self-caused loss.", mean: 2.0e-1, unc: "Point recovery value, high dependence on the self-caused loss carried in DEP-2.", srs: ["HR-H4", "HR-H5"] },
  { id: "REC-Q-3", hfe: "HR-PRE-022", methodology: "Recovery credit for re-aligning a misaligned shutdown-cooling train during the event.", mean: 1.5e-1, unc: "Point recovery value, local access under review.", srs: ["HR-H4"] },
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
    commonElements: ["Same instrument crew across the moisture-monitor, RCCS and RPS calibrations", "Common calibration procedure", "Shared calibration standard", "Same shift"],
    dependenceLevel: "HIGH",
    jointHep: 1.2e-3,
    implementsSrs: srs("HR-D7"),
  },
  {
    uuid: "DEP-1",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-020", "HR-POST-022"],
    eventSequenceId: "ESF-LEAK",
    commonElements: ["Same crew", "Same moisture sequence", "Shared moisture diagnosis"],
    dependenceLevel: "MODERATE",
    jointHep: 6.0e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-2",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-AT-003"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same operator", "Same forced-cooling maneuver", "Recovery of a self-caused loss"],
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
    hfeIds: ["HR-POST-022", "HR-POST-025"],
    eventSequenceId: "ESF-LEAK",
    commonElements: ["Same crew", "Same leak sequence", "Grouped isolation actions"],
    dependenceLevel: "MODERATE",
    jointHep: 9.0e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-4",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-018", "HR-AG-001"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same crew", "Same loss-of-forced-cooling response", "Wrong-train action against the start action"],
    dependenceLevel: "LOW",
    jointHep: 1.0e-4,
    belowFloor: false,
    includesRecoveryHfe: false,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13"),
  },
  {
    uuid: "DEP-5",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-POST-018"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Same crew for the failed start and the remote-panel restart"],
    dependenceLevel: "MODERATE",
    jointHep: 1.2e-4,
    belowFloor: false,
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
  {
    uuid: "DEP-6",
    scope: "WITHIN_SEQUENCE",
    hfeIds: ["HR-PRE-022"],
    eventSequenceId: "ESF-LATE",
    commonElements: ["Restoration error and its in-event re-alignment by the same maintenance crew"],
    dependenceLevel: "MODERATE",
    jointHep: 1.5e-3,
    belowFloor: false,
    includesRecoveryHfe: true,
    includesInitiatorCausingHfe: false,
    implementsSrs: srs("HR-G12", "HR-G13", "HR-H5"),
  },
];

const recoveryActions: RecoveryAction[] = [
  { id: "REC-1", name: "Restart shutdown cooling from the remote panel", hfeId: "HR-POST-018", level: "SEQUENCE", fn: "Forced core cooling", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: true, equipment: true }, preop: null, hep: "REC-Q-1", dep: "DEP-5", srs: ["HR-H1", "HR-H2", "HR-H4"] },
  { id: "REC-2", name: "Restart the forced-cooling train by manual line-up", hfeId: "HR-AT-003", level: "SEQUENCE", fn: "Forced core cooling", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: false, time: true, accessibility: true, equipment: true }, preop: "Manpower assumption for the off-shift case logged until staffing is set.", hep: "REC-Q-2", dep: "DEP-2", srs: ["HR-H2", "HR-H3", "HR-H5"] },
  { id: "REC-3", name: "Re-align a misaligned shutdown-cooling train", hfeId: "HR-PRE-022", level: "CUTSET", fn: "Shutdown-cooling train", seqs: ["ESF-LATE"], feas: { procedure: true, training: true, cues: true, manpower: true, time: true, accessibility: false, equipment: true }, preop: "Local access during the event under review against the as-built layout.", hep: "REC-Q-3", dep: "DEP-6", srs: ["HR-H2", "HR-H3"] },
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
  { id: "PA-3", area: "Quantification", desc: "Timing from design analysis and the Data Analysis surveillance and exposure schedule (DM-1 to DM-3, EX-1, EX-2), to re-measure on the as-built simulator.", sr: "HR-G16", path: "hepQuantifications" },
  { id: "PA-4", area: "Recovery", desc: "Recovery feasibility rests on the as-built layout and staffing.", sr: "HR-H6", path: "recoveryActions" },
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

export const HR_ANALYSIS_HTGR: HumanReliabilityAnalysis = {
  uuid: "hr-generic-2",
  name: "HR Workbook 1",
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
    scope: "Human reliability analysis for the Generic HTGR, a helium-cooled prismatic high-temperature gas reactor, modeling human failure events before, at and after the initiating event and quantifying their probabilities.",
    limitations: ["Pre-operational: activities, actions and timing rest on planned procedures and borrowed experience pending as-built confirmation."],
    lastModifiedDate: NOW,
    lastModifiedBy: "aosei",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 3,
    resolvedCount: 2,
    comments: [
      { uuid: "hrc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T09:14:00.000Z", associatedSr: "HR-G8", text: "The shutdown-cooling start action is risk-significant, so HR-G8 needs the required time measured on the simulator rather than estimated, with enough runs to characterize the spread.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-05-06T10:30:00.000Z", associatedSr: "HR-G12", text: "The diagnosis error and the isolation error share a crew and a timeframe, so HR-G12 needs the within-sequence joint probability calculated and checked against the floor under HR-G13.", severity: "MAJOR", resolved: true, resolution: "The within-sequence joint probability is carried in DEP-1 at 6.0e-4 and checked against the floor.", resolvedAt: "2026-05-08T09:00:00.000Z", resolvedBy: "rev-3" },
      { uuid: "hrc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-07T14:05:00.000Z", associatedSr: "HR-H2", text: "The forced-cooling restart recovery rests on an off-shift manpower assumption, so HR-H2 needs the feasibility shown or HR-H3 applied to leave it out until staffing is set.", severity: "MAJOR", resolved: false },
      { uuid: "hrc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-05-07T15:20:00.000Z", associatedSr: "HR-A6", text: "The RPS setpoint calibration may reach the diverse actuation, so HR-A6 needs the diverse-system reach confirmed so the activity stays protected from screening under HR-B3.", severity: "MINOR", resolved: false },
      { uuid: "hrc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-05-07T16:00:00.000Z", associatedSr: "HR-B3", text: "The multi-train prohibition is applied consistently to the moisture-monitor, RCCS and RPS calibrations.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the prohibition is applied consistently.", resolvedAt: "2026-05-07T17:30:00.000Z", resolvedBy: "rev-1" },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope human reliability analysis for the Generic HTGR, pre-operational stage, capability category CC-II.",
  dependencyBayesianNetworks: [createExampleDependencyNetwork()],
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
      hfeIdsReviewed: ["HR-POST-018", "HR-POST-022", "HR-POST-028", "HR-POST-030", "HR-PRE-014"],
      relativeReasonablenessConfirmed: true,
      basis: "SIMILAR_PLANT_AND_SCENARIO_CONTEXT",
      findings: "The detailed short-window actions carry higher values than the wide-window shutdown-cooling action, and the conservative screening values sit above the detailed values, both of which are reasonable.",
      implementsSrs: srs("HR-G9", "HR-G10"),
    },
  ],
  errorForcingContexts: [
    { uuid: "EFC-1", hfeId: "HR-POST-018", unsafeAction: "Holds the shutdown-cooling start believing the passive cooling already suffices.", plantConditions: ["Slow core-outlet temperature rise", "Passive cooling apparently adequate"], performanceShapingFactors: ["Ambiguous indication", "Reliance on the passive backstop"], vulnerability: "The wide graphite window and the passive cavity cooling can be read as no action needed, so the crew holds the active start.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
    { uuid: "EFC-2", hfeId: "HR-AG-001", unsafeAction: "Trips a running shutdown-cooling train believing it is the faulted one.", plantConditions: ["Two trains alarming at once", "Look-alike train indications"], performanceShapingFactors: ["Adjacent identical controls", "Time pressure"], vulnerability: "Identical adjacent controls invite a wrong-train action under pressure.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
    { uuid: "EFC-3", hfeId: "HR-AT-003", unsafeAction: "Trips the operating forced-cooling train during a maneuver.", plantConditions: ["Forced-cooling maneuver in progress", "Partial labeling"], performanceShapingFactors: ["Procedure not place-kept", "Shift-handover gap"], vulnerability: "A labeling and handover gap can route the maneuver to the running train.", searchMethod: "ATHEANA qualitative search", implementsSrs: srs("HR-G3", "HR-G4") },
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
      { alternative: "Adopt a measured time-reliability curve for the shutdown-cooling start action in place of the design-analysis timing.", reasonNotSelected: "The as-built simulator is not yet available to measure the required-time spread." },
    ],
  },
  preOperationalAssumptions,
  sensitivityStudies: [
    { uuid: "SS-1", name: "Dependence sweep", description: "Dependence sweep across the human action set.", variedParameters: ["Dependence level"], parameterRanges: { "Dependence level": [0, 1] }, results: "The sequence result holds within a factor of two across the dependence range.", modelUncertaintyId: "hr-mu-1" },
    { uuid: "SS-2", name: "Time-available sweep", description: "Time available against the required time for the shutdown-cooling start action.", variedParameters: ["Time available (min)"], parameterRanges: { "Time available (min)": [30, 1980] }, results: "The shutdown-cooling start action stays below the screening value across the 30 to 1980 minute band, well above the 30 minute required time.", modelUncertaintyId: "hr-mu-1" },
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
    { id: "HR-DOC-01", name: "Gas-reactor probabilistic risk assessment methodology", kind: "doc", sizeLabel: "INL", uploadedLabel: "INL-EXT-11-21270", extracted: "The gas-reactor PRA framework and its treatment of operator actions the analysis draws on", linked: 4, url: "/api/example-documents/hr/ngnp-pra" },
    { id: "HR-DOC-02", name: "Modular high-temperature gas reactor safety characterization", kind: "doc", sizeLabel: "ORNL", uploadedLabel: "ORNL-TM-2014-187", extracted: "The passive-safety and operator-action context for the response actions", linked: 3, url: "/api/example-documents/hr/htgr-safety" },
    { id: "HR-DOC-03", name: "High-temperature gas reactor core-design benchmark", kind: "doc", sizeLabel: "OECD-NEA", uploadedLabel: "INL-EXT-13-30176", extracted: "Plant, core and transient data supporting the cue timing and the time available for the modeled actions", linked: 3, url: "/api/example-documents/hr/mhtgr-benchmark" },
    { id: "HR-DOC-04", name: "High-temperature gas reactor multi-physics analysis", kind: "doc", sizeLabel: "ISN", uploadedLabel: "ISN-0022-3131", extracted: "The transient timing analysis supporting the required-time bases for the risk-significant actions", linked: 2, url: "/api/example-documents/hr/mhtgr-analysis" },
  ],
  configurationControlRecordId: "cc-2026.04.18-001",
  newlyDevelopedMethodIds: ["NM-081", "NM-066", "NM-074"],
};

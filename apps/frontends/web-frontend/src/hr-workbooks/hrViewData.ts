import { HR_SR_CATALOG } from "interfaces-mef-types/hr/human-reliability-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface HrStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  terminal?: boolean;
}

const HR_STEPS: HrStep[] = [
  { id: "scope", num: "01", label: "Scope & Sources", sub: "Sources · interfaces · setup", status: "idle" },
  { id: "preid", num: "02", label: "Pre-initiator: Identify", sub: "Routine activities (HLR-A)", status: "idle" },
  { id: "predef", num: "03", label: "Pre-initiator: Define", sub: "Screen · define (HLR-B, C)", status: "idle" },
  { id: "prequant", num: "04", label: "Pre-initiator: Quantify", sub: "HEPs · recovery (HLR-D)", status: "idle" },
  { id: "respid", num: "05", label: "Response: Identify", sub: "Review · confirm (HLR-E)", status: "idle" },
  { id: "respdef", num: "06", label: "Response: Define", sub: "HFEs · cue timing (HLR-F)", status: "idle" },
  { id: "respquant", num: "07", label: "Response: Quantify", sub: "HEPs · PSFs (HLR-G)", status: "idle" },
  { id: "recovery", num: "08", label: "Recovery", sub: "Feasibility · credit (HLR-H)", status: "idle" },
  { id: "uncert", num: "09", label: "Dependence & Uncertainty", sub: "Joint floor · sources", status: "idle" },
  { id: "draft", num: "10", label: "Draft", sub: "Produce HR report (HLR-I)", status: "idle", terminal: true },
  { id: "review", num: "11", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "12", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type HrPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: HrPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const HR_PERSONAS: Record<HrPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = HR_STEPS.map((s) => s.id);
const HR_PERSONA_STEPS: Record<HrPersona, string[]> = {
  preparer: ALL_STEP_IDS,
  reviewer: ALL_STEP_IDS,
  approver: ALL_STEP_IDS,
};

interface CapabilityCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { id: "cc-i", name: "CC-I", tag: "Screened", description: "Conservative human error probabilities. Indications assumed available and timing taken from generic studies." },
  { id: "cc-ii", name: "CC-II", tag: "Detailed", description: "Detailed assessments for risk-significant human failure events. Timing measured and performance factors evaluated." },
];

type Stage = "pre_operational" | "operational";
type ConformanceStatus = "ok" | "warn" | "blocked" | "na";

interface ConformanceItem {
  id: string;
  section: string;
  hlr: string;
  text: string;
  status: ConformanceStatus;
  requiredAt: string[];
  stages: string[];
  meta?: string;
  linkedNM?: string;
}

const HLR_SECTION: Record<string, string> = {
  A: "Pre-initiator: identify (HLR-A)",
  B: "Pre-initiator: screen (HLR-B)",
  C: "Pre-initiator: define (HLR-C)",
  D: "Pre-initiator: quantify (HLR-D)",
  E: "Response: identify (HLR-E)",
  F: "Response: define (HLR-F)",
  G: "Response: quantify (HLR-G)",
  H: "Recovery (HLR-H)",
  I: "Document (HLR-I)",
};

const HR_SR_DESCRIPTIONS: Record<string, string> = {
  "HR-A1": "Identify the activities that realign equipment away from its normal or standby state",
  "HR-A2": "Define and implement a process to identify the realignment activities where procedures do not yet exist",
  "HR-A3": "Identify the calibration activities that can corrupt automatic initiation or operator indications",
  "HR-A4": "Define and implement a process to identify the calibration activities where procedures do not yet exist",
  "HR-A5": "Flag the work practices that can affect multiple trains or diverse systems at once",
  "HR-A6": "Define and implement a process to flag the multi-train work practices where procedures do not yet exist",
  "HR-A7": "Include the operator-error contributions in the support-system initiating event fault trees",
  "HR-A8": "Set the level of detail of the pre-initiator events against the available design information",
  "HR-A9": "Identify the model-uncertainty sources and assumptions in the pre-initiator identification",
  "HR-A10": "Log the pre-operational assumptions in the pre-initiator identification",
  "HR-B1": "Screen the pre-initiator events with screening-grade criteria per operating state",
  "HR-B2": "Screen across operating states only where an administrative control catches the error before the transition",
  "HR-B3": "Do not screen out activities that can affect multiple trains or diverse systems at once",
  "HR-C1": "Define each pre-initiator human failure event at the function, system, train or component level",
  "HR-C2": "Determine how long the latent error sits undetected given the plant administrative practices",
  "HR-C3": "Define the pre-initiator events from design information where practices do not yet exist",
  "HR-C4": "Identify the unavailability modes that follow from a failure to restore equipment",
  "HR-C5": "Include miscalibration as an explicit unavailability mode",
  "HR-C6": "Log the pre-operational assumptions in the pre-initiator event definitions",
  "HR-D1": "Estimate the pre-initiator human error probabilities by a systematic process",
  "HR-D2": "Use conservative estimates at CC-I and detailed mean values for risk-significant events at CC-II",
  "HR-D3": "Use design information for the detailed assessment where plant-specific data does not yet exist",
  "HR-D4": "Weigh the plant or design-specific factors in the detailed assessment",
  "HR-D5": "Credit self-recovery such as a post-maintenance test only with a stated basis",
  "HR-D6": "Credit peer checking such as independent verification only with a stated maximum",
  "HR-D7": "Evaluate the pre-initiator events that share a cause and calculate the joint probability",
  "HR-D8": "Characterize the uncertainty at CC-I and provide a full distribution for risk-significant events at CC-II",
  "HR-D9": "Identify the model-uncertainty sources and assumptions in the pre-initiator quantification",
  "HR-D10": "Log the pre-operational assumptions in the pre-initiator quantification",
  "HR-E1": "Review the procedures, system information and training to find the response actions per sequence",
  "HR-E2": "Review the planned procedures and operational approach where finalized procedures do not exist",
  "HR-E3": "Identify and use applicable experience from other facilities, including nonnuclear ones",
  "HR-E4": "Identify the actions to initiate, operate, control, isolate or terminate the systems, and the aggravating actions",
  "HR-E5": "Review the interpretation of the actions with operations or training personnel",
  "HR-E6": "Review the planned response with available staff where operating personnel are not yet in place",
  "HR-E7": "Confirm the actions through talk-throughs or simulation observations at CC-II",
  "HR-E8": "Identify the model-uncertainty sources and assumptions in the response identification",
  "HR-E9": "Log the pre-operational assumptions in the response identification",
  "HR-F1": "Define each response human failure event at the appropriate level, grouping where impacts are similar or bounded",
  "HR-F2": "Define the response events from planned information where finalized procedures do not exist",
  "HR-F3": "Group the same response across operating states only where the boundary conditions are comparable",
  "HR-F4": "Carry the state and sequence-specific cue timing, time window, success criteria and procedural context",
  "HR-F5": "Log the pre-operational assumptions in the response event definitions",
  "HR-G1": "Use conservative human error probabilities at CC-I and detailed analyses for risk-significant events at CC-II",
  "HR-G2": "Use design information for the detailed response analysis where plant-specific data does not yet exist",
  "HR-G3": "Address both the failure in cognition and the failure to execute the action",
  "HR-G4": "Address the complexity at CC-I and evaluate the plant and scenario-specific performance factors at CC-II",
  "HR-G5": "Assume the indications are available at CC-I and evaluate whether they survive the scenario at CC-II",
  "HR-G6": "Take the time available from generic studies at CC-I and realistic design-specific analysis at CC-II",
  "HR-G7": "Identify the point at which the cue for the action arrives",
  "HR-G8": "Estimate the time required at CC-I and measure it for risk-significant events at CC-II",
  "HR-G9": "Confirm the human error probabilities make relative sense across the scenario set",
  "HR-G10": "Confirm the relative reasonableness against similar plant and scenario context where history does not yet exist",
  "HR-G11": "Define and justify a minimum value for the joint probability of multiple human errors",
  "HR-G12": "Assess the dependence among multiple actions per operating state and calculate the joint probability",
  "HR-G13": "Apply the minimum joint value or justify a lower value where the calculated joint falls below it",
  "HR-G14": "Provide a point estimate with characterization at CC-I and a mean with a distribution for risk-significant events at CC-II",
  "HR-G15": "Identify the dependence between pre-initiator and post-initiator events as an uncertainty source",
  "HR-G16": "Log the pre-operational assumptions in the response quantification",
  "HR-H1": "Identify the recovery actions that make a risk-significant sequence more realistic",
  "HR-H2": "Define a recovery action only where its feasibility is demonstrated plant or design-specifically",
  "HR-H3": "Justify the feasibility assumptions or leave the recovery out of the model where it cannot be shown",
  "HR-H4": "Quantify the recovery human error probabilities by the same rules at the same capability category",
  "HR-H5": "Include the dependence between the recovery event and every other event in the sequence",
  "HR-H6": "Log the pre-operational assumptions in the recovery treatment",
  "HR-I1": "Document the analysis with inputs, methods, events, screening, quantification and dependence",
  "HR-I2": "Document the model-uncertainty sources, citing HR-A9, HR-D9, HR-E8 and HR-G15",
  "HR-I3": "Document the pre-operational limitations, citing the pre-operational assumption requirements",
};

const HR_SR_META: Record<string, string> = {
  "HR-A6": "Diverse reach open",
  "HR-A7": "2 linked",
  "HR-B1": "1 screened",
  "HR-B3": "2 protected",
  "HR-D7": "1 set",
  "HR-E4": "5 found",
  "HR-G8": "Simulator runs pending",
  "HR-G12": "1 sequence open",
  "HR-H2": "2 feasibility open",
};

const HR_SR_LINKED_NM: Record<string, string> = {
  "HR-G11": "NM-081",
  "HR-G12": "NM-081",
  "HR-E3": "NM-066",
  "HR-G3": "NM-074",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(HR_SR_CATALOG).map((code) => {
    const meta = HR_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const preOnly = meta.stages.length === 1 && meta.stages[0] === "PRE_OPERATIONAL";
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-HR-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${HR_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: HR_SR_META[code] ?? (preOnly ? "Pre-op" : undefined),
      linkedNM: HR_SR_LINKED_NM[code],
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface MethodSpec {
  id: string;
  abbr: string;
  name: string;
  ref: string;
}

const HRA_METHODS: Record<string, MethodSpec> = {
  therp: { id: "therp", abbr: "THERP", name: "Technique for Human Error Rate Prediction", ref: "NUREG/CR-1278" },
  asep: { id: "asep", abbr: "ASEP", name: "Accident Sequence Evaluation Program", ref: "NUREG/CR-4772" },
  cbdt: { id: "cbdt", abbr: "CBDT", name: "Cause-Based Decision Tree", ref: "EPRI TR-100259" },
  "hcr-ore": { id: "hcr-ore", abbr: "HCR/ORE", name: "Human Cognitive Reliability and Operator Reliability Experiments", ref: "EPRI TR-100259" },
  "spar-h": { id: "spar-h", abbr: "SPAR-H", name: "Standardized Plant Analysis Risk-Human", ref: "NUREG/CR-6883" },
  atheana: { id: "atheana", abbr: "ATHEANA", name: "A Technique for Human Error Analysis", ref: "NUREG-1624" },
};

interface MomentSpec {
  id: string;
  label: string;
  tag: string;
  icon: string;
  hlrs: string;
  color: "indigo" | "primary" | "teal";
  desc: string;
}

const THREE_MOMENTS: MomentSpec[] = [
  { id: "before", label: "Before", tag: "Pre-initiator", icon: "Settings", hlrs: "HLR-A to D", color: "indigo", desc: "Latent errors during routine work that leave equipment unavailable until demanded." },
  { id: "at", label: "At", tag: "At-initiator", icon: "Bolt", hlrs: "HLR-E to G", color: "primary", desc: "An operator error that itself trips the plant or causes the challenge." },
  { id: "after", label: "After", tag: "Post-initiator", icon: "Shield", hlrs: "HLR-E to H", color: "teal", desc: "The response, where operators diagnose and act to mitigate the sequence." },
];

const HFE_TIMING: Record<string, { label: string; tone: string; icon: string }> = {
  PRE_INITIATOR: { label: "Pre-initiator", tone: "pre", icon: "Settings" },
  AT_INITIATOR: { label: "At-initiator", tone: "primary", icon: "Bolt" },
  POST_INITIATOR: { label: "Post-initiator", tone: "teal", icon: "Shield" },
};

const IMPACT_LEVELS: Record<string, string> = { FUNCTION: "Function", SYSTEM: "System", TRAIN: "Train", COMPONENT: "Component" };
const RESPONSE_TYPES: Record<string, string> = { INITIATE: "Initiate", OPERATE: "Operate", CONTROL: "Control", ISOLATE: "Isolate", TERMINATE: "Terminate", AGGRAVATING_ACTION: "Aggravating" };
const ACTIVITY_TYPES: Record<string, { label: string; icon: string }> = { REALIGNMENT: { label: "Realignment", icon: "Refresh" }, CALIBRATION: { label: "Calibration", icon: "Settings" } };
const ACTIVITY_SOURCES: Record<string, string> = { PROCEDURES: "Procedures", PLANT_PRACTICES: "Plant practices", INDUSTRY_EXPERIENCE: "Industry experience", DESIGN_ENGINEER_INTERVIEW: "Design engineer interview" };
const REVIEW_SCOPES: Record<string, string> = {
  EMERGENCY_AND_ABNORMAL_PROCEDURES: "Emergency and abnormal procedures",
  PLANNED_PROCEDURES_AND_OPERATIONAL_APPROACH: "Planned procedures and approach",
  OPERATIONAL_EVENTS: "Operational events",
  TRAINING_MATERIALS: "Training materials",
  SIMILAR_FACILITY_EXPERIENCE: "Similar facility experience",
  NONNUCLEAR_FACILITY_EXPERIENCE: "Nonnuclear facility experience",
};
const CONFIRM_METHODS: Record<string, { label: string; cc: string }> = {
  PERSONNEL_REVIEW: { label: "Personnel review", cc: "CC-I" },
  TALK_THROUGH: { label: "Talk-through", cc: "CC-II" },
  SIMULATION_OBSERVATION: { label: "Simulation observation", cc: "CC-II" },
};
const RECOVERY_CREDIT_LABELS: Record<string, string> = {
  POST_MAINTENANCE_TEST: "Post-maintenance test",
  INDEPENDENT_VERIFICATION: "Independent verification",
  WORK_SUPERVISION_CHECK: "Work supervision check",
  OPERATOR_ROUNDS: "Operator rounds",
};
const DEPENDENCE_LEVELS: Record<string, string> = { ZERO: "Zero", LOW: "Low", MODERATE: "Moderate", HIGH: "High", COMPLETE: "Complete" };
const PSF_IMPACT: Record<string, string> = { INCREASE: "Raises HEP", DECREASE: "Lowers HEP", NEUTRAL: "Neutral" };
const INDICATION_TREATMENT: Record<string, { label: string; cc: string }> = {
  ASSUMED_AVAILABLE: { label: "Assumed available", cc: "CC-I" },
  EVALUATED_PER_SEQUENCE: { label: "Evaluated per sequence", cc: "CC-II" },
};
const TIME_BASIS: Record<string, string> = {
  GENERIC_STUDY: "Generic study",
  REALISTIC_PLANT_SPECIFIC_ANALYSIS: "Realistic plant-specific",
  ESTIMATED: "Estimated",
  MEASURED_TALK_THROUGH: "Measured, talk-through",
  MEASURED_SIMULATOR: "Measured, simulator",
};
const FEASIBILITY_KEYS: { key: string; label: string }[] = [
  { key: "procedureOrGuidanceAvailable", label: "Procedure" },
  { key: "trainingIncluded", label: "Training" },
  { key: "cuesAvailable", label: "Cues" },
  { key: "manpowerAvailable", label: "Manpower" },
  { key: "timeAvailable", label: "Time" },
  { key: "accessibilityConfirmed", label: "Access" },
  { key: "equipmentAvailable", label: "Equipment" },
];

interface ErrorForcingContext {
  id: string;
  hfeId: string;
  unsafeAction: string;
  plantConditions: string[];
  psfs: string[];
  vulnerability: string;
}

const ERROR_FORCING_CONTEXTS: ErrorForcingContext[] = [
  { id: "EFC-1", hfeId: "HR-POST-005", unsafeAction: "Holds the decay-heat action believing the plant is already stable.", plantConditions: ["Misleading low core-outlet reading", "Slow temperature rise"], psfs: ["Ambiguous indication", "High early workload"], vulnerability: "A slow heat-up can be read as a stable state, so the crew holds the action." },
  { id: "EFC-2", hfeId: "HR-AG-001", unsafeAction: "Trips a running DRACS loop believing it is the faulted one.", plantConditions: ["Two loops alarming at once", "Look-alike loop indications"], psfs: ["Adjacent identical controls", "Time pressure"], vulnerability: "Identical adjacent controls invite a wrong-loop action under pressure." },
  { id: "EFC-3", hfeId: "HR-AT-003", unsafeAction: "De-energizes the wrong DC bus during maintenance.", plantConditions: ["Bus work in progress", "Partial labeling"], psfs: ["Procedure not place-kept", "Shift-handover gap"], vulnerability: "A labeling and handover gap can route the action to the live bus." },
];

interface HepMethodAttribution {
  method?: string;
  cognitionMethod?: string;
  executionMethod?: string;
}

const HEP_METHODS: Record<string, HepMethodAttribution> = {
  "HR-PRE-014": { method: "therp" },
  "HR-PRE-022": { method: "asep" },
  "HR-PRE-009": { method: "asep" },
  "HR-PRE-031": { method: "therp" },
  "HR-POST-005": { cognitionMethod: "cbdt", executionMethod: "therp" },
  "HR-POST-011": { cognitionMethod: "hcr-ore", executionMethod: "therp" },
  "HR-POST-022": { cognitionMethod: "spar-h", executionMethod: "spar-h" },
};

const REC_METHODS: Record<string, HepMethodAttribution> = {
  "REC-1": { cognitionMethod: "cbdt", executionMethod: "therp" },
  "REC-2": { executionMethod: "therp" },
  "REC-3": { executionMethod: "therp" },
};

const DEP_METHOD = "therp";
const REVIEW_METHODS: Record<string, string> = { "RR-4": "atheana" };

interface LinkSpec {
  id: string;
  element: string;
  icon: string;
  workbook?: string;
  version?: number;
  delivers?: string;
  uses?: string;
  note: string;
  role: string;
  dir?: "in" | "out";
}

const HR_UPSTREAM_LINKS: LinkSpec[] = [
  { id: "pos", element: "Plant Operating States", icon: "Layers", workbook: "POS Workbook Example", version: 3, delivers: "Configurations and cue timing per operating state", note: "A human failure event is defined per operating state.", role: "Per-state context" },
  { id: "es", element: "Event Sequence Analysis", icon: "Network", workbook: "ES Workbook Example", version: 2, delivers: "Procedure-grounded operator actions at the branch points", note: "ES names the action, HR quantifies it.", role: "What must be done" },
  { id: "sc", element: "Success Criteria Development", icon: "Target", workbook: "SC Workbook Example", version: 3, delivers: "Human action success criteria and time available", note: "Each criterion sets the time window for the action.", role: "How long there is" },
  { id: "sy", element: "Systems Analysis", icon: "Settings", workbook: "SY Workbook Example", version: 2, delivers: "Human failure event placeholders in the fault trees", note: "SY places the event, HR returns the probability.", role: "Where events sit" },
];

const HR_SIDEWAYS_LINKS: LinkSpec[] = [
  { id: "ie", element: "Initiating Events", icon: "Bolt", uses: "Supplies the operator-error contributions to support-system initiators", note: "IE-A5 item g is quantified here.", role: "Operator-caused in", dir: "in" },
  { id: "da", element: "Data Analysis", icon: "Gauge", uses: "Supplies the underlying parameters for any data-informed estimate", note: "Used where a method draws on plant or generic data.", role: "Parameters in", dir: "in" },
];

const HR_DOWNSTREAM_LINKS: LinkSpec[] = [
  { id: "esq", element: "Event Sequence Quantification", icon: "Network", uses: "Multiplies the human error probabilities through the sequences", note: "The quantified events drive the sequence results.", role: "HEPs out", dir: "out" },
];

const DEPENDENCE_THEME: { sr: string; t: string }[] = [
  { sr: "HR-A5", t: "Multi-train work practices flagged" },
  { sr: "HR-B3", t: "Multi-train activities not screened" },
  { sr: "HR-D7", t: "Pre-initiator joint probability" },
  { sr: "HR-G11", t: "Joint probability floor" },
  { sr: "HR-H5", t: "Recovery coupled to the cause" },
];

const HR_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose", "6"],
  ["    Scope", "6"],
  ["    Relationship to other documents", "6"],
  ["    Document layout", "6"],
  ["    Quality assurance", "6"],
  ["    Freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["Methodologies", "8"],
  ["Operator actions", "9"],
  ["    Pre-initiator human failure events", "9"],
  ["    At-initiator human failure events", "9"],
  ["    Post-initiator human failure events", "9"],
  ["Pre-initiator analysis", "10"],
  ["    Approach", "10"],
  ["    Quantification", "10"],
  ["At-initiator analysis", "11"],
  ["    Approach", "11"],
  ["    Quantification", "11"],
  ["Post-initiator analysis", "12"],
  ["    Approach", "12"],
  ["    Error forcing contexts", "12"],
  ["    Quantification", "12"],
  ["Dependency analysis", "13"],
  ["Uncertainty quantification", "14"],
  ["Sensitivity analyses", "15"],
  ["References", "16"],
];

export type {
  HrStep,
  StepStatus,
  HrPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  MethodSpec,
  MomentSpec,
  ErrorForcingContext,
  LinkSpec,
};

export {
  HR_STEPS,
  HR_PERSONAS,
  HR_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  HRA_METHODS,
  THREE_MOMENTS,
  HFE_TIMING,
  IMPACT_LEVELS,
  RESPONSE_TYPES,
  ACTIVITY_TYPES,
  ACTIVITY_SOURCES,
  REVIEW_SCOPES,
  CONFIRM_METHODS,
  RECOVERY_CREDIT_LABELS,
  DEPENDENCE_LEVELS,
  PSF_IMPACT,
  INDICATION_TREATMENT,
  TIME_BASIS,
  FEASIBILITY_KEYS,
  ERROR_FORCING_CONTEXTS,
  HEP_METHODS,
  REC_METHODS,
  DEP_METHOD,
  REVIEW_METHODS,
  HR_UPSTREAM_LINKS,
  HR_SIDEWAYS_LINKS,
  HR_DOWNSTREAM_LINKS,
  DEPENDENCE_THEME,
  HR_TOC,
};

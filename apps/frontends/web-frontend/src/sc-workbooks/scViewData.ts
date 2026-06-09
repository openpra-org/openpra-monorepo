import { SC_SR_CATALOG } from "interfaces-mef-types/sc/success-criteria-development";

type StepStatus = "complete" | "in-progress" | "idle";

interface ScStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  warn?: boolean;
  terminal?: boolean;
}

const SC_STEPS: ScStep[] = [
  { id: "scope", num: "01", label: "Scope & Sources", sub: "Inputs · consumers · barriers", status: "idle" },
  { id: "stable", num: "02", label: "Safe Stable State", sub: "Endpoint · end states", status: "idle" },
  { id: "criteria", num: "03", label: "Success Criteria", sub: "Function by event by state", status: "idle" },
  { id: "mission", num: "04", label: "Mission Times", sub: "24 hour rule · components", status: "idle" },
  { id: "bases", num: "05", label: "Engineering Bases", sub: "Analyses · codes · barriers", status: "idle" },
  { id: "passive", num: "06", label: "Passive Reliability", sub: "Mechanistic models", status: "idle" },
  { id: "consistency", num: "07", label: "Consistency", sub: "Plant fit · uncertainty", status: "idle" },
  { id: "draft", num: "08", label: "Draft", sub: "Produce SC report", status: "idle", terminal: true },
  { id: "review", num: "09", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "10", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type ScPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: ScPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const SC_PERSONAS: Record<ScPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = SC_STEPS.map((s) => s.id);
const SC_PERSONA_STEPS: Record<ScPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Generic", description: "Criteria from generic analyses that apply to the reactor type, with conservative barrier and mission-time treatment." },
  { id: "cc-ii", name: "CC-II", tag: "Design-specific", description: "Realistic, design-specific criteria for risk-significant sequences, with explicit margin and uncertainty assessment." },
];

type Tone = "ok" | "warn" | "block";

interface SafetyFunctionSpec {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

const SC_SAFETY_FUNCTIONS: Record<string, SafetyFunctionSpec> = {
  "SF-RC": { id: "SF-RC", name: "Reactivity control", icon: "Atom", desc: "Bring the reactor subcritical so power drops below the removable heat." },
  "SF-DHR": { id: "SF-DHR", name: "Decay-heat removal", icon: "Thermo", desc: "Remove decay heat so cladding and boundary stay below their limits." },
  "SF-INV": { id: "SF-INV", name: "Coolant inventory & boundary", icon: "Pipe", desc: "Keep sodium over the core and the coolant boundary intact." },
  "SF-CONF": { id: "SF-CONF", name: "Confinement integrity", icon: "Shield", desc: "Hold back radionuclides if inner barriers fail." },
};

interface BarrierSpec {
  id: string;
  name: string;
  short: string;
  icon: string;
  desc: string;
}

const SC_RAD_BARRIERS: Record<string, BarrierSpec> = {
  "BAR-CLAD": { id: "BAR-CLAD", name: "Fuel cladding", short: "Cladding", icon: "Shield", desc: "The first barrier holding fission products inside the fuel pin." },
  "BAR-PB": { id: "BAR-PB", name: "Primary coolant boundary", short: "Primary boundary", icon: "Pipe", desc: "The reactor vessel and primary loop holding the sodium." },
  "BAR-CONF": { id: "BAR-CONF", name: "Confinement", short: "Containment", icon: "Shield", desc: "The building barrier that sets the release category if inner barriers fail." },
  "BAR-CG": { id: "BAR-CG", name: "Cover-gas boundary", short: "Cover-gas boundary", icon: "Radiation", desc: "The boundary holding the activated argon source." },
};

interface InitiatorSpec {
  id: string;
  name: string;
  short: string;
  icon: string;
}

const SC_INITIATORS: Record<string, InitiatorSpec> = {
  "IEG-LOHS": { id: "IEG-LOHS", name: "Loss of heat sink", short: "LOHS", icon: "Thermo" },
  "IEG-LOFA": { id: "IEG-LOFA", name: "Loss of primary flow (ULOF)", short: "LOFA", icon: "Wind" },
  "IEG-RCB": { id: "IEG-RCB", name: "Primary sodium boundary leak", short: "RCB", icon: "Pipe" },
  "IEG-TRANS": { id: "IEG-TRANS", name: "General transient", short: "TRANS", icon: "Bolt" },
  "IE-15": { id: "IE-15", name: "Internal sodium fire", short: "FIRE", icon: "Beaker" },
  "IE-17": { id: "IE-17", name: "Seismic event", short: "SEIS", icon: "Network" },
};

const SC_POS_NAMES: Record<string, string> = {
  "POS-01": "Full power, normal alignment",
  "POS-02": "Load-follow (reduced power)",
  "POS-03": "Hot standby",
  "POS-04": "Cooled, head intact",
  "POS-05": "Head off, cavity dry",
  "POS-06": "Fuel-handling mode",
  "POS-07": "Post-trip cooldown (DRACS)",
  "POS-08": "IHX loop drained, primary hot",
  "POS-09": "Cover-gas adjustment",
};

interface AnalysisTypeSpec {
  label: string;
  icon: string;
}

const SC_ANALYSIS_TYPES: Record<string, AnalysisTypeSpec> = {
  THERMAL_HYDRAULIC: { label: "Thermal-fluid", icon: "Thermo" },
  STRUCTURAL: { label: "Structural", icon: "Ruler" },
  NEUTRONIC: { label: "Neutronic", icon: "Atom" },
  RADIATION_TRANSPORT: { label: "Source term", icon: "Radiation" },
  OTHER: { label: "Other", icon: "Settings" },
};

const SC_RC_TONES: Record<string, Tone> = {
  "RC-1": "block",
  "RC-2": "warn",
  "RC-3": "warn",
};

type ConformanceStatus = "ok" | "warn" | "blocked" | "na";
type Stage = "pre_operational" | "operational";

interface ConformanceItem {
  id: string;
  section: string;
  hlr: string;
  text: string;
  status: ConformanceStatus;
  requiredAt: string[];
  stages: string[];
}

const HLR_SECTION: Record<string, string> = {
  A: "Declare the criteria (HLR-SC-A)",
  B: "Justify with engineering (HLR-SC-B)",
  C: "Documentation (HLR-SC-C)",
};

const SC_SR_DESCRIPTIONS: Record<string, string> = {
  "SC-A1": "Safe stable state defined with a basis, as the endpoint of every non-release sequence",
  "SC-A2": "End states use the MS release-category definitions, with any plant-damage states specified",
  "SC-A3": "Plant parameters and thresholds that decide end states specified, with explicit margin at CC-II",
  "SC-A4": "Parameters and criteria protecting each radionuclide transport barrier specified",
  "SC-A5": "Success criteria for each key safety function, per initiating event, per operating state",
  "SC-A6": "Shared mitigating systems and their behavior under a common initiator identified",
  "SC-A7": "Mission time set, with a 24 hour minimum for sequences reaching a safe stable state",
  "SC-A8": "Component mission times support the sequence mission time, or the shorter time is justified",
  "SC-A9": "Criteria consistent with the plant features, procedures and operating philosophy",
  "SC-A10": "Model-uncertainty sources and assumptions in the criteria identified",
  "SC-A11": "Pre-operational design-gap assumptions in the criteria logged",
  "SC-B1": "Criteria from realistic design-specific analyses for risk-significant sequences at CC-II",
  "SC-B2": "Where information is lacking, the formal expert-judgment process of Section 4.2 is applied",
  "SC-B3": "Analyses match the level of detail of the IE grouping, POS definitions and ES modeling",
  "SC-B4": "Validated codes with an accepted V&V process and demonstrated applicability used",
  "SC-B5": "Passive functions use mechanistic models with characterized model and input uncertainty",
  "SC-B6": "Loads on each barrier and the parameters defining its capacity defined",
  "SC-B7": "Barrier evaluation method conservative at CC-I, realistic with uncertainty at CC-II",
  "SC-B8": "Engineering results checked to be reasonable and acceptable",
  "SC-B9": "Model-uncertainty sources in the engineering bases identified",
  "SC-B10": "Pre-operational assumptions in the engineering bases identified",
  "SC-C1": "SC process documented with end states, criteria, mission times, analyses and interfaces",
  "SC-C2": "Model-uncertainty sources documented, citing SC-A10 and SC-B9",
  "SC-C3": "Pre-operational limitations documented, citing SC-A11 and SC-B10",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(SC_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-SC-${meta.hlr}`,
      hlr: meta.hlr,
      text: `SC - ${code.slice("SC-".length)}: ${SC_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface SafeStableConditionSpec {
  id: string;
  label: string;
  icon: string;
  detail: string;
}

const SC_SAFE_STABLE_CONDITIONS: SafeStableConditionSpec[] = [
  { id: "ssc-1", label: "Subcritical", icon: "Atom", detail: "Below decay-heat level with shutdown margin." },
  { id: "ssc-2", label: "Heat path stable", icon: "Thermo", detail: "One heat-removal path established and self-sustaining." },
  { id: "ssc-3", label: "Temperatures bounded", icon: "Gauge", detail: "Peak cladding and sodium temperatures stable or falling." },
  { id: "ssc-4", label: "Boundary intact", icon: "Pipe", detail: "Boundary holds and sodium covers the core." },
];

interface UpstreamLinkSpec {
  id: string;
  element: string;
  icon: string;
  workbook: string;
  version: number;
  status: "approved" | "in_review";
  delivers: string;
  note: string;
}

const SC_UPSTREAM_LINKS: UpstreamLinkSpec[] = [
  { id: "pos", element: "Plant Operating States", icon: "Layers", workbook: "POS Workbook Example", version: 3, status: "approved", delivers: "9 operating states with decay-heat levels", note: "Each state sets its own decay-heat demand." },
  { id: "ie", element: "Initiating Event Analysis", icon: "Bolt", workbook: "IE Workbook Example", version: 3, status: "approved", delivers: "9 initiating-event groups plus single events", note: "Each group sets its own demand." },
  { id: "es", element: "Event Sequence Analysis", icon: "Network", workbook: "ES Workbook Example", version: 2, status: "in_review", delivers: "Key safety functions per ES-A3", note: "ES-A3 names a function, SC-A5 specifies it." },
];

interface DownstreamLinkSpec {
  id: string;
  element: string;
  icon: string;
  uses: string;
}

const SC_DOWNSTREAM_LINKS: DownstreamLinkSpec[] = [
  { id: "es", element: "Event Sequence Analysis", icon: "Network", uses: "Branch success at each event tree node" },
  { id: "sy", element: "Systems Analysis", icon: "Settings", uses: "What each system model must deliver" },
  { id: "hr", element: "Human Reliability", icon: "Person", uses: "What each operator action must accomplish" },
];

const SC_END_STATE_NAMES: Record<string, string> = {
  SSS: "Safe stable state",
  "RC-1": "Early release",
  "RC-2": "Late filtered release",
  "RC-3": "Intact-confinement leakage",
};

const SC_SYSTEM_DEPS: Record<string, string> = {
  "SYS-DRACS": "No AC power and no operator action required.",
  "SYS-RPS": "Class-1E DC power for the trip logic.",
  "SYS-PRIMARY": "Pump coastdown and open flow path.",
  "SYS-GUARD": "Shares the support skirt with the reactor vessel.",
  "SYS-CONF": "Isolation signal and cover-gas clean-up train.",
};

const SC_PASSIVE_SYSTEMS = ["SYS-DRACS", "SYS-PRIMARY", "SYS-GUARD"];
const SC_REALISTIC_ANALYSES = ["TF-CALC-06", "TF-CALC-09", "TF-CALC-12", "ST-CALC-21"];
const SC_WARN_CODES = ["CODE-NACOM"];

const SC_PASSIVE_WARN: Record<string, string> = {
  "PSV-NATCIRC": "Coastdown-curve uncertainty under review for the loss-of-flow group.",
};

const SC_PASSIVE_NOTES: Record<string, string> = {
  "PSV-DRACS": "Small driving forces, so uncertainty is quantified not assumed.",
  "PSV-FEEDBACK": "Credited only for unprotected transients where the trip rods fail.",
  "PSV-NATCIRC": "Establishment timing is the sensitive variable, not steady-state capacity.",
};

const SC_MISSION_IE: Record<string, string> = {
  "MT-LOHS": "IEG-LOHS",
  "MT-LOFA": "IEG-LOFA",
  "MT-RCB": "IEG-RCB",
  "MT-SEIS": "IE-17",
  "MT-FIRE": "IE-15",
};

const SC_MISSION_SEQ: Record<string, string> = {
  "MT-LOHS": "ESF-OK family, loss of heat sink",
  "MT-LOFA": "ESF-OK family, loss of flow",
  "MT-RCB": "ESR-04 inventory loss, confinement intact",
  "MT-SEIS": "Seismic sequences",
  "MT-FIRE": "Sodium-fire sequences",
};

const SC_CRITERION_SYSTEMS: Record<string, string[]> = {
  "SF-RC|IEG-LOHS": ["SYS-RPS", "SYS-FEEDBACK"],
  "SF-DHR|IEG-LOHS": ["SYS-DRACS"],
  "SF-DHR|IEG-LOFA": ["SYS-PRIMARY", "SYS-DRACS"],
  "SF-INV|IEG-RCB": ["SYS-GUARD", "SYS-ISOL"],
  "SF-RC|IEG-TRANS": ["SYS-RPS", "SYS-FEEDBACK"],
  "SF-CONF|IEG-LOHS": ["SYS-CONF"],
  "SF-DHR|IE-15": ["SYS-DRACS", "SYS-SUPP"],
  "SF-INV|IE-17": ["SYS-GUARD"],
};

export type {
  ScStep,
  StepStatus,
  ScPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  Tone,
  SafetyFunctionSpec,
  BarrierSpec,
  InitiatorSpec,
  AnalysisTypeSpec,
  SafeStableConditionSpec,
  UpstreamLinkSpec,
  DownstreamLinkSpec,
};

export {
  SC_STEPS,
  SC_PERSONAS,
  SC_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  SC_SAFETY_FUNCTIONS,
  SC_RAD_BARRIERS,
  SC_INITIATORS,
  SC_POS_NAMES,
  SC_ANALYSIS_TYPES,
  SC_RC_TONES,
  SC_SAFE_STABLE_CONDITIONS,
  SC_UPSTREAM_LINKS,
  SC_DOWNSTREAM_LINKS,
  SC_END_STATE_NAMES,
  SC_SYSTEM_DEPS,
  SC_PASSIVE_SYSTEMS,
  SC_REALISTIC_ANALYSES,
  SC_WARN_CODES,
  SC_PASSIVE_WARN,
  SC_PASSIVE_NOTES,
  SC_MISSION_IE,
  SC_MISSION_SEQ,
  SC_CRITERION_SYSTEMS,
};

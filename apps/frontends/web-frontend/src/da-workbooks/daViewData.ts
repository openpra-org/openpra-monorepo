import { DA_SR_CATALOG } from "interfaces-mef-types/da/data-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface DaStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  terminal?: boolean;
}

const DA_STEPS: DaStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Slots · pedigree · inputs", status: "idle" },
  { id: "define", num: "02", label: "Define Parameters", sub: "Boundaries · models (HLR-A)", status: "idle" },
  { id: "group", num: "03", label: "Group Populations", sub: "Homogeneous pools (HLR-B)", status: "idle" },
  { id: "generic", num: "04", label: "Collect: Generic", sub: "Generic per state (HLR-C)", status: "idle" },
  { id: "counts", num: "05", label: "Collect: Counts", sub: "Failures · demands · time", status: "idle" },
  { id: "unavail", num: "06", label: "Collect: Unavailability", sub: "Maintenance · repair · outage", status: "idle" },
  { id: "estimate", num: "07", label: "Estimate Values", sub: "Ladder · Bayes (HLR-D)", status: "idle" },
  { id: "ccf", num: "08", label: "Common-Cause", sub: "CCF parameters (D7 to D9)", status: "idle" },
  { id: "uncert", num: "09", label: "Uncertainty & Pre-op", sub: "Sources · assumptions", status: "idle" },
  { id: "draft", num: "10", label: "Draft", sub: "Produce DA report (HLR-E)", status: "idle", terminal: true },
  { id: "review", num: "11", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "12", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type DaPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: DaPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const DA_PERSONAS: Record<DaPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = DA_STEPS.map((s) => s.id);
const DA_PERSONA_STEPS: Record<DaPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Available", description: "Use the available plant or design-specific estimate, or a generic estimate, with the uncertainty characterized." },
  { id: "cc-ii", name: "CC-II", tag: "Realistic", description: "Calculate realistic mean estimates for risk-significant basic events from generic and all available plant evidence." },
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
  A: "Define parameters (HLR-A)",
  B: "Group populations (HLR-B)",
  C: "Collect data (HLR-C)",
  D: "Estimate values (HLR-D)",
  E: "Document (HLR-E)",
};

const DA_SR_DESCRIPTIONS: Record<string, string> = {
  "DA-A1": "Identify the basic events that need probabilities from the Systems Analysis",
  "DA-A2": "Match each component boundary, failure mode and success criterion to the Systems Analysis basic event",
  "DA-A3": "Select a probability model that fits how each event is demanded",
  "DA-A4": "Name each parameter and the data needed to estimate it",
  "DA-A5": "Identify the model-uncertainty sources and assumptions in the parameter definitions",
  "DA-A6": "Log the pre-operational assumptions in the parameter definitions",
  "DA-B1": "Group components by type, or by type and service conditions at CC-II",
  "DA-B2": "Exclude outlier components that are not representative of the group",
  "DA-C1": "Collect generic estimates from recognized sources per operating state, with boundaries verified",
  "DA-C2": "Include applicable experience from other facilities, including nonnuclear ones",
  "DA-C3": "Collect plant-specific failure data consistent with the parameter and grouping definitions",
  "DA-C4": "Justify the exclusion of any plant-specific data from the collection",
  "DA-C5": "Specify the basis for calling a component state a failure",
  "DA-C6": "Count repeated failures from one repetitive cause as a single failure",
  "DA-C7": "Enumerate the demand sources from surveillance, maintenance and operation",
  "DA-C8": "Count demands from annualized plans at CC-I or actual records at CC-II",
  "DA-C9": "Estimate demands from the planned surveillance and maintenance schedule",
  "DA-C10": "Collect standby hours from operational records",
  "DA-C11": "Collect run hours from tests and actual operation",
  "DA-C12": "Review the test procedure to confirm it exercises each failure mode",
  "DA-C13": "Count only the maintenance and test activities that disable the function",
  "DA-C14": "Use justified generic unavailability values where records do not exist",
  "DA-C15": "Assign the unavailability to the support system when it disables the front-line component",
  "DA-C16": "Collect the actual unavailable duration for each disabling activity",
  "DA-C17": "Log the pre-operational unavailability assumptions",
  "DA-C18": "Evaluate coincident maintenance unavailability on redundant equipment from plant experience",
  "DA-C19": "Log the pre-operational coincident-maintenance assumptions",
  "DA-C20": "Collect repair times from identification of the failure to restoration",
  "DA-C21": "Log the pre-operational repair-time assumptions",
  "DA-C22": "Collect recovery times for loss of offsite power and service water",
  "DA-C23": "Log the pre-operational recovery-time assumptions",
  "DA-C24": "Collect the outage timeline per operating state",
  "DA-C25": "Establish the applicability of a generic estimate to each operating state before reuse",
  "DA-C26": "Collect the number of outages per calendar year",
  "DA-D1": "Use the available specific estimate at CC-I or a realistic combined estimate for risk-significant events at CC-II",
  "DA-D2": "Use the most similar equipment, adjusted and justified, where nothing applicable exists",
  "DA-D3": "Provide a point estimate with uncertainty at CC-I or a mean for risk-significant events at CC-II",
  "DA-D4": "Confirm the Bayesian posterior is reasonable against the plant-specific evidence",
  "DA-D5": "Confirm the Bayesian posterior is reasonable against the technology-specific evidence",
  "DA-D6": "Reflect the operating-state and sequence influences in repair and recovery probabilities",
  "DA-D7": "Use a beta-factor or equivalent model for the common-cause parameters at CC-I",
  "DA-D8": "Use a multi-parameter model for risk-significant common-cause events, consistent with the component boundaries",
  "DA-D9": "Exclude an event from both the common-cause and independent databases, or from neither",
  "DA-D10": "Stop using past data as-is where plant modifications make it unrepresentative",
  "DA-E1": "Document the definitions, groupings, sources, counting bases, estimation methods and results",
  "DA-E2": "Document the model-uncertainty sources, citing the parameter-definition requirement",
  "DA-E3": "Document the pre-operational limitations, citing the pre-operational assumption requirements",
};

const DA_SR_META: Record<string, string> = {
  "DA-A1": "9 events",
  "DA-A2": "1 boundary open",
  "DA-B1": "3 groups",
  "DA-B2": "2 excluded",
  "DA-C2": "3 sources",
  "DA-C25": "Reuse open",
  "DA-D2": "1 adjustment open",
  "DA-D8": "1 alpha-factor",
};

const DA_SR_LINKED_NM: Record<string, string> = {
  "DA-D5": "NM-052",
  "DA-D8": "NM-058",
  "DA-D2": "NM-061",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(DA_SR_CATALOG).map((code) => {
    const meta = DA_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const preOnly = meta.stages.length === 1 && meta.stages[0] === "PRE_OPERATIONAL";
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-DA-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${DA_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: DA_SR_META[code] ?? (preOnly ? "Pre-op" : undefined),
      linkedNM: DA_SR_LINKED_NM[code],
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface ParamTypeSpec {
  label: string;
  unit: string;
  short: string;
  tone: string;
}

const PARAM_TYPES: Record<string, ParamTypeSpec> = {
  FREQUENCY: { label: "Frequency", unit: "per year", short: "Freq", tone: "generic" },
  PROBABILITY: { label: "Demand probability", unit: "per demand", short: "Prob", tone: "primary" },
  UNAVAILABILITY: { label: "Unavailability", unit: "fraction", short: "Unavail", tone: "similar" },
  OTHER: { label: "Failure rate", unit: "per hour", short: "Rate", tone: "plant" },
  CCF_PARAMETER: { label: "CCF parameter", unit: "factor", short: "CCF", tone: "red" },
  HUMAN_ERROR_PROBABILITY: { label: "Human error probability", unit: "per demand", short: "HEP", tone: "primary" },
};

interface ApproachSpec {
  label: string;
  rung: "plant" | "generic" | "similar";
}

const ESTIMATION_APPROACH: Record<string, ApproachSpec> = {
  PLANT_SPECIFIC: { label: "Plant-specific", rung: "plant" },
  TECHNOLOGY_SPECIFIC: { label: "Technology-specific", rung: "generic" },
  GENERIC: { label: "Generic", rung: "generic" },
  REALISTIC_COMBINED: { label: "Realistic combined", rung: "plant" },
  SIMILAR_EQUIPMENT_ADJUSTED: { label: "Similar-adjusted", rung: "similar" },
};

interface LadderRung {
  id: string;
  label: string;
  tag: string;
  icon: string;
  rung: string;
  color: "plant" | "generic" | "similar";
  desc: string;
}

const EVIDENCE_LADDER: LadderRung[] = [
  { id: "plant", label: "Plant-specific", tag: "Strongest pedigree", icon: "Database", rung: "C3 to C12 · D1 · D4", color: "plant", desc: "Counts of failures, demands and time from this plant in this operating state." },
  { id: "generic", label: "Generic", tag: "Technology evidence", icon: "Layers", rung: "C1 · C2 · D1", color: "generic", desc: "Recognized industry sources and technology experience from other facilities." },
  { id: "similar", label: "Similar-adjusted", tag: "Last resort", icon: "Scale", rung: "D2", color: "similar", desc: "The most similar equipment available, adjusted, with the adjustment justified." },
];

interface ProbabilityModelSpec {
  id: string;
  label: string;
  paramType: string;
  basis: "DEMAND" | "TIME";
  dist: string;
  note: string;
}

const PROBABILITY_MODELS: ProbabilityModelSpec[] = [
  { id: "PM-1", label: "Constant demand probability", paramType: "PROBABILITY", basis: "DEMAND", dist: "Beta", note: "A standby component that is asked to start, estimated per demand." },
  { id: "PM-2", label: "Standby failure rate", paramType: "OTHER", basis: "TIME", dist: "Gamma", note: "A running or standby component failing over time, estimated per hour." },
  { id: "PM-4", label: "Operating failure rate", paramType: "OTHER", basis: "TIME", dist: "Gamma", note: "A continuously operating component, estimated per hour." },
  { id: "PM-5", label: "Event frequency", paramType: "FREQUENCY", basis: "TIME", dist: "Gamma", note: "An initiating event counted over calendar time, estimated per year." },
];

interface MethodSpec {
  id: string;
  abbr: string;
  name: string;
  ref: string;
}

const DA_METHODS: Record<string, MethodSpec> = {
  mle: { id: "mle", abbr: "MLE", name: "Maximum likelihood estimation", ref: "NUREG/CR-6823" },
  bayes: { id: "bayes", abbr: "Bayes", name: "Bayesian parameter estimation", ref: "NUREG/CR-6823" },
  jeffreys: { id: "jeffreys", abbr: "Jeffreys", name: "Jeffreys noninformative prior", ref: "NUREG/CR-6823" },
  empbayes: { id: "empbayes", abbr: "Emp-Bayes", name: "Empirical Bayes population variability", ref: "NUREG/CR-6823" },
  beta: { id: "beta", abbr: "Beta", name: "Beta-factor common-cause model", ref: "NUREG/CR-5485" },
  alpha: { id: "alpha", abbr: "Alpha", name: "Alpha-factor common-cause model", ref: "NUREG/CR-5485" },
  mgl: { id: "mgl", abbr: "MGL", name: "Multiple Greek Letter common-cause model", ref: "NUREG/CR-5485" },
};

const GROUPING_BASIS: Record<string, { label: string; cc: string }> = {
  TYPE_ONLY: { label: "Type only", cc: "CC-I" },
  TYPE_AND_SERVICE_CONDITIONS: { label: "Type and service", cc: "CC-II" },
};

const SOURCE_TYPES: Record<string, string> = {
  INDUSTRY_DATABASE: "Generic industry",
  PLANT_RECORDS: "Plant records",
  EXPERT_JUDGMENT: "Expert judgment",
  OTHER_FACILITY_EXPERIENCE: "Other-facility experience",
  OTHER: "Other",
};

const CCF_MODEL_LABELS: Record<string, string> = {
  BETA_FACTOR: "Beta-factor",
  ALPHA_FACTOR: "Alpha-factor",
  MGL: "Multiple Greek Letter",
  PHI_FACTOR: "Phi-factor",
  OTHER_EQUIVALENT: "Equivalent model",
};

const CCF_MODEL_METHOD: Record<string, string> = {
  BETA_FACTOR: "beta",
  ALPHA_FACTOR: "alpha",
  MGL: "mgl",
  PHI_FACTOR: "beta",
  OTHER_EQUIVALENT: "beta",
};

const CCF_SOURCE_LABELS: Record<string, string> = {
  GENERIC: "Generic",
  PLANT_EXPERIENCE_CONSISTENT: "Plant-experience consistent",
};

const DEMAND_BASIS: Record<string, string> = {
  ANNUALIZED_PLANNED: "Annualized plan",
  ACTUAL_PRACTICE_RECORDS: "Actual records",
  PREOP_EXPECTED_PERFORMANCE: "Planned schedule",
};

const EXPOSURE_BASIS: Record<string, string> = {
  ESTIMATED_FROM_TEST_PRACTICES: "Estimated from plan",
  OPERATIONAL_RECORDS: "Operational records",
};

interface LinkSpec {
  id: string;
  element: string;
  short: string;
  icon: string;
  workbook?: string;
  version?: number;
  status?: string;
  synced?: string;
  delivers?: string;
  uses?: string;
  note: string;
  role: string;
}

const DA_UPSTREAM_LINKS: LinkSpec[] = [
  { id: "pos", element: "Plant Operating States", short: "POS", icon: "Layers", workbook: "POS Workbook Example", version: 3, status: "approved", synced: "Apr 18, 2026", delivers: "Operating states and the outage timelines behind the time fractions", note: "A parameter applies per operating state, not across all of them.", role: "Per-state context" },
  { id: "sy", element: "Systems Analysis", short: "SY", icon: "Settings", workbook: "SY Workbook Example", version: 2, status: "approved", synced: "May 6, 2026", delivers: "The list of basic events that need probabilities, with their boundaries", note: "SY hands DA the basic events and their boundaries to match.", role: "The shopping list" },
];

const DA_OUTPUT_LINKS: LinkSpec[] = [
  { id: "ie", element: "Initiating Events", short: "IE", icon: "Bolt", uses: "Receives the initiating-event frequencies and their data sources", note: "Sodium leak and pump-trip frequencies feed the IE quantification.", role: "Frequencies out" },
  { id: "sy", element: "Systems Analysis", short: "SY", icon: "Settings", uses: "Receives the basic-event probabilities and the CCF parameters", note: "The fault-tree basic events resolve to DA numbers.", role: "Probabilities out" },
  { id: "hr", element: "Human Reliability Analysis", short: "HR", icon: "Person", uses: "Shares the Bayesian estimation machinery for data-informed HEPs", note: "Used where a human reliability method draws on plant or generic data.", role: "Parameters out" },
  { id: "esq", element: "Event Sequence Quantification", short: "ESQ", icon: "Network", uses: "Multiplies every parameter through the sequences", note: "The quantified parameters drive the sequence results.", role: "Numbers out" },
];

const APPLICABILITY_THEME: { sr: string; t: string }[] = [
  { sr: "DA-A2", t: "Boundaries that match SY" },
  { sr: "DA-B1", t: "Populations that are honest" },
  { sr: "DA-C25", t: "Generic reuse checked per state" },
  { sr: "DA-D5", t: "Priors that respect the evidence" },
  { sr: "DA-D9", t: "Exclusions that are consistent" },
];

const PA_SR: Record<string, string> = {
  "PA-1": "DA-A6",
  "PA-2": "DA-C2",
  "PA-3": "DA-C9",
  "PA-4": "DA-C17",
  "PA-5": "DA-D5",
};

const SS_SR: Record<string, string> = {
  "SS-1": "DA-E2",
  "SS-2": "DA-D5",
};

const DA_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose, scope & relationship", "6"],
  ["    Quality assurance & freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["Methodologies", "8"],
  ["    Component failure models & parameters", "8"],
  ["    Common-cause failure models", "8"],
  ["    Testing & maintenance models", "8"],
  ["    Bayesian estimation", "8"],
  ["Component identification in systems", "9"],
  ["Basic event type codes", "10"],
  ["Data sources (generic · design · expert)", "11"],
  ["Data updating process", "12"],
  ["Testing & maintenance (with recovery)", "13"],
  ["Component failure data", "14"],
  ["Common-cause failure data", "15"],
];

export type {
  DaStep,
  StepStatus,
  DaPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  LadderRung,
  ProbabilityModelSpec,
  MethodSpec,
  LinkSpec,
};

export {
  DA_STEPS,
  DA_PERSONAS,
  DA_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  PARAM_TYPES,
  ESTIMATION_APPROACH,
  EVIDENCE_LADDER,
  PROBABILITY_MODELS,
  DA_METHODS,
  GROUPING_BASIS,
  SOURCE_TYPES,
  CCF_MODEL_LABELS,
  CCF_MODEL_METHOD,
  CCF_SOURCE_LABELS,
  DEMAND_BASIS,
  EXPOSURE_BASIS,
  DA_UPSTREAM_LINKS,
  DA_OUTPUT_LINKS,
  APPLICABILITY_THEME,
  PA_SR,
  SS_SR,
  DA_TOC,
};

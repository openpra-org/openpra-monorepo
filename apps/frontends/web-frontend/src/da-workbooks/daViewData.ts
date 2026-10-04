import { DA_SR_CATALOG, type DaBoundaryMatch, type DaEstimateQuantity, type DaEvidenceKind, type DaExpertRole, type DaJudgmentLevel, type DaLinkCode, type DaNeedElement, type DaNeedKind, type DaQuantificationModel, type DaScopeKind, type DaSourceOrigin, type DaSourceVerdict, type ParameterType } from "interfaces-mef-types/da/data-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface DaStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  hlr?: string;
  status: StepStatus;
  terminal?: boolean;
}

const DA_STEPS: DaStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Links · scope · data plan", hlr: "DA-A", status: "idle" },
  { id: "needs", num: "02", label: "Data needs", sub: "Events · initiators · HEPs", hlr: "DA-A", status: "idle" },
  { id: "define", num: "03", label: "Parameters", sub: "Models · map · populations", hlr: "DA-A", status: "idle" },
  { id: "generic", num: "04", label: "Sources", sub: "Library · applicability · judgment", hlr: "DA-C", status: "idle" },
  { id: "counts", num: "05", label: "Collect: Counts", sub: "Failures · demands · time", hlr: "DA-C", status: "idle" },
  { id: "unavail", num: "06", label: "Collect: Unavailability", sub: "Maintenance · repair · outage", hlr: "DA-C", status: "idle" },
  { id: "estimate", num: "07", label: "Estimate Values", sub: "Ladder · Bayes (HLR-D)", hlr: "DA-D", status: "idle" },
  { id: "ccf", num: "08", label: "Common-Cause", sub: "CCF parameters (D7 to D9)", hlr: "DA-D", status: "idle" },
  { id: "uncert", num: "09", label: "Uncertainty & Pre-op", sub: "Sources · assumptions", hlr: "DA-A", status: "idle" },
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
      meta: preOnly ? "Pre-op" : undefined,
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
  FREQUENCY: { label: "Frequency", unit: "per plant-year", short: "Freq", tone: "generic" },
  FAILURE_RATE: { label: "Failure rate", unit: "per hour", short: "Rate", tone: "plant" },
  PROBABILITY: { label: "Demand probability", unit: "per demand", short: "Prob", tone: "primary" },
  UNAVAILABILITY: { label: "Unavailability", unit: "fraction", short: "Unavail", tone: "similar" },
  OTHER: { label: "Other", unit: "", short: "Other", tone: "primary" },
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
  TYPE_AND_SERVICE_CONDITIONS: { label: "Type and service conditions", cc: "CC-II" },
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

interface DaLinkTile {
  code: DaLinkCode;
  label: string;
  name: string;
  handoff: string;
}

const DA_LINK_TILES: DaLinkTile[] = [
  { code: "SY", label: "SY", name: "Systems Analysis", handoff: "Provides · Basic events, common cause groups and typed values" },
  { code: "IE", label: "IE", name: "Initiating Events", handoff: "Provides · Initiator groups, module count and typed frequencies" },
  { code: "HRA", label: "HR", name: "Human Reliability", handoff: "Provides · Human failure events and typed HEPs" },
  { code: "POS", label: "POS", name: "Plant Operating States", handoff: "Provides · Operating states and their durations" },
  { code: "SC", label: "SC", name: "Success Criteria", handoff: "Provides · Mission times and failure definitions" },
  { code: "ESQ", label: "ESQ", name: "Event Sequence Quantification", handoff: "Provides · Importance of each parameter" },
];

const EXAMPLE_VARIANT_LABELS: Record<string, string> = {
  htgr: "Generic HTGR",
  sfr: "Generic SFR",
  hcl: "HCL case study",
};

function exampleLinkVariant(id: string): string | undefined {
  return id.startsWith("example-") ? id.split("-").slice(2).join("-") : undefined;
}

function exampleLinkLabel(id: string): string | undefined {
  const variant = exampleLinkVariant(id);
  if (variant === undefined) return undefined;
  return `${EXAMPLE_VARIANT_LABELS[variant] ?? variant} example`;
}

interface DaScopeKindSpec {
  kind: DaScopeKind;
  label: string;
  requirements: string;
  srs: string[];
}

const DA_REQUIRED_SCOPE = { label: "Component failure rates and probabilities", requirements: "DA-C3 to C12 · DA-D1 to D5" };

const DA_SCOPE_KINDS: DaScopeKindSpec[] = [
  { kind: "TEST_MAINTENANCE", label: "Test and maintenance unavailability", requirements: "DA-C13 to C19", srs: ["DA-C13", "DA-C14", "DA-C15", "DA-C16", "DA-C17", "DA-C18", "DA-C19"] },
  { kind: "REPAIR_RECOVERY", label: "Repair and recovery", requirements: "DA-C20 to C23 · DA-D6", srs: ["DA-C20", "DA-C21", "DA-C22", "DA-C23", "DA-D6"] },
  { kind: "COMMON_CAUSE", label: "Common cause failures", requirements: "DA-D7 to D9", srs: ["DA-D7", "DA-D8", "DA-D9"] },
  { kind: "INITIATING_EVENT", label: "Initiating event frequencies", requirements: "IE-C1 to C19", srs: [] },
  { kind: "HUMAN_ERROR", label: "Human error probabilities", requirements: "HR-D · HR-G", srs: [] },
  { kind: "OUTAGE", label: "Outage data", requirements: "DA-C24 · DA-C26", srs: ["DA-C24", "DA-C26"] },
];

const NEED_KIND_LABELS: Record<DaNeedKind, string> = {
  DEMAND: "Fails on demand",
  RUNNING: "Fails while running",
  STANDBY: "Fails in standby",
  UNAVAILABILITY: "Test or maintenance",
  HUMAN_ERROR: "Human error",
  RECOVERY: "Not recovered",
  COMMON_CAUSE: "Common cause",
  OTHER: "Other probability",
};

const NEED_KINDS: DaNeedKind[] = ["DEMAND", "RUNNING", "STANDBY", "UNAVAILABILITY", "HUMAN_ERROR", "RECOVERY", "COMMON_CAUSE", "OTHER"];

const NEED_ELEMENT_LABELS: Record<DaNeedElement, string> = {
  SY: "SY",
  IE: "IE",
  HRA: "HR",
  POS: "POS",
};

const NEED_ELEMENT_PROVIDES: Record<DaNeedElement, string> = {
  SY: "Basic events and common cause groups",
  IE: "Initiator groups and their frequencies",
  HRA: "Human failure events and their HEPs",
  POS: "Operating states and their durations",
};

const FAILURE_MODE_TEXT: Record<string, string> = {
  FAILURE_TO_START: "Fail to start",
  FAILURE_TO_RUN: "Fail to run",
  TEST_MAINTENANCE: "Test and maintenance",
  HUMAN_ERROR: "Human failure event",
  COMMON_CAUSE_FAILURE: "Common cause failure",
  EXTERNAL_EVENT: "External event",
  OTHER: "Other",
};

const FREQUENCY_BASIS_TEXT: Record<string, string> = {
  OPERATING_DATA: "Operating data",
  GENERIC_DATA: "Generic data",
  SIMILAR_PLANT_DATA: "Similar plant data",
  DESIGN_BASED: "Design based",
  FAULT_TREE: "Fault tree",
};

const HFE_TIMING_TEXT: Record<string, string> = {
  PRE_INITIATOR: "Pre-initiator",
  AT_INITIATOR: "At initiator",
  POST_INITIATOR: "Post-initiator",
};

const OPERATING_MODE_TEXT: Record<string, string> = {
  POWER: "Power",
  STARTUP: "Startup",
  SHUTDOWN: "Shutdown",
  REFUELING: "Refueling",
  MAINTENANCE: "Maintenance",
};

interface DaModelSpec {
  model: DaQuantificationModel;
  label: string;
  unit: string;
  parameterType: ParameterType;
}

const QUANTIFICATION_MODELS: DaModelSpec[] = [
  { model: "DEMAND_PROBABILITY", label: "Probability per demand", unit: "per demand", parameterType: "PROBABILITY" },
  { model: "RUNNING_RATE", label: "Rate while running", unit: "per hour", parameterType: "FAILURE_RATE" },
  { model: "MISSION_PROBABILITY", label: "Probability over the mission", unit: "per mission", parameterType: "PROBABILITY" },
  { model: "STANDBY_RATE", label: "Rate in standby", unit: "per hour", parameterType: "FAILURE_RATE" },
  { model: "UNAVAILABILITY", label: "Fraction of time out", unit: "fraction", parameterType: "UNAVAILABILITY" },
  { model: "HUMAN_ERROR", label: "Human error probability", unit: "per demand", parameterType: "HUMAN_ERROR_PROBABILITY" },
  { model: "NON_RECOVERY", label: "Probability of not recovering", unit: "probability", parameterType: "PROBABILITY" },
  { model: "FREQUENCY", label: "Frequency", unit: "per plant-year", parameterType: "FREQUENCY" },
  { model: "OTHER_PROBABILITY", label: "Probability", unit: "probability", parameterType: "PROBABILITY" },
];

const MODELS_FOR_KIND: Record<DaNeedKind, DaQuantificationModel[]> = {
  DEMAND: ["DEMAND_PROBABILITY"],
  RUNNING: ["RUNNING_RATE", "MISSION_PROBABILITY"],
  STANDBY: ["STANDBY_RATE"],
  UNAVAILABILITY: ["UNAVAILABILITY"],
  HUMAN_ERROR: ["HUMAN_ERROR"],
  RECOVERY: ["NON_RECOVERY"],
  COMMON_CAUSE: [],
  OTHER: ["OTHER_PROBABILITY"],
};

const FAILURE_MODE_CATEGORIES = ["Demand", "Operation", "Standby", "Passive"];

const EVIDENCE_KIND_LABELS: Record<DaEvidenceKind, string> = {
  PLANT_RECORDS: "1 · Plant records",
  TECHNOLOGY: "2 · Technology evidence",
  GENERIC_NUCLEAR: "3 · Generic nuclear data",
  ANALOGOUS_INDUSTRY: "4 · Analogous industries",
  ENGINEERING_MODEL: "5 · Engineering models",
  EXPERT_JUDGMENT: "6 · Expert judgment",
};

const SOURCE_ORIGIN_LABELS: Record<DaSourceOrigin, string> = {
  SAME_TECHNOLOGY: "Same technology",
  OTHER_NUCLEAR: "Other reactor or nuclear facility",
  NONNUCLEAR: "Nonnuclear industry",
};

const QUANTITY_LABELS: Record<DaEstimateQuantity, string> = {
  PER_DEMAND: "per demand",
  PER_HOUR: "per hour",
  PER_YEAR: "per year",
  FRACTION: "fraction",
  PROBABILITY: "probability",
  HOURS: "hours",
  FACTOR: "factor",
};

const EXPOSURE_LABELS: Record<DaEstimateQuantity, string> = {
  PER_DEMAND: "demands",
  PER_HOUR: "hours",
  PER_YEAR: "years",
  FRACTION: "hours",
  PROBABILITY: "trials",
  HOURS: "events",
  FACTOR: "values",
};

const VERDICT_LABELS: Record<DaSourceVerdict, string> = {
  APPLIES: "Applies",
  SCALED: "Applies with scaling",
  REJECTED: "Does not apply",
};

const BOUNDARY_MATCH_LABELS: Record<DaBoundaryMatch, string> = {
  SAME: "Same boundary",
  ADJUSTED: "Adjusted to match",
  DIFFERENT: "Different boundary",
};

const EXPERT_ROLE_LABELS: Record<DaExpertRole, string> = {
  EVALUATOR: "Evaluator",
  PROPONENT: "Proponent",
  RESOURCE: "Resource expert",
};

const JUDGMENT_LEVEL_LABELS: Record<DaJudgmentLevel, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

const DETECTABILITY_TEXT: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", NONE: "None" };

const OUTLIER_STATUS_TEXT: Record<string, string> = { CONFIRMED: "Confirmed", TENTATIVE: "Tentative", UNDER_REVIEW: "Under review" };

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
  MethodSpec,
  DaModelSpec,
  DaLinkTile,
  DaScopeKindSpec,
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
  DA_METHODS,
  GROUPING_BASIS,
  CCF_MODEL_LABELS,
  CCF_MODEL_METHOD,
  CCF_SOURCE_LABELS,
  DEMAND_BASIS,
  EXPOSURE_BASIS,
  DA_LINK_TILES,
  DA_REQUIRED_SCOPE,
  DA_SCOPE_KINDS,
  NEED_KIND_LABELS,
  NEED_KINDS,
  QUANTIFICATION_MODELS,
  MODELS_FOR_KIND,
  FAILURE_MODE_CATEGORIES,
  EVIDENCE_KIND_LABELS,
  SOURCE_ORIGIN_LABELS,
  QUANTITY_LABELS,
  EXPOSURE_LABELS,
  VERDICT_LABELS,
  BOUNDARY_MATCH_LABELS,
  EXPERT_ROLE_LABELS,
  JUDGMENT_LEVEL_LABELS,
  DETECTABILITY_TEXT,
  OUTLIER_STATUS_TEXT,
  NEED_ELEMENT_LABELS,
  NEED_ELEMENT_PROVIDES,
  FAILURE_MODE_TEXT,
  FREQUENCY_BASIS_TEXT,
  HFE_TIMING_TEXT,
  OPERATING_MODE_TEXT,
  exampleLinkVariant,
  exampleLinkLabel,
  PA_SR,
  SS_SR,
  DA_TOC,
};

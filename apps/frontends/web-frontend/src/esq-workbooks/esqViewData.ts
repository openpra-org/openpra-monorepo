import { ESQ_SR_CATALOG } from "interfaces-mef-types/esq/event-sequence-quantification";

type StepStatus = "complete" | "in-progress" | "idle";

interface EsqStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  terminal?: boolean;
}

const ESQ_STEPS: EsqStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Six elements converge", status: "idle" },
  { id: "integrate", num: "02", label: "Integrate & Quantify", sub: "Families · frequencies (A)", status: "idle" },
  { id: "solve", num: "03", label: "Solve & Converge", sub: "Codes · truncation (B)", status: "idle" },
  { id: "logic", num: "04", label: "Logic Integrity", sub: "Loops · flags · mutex (B)", status: "idle" },
  { id: "depend", num: "05", label: "Dependencies", sub: "HFE · phenomena (C)", status: "idle" },
  { id: "barriers", num: "06", label: "Barriers", sub: "Challenge · capacity (C)", status: "idle" },
  { id: "results", num: "07", label: "Review Results", sub: "Contributors · screening (D)", status: "idle" },
  { id: "uncert", num: "08", label: "Uncertainty & Pre-op", sub: "The funnel · SOKC (E)", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce ESQ report (F)", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type EsqPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: EsqPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const ESQ_PERSONAS: Record<EsqPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · overlaps with the IE and ES reviewers for consistency" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = ESQ_STEPS.map((s) => s.id);
const ESQ_PERSONA_STEPS: Record<EsqPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Point estimate", description: "Calculate a point estimate of each family frequency from point-estimate inputs." },
  { id: "cc-ii", name: "CC-II", tag: "Mean with SOKC", description: "Quantify the mean by propagating the risk-significant parameter distributions with the state-of-knowledge correlation accounted for." },
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
  A: "Integrate & quantify (HLR-A)",
  B: "Compute honestly (HLR-B)",
  C: "Preserve dependencies (HLR-C)",
  D: "Review results (HLR-D)",
  E: "Integrate uncertainty (HLR-E)",
  F: "Document (HLR-F)",
};

const ESQ_SR_DESCRIPTIONS: Record<string, string> = {
  "ESQ-A1": "Group event sequences into families with like end states and like dependencies",
  "ESQ-A2": "Integrate the sequences, system models, data and human reliability per source, group, hazard and state",
  "ESQ-A3": "Calculate the failure probability of each barrier failure mode contributing to a family",
  "ESQ-A4": "Quantify the frequency of each event sequence family",
  "ESQ-A5": "Calculate a point estimate at CC-I or the mean with the state-of-knowledge correlation at CC-II",
  "ESQ-A6": "Use a quantification method able to discriminate the risk-significant contributors",
  "ESQ-A7": "Apply recovery at the family and cutset level per the human reliability requirements",
  "ESQ-A8": "Select parameters at the same capability category as the human reliability and data requirements",
  "ESQ-A9": "Use conservative phenomena parameters at CC-I or realistic ones for risk-significant families at CC-II",
  "ESQ-B1": "Demonstrate the codes against accepted algorithms and identify the method-specific limitations",
  "ESQ-B2": "Set the truncation low enough that dependencies in risk-significant cutsets are not eliminated",
  "ESQ-B3": "Establish the truncation limit by an iterative convergence demonstration",
  "ESQ-B4": "Solve cutsets by the minimal cutset upper bound or an exact solution, and justify any rare-event approximation",
  "ESQ-B5": "Break circular logic without adding conservatism or non-conservatism",
  "ESQ-B6": "Include the success branches of modeled events, not only the failures",
  "ESQ-B7": "Identify cutsets that contain mutually exclusive events",
  "ESQ-B8": "Correct the mutually exclusive combinations by logic or by deletion",
  "ESQ-B9": "Set logic flag events to true or false rather than to a probability of one or zero",
  "ESQ-B10": "Keep shared events identifiable, modules independent and per-event results interpretable",
  "ESQ-C1": "Identify cutsets with multiple human failure events that could affect risk-significant results",
  "ESQ-C2": "Assess the joint dependency of the human failure events per the human reliability requirements",
  "ESQ-C3": "Carry the sequence characteristics into the downstream tree on each transfer",
  "ESQ-C4": "Assess phenomenological dependencies on credited equipment and justify any independence assumption",
  "ESQ-C5": "Estimate the barrier challenges at CC-I or calculate them with design-specific analyses at CC-II",
  "ESQ-C6": "Include the phenomena model logic, with scrubbing and beneficial failures at CC-II",
  "ESQ-C7": "Treat post-release human actions conservatively at CC-I or in detail for risk-significant actions at CC-II",
  "ESQ-C8": "Take no credit at CC-I for equipment or human action beyond the qualification limits",
  "ESQ-C9": "Credit survivability at CC-II only where engineering analysis and the related requirements support it",
  "ESQ-C10": "Include both gross and localized barrier failure modes",
  "ESQ-C11": "Include external-hazard-caused barrier failure mechanisms where in scope",
  "ESQ-C12": "Identify the failure modes, challenging phenomena and hazard mechanisms for each barrier",
  "ESQ-C13": "Identify the design-specific plausible degradation mechanisms, with any screening justified",
  "ESQ-C14": "Evaluate barrier capacity conservatively at CC-I or realistically with aging at CC-II",
  "ESQ-C15": "Estimate external-hazard capacity at CC-I or calculate fragility curves at CC-II",
  "ESQ-C16": "Identify the model-uncertainty sources and assumptions in the dependency treatment",
  "ESQ-C17": "Log the pre-operational assumptions in the dependency treatment",
  "ESQ-D1": "Sample risk-significant cutsets and verify the logic is correct",
  "ESQ-D2": "Review the results for consistency with the upstream models and operational reality",
  "ESQ-D3": "Confirm the flag, mutually exclusive and recovery rules produce logical results",
  "ESQ-D4": "Compare the results to similar plants, and explain the differences at CC-II",
  "ESQ-D5": "Sample non-risk-significant cutsets and confirm they are physically meaningful",
  "ESQ-D6": "Identify the risk-significant contributors using the risk-integration criteria",
  "ESQ-D7": "Review the importance results and reconcile anything unexpected",
  "ESQ-D8": "Assess that the cumulative effect of the screened-out initiating events stays negligible",
  "ESQ-E1": "Assess the model-uncertainty sources and assumptions identified by every technical element",
  "ESQ-E2": "Characterize the family-frequency uncertainty, propagating the risk-significant distributions with the correlation at CC-II",
  "ESQ-F1": "Document the quantification process, the inputs, the methods and the results",
  "ESQ-F2": "Document the risk-significant contributors",
  "ESQ-F3": "Document the model-uncertainty sources and the sensitivity results",
  "ESQ-F4": "Document the limitations that would affect applications",
  "ESQ-F5": "Document the pre-operational assumptions",
};

const ESQ_SR_META: Record<string, string> = {
  "ESQ-A1": "5 families",
  "ESQ-B1": "2 codes",
  "ESQ-B7": "2 rules",
  "ESQ-B9": "3 flags",
  "ESQ-C4": "1 assumption open",
  "ESQ-C10": "3 barriers",
  "ESQ-D6": "5 contributors",
  "ESQ-D7": "1 reconciled",
  "ESQ-E1": "8 sources",
};

const ESQ_SR_LINKED_NM: Record<string, string> = {
  "ESQ-E2": "NM-070",
  "ESQ-C14": "NM-074",
  "ESQ-C11": "NM-078",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(ESQ_SR_CATALOG).map((code) => {
    const meta = ESQ_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const preOnly = meta.stages.length === 1 && meta.stages[0] === "PRE_OPERATIONAL";
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-ESQ-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${ESQ_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: ESQ_SR_META[code] ?? (preOnly ? "Pre-op" : undefined),
      linkedNM: ESQ_SR_LINKED_NM[code],
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

const ESQ_METHODS: Record<string, MethodSpec> = {
  ftlink: { id: "ftlink", abbr: "FT-link", name: "Fault-tree linking", ref: "NUREG/CR-2300" },
  etbc: { id: "etbc", abbr: "ET-BC", name: "Event-tree boundary conditions", ref: "NUREG/CR-2300" },
  bdd: { id: "bdd", abbr: "BDD", name: "Binary decision diagram solution", ref: "NUREG/CR-2300" },
  mcub: { id: "mcub", abbr: "MCUB", name: "Minimal cutset upper bound", ref: "NUREG/CR-2300" },
  exact: { id: "exact", abbr: "Exact", name: "Exact Boolean solution", ref: "NUREG/CR-2300" },
  montecarlo: { id: "montecarlo", abbr: "Monte-Carlo", name: "Monte Carlo uncertainty propagation", ref: "NUREG/CR-6823" },
  fv: { id: "fv", abbr: "F-V", name: "Fussell-Vesely importance", ref: "NUREG/CR-3385" },
  raw: { id: "raw", abbr: "RAW", name: "Risk achievement worth", ref: "NUREG/CR-3385" },
};

interface LinkSpec {
  id: string;
  code: string;
  element: string;
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

const ESQ_UPSTREAM_LINKS: LinkSpec[] = [
  { id: "ie", code: "IE", element: "Initiating Events", icon: "Bolt", workbook: "IE Workbook Example", version: 3, status: "approved", synced: "Apr 30, 2026", delivers: "The initiating-event group frequencies and the screened-out set", note: "IE supplies the frequencies and the screened events ESQ later audits.", role: "Frequencies in" },
  { id: "es", code: "ES", element: "Event Sequence Analysis", icon: "Tree", workbook: "ES Workbook Example", version: 3, status: "approved", synced: "May 20, 2026", delivers: "The sequence topology and the end states", note: "ES hands ESQ the scenarios to quantify and the dependencies to preserve.", role: "Topology in" },
  { id: "sc", code: "SC", element: "Success Criteria", icon: "Target", workbook: "SC Workbook Example", version: 2, status: "approved", synced: "Apr 22, 2026", delivers: "The success criteria the branch logic is checked against", note: "SC sets the thresholds the quantified branches are tested against.", role: "Criteria in" },
  { id: "sy", code: "SY", element: "Systems Analysis", icon: "Settings", workbook: "SY Workbook Example", version: 2, status: "approved", synced: "May 6, 2026", delivers: "The Boolean system logic and the house events", note: "SY supplies the fault-tree logic substituted for each branch question.", role: "Logic in" },
  { id: "hr", code: "HR", element: "Human Reliability Analysis", icon: "Person", workbook: "HR Workbook Example", version: 2, status: "approved", synced: "May 14, 2026", delivers: "The human failure events and the joint-dependency rules", note: "HR supplies the human error probabilities and the joint-HEP floor machinery.", role: "HEPs in" },
  { id: "da", code: "DA", element: "Data Analysis", icon: "Database", workbook: "DA Workbook Example", version: 2, status: "in_review", synced: "May 8, 2026", delivers: "The basic-event and common-cause parameters with distributions", note: "DA binds the numeric values and the uncertainty distributions to the leaves.", role: "Parameters in" },
];

const ESQ_DOWNSTREAM_LINKS: LinkSpec[] = [
  { id: "ri", code: "RI", element: "Risk Integration", icon: "Gauge", uses: "Receives the family frequencies and the risk-significance criteria", note: "RI defines the risk-significance criteria ESQ applies and consumes its results.", role: "Risk numbers out" },
  { id: "ms", code: "MS", element: "Mechanistic Source Term", icon: "Atom", uses: "Receives the release-category resolution behind each family", note: "MS picks up the plant damage states and release categories ESQ resolves.", role: "Release inputs out" },
];

interface QuantBasisSpec {
  label: string;
  kind: "point" | "mean" | "mean-rs";
}

const QUANT_BASIS_LABELS: Record<string, QuantBasisSpec> = {
  POINT_ESTIMATE: { label: "Point estimate", kind: "point" },
  MEAN_PROPAGATED_SOKC: { label: "Mean · SOKC propagated", kind: "mean-rs" },
  MEAN_RISK_SIGNIFICANT_PARAMETERS: { label: "Mean · risk-significant parameters", kind: "mean" },
};

const CONTRIBUTOR_TYPE_LABELS: Record<string, string> = {
  CCF: "Common-cause",
  EQUIPMENT_FAILURE: "Equipment",
  HUMAN_FAILURE_EVENT: "Human action",
  INITIATING_EVENT: "Initiator",
  BARRIER_FAILURE_MODE: "Barrier",
  EVENT_PHENOMENON: "Phenomenon",
  PLANT_OPERATING_STATE: "Operating state",
  PLANT_DAMAGE_STATE: "Damage state",
  OTHER: "Other",
  EVENT_SEQUENCE_FAMILY: "Family",
  EVENT_SEQUENCE: "Sequence",
  HAZARD_GROUP: "Hazard group",
};

const MUTEX_TREATMENT_LABELS: Record<string, string> = {
  LOGIC_ELIMINATION: "Logic prevents it",
  CUTSET_DELETION: "Cutset deleted",
};

const CIRCULAR_METHOD_LABELS: Record<string, string> = {
  CONDITIONAL_SPLIT_FRACTIONS: "Conditional split fractions",
  TRANSFER_GATES: "Transfer gates",
  ITERATIVE_CONVERGENCE: "Iterative convergence",
  LOGIC_TRANSFORMATION: "Logic transformation",
};

const MODULE_TYPE_LABELS: Record<string, string> = {
  MODULE: "Module",
  SUBTREE: "Subtree",
  SPLIT_FRACTION: "Split fraction",
};

const CONTRIBUTOR_TYPE_ENTRIES: [string, string][] = [
  ["CCF", "Common-cause"],
  ["EQUIPMENT_FAILURE", "Equipment"],
  ["HUMAN_FAILURE_EVENT", "Human action"],
  ["INITIATING_EVENT", "Initiator"],
  ["PLANT_OPERATING_STATE", "Operating state"],
  ["EVENT_SEQUENCE_FAMILY", "Sequence family"],
  ["EVENT_SEQUENCE", "Sequence"],
  ["HAZARD_GROUP", "Hazard group"],
  ["PLANT_DAMAGE_STATE", "Damage state"],
];

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
  FUNCTIONAL: "Functional",
  PHYSICAL: "Physical",
  HUMAN: "Human",
  OPERATIONAL: "Operational",
  PHENOMENOLOGICAL: "Phenomenological",
  COMMON_CAUSE: "Common-cause",
};

const CHALLENGE_BASIS_LABELS: Record<string, string> = {
  CONSERVATIVE_GENERIC_ESTIMATE: "Conservative estimate",
  REALISTIC_PLANT_SPECIFIC_CALCULATION: "Realistic calculation",
};

const EXT_HAZARD_BASIS_LABELS: Record<string, string> = {
  ESTIMATED: "Capacity estimated",
  FRAGILITY_CURVES: "Fragility curves",
};



const SOLUTION_METHOD_LABELS: Record<string, string> = {
  MCUB: "Minimal cutset upper bound",
  EXACT: "Exact Boolean solution",
  RARE_EVENT: "Rare-event approximation",
};

const PROPAGATION_LABELS: Record<string, string> = {
  MONTE_CARLO: "Monte Carlo sampling",
  LATIN_HYPERCUBE: "Latin hypercube sampling",
  ANALYTICAL: "Analytical propagation",
  OTHER: "Other",
};

const APPROACH_LABELS: Record<string, string> = {
  FAULT_TREE_LINKING: "Fault-tree linking",
  EVENT_TREE_BOUNDARY_CONDITIONS: "Event trees with boundary conditions",
  BINARY_DECISION_DIAGRAM: "Binary decision diagram",
  MARKOV_MODEL: "Markov model",
  DISCRETE_EVENT_SIMULATION: "Discrete-event simulation",
  MONTE_CARLO_SIMULATION: "Monte Carlo simulation",
};

const TRUNCATION_METHOD_LABELS: Record<string, string> = {
  ABSOLUTE_FREQUENCY: "Absolute frequency",
  PERCENTAGE_OF_TOTAL: "Percentage of total",
  SIGNIFICANT_DIGITS: "Significant digits",
  RELATIVE_CONTRIBUTION: "Relative contribution",
};



const ESQ_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose, scope & relationship", "6"],
  ["    Quality assurance & freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["Methodologies", "8"],
  ["    Integration & quantification approach", "8"],
  ["    Truncation & convergence", "8"],
  ["    Solution & approximation", "8"],
  ["    Uncertainty propagation", "8"],
  ["Model integration & inputs", "9"],
  ["Event sequence family frequencies", "10"],
  ["Contribution breakdown", "11"],
  ["Truncation convergence records", "12"],
  ["Cutset review records", "13"],
  ["Flag, mutex & recovery treatment", "13"],
  ["Dependency treatment", "14"],
  ["Barrier challenge & capacity", "15"],
  ["Risk-significant contributors & importance", "16"],
  ["Screening audit", "17"],
  ["Model uncertainty & sensitivity", "18"],
  ["Limitations for applications", "19"],
];

export type {
  EsqStep,
  StepStatus,
  EsqPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  MethodSpec,
  LinkSpec,
};

export {
  ESQ_STEPS,
  ESQ_PERSONAS,
  ESQ_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  ESQ_METHODS,
  ESQ_UPSTREAM_LINKS,
  ESQ_DOWNSTREAM_LINKS,
  QUANT_BASIS_LABELS,
  CONTRIBUTOR_TYPE_LABELS,
  MUTEX_TREATMENT_LABELS,
  CIRCULAR_METHOD_LABELS,
  MODULE_TYPE_LABELS,
  DEPENDENCY_TYPE_LABELS,
  CONTRIBUTOR_TYPE_ENTRIES,
  CHALLENGE_BASIS_LABELS,
  EXT_HAZARD_BASIS_LABELS,
  APPROACH_LABELS,
  SOLUTION_METHOD_LABELS,
  PROPAGATION_LABELS,
  TRUNCATION_METHOD_LABELS,
  ESQ_TOC,
};

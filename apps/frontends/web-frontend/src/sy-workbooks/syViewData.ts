import { SY_SR_CATALOG } from "interfaces-mef-types/sy/systems-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface SyStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  terminal?: boolean;
}

const SY_STEPS: SyStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Systems · interfaces · setup", status: "idle" },
  { id: "models", num: "02", label: "System Models", sub: "Boundaries · logic models", status: "idle" },
  { id: "failures", num: "03", label: "Failure Modes", sub: "Modes · screening · events", status: "idle" },
  { id: "ccf", num: "04", label: "Common Cause", sub: "Groups · shared causes", status: "idle" },
  { id: "deps", num: "05", label: "Dependencies", sub: "Support · space · inventory", status: "idle" },
  { id: "integrity", num: "06", label: "Model Integrity", sub: "Fidelity · detail · naming", status: "idle" },
  { id: "uncert", num: "07", label: "Uncertainty", sub: "Capability · sources · pre-op", status: "idle" },
  { id: "draft", num: "08", label: "Draft", sub: "Produce SY report", status: "idle", terminal: true },
  { id: "review", num: "09", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "10", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type SyPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: SyPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const SY_PERSONAS: Record<SyPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = SY_STEPS.map((s) => s.id);
const SY_PERSONA_STEPS: Record<SyPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Screened", description: "Less detailed models where justified. CCF and support failures may be argued away as non-risk-significant." },
  { id: "cc-ii", name: "CC-II", tag: "Detailed", description: "Detailed models for risk-significant systems. CCF, support and software dependencies modeled with supporting data." },
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
  A: "Build each system model (HLR-SY-A)",
  B: "Model the couplings (HLR-SY-B)",
  C: "Document (HLR-SY-C)",
};

const SY_SR_DESCRIPTIONS: Record<string, string> = {
  "SY-A1": "Identify the systems that provide or support the safety functions from the Event Sequence Analysis",
  "SY-A2": "Collect the information needed to model the as-built and as-operated plant, or the as-designed plant",
  "SY-A3": "Review boundaries, dependencies, I&C and software, test and maintenance, limits, procedures and configurations",
  "SY-A4": "Work from available design information and justify any substitutes",
  "SY-A5": "Confirm the model matches the plant through staff discussions, and at CC-II through investigations and walkdowns",
  "SY-A6": "Confirm the model matches the design intent",
  "SY-A7": "Model the normal and the significant alternate alignments of each system",
  "SY-A8": "Set the model boundary to include the needed components and the support-system interfaces",
  "SY-A9": "Build detailed models unless system-level data suffices or failure is dominated by operator action or common cause",
  "SY-A10": "Set the level of detail to surface the risk-significant contributors against the as-built plant",
  "SY-A11": "Set the level of detail against the available design information",
  "SY-A12": "Define component boundaries to match the boundaries of the failure data",
  "SY-A13": "Flag the uncertainty when modeled boundaries cannot be verified against the generic data boundaries",
  "SY-A14": "Group components into a supercomponent only when recovery potential and shared use are the same",
  "SY-A15": "Reflect success criteria that vary by operating state or scenario in the model",
  "SY-A16": "Include the failures and failure modes that defeat the system success criteria",
  "SY-A17": "Leave out failures that help the system, unless omitting them distorts the result",
  "SY-A18": "Model flow-diversion paths as failures of the system",
  "SY-A19": "Keep the failure modes consistent with the data and the level of detail",
  "SY-A20": "Exclude components and failure modes only when they meet the stated screening criteria",
  "SY-A21": "Place pre-initiator human failure events in the system model, unless the sequence model carries them",
  "SY-A22": "Set the level of detail of the human failure events against the available design information",
  "SY-A23": "Place post-initiator human actions in the system model, unless the sequence model carries them",
  "SY-A24": "Model isolation and trip conditions in the system or sequence model, or show that exclusion is harmless",
  "SY-A25": "Model out-of-service unavailability per the actual plant maintenance practice",
  "SY-A26": "Use assumed unavailability where maintenance practice does not yet exist",
  "SY-A27": "Model the simultaneous planned unavailability of redundant equipment",
  "SY-A28": "Identify the conditions, such as heat, electrical load or humidity, that defeat the function",
  "SY-A29": "Represent exceeded capabilities conservatively, or realistically only when supported by analysis or data",
  "SY-A30": "Use consistent nomenclature so a component failure mode carries one designator across every system and train",
  "SY-A31": "Credit repair of hardware faults only when data or analysis supports it",
  "SY-A32": "Identify the model-uncertainty sources and assumptions in the system models",
  "SY-A33": "Log the pre-operational assumptions in the system models",
  "SY-B1": "Model common cause failure within a system, or justify its exclusion as non-risk-significant",
  "SY-B2": "Model common cause failure across systems using generic and plant or design-specific experience",
  "SY-B3": "Define the common cause failure groups by a systematic process with a stated basis",
  "SY-B4": "Keep the common cause failure treatment consistent with the model used by Data Analysis",
  "SY-B5": "Include support-system and interfacing dependencies in the model",
  "SY-B6": "Determine the support actually needed across the sequence conditions by engineering analysis",
  "SY-B7": "Use conservative support success criteria, or realistic ones for risk-significant contributors",
  "SY-B8": "Identify spatial, environmental and intrinsic hazards that affect multiple systems or trains",
  "SY-B9": "Confirm that interfaces support the full mission time",
  "SY-B10": "Determine support-system needs from design information and log the assumptions",
  "SY-B11": "Model the initiation and actuation systems, including software, at CC-II, or justify a less detailed model",
  "SY-B12": "Model the depletable inventories against the mission time",
  "SY-B13": "A recovery procedure is not grounds to leave a support system out of the model",
  "SY-B14": "Identify the SSCs that may operate beyond their environmental qualification and the dependent failures",
  "SY-B15": "Model the operator interface dependencies across systems, trains and reactors",
  "SY-B16": "Identify the model-uncertainty sources in the common cause and dependency modeling",
  "SY-B17": "Log the pre-operational assumptions in the dependency modeling",
  "SY-C1": "Document the systems analysis with inputs, methods, models, screening decisions, CCF groups and dependencies",
  "SY-C2": "Document the model-uncertainty sources, citing SY-A32 and SY-B16",
  "SY-C3": "Document the pre-operational limitations, including freedom from design and construction errors",
};

const SY_SR_META: Record<string, string> = {
  "SY-A1": "8 systems",
  "SY-A6": "3 records",
  "SY-A9": "1 system-level",
  "SY-A20": "4 screened",
  "SY-B2": "2 inter-system",
  "SY-B3": "Damper group open",
  "SY-B4": "DA-D8 pending",
  "SY-B5": "1 loop resolved",
  "SY-B8": "Penetration room open",
  "SY-B11": "Software model open",
  "SY-B12": "Battery duty open",
  "SY-B14": "Sodium-fire open",
  "SY-C3": "4 logged",
};

const SY_SR_LINKED_NM: Record<string, string> = {
  "SY-B11": "NM-072",
  "SY-B2": "NM-055",
  "SY-B3": "NM-055",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(SY_SR_CATALOG).map((code) => {
    const meta = SY_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-SY-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${SY_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: SY_SR_META[code],
      linkedNM: SY_SR_LINKED_NM[code],
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

const FAILURE_MODE_TYPES: Record<string, { label: string; short: string }> = {
  FAILURE_TO_START: { label: "Fail to start", short: "FS" },
  FAILURE_TO_RUN: { label: "Fail to run", short: "FR" },
  COMMON_CAUSE_FAILURE: { label: "Common cause", short: "CCF" },
  TEST_MAINTENANCE: { label: "Test & maintenance", short: "TM" },
  HUMAN_ERROR: { label: "Human error", short: "HE" },
  EXTERNAL_EVENT: { label: "External event", short: "EX" },
};

const CCF_MODELS: Record<string, { label: string }> = {
  BETA_FACTOR: { label: "Beta factor" },
  ALPHA_FACTOR: { label: "Alpha factor" },
  MGL: { label: "Multiple Greek letter" },
  PHI_FACTOR: { label: "Phi factor" },
};

interface CcfParameterSet {
  betaFactorParameters?: { beta: number; totalFailureProbability: number };
  alphaFactorParameters?: { alphaFactors: Record<string, number>; totalFailureProbability: number };
}

function toExp(n: number): string {
  return n.toExponential(1).toUpperCase();
}

function ccfParams(g: { modelSpecificParameters?: CcfParameterSet }): { short: string; detail: string; expected: number } | null {
  const p = g.modelSpecificParameters;
  if (p === undefined) return null;
  if (p.betaFactorParameters !== undefined) {
    const b = p.betaFactorParameters;
    return { short: "β " + String(b.beta), detail: "β " + String(b.beta) + " × Q " + toExp(b.totalFailureProbability), expected: b.beta * b.totalFailureProbability };
  }
  if (p.alphaFactorParameters !== undefined) {
    const a = p.alphaFactorParameters;
    const keys = Object.keys(a.alphaFactors).sort();
    const last = keys[keys.length - 1];
    if (last === undefined) return null;
    const val = a.alphaFactors[last];
    if (val === undefined) return null;
    const order = last.startsWith("alpha") ? last.slice(5) : last;
    return { short: "α" + order + " " + String(val), detail: "α" + order + " " + String(val) + " × Q " + toExp(a.totalFailureProbability), expected: val * a.totalFailureProbability };
  }
  return null;
}

function ccfModelCheck(
  g: { affectedSystems: string[]; members?: { basicEvents: { id: string }[] }; modelSpecificParameters?: CcfParameterSet },
  models: { systemReference: string; basicEvents: { uuid: string; probability?: number; failureMode?: string }[] }[],
): { expected: number | null; eventId: string | null; eventProb: number | null; ok: boolean } {
  const par = ccfParams(g);
  const lm = models.find((m) => m.systemReference === g.affectedSystems[0]);
  const evs = lm?.basicEvents ?? [];
  const ids = (g.members?.basicEvents ?? []).map((b) => b.id);
  const ccfEvent = evs.find((e) => ids.includes(e.uuid) && e.failureMode === "COMMON_CAUSE_FAILURE");
  const membersOk = ids.length > 0 && ids.every((id) => evs.some((e) => e.uuid === id));
  const prob = ccfEvent?.probability;
  const match = par !== null && prob !== undefined && Math.abs(par.expected - prob) <= Math.max(par.expected, prob) * 1e-6;
  return { expected: par === null ? null : par.expected, eventId: ccfEvent === undefined ? null : ccfEvent.uuid, eventProb: prob === undefined ? null : prob, ok: membersOk && match };
}

const SHARED_CAUSE_LABELS: Record<string, string> = {
  hardwareDesign: "Same design",
  manufacturer: "Same make",
  maintenance: "Same crew",
  installation: "Same install",
  environment: "Same room",
  otherFactors: "Other",
};

const DEP_KIND: Record<string, { label: string; cls: string }> = {
  power: { label: "Power", cls: "syd-dep--power" },
  signal: { label: "Signal", cls: "syd-dep--signal" },
  cooling: { label: "Cooling", cls: "syd-dep--cooling" },
};

const FAILURE_MODE_LABELS: Record<string, string> = {
  FAILURE_TO_RUN: "Fail to run",
  FAILURE_TO_START: "Fail to start",
  COMMON_CAUSE_FAILURE: "Common cause failure",
  HUMAN_ERROR: "Human failure event",
  TEST_MAINTENANCE: "Test and maintenance",
};

const CONFIRM_METHODS: Record<string, string> = {
  DISCUSSIONS: "Discussions",
  PLANT_INVESTIGATION: "Plant investigation",
  WALKDOWN: "Walkdown",
  DESIGN_REVIEW: "Design review",
};

interface UpstreamLinkSpec {
  id: string;
  element: string;
  icon: string;
  workbook: string;
  version: number;
  status: "approved" | "in_review";
  delivers: string;
  note: string;
  role: string;
}

const SY_UPSTREAM_LINKS: UpstreamLinkSpec[] = [
  { id: "pos", element: "Plant Operating States", icon: "Layers", workbook: "POS Workbook Example", version: 3, status: "approved", delivers: "Configurations and alignments per state", note: "Alignments and unavailability vary by state.", role: "Alignment context" },
  { id: "es", element: "Event Sequence Analysis", icon: "Network", workbook: "ES Workbook Example", version: 2, status: "approved", delivers: "Safety functions and the systems that provide them", note: "ES-A3 names a function, SY-A1 picks up its systems.", role: "What to model" },
  { id: "sc", element: "Success Criteria Development", icon: "Target", workbook: "SC Workbook Example", version: 3, status: "approved", delivers: "System success criteria and mission times", note: "Each criterion sets a fault tree top event.", role: "Top-event definition" },
];

interface SideLinkSpec {
  id: string;
  element: string;
  icon: string;
  uses: string;
  role: string;
  dir: "in" | "out";
}

const SY_SIDEWAYS_LINKS: SideLinkSpec[] = [
  { id: "da", element: "Data Analysis", icon: "Gauge", uses: "Supplies failure parameters, component boundaries and CCF parameters", role: "Parameters in", dir: "in" },
  { id: "hr", element: "Human Reliability", icon: "Person", uses: "Receives the human failure events placed in the system models", role: "Human events out", dir: "out" },
];

const SY_DOWNSTREAM_LINKS: SideLinkSpec[] = [
  { id: "esq", element: "Event Sequence Quantification", icon: "Network", uses: "Links the system models into the event trees and quantifies the sequences", role: "Branch probability", dir: "out" },
];

type SyGateType = "OR" | "AND" | "KN";

interface SyGateNode {
  id: string;
  type: SyGateType;
  name: string;
  k?: number;
  children: SyTreeNode[];
}

interface SyBeNode {
  id: string;
  type: "BE";
  name: string;
  be: string;
  mode: string;
  source: string;
  prob: string;
  ccf?: boolean;
}

interface SyTrNode {
  id: string;
  type: "TR";
  name: string;
  transfer: string;
}

type SyTreeNode = SyGateNode | SyBeNode | SyTrNode;

const SCREENING_CRITERIA: { code: string; label: string }[] = [
  { code: "a", label: "Total failure probability below 1E-6 over the mission time" },
  { code: "b", label: "Failure mode cannot defeat the system success criterion" },
];

const SY_METHODOLOGY_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose", "6"],
  ["    Scope", "6"],
  ["    Relationship to other documents", "6"],
  ["    Document layout", "6"],
  ["    Quality assurance", "6"],
  ["    Freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["System breakdown structure & systems analysis", "8"],
  ["    System scoping", "8"],
  ["    System screening", "8"],
  ["    Selected systems for detailed analysis", "8"],
  ["    Grouping retained systems", "8"],
  ["Methodologies & guidelines", "9"],
  ["    Constructing fault trees", "9"],
  ["    Dependencies", "9"],
  ["    Boundaries", "9"],
  ["    Labeling scheme (hazard, IE, basic event, gate)", "9"],
  ["Data sources", "10"],
  ["References", "11"],
];

const SY_SYSTEM_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose", "6"],
  ["    Scope", "6"],
  ["    Relationship to other documents", "6"],
  ["    Document layout", "6"],
  ["    Quality assurance", "6"],
  ["    Freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["System description", "8"],
  ["    System function & operation", "8"],
  ["    Plant operating states", "8"],
  ["    System information (class, defense-in-depth, procedures)", "8"],
  ["    System boundary", "8"],
  ["    Dependency & shared components", "8"],
  ["    Success criteria", "8"],
  ["    Instrumentation & control", "8"],
  ["    Operator actions", "8"],
  ["    Spatial information", "8"],
  ["    Test & maintenance", "8"],
  ["    Technical specifications", "9"],
  ["    Equipment operability & assumptions", "9"],
  ["    System failure contribution to IEs", "9"],
  ["    Operating history", "9"],
  ["Model development", "10"],
  ["    Fault tree top gates", "10"],
  ["    Modeling approach", "10"],
  ["    Considerations & assumptions", "10"],
  ["    Common cause failures", "10"],
  ["    Support system & control interfaces", "10"],
  ["    Basic event data", "10"],
  ["    Human reliability data", "10"],
  ["    Model uncertainty", "10"],
  ["Results", "11"],
  ["    Uncertainty quantification", "11"],
  ["    Minimal cut sets", "11"],
  ["    Importance measures", "11"],
  ["Sensitivity analyses", "12"],
  ["References", "13"],
];

export type {
  SyStep,
  StepStatus,
  SyPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  UpstreamLinkSpec,
  SideLinkSpec,
  SyTreeNode,
  SyGateNode,
  SyBeNode,
  SyTrNode,
};

export {
  SY_STEPS,
  SY_PERSONAS,
  SY_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  FAILURE_MODE_TYPES,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  toExp,
  ccfParams,
  ccfModelCheck,
  DEP_KIND,
  CONFIRM_METHODS,
  FAILURE_MODE_LABELS,
  SY_UPSTREAM_LINKS,
  SY_SIDEWAYS_LINKS,
  SY_DOWNSTREAM_LINKS,
  SCREENING_CRITERIA,
  SY_METHODOLOGY_TOC,
  SY_SYSTEM_TOC,
};

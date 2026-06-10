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
  { id: "scope", num: "01", label: "Scope & Sources", sub: "Systems · interfaces · setup", status: "idle" },
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

interface SystemMeta {
  short: string;
  icon: string;
  kind: "frontline" | "support";
  sf: string;
  criterion: string;
  alignments: number;
  components: number;
  basicEvents: number;
  supportNeeds: string[];
  status: "ok" | "warn";
  statusNote?: string;
  detailed: boolean;
  detailNote?: string;
}

const SY_SYSTEM_META: Record<string, SystemMeta> = {
  "SYS-RPS": { short: "RPS", icon: "Atom", kind: "frontline", sf: "SF-RC", criterion: "One of two divisions inserts the rods within 3 s of the trip demand.", alignments: 2, components: 18, basicEvents: 22, supportNeeds: ["SYS-DC", "SYS-ACT"], status: "ok", detailed: true },
  "SYS-DRACS": { short: "DRACS", icon: "Thermo", kind: "frontline", sf: "SF-DHR", criterion: "One of three loops removes decay heat by natural circulation.", alignments: 2, components: 27, basicEvents: 31, supportNeeds: ["SYS-DC"], status: "warn", statusNote: "Damper actuation CCF group open against DA-D8.", detailed: true },
  "SYS-PCS": { short: "PCS", icon: "Wind", kind: "frontline", sf: "SF-DHR", criterion: "Both loops stay open so buoyancy-driven flow establishes in time.", alignments: 1, components: 12, basicEvents: 14, supportNeeds: [], status: "ok", detailed: true },
  "SYS-CIS": { short: "CIS", icon: "Shield", kind: "frontline", sf: "SF-CONF", criterion: "Isolation closes on demand and the clean-up train holds the leak rate.", alignments: 2, components: 20, basicEvents: 25, supportNeeds: ["SYS-DC", "SYS-ACT", "SYS-HVAC"], status: "ok", detailed: true },
  "SYS-GV": { short: "GV", icon: "Pipe", kind: "frontline", sf: "SF-INV", criterion: "The guard vessel bounds a primary leak and keeps the core covered.", alignments: 1, components: 3, basicEvents: 4, supportNeeds: [], status: "ok", detailed: false, detailNote: "System-level data sufficient, no internal redundancy." },
  "SYS-DC": { short: "DC", icon: "Battery", kind: "support", sf: "SF-RC", criterion: "Battery and distribution supply the DC loads for the mission time.", alignments: 1, components: 15, basicEvents: 19, supportNeeds: ["SYS-HVAC"], status: "warn", statusNote: "Battery depletion against 24 h mission under review.", detailed: true },
  "SYS-ACT": { short: "ACT", icon: "Cpu", kind: "support", sf: "SF-RC", criterion: "Digital logic generates the protective signal on demand.", alignments: 1, components: 10, basicEvents: 16, supportNeeds: ["SYS-DC"], status: "warn", statusNote: "Software failure modeling expected at CC-II (SY-B11).", detailed: true },
  "SYS-HVAC": { short: "HVAC", icon: "Wind", kind: "support", sf: "SF-RC", criterion: "Room cooling keeps the I&C below its qualified temperature.", alignments: 1, components: 8, basicEvents: 10, supportNeeds: ["SYS-DC"], status: "ok", detailed: true },
};

interface SafetyFunctionSpec {
  id: string;
  name: string;
  icon: string;
}

const SY_SAFETY_FUNCTIONS: Record<string, SafetyFunctionSpec> = {
  "SF-RC": { id: "SF-RC", name: "Reactivity control", icon: "Atom" },
  "SF-DHR": { id: "SF-DHR", name: "Decay-heat removal", icon: "Thermo" },
  "SF-INV": { id: "SF-INV", name: "Coolant inventory & boundary", icon: "Pipe" },
  "SF-CONF": { id: "SF-CONF", name: "Confinement integrity", icon: "Shield" },
};

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

interface SyLogicModel {
  representation: string;
  note: string;
  root: SyTreeNode;
}

const SY_LOGIC_MODELS: Record<string, SyLogicModel> = {
  "SYS-DRACS": {
    representation: "Fault tree, 1 of 3 success logic",
    note: "Success is one of three loops, so the model fails only when all three are lost.",
    root: {
      id: "DRC-TOP", type: "OR", name: "DRACS fails to remove decay heat",
      children: [
        { id: "DRC-3FAIL", type: "AND", name: "All three loops fail independently", children: [
          { id: "be-DRC-LP1-FR", type: "BE", name: "Loop 1 fails to maintain natural circulation", be: "DRC-LP1-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
          { id: "be-DRC-LP2-FR", type: "BE", name: "Loop 2 fails to maintain natural circulation", be: "DRC-LP2-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
          { id: "be-DRC-LP3-FR", type: "BE", name: "Loop 3 fails to maintain natural circulation", be: "DRC-LP3-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-031", prob: "8.0E-3" },
        ] },
        { id: "be-DRC-CCF-FR", type: "BE", name: "Common cause failure of all three loops", be: "DRC-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DRACS-LOOP", prob: "1.2E-4", ccf: true },
        { id: "DRC-ACT", type: "OR", name: "Air-side actuation fails on all loops", children: [
          { id: "be-DRC-DMP-CCF", type: "BE", name: "Common cause failure of the air dampers", be: "DRC-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DRACS-DMP", prob: "5.0E-4", ccf: true },
          { id: "tr-DRC-DC", type: "TR", name: "Loss of Class-1E DC to the dampers", transfer: "SYS-DC" },
        ] },
      ],
    },
  },
  "SYS-RPS": {
    representation: "Fault tree, 1 of 2 success logic",
    note: "Success is one of two divisions, so the model fails when both divisions are lost.",
    root: {
      id: "RPS-TOP", type: "OR", name: "RPS fails to insert on demand",
      children: [
        { id: "RPS-2FAIL", type: "AND", name: "Both divisions fail independently", children: [
          { id: "be-RPS-DVA-FS", type: "BE", name: "Division A fails to trip", be: "RPS-DVA-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "1.5E-3" },
          { id: "be-RPS-DVB-FS", type: "BE", name: "Division B fails to trip", be: "RPS-DVB-FS", mode: "FAILURE_TO_START", source: "DA-BE-007", prob: "1.5E-3" },
        ] },
        { id: "be-RPS-CCF-FS", type: "BE", name: "Common cause failure of both divisions", be: "RPS-CCF-FS", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-DIV", prob: "9.0E-5", ccf: true },
        { id: "be-RPS-ROD-CCF", type: "BE", name: "Common cause failure of the rod release", be: "RPS-ROD-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-RPS-ROD", prob: "3.0E-5", ccf: true },
        { id: "tr-RPS-ACT", type: "TR", name: "Actuation logic fails to generate the trip", transfer: "SYS-ACT" },
      ],
    },
  },
  "SYS-ACT": {
    representation: "Fault tree, 2 of 4 voting logic",
    note: "Two of four channels generate the signal, so the model fails when three of four channels fail.",
    root: {
      id: "ACT-TOP", type: "OR", name: "Actuation logic fails to generate the signal",
      children: [
        { id: "ACT-VOTE", type: "KN", k: 3, name: "Three of four voting channels fail", children: [
          { id: "be-ACT-CH1-FS", type: "BE", name: "Voting channel 1 fails", be: "ACT-CH1-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
          { id: "be-ACT-CH2-FS", type: "BE", name: "Voting channel 2 fails", be: "ACT-CH2-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
          { id: "be-ACT-CH3-FS", type: "BE", name: "Voting channel 3 fails", be: "ACT-CH3-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
          { id: "be-ACT-CH4-FS", type: "BE", name: "Voting channel 4 fails", be: "ACT-CH4-FS", mode: "FAILURE_TO_START", source: "DA-BE-081", prob: "2.0E-3" },
        ] },
        { id: "be-ACT-SW-CCF", type: "BE", name: "Common cause failure of the logic software", be: "ACT-SW-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-ACT-SW", prob: "1.0E-4", ccf: true },
        { id: "tr-ACT-DC", type: "TR", name: "Loss of Class-1E DC power", transfer: "SYS-DC" },
      ],
    },
  },
  "SYS-DC": {
    representation: "Fault tree, 1 of 2 success logic",
    note: "One battery and bus carry the loads, so the model fails when both trains are lost.",
    root: {
      id: "DC-TOP", type: "OR", name: "Class-1E DC power fails to supply the loads",
      children: [
        { id: "DC-AND", type: "AND", name: "Both battery trains fail independently", children: [
          { id: "be-DC-BAT-A-FR", type: "BE", name: "Battery train A fails to run", be: "DC-BAT-A-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "6.0E-3" },
          { id: "be-DC-BAT-B-FR", type: "BE", name: "Battery train B fails to run", be: "DC-BAT-B-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-071", prob: "6.0E-3" },
        ] },
        { id: "be-DC-BAT-CCF", type: "BE", name: "Common cause failure of the station batteries", be: "DC-BAT-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-DC-BATT", prob: "2.5E-4", ccf: true },
        { id: "tr-DC-HVAC", type: "TR", name: "Loss of room cooling to the battery room", transfer: "SYS-HVAC" },
      ],
    },
  },
  "SYS-CIS": {
    representation: "Fault tree, isolation and clean-up",
    note: "Either an isolation failure or a clean-up failure defeats the confinement function.",
    root: {
      id: "CIS-TOP", type: "OR", name: "Confinement fails to isolate or clean up",
      children: [
        { id: "CIS-ISO", type: "OR", name: "Isolation function fails", children: [
          { id: "be-CIS-DMP-CCF", type: "BE", name: "Common cause failure of the isolation dampers", be: "CIS-DMP-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-CIS-DMP", prob: "4.0E-4", ccf: true },
          { id: "tr-CIS-ACT", type: "TR", name: "Isolation signal fails to generate", transfer: "SYS-ACT" },
        ] },
        { id: "CIS-CLN", type: "OR", name: "Clean-up train fails", children: [
          { id: "be-CIS-FAN-FR", type: "BE", name: "Clean-up fan fails to run", be: "CIS-FAN-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-062", prob: "7.0E-3" },
          { id: "be-CIS-IV-FO", type: "BE", name: "Inlet valve fails to open", be: "CIS-IV-FO", mode: "FAILURE_TO_START", source: "DA-BE-063", prob: "1.2E-3" },
        ] },
        { id: "tr-CIS-DC", type: "TR", name: "Loss of Class-1E DC power", transfer: "SYS-DC" },
      ],
    },
  },
  "SYS-HVAC": {
    representation: "Fault tree, 1 of 2 success logic",
    note: "One cooling train holds the I&C below its limit, so the model fails when both are lost.",
    root: {
      id: "HVC-TOP", type: "OR", name: "Room cooling fails and I&C exceeds its limit",
      children: [
        { id: "HVC-AND", type: "AND", name: "Both cooling trains fail independently", children: [
          { id: "be-HVC-CHA-FR", type: "BE", name: "Cooling train A fails to run", be: "HVC-CHA-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.0E-3" },
          { id: "be-HVC-CHB-FR", type: "BE", name: "Cooling train B fails to run", be: "HVC-CHB-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-051", prob: "9.0E-3" },
        ] },
        { id: "be-HVC-CCF-FR", type: "BE", name: "Common cause failure of both trains", be: "HVC-CCF-FR", mode: "COMMON_CAUSE_FAILURE", source: "CCF-HVAC-CHL", prob: "3.0E-4", ccf: true },
        { id: "tr-HVC-DC", type: "TR", name: "Loss of Class-1E DC to the chillers", transfer: "SYS-DC" },
      ],
    },
  },
  "SYS-PCS": {
    representation: "Fault tree, both loops needed",
    note: "Both loop paths must stay open, so any blocked path defeats natural circulation.",
    root: {
      id: "PCS-TOP", type: "OR", name: "Primary natural circulation fails to establish",
      children: [
        { id: "be-PCS-FLOW-CCF", type: "BE", name: "Common cause blockage of both flow paths", be: "PCS-FLOW-CCF", mode: "COMMON_CAUSE_FAILURE", source: "CCF-PCS-FLOW", prob: "2.0E-4", ccf: true },
        { id: "be-PCS-CKV-FO", type: "BE", name: "Loop check valve fails to open", be: "PCS-CKV-FO", mode: "FAILURE_TO_START", source: "DA-BE-044", prob: "1.0E-3" },
        { id: "be-PCS-TC-FR", type: "BE", name: "Thermal-center flow degraded below the limit", be: "PCS-TC-FR", mode: "FAILURE_TO_RUN", source: "DA-BE-046", prob: "5.0E-4" },
      ],
    },
  },
};

interface SystemDossier {
  safetyClass: string;
  defenseInDepth: string;
  procedures: string[];
  operation: { normal: string; abnormal: string; emergency: string };
  techSpecs: string;
  operatingHistory: string;
  ieContribution: string;
}

const SY_SYSTEM_DOSSIERS: Record<string, SystemDossier> = {
  "SYS-RPS": { safetyClass: "Safety-related", defenseInDepth: "Reactivity control, second level", procedures: ["RPS channel surveillance", "Scram-breaker functional test"], operation: { normal: "Armed and monitoring, no actuation.", abnormal: "Trips on the first exceeded setpoint.", emergency: "Inserts negative reactivity on the protective signal." }, techSpecs: "Two trip divisions operable, response within 3 s.", operatingHistory: "Pre-operational, vendor and test-reactor data carried.", ieContribution: "Protection only, no initiator contribution." },
  "SYS-DRACS": { safetyClass: "Safety-related", defenseInDepth: "Decay-heat removal, third level", procedures: ["DRACS loop surveillance", "Air-damper stroke test"], operation: { normal: "Standby, dampers shut, no flow.", abnormal: "Dampers open on the heat-up signal.", emergency: "Loops remove decay heat by natural circulation." }, techSpecs: "Two of three loops operable.", operatingHistory: "Pre-operational, sodium-facility experience carried.", ieContribution: "A loop left in maintenance can contribute to a loss-of-heat-sink initiator." },
  "SYS-PCS": { safetyClass: "Safety-related", defenseInDepth: "Decay-heat removal, third level", procedures: ["Loop-alignment check", "Thermal-center verification"], operation: { normal: "Forced flow at power.", abnormal: "Flow coasts down on a pump trip.", emergency: "Buoyancy-driven natural circulation establishes." }, techSpecs: "Both loop paths open and unblocked.", operatingHistory: "Pre-operational, design analysis carried.", ieContribution: "A blocked loop path can contribute to a loss-of-flow initiator." },
  "SYS-CIS": { safetyClass: "Safety-related", defenseInDepth: "Radionuclide retention, fourth level", procedures: ["Isolation-damper test", "Clean-up train surveillance"], operation: { normal: "Open, normal ventilation.", abnormal: "Isolates on the activity signal.", emergency: "Holds the leak rate and filters the release." }, techSpecs: "Isolation closes within the design time, leak rate below the limit.", operatingHistory: "Pre-operational, qualification testing carried.", ieContribution: "Spurious isolation can contribute to a loss-of-cooling initiator." },
  "SYS-GV": { safetyClass: "Safety-related", defenseInDepth: "Coolant inventory, third level", procedures: ["Leak-detection calibration"], operation: { normal: "Passive, surrounds the primary vessel.", abnormal: "Catches a primary leak.", emergency: "Keeps the core covered by bounding the leak." }, techSpecs: "Guard-vessel integrity maintained.", operatingHistory: "Pre-operational, structural analysis carried.", ieContribution: "No initiator contribution, passive boundary." },
  "SYS-DC": { safetyClass: "Safety-related", defenseInDepth: "Support to protection and actuation", procedures: ["Battery service test", "Charger surveillance"], operation: { normal: "Float charge from the chargers.", abnormal: "Carries the load on a loss of charging.", emergency: "Supplies the trip and actuation loads for the mission time." }, techSpecs: "Battery capacity for the 24 h mission with margin.", operatingHistory: "Pre-operational, vendor capacity data carried.", ieContribution: "A loss of a DC bus is itself a support-system initiator." },
  "SYS-ACT": { safetyClass: "Safety-related", defenseInDepth: "Support to protection", procedures: ["Actuation-logic functional test"], operation: { normal: "Monitors and votes the inputs.", abnormal: "Detects the exceeded setpoint.", emergency: "Generates the trip or isolation signal on demand." }, techSpecs: "Digital logic operable, software qualified.", operatingHistory: "Pre-operational, software verification carried.", ieContribution: "A spurious actuation can contribute to a transient initiator." },
  "SYS-HVAC": { safetyClass: "Safety-related", defenseInDepth: "Support to instrumentation and control", procedures: ["Chiller surveillance", "Room-temperature check"], operation: { normal: "Maintains the I&C room temperature.", abnormal: "Carries the heat load on a partial loss.", emergency: "Keeps the I&C below its qualified temperature." }, techSpecs: "Room temperature within the qualified band.", operatingHistory: "Pre-operational, thermal analysis carried.", ieContribution: "A loss of room cooling is a support-system initiator." },
};

interface SystemResult {
  unavailability: string;
  p5: string;
  p95: string;
  cutSets: { rank: number; events: string[]; prob: string }[];
  importance: { item: string; fv: number; raw: number }[];
}

const SY_SYSTEM_RESULTS: Record<string, SystemResult> = {
  "SYS-RPS": { unavailability: "2.4e-4", p5: "8.0e-5", p95: "7.0e-4", cutSets: [{ rank: 1, events: ["RPS-DIVA-FTR", "RPS-DIVB-FTR"], prob: "1.1e-4" }, { rank: 2, events: ["CCF-SCRAM-BRK"], prob: "9.0e-5" }], importance: [{ item: "Scram breakers (CCF)", fv: 0.46, raw: 120 }, { item: "Trip-logic division", fv: 0.31, raw: 38 }] },
  "SYS-DRACS": { unavailability: "1.9e-3", p5: "5.0e-4", p95: "6.5e-3", cutSets: [{ rank: 1, events: ["CCF-DRACS-DMP"], prob: "9.5e-4" }, { rank: 2, events: ["DRACS-L1-FTR", "DRACS-L2-FTR", "DRACS-L3-FTR"], prob: "3.1e-4" }], importance: [{ item: "Damper actuation (CCF)", fv: 0.51, raw: 95 }, { item: "Air-side fouling", fv: 0.22, raw: 14 }] },
  "SYS-PCS": { unavailability: "6.0e-4", p5: "2.0e-4", p95: "1.8e-3", cutSets: [{ rank: 1, events: ["PCS-L1-BLOCK", "PCS-L2-BLOCK"], prob: "3.4e-4" }], importance: [{ item: "Loop flow-path blockage", fv: 0.58, raw: 22 }] },
  "SYS-CIS": { unavailability: "3.2e-3", p5: "9.0e-4", p95: "1.1e-2", cutSets: [{ rank: 1, events: ["CIS-ISO-FTC", "CCF-ISO-DMP"], prob: "1.6e-3" }], importance: [{ item: "Isolation dampers (CCF)", fv: 0.49, raw: 40 }, { item: "Clean-up blower", fv: 0.18, raw: 9 }] },
  "SYS-GV": { unavailability: "1.0e-4", p5: "3.0e-5", p95: "3.5e-4", cutSets: [{ rank: 1, events: ["GV-SHELL-LEAK"], prob: "1.0e-4" }], importance: [{ item: "Guard-vessel shell", fv: 0.90, raw: 200 }] },
  "SYS-DC": { unavailability: "1.5e-3", p5: "4.0e-4", p95: "5.0e-3", cutSets: [{ rank: 1, events: ["DC-BATT-DEP"], prob: "8.0e-4" }, { rank: 2, events: ["CCF-CHARGER"], prob: "4.0e-4" }], importance: [{ item: "Battery depletion", fv: 0.53, raw: 30 }, { item: "Chargers (CCF)", fv: 0.27, raw: 18 }] },
  "SYS-ACT": { unavailability: "9.0e-4", p5: "2.5e-4", p95: "3.2e-3", cutSets: [{ rank: 1, events: ["ACT-SW-CCF"], prob: "5.0e-4" }], importance: [{ item: "Actuation software (CCF)", fv: 0.55, raw: 60 }] },
  "SYS-HVAC": { unavailability: "1.2e-3", p5: "3.5e-4", p95: "4.0e-3", cutSets: [{ rank: 1, events: ["CCF-CHILLER"], prob: "6.0e-4" }], importance: [{ item: "Safety chillers (CCF)", fv: 0.48, raw: 25 }] },
};

const SY_SYSTEM_BREAKDOWN = {
  scoping: "A system is scoped in when it supports a key safety function or can cause an initiating event.",
  screeningCriterion: "A system is screened from detailed analysis only when it has no modeled safety role and cannot cause an initiator.",
  selected: ["SYS-RPS", "SYS-DRACS", "SYS-PCS", "SYS-CIS", "SYS-DC", "SYS-ACT", "SYS-HVAC"],
  systemLevel: ["SYS-GV"],
  grouping: "Redundant trains are modeled within one system fault tree, and a shared support system is modeled once and referenced by each dependent system.",
};

const SY_LABELING_SCHEME: { type: string; code: string; example: string; note: string }[] = [
  { type: "Hazard type", code: "H-xxxx", example: "H-FIRE", note: "Prefix for an internal or external hazard." },
  { type: "Initiating event", code: "IE-xxxx", example: "IE-LOHS", note: "Carried from the Initiating Events element." },
  { type: "Basic event", code: "SYS-CMP-MODE", example: "DRACS-DMP-FTO", note: "System, component, then failure mode." },
  { type: "Other event", code: "HFE / CCF", example: "HFE-1, CCF-DRACS-DMP", note: "Human failure events and common-cause groups." },
  { type: "Gate", code: "G-xxxx", example: "G-DRACS-TOP", note: "Logic gate identifier in the fault tree." },
];

interface ModeledFailure {
  id: string;
  system: string;
  included: string[];
  excludedMode: string;
  flowDiversion: string | null;
}

const MODELED_FAILURES: ModeledFailure[] = [
  { id: "MF-DRC", system: "SYS-DRACS", included: ["Loop natural-circulation loss", "Damper fails to open", "Air-path blockage", "Common cause of loops"], excludedMode: "Loop overcooling, a beneficial failure that helps the function.", flowDiversion: "Cross-connect leakage modeled as a diversion path that steals flow." },
  { id: "MF-RPS", system: "SYS-RPS", included: ["Division fails to trip", "Scram breaker fails open", "Rod fails to release", "Common cause of divisions"], excludedMode: "Spurious trip, which acts to shut the plant down rather than defeat it.", flowDiversion: null },
  { id: "MF-CIS", system: "SYS-CIS", included: ["Isolation damper fails to close", "Clean-up train fails to run", "Signal fails to generate"], excludedMode: "Premature isolation, which closes the boundary earlier than needed.", flowDiversion: "Unisolated penetration modeled as a bypass leak path." },
];

const SCREENING_CRITERIA: { code: string; label: string }[] = [
  { code: "a", label: "Total failure probability below 1E-6 over the mission time" },
  { code: "b", label: "Failure mode cannot defeat the system success criterion" },
];

interface UnavailabilityItem {
  id: string;
  system: string;
  item: string;
  type: string;
  basis: string;
  note: string;
  preop: boolean;
}

const UNAVAILABILITY: UnavailabilityItem[] = [
  { id: "UA-1", system: "SYS-DRACS", item: "Single DRACS loop in surveillance", type: "Planned", basis: "Staggered loop testing per the design surveillance plan.", note: "Two loops stay available, modeled as a maintenance unavailability term.", preop: false },
  { id: "UA-2", system: "SYS-DC", item: "Battery on equalize charge", type: "Planned", basis: "Pre-operational assumption from the design test plan, no operating history yet.", note: "Assumed duration logged until as-operated data exists.", preop: true },
  { id: "UA-3", system: "SYS-CIS", item: "Clean-up train and isolation damper together", type: "Simultaneous", basis: "Redundant equipment planned out of service at once, parameter from DA.", note: "Simultaneous planned unavailability of redundant equipment carried explicitly.", preop: false },
];

const REPAIR_CREDIT: { id: string; system: string; item: string; credited: boolean; basis: string }[] = [
  { id: "RC-1", system: "SYS-DC", item: "Battery charger", credited: false, basis: "No repair credit for the hardware fault, no qualifying data or analysis." },
  { id: "RC-2", system: "SYS-CIS", item: "Clean-up train fan", credited: false, basis: "Repair not credited within the mission time." },
];

interface SpatialCoupling {
  id: string;
  name: string;
  type: "SPATIAL" | "ENVIRONMENTAL";
  icon: string;
  affects: string[];
  hazard: string;
  treatment: string;
  status: "ok" | "warn";
}

const SPATIAL_COUPLINGS: SpatialCoupling[] = [
  { id: "SPC-1", name: "North penetration room", type: "SPATIAL", icon: "Map", affects: ["DRACS loop 1", "DRACS loop 2"], hazard: "A fire or flood here fails two of the three DRACS loops at once.", treatment: "Modeled in the fault tree as a room-level dependent failure.", status: "warn" },
  { id: "SPC-2", name: "Shared safety HVAC", type: "ENVIRONMENTAL", icon: "Wind", affects: ["DC battery room", "Safety I&C room"], hazard: "Loss of cooling raises temperature in both rooms together.", treatment: "Modeled as an environmental dependency on the HVAC top event.", status: "ok" },
  { id: "SPC-3", name: "Sodium-fire environment", type: "ENVIRONMENTAL", icon: "Thermo", affects: ["CIS isolation dampers"], hazard: "Dampers may operate beyond their environmental qualification.", treatment: "Dependent failure from the adverse condition included (SY-B14).", status: "warn" },
];

const NOMENCLATURE = {
  scheme: "SYS-COMP-MODE",
  note: "One designator per component failure mode across every system and train, which lets the quantifier link the trees.",
  examples: [
    { designator: "DRC-LP1-FR", reads: "DRACS loop 1, fail to run" },
    { designator: "RPS-DVA-FS", reads: "RPS division A, fail to start" },
    { designator: "DC-BAT-A-FR", reads: "DC battery A, fail to run" },
    { designator: "DRC-CCF-FR", reads: "DRACS loops, common cause fail to run" },
  ],
};

const LEVEL_OF_DETAIL = {
  basis: "Detail set against the available design information, sufficient to surface the risk-significant contributors.",
  hfeBasis: "Human failure events delineated to the same level as the design package supports.",
};

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
  SystemMeta,
  SafetyFunctionSpec,
  UpstreamLinkSpec,
  SideLinkSpec,
  SyTreeNode,
  SyGateNode,
  SyBeNode,
  SyTrNode,
  SyLogicModel,
  SystemDossier,
  SystemResult,
  ModeledFailure,
  UnavailabilityItem,
  SpatialCoupling,
};

export {
  SY_STEPS,
  SY_PERSONAS,
  SY_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  SY_SYSTEM_META,
  SY_SAFETY_FUNCTIONS,
  FAILURE_MODE_TYPES,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  DEP_KIND,
  CONFIRM_METHODS,
  SY_UPSTREAM_LINKS,
  SY_SIDEWAYS_LINKS,
  SY_DOWNSTREAM_LINKS,
  SY_LOGIC_MODELS,
  SY_SYSTEM_DOSSIERS,
  SY_SYSTEM_RESULTS,
  SY_SYSTEM_BREAKDOWN,
  SY_LABELING_SCHEME,
  MODELED_FAILURES,
  SCREENING_CRITERIA,
  UNAVAILABILITY,
  REPAIR_CREDIT,
  SPATIAL_COUPLINGS,
  NOMENCLATURE,
  LEVEL_OF_DETAIL,
  SY_METHODOLOGY_TOC,
  SY_SYSTEM_TOC,
};

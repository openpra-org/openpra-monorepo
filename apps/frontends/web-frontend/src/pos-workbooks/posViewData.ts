// hardcoded — presentation-only data for the POS demo. These are workflow / UI
// concerns (step progress, uploaded source files, per-state workflow status) that
// have no home in the POS MEF schema.

import { POS_SR_CATALOG } from "interfaces-mef-types/pos/plant-operating-state-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface PosStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  warn?: boolean;
  terminal?: boolean;
}

const POS_PROJECT = {
  projectName: "Generic HTGR Pre-operational PRA",
  projectVersion: 1,
  workbookName: "POS Workbook 1",
  workbookOwner: "Aakash Patel",
  workbookOwnerInitials: "AP",
  workbookCreated: "Apr 2, 2026",
  workbookVersion: 2,
};

const POS_STEPS: PosStep[] = [
  { id: "setup", num: "01", label: "Scope", sub: "Plant & profile", status: "complete" },
  { id: "documents", num: "02", label: "Documents", sub: "Design basis & refs", status: "complete" },
  { id: "evolutions", num: "03", label: "Plant Evolutions", sub: "5 defined", status: "complete" },
  { id: "states", num: "04", label: "Operating States", sub: "9 defined · 1 attention", status: "in-progress" },
  { id: "interviews", num: "05", label: "Interviews & Walkdowns", sub: "7 logged", status: "complete" },
  { id: "screening", num: "06", label: "Screening", sub: "2 retained · 1 screened", status: "in-progress" },
  { id: "grouping", num: "07", label: "Grouping", sub: "3 groups", status: "in-progress" },
  { id: "frequency", num: "08", label: "Frequencies & Duration", sub: "8 of 9 complete", status: "in-progress" },
  { id: "decayheat", num: "09", label: "Decay Heat", sub: "6 LPSD states", status: "idle" },
  { id: "draft", num: "10", label: "Draft", sub: "Produce report", status: "idle", terminal: true },
  { id: "review", num: "11", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "12", label: "Approval", sub: "Sign-off", status: "idle", terminal: true },
];

type PosPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: PosPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const PERSONAS: Record<PosPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const PERSONA_STEPS: Record<PosPersona, string[]> = {
  preparer: ["setup", "documents", "evolutions", "states", "interviews", "screening", "grouping", "frequency", "decayheat", "draft", "review", "approval"],
  reviewer: ["setup", "documents", "evolutions", "states", "interviews", "screening", "grouping", "frequency", "decayheat", "draft", "review", "approval"],
  approver: ["setup", "documents", "evolutions", "states", "interviews", "screening", "grouping", "frequency", "decayheat", "draft", "review", "approval"],
};

interface CapabilityCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { id: "cc-i", name: "CC-I", tag: "Bounding", description: "Coarse scope, simple methods, generic data, and bounding assumptions." },
  { id: "cc-ii", name: "CC-II", tag: "Plant-specific", description: "Plant-specific data and finer resolution for risk-significant contributors." },
];

type ConformanceStatus = "ok" | "warn" | "blocked" | "na";
type ConformanceStage = "both" | "operational" | "pre_operational";

interface ConformanceItem {
  id: string;
  section: string;
  text: string;
  status: ConformanceStatus;
  meta?: string;
  requiredAt: string[];
  stages: ConformanceStage[];
  sr?: string[];
  linkedNM?: string;
}

const HLR_SECTION: Record<string, string> = {
  A: "Operating-state definition (HLR-POS-A)",
  B: "Screening & grouping (HLR-POS-B)",
  C: "Frequencies & duration (HLR-POS-C)",
  D: "Documentation (HLR-POS-D)",
};

const POS_SR_DESCRIPTIONS: Record<string, string> = {
  "POS-A1": "Representative set of plant evolutions identified (at-power, controlled & forced outages, refuelling)",
  "POS-A2": "Plant/design documentation reviewed per evolution (modes, RCB config, RCS parameters, barriers)",
  "POS-A3": "Exclusive operating states defined to cover each evolution by unique parameter combinations",
  "POS-A4": "Operating plants: state delineation consistent with the as-built / as-operated plant",
  "POS-A5": "Pre-operational: state delineation consistent with available design information",
  "POS-A6": "Operating plants: known future evolutions reviewed so state selections stay valid",
  "POS-A7": "Operating plants: plant personnel interviewed for overlooked past or future evolutions",
  "POS-A8": "Pre-operational: engineering staff interviewed to confirm the state selection represents the as-designed plant",
  "POS-A9": "State conditions let the remaining PRA elements proceed and capture risk-significant contributors",
  "POS-A10": "State conditions reviewed to stay sufficient for any in-scope hazard groups beyond internal events",
  "POS-A11": "SSCs and their desired operational characteristics needed in each state identified",
  "POS-A12": "Model-uncertainty sources, assumptions & alternatives in state definition identified",
  "POS-A13": "Pre-operational: assumptions from missing as-built / as-operated detail in state definitions logged",
  "POS-B1": "Plant evolutions grouped into representative evolutions, bounded by worst-case impact",
  "POS-B2": "States retained unless screened out by SCR-1/2/3; any alternate criteria justified",
  "POS-B3": "Similar states grouped without masking risk-significant contributors or insights",
  "POS-B4": "States with different plant-response impacts or higher release potential kept separate",
  "POS-B5": "Demand-based and time-based initiator states separated to avoid averaging short demands",
  "POS-B6": "Grouped states take the most severe / constraining characteristics of any member",
  "POS-B7": "Model-uncertainty sources, assumptions & alternatives in screening / grouping identified",
  "POS-B8": "Pre-operational: assumptions from missing as-built detail in screening / grouping identified",
  "POS-C1": "Mean duration and mean time after shutdown calculated for each state",
  "POS-C2": "Pre-operational: basis provided for the assumed mean duration and time-in-cycle of each state",
  "POS-C3": "State-group durations summed; grouped entry frequencies handled per POS-B1",
  "POS-C4": "LPSD decay-heat level calculated per state for success criteria and operator timing",
  "POS-C5": "Operating plants: future plans / schedules reviewed so assumed decay-heat & durations stay valid",
  "POS-D1": "POS process documented (inputs, methods, results) with full SR traceability",
  "POS-D2": "Model-uncertainty sources, assumptions & alternatives documented (POS-A12, B7)",
  "POS-D3": "Pre-operational: assumptions & limitations from missing as-built detail documented",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(POS_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s): ConformanceStage => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const item: ConformanceItem = {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-POS-${meta.hlr}`,
      text: `POS - ${code.slice("POS-".length)}: ${POS_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn",
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      sr: [code],
    };
    return item;
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface CcScore {
  applicable: number;
  met: number;
  warn: number;
  blocked: number;
  na: number;
  percent: number;
}

interface PosDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  size: string;
  uploaded: string;
  extracted: string;
  linked: number;
  url?: string;
}

const POS_DOCUMENTS: PosDocument[] = [
  { id: "DOC-01", name: "OECD/NEA MHTGR-350 MW Core Design Benchmark", kind: "doc", size: "OECD/NEA", uploaded: "MHTGR-350 benchmark", extracted: "Core thermal power, helium pressure, core inlet and outlet temperatures, mass flow, prismatic core design", linked: 5, url: "/api/example-documents/pos/mhtgr-benchmark" },
  { id: "DOC-02", name: "Multi-physics steady-state analysis of the MHTGR-350", kind: "doc", size: "J. Nucl. Sci. Technol.", uploaded: "2017", extracted: "Confirms 350 MWt, 6.4 MPa, 259 and 687 °C, 157.1 kg/s helium flow", linked: 4, url: "/api/example-documents/pos/mhtgr-analysis" },
  { id: "DOC-03", name: "Overview of Modular HTGR Safety Characterization", kind: "doc", size: "ORNL", uploaded: "Pub49707", extracted: "Passive decay heat removal, the RCCS and SCS, loss of forced cooling", linked: 4, url: "/api/example-documents/pos/htgr-safety" },
  { id: "DOC-04", name: "NGNP Probabilistic Risk Assessment White Paper (INL/EXT-11-21270)", kind: "doc", size: "INL", uploaded: "INL/EXT-11-21270", extracted: "HTGR PRA approach, plant operating states, licensing basis events", linked: 5, url: "/api/example-documents/pos/ngnp-pra" },
];

type PosWorkflowStatus = "ok" | "warn" | "draft";

interface PosUiState {
  status: PosWorkflowStatus;
  statusMessage?: string;
  docsLinked: number;
}

// hardcoded — per-state workflow status, review message and linked-document count.
const POS_UI_STATE: Record<string, PosUiState> = {
  "POS-01": { status: "ok", docsLinked: 4 },
  "POS-02": { status: "ok", docsLinked: 3 },
  "POS-03": { status: "ok", docsLinked: 2 },
  "POS-04": { status: "ok", docsLinked: 2 },
  "POS-05": { status: "ok", docsLinked: 3 },
  "POS-06": { status: "ok", docsLinked: 4 },
  "POS-07": { status: "ok", docsLinked: 2 },
  "POS-08": { status: "draft", statusMessage: "Decay-heat level not yet characterised.", docsLinked: 1 },
  "POS-09": { status: "draft", docsLinked: 1 },
};

// hardcoded — per-evolution presentation extras (duration share, source ref) not in schema.
const EVOLUTION_UI: Record<string, { durationFraction: number; fromDoc: string }> = {
  "EV-01": { durationFraction: 0.84, fromDoc: "DBD §3.2" },
  "EV-02": { durationFraction: 0.05, fromDoc: "DBD §3.3 / OP-002" },
  "EV-03": { durationFraction: 0.06, fromDoc: "DBD §3.4 / OP-014" },
  "EV-04": { durationFraction: 0.03, fromDoc: "EOP-100" },
  "EV-05": { durationFraction: 0.02, fromDoc: "OP-211" },
};

// hardcoded — workflow-state display catalog (the chrome header pill reads this
// to format the schema's WorkflowState enum into a human label + tone).
type WorkflowTone = "draft" | "progress" | "ok" | "external" | "approver";

interface WorkflowStateDisplay {
  state: string;
  label: string;
  tone: WorkflowTone;
  blurb: string;
}

const WORKFLOW_STATES_DISPLAY: WorkflowStateDisplay[] = [
  { state: "DRAFT", label: "Draft", tone: "draft", blurb: "Authors editing" },
  { state: "INTERNAL_TECHNICAL_REVIEW", label: "Internal technical review", tone: "progress", blurb: "Internal reviewers leaving comments" },
  { state: "INTERNAL_APPROVAL", label: "Internal approval", tone: "progress", blurb: "Awaiting approver sign-off" },
  { state: "REVISION_REQUIRED", label: "Revision required", tone: "draft", blurb: "Returned to the preparer for changes" },
  { state: "AWAITING_EXTERNAL_REVIEW", label: "Approved · ready for external review", tone: "ok", blurb: "Internal sign-off complete" },
  { state: "FINAL", label: "Final", tone: "ok", blurb: "All workflows closed" },
  { state: "DEPRECATED", label: "Deprecated", tone: "draft", blurb: "Superseded by a newer workbook" },
];

function workflowStateDisplay(state: string): WorkflowStateDisplay {
  return WORKFLOW_STATES_DISPLAY.find((w) => w.state === state) ?? WORKFLOW_STATES_DISPLAY[0];
}

export {
  type PosStep,
  type StepStatus,
  type CapabilityCategory,
  type ConformanceItem,
  type ConformanceStatus,
  type ConformanceStage,
  type CcScore,
  type PosDocument,
  type PosWorkflowStatus,
  type PosUiState,
  type PosPersona,
  type PersonaSpec,
  type WorkflowTone,
  type WorkflowStateDisplay,
  POS_PROJECT,
  POS_STEPS,
  PERSONAS,
  PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  POS_DOCUMENTS,
  POS_UI_STATE,
  EVOLUTION_UI,
  WORKFLOW_STATES_DISPLAY,
  workflowStateDisplay,
};

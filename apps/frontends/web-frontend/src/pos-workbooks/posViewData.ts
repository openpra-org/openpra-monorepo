// hardcoded — presentation-only data for the POS demo. These are workflow / UI
// concerns (step progress, uploaded source files, dock checklist copy in plant
// language, per-state workflow status) that have no home in the POS MEF schema.

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
  projectName: "Generic-1 Reactor — Pre-operational PRA",
  projectVersion: 1,
  workbookName: "POS Workbook 1",
  workbookOwner: "Aakash Patel",
  workbookOwnerInitials: "AP",
  workbookCreated: "Apr 2, 2026",
  workbookVersion: 2,
  plant: {
    name: "Generic-1",
    type: "Sodium-cooled fast reactor (SFR)",
    power: "300 MWt",
    vendor: "Generic Nuclear LLC",
    siteName: "INL — Eastern Idaho",
    coolant: "Liquid sodium (primary), liquid sodium (intermediate), supercritical CO₂ (power conversion)",
  },
};

const POS_STEPS: PosStep[] = [
  { id: "setup", num: "01", label: "Setup", sub: "Plant & profile", status: "complete" },
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

const CONFORMANCE_ITEMS: ConformanceItem[] = [
  // ─── HLR-POS-A — Operating-state definition (POS-A1…A13) ───
  { id: "pos-a1", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A1 — Representative set of plant evolutions identified (at-power, controlled & forced outages, refuelling)",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A1"] },
  { id: "pos-a2", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A2 — Plant/design documentation reviewed per evolution (modes, RCB config, RCS parameters, barriers)",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A2"] },
  { id: "pos-define", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A3 — Exclusive operating states defined to cover each evolution by unique parameter combinations",
    status: "warn", meta: "POS-04 missing barrier-status entry", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A3"] },
  { id: "pos-a4", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A4 — Operating plants: state delineation consistent with the as-built / as-operated plant",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["operational"], sr: ["POS-A4"] },
  { id: "pos-a5", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A5 — Pre-operational: state delineation consistent with available design information",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-A5"] },
  { id: "pos-a6", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A6 — Operating plants: known future evolutions reviewed so state selections stay valid",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["operational"], sr: ["POS-A6"] },
  { id: "pos-a7", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A7 — Operating plants: plant personnel interviewed for overlooked past or future evolutions",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["operational"], sr: ["POS-A7"] },
  { id: "iv-eng", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A8 — Pre-operational: engineering staff interviewed to confirm the state selection represents the as-designed plant",
    status: "ok", meta: "7 sessions logged", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-A8"] },
  { id: "pos-a9", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A9 — State conditions let the remaining PRA elements proceed and capture risk-significant contributors",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A9"] },
  { id: "pos-a10", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A10 — State conditions reviewed to stay sufficient for any in-scope hazard groups beyond internal events",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A10"] },
  { id: "pos-ssc", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A11 — SSCs and their desired operational characteristics needed in each state identified",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A11"] },
  { id: "pos-a12", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A12 — Model-uncertainty sources, assumptions & alternatives in state definition identified (→ HLR-ESQ-E)",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-A12"] },
  { id: "pos-a13", section: "Operating-state definition (HLR-POS-A)",
    text: "POS-A13 — Pre-operational: assumptions from missing as-built / as-operated detail in state definitions logged",
    status: "ok", meta: "6 logged", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-A13"] },

  // ─── HLR-POS-B — Screening & grouping (POS-B1…B8) ───
  { id: "pos-b1", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B1 — Plant evolutions grouped into representative evolutions, bounded by worst-case impact",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B1"] },
  { id: "scr-rationale", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B2 — States retained unless screened out by SCR-1/2/3; any alternate criteria justified",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B2"] },
  { id: "grp-nomask", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B3 — Similar states grouped without masking risk-significant contributors or insights",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B3"], linkedNM: "NM-028" },
  { id: "pos-b4", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B4 — States with different plant-response impacts or higher release potential kept separate",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B4"] },
  { id: "pos-b5", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B5 — Demand-based and time-based initiator states separated to avoid averaging short demands",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B5"] },
  { id: "grp-bounding", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B6 — Grouped states take the most severe / constraining characteristics of any member",
    status: "warn", meta: "Group RFG: bounding rationale not yet written", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B6"], linkedNM: "NM-028" },
  { id: "pos-b7", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B7 — Model-uncertainty sources, assumptions & alternatives in screening / grouping identified",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-B7"] },
  { id: "pos-b8", section: "Screening & grouping (HLR-POS-B)",
    text: "POS-B8 — Pre-operational: assumptions from missing as-built detail in screening / grouping identified",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-B8"] },

  // ─── HLR-POS-C — Frequencies & duration (POS-C1…C5) ───
  { id: "freq-dur", section: "Frequencies & duration (HLR-POS-C)",
    text: "POS-C1 — Mean duration and mean time after shutdown calculated for each state",
    status: "warn", meta: "1 state missing duration basis", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-C1"], linkedNM: "NM-021" },
  { id: "pos-c2", section: "Frequencies & duration (HLR-POS-C)",
    text: "POS-C2 — Pre-operational: basis provided for the assumed mean duration and time-in-cycle of each state",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-C2"] },
  { id: "pos-c3", section: "Frequencies & duration (HLR-POS-C)",
    text: "POS-C3 — State-group durations summed; grouped entry frequencies handled per POS-B1",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-C3"] },
  { id: "decay-heat", section: "Frequencies & duration (HLR-POS-C)",
    text: "POS-C4 — LPSD decay-heat level calculated per state for success criteria and operator timing",
    status: "blocked", meta: "0 of 6 LPSD states characterised", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-C4"], linkedNM: "NM-014" },
  { id: "pos-c5", section: "Frequencies & duration (HLR-POS-C)",
    text: "POS-C5 — Operating plants: future plans / schedules reviewed so assumed decay-heat & durations stay valid",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["operational"], sr: ["POS-C5"] },

  // ─── HLR-POS-D — Documentation (POS-D1…D3) ───
  { id: "pos-d1", section: "Documentation (HLR-POS-D)",
    text: "POS-D1 — POS process documented (inputs, methods, results) with full SR traceability",
    status: "ok", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-D1"] },
  { id: "doc-uncert", section: "Documentation (HLR-POS-D)",
    text: "POS-D2 — Model-uncertainty sources, assumptions & alternatives documented (POS-A12, B7)",
    status: "ok", meta: "4 logged", requiredAt: ["cc-i", "cc-ii"], stages: ["both"], sr: ["POS-D2"] },
  { id: "doc-preop", section: "Documentation (HLR-POS-D)",
    text: "POS-D3 — Pre-operational: assumptions & limitations from missing as-built detail documented",
    status: "ok", meta: "6 logged · 2 closures pending", requiredAt: ["cc-i", "cc-ii"], stages: ["pre_operational"], sr: ["POS-D3"] },
];

interface CcScore {
  applicable: number;
  met: number;
  warn: number;
  blocked: number;
  na: number;
  percent: number;
}

// hardcoded — precomputed conformance score per capability category. The step-01
// cards and the right dock both read these so the numbers always agree.
const CC_SCORES: Record<string, CcScore> = {
  "cc-i": { applicable: 8, met: 7, warn: 1, blocked: 0, na: 0, percent: 88 },
  "cc-ii": { applicable: 17, met: 12, warn: 3, blocked: 1, na: 1, percent: 71 },
};

interface PosDocument {
  id: string;
  name: string;
  kind: "doc" | "sheet" | "image";
  size: string;
  uploaded: string;
  extracted: string;
  linked: number;
}

const POS_DOCUMENTS: PosDocument[] = [
  { id: "DOC-01", name: "Generic-1 Design Basis Document — Rev 4", kind: "doc", size: "12.4 MB", uploaded: "Mar 4", extracted: "Operating modes · RCS parameters · Barrier list", linked: 9 },
  { id: "DOC-02", name: "P&ID — Primary sodium loop", kind: "image", size: "2.1 MB", uploaded: "Mar 4", extracted: "Components · valve states", linked: 6 },
  { id: "DOC-03", name: "P&ID — Intermediate heat-transport loop", kind: "image", size: "1.8 MB", uploaded: "Mar 4", extracted: "Components · valve states", linked: 5 },
  { id: "DOC-04", name: "P&ID — Cover-gas system", kind: "image", size: "1.4 MB", uploaded: "Mar 4", extracted: "Vent paths · barriers", linked: 4 },
  { id: "DOC-05", name: "OP-002 — Startup & shutdown procedure", kind: "doc", size: "3.2 MB", uploaded: "Mar 6", extracted: "Operating modes · transitions", linked: 4 },
  { id: "DOC-06", name: "OP-014 — Refuelling sequence", kind: "doc", size: "5.6 MB", uploaded: "Mar 6", extracted: "Refuelling activities · barrier status", linked: 3 },
  { id: "DOC-07", name: "EOP-100 — Post-trip cooldown", kind: "doc", size: "2.4 MB", uploaded: "Mar 7", extracted: "DRACS activation · timing", linked: 2 },
  { id: "DOC-08", name: "Decay-heat curves (vendor)", kind: "sheet", size: "92 KB", uploaded: "Mar 11", extracted: "Decay-heat as function of time", linked: 6 },
  { id: "DOC-09", name: "Instrumentation list — Rev 2", kind: "sheet", size: "210 KB", uploaded: "Mar 14", extracted: "Sensor list · safety classification", linked: 9 },
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
  "POS-04": { status: "warn", statusMessage: "Barrier-status field for upper containment not yet entered.", docsLinked: 2 },
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
  CC_SCORES,
  POS_DOCUMENTS,
  POS_UI_STATE,
  EVOLUTION_UI,
  WORKFLOW_STATES_DISPLAY,
  workflowStateDisplay,
};

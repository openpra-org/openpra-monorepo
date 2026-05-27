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
}

const POS_PROJECT = {
  projectName: "Aurora-1 — Pre-operational PRA",
  projectVersion: 1,
  workbookName: "POS — design certification baseline",
  workbookOwner: "Aakash Patel",
  workbookOwnerInitials: "AP",
  workbookCreated: "Apr 2, 2026",
  workbookVersion: 2,
  plant: {
    name: "Aurora-1",
    type: "Sodium-cooled fast reactor (SFR)",
    power: "300 MWt",
    vendor: "Argent Nuclear",
    siteName: "INL — Eastern Idaho",
    coolant: "Liquid sodium (primary), liquid sodium (intermediate), supercritical CO₂ (power conversion)",
  },
};

const POS_STEPS: PosStep[] = [
  { id: "setup", num: "01", label: "Setup", sub: "Plant & profile", status: "complete" },
  { id: "documents", num: "02", label: "Documents", sub: "Design basis & refs", status: "complete" },
  { id: "evolutions", num: "03", label: "Plant evolutions", sub: "5 defined", status: "complete" },
  { id: "states", num: "04", label: "Operating states", sub: "9 defined · 1 needs review", status: "in-progress" },
  { id: "interviews", num: "05", label: "Interviews & walkdowns", sub: "7 logged", status: "complete" },
  { id: "screening", num: "06", label: "Screening", sub: "2 retained · 1 screened", status: "in-progress" },
  { id: "grouping", num: "07", label: "Grouping", sub: "3 groups", status: "in-progress", warn: true },
  { id: "frequency", num: "08", label: "Frequencies & duration", sub: "8 of 9 complete", status: "in-progress" },
  { id: "decayheat", num: "09", label: "Decay heat", sub: "6 LPSD states", status: "idle" },
  { id: "generate", num: "10", label: "Assumptions & generate", sub: "Final review", status: "idle" },
];

interface CapabilityCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { id: "cc-i", name: "CC-I", tag: "Bounding", description: "Coarser methods and bounding assumptions. Good enough for screening studies." },
  { id: "cc-ii", name: "CC-II", tag: "Plant-specific", description: "More plant-specific data, finer resolution, fewer blanket conservatisms." },
  { id: "cc-iii", name: "CC-III", tag: "Detailed plant-specific", description: "Finest resolution, most plant-specific realism, least reliance on bounding assumptions." },
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
}

const CONFORMANCE_ITEMS: ConformanceItem[] = [
  { id: "evol-set", section: "Plant evolutions", text: "Plant evolutions identified and documented", status: "ok", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A1"] },
  { id: "evol-design", section: "Plant evolutions", text: "Each evolution traced to design-basis documents", status: "ok", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A2"] },
  { id: "evol-future", section: "Plant evolutions", text: "Future evolutions reviewed for higher-risk states not yet encountered", status: "warn", meta: "1 evolution pending review", requiredAt: ["cc-iii"], stages: ["operational"], sr: ["POS-A9"] },

  { id: "pos-define", section: "Operating states", text: "All operating states fully characterised", status: "warn", meta: "POS-04 missing barrier-status entry", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A3"] },
  { id: "pos-sources", section: "Operating states", text: "Ex-core radioactive sources tracked (spent fuel, off-gas, cover gas)", status: "ok", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A3"] },
  { id: "pos-instr", section: "Operating states", text: "Available instrumentation listed per state", status: "ok", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A3"] },
  { id: "pos-ssc", section: "Operating states", text: "Required SSC configurations recorded per state", status: "ok", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A11"] },
  { id: "pos-mxcc", section: "Operating states", text: "Operating states are non-overlapping (any plant condition in exactly one)", status: "ok", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"] },
  { id: "pos-exhaust", section: "Operating states", text: "Operating states are gap-free (cover the full cycle)", status: "ok", meta: "Coverage 100.00 %", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"] },

  { id: "iv-ops", section: "Interviews & walkdowns", text: "Walkdowns and interviews with operations staff documented", status: "na", meta: "Not applicable — plant not yet operating", requiredAt: ["cc-ii", "cc-iii"], stages: ["operational"], sr: ["POS-A4", "POS-A6", "POS-A7"] },
  { id: "iv-eng", section: "Interviews & walkdowns", text: "Interviews with design engineering staff documented", status: "ok", meta: "7 sessions logged", requiredAt: ["cc-ii", "cc-iii"], stages: ["pre_operational"], sr: ["POS-A8"] },

  { id: "scr-rationale", section: "Screening & grouping", text: "Every screened-out state has a quantitative or qualitative justification", status: "ok", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-B2"] },
  { id: "grp-bounding", section: "Screening & grouping", text: "Each grouped state's response is bounded by the group's worst-case", status: "warn", meta: "Group RFG: bounding rationale not yet written", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-B6"] },
  { id: "grp-nomask", section: "Screening & grouping", text: "Grouping does not mask any risk-significant contributor", status: "ok", requiredAt: ["cc-iii"], stages: ["both"], sr: ["POS-B3"] },

  { id: "freq-dur", section: "Frequencies & duration", text: "Mean duration and entry frequency captured per state", status: "warn", meta: "1 state missing duration basis", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-C1", "POS-C2"] },
  { id: "decay-heat", section: "Frequencies & duration", text: "Decay-heat level characterised for every shutdown / refuelling state", status: "blocked", meta: "0 of 6 LPSD states characterised", requiredAt: ["cc-i", "cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-C4"] },

  { id: "doc-uncert", section: "Documentation", text: "Sources of model uncertainty captured", status: "ok", meta: "4 logged", requiredAt: ["cc-ii", "cc-iii"], stages: ["both"], sr: ["POS-A12", "POS-D2"] },
  { id: "doc-preop", section: "Documentation", text: "Pre-operational assumptions logged with closure plans", status: "ok", meta: "6 logged · 2 closures pending", requiredAt: ["cc-ii", "cc-iii"], stages: ["pre_operational"], sr: ["POS-A13", "POS-D3"] },
  { id: "doc-trace", section: "Documentation", text: "Inputs traceable to source documents for every claim", status: "ok", requiredAt: ["cc-iii"], stages: ["both"], sr: ["POS-D1"] },
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
  "cc-ii": { applicable: 15, met: 11, warn: 3, blocked: 1, na: 1, percent: 73 },
  "cc-iii": { applicable: 18, met: 12, warn: 4, blocked: 1, na: 1, percent: 67 },
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
  { id: "DOC-01", name: "Aurora-1 Design Basis Document — Rev 4", kind: "doc", size: "12.4 MB", uploaded: "Mar 4", extracted: "Operating modes · RCS parameters · Barrier list", linked: 9 },
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
  POS_PROJECT,
  POS_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  CC_SCORES,
  POS_DOCUMENTS,
  POS_UI_STATE,
  EVOLUTION_UI,
};

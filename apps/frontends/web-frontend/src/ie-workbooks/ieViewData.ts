import { IE_SR_CATALOG, InitiatingEventCategory } from "interfaces-mef-types/ie/initiating-event-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface IeStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  warn?: boolean;
  terminal?: boolean;
}

const IE_STEPS: IeStep[] = [
  { id: "scope", num: "01", label: "Scope & Sources", sub: "PRA scope · radioactive sources", status: "idle" },
  { id: "states", num: "02", label: "Operating States", sub: "Imported from POS", status: "idle" },
  { id: "methods", num: "03", label: "Search Methods", sub: "Systematic methods", status: "idle" },
  { id: "identify", num: "04", label: "Identify Initiators", sub: "IE-A5 challenge spectrum", status: "idle" },
  { id: "completeness", num: "05", label: "Completeness Search", sub: "Per-system · experience", status: "idle" },
  { id: "hazards", num: "06", label: "Hazard-Induced", sub: "Hazards & combinations", status: "idle" },
  { id: "grouping", num: "07", label: "Grouping", sub: "Bounding cases", status: "idle" },
  { id: "screening", num: "08", label: "Screening", sub: "Barrier gate + SCR", status: "idle" },
  { id: "frequency", num: "09", label: "Frequency", sub: "Annual · POS-weighted", status: "idle" },
  { id: "draft", num: "10", label: "Draft", sub: "Produce IE report", status: "idle", terminal: true },
  { id: "review", num: "11", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "12", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type IePersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: IePersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const IE_PERSONAS: Record<IePersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = IE_STEPS.map((s) => s.id);
const IE_PERSONA_STEPS: Record<IePersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Bounding", description: "Coarse search, generic data, bounding grouping." },
  { id: "cc-ii", name: "CC-II", tag: "Plant-specific", description: "Plant-specific search and data, with uncertainty on risk-significant initiators." },
];

const CATEGORY_COLORS: Record<string, string> = {
  TRANSIENT: "oklch(0.55 0.13 300)",
  RCB_BREACH: "oklch(0.58 0.13 40)",
  INTERFACING_SYSTEMS_RCB_BREACH: "oklch(0.56 0.10 200)",
  SPECIAL: "oklch(0.55 0.10 260)",
  INTERNAL_HAZARD: "oklch(0.62 0.13 55)",
  EXTERNAL_HAZARD: "oklch(0.60 0.10 130)",
  HUMAN_FAILURE: "oklch(0.55 0.12 345)",
};

interface CategorySpec {
  id: InitiatingEventCategory;
  label: string;
  icon: string;
  blurb: string;
}

const INITIATOR_CATEGORIES: CategorySpec[] = [
  { id: InitiatingEventCategory.TRANSIENT, label: "Transient", icon: "Bolt", blurb: "Equipment- or human-induced events that disrupt the plant but leave the reactor coolant boundary intact." },
  { id: InitiatingEventCategory.RCB_BREACH, label: "RCB breach", icon: "Pipe", blurb: "Events causing a breach of the reactor coolant system with loss of coolant inventory or pressure." },
  { id: InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH, label: "Interfacing-systems breach", icon: "Network", blurb: "Failures in systems connected to the RCS that release coolant or bypass a radionuclide transport barrier." },
  { id: InitiatingEventCategory.SPECIAL, label: "Special initiators", icon: "Atom", blurb: "Support-system failures, instrument-line breaks, and events specific to a source of radioactive material." },
  { id: InitiatingEventCategory.INTERNAL_HAZARD, label: "Internal-hazard-induced", icon: "Flame", blurb: "Any of the above caused by an internal plant hazard (fire, flood, high-energy line break)." },
  { id: InitiatingEventCategory.EXTERNAL_HAZARD, label: "External-hazard-induced", icon: "Quake", blurb: "Any of the above caused by an external hazard (seismic, high winds, external flood, aircraft)." },
  { id: InitiatingEventCategory.HUMAN_FAILURE, label: "Human-failure-induced", icon: "Person", blurb: "Other categories of initiating events caused by at-initiator human failure events." },
];

function categoryById(id: string): CategorySpec | undefined {
  return INITIATOR_CATEGORIES.find((c) => c.id === id);
}

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
  A: "Identification (HLR-IE-A)",
  B: "Grouping (HLR-IE-B)",
  C: "Quantification (HLR-IE-C)",
  D: "Documentation (HLR-IE-D)",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(IE_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-IE-${meta.hlr}`,
      hlr: meta.hlr,
      text: code,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

export type {
  IeStep,
  StepStatus,
  IePersona,
  PersonaSpec,
  CapabilityCategory,
  CategorySpec,
  ConformanceItem,
  ConformanceStatus,
  Stage,
};

export {
  IE_STEPS,
  IE_PERSONAS,
  IE_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CATEGORY_COLORS,
  INITIATOR_CATEGORIES,
  CONFORMANCE_ITEMS,
  categoryById,
};

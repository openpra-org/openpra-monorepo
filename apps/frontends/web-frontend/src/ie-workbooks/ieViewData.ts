import { IE_SR_CATALOG, InitiatingEventCategory, type IeCompletenessSearch } from "interfaces-mef-types/ie/initiating-event-analysis";

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

interface MethodSpec {
  name: string;
  icon: string;
  scope: string;
  note: string;
  coverage: string;
  statusMessage?: string;
}

const METHOD_REGISTRY: Record<string, MethodSpec> = {
  MLD:     { name: "Master logic diagram",        icon: "Network", scope: "",                                                              coverage: "All 7 categories",    note: "Heat-removal, reactivity-control, and inventory branches expanded to component level." },
  FMEA:    { name: "FMEA",                         icon: "Sheet",   scope: "Each system to subsystem / train level (IE-A9, IE-A15)",       coverage: "Transient · Special", note: "Main and support systems swept. HAZOPS overlay on coupled systems." },
  HBFT:    { name: "Heat-balance fault trees",     icon: "Gauge",   scope: "",                                                              coverage: "Transient · RCB breach", note: "Power-conversion train modelled as a frequency-producing top event." },
  OEREV:   { name: "Operating-experience review",  icon: "History", scope: "Similar plants & comparable systems (IE-A8, IE-A11, IE-A14)", coverage: "Completeness check",  note: "Generic operating experience and similar-plant data reviewed.", statusMessage: "Experience review for one initiator class still open." },
  GENLIST: { name: "Generic initiator catalog",    icon: "Doc",     scope: "NUREG/CR-5750 + comparable catalogs",                          coverage: "Seed list",           note: "Generic list filtered for plant-specific applicability." },
};

function methodSpec(id: string): MethodSpec {
  return METHOD_REGISTRY[id] ?? { name: id, icon: "Network", scope: "", note: "", coverage: "" };
}

interface CompletenessCheckMeta {
  icon: string;
  detail: string;
  meta: (cs: IeCompletenessSearch) => string;
  na?: boolean;
}

const COMPLETENESS_CHECK_META: CompletenessCheckMeta[] = [
  { icon: "Layers",    detail: "Transient · RCB breach · interfacing · special · internal-hazard · external-hazard · human-failure", meta: (cs) => `${cs.functionalCategoriesCovered.length} / 7` },
  { icon: "Sheet",     detail: "FMEA carried to subsystem / train level for all modeled systems (IE-A9).", meta: () => "" },
  { icon: "Network",   detail: "DC power, instrument air, component cooling, service water, HVAC, cover-gas conditioning (IE-A15).", meta: () => "" },
  { icon: "Radiation", detail: "Escape mechanisms identified for all radioactive sources and tied to initiators (IE-A2).", meta: () => "" },
  { icon: "Group",     detail: "Multi-reactor / shared-source event applicability assessed (IE-A16, IE-B5).", meta: () => "" },
  { icon: "Branch",    detail: "Multiple-failure initiators — common cause, dependent-failure combinations, and correlated hardware failures — included in the identification search (IE-A9).", meta: () => "" },
  { icon: "Wrench",    detail: "Temporary plant alignments, maintenance configurations, and surveillance testing evolutions assessed as potential initiating-event precursors (IE-A9).", meta: () => "" },
];

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

const IE_SR_DESCRIPTIONS: Record<string, string> = {
  "IE-A1":  "Systematic methods used to identify initiating events",
  "IE-A2":  "Escape mechanisms identified for each radioactive source",
  "IE-A3":  "Plant-specific operating experience reviewed",
  "IE-A4":  "Pre-operational data and similar-plant experience reviewed",
  "IE-A5":  "All seven challenge categories evaluated",
  "IE-A6":  "Hazard combinations considered",
  "IE-A7":  "Initiator list updated for plant changes",
  "IE-A8":  "Similar-plant and generic operating experience reviewed",
  "IE-A9":  "Per-system and per-support-system search performed",
  "IE-A10": "Initiators identified for each source mobilisation path",
  "IE-A11": "Pre-operational similar-plant evidence reviewed",
  "IE-A12": "Beyond-design-basis initiators evaluated",
  "IE-A13": "Current-cycle plant-specific experience integrated",
  "IE-A14": "Pre-operational similar-plant evidence documented",
  "IE-A15": "Support-system failure initiators identified",
  "IE-A16": "Multi-unit initiating events addressed",
  "IE-A17": "Completeness of initiator list justified",
  "IE-A18": "Pre-operational completeness basis documented",
  "IE-B1":  "Grouping basis documented for each group",
  "IE-B2":  "Bounding case justified for each group",
  "IE-B3":  "Pre-operational grouping basis documented",
  "IE-B4":  "Grouping does not mask risk-significant sequences",
  "IE-B5":  "Multi-unit grouping addressed",
  "IE-B6":  "Pre-operational grouping conservatism justified",
  "IE-C1":  "Operational plant-specific frequency data used",
  "IE-C2":  "Pre-operational generic and design-based data used",
  "IE-C3":  "Generic data Bayesian-updated with plant experience",
  "IE-C4":  "Plant-specific operating data justified",
  "IE-C5":  "Pre-operational uncertainty characterised",
  "IE-C6":  "Frequencies updated for current plant conditions",
  "IE-C7":  "Pre-operational frequency basis justified",
  "IE-C8":  "POS time-fraction weighting applied",
  "IE-C9":  "Screening criteria applied with barrier-integrity gate",
  "IE-C10": "Screening decision justified for each screened event",
  "IE-C11": "Fault-tree model quantifies frequency (not probability)",
  "IE-C12": "HFE contributions to initiating-event frequency addressed",
  "IE-C13": "Operator contribution to initiating-event frequency estimated",
  "IE-C14": "Recovery actions included in frequency quantification where credited",
  "IE-C15": "Plant-specific recovery information used when available",
  "IE-C16": "Rare-event treatment applied for low-frequency initiators",
  "IE-C17": "Generic data comparison performed for all quantifications",
  "IE-C18": "Uncertainty characterised for risk-significant initiating-event frequencies",
  "IE-C19": "Component failure combinations included in fault-tree frequency models",
  "IE-D1":  "Initiating event analysis process documented",
  "IE-D2":  "Assumptions and limitations documented",
  "IE-D3":  "Pre-operational documentation meets PRA quality standards",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(IE_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-IE-${meta.hlr}`,
      hlr: meta.hlr,
      text: IE_SR_DESCRIPTIONS[code] ?? code,
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
  MethodSpec,
  CompletenessCheckMeta,
};

export {
  IE_STEPS,
  IE_PERSONAS,
  IE_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CATEGORY_COLORS,
  INITIATOR_CATEGORIES,
  CONFORMANCE_ITEMS,
  METHOD_REGISTRY,
  COMPLETENESS_CHECK_META,
  categoryById,
  methodSpec,
};

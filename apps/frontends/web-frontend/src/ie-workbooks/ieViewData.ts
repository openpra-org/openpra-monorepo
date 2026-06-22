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
  { id: "scope", num: "01", label: "Scope", sub: "PRA scope · radioactive sources", status: "idle" },
  { id: "methods", num: "02", label: "Search Methods", sub: "Systematic methods", status: "idle" },
  { id: "identify", num: "03", label: "Identify Initiators", sub: "IE-A5 challenge spectrum", status: "idle" },
  { id: "completeness", num: "04", label: "Completeness Search", sub: "Per-system · experience", status: "idle" },
  { id: "hazards", num: "05", label: "Hazard-Induced", sub: "Hazards & combinations", status: "idle" },
  { id: "grouping", num: "06", label: "Grouping", sub: "Bounding cases", status: "idle" },
  { id: "screening", num: "07", label: "Screening", sub: "Barrier gate + SCR", status: "idle" },
  { id: "frequency", num: "08", label: "Frequency", sub: "Annual · POS-weighted", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce IE report", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
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
  meta: (cs: { functionalCategoriesCovered: string[]; perSystemSearchPerformed: boolean; perSupportSystemSearchPerformed: boolean; multiReactorEventsAddressed: boolean; radioactiveSourceMechanismsAddressed: boolean }) => string;
  na?: boolean;
}

const COMPLETENESS_CHECK_META: CompletenessCheckMeta[] = [
  { icon: "Layers",    detail: "Transient · RCB breach · interfacing · special · internal-hazard · external-hazard · human-failure", meta: (cs) => `${cs.functionalCategoriesCovered.length} / 7` },
  { icon: "Sheet",     detail: "FMEA carried to subsystem / train level for all modeled systems (IE-A9).", meta: () => "" },
  { icon: "Network",   detail: "DC power, instrument air, component cooling, service water, HVAC, cover-gas conditioning (IE-A15).", meta: () => "" },
  { icon: "Radiation", detail: "Escape mechanisms identified for all radioactive sources and tied to initiators (IE-A2).", meta: () => "" },
  { icon: "Group",     detail: "Multi-reactor / shared-source event applicability assessed (IE-A16, IE-B5).", meta: () => "" },
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
  "IE-A1": "Initiating events challenging operation or safe shutdown identified by a structured, systematic, plant-specific process",
  "IE-A2": "Mechanisms that could mobilise each in-scope radioactive source identified and included",
  "IE-A3": "Operating plants: IE delineation consistent with the as-built / as-operated plant",
  "IE-A4": "Pre-operational: IE delineation consistent with available design information",
  "IE-A5": "All seven challenge categories considered (transient, RCB breach, interfacing-system breach, special, internal & external hazard, at-initiator HFE)",
  "IE-A6": "Hazard-combination initiators included (e.g. seismically-induced fire)",
  "IE-A7": "Operating plants: plant-specific IE experience reviewed across all operating states",
  "IE-A8": "Generic analyses and operating experience of similar plants reviewed for completeness",
  "IE-A9": "Each system and support system evaluated to subsystem / train level for IE potential (CC-II: structured FMEA / HAZOPS)",
  "IE-A10": "Multiple-failure initiators (common-cause, maintenance alignments) included in the systematic evaluation",
  "IE-A11": "Events that occurred at this and similar plants / systems across applicable states included",
  "IE-A12": "Identified events evaluated for overlooked initiators (CC-II: investigation, not just an interview)",
  "IE-A13": "Operating plants: operating experience reviewed for IE precursors and human-failure initiators",
  "IE-A14": "Pre-operational: similar-plant operating experience reviewed for IE precursors, where similar plants exist",
  "IE-A15": "System and support-system alignments, including temporary maintenance alignments, included in the IE search",
  "IE-A16": "Multi-reactor / multi-source initiators identified, with the reactors and sources each impacts",
  "IE-A17": "Model-uncertainty sources, assumptions & alternatives in IE identification identified (→ HLR-ESQ-E)",
  "IE-A18": "Pre-operational: assumptions from missing as-built / as-operated detail in IE identification logged",
  "IE-B1": "Grouping facilitates ES & ESQ and is justified not to change risk-significant sequences",
  "IE-B2": "A structured, systematic process used for grouping initiating events",
  "IE-B3": "Pre-operational: grouping detail consistent with available design information",
  "IE-B4": "Events grouped only when similar or bounded by worst-case, without impacting risk-significant sequences (CC-II)",
  "IE-B5": "Multi-reactor plants: IE groups impacting specific reactor / source combinations identified",
  "IE-B6": "Pre-operational: assumptions from missing as-built detail affecting IE grouping identified",
  "IE-C1": "Operating plants: IE frequency from generic + plant/design data representative of current performance",
  "IE-C2": "Pre-operational: IE frequency from generic, design-specific and similar-plant data",
  "IE-C3": "Operating plants: data representative of current design and performance used",
  "IE-C4": "Recovery actions included as appropriate and each justified (procedures / training)",
  "IE-C5": "Pre-operational: recovery actions included and justified consistent with the operating philosophy",
  "IE-C6": "Operating plants: generic + plant-specific data combined by a Bayesian (or equivalent) update",
  "IE-C7": "Pre-operational: relevant experience from other facilities used where NPP data are insufficient",
  "IE-C8": "Frequencies on a plant-calendar-year basis with the POS time fraction applied",
  "IE-C9": "Screening uses the barrier-integrity precondition plus the SCR criteria",
  "IE-C10": "Data ensured representative of plant design and operational performance",
  "IE-C11": "If fault-tree IE modelling is used, SY-A fault-tree rules applied and HFE contributions included",
  "IE-C12": "If fault-tree IE modelling is used, methods produce a failure frequency, with DA and HRA inputs",
  "IE-C13": "Control-room operator contribution to IE frequency estimated (split fractions where mixed)",
  "IE-C14": "Relevant failure-plus-unavailability combinations included in IE fault-tree models",
  "IE-C15": "Plant/design-specific information used in assessing and quantifying recovery actions",
  "IE-C16": "Plant/design-specific results compared with generic data as a reasonableness check",
  "IE-C17": "Rare initiating events use industry generic data, augmented for plant/design-specific features",
  "IE-C18": "Interfacing-system RCB-breach frequency reflects pathway configuration, interlocks, tests and isolation",
  "IE-C19": "Mean value and an uncertainty distribution provided for risk-significant initiators (CC-II)",
  "IE-D1": "IE process documented (inputs, methods, results) with full SR traceability",
  "IE-D2": "Model-uncertainty sources, assumptions & alternatives documented (IE-A17)",
  "IE-D3": "Pre-operational: assumptions & limitations from missing as-built detail documented",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(IE_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-IE-${meta.hlr}`,
      hlr: meta.hlr,
      text: `IE - ${code.slice("IE-".length)}: ${IE_SR_DESCRIPTIONS[code] ?? code}`,
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

import { MS_SR_CATALOG } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface MsStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  terminal?: boolean;
}

const MS_STEPS: MsStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Three elements converge", status: "idle" },
  { id: "categories", num: "02", label: "Release Categories", sub: "Define the bins (A)", status: "idle" },
  { id: "sources", num: "03", label: "Sources & Barriers", sub: "Inventory · retention (B)", status: "idle" },
  { id: "transport", num: "04", label: "Transport Phenomena", sub: "The physics checklist (B)", status: "idle" },
  { id: "sourceterm", num: "05", label: "Source Terms", sub: "Calculate the release (C)", status: "idle" },
  { id: "uncert", num: "06", label: "Uncertainty & Pre-op", sub: "Propagate phenomena (D)", status: "idle" },
  { id: "draft", num: "07", label: "Draft", sub: "Produce MS report (E)", status: "idle", terminal: true },
  { id: "review", num: "08", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "09", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type MsPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: MsPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const MS_PERSONAS: Record<MsPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · coordinates with the ES and consequence reviewers" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = MS_STEPS.map((s) => s.id);
const MS_PERSONA_STEPS: Record<MsPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Generic and characterized", description: "Use applicable generic source terms and inventories, with the uncertainty characterized per component." },
  { id: "cc-ii", name: "CC-II", tag: "Mechanistic and propagated", description: "Calculate plant-specific source terms for every risk-significant category, with the phenomena uncertainty propagated." },
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
  A: "Define release categories (HLR-A)",
  B: "Assess barriers and transport (HLR-B)",
  C: "Calculate the source term (HLR-C)",
  D: "Quantify the uncertainty (HLR-D)",
  E: "Document (HLR-E)",
};

const MS_SR_DESCRIPTIONS: Record<string, string> = {
  "MS-A1": "Ensure the release categories carry the full source-term attribute set for the consequence analysis",
  "MS-A2": "Confirm the category set is reasonably complete and consistent with the consequence requirements",
  "MS-A3": "Group by attribute similarity, finely enough at CC-II to differentiate the risk-significant contributors",
  "MS-A4": "Justify the release-termination time for each category",
  "MS-A5": "Identify a bounding sequence to represent each release category",
  "MS-B1": "Estimate generic inventories at CC-I or calculate plant-specific inventories at CC-II",
  "MS-B2": "Identify the barriers from each source to the environment for each category",
  "MS-B3": "Identify each barrier's failure modes",
  "MS-B4": "Determine the transport characteristics through each barrier",
  "MS-B5": "Address the transport-phenomena checklist, including the design-unique phenomena",
  "MS-B6": "Identify the model-uncertainty sources in the barrier and transport assessment",
  "MS-B7": "Log the pre-operational assumptions in the barrier and transport assessment",
  "MS-C1": "Use applicable generic source terms at CC-I or perform plant-specific analyses at CC-II",
  "MS-C2": "Justify the applicability of a borrowed source term, including any post-processing modifications",
  "MS-C3": "Perform the plant-specific calculation for every category with the potential to be risk-significant",
  "MS-C4": "Justify that the phenomena treatment suffices for the chosen consequence metric",
  "MS-C5": "Use validated codes within their applicability limits or a justified alternative",
  "MS-C6": "Identify the model-uncertainty sources in the source-term calculation",
  "MS-C7": "Log the pre-operational assumptions in the source-term calculation",
  "MS-D1": "Identify the uncertain inputs per representative family for each category",
  "MS-D2": "Give a point estimate at CC-I or a mean with a probabilistic representation for risk-significant categories at CC-II",
  "MS-D3": "Assess the consequence effects of the model uncertainties, individually or in combination",
  "MS-D4": "Characterize the per-category uncertainty at CC-I or propagate the distributions with phenomena dependencies at CC-II",
  "MS-E1": "Document the sources, the category bases, the assignment, the phenomena, the models and the uncertainty",
  "MS-E2": "Provide the quantitative source-term table with values and uncertainty for each category",
  "MS-E3": "Document the model-uncertainty sources and the sensitivity results",
  "MS-E4": "Document the pre-operational assumptions",
};

const MS_SR_META: Record<string, string> = {
  "MS-A1": "7 attributes",
  "MS-A3": "1 split open",
  "MS-A4": "3 categories",
  "MS-B1": "3 sources",
  "MS-B2": "3 barriers",
  "MS-B5": "12 phenomena",
  "MS-C3": "2 categories",
  "MS-C5": "3 models",
  "MS-D3": "3 sources",
  "MS-E2": "3 tables",
};

const MS_SR_LINKED_NM: Record<string, string> = {
  "MS-B4": "NM-082",
  "MS-D4": "NM-085",
  "MS-B2": "NM-088",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(MS_SR_CATALOG).map((code) => {
    const meta = MS_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const preOnly = meta.stages.length === 1 && meta.stages[0] === "PRE_OPERATIONAL";
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-MS-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${MS_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: MS_SR_META[code] ?? (preOnly ? "Pre-op" : undefined),
      linkedNM: MS_SR_LINKED_NM[code],
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

const MS_METHODS: Record<string, MethodSpec> = {
  depletion: { id: "depletion", abbr: "Depletion", name: "Isotopic depletion and inventory calculation", ref: "SAND ORIGEN methodology" },
  transport: { id: "transport", abbr: "Transport", name: "Mechanistic radionuclide transport calculation", ref: "Control-volume transport methods" },
  aerosol: { id: "aerosol", abbr: "Aerosol", name: "Aerosol dynamics and deposition calculation", ref: "NUREG/CR aerosol methods" },
  decay: { id: "decay", abbr: "Decay", name: "Decay and daughter-buildup calculation", ref: "ICRP-107 decay data" },
  thermal: { id: "thermal", abbr: "Thermal", name: "Release-timing and thermal-energy calculation", ref: "Severe-accident analysis methods" },
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

const MS_UPSTREAM_LINKS: LinkSpec[] = [
  { id: "pos", code: "POS", element: "Plant Operating States", icon: "Layers", workbook: "POS Workbook Example", version: 2, status: "approved", synced: "Apr 18, 2026", delivers: "The radioactive sources, the inventories and the barrier set", note: "POS supplies the source and barrier inventory MS builds the transport chain on.", role: "Inventory in" },
  { id: "es", code: "ES", element: "Event Sequence Analysis", icon: "Tree", workbook: "ES Workbook Example", version: 3, status: "approved", synced: "May 20, 2026", delivers: "The release-category definitions and the family end states", note: "ES defines the categories under ES-C1, and MS verifies their attributes are sufficient.", role: "Categories in" },
  { id: "esq", code: "ESQ", element: "Event Sequence Quantification", icon: "Function", workbook: "ESQ Workbook Example", version: 2, status: "in_review", synced: "May 22, 2026", delivers: "The family frequencies and the risk-significance of each category", note: "ESQ flags which release categories are risk-significant and earn full mechanistic treatment.", role: "Significance in" },
];

const MS_DOWNSTREAM_LINKS: LinkSpec[] = [
  { id: "rc", code: "RC", element: "Radiological Consequence", icon: "Wind", uses: "Receives the source-term table for each release category", note: "RC is the primary customer, consuming the species, timing, form and elevation MS calculates.", role: "Source term out" },
  { id: "ri", code: "RI", element: "Risk Integration", icon: "Gauge", uses: "Multiplies the ESQ frequency by what RC computes from the source term", note: "RI closes the risk equation by pairing the frequency with the consequence.", role: "Consequence out" },
];

interface AttributeSpec {
  id: string;
  label: string;
  note: string;
  icon: string;
}

const SOURCE_TERM_ATTRIBUTES: AttributeSpec[] = [
  { id: "att-a", label: "Sources and inventories", note: "The reactors and sources involved and their radionuclide inventories.", icon: "Atom" },
  { id: "att-b", label: "Initiator characteristics", note: "The initiating-event characteristics that affect the protective actions.", icon: "Bolt" },
  { id: "att-c", label: "Quantity per phase", note: "The quantity released by species for each release phase.", icon: "Sigma" },
  { id: "att-d", label: "Physical and chemical form", note: "The form by species, including the aerosol and the particle size.", icon: "Dust" },
  { id: "att-e", label: "Timing and warning", note: "The release timing, the multi-phase profile and the warning time.", icon: "Clock" },
  { id: "att-f", label: "Thermal energy", note: "The thermal energy carried by the release.", icon: "Thermo" },
  { id: "att-g", label: "Location and elevation", note: "The release location and the elevation.", icon: "Ruler" },
];

const TIMING_LABELS: Record<string, string> = { Early: "early", Delayed: "delayed", Late: "late" };
const MAGNITUDE_LABELS: Record<string, string> = { Negligible: "neg", Low: "low", Moderate: "mod", High: "high" };
const DIFFERENTIATION_LABELS: Record<string, string> = {
  CONSEQUENCE_METRIC: "Consequence metric",
  CONSEQUENCE_METRIC_AND_RISK_SIGNIFICANT_DIFFERENTIATION: "Metric and risk-significant split",
};
const CALC_BASIS_LABELS: Record<string, string> = {
  GENERIC_ESTIMATE: "Generic estimate",
  PLANT_SPECIFIC_CALCULATION: "Plant-specific calculation",
};
const RELEASE_FORM_LABELS: Record<string, string> = {
  ELEMENTAL: "Elemental",
  AEROSOL: "Aerosol",
  DUST: "Dust",
  OTHER: "Other",
};
const MECHANISM_SIGNIFICANCE_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const TRANSPORT_PHENOMENON_LABELS: Record<string, string> = {
  HEAT_GENERATION: "Heat generation",
  HEAT_REMOVAL: "Heat removal",
  GASEOUS_TRANSPORT: "Gaseous transport",
  SOLID_TRANSPORT: "Solid transport",
  INVENTORY_RELOCATION: "Inventory relocation",
  CHEMICAL_PHYSICAL_FORM: "Chemical and physical form",
  DEPOSITION: "Deposition",
  RESUSPENSION: "Resuspension",
  RADIONUCLIDE_DECAY_AND_BUILDUP: "Decay and buildup",
  EXPLOSION_EFFECTS: "Explosion effects",
  DESIGN_UNIQUE: "Design-unique phenomena",
  OTHER: "Other phenomena",
};

interface StBasisSpec {
  label: string;
  kind: "generic" | "mechanistic";
}

const ST_BASIS_LABELS: Record<string, StBasisSpec> = {
  GENERIC_APPLICABLE: { label: "Generic, applicable", kind: "generic" },
  PLANT_SPECIFIC_MECHANISTIC: { label: "Plant-specific, mechanistic", kind: "mechanistic" },
};

const PASS_FRACTIONS: Record<string, number> = {
  "BAR-1": 0.3,
  "BAR-2": 0.05,
  "BAR-3": 0.6,
};

const DESIGN_UNIQUE_NOTES: Record<string, string> = {
  "Sodium-air reaction aerosol generation": "The sodium fire generates an aerosol that adds to the airborne load and the thermal energy.",
  "Sodium-concrete interaction gas release": "The sodium-concrete reaction releases gas that can carry material if the pool contacts the structure.",
};

const PHENOMENA_MODELS_USED = ["transport", "aerosol", "thermal"];

const MODEL_METHOD: Record<string, string> = {
  "MOD-1": "transport",
  "MOD-2": "aerosol",
  "MOD-3": "depletion",
};

const A3_SPLIT = {
  cci: {
    title: "Group to support the consequence metric",
    desc: "Group by the similarity of the A1 attributes, differentiated enough to support the consequence metric.",
    tag: "Coarse bins where nothing matters",
  },
  ccii: {
    title: "Split to differentiate risk-significant contributors",
    desc: "Group finely enough to differentiate the risk-significant contributors that ESQ flagged.",
    tag: "Fine bins where risk lives",
  },
  note: "Coarse bins are used where nothing matters, and fine bins are used where the risk concentrates.",
};

const C_LADDER = {
  cci: {
    title: "Use applicable generic source terms",
    desc: "Use applicable generic source-term characteristics, with the applicability justified including any post-processing modifications.",
    tag: "Borrowed and justified",
  },
  ccii: {
    title: "Perform plant-specific calculations",
    desc: "Perform plant-specific analyses for every release category with the potential to be risk-significant.",
    tag: "Mechanistic where risk lives",
  },
  note: "For a novel design an applicable generic source term often does not exist, which quietly forces the plant-specific calculation.",
};

const D2_SPLIT = {
  cci: {
    title: "Point estimate plus characterization",
    desc: "Give a point estimate and a characterized uncertainty for each source-term component.",
    tag: "One value, uncertainty described",
  },
  ccii: {
    title: "Mean plus probabilistic for risk-significant",
    desc: "Give a mean and a full probabilistic representation per component for the risk-significant categories.",
    tag: "Distribution where risk lives",
  },
  note: "Expert judgment is used per the standard's process where the data do not support a direct estimate.",
};

const PA_SR: Record<string, string> = {
  "PA-1": "MS-B7",
  "PA-2": "MS-C7",
  "PA-3": "MS-E4",
};

const SS_SR: Record<string, string> = {
  "SS-1": "MS-D3",
  "SS-2": "MS-B5",
  "SS-3": "MS-A4",
};

const MS_TOC: [string, string][] = [
  ["Executive Summary", "4"],
  ["Introduction", "5"],
  ["    Purpose, Scope & Relationship", "5"],
  ["    Document Layout", "5"],
  ["    Quality Assurance & Freeze Date", "5"],
  ["Assumptions and Limitations", "6"],
  ["Sources of Radioactive Material", "7"],
  ["Release Categories", "8"],
  ["    Definitions of Release Categories", "8"],
  ["    Assignment of Families to Categories", "8"],
  ["Radionuclide Transport Barriers", "9"],
  ["Radionuclide Transport Phenomena", "10"],
  ["    Modeling and Simulation Codes", "10"],
  ["    Selected Radioisotopes", "10"],
  ["Results", "11"],
  ["Uncertainties Analysis", "12"],
  ["Sensitivity Analyses", "13"],
  ["References", "14"],
];

export type {
  MsStep,
  StepStatus,
  MsPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  MethodSpec,
  LinkSpec,
  AttributeSpec,
};

export {
  MS_STEPS,
  MS_PERSONAS,
  MS_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  MS_METHODS,
  MS_UPSTREAM_LINKS,
  MS_DOWNSTREAM_LINKS,
  SOURCE_TERM_ATTRIBUTES,
  TIMING_LABELS,
  MAGNITUDE_LABELS,
  DIFFERENTIATION_LABELS,
  CALC_BASIS_LABELS,
  RELEASE_FORM_LABELS,
  MECHANISM_SIGNIFICANCE_LABELS,
  TRANSPORT_PHENOMENON_LABELS,
  ST_BASIS_LABELS,
  PASS_FRACTIONS,
  DESIGN_UNIQUE_NOTES,
  PHENOMENA_MODELS_USED,
  MODEL_METHOD,
  A3_SPLIT,
  C_LADDER,
  D2_SPLIT,
  PA_SR,
  SS_SR,
  MS_TOC,
};

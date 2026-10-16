import { SC_SR_CATALOG } from "interfaces-mef-types/sc/success-criteria-development";

type StepStatus = "complete" | "in-progress" | "idle";

interface ScStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  warn?: boolean;
  terminal?: boolean;
}

const SC_STEPS: ScStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Inputs · barriers", status: "idle" },
  { id: "stable", num: "02", label: "End States", sub: "Endpoints · release categories", status: "idle" },
  { id: "criteria", num: "03", label: "Success Criteria", sub: "Function by event by state", status: "idle" },
  { id: "mission", num: "04", label: "Mission Times", sub: "24 hour rule · components", status: "idle" },
  { id: "bases", num: "05", label: "Engineering Bases", sub: "Analyses · codes · barriers", status: "idle" },
  { id: "passive", num: "06", label: "Passive Reliability", sub: "Mechanistic models", status: "idle" },
  { id: "consistency", num: "07", label: "Consistency", sub: "Plant fit · uncertainty", status: "idle" },
  { id: "handoff", num: "08", label: "Technical Element Handoff", sub: "Exported sections", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce SC report", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type ScPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: ScPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const SC_PERSONAS: Record<ScPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = SC_STEPS.map((s) => s.id);
const SC_PERSONA_STEPS: Record<ScPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Generic", description: "Criteria from generic analyses that apply to the reactor type, with conservative barrier and mission-time treatment." },
  { id: "cc-ii", name: "CC-II", tag: "Design-specific", description: "Realistic, design-specific criteria for risk-significant sequences, with explicit margin and uncertainty assessment." },
];

type Tone = "ok" | "warn" | "block";

interface AnalysisTypeSpec {
  label: string;
  icon: string;
}

const SC_ANALYSIS_TYPES: Record<string, AnalysisTypeSpec> = {
  THERMAL_HYDRAULIC: { label: "Thermal-fluid", icon: "Thermo" },
  STRUCTURAL: { label: "Structural", icon: "Ruler" },
  NEUTRONIC: { label: "Neutronic", icon: "Atom" },
  RADIATION_TRANSPORT: { label: "Source term", icon: "Radiation" },
  OTHER: { label: "Other", icon: "Settings" },
};

const SC_RC_TONES: Record<string, Tone> = {
  "RC-1": "block",
  "RC-2": "warn",
  "RC-3": "warn",
};

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
  A: "Declare the criteria (HLR-SC-A)",
  B: "Justify with engineering (HLR-SC-B)",
  C: "Documentation (HLR-SC-C)",
};

const SC_SR_DESCRIPTIONS: Record<string, string> = {
  "SC-A1": "Safe stable state defined with a basis, as the endpoint of every non-release sequence",
  "SC-A2": "End states use the MS release-category definitions, with any plant-damage states specified",
  "SC-A3": "Plant parameters and thresholds that decide end states specified, with explicit margin at CC-II",
  "SC-A4": "Parameters and criteria protecting each radionuclide transport barrier specified",
  "SC-A5": "Success criteria for each key safety function, per initiating event, per operating state",
  "SC-A6": "Shared mitigating systems and their behavior under a common initiator identified",
  "SC-A7": "Mission time set, with a 24 hour minimum for sequences reaching a safe stable state",
  "SC-A8": "Component mission times support the sequence mission time, or the shorter time is justified",
  "SC-A9": "Criteria consistent with the plant features, procedures and operating philosophy",
  "SC-A10": "Model-uncertainty sources and assumptions in the criteria identified",
  "SC-A11": "Pre-operational design-gap assumptions in the criteria logged",
  "SC-B1": "Criteria from realistic design-specific analyses for risk-significant sequences at CC-II",
  "SC-B2": "Where information is lacking, the formal expert-judgment process of Section 4.2 is applied",
  "SC-B3": "Analyses match the level of detail of the IE grouping, POS definitions and ES modeling",
  "SC-B4": "Validated codes with an accepted V&V process and demonstrated applicability used",
  "SC-B5": "Passive functions use mechanistic models with characterized model and input uncertainty",
  "SC-B6": "Loads on each barrier and the parameters defining its capacity defined",
  "SC-B7": "Barrier evaluation method conservative at CC-I, realistic with uncertainty at CC-II",
  "SC-B8": "Engineering results checked to be reasonable and acceptable",
  "SC-B9": "Model-uncertainty sources in the engineering bases identified",
  "SC-B10": "Pre-operational assumptions in the engineering bases identified",
  "SC-C1": "SC process documented with end states, criteria, mission times, analyses and interfaces",
  "SC-C2": "Model-uncertainty sources documented, citing SC-A10 and SC-B9",
  "SC-C3": "Pre-operational limitations documented, citing SC-A11 and SC-B10",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(SC_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-SC-${meta.hlr}`,
      hlr: meta.hlr,
      text: `SC - ${code.slice("SC-".length)}: ${SC_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();


const SC_END_STATE_NAMES: Record<string, string> = {
  SSS: "Safe stable state",
  "RC-1": "Early release",
  "RC-2": "Late filtered release",
  "RC-3": "Intact-confinement leakage",
};


export type {
  ScStep,
  StepStatus,
  ScPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  Tone,
  AnalysisTypeSpec,
};

export {
  SC_STEPS,
  SC_PERSONAS,
  SC_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  SC_ANALYSIS_TYPES,
  SC_RC_TONES,
  SC_END_STATE_NAMES,
};

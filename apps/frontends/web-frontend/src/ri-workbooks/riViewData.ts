import { RI_SR_CATALOG } from "interfaces-mef-types/ri/risk-integration";

type StepStatus = "complete" | "in-progress" | "idle";
type HlrTone = "a" | "b" | "c" | "d";

interface RiStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  hlr?: string;
  hlrTone?: HlrTone;
  terminal?: boolean;
}

const RI_STEPS: RiStep[] = [
  { id: "converge", num: "01", hlr: "B", hlrTone: "b", label: "Scope", sub: "Compile the two pipelines", status: "idle" },
  { id: "criteria", num: "02", hlr: "A", hlrTone: "a", label: "Significance Criteria", sub: "Set the yardsticks", status: "idle" },
  { id: "integrate", num: "03", hlr: "B", hlrTone: "b", label: "Integrate & Compute", sub: "Total and plot", status: "idle" },
  { id: "aggregate", num: "04", hlr: "B", hlrTone: "b", label: "Aggregation & Contributors", sub: "Judge the totals", status: "idle" },
  { id: "uncertainty", num: "05", hlr: "C", hlrTone: "c", label: "Risk Uncertainty", sub: "Own the spread", status: "idle" },
  { id: "feedback", num: "06", hlr: "D", hlrTone: "d", label: "Feedback & Dispatch", sub: "Close the loop", status: "idle" },
  { id: "draft", num: "07", label: "Draft", sub: "Produce RI report", status: "idle", terminal: true },
  { id: "review", num: "08", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "09", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type RiPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: RiPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const RI_PERSONAS: Record<RiPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · the team overlaps with the ES, ESQ, MS and RC reviewers" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = RI_STEPS.map((s) => s.id);
const RI_PERSONA_STEPS: Record<RiPersona, string[]> = {
  preparer: ALL_STEP_IDS,
  reviewer: ALL_STEP_IDS.filter((id) => id !== "approval"),
  approver: ALL_STEP_IDS,
};

interface CapabilityCategory {
  id: string;
  name: string;
  tag: string;
  description: string;
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  { id: "cc-i", name: "CC-I", tag: "Point estimate", description: "Calculate the risk with point estimates and characterize the uncertainty range." },
  { id: "cc-ii", name: "CC-II", tag: "Mean and propagated", description: "Quantify with means, draw the exceedance-frequency curve, and propagate the distributions." },
];

type PlantStageId = "pre_operational" | "operational";

interface PlantStageOption {
  id: PlantStageId;
  name: string;
  description: string;
}

const PLANT_STAGES: PlantStageOption[] = [
  { id: "pre_operational", name: "Pre-operational", description: "Plant-response data comes from general or design calculations, with gaps from the not-yet-built plant written down as assumptions." },
  { id: "operational", name: "Operational", description: "Real data and procedures from the running plant are available to confirm the integrated risk results." },
];

type AppTypeId = "fixed_risk_target" | "baseline_risk";

interface ApplicationTypeSpec {
  id: AppTypeId;
  name: string;
  tag: string;
  sr: string;
  desc: string;
}

const APPLICATION_TYPES: ApplicationTypeSpec[] = [
  {
    id: "fixed_risk_target",
    name: "Fixed-risk-target application",
    tag: "Absolute criteria",
    sr: "RI-A3",
    desc: "Judge the risk against absolute targets, with a frequency-consequence target for the application.",
  },
  {
    id: "baseline_risk",
    name: "Baseline-risk application",
    tag: "Relative criteria",
    sr: "RI-A2",
    desc: "Rank the risk by relative significance, accounting for both frequency and consequence.",
  },
];

type ConformanceStatus = "ok" | "warn" | "blocked" | "na";

interface ConformanceItem {
  id: string;
  section: string;
  hlr: string;
  text: string;
  status: ConformanceStatus;
  requiredAt: string[];
  appOnly?: AppTypeId;
  meta?: string;
  linkedNM?: string;
}

const HLR_SECTIONS: Record<string, string> = {
  A: "Risk-significance criteria (HLR-RI-A)",
  B: "Integrated risk (HLR-RI-B)",
  C: "Risk uncertainty (HLR-RI-C)",
  D: "Documentation (HLR-RI-D)",
};

const HLR_TONES: Record<string, HlrTone> = { A: "a", B: "b", C: "c", D: "d" };

const RI_SR_DESCRIPTIONS: Record<string, string> = {
  "RI-A1": "Define the consequence measures for the intended applications",
  "RI-A2": "Define relative risk-significance criteria accounting for frequency and consequence",
  "RI-A3": "Define absolute risk-significance criteria against the frequency-consequence target",
  "RI-A4": "Set the minimum reporting frequency or justify an alternative",
  "RI-A5": "Set the minimum reporting consequence or justify an alternative",
  "RI-B1": "Compile the family frequencies from ESQ and the consequences from RC",
  "RI-B2": "Calculate point estimates at CC-I or quantify with means and the exceedance curve at CC-II",
  "RI-B3": "Identify each source and hazard contribution and review the conservatism differences",
  "RI-B4": "Include the multi-reactor and multi-source release contributions",
  "RI-B5": "Justify that the within-family variations are not risk-significant",
  "RI-B6": "Identify the risk-significant contributors at an insight-grade level",
  "RI-B7": "Identify the codes and their limits across every hazard, state, category and sequence",
  "RI-C1": "Compile the key model uncertainties from every element, screened-out items included",
  "RI-C2": "Review the grouping uncertainty so it does not make a family artificially significant",
  "RI-C3": "Assess the compiled uncertainties against each metric",
  "RI-C4": "Characterize the range at CC-I or propagate the distributions with correlation at CC-II",
  "RI-D1": "Document the criteria, results, insights and traceability to the contributors",
  "RI-D2": "Document the model-uncertainty sources, assumptions and alternatives",
};

const RI_SR_META: Record<string, string> = {
  "RI-A1": "3 measures",
  "RI-A4": "1E-7 per yr",
  "RI-B1": "5 families",
  "RI-B3": "Aggregation honesty",
  "RI-B5": "Anti-masking",
  "RI-B6": "6 contributors",
  "RI-C1": "10 sources",
};

const RI_SR_APP_ONLY: Record<string, AppTypeId> = {
  "RI-A2": "baseline_risk",
  "RI-A3": "fixed_risk_target",
};

const RI_SR_LINKED_NM: Record<string, string> = {
  "RI-B3": "NM-101",
  "RI-C4": "NM-104",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(RI_SR_CATALOG).map((code) => {
    const meta = RI_SR_CATALOG[code];
    const appOnly = RI_SR_APP_ONLY[code];
    return {
      id: code,
      section: HLR_SECTIONS[meta.hlr] ?? `HLR-RI-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${RI_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      appOnly,
      meta: RI_SR_META[code] ?? (appOnly === "baseline_risk" ? "Baseline-risk only" : appOnly === "fixed_risk_target" ? "Fixed-risk-target only" : undefined),
      linkedNM: RI_SR_LINKED_NM[code],
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface LinkSpec {
  id: string;
  code: string;
  element: string;
  icon: string;
  tone: "freq" | "cons";
  role: string;
  workbook: string;
  version: number;
  status: string;
  synced: string;
  delivers: string;
  count: string;
  note: string;
}

const RI_UPSTREAM_LINKS: LinkSpec[] = [
  {
    id: "esq",
    code: "ESQ",
    element: "Event Sequence Quantification",
    icon: "Tree",
    tone: "freq",
    role: "Frequency jaw",
    workbook: "ESQ Workbook Example",
    version: 2,
    status: "approved",
    synced: "May 30, 2026",
    delivers: "The event sequence family frequencies with their distributions",
    count: "5 families",
    note: "ESQ-D delivers the family frequencies, which RI-B1 compiles as the frequency side.",
  },
  {
    id: "rc",
    code: "RC",
    element: "Radiological Consequence",
    icon: "Wind",
    tone: "cons",
    role: "Consequence jaw",
    workbook: "RC Workbook Example",
    version: 1,
    status: "in_review",
    synced: "May 28, 2026",
    delivers: "The family-by-family consequence table by metric",
    count: "3 categories",
    note: "RCQ-D delivers the consequence table, which RI-B1 compiles as the consequence side.",
  },
];

const SCOPE_POS_TEXT = "All modeled plant operating states, at-power and shutdown.";
const SCOPE_NOTE = "The single-unit single-source scope keeps the multi-reactor and multi-source terms recorded but not driving.";

const REPORTING_FLOOR_NOTES = {
  frequency: "Below this frequency the PRA limitations make the number unreliable.",
  consequence: "Below this dose the result sits within the noise of natural background.",
};

const FC_META = {
  xMin: 1e-7,
  xMax: 1e0,
  yMin: 1e-9,
  yMax: 1e-4,
  targetFrom: { dose: 1e-5, freq: 1e-4 },
  targetTo: { dose: 1e0, freq: 1e-8 },
};

const CCDF_NOTE = "The curve shows the frequency of exceeding each dose level, drawn at CC-II.";

const REGISTER_SIDE: Record<string, string> = {
  POS: "Scope",
  IE: "Frequency side",
  ES: "Frequency side",
  SC: "Frequency side",
  SY: "Frequency side",
  HR: "Frequency side",
  DA: "Frequency side",
  ESQ: "Frequency side",
  MS: "Consequence side",
  RC: "Consequence side",
};

const ELEMENT_CODE_BY_TYPE: Record<string, string> = {
  "plant-operating-states-analysis": "POS",
  "initiating-event-analysis": "IE",
  "event-sequence-analysis": "ES",
  "success-criteria-development": "SC",
  "systems-analysis": "SY",
  "human-reliability-analysis": "HR",
  "data-analysis": "DA",
  "event-sequence-quantification": "ESQ",
  "mechanistic-source-term-analysis": "MS",
  "consequence-analysis": "RC",
};

const ELEMENT_NAME_BY_CODE: Record<string, string> = {
  POS: "Plant Operating States",
  IE: "Initiating Events",
  ES: "Event Sequence Analysis",
  SC: "Success Criteria",
  SY: "Systems Analysis",
  HR: "Human Reliability",
  DA: "Data Analysis",
  ESQ: "Event Sequence Quantification",
  MS: "Mechanistic Source Term",
  RC: "Radiological Consequence",
};

const RI_TOC: [string, string][] = [
  ["Executive Summary", "5"],
  ["Introduction", "6"],
  ["    Purpose, Scope & Relationship", "6"],
  ["    Document Layout", "6"],
  ["    Quality Assurance & Freeze Date", "6"],
  ["Assumptions and Limitations", "7"],
  ["Risk Criteria for the Safety Case", "8"],
  ["Methodology", "9"],
  ["    Frequency-Consequence Target for Individual LBEs", "9"],
  ["    Cumulative Targets for Integrated Risk", "9"],
  ["    Risk Significance Criteria for LBEs", "9"],
  ["    Risk Significance Criteria for SSCs", "9"],
  ["    Risk Significance Criteria for other PRA Items", "9"],
  ["Results", "10"],
  ["    Frequencies and Consequences of Individual LBEs", "10"],
  ["    Cumulative Risk Results", "10"],
  ["    Risk Significant LBEs", "10"],
  ["    Risk Significant SSCs", "10"],
  ["    Other Risk Significant PRA Items", "10"],
  ["Risk Insights and Recommendations", "11"],
  ["References", "12"],
];

export type {
  RiStep,
  StepStatus,
  HlrTone,
  RiPersona,
  PersonaSpec,
  CapabilityCategory,
  AppTypeId,
  ApplicationTypeSpec,
  ConformanceItem,
  ConformanceStatus,
  LinkSpec,
};

export {
  RI_STEPS,
  RI_PERSONAS,
  RI_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  PLANT_STAGES,
  type PlantStageId,
  APPLICATION_TYPES,
  CONFORMANCE_ITEMS,
  HLR_SECTIONS,
  HLR_TONES,
  RI_SR_LINKED_NM,
  RI_UPSTREAM_LINKS,
  SCOPE_POS_TEXT,
  SCOPE_NOTE,
  REPORTING_FLOOR_NOTES,
  FC_META,
  CCDF_NOTE,
  REGISTER_SIDE,
  ELEMENT_CODE_BY_TYPE,
  ELEMENT_NAME_BY_CODE,
  RI_TOC,
};

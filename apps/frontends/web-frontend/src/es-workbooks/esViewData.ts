import { ES_SR_CATALOG } from "interfaces-mef-types/es/event-sequence-analysis";

type StepStatus = "complete" | "in-progress" | "idle";

interface EsStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  warn?: boolean;
  terminal?: boolean;
}

const ES_STEPS: EsStep[] = [
  { id: "scope",     num: "01", label: "Scope & Safety Functions", sub: "IEs · POS · barriers · key safety functions", status: "idle" },
  { id: "sequences", num: "02", label: "Event Sequences",          sub: "Lay out sequences per IE",                   status: "idle" },
  { id: "deps",      num: "03", label: "Dependencies",             sub: "Functional · human · phenomena",             status: "idle" },
  { id: "timing",    num: "04", label: "Timing & Phenomena",       sub: "Mission times · time windows",               status: "idle" },
  { id: "endstates", num: "05", label: "End States & Releases",    sub: "Safe state · release categories",            status: "idle" },
  { id: "families",  num: "06", label: "Sequence Families",        sub: "Group sequences for ESQ",                    status: "idle" },
  { id: "screening", num: "07", label: "Screening",                sub: "SCR-3 · retain by default",                  status: "idle" },
  { id: "quant",     num: "08", label: "Quantification",           sub: "Mean frequency · hand-off",                  status: "idle" },
  { id: "draft",     num: "09", label: "Draft",                    sub: "Produce ES report",                          status: "idle", terminal: true },
  { id: "review",    num: "10", label: "Review",                   sub: "Reviewer comments",                          status: "idle", terminal: true },
  { id: "approval",  num: "11", label: "Approval",                 sub: "Everyone signs",                             status: "idle", terminal: true },
];

type EsPersona = "preparer" | "reviewer" | "approver";

const ALL_STEP_IDS = ES_STEPS.map((s) => s.id);
const ES_PERSONA_STEPS: Record<EsPersona, string[]> = {
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
  { id: "cc-i",  name: "CC-I",  tag: "Bounding",       description: "Worst-case plant-response work, general data, and rough sequences." },
  { id: "cc-ii", name: "CC-II", tag: "Plant-specific",  description: "Realistic, design-specific plant response, with risk-significant sequences kept separate." },
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
  A: "Scenario development (HLR-ES-A)",
  B: "Dependencies (HLR-ES-B)",
  C: "End states & releases (HLR-ES-C)",
  D: "Documentation (HLR-ES-D)",
};

const ES_SR_DESCRIPTIONS: Record<string, string> = {
  "ES-A1":  "ES-A1 — Method models system + operator combinations per IE, evolution & POS, defines sequences clearly, and frames ESQ",
  "ES-A2":  "ES-A2 — Radionuclide transport barriers identified for every source in scope",
  "ES-A3":  "ES-A3 — Key reactor-specific safety functions identified per IE and source",
  "ES-A4":  "ES-A4 — Operator actions needed to meet each safety-function success criterion (SC-A5) identified",
  "ES-A5":  "ES-A5 — Model consistent with the plant/design transient response, crediting EOPs and other procedures",
  "ES-A6":  "ES-A6 — Functional events ordered by timing in the progression, or rationale provided",
  "ES-A7":  "ES-A7 — Sequences delineated for each IE and any not meeting SCR-3 retained",
  "ES-A8":  "ES-A8 — End state defined as a release category or a safe stable state below the RI-A5 level",
  "ES-A9":  "ES-A9 — Reactors and sources of radioactive material involved captured in the end-state definition",
  "ES-A10": "ES-A10 — Realistic, design-specific T/H analyses used for event-progression parameters (CC-II)",
  "ES-A11": "ES-A11 — Plant-response analysis performed at a level of detail matching the design information",
  "ES-A12": "ES-A12 — Risk-significant differences in system/operator requirements modelled separately (CC-II)",
  "ES-A13": "ES-A13 — Intermediate end states and transfers defined so all dependencies are preserved",
  "ES-A14": "ES-A14 — Model-uncertainty sources, assumptions & reasonable alternatives identified (→ HLR-ESQ-E)",
  "ES-A15": "ES-A15 — Pre-operational: assumptions from missing as-built / as-operated detail logged",
  "ES-B1":  "ES-B1 — Systems/barriers challenged, degraded or failed by each initiator identified and their impact included",
  "ES-B2":  "ES-B2 — Dependence of mitigating systems on preceding systems, functions & human actions identified",
  "ES-B3":  "ES-B3 — Phenomenological (harsh-environment) conditions each sequence creates identified and their impact included",
  "ES-B4":  "ES-B4 — Dependent event placed to the left of the event it conditions in split-fraction ordering, or rationale given",
  "ES-B5":  "ES-B5 — Sequences developed to capture inter-system dependencies and train-level interfaces",
  "ES-B6":  "ES-B6 — Dependency detail consistent with available design info; assumptions logged where information is missing",
  "ES-B7":  "ES-B7 — Plant configurations and maintenance practices that create or alter dependencies modelled",
  "ES-B8":  "ES-B8 — Time-phased dependencies that change as the event progresses modelled",
  "ES-B9":  "ES-B9 — Model-uncertainty sources, assumptions & alternatives in the dependency analysis identified",
  "ES-B10": "ES-B10 — Pre-operational: dependency assumptions from missing as-built / as-operated detail identified",
  "ES-C1":  "ES-C1 — End states defined to resolve families, with safe-stable states and release categories (→ HLR-MS-A)",
  "ES-C2":  "ES-C2 — Physical release characteristics that drive the mechanistic source term identified",
  "ES-C3":  "ES-C3 — Event-sequence characteristics that lead to those physical characteristics identified",
  "ES-C4":  "ES-C4 — Each characteristic shown to be addressed, or its exclusion justified as non-risk-significant",
  "ES-C5":  "ES-C5 — Development method explicitly accounts for the ES-C2/C3 characteristics and their dependencies",
  "ES-C6":  "ES-C6 — Any plant-damage-state interfaces defined consistent with ES-C2…C5",
  "ES-C7":  "ES-C7 — Supporting plant-response analyses used per the CC-II SRs of HLR-SC-A and HLR-SC-B",
  "ES-C8":  "ES-C8 — Sequences developed to the detail needed to resolve each family, consistent with the MS calculations",
  "ES-C9":  "ES-C9 — If repair is credited, risk-significant sequences reviewed and the repair-failure credit justified",
  "ES-C10": "ES-C10 — Model-uncertainty sources, assumptions & alternatives in the transport analysis identified",
  "ES-C11": "ES-C11 — Pre-operational: transport-analysis assumptions from missing as-built detail identified",
  "ES-D1":  "ES-D1 — ES process documented (inputs, methods, results) with full SR traceability",
  "ES-D2":  "ES-D2 — Model-uncertainty sources, assumptions & alternatives documented (ES-A14, B9, C10)",
  "ES-D3":  "ES-D3 — Pre-operational: assumptions & limitations from missing as-built detail documented",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(ES_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code.toLowerCase().replace(/-/g, "-"),
      section: HLR_SECTION[meta.hlr] ?? `HLR-ES-${meta.hlr}`,
      hlr: meta.hlr,
      text: ES_SR_DESCRIPTIONS[code] ?? code,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

function stepsForPersona(persona: EsPersona): EsStep[] {
  const ids = ES_PERSONA_STEPS[persona];
  return ES_STEPS.filter((s) => ids.includes(s.id));
}

function stepIndexById(id: string): number {
  return ES_STEPS.findIndex((s) => s.id === id);
}

export type {
  EsStep,
  StepStatus,
  EsPersona,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
};

export {
  ES_STEPS,
  ES_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  stepsForPersona,
  stepIndexById,
};

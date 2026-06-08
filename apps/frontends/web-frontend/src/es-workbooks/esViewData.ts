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
  { id: "scope", num: "01", label: "Scope & Sources", sub: "IEs · POS · barriers · key safety functions", status: "idle" },
  { id: "sequences", num: "02", label: "Event Sequences", sub: "Lay out sequences per IE", status: "idle" },
  { id: "deps", num: "03", label: "Dependencies", sub: "Functional · human · phenomena", status: "idle" },
  { id: "timing", num: "04", label: "Timing & Phenomena", sub: "Mission times · time windows", status: "idle" },
  { id: "endstates", num: "05", label: "End States & Releases", sub: "Safe state · release categories", status: "idle" },
  { id: "families", num: "06", label: "Sequence Families", sub: "Group sequences for ESQ", status: "idle" },
  { id: "screening", num: "07", label: "Screening", sub: "SCR-3 · retain by default", status: "idle" },
  { id: "quant", num: "08", label: "ESQ", sub: "Package for ESQ", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce ES report", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type EsPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: EsPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const ES_PERSONAS: Record<EsPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · marks comments resolved" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = ES_STEPS.map((s) => s.id);
const ES_PERSONA_STEPS: Record<EsPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Bounding", description: "Worst-case plant-response work, general data, and rough sequences." },
  { id: "cc-ii", name: "CC-II", tag: "Plant-specific", description: "Realistic, design-specific plant response, with risk-significant sequences kept separate." },
];

interface UpstreamMeta {
  element: string;
  short: string;
  icon: string;
  delivers: string;
}

const ES_UPSTREAM_META: Record<"ie" | "pos", UpstreamMeta> = {
  ie: { element: "Initiating Event Analysis", short: "IE", icon: "Bolt", delivers: "Initiating-event groups plus single events kept on their own" },
  pos: { element: "Plant Operating States", short: "POS", icon: "Layers", delivers: "Operating states with time fractions" },
};

const ES_POS_NAMES: Record<string, string> = {
  "POS-01": "Full power, normal alignment",
  "POS-02": "Load-follow (reduced power)",
  "POS-03": "Hot standby",
  "POS-04": "Cooled, head intact",
  "POS-05": "Head off, cavity dry",
  "POS-06": "Fuel-handling mode",
  "POS-07": "Post-trip cooldown (DRACS)",
  "POS-08": "IHX loop drained, primary hot",
  "POS-09": "Cover-gas adjustment",
};

const ES_IE_POS_COVERAGE: Record<string, string[]> = {
  "IEG-LOHS": ["POS-01", "POS-02", "POS-03", "POS-08"],
  "IEG-RCB": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"],
  "IEG-LOFA": ["POS-01", "POS-02", "POS-03"],
  "IEG-TRANS": ["POS-01", "POS-02", "POS-03", "POS-04", "POS-07"],
  "IE-11": ["POS-01", "POS-06", "POS-09"],
  "IE-15": ["POS-01", "POS-08"],
  "IE-17": ["POS-01"],
  "IE-18": ["POS-04", "POS-05"],
};

interface SourceSpec {
  id: string;
  name: string;
  barriers: string[];
  note: string;
}

const ES_SOURCE_CATALOG: Record<string, SourceSpec> = {
  "SRC-1": { id: "SRC-1", name: "In-core fuel", barriers: ["Cladding", "Primary boundary", "Containment"], note: "MOX SFR fuel, the primary in-vessel inventory." },
  "SRC-2": { id: "SRC-2", name: "Spent fuel (ex-vessel)", barriers: ["Cladding", "Storage cover gas"], note: "Tracked during refuelling / storage states." },
  "SRC-3": { id: "SRC-3", name: "Cover-gas argon", barriers: ["Cover-gas boundary", "Containment"], note: "Ex-core activated mobile source." },
};

interface SafetyFunctionSpec {
  id: string;
  name: string;
  icon: string;
  scId: string;
  systems: string[];
  desc: string;
}

const ES_SAFETY_FUNCTION_CATALOG: Record<string, SafetyFunctionSpec> = {
  "SF-RC": { id: "SF-RC", name: "Reactivity control", icon: "Atom", scId: "SC-04", systems: ["Reactor protection system (RPS)", "Inherent reactivity feedback"], desc: "Shut the reactor down, or let inherent feedback do it, so power drops below the heat that can be removed." },
  "SF-DHR": { id: "SF-DHR", name: "Decay-heat removal", icon: "Thermo", scId: "SC-06", systems: ["Intermediate heat-transport loop", "DRACS (passive)", "Natural circulation"], desc: "Remove decay heat from the primary sodium so cladding and boundary stay below limits." },
  "SF-INV": { id: "SF-INV", name: "Coolant inventory & boundary", icon: "Pipe", scId: "SC-09", systems: ["Guard vessel", "Leak isolation", "Make-up"], desc: "Keep enough primary sodium over the core, and keep the reactor coolant boundary intact." },
  "SF-CONF": { id: "SF-CONF", name: "Confinement integrity", icon: "Shield", scId: "SC-12", systems: ["Confinement isolation", "Cover-gas clean-up", "Filtration"], desc: "Hold back radionuclides if the inner barriers are challenged, which sets the release category." },
};

const ES_FE_SC_MAP: Record<string, string> = {
  RT: "SC-04", SDHR: "SC-06", DRACS: "SC-06", CONF: "SC-12", NC: "SC-06",
  ISOL: "SC-09", SUPP: "SC-12", STRUCT: "SC-09", DETECT: "SC-09", MAKEUP: "SC-09",
};

type FeActor = "operator" | "auto" | "passive";

const ES_FE_OPERATOR_IDS = ["SDHR", "ISOL", "DETECT", "MAKEUP", "SUPP"];
const ES_FE_PASSIVE_IDS = ["DRACS", "NC", "STRUCT"];

function feActor(feId: string): FeActor {
  if (ES_FE_OPERATOR_IDS.includes(feId)) return "operator";
  if (ES_FE_PASSIVE_IDS.includes(feId)) return "passive";
  return "auto";
}

interface FeActorMeta {
  label: string;
  short: string;
  dynSim: boolean;
}

const ES_FE_ACTOR_META: Record<FeActor, FeActorMeta> = {
  operator: { label: "Operator action / decision", short: "Operator", dynSim: true },
  auto: { label: "Automatic actuation", short: "Automatic", dynSim: false },
  passive: { label: "Passive / inherent", short: "Passive", dynSim: false },
};

interface RepresentationSpec {
  id: string;
  label: string;
  icon: string;
  order: string;
  neutral?: boolean;
  primary?: boolean;
  derived?: boolean;
  method?: string;
  blurb: string;
}

const ES_REPRESENTATIONS: RepresentationSpec[] = [
  { id: "esd", label: "Event-sequence diagram", icon: "Split", method: "NM-052", primary: true, order: "Step 1 · develop first", blurb: "Walk each scenario the way the operators would, following the reactor response and the symptom-based procedures." },
  { id: "tree", label: "Event tree", icon: "Tree", method: "NM-041", derived: true, order: "Step 2 · derive from the ESD", blurb: "The structured re-expression of the diagram, where every question becomes a branch." },
  { id: "table", label: "Sequence record", icon: "Sheet", neutral: true, order: "Shared record", blurb: "The shared list of sequences that every later step reads." },
];

interface DependencyTypeSpec {
  label: string;
  icon: string;
  tone: "primary" | "warn";
}

const ES_DEPENDENCY_TYPES: Record<string, DependencyTypeSpec> = {
  FUNCTIONAL: { label: "Functional", icon: "Network", tone: "primary" },
  PHYSICAL: { label: "Physical", icon: "Pipe", tone: "primary" },
  HUMAN: { label: "Human", icon: "Person", tone: "primary" },
  OPERATIONAL: { label: "Operational", icon: "Settings", tone: "primary" },
  PHENOMENOLOGICAL: { label: "Phenomenological", icon: "Flame", tone: "warn" },
  COMMON_CAUSE: { label: "Common-cause", icon: "Group", tone: "warn" },
};

type EndStateTone = "ok" | "warn" | "block";

interface EndStateSpec {
  id: "OK" | "REL";
  kind: string;
  label: string;
  tone: EndStateTone;
  desc: string;
}

const ES_END_STATES: EndStateSpec[] = [
  { id: "OK", kind: "SUCCESSFUL_MITIGATION", label: "Safe stable state", tone: "ok", desc: "Every safety function is fulfilled, preventing release below the RI-A5 screening level." },
  { id: "REL", kind: "RADIONUCLIDE_RELEASE", label: "Radionuclide release", tone: "block", desc: "Resolves into a reactor-specific release category handed to Mechanistic Source Term." },
];

interface ReleaseCategorySpec {
  id: string;
  name: string;
  tone: EndStateTone;
  timing: string;
  magnitude: string;
  scrubbed: boolean;
  chars: string[];
  desc: string;
  msReady: boolean;
}

const ES_RELEASE_CATEGORIES: ReleaseCategorySpec[] = [
  { id: "RC-1", name: "Early confinement bypass / failure", tone: "block", timing: "Early (< 8 h)", magnitude: "Large", scrubbed: false, chars: ["Confinement open or bypassed at release", "No filtration credit", "Driven by sodium fire or ATWS energy"], desc: "The largest and earliest release, with confinement failed or bypassed before the source term can be held back.", msReady: true },
  { id: "RC-2", name: "Late filtered release", tone: "warn", timing: "Late (> 24 h)", magnitude: "Moderate", scrubbed: true, chars: ["Confinement intact, leakage at design rate", "Cover-gas clean-up + filtration credited", "Aerosol settling over delay period"], desc: "Confinement holds, so the release is delayed and filtered into a much smaller mechanistic source term.", msReady: true },
  { id: "RC-3", name: "Intact-confinement leakage", tone: "warn", timing: "Very late (> 72 h)", magnitude: "Small", scrubbed: true, chars: ["Design-leakage only", "Full filtration + plate-out", "No barrier breach beyond cladding"], desc: "Only design-basis confinement leakage occurs — the worst-case small release for sequences that lose cooling but keep all outer barriers.", msReady: false },
];

type LbeClassId = "AOO" | "DBE" | "BDBE";

interface LbeClassSpec {
  id: LbeClassId;
  label: string;
  name: string;
  band: string;
  tone: EndStateTone;
}

const ES_LBE_CLASSES: Record<LbeClassId, LbeClassSpec> = {
  AOO: { id: "AOO", label: "AOO", name: "Anticipated operational occurrence", band: "≥ 1E-2 /yr", tone: "ok" },
  DBE: { id: "DBE", label: "DBE", name: "Design basis event", band: "1E-4 to 1E-2 /yr", tone: "warn" },
  BDBE: { id: "BDBE", label: "BDBE", name: "Beyond design basis event", band: "5E-7 to 1E-4 /yr", tone: "block" },
};

interface LicensingBasisEvent {
  id: string;
  name: string;
  basis: string;
  releaseCategoryId?: string;
  meanFrequency: number;
  lbeClass: LbeClassId;
}

const ES_LICENSING_BASIS_EVENTS: LicensingBasisEvent[] = [
  { id: "LBE-1", name: "General transient, mitigated to safe state", basis: "EST-01 · ESF-OK", meanFrequency: 2.55, lbeClass: "AOO" },
  { id: "LBE-2", name: "Loss of flow, mitigated to safe state", basis: "ESF-01 · ESF-OK", meanFrequency: 5.3e-2, lbeClass: "AOO" },
  { id: "LBE-3", name: "Sodium boundary leak, isolated and mitigated", basis: "ESR-01 · ESF-OK", meanFrequency: 2.2e-3, lbeClass: "DBE" },
  { id: "LBE-4", name: "Cover-gas breach, isolated and mitigated", basis: "ESG-01 · ESF-OK", meanFrequency: 2.1e-4, lbeClass: "DBE" },
  { id: "LBE-5", name: "DHR failure, late filtered release", basis: "ESF-LATE", releaseCategoryId: "RC-2", meanFrequency: 5.1e-5, lbeClass: "BDBE" },
  { id: "LBE-6", name: "Unprotected transient (ATWS) release", basis: "ESF-ATWS", releaseCategoryId: "RC-1", meanFrequency: 2.7e-5, lbeClass: "BDBE" },
  { id: "LBE-7", name: "Confinement failure, early release", basis: "ESF-EARLY", releaseCategoryId: "RC-1", meanFrequency: 5.4e-6, lbeClass: "BDBE" },
];

interface TimelineMilestone {
  t: number;
  label: string;
  sub: string;
  kind: "init" | "auto" | "cue" | "op" | "limit";
  basis?: string;
}

interface EsTimeline {
  label: string;
  reference: string;
  missionTime: string;
  tMin: number;
  tMax: number;
  damageFrom: number;
  milestones: TimelineMilestone[];
}

const ES_TIMELINE: EsTimeline = {
  label: "Loss of heat sink at full power",
  reference: "ESL-02 path · passive DHR credited",
  missionTime: "72 h",
  tMin: 0.1,
  tMax: 600,
  damageFrom: 240,
  milestones: [
    { t: 0.1, label: "Initiating event", sub: "Heat sink lost", kind: "init", basis: "TH-CALC-06" },
    { t: 0.4, label: "Reactor trips", sub: "RPS · automatic", kind: "auto", basis: "TH-CALC-04" },
    { t: 10, label: "Loss-of-heat-sink alarm", sub: "Operator cue", kind: "cue", basis: "TH-CALC-06" },
    { t: 30, label: "DRACS natural circulation", sub: "Passive · established", kind: "auto", basis: "TH-CALC-09" },
    { t: 40, label: "Backup-DHR window opens", sub: "Operator action available", kind: "op", basis: "TH-CALC-06" },
    { t: 240, label: "Cladding limit · earliest", sub: "If no DHR · lower bound", kind: "limit", basis: "TH-CALC-06" },
    { t: 480, label: "Cladding limit · best estimate", sub: "If no DHR", kind: "limit", basis: "TH-CALC-06" },
  ],
};

interface FeasibilityCriterion {
  id: string;
  label: string;
  hint: string;
}

const FEASIBILITY_CRITERIA: FeasibilityCriterion[] = [
  { id: "time", label: "Time", hint: "Enough time before the limit" },
  { id: "env", label: "Environment", hint: "Conditions allow access where needed" },
  { id: "proc", label: "Procedures", hint: "A written procedure exists" },
  { id: "train", label: "Training", hint: "Crews train on it under similar conditions" },
  { id: "equip", label: "Equipment", hint: "Needed equipment is available and ready" },
];

interface OperatorAction {
  id: string;
  action: string;
  cue: string;
  startMin: number;
  byMin: number;
  requiredMin: number;
  available: string;
  required: string;
  margin: string;
  hep: string;
  feasible: Record<string, "ok" | "warn" | "block">;
  note?: string;
}

const ES_OPERATOR_ACTIONS: OperatorAction[] = [
  { id: "HFE-08", action: "Diagnose loss of heat sink", cue: "Loss-of-heat-sink alarm (~10 min)", startMin: 10, byMin: 240, requiredMin: 12, available: "≈ 3.8 h", required: "≈ 12 min", margin: "Wide", hep: "3.0e-2", feasible: { time: "ok", env: "ok", proc: "ok", train: "ok", equip: "ok" } },
  { id: "HFE-12", action: "Align the backup decay-heat path", cue: "After diagnosis (HFE-08)", startMin: 40, byMin: 240, requiredMin: 35, available: "≈ 3.3 h", required: "≈ 35 min", margin: "Adequate", hep: "8.0e-3", feasible: { time: "ok", env: "warn", proc: "ok", train: "ok", equip: "ok" }, note: "Environment is flagged because a sodium fire (PH-1) can limit access to the backup-DHR alignment, the DEP-4 link." },
];

interface Phenomenon {
  id: string;
  name: string;
  icon: string;
  affects: string[];
  harsh: string[];
  timing: string;
  desc: string;
  det: string;
}

const ES_PHENOMENA: Phenomenon[] = [
  { id: "PH-1", name: "Sodium pool fire", icon: "Flame", affects: ["DRACS actuation", "RPS cabling"], harsh: ["Temperature", "Aerosol", "Smoke obscuration"], timing: "Minutes after a leak ignites", desc: "Burning sodium fills the primary cell with thick smoke and heat, linked to DEP-4.", det: "F-PRA element" },
  { id: "PH-2", name: "Sodium–CO₂ interaction", icon: "Beaker", affects: ["PCS boundary", "Confinement pressure"], harsh: ["Pressure", "Reaction products"], timing: "On IHX / PCS tube leak", desc: "A sodium-to-CO₂ leak in the power-conversion boundary raises confinement pressure and forms reaction products.", det: "TH-CALC-11" },
  { id: "PH-3", name: "Cover-gas activity transport", icon: "Radiation", affects: ["Cover-gas boundary", "Filtration load"], harsh: ["Activity"], timing: "Continuous once boundary degraded", desc: "Moving activated argon sets the RC-3 source term when only the cover-gas boundary is challenged.", det: "MS element" },
];

interface ScreeningLabel {
  targetLabel: string;
  riskImpact: string;
}

const ES_SCREENING_LABELS: Record<string, ScreeningLabel> = {
  "ESR-02": { targetLabel: "Small leak · DHR fail · confinement intact (RC-3)", riskImpact: "Low" },
  "ESL-04": { targetLabel: "LOHS · DHR + confinement fail (RC-1)", riskImpact: "High" },
  "ESX-07": { targetLabel: "Spurious confinement isolation during POS-09 (cover-gas)", riskImpact: "Low" },
  "ESX-11": { targetLabel: "Load-follow power oscillation (POS-02)", riskImpact: "Low" },
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
  A: "Scenario development (HLR-ES-A)",
  B: "Dependencies (HLR-ES-B)",
  C: "End states & releases (HLR-ES-C)",
  D: "Documentation (HLR-ES-D)",
};

const ES_SR_DESCRIPTIONS: Record<string, string> = {
  "ES-A1": "Method models system + operator combinations per IE, evolution & POS, defines sequences clearly, and frames ESQ",
  "ES-A2": "Radionuclide transport barriers identified for every source in scope",
  "ES-A3": "Key reactor-specific safety functions identified per IE and source",
  "ES-A4": "Operator actions needed to meet each safety-function success criterion (SC-A5) identified",
  "ES-A5": "Model consistent with the plant/design transient response, crediting EOPs and other procedures",
  "ES-A6": "Functional events ordered by timing in the progression, or rationale provided",
  "ES-A7": "Sequences delineated for each IE and any not meeting SCR-3 retained",
  "ES-A8": "End state defined as a release category or a safe stable state below the RI-A5 level",
  "ES-A9": "Reactors and sources of radioactive material involved captured in the end-state definition",
  "ES-A10": "Realistic, design-specific T/H analyses used for event-progression parameters (CC-II)",
  "ES-A11": "Plant-response analysis performed at a level of detail matching the design information",
  "ES-A12": "Risk-significant differences in system / operator requirements modelled separately (CC-II)",
  "ES-A13": "Intermediate end states and transfers defined so all dependencies are preserved",
  "ES-A14": "Model-uncertainty sources, assumptions & reasonable alternatives identified (→ HLR-ESQ-E)",
  "ES-A15": "Pre-operational: assumptions from missing as-built / as-operated detail logged",
  "ES-B1": "Systems / barriers challenged, degraded or failed by each initiator identified and their impact included",
  "ES-B2": "Dependence of mitigating systems on preceding systems, functions & human actions identified",
  "ES-B3": "Phenomenological (harsh-environment) conditions each sequence creates identified and their impact included",
  "ES-B4": "Dependent event placed to the left of the event it conditions in split-fraction ordering, or rationale given",
  "ES-B5": "Sequences developed to capture inter-system dependencies and train-level interfaces",
  "ES-B6": "Dependency detail consistent with available design info; assumptions logged where information is missing",
  "ES-B7": "Plant configurations and maintenance practices that create or alter dependencies modelled",
  "ES-B8": "Time-phased dependencies that change as the event progresses modelled",
  "ES-B9": "Model-uncertainty sources, assumptions & alternatives in the dependency analysis identified",
  "ES-B10": "Pre-operational: dependency assumptions from missing as-built / as-operated detail identified",
  "ES-C1": "End states defined to resolve families, with safe-stable states and release categories (→ HLR-MS-A)",
  "ES-C2": "Physical release characteristics that drive the mechanistic source term identified",
  "ES-C3": "Event-sequence characteristics that lead to those physical characteristics identified",
  "ES-C4": "Each characteristic shown to be addressed, or its exclusion justified as non-risk-significant",
  "ES-C5": "Development method explicitly accounts for the ES-C2 / C3 characteristics and their dependencies",
  "ES-C6": "Any plant-damage-state interfaces defined consistent with ES-C2…C5",
  "ES-C7": "Supporting plant-response analyses used per the CC-II SRs of HLR-SC-A and HLR-SC-B",
  "ES-C8": "Sequences developed to the detail needed to resolve each family, consistent with the MS calculations",
  "ES-C9": "If repair is credited, risk-significant sequences reviewed and the repair-failure credit justified",
  "ES-C10": "Model-uncertainty sources, assumptions & alternatives in the transport analysis identified",
  "ES-C11": "Pre-operational: transport-analysis assumptions from missing as-built detail identified",
  "ES-D1": "ES process documented (inputs, methods, results) with full SR traceability",
  "ES-D2": "Model-uncertainty sources, assumptions & alternatives documented (ES-A14, B9, C10)",
  "ES-D3": "Pre-operational: assumptions & limitations from missing as-built detail documented",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.entries(ES_SR_CATALOG).map(([code, meta]) => {
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-ES-${meta.hlr}`,
      hlr: meta.hlr,
      text: `ES - ${code.slice("ES-".length)}: ${ES_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

export type {
  EsStep,
  StepStatus,
  EsPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  EndStateSpec,
  ReleaseCategorySpec,
  TimelineMilestone,
  EsTimeline,
  FeasibilityCriterion,
  OperatorAction,
  Phenomenon,
  UpstreamMeta,
  SourceSpec,
  SafetyFunctionSpec,
  RepresentationSpec,
  DependencyTypeSpec,
  ScreeningLabel,
  FeActor,
  LbeClassId,
  LbeClassSpec,
  LicensingBasisEvent,
};

export {
  ES_STEPS,
  ES_PERSONAS,
  ES_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  ES_END_STATES,
  ES_RELEASE_CATEGORIES,
  ES_TIMELINE,
  FEASIBILITY_CRITERIA,
  ES_OPERATOR_ACTIONS,
  ES_PHENOMENA,
  ES_UPSTREAM_META,
  ES_POS_NAMES,
  ES_IE_POS_COVERAGE,
  ES_SOURCE_CATALOG,
  ES_SAFETY_FUNCTION_CATALOG,
  ES_FE_SC_MAP,
  feActor,
  ES_FE_ACTOR_META,
  ES_REPRESENTATIONS,
  ES_DEPENDENCY_TYPES,
  ES_SCREENING_LABELS,
  ES_LBE_CLASSES,
  ES_LICENSING_BASIS_EVENTS,
};

import {
  ESQ_SR_CATALOG,
  type EsqLinkCode,
  type EsqModelElement,
  type EsqScopeAspect,
  type EsqStateWeighting,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { FrequencyUnit } from "interfaces-mef-types/core/events";

type StepStatus = "complete" | "in-progress" | "idle";

interface EsqStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  hlr?: string;
  status: StepStatus;
  terminal?: boolean;
}

const ESQ_STEPS: EsqStep[] = [
  { id: "scope", num: "01", label: "Scope", sub: "Links · coverage · plan", hlr: "ESQ-A", status: "idle" },
  { id: "model", num: "02", label: "Model", sub: "Sequences · links · values", hlr: "ESQ-A", status: "idle" },
  { id: "barriers", num: "03", label: "Barriers and phenomena", sub: "Cells · credits", hlr: "ESQ-C", status: "idle" },
  { id: "logic", num: "04", label: "Logic rules", sub: "Flags · loops · exclusions · recovery · HFE dependence", hlr: "ESQ-B", status: "idle" },
  { id: "solve", num: "05", label: "Solve and converge", sub: "Runs · trees · families · cut sets", hlr: "ESQ-B", status: "idle" },
  { id: "results", num: "06", label: "Results review", sub: "Consistency · contributors · importance", hlr: "ESQ-D", status: "idle" },
  { id: "uncert", num: "07", label: "Uncertainty", sub: "Inputs · shared draws · families", hlr: "ESQ-E", status: "idle" },
  { id: "sens", num: "08", label: "Sensitivity", sub: "Register · cases · pre-operational", hlr: "ESQ-E", status: "idle" },
  { id: "handoff", num: "09", label: "Technical Element Handoff", sub: "Exported sections", hlr: "ESQ-F", status: "idle" },
  { id: "draft", num: "10", label: "Draft", sub: "Produce ESQ report (F)", status: "idle", terminal: true },
  { id: "review", num: "11", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "12", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type EsqPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: EsqPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const ESQ_PERSONAS: Record<EsqPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · overlaps with the IE and ES reviewers for consistency" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = ESQ_STEPS.map((s) => s.id);
const ESQ_PERSONA_STEPS: Record<EsqPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Point estimate", description: "Calculate a point estimate of each family frequency from point-estimate inputs." },
  { id: "cc-ii", name: "CC-II", tag: "Mean with SOKC", description: "Quantify the mean by propagating the risk-significant parameter distributions with the state-of-knowledge correlation accounted for." },
];

type Stage = "pre_operational" | "operational";

interface EsqLinkRequest {
  treeId: string;
  functionalEventId: string;
  name: string;
}
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
  A: "Integrate & quantify (HLR-A)",
  B: "Compute honestly (HLR-B)",
  C: "Preserve dependencies (HLR-C)",
  D: "Review results (HLR-D)",
  E: "Integrate uncertainty (HLR-E)",
  F: "Document (HLR-F)",
};

const ESQ_SR_DESCRIPTIONS: Record<string, string> = {
  "ESQ-A1": "Group event sequences into families with like end states and like dependencies",
  "ESQ-A2": "Integrate the sequences, system models, data and human reliability per source, group, hazard and state",
  "ESQ-A3": "Calculate the failure probability of each barrier failure mode contributing to a family",
  "ESQ-A4": "Quantify the frequency of each event sequence family",
  "ESQ-A5": "Calculate a point estimate at CC-I or the mean with the state-of-knowledge correlation at CC-II",
  "ESQ-A6": "Use a quantification method able to discriminate the risk-significant contributors",
  "ESQ-A7": "Apply recovery at the family and cutset level per the human reliability requirements",
  "ESQ-A8": "Select parameters at the same capability category as the human reliability and data requirements",
  "ESQ-A9": "Use conservative phenomena parameters at CC-I or realistic ones for risk-significant families at CC-II",
  "ESQ-B1": "Demonstrate the codes against accepted algorithms and identify the method-specific limitations",
  "ESQ-B2": "Set the truncation low enough that dependencies in risk-significant cutsets are not eliminated",
  "ESQ-B3": "Establish the truncation limit by an iterative convergence demonstration",
  "ESQ-B4": "Solve cutsets by the minimal cutset upper bound or an exact solution, and justify any rare-event approximation",
  "ESQ-B5": "Break circular logic without adding conservatism or non-conservatism",
  "ESQ-B6": "Include the success branches of modeled events, not only the failures",
  "ESQ-B7": "Identify cutsets that contain mutually exclusive events",
  "ESQ-B8": "Correct the mutually exclusive combinations by logic or by deletion",
  "ESQ-B9": "Set logic flag events to true or false rather than to a probability of one or zero",
  "ESQ-B10": "Keep shared events identifiable, modules independent and per-event results interpretable",
  "ESQ-C1": "Identify cutsets with multiple human failure events that could affect risk-significant results",
  "ESQ-C2": "Assess the joint dependency of the human failure events per the human reliability requirements",
  "ESQ-C3": "Carry the sequence characteristics into the downstream tree on each transfer",
  "ESQ-C4": "Assess phenomenological dependencies on credited equipment and justify any independence assumption",
  "ESQ-C5": "Estimate the barrier challenges at CC-I or calculate them with design-specific analyses at CC-II",
  "ESQ-C6": "Include the phenomena model logic, with scrubbing and beneficial failures at CC-II",
  "ESQ-C7": "Treat post-release human actions conservatively at CC-I or in detail for risk-significant actions at CC-II",
  "ESQ-C8": "Take no credit at CC-I for equipment or human action beyond the qualification limits",
  "ESQ-C9": "Credit survivability at CC-II only where engineering analysis and the related requirements support it",
  "ESQ-C10": "Include both gross and localized barrier failure modes",
  "ESQ-C11": "Include external-hazard-caused barrier failure mechanisms where in scope",
  "ESQ-C12": "Identify the failure modes, challenging phenomena and hazard mechanisms for each barrier",
  "ESQ-C13": "Identify the design-specific plausible degradation mechanisms, with any screening justified",
  "ESQ-C14": "Evaluate barrier capacity conservatively at CC-I or realistically with aging at CC-II",
  "ESQ-C15": "Estimate external-hazard capacity at CC-I or calculate fragility curves at CC-II",
  "ESQ-C16": "Identify the model-uncertainty sources and assumptions in the dependency treatment",
  "ESQ-C17": "Log the pre-operational assumptions in the dependency treatment",
  "ESQ-D1": "Sample risk-significant cutsets and verify the logic is correct",
  "ESQ-D2": "Review the results for consistency with the upstream models and operational reality",
  "ESQ-D3": "Confirm the flag, mutually exclusive and recovery rules produce logical results",
  "ESQ-D4": "Compare the results to similar plants, and explain the differences at CC-II",
  "ESQ-D5": "Sample non-risk-significant cutsets and confirm they are physically meaningful",
  "ESQ-D6": "Identify the risk-significant contributors using the risk-integration criteria",
  "ESQ-D7": "Review the importance results and reconcile anything unexpected",
  "ESQ-D8": "Assess that the cumulative effect of the screened-out initiating events stays negligible",
  "ESQ-E1": "Assess the model-uncertainty sources and assumptions identified by every technical element",
  "ESQ-E2": "Characterize the family-frequency uncertainty, propagating the risk-significant distributions with the correlation at CC-II",
  "ESQ-F1": "Document the quantification process, the inputs, the methods and the results",
  "ESQ-F2": "Document the risk-significant contributors",
  "ESQ-F3": "Document the model-uncertainty sources and the sensitivity results",
  "ESQ-F4": "Document the limitations that would affect applications",
  "ESQ-F5": "Document the pre-operational assumptions",
};

const ESQ_SR_META: Record<string, string> = {
  "ESQ-A1": "5 families",
  "ESQ-B1": "2 codes",
  "ESQ-B7": "2 rules",
  "ESQ-B9": "3 flags",
  "ESQ-C4": "1 assumption open",
  "ESQ-C10": "3 barriers",
  "ESQ-D6": "5 contributors",
  "ESQ-D7": "1 reconciled",
  "ESQ-E1": "8 sources",
};

const ESQ_SR_LINKED_NM: Record<string, string> = {
  "ESQ-E2": "NM-070",
  "ESQ-C14": "NM-074",
  "ESQ-C11": "NM-078",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(ESQ_SR_CATALOG).map((code) => {
    const meta = ESQ_SR_CATALOG[code];
    const stages = meta.stages.map((s) => (s === "OPERATIONAL" ? "operational" : "pre_operational"));
    const preOnly = meta.stages.length === 1 && meta.stages[0] === "PRE_OPERATIONAL";
    return {
      id: code,
      section: HLR_SECTION[meta.hlr] ?? `HLR-ESQ-${meta.hlr}`,
      hlr: meta.hlr,
      text: `${code}: ${ESQ_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      stages,
      meta: ESQ_SR_META[code] ?? (preOnly ? "Pre-op" : undefined),
      linkedNM: ESQ_SR_LINKED_NM[code],
    };
  });
}

const CONFORMANCE_ITEMS: ConformanceItem[] = buildConformanceItems();

interface EsqLinkTile {
  code: EsqLinkCode;
  label: string;
  name: string;
}

const ESQ_LINK_TILES: EsqLinkTile[] = [
  { code: "ES", label: "ES", name: "Event Sequence Analysis" },
  { code: "SY", label: "SY", name: "Systems Analysis" },
  { code: "DA", label: "DA", name: "Data Analysis" },
  { code: "HRA", label: "HR", name: "Human Reliability" },
  { code: "IE", label: "IE", name: "Initiating Events" },
  { code: "POS", label: "POS", name: "Plant Operating States" },
  { code: "SC", label: "SC", name: "Success Criteria" },
  { code: "HS", label: "HS", name: "Hazards Screening" },
  { code: "RI", label: "RI", name: "Risk Integration" },
];

const EXAMPLE_VARIANT_LABELS: Record<string, string> = {
  htgr: "Generic HTGR",
  sfr: "Generic SFR",
  hcl: "HCL case study",
};

function exampleLinkVariant(id: string): string | undefined {
  return id.startsWith("example-") ? id.split("-").slice(2).join("-") : undefined;
}

function exampleLinkLabel(id: string): string | undefined {
  const variant = exampleLinkVariant(id);
  if (variant === undefined) return undefined;
  return `${EXAMPLE_VARIANT_LABELS[variant] ?? variant} example`;
}

const ESQ_HAZARD_GROUPS: string[] = [
  "Internal events",
  "Internal floods",
  "Internal fires",
  "Seismic events",
  "High winds",
  "External floods",
  "Other internal and external hazards",
];

const ESQ_EXTERNAL_HAZARD_GROUPS: string[] = [
  "Seismic events",
  "High winds",
  "External floods",
  "Other internal and external hazards",
];

interface EsqScopeAspectSpec {
  aspect: EsqScopeAspect;
  label: string;
  item: string;
}

const ESQ_SCOPE_ASPECTS: EsqScopeAspectSpec[] = [
  { aspect: "HAZARD_GROUP", label: "Hazard groups", item: "hazard group" },
  { aspect: "OPERATING_STATE", label: "Operating states", item: "operating state" },
  { aspect: "INITIATOR_GROUP", label: "Initiating event groups", item: "initiator group" },
  { aspect: "SOURCE", label: "Radioactive material sources", item: "source" },
];

const FREQUENCY_UNIT_OPTIONS: { id: FrequencyUnit; label: string }[] = [
  { id: FrequencyUnit.PER_REACTOR_YEAR, label: "Per reactor-year" },
  { id: FrequencyUnit.PER_PLANT_YEAR, label: "Per plant-year" },
  { id: FrequencyUnit.PER_CALENDAR_YEAR, label: "Per calendar year" },
  { id: FrequencyUnit.PER_CRITICAL_YEAR, label: "Per critical year" },
];

const STATE_WEIGHTING_OPTIONS: { id: EsqStateWeighting; label: string }[] = [
  { id: "POS_HOURS", label: "Hours in each state, from POS" },
  { id: "TYPED_SHARES", label: "Share typed for each state" },
];

type EsqPlanKey = "stateWeighting" | "reportingFloorPerYear" | "convergenceStepPercent";

const ESQ_PLAN_LABELS: Record<EsqPlanKey, string> = {
  stateWeighting: "State weighting",
  reportingFloorPerYear: "Reporting floor",
  convergenceStepPercent: "Convergence step",
};

const ESQ_PLAN_SOURCES: Record<EsqPlanKey, string> = {
  stateWeighting: "RA-S-1.4 definitions",
  reportingFloorPerYear: "RI-A4 · RG 1.247",
  convergenceStepPercent: "ESQ-N-4 example",
};

const ESQ_MODEL_ELEMENTS: EsqModelElement[] = ["ES", "SY", "DA", "HRA", "IE", "POS", "SC"];

const MODEL_ELEMENT_LABELS: Record<EsqModelElement, string> = {
  ES: "ES",
  SY: "SY",
  DA: "DA",
  HRA: "HR",
  IE: "IE",
  POS: "POS",
  SC: "SC",
};

const END_STATE_LABELS: Record<string, string> = {
  SUCCESSFUL_MITIGATION: "Successful mitigation",
  RADIONUCLIDE_RELEASE: "Release",
};

const EVIDENCE_KIND_LABELS: Record<string, string> = {
  PLANT_RECORDS: "1 · Plant records",
  TECHNOLOGY: "2 · Technology evidence",
  GENERIC_NUCLEAR: "3 · Generic nuclear data",
  ANALOGOUS_INDUSTRY: "4 · Analogous industries",
  ENGINEERING_MODEL: "5 · Engineering models",
  EXPERT_JUDGMENT: "6 · Expert judgment",
};

const PLANT_STAGES: { id: Stage; title: string; body: string }[] = [
  { id: "pre_operational", title: "Pre-operational", body: "Design calculations and borrowed data stand in for the as-built plant. Assumptions that must close before operation are listed." },
  { id: "operational", title: "Operational", body: "The as-built, as-operated plant and its records confirm the model and its results." },
];

const CONTRIBUTOR_TYPE_LABELS: Record<string, string> = {
  CCF: "Common-cause",
  EQUIPMENT_FAILURE: "Equipment",
  HUMAN_FAILURE_EVENT: "Human action",
  INITIATING_EVENT: "Initiator",
  BARRIER_FAILURE_MODE: "Barrier",
  EVENT_PHENOMENON: "Phenomenon",
  PLANT_OPERATING_STATE: "Operating state",
  PLANT_DAMAGE_STATE: "Damage state",
  OTHER: "Other",
  EVENT_SEQUENCE_FAMILY: "Family",
  EVENT_SEQUENCE: "Sequence",
  HAZARD_GROUP: "Hazard group",
};

const CONTRIBUTOR_TYPE_ENTRIES: [string, string][] = [
  ["CCF", "Common-cause"],
  ["EQUIPMENT_FAILURE", "Equipment"],
  ["HUMAN_FAILURE_EVENT", "Human action"],
  ["INITIATING_EVENT", "Initiator"],
  ["PLANT_OPERATING_STATE", "Operating state"],
  ["EVENT_SEQUENCE_FAMILY", "Sequence family"],
  ["EVENT_SEQUENCE", "Sequence"],
  ["HAZARD_GROUP", "Hazard group"],
  ["PLANT_DAMAGE_STATE", "Damage state"],
];

const EXT_HAZARD_BASIS_LABELS: Record<string, string> = {
  ESTIMATED: "Capacity estimated",
  FRAGILITY_CURVES: "Fragility curves",
};



const PROPAGATION_LABELS: Record<string, string> = {
  MONTE_CARLO: "Monte Carlo sampling",
  LATIN_HYPERCUBE: "Latin hypercube sampling",
  ANALYTICAL: "Analytical propagation",
  OTHER: "Other",
};

const ESQ_TOC: [string, string][] = [
  ["Executive summary", "5"],
  ["Introduction", "6"],
  ["    Purpose, scope & relationship", "6"],
  ["    Quality assurance & freeze date", "6"],
  ["Assumptions & limitations", "7"],
  ["Methodologies", "8"],
  ["    Integration & quantification approach", "8"],
  ["    Truncation & convergence", "8"],
  ["    Solution & approximation", "8"],
  ["    Uncertainty propagation", "8"],
  ["Model integration & inputs", "9"],
  ["Event sequence family frequencies", "10"],
  ["Contribution breakdown", "11"],
  ["Truncation convergence records", "12"],
  ["Cutset review records", "13"],
  ["Flag, mutex & recovery treatment", "13"],
  ["Dependency treatment", "14"],
  ["Barrier challenge & capacity", "15"],
  ["Risk-significant contributors & importance", "16"],
  ["Screening audit", "17"],
  ["Uncertainty results", "18"],
  ["Model uncertainty & sensitivity", "19"],
  ["Pre-operational assumptions", "20"],
  ["Hand-offs", "21"],
  ["Limitations for applications", "22"],
];

export type {
  EsqStep,
  StepStatus,
  EsqPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  Stage,
  EsqLinkRequest,
  EsqLinkTile,
  EsqScopeAspectSpec,
  EsqPlanKey,
};

export {
  ESQ_STEPS,
  ESQ_PERSONAS,
  ESQ_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  ESQ_LINK_TILES,
  ESQ_HAZARD_GROUPS,
  ESQ_EXTERNAL_HAZARD_GROUPS,
  ESQ_SCOPE_ASPECTS,
  FREQUENCY_UNIT_OPTIONS,
  STATE_WEIGHTING_OPTIONS,
  ESQ_PLAN_LABELS,
  ESQ_PLAN_SOURCES,
  ESQ_MODEL_ELEMENTS,
  MODEL_ELEMENT_LABELS,
  END_STATE_LABELS,
  EVIDENCE_KIND_LABELS,
  PLANT_STAGES,
  exampleLinkVariant,
  exampleLinkLabel,
  CONTRIBUTOR_TYPE_LABELS,
  CONTRIBUTOR_TYPE_ENTRIES,
  EXT_HAZARD_BASIS_LABELS,
  PROPAGATION_LABELS,
  ESQ_TOC,
};

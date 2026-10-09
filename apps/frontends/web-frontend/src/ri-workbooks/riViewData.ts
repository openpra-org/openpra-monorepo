import { type RcMetricQuantity, type RcMetricReceptor, type RcMetricWindowStart } from "interfaces-mef-types/rc/metrics";
import {
  RI_SR_CATALOG,
  type RiCliffEdgeStatus,
  type RiCumulativeTargetId,
  type RiMeasureRole,
  type RiLicensingAction,
  type RiLinkedWorkbooks,
  type RiScopeAspect,
  type RiSiteBasis,
  type RiStatistic,
} from "interfaces-mef-types/ri/risk-integration";

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
  { id: "application", num: "01", hlr: "A", hlrTone: "a", label: "Application", sub: "Decision, criteria and scope", status: "idle" },
  { id: "inputs", num: "02", hlr: "B", hlrTone: "b", label: "Inputs", sub: "Families, sequences and consequences", status: "idle" },
  { id: "categories", num: "03", hlr: "B", hlrTone: "b", label: "Event Categories", sub: "AOOs, DBEs and BDBEs", status: "idle" },
  { id: "fc", num: "04", hlr: "B", hlrTone: "b", label: "Frequency-Consequence", sub: "Target, significance and margins", status: "idle" },
  { id: "integrate", num: "05", hlr: "B", hlrTone: "b", label: "Integrated Risk", sub: "Targets, shares and the curve", status: "idle" },
  { id: "aggregate", num: "06", hlr: "B", hlrTone: "b", label: "Contributors and SSCs", sub: "Breakdown, SSC groups and importance", status: "idle" },
  { id: "uncertainty", num: "07", hlr: "C", hlrTone: "c", label: "Uncertainty", sub: "Register, grouping and propagation", status: "idle" },
  { id: "feedback", num: "08", hlr: "D", hlrTone: "d", label: "Hand-offs", sub: "Significance sent upstream", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce RI report", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
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
    name: "Licensing basis events and SSC classification",
    tag: "Absolute criteria",
    sr: "RI-A3",
    desc: "Judge each event family and the whole plant against the NEI 18-04 frequency-consequence target and cumulative targets.",
  },
  {
    id: "baseline_risk",
    name: "Baseline risk and relative importance",
    tag: "Relative criteria",
    sr: "RI-A2",
    desc: "Rank families and contributors by their share of the total risk, counting both frequency and consequence.",
  },
];

const LICENSING_ACTIONS: { id: RiLicensingAction; label: string }[] = [
  { id: "PRE_APPLICATION", label: "Pre-application" },
  { id: "CONSTRUCTION_PERMIT", label: "Construction permit" },
  { id: "OPERATING_LICENSE", label: "Operating license" },
  { id: "DESIGN_CERTIFICATION", label: "Design certification" },
  { id: "COMBINED_LICENSE", label: "Combined license" },
  { id: "STANDARD_DESIGN_APPROVAL", label: "Standard design approval" },
  { id: "MANUFACTURING_LICENSE", label: "Manufacturing license" },
];

const SITE_BASES: { id: RiSiteBasis; label: string }[] = [
  { id: "SITE_INDEPENDENT", label: "Site-independent" },
  { id: "BOUNDING_SITE", label: "Bounding site" },
  { id: "SPECIFIC_SITE", label: "Specific site" },
];

type RiLinkCode = keyof RiLinkedWorkbooks;

const RI_LINK_TILES: { code: RiLinkCode; name: string; handoff: string }[] = [
  { code: "POS", name: "Plant Operating States", handoff: "Provides · Operating states and sources" },
  { code: "ES", name: "Event Sequence Analysis", handoff: "Provides · Families and sequences" },
  { code: "ESQ", name: "Event Sequence Quantification", handoff: "Provides · Family frequencies" },
  { code: "MS", name: "Mechanistic Source Term", handoff: "Provides · Source terms" },
  { code: "RC", name: "Radiological Consequence", handoff: "Provides · Consequences" },
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

const RI_HAZARD_GROUPS: string[] = [
  "Internal events",
  "Internal floods",
  "Internal fires",
  "Seismic events",
  "High winds",
  "External floods",
  "Other internal and external hazards",
];

const RI_SCOPE_ASPECTS: { aspect: RiScopeAspect; label: string }[] = [
  { aspect: "HAZARD_GROUP", label: "Hazard groups" },
  { aspect: "OPERATING_STATE", label: "Operating states" },
  { aspect: "SOURCE", label: "Sources" },
  { aspect: "MODULE", label: "Reactor modules" },
];

type RiAbsoluteNumberKey =
  | "aooLowerPerPlantYear"
  | "dbeLowerPerPlantYear"
  | "bdbeLowerPerPlantYear"
  | "highConsequenceDoseRem"
  | "lbeTargetPercent"
  | "lbeDoseFloorMrem"
  | "sscCumulativePercent";

type RiAbsoluteStatisticKey =
  | "fcStatistic"
  | "categoryStatistic"
  | "bandLowerStatistic"
  | "bandUpperStatistic"
  | "bdbeFloorStatistic"
  | "highConsequenceStatistic"
  | "lbeFrequencyStatistic"
  | "lbeDoseStatistic"
  | "sscTargetStatistic"
  | "sscCumulativeStatistic"
  | "cumulativeStatistic";

type RiRelativeKey = "aggregatePercent" | "individualPercent" | "fussellVesely" | "riskAchievementWorth";

type RiNumberFormat = "sci" | "plain";

type RiCriterionSpec =
  | { kind: "number"; key: RiAbsoluteNumberKey; label: string; unit: string; format: RiNumberFormat; source: string }
  | { kind: "statistic"; key: RiAbsoluteStatisticKey; label: string; source: string; percentilesOnly?: boolean };

type RiCriteriaSubTab = "target" | "categories" | "significance" | "cumulative";

const RI_CRITERIA_SUBTABS: { id: RiCriteriaSubTab; label: string }[] = [
  { id: "target", label: "F-C target" },
  { id: "categories", label: "Frequency categories" },
  { id: "significance", label: "Significance rules" },
  { id: "cumulative", label: "Cumulative targets" },
];

const RI_STATISTICS: { id: RiStatistic; label: string }[] = [
  { id: "MEAN", label: "Mean" },
  { id: "P05", label: "5th percentile" },
  { id: "P50", label: "Median" },
  { id: "P95", label: "95th percentile" },
];

const RI_STATISTIC_SHORT: Record<RiStatistic, string> = { MEAN: "Mean", P05: "5th", P50: "50th", P95: "95th" };

const CLIFF_EDGE_STATUSES: { id: RiCliffEdgeStatus; label: string }[] = [
  { id: "NO_CLIFF_EDGE", label: "No cliff edge" },
  { id: "CLIFF_EDGE", label: "Cliff edge found" },
];

const NEI_SET_LABEL = "NEI 18-04 Rev 1 (August 2019), endorsed by RG 1.233";
const RELATIVE_SET_LABEL = "ASME/ANS RA-S-1.4-2021, Table 1.9-1";

const FC_ANCHOR_SPECS: { label: string; source: string }[] = [
  { label: "10 CFR 20 iso-risk", source: "NEI 18-04 Section 3.2.1, Figure 3-1" },
  { label: "Iso-risk meets the EPA PAG dose", source: "NEI 18-04 Section 3.2.1, Figure 3-1" },
  { label: "EPA PAG dose at the AOO boundary", source: "NEI 18-04 Section 3.2.1, Figure 3-1" },
  { label: "10 CFR 50.34 dose at the DBE boundary", source: "NEI 18-04 Section 3.2.1, Figure 3-1" },
  { label: "Prompt fatality QHO at the BDBE floor", source: "NEI 18-04 Section 3.2.1, Figure 3-1" },
];

const RI_CRITERIA_SPECS: Record<RiCriteriaSubTab, RiCriterionSpec[]> = {
  target: [
    { kind: "statistic", key: "fcStatistic", label: "Statistic for each LBE against the target", source: "NEI 18-04 Task 7a" },
  ],
  categories: [
    { kind: "number", key: "aooLowerPerPlantYear", label: "AOO lower bound", unit: "per plant-year", format: "sci", source: "NEI 18-04 Table 3-1" },
    { kind: "number", key: "dbeLowerPerPlantYear", label: "DBE lower bound", unit: "per plant-year", format: "sci", source: "NEI 18-04 Table 3-1" },
    { kind: "number", key: "bdbeLowerPerPlantYear", label: "BDBE lower bound", unit: "per plant-year", format: "sci", source: "NEI 18-04 Table 3-1, Section 3.2.1" },
    { kind: "statistic", key: "categoryStatistic", label: "Statistic for the category", source: "NEI 18-04 Table 3-1, Task 7a" },
    { kind: "statistic", key: "bandLowerStatistic", label: "Band-crossing rule, lower edge", source: "NEI 18-04 Task 7a", percentilesOnly: true },
    { kind: "statistic", key: "bandUpperStatistic", label: "Band-crossing rule, upper edge", source: "NEI 18-04 Task 7a", percentilesOnly: true },
    { kind: "statistic", key: "bdbeFloorStatistic", label: "Statistic for the BDBE lower bound", source: "NEI 18-04 Section 3.2.1, Task 4" },
    { kind: "number", key: "highConsequenceDoseRem", label: "High-consequence BDBE dose", unit: "rem", format: "plain", source: "NEI 18-04 Task 5a, 10 CFR 50.34" },
    { kind: "statistic", key: "highConsequenceStatistic", label: "Statistic for the high-consequence dose", source: "NEI 18-04 Task 7a" },
  ],
  significance: [
    { kind: "number", key: "lbeTargetPercent", label: "LBE significance: share of the F-C target", unit: "%", format: "plain", source: "NEI 18-04 Section 3.3.5, Figure 3-4" },
    { kind: "number", key: "lbeDoseFloorMrem", label: "LBE significance: dose floor", unit: "mrem", format: "plain", source: "NEI 18-04 Section 3.3.5" },
    { kind: "statistic", key: "lbeFrequencyStatistic", label: "LBE significance: frequency statistic", source: "NEI 18-04 Section 3.3.5" },
    { kind: "statistic", key: "lbeDoseStatistic", label: "LBE significance: dose statistic", source: "NEI 18-04 Section 3.3.5" },
    { kind: "statistic", key: "sscTargetStatistic", label: "SSC test against the F-C target: statistic", source: "NEI 18-04 Section 4.2.2" },
    { kind: "number", key: "sscCumulativePercent", label: "SSC test against cumulative targets: share of each limit", unit: "%", format: "plain", source: "NEI 18-04 Section 4.2.2, Task 7c" },
    { kind: "statistic", key: "sscCumulativeStatistic", label: "SSC test against cumulative targets: statistic", source: "NEI 18-04 Section 4.2.2" },
  ],
  cumulative: [
    { kind: "statistic", key: "cumulativeStatistic", label: "Statistic for the cumulative evaluation", source: "NEI 18-04 Task 7b" },
  ],
};

const CUMULATIVE_TARGET_SPECS: Record<RiCumulativeTargetId, { label: string; receptor: string; source: string }> = {
  DOSE_100_MREM_EXCEEDANCE: { label: "Frequency of exceeding 100 mrem", receptor: "Site boundary", source: "10 CFR 20, NEI 18-04 Task 7b" },
  EARLY_FATALITY_RISK: { label: "Individual early fatality risk", receptor: "Within 1 mile of the EAB", source: "Safety goal QHO, NEI 18-04 Task 7b" },
  LATENT_CANCER_RISK: { label: "Individual latent cancer fatality risk", receptor: "Within 10 miles of the EAB", source: "Safety goal QHO, NEI 18-04 Task 7b" },
};

const MEASURE_ROLE_SPECS: { id: RiMeasureRole; label: string; short: string; phrase: string; preset: string }[] = [
  { id: "EAB_DOSE", label: "F-C target and 100 mrem target", short: "F-C and 100 mrem", phrase: "the F-C target and the 100 mrem target", preset: "lmp-fc" },
  { id: "EARLY_FATALITY_RISK", label: "Early fatality target (QHO)", short: "Early fatality QHO", phrase: "the early fatality target", preset: "qho-early" },
  { id: "LATENT_CANCER_RISK", label: "Latent cancer target (QHO)", short: "Latent cancer QHO", phrase: "the latent cancer target", preset: "qho-latent" },
];

const MEASURE_QUANTITY_LABELS: Record<RcMetricQuantity, string> = {
  INDIVIDUAL_DOSE: "Individual dose",
  INDIVIDUAL_EARLY_FATALITY_RISK: "Early fatality risk",
  INDIVIDUAL_LATENT_CANCER_FATALITY_RISK: "Latent cancer risk",
  POPULATION_DOSE: "Population dose",
  LAND_CONTAMINATION_AREA: "Contaminated land",
  ECONOMIC_COST: "Economic cost",
  CUSTOM: "Custom",
};

const MEASURE_RECEPTOR_LABELS: Record<RcMetricReceptor["kind"], string> = {
  EAB_MAXIMUM: "EAB maximum",
  DISTANCE_PROFILE: "Maximum by distance",
  AVERAGE_BEYOND_EAB: "Average beyond the EAB",
  WITHIN_RADIUS: "Within a radius",
  OTHER: "Other receptors",
};

const MEASURE_WINDOW_START_LABELS: Record<RcMetricWindowStart, string> = {
  RELEASE_ONSET: "Release onset",
  PLUME_ARRIVAL: "Plume arrival",
};

type RiFloorRowKey = "frequency" | "backgroundMremPerYear" | "windowDays" | "sharePercent";

const FLOOR_SPECS: { key: RiFloorRowKey; label: string; unit: string; format: RiNumberFormat; source: string }[] = [
  { key: "frequency", label: "Minimum reporting frequency", unit: "per plant-year", format: "sci", source: "RA-S-1.4-2021 RI-A4, Note RI-N-3" },
  { key: "backgroundMremPerYear", label: "Background dose", unit: "mrem per year", format: "plain", source: "RA-S-1.4-2021 Note RI-N-4" },
  { key: "windowDays", label: "Time window", unit: "days", format: "plain", source: "RA-S-1.4-2021 Note RI-N-4" },
  { key: "sharePercent", label: "Share of background", unit: "%", format: "plain", source: "RA-S-1.4-2021 RI-A5" },
];

const RELATIVE_CRITERIA_SPECS: { key: RiRelativeKey; label: string; unit: string }[] = [
  { key: "aggregatePercent", label: "Families and sequences: aggregate share of the risk", unit: "%" },
  { key: "individualPercent", label: "Families and sequences: individual share of the risk", unit: "%" },
  { key: "fussellVesely", label: "Basic events, SSCs and HFEs: Fussell-Vesely importance", unit: "" },
  { key: "riskAchievementWorth", label: "Basic events, SSCs and HFEs: risk achievement worth", unit: "" },
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
  "RI-B3": "Aggregation honesty",
  "RI-B5": "Anti-masking",
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
  POS: "Frequency side",
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
  RiLinkCode,
  RiAbsoluteNumberKey,
  RiAbsoluteStatisticKey,
  RiRelativeKey,
  RiNumberFormat,
  RiCriterionSpec,
  RiCriteriaSubTab,
  RiFloorRowKey,
};

export {
  RI_STEPS,
  RI_PERSONAS,
  RI_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  PLANT_STAGES,
  type PlantStageId,
  APPLICATION_TYPES,
  LICENSING_ACTIONS,
  SITE_BASES,
  RI_LINK_TILES,
  RI_HAZARD_GROUPS,
  RI_SCOPE_ASPECTS,
  exampleLinkVariant,
  exampleLinkLabel,
  RI_CRITERIA_SUBTABS,
  RI_STATISTICS,
  RI_STATISTIC_SHORT,
  CLIFF_EDGE_STATUSES,
  NEI_SET_LABEL,
  RELATIVE_SET_LABEL,
  FC_ANCHOR_SPECS,
  RI_CRITERIA_SPECS,
  CUMULATIVE_TARGET_SPECS,
  RELATIVE_CRITERIA_SPECS,
  MEASURE_ROLE_SPECS,
  MEASURE_QUANTITY_LABELS,
  MEASURE_RECEPTOR_LABELS,
  MEASURE_WINDOW_START_LABELS,
  FLOOR_SPECS,
  CONFORMANCE_ITEMS,
  HLR_SECTIONS,
  HLR_TONES,
  RI_SR_LINKED_NM,
  RI_UPSTREAM_LINKS,
  SCOPE_POS_TEXT,
  SCOPE_NOTE,
  FC_META,
  CCDF_NOTE,
  REGISTER_SIDE,
  ELEMENT_CODE_BY_TYPE,
  ELEMENT_NAME_BY_CODE,
  RI_TOC,
};

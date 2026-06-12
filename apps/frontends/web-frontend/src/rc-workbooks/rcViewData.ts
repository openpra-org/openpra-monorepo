import { RC_SR_CATALOG, type RcSubElement } from "interfaces-mef-types/rc/radiological-consequence-analysis";

type StepStatus = "complete" | "in-progress" | "idle";
type SubElementTone = "primary" | "atmos" | "site" | "health" | "credit";

interface RcStep {
  id: string;
  num: string;
  label: string;
  sub: string;
  status: StepStatus;
  se?: RcSubElement;
  seTone?: SubElementTone;
  terminal?: boolean;
}

const RC_STEPS: RcStep[] = [
  { id: "handoff", num: "01", se: "RCRE", seTone: "primary", label: "Scope & Handoff", sub: "Receive the source term", status: "idle" },
  { id: "protective", num: "02", se: "RCPA", seTone: "site", label: "Protective Actions & Site", sub: "Model the people (A, B)", status: "idle" },
  { id: "weather", num: "03", se: "RCME", seTone: "atmos", label: "Meteorology", sub: "Compile the weather (A, B)", status: "idle" },
  { id: "dispersion", num: "04", se: "RCAD", seTone: "atmos", label: "Atmospheric Dispersion", sub: "Transport the plume (A to F)", status: "idle" },
  { id: "dose", num: "05", se: "RCDO", seTone: "health", label: "Dosimetry", sub: "Concentration to dose (A to C)", status: "idle" },
  { id: "health", num: "06", se: "RCHE", seTone: "health", label: "Health Effects", sub: "Dose to risk (A to C)", status: "idle" },
  { id: "economics", num: "07", se: "RCEC", seTone: "site", label: "Economic Factors", sub: "Tally the cost (A to C)", status: "idle" },
  { id: "quantify", num: "08", se: "RCQ", seTone: "credit", label: "Quantification", sub: "Integrate and own it (A to D)", status: "idle" },
  { id: "draft", num: "09", label: "Draft", sub: "Produce RC report", status: "idle", terminal: true },
  { id: "review", num: "10", label: "Review", sub: "Reviewer comments", status: "idle", terminal: true },
  { id: "approval", num: "11", label: "Approval", sub: "Everyone signs", status: "idle", terminal: true },
];

type RcPersona = "preparer" | "reviewer" | "approver";

interface PersonaSpec {
  id: RcPersona;
  label: string;
  tone: "primary" | "external" | "approver";
  blurb: string;
}

const RC_PERSONAS: Record<RcPersona, PersonaSpec> = {
  preparer: { id: "preparer", label: "Preparer", tone: "primary", blurb: "Lead author of the draft · responds to reviewers and submits for approval" },
  reviewer: { id: "reviewer", label: "Reviewer", tone: "external", blurb: "View + comment only · coordinates with the MS and the RI reviewers" },
  approver: { id: "approver", label: "Approver", tone: "approver", blurb: "Final internal sign-off · view + comment only on prior steps" },
};

const ALL_STEP_IDS = RC_STEPS.map((s) => s.id);
const RC_PERSONA_STEPS: Record<RcPersona, string[]> = {
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
  { id: "cc-i", name: "CC-I", tag: "Simplified and characterized", description: "Use simplified modules and a collapsed population, with the conservatism direction demonstrated per aspect." },
  { id: "cc-ii", name: "CC-II", tag: "Resolved and propagated", description: "Resolve the population and switch on the physics modules, with the uncertainty propagated through the pipeline." },
];

type SiteBasis = "actual_site" | "bounding_site";
type ConformanceStatus = "ok" | "warn" | "blocked" | "na";

interface ConformanceItem {
  id: string;
  section: string;
  subElement: RcSubElement;
  hlr: string;
  text: string;
  status: ConformanceStatus;
  requiredAt: string[];
  boundingOnly: boolean;
  meta?: string;
  linkedNM?: string;
}

const SUB_ELEMENT_SECTIONS: Record<RcSubElement, string> = {
  RCRE: "Release category transition (RCRE)",
  RCPA: "Protective actions and site (RCPA)",
  RCME: "Meteorological data (RCME)",
  RCAD: "Atmospheric dispersion (RCAD)",
  RCDO: "Dosimetry (RCDO)",
  RCHE: "Health effects (RCHE)",
  RCEC: "Economic factors (RCEC)",
  RCQ: "Consequence quantification (RCQ)",
};

const SUB_ELEMENT_TONES: Record<RcSubElement, SubElementTone> = {
  RCRE: "primary",
  RCPA: "site",
  RCME: "atmos",
  RCAD: "atmos",
  RCDO: "health",
  RCHE: "health",
  RCEC: "site",
  RCQ: "credit",
};

const RC_SR_DESCRIPTIONS: Record<string, string> = {
  "RCRE-A1": "Identify the actual site or describe a bounding site and justify that it bounds the scope",
  "RCRE-A2": "Extract the nine consequence inputs per release category from the source term",
  "RCRE-A3": "Review the category definitions and the source-term parameters against the input list",
  "RCRE-B1": "Take the consequence metric from the intended application",
  "RCRE-B2": "Declare the degree to which each downstream sub-element is evaluated",
  "RCRE-C1": "Identify the model-uncertainty sources in the transition",
  "RCPA-A1": "List the protective actions, evacuation, sheltering, relocation, and land and food interdiction",
  "RCPA-A2": "Structure the actions by incident phase, early, intermediate and late",
  "RCPA-A3": "Ground the modeling in the emergency plan, the evacuation study and the protective-action guides",
  "RCPA-A4": "Model one cohort at CC-I or multiple cohorts at CC-II",
  "RCPA-A5": "State the assumption for the fraction of the population that does not comply",
  "RCPA-A6": "Define the sheltering credit and its basis",
  "RCPA-A7": "Define the relocation criteria and the dose thresholds",
  "RCPA-A8": "Define the interdiction criteria for land and food",
  "RCPA-A9": "Build the evacuation delay as the six-link notification-to-departure chain",
  "RCPA-A10": "Take the evacuation speeds from a site-specific study, for day, night, weather and events",
  "RCPA-A11": "Adjust the speeds, delays and shelter for the hazard group that caused the release",
  "RCPA-A12": "Define the protection parameters for each action with the source",
  "RCPA-A13": "Define the evacuation routing and the road-network model",
  "RCPA-A14": "Identify the model-uncertainty sources in the protective-action modeling",
  "RCPA-B1": "Use an assumed-justified population at CC-I or census demographics at CC-II",
  "RCPA-B2": "Use generic land use at CC-I or county-level land use at CC-II",
  "RCPA-B3": "Use estimated building dimensions at CC-I or actual dimensions and stack heights at CC-II",
  "RCPA-B4": "Include the transient population in the site data",
  "RCPA-B5": "Project the demographics to the analysis year",
  "RCPA-B6": "Define the release-source geographic location",
  "RCPA-B7": "Justify the bounding-site location for the off-site data",
  "RCPA-B8": "Identify the model-uncertainty sources in the site data",
  "RCPA-C1": "Identify the protective-action and site-data uncertain inputs",
  "RCPA-C2": "Characterize the parameter uncertainty for the protective-action and site data",
  "RCPA-C3": "Document the protective-action process and the bounding-site assumptions",
  "RCME-A1": "Use hourly site data justified as spatially representative",
  "RCME-A2": "Use one representative year at CC-I or select the representative year at CC-II",
  "RCME-A3": "Meet ninety percent data recovery, with the substitution reviewed by a meteorologist at CC-II",
  "RCME-A4": "Keep the instruments under a calibrated and maintained program",
  "RCME-A5": "Extract the wind at 10 m, the stability class, and the precipitation at CC-II",
  "RCME-A6": "Use recognized mixing-height data",
  "RCME-A7": "Use a recognized stability-classification method",
  "RCME-A8": "Account for the temporal changes across the weather data",
  "RCME-A9": "Set the time resolution to match the dispersion model",
  "RCME-A10": "Review the data accuracy and record the findings",
  "RCME-A11": "Justify the meteorology for a bounding site",
  "RCME-B1": "Identify the meteorology model-uncertainty sources",
  "RCME-B2": "Characterize the meteorology parameter uncertainty",
  "RCME-B3": "Document the meteorology process and the bounding-site assumptions",
  "RCAD-A1": "Select the dispersion model class and justify it for the release",
  "RCAD-A2": "Use steady-state at CC-I or hourly updates at CC-II",
  "RCAD-A3": "Use the centerline at CC-I or a justified two-dimensional grid at CC-II",
  "RCAD-A4": "Use the wind-field data consistent with the meteorology",
  "RCAD-A5": "Take the meteorology from the RCME data set",
  "RCAD-A6": "Specify the receptor locations for the consequence metric",
  "RCAD-A7": "Justify the dispersion for a bounding site",
  "RCAD-A8": "Account for the site characteristics in the dispersion",
  "RCAD-B1": "Use bounding meteorology at CC-I or sample the weather year at CC-II",
  "RCAD-B2": "Justify the weather sampling to shift the mean by less than ten percent",
  "RCAD-C1": "Apply the elevated-release algorithms with the justified height",
  "RCAD-C2": "Take no credit for plume rise at CC-I or credit it through buoyancy algorithms at CC-II",
  "RCAD-C3": "Apply the building-wake effects with the actual dimensions at CC-II",
  "RCAD-C4": "Treat the plume segmentation for single or multiple plumes",
  "RCAD-C5": "Account for the terrain effects where they matter",
  "RCAD-C6": "Calculate the air and ground concentration at each receptor",
  "RCAD-D1": "Account for the radioactive decay during transport",
  "RCAD-D2": "Account for the temporal changes across the release phases",
  "RCAD-D3": "Justify the dispersion treatment for the consequence metric",
  "RCAD-D4": "Confirm the dispersion results against expectation",
  "RCAD-E1": "Include dry deposition with a single velocity at CC-I or per particle size at CC-II",
  "RCAD-E2": "Set the dry-deposition velocities with the basis",
  "RCAD-E3": "Exclude wet deposition at CC-I or include precipitation-dependent washout at CC-II",
  "RCAD-E4": "Set the washout coefficients with the basis",
  "RCAD-E5": "Exclude source depletion at CC-I or include dry and wet depletion at CC-II",
  "RCAD-E6": "Exclude resuspension at CC-I or include it at CC-II",
  "RCAD-E7": "Demonstrate the conservatism direction of the deposition simplifications",
  "RCAD-F1": "Identify the dispersion and deposition model-uncertainty sources",
  "RCAD-F2": "Characterize the dispersion and deposition parameter uncertainty",
  "RCAD-F3": "Document the dispersion process and the bounding-site assumptions",
  "RCDO-A1": "Identify the five exposure pathways and justify excluding any",
  "RCDO-A2": "Use the dispersion results as the concentration input",
  "RCDO-A3": "Set the exposure period for each pathway with the basis",
  "RCDO-A4": "Use semi-infinite immersion at CC-I or a finite-plume deep dose at CC-II",
  "RCDO-A5": "Integrate the groundshine over the exposure period",
  "RCDO-A6": "Exclude the skin beta pathway at CC-I or include it at CC-II",
  "RCDO-A7": "Use one generic breathing rate at CC-I or a per-cohort rate at CC-II",
  "RCDO-A8": "Exclude ingestion at CC-I or include a generic intake at CC-II",
  "RCDO-A9": "Account for the shielding and the occupancy",
  "RCDO-A10": "Aggregate the dose across the pathways and the receptors",
  "RCDO-B1": "Use effective dose conversion factors at CC-I or organ-specific factors at CC-II",
  "RCDO-B2": "Take the dose conversion factors from a recognized source",
  "RCDO-C1": "Identify the dosimetry model-uncertainty sources",
  "RCDO-C2": "Characterize the dosimetry parameter uncertainty",
  "RCHE-A1": "Identify the early and the latent health effects to evaluate",
  "RCHE-A2": "Use simplified-organ parameters at CC-I or organ-specific dose-response at CC-II for early effects",
  "RCHE-A3": "Use simplified factors at CC-I or organ-specific factors with dose-rate effectiveness at CC-II",
  "RCHE-A4": "Keep the population age and gender homogeneous in both columns",
  "RCHE-A5": "Map the health effects to the chosen consequence metric",
  "RCHE-A6": "Account for the dose-rate effectiveness where it applies",
  "RCHE-A7": "Justify the health-effect set for a bounding site",
  "RCHE-B1": "Anchor every risk factor to an internationally recognized body",
  "RCHE-B2": "Record the version of each risk-factor source",
  "RCHE-B3": "Confirm the consistency of the risk factors across the effects",
  "RCHE-C1": "Identify the health-effect model-uncertainty sources",
  "RCHE-C2": "Characterize the health-effect parameter uncertainty",
  "RCHE-C3": "Document the health-effect process",
  "RCEC-A1": "List the cost categories, evacuation, relocation, land, crops, decontamination, use and medical",
  "RCEC-A2": "Define the parameters for each cost category",
  "RCEC-B1": "Use regional cost data applicable to the site",
  "RCEC-B2": "Take the costs from recognized economic sources",
  "RCEC-B3": "Adjust the costs to a common year with the consumer price index",
  "RCEC-B4": "Define the land-value and depreciation parameters",
  "RCEC-B5": "Define the agricultural and crop-loss parameters",
  "RCEC-B6": "Define the decontamination and recovery cost parameters",
  "RCEC-B7": "Estimate the regional costs for a bounding site prior to site selection",
  "RCEC-C1": "Identify the economic model-uncertainty sources",
  "RCEC-C2": "Characterize the economic parameter uncertainty",
  "RCEC-C3": "Document the economic process and the bounding-site assumptions",
  "RCQ-A1": "Demonstrate the codes against accepted algorithms",
  "RCQ-A2": "Identify the method-specific features and limits",
  "RCQ-A3": "Compile the event sequence families and their radiological consequences",
  "RCQ-B1": "Review the output files for error statements and unexpected zeros",
  "RCQ-B2": "Confirm the modeling by examining the results",
  "RCQ-B3": "Identify the risk-significant contributors per HLR-RI-B",
  "RCQ-C1": "Assess the model uncertainties from every sub-element",
  "RCQ-C2": "Characterize at CC-I or propagate with phenomena dependencies at CC-II",
  "RCQ-D1": "Document the quantification process and the codes",
  "RCQ-D2": "Document the model-uncertainty sources and the sensitivity results",
  "RCQ-D3": "Document the consequence table and the risk-significant contributors",
};

const RC_SR_META: Record<string, string> = {
  "RCRE-A1": "Site fork",
  "RCRE-A2": "9 inputs",
  "RCRE-B2": "6 aspects",
  "RCPA-A1": "5 actions",
  "RCPA-A4": "2 cohorts",
  "RCPA-A5": "Judgment SR",
  "RCPA-A9": "6 links",
  "RCPA-A11": "Cross-hazard",
  "RCME-A1": "Judgment SR",
  "RCME-A3": "92% recovery",
  "RCAD-B2": "Mean check open",
  "RCAD-C2": "Credit fence",
  "RCDO-A1": "5 pathways",
  "RCEC-A1": "7 categories",
  "RCQ-A1": "2 codes",
  "RCQ-A3": "3 families",
  "RCQ-B2": "Judgment SR",
  "RCQ-B3": "RI handshake",
  "RCQ-C1": "7 sources",
};

const RC_BOUNDING_SRS = new Set<string>([
  "RCPA-B1",
  "RCPA-B2",
  "RCPA-B5",
  "RCPA-B7",
  "RCME-A1",
  "RCME-A11",
  "RCAD-A7",
  "RCHE-A7",
  "RCEC-B1",
  "RCEC-B7",
]);

const RC_SR_LINKED_NM: Record<string, string> = {
  "RCPA-B1": "NM-091",
  "RCQ-C2": "NM-094",
  "RCAD-E2": "NM-097",
};

function buildConformanceItems(): ConformanceItem[] {
  return Object.keys(RC_SR_CATALOG).map((code) => {
    const meta = RC_SR_CATALOG[code];
    const boundingOnly = RC_BOUNDING_SRS.has(code);
    return {
      id: code,
      section: SUB_ELEMENT_SECTIONS[meta.subElement],
      subElement: meta.subElement,
      hlr: meta.hlr,
      text: `${code}: ${RC_SR_DESCRIPTIONS[code] ?? code}`,
      status: "warn" as const,
      requiredAt: ["cc-i", "cc-ii"],
      boundingOnly,
      meta: RC_SR_META[code] ?? (boundingOnly ? "Bounding site" : undefined),
      linkedNM: RC_SR_LINKED_NM[code],
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

const RC_METHODS: Record<string, MethodSpec> = {
  gaussian: { id: "gaussian", abbr: "Gaussian", name: "Straight-line Gaussian dispersion calculation", ref: "Regulatory dispersion methods" },
  segmented: { id: "segmented", abbr: "Segmented", name: "Segmented-plume dispersion calculation", ref: "Variable-trajectory plume methods" },
  montecarlo: { id: "montecarlo", abbr: "Sampling", name: "Probabilistic weather sampling", ref: "Monte Carlo or Latin Hypercube sampling" },
  dosimetry: { id: "dosimetry", abbr: "Dosimetry", name: "Pathway dose-integration calculation", ref: "Recognized dose-conversion data sets" },
  doseresp: { id: "doseresp", abbr: "Dose-risk", name: "Dose-response health-risk calculation", ref: "Internationally recognized risk models" },
  economic: { id: "economic", abbr: "Economic", name: "Off-site economic-cost calculation", ref: "Regional cost data and indices" },
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

const RC_UPSTREAM_LINKS: LinkSpec[] = [
  { id: "es", code: "ES", element: "Event Sequence Analysis", icon: "Tree", workbook: "ES Workbook Example", version: 3, status: "approved", synced: "May 20, 2026", delivers: "The release-category definitions RC reviews for the consequence input set", note: "ES defines the categories under ES-C1, which RCRE-A3 reviews against the input list.", role: "Categories in" },
  { id: "ms", code: "MS", element: "Mechanistic Source Term", icon: "Boxes", workbook: "MS Workbook Example", version: 1, status: "in_review", synced: "May 28, 2026", delivers: "The source-term table by species, release fraction, timing, form and elevation", note: "MS hands over the source term for each release category, which RCRE-A2 extracts as the nine consequence inputs.", role: "Source term in" },
  { id: "ri", code: "RI", element: "Risk Integration", icon: "Gauge", workbook: "RI Workbook Example", version: 1, status: "in_review", synced: "May 26, 2026", delivers: "The consequence metric to compute, taken from the intended application", note: "RI-A1 sets the consequence metric, and RI later pairs RC's consequence table with the ESQ frequencies.", role: "Metric in" },
];

const RC_DOWNSTREAM_LINKS: LinkSpec[] = [
  { id: "ri", code: "RI", element: "Risk Integration", icon: "Gauge", uses: "Pairs the family-by-family consequence with the ESQ frequency", note: "RI clamps the RCQ consequence table against the ESQ frequencies to close the risk equation.", role: "Consequence out" },
];

interface SiteOptionSpec {
  id: SiteBasis;
  name: string;
  tag: string;
  icon: string;
  desc: string;
  meta: string;
}

const SITE_OPTIONS: SiteOptionSpec[] = [
  { id: "actual_site", name: "Identify the actual site", tag: "Site selected", icon: "Pin", desc: "Use the identified site and its real population, land use and geography.", meta: "No site-gap assumptions are carried." },
  { id: "bounding_site", name: "Describe a bounding site", tag: "Prior to site selection", icon: "Globe", desc: "Use a bounding site and justify that it bounds every site in the PRA scope.", meta: "Site-gap assumptions are logged for closure at site selection." },
];

interface HandoffInputSpec {
  id: string;
  label: string;
  note: string;
  icon: string;
}

const HANDOFF_INPUTS: HandoffInputSpec[] = [
  { id: "plumes", label: "Number of plumes", note: "The count of distinct plumes released per category.", icon: "Wind" },
  { id: "fractions", label: "Release fractions per group", note: "The released fraction for each radionuclide group.", icon: "Sigma" },
  { id: "isotopes", label: "Dose-important radionuclides", note: "The species that drive the dose, with the basis for the set.", icon: "Atom" },
  { id: "timing", label: "Timing and duration", note: "The start time and the duration of each release phase.", icon: "Clock" },
  { id: "warning", label: "Warning time", note: "The time available to act before the release begins.", icon: "Bell" },
  { id: "energy", label: "Release energy", note: "The thermal energy that drives the plume buoyancy.", icon: "Thermo" },
  { id: "height", label: "Release height", note: "The elevation at which the release enters the atmosphere.", icon: "Ruler" },
  { id: "particle", label: "Particle size", note: "The aerosol size distribution that sets the deposition.", icon: "Dust" },
  { id: "uncert", label: "Release uncertainties", note: "The uncertainty carried with each source-term input.", icon: "Curve" },
];

const CONSEQUENCE_METRIC_NOTES: Record<string, string> = {
  "Early fatality risk": "The risk of an early fatality at the site boundary.",
  "Latent cancer risk": "The latent cancer risk within the consequence area.",
  "Individual dose": "The dose at fixed downwind distances.",
};

interface ScopingAspectSpec {
  aspect: string;
  se: RcSubElement;
  degreeKey: "protectiveActionsModellingDegree" | "meteorologyModellingDegree" | "atmosphericDispersionModellingDegree" | "dosimetryModellingDegree" | "healthEffectsModellingDegree" | "economicFactorsModellingDegree";
  level: "full" | "partial" | "screened";
}

const SCOPING_ASPECTS: ScopingAspectSpec[] = [
  { aspect: "Protective actions", se: "RCPA", degreeKey: "protectiveActionsModellingDegree", level: "full" },
  { aspect: "Meteorology", se: "RCME", degreeKey: "meteorologyModellingDegree", level: "full" },
  { aspect: "Atmospheric dispersion", se: "RCAD", degreeKey: "atmosphericDispersionModellingDegree", level: "full" },
  { aspect: "Dosimetry", se: "RCDO", degreeKey: "dosimetryModellingDegree", level: "full" },
  { aspect: "Health effects", se: "RCHE", degreeKey: "healthEffectsModellingDegree", level: "full" },
  { aspect: "Economic factors", se: "RCEC", degreeKey: "economicFactorsModellingDegree", level: "partial" },
];

const SCOPE_LEVEL_LABELS: Record<string, string> = { full: "Full", partial: "Partial", screened: "Screened" };

const PROTECTIVE_ACTION_LABELS: Record<string, { name: string; icon: string }> = {
  EVACUATION: { name: "Evacuation", icon: "Car" },
  SHELTERING: { name: "Sheltering", icon: "Home" },
  RELOCATION: { name: "Relocation", icon: "Users" },
  LAND_INTERDICTION_REMEDIATION: { name: "Land interdiction and remediation", icon: "Leaf" },
  FOOD_INTERDICTION_REMEDIATION: { name: "Food interdiction and remediation", icon: "Beaker" },
};

const INCIDENT_PHASE_LABELS: Record<string, { name: string; window: string }> = {
  EARLY: { name: "Early phase", window: "Hours to days" },
  INTERMEDIATE: { name: "Intermediate phase", window: "Weeks to months" },
  LATE_LONG_TERM: { name: "Late phase", window: "Months to years" },
};

const EVAC_DELAY_LABELS: Record<string, string> = {
  GENERAL_EMERGENCY_DECLARATION: "General emergency is declared",
  SITE_NOTIFIES_OFFICIALS: "Site notifies the offsite officials",
  OFFICIALS_NOTIFY_PUBLIC: "Officials notify the public",
  PUBLIC_RECEIVES_INSTRUCTIONS: "Public receives the instructions",
  SECURE_PERSONAL_PROPERTY: "People secure personal property",
  LOAD_VEHICLES: "People load vehicles and depart",
};

const EVAC_DELAY_TOTAL = "About 100 minutes from declaration to movement.";

const EVAC_SPEED_FACTOR_LABELS: [keyof EvacSpeedFlags, string][] = [
  ["daytimeNighttimeConsidered", "Day and night"],
  ["adverseWeatherConsidered", "Adverse weather"],
  ["specialEventsConsidered", "Special events that double traffic"],
  ["transientPopulationsConsidered", "Transient populations"],
];

interface EvacSpeedFlags {
  daytimeNighttimeConsidered: boolean;
  adverseWeatherConsidered: boolean;
  specialEventsConsidered: boolean;
  transientPopulationsConsidered: boolean;
}

const SITE_DATA_BASIS_LABELS: Record<string, { label: string; kind: "rich" | "simple" }> = {
  ASSUMED_JUSTIFIED: { label: "Assumed and justified", kind: "simple" },
  DEMOGRAPHIC_SOURCES: { label: "Census demographics", kind: "rich" },
  GENERIC_SIMPLIFIED: { label: "Generic", kind: "simple" },
  REGIONAL_SPECIFIC: { label: "Regional", kind: "rich" },
  ESTIMATED: { label: "Estimated", kind: "simple" },
  ACTUAL: { label: "Actual", kind: "rich" },
};

interface LadderSpec {
  cci: { title: string; desc: string; tag: string };
  ccii: { title: string; desc: string; tag: string };
  note: string;
}

const MET_PERIOD_LADDER: LadderSpec = {
  cci: { title: "Use a representative single year", desc: "Use one representative one-year period of hourly data.", tag: "One justified year" },
  ccii: { title: "Evaluate multiple years to select", desc: "Evaluate multiple years to select the representative year.", tag: "Selected from many" },
  note: "The selected year is justified to represent the long-term meteorology at the site.",
};

const MET_PARAM_CHIPS: { id: string; label: string; icon: string; ccii?: boolean }[] = [
  { id: "wind", label: "Wind at 10 m", icon: "Wind" },
  { id: "stab", label: "Stability class", icon: "Layers" },
  { id: "precip", label: "Precipitation", icon: "Rain", ccii: true },
  { id: "mixing", label: "Mixing heights", icon: "Mountain" },
];

const DISPERSION_LADDER: LadderSpec = {
  cci: { title: "Straight-line Gaussian on the centerline", desc: "Run a steady-state Gaussian plume along the centerline.", tag: "Steady and simple" },
  ccii: { title: "Segmented plume on a justified grid", desc: "Run a segmented plume with hourly wind and stability updates on a two-dimensional grid.", tag: "Hourly and resolved" },
  note: "The model class is justified for the release duration and the downwind distances of interest.",
};

const DISPERSION_CLASS_LABELS: Record<string, string> = {
  STRAIGHT_LINE_GAUSSIAN: "Straight-line Gaussian",
  SEGMENTED_PLUME: "Segmented plume",
  OTHER_VARIABLE_TRAJECTORY: "Variable trajectory",
};

const DISPERSION_MODEL_METHOD: Record<string, string> = {
  STRAIGHT_LINE_GAUSSIAN: "gaussian",
  SEGMENTED_PLUME: "segmented",
  OTHER_VARIABLE_TRAJECTORY: "segmented",
};

const SAMPLING_LADDER: LadderSpec = {
  cci: { title: "Bounding meteorology", desc: "Use a bounding dispersion factor, a fifth-percentile condition.", tag: "One bounding case" },
  ccii: { title: "Sample the weather year", desc: "Sample the weather year, justified to shift the mean by less than ten percent.", tag: "Validated sampling" },
  note: "The sampling is the third customer of the uncertainty machinery, after the source term and the quantification.",
};

interface CreditFenceSpec {
  id: string;
  name: string;
  icon: string;
  note: string;
  cci: { text: string; detail: string };
  cciiText: string;
}

const CREDIT_FENCE: CreditFenceSpec[] = [
  { id: "plumerise", name: "Plume rise", icon: "Wind", note: "Credit for the plume rising above the buildings before it disperses.", cci: { text: "Not credited", detail: "DO NOT TAKE CREDIT for plume rise at CC-I." }, cciiText: "Earned" },
  { id: "elevated", name: "Elevated release", icon: "Ruler", note: "Credit for the release entering the atmosphere above ground level.", cci: { text: "Ground level", detail: "Treated as a ground-level release at CC-I." }, cciiText: "Earned" },
  { id: "wake", name: "Building-wake effects", icon: "Home", note: "Credit for the reactor building mixing the plume in its wake.", cci: { text: "Not credited", detail: "Building-wake mixing is not credited at CC-I." }, cciiText: "Earned" },
];

interface DepositionRowSpec {
  id: "dry" | "wet" | "depletion" | "resusp";
  process: string;
  note: string;
  cci: { on: boolean; detail: string };
}

const DEPOSITION_ROWS: DepositionRowSpec[] = [
  { id: "dry", process: "Dry deposition", note: "Particles settle to the ground without rain.", cci: { on: true, detail: "A single dry-deposition velocity." } },
  { id: "wet", process: "Wet deposition", note: "Rain washes the plume to the ground.", cci: { on: false, detail: "Not included." } },
  { id: "depletion", process: "Source depletion", note: "The plume loses mass as it deposits.", cci: { on: false, detail: "Not included, the plume is not depleted." } },
  { id: "resusp", process: "Resuspension", note: "Deposited material lifts back into the air.", cci: { on: false, detail: "Not included." } },
];

const DEPOSITION_NOTE = "Omitting wet deposition at CC-I lowers the local groundshine but keeps the plume concentrated downwind, so the simplification is not strictly conservative.";

const EXPOSURE_PATHWAY_LABELS: Record<string, { name: string; icon: string; ccii?: boolean }> = {
  CLOUDSHINE: { name: "Cloudshine", icon: "Cloud" },
  GROUNDSHINE: { name: "Groundshine", icon: "Mountain" },
  SKIN_DEPOSITION: { name: "Skin deposition", icon: "Person", ccii: true },
  INHALATION: { name: "Inhalation", icon: "Lungs" },
  INGESTION: { name: "Ingestion", icon: "Beaker", ccii: true },
};

const EXPOSURE_PATHWAY_NOTES: Record<string, string> = {
  CLOUDSHINE: "External dose from the radionuclides in the passing cloud.",
  GROUNDSHINE: "External dose from the radionuclides deposited on the ground.",
  SKIN_DEPOSITION: "Beta dose from the material deposited on the skin, on at CC-II.",
  INHALATION: "Internal dose from breathing the radionuclides in the plume.",
  INGESTION: "Internal dose from contaminated food and water, generic intake at CC-II.",
};

interface DoseSplitSpec {
  id: string;
  title: string;
  icon: string;
  cci: string;
  ccii: string;
}

const DOSE_SPLITS: DoseSplitSpec[] = [
  { id: "cloud", title: "Cloud immersion", icon: "Cloud", cci: "Semi-infinite cloud immersion.", ccii: "Finite-plume deep dose with the cloud geometry corrected." },
  { id: "breath", title: "Breathing rates", icon: "Lungs", cci: "One generic breathing rate.", ccii: "A justified breathing rate per cohort." },
  { id: "ingest", title: "Ingestion treatment", icon: "Beaker", cci: "Ingestion excluded.", ccii: "Generic ingestion intake included." },
  { id: "dcf", title: "Dose conversion factors", icon: "Sigma", cci: "Effective dose conversion factors.", ccii: "Organ-specific dose conversion factors." },
];

const HE_PARAM_SPLITS: DoseSplitSpec[] = [
  { id: "early", title: "Early-effect parameters", icon: "Pulse", cci: "Simplified-organ, reduced-radionuclide parameter set.", ccii: "Organ-specific dose-response parameters." },
  { id: "latent", title: "Latent-effect parameters", icon: "Heart", cci: "Simplified effective-dose, reduced-radionuclide set.", ccii: "Organ-specific factors with the dose-rate effectiveness and the incidence and fatality split." },
];

const HE_AGE_GENDER = "The population is kept age and gender homogeneous in both columns, since the standard declines that refinement.";
const HE_BASIS = "Every risk factor is anchored to an internationally recognized body, not a local derivation.";

const COST_CATEGORY_ICONS: Record<string, string> = {
  "Evacuation cost": "Car",
  "Relocation and temporary unemployment": "Users",
  "Land value and depreciation": "Map",
  "Crop losses": "Leaf",
  "Decontamination": "Beaker",
  "Loss of use": "Home",
  "Medical costs": "Heart",
};

const ECONOMIC_ROW_META: Record<string, { icon: string; tag: string; kind: "rich" | "simple" }> = {
  "Regional cost data": { icon: "Map", tag: "Bounding site", kind: "simple" },
  "Recognized sources": { icon: "Database", tag: "Recognized", kind: "rich" },
  "Inflation adjustment": { icon: "Dollar", tag: "CPI", kind: "rich" },
};

const RC_CODE_ICONS: Record<string, string> = {
  "Consequence pipeline code": "Cpu",
  "Weather-sampling driver": "Curve",
};

interface UncertaintySourceSpec {
  se: RcSubElement;
  tone: SubElementTone;
  source: string;
  srs: string;
}

const UNCERTAINTY_SOURCES: UncertaintySourceSpec[] = [
  { se: "RCRE", tone: "primary", source: "Source-term carryover", srs: "RCRE-C1" },
  { se: "RCPA", tone: "site", source: "Protective-action timing", srs: "RCPA-C2" },
  { se: "RCME", tone: "atmos", source: "Weather-year representativeness", srs: "RCME-B2" },
  { se: "RCAD", tone: "atmos", source: "Dispersion and deposition", srs: "RCAD-F2" },
  { se: "RCDO", tone: "health", source: "Dose conversion", srs: "RCDO-C1" },
  { se: "RCHE", tone: "health", source: "Dose-response factors", srs: "RCHE-C1" },
  { se: "RCEC", tone: "site", source: "Cost parameters", srs: "RCEC-C1" },
];

const RISK_SIGNIFICANCE_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

const MU_SR: Record<string, string> = {
  RCRE: "RCRE-C1",
  RCPA: "RCPA-C2",
  RCME: "RCME-B2",
  RCAD: "RCAD-F2",
  RCDO: "RCDO-C1",
  RCHE: "RCHE-C1",
  RCEC: "RCEC-C1",
  RCQ: "RCQ-C1",
};

const BS_SR: Record<string, string> = {
  "BS-1": "RCPA-B1",
  "BS-2": "RCPA-B1",
  "BS-3": "RCME-A1",
  "BS-4": "RCEC-B7",
};

const SS_SR: Record<string, string> = {
  "SS-1": "RCAD-B2",
  "SS-2": "RCPA-A9",
  "SS-3": "RCAD-C2",
};

const SURROGATE_METRIC_NOTE = "The consequence axis of the frequency-consequence target is computed here, and RI pairs it with the ESQ frequency.";

const RC_TOC: [string, string][] = [
  ["Executive Summary", "5"],
  ["Introduction", "6"],
  ["    Purpose, Scope & Relationship", "6"],
  ["    Document Layout", "6"],
  ["    Quality Assurance & Freeze Date", "6"],
  ["Assumptions and Limitations", "7"],
  ["Release Category to Radiological Consequence", "8"],
  ["    Figures of Merit · Dose Categories", "8"],
  ["    Release Characterization", "8"],
  ["Protective Action Parameters and Other Site Data", "9"],
  ["Meteorological Data", "10"],
  ["Atmospheric Transport and Dispersion", "11"],
  ["    Model · Event Sequence Changes · Deposition", "11"],
  ["Dosimetry", "12"],
  ["Health Effects", "13"],
  ["Economic Factors", "14"],
  ["Consequence Quantification", "15"],
  ["    Modeling and Simulation Codes", "15"],
  ["Results", "16"],
  ["Uncertainty Analysis", "17"],
  ["Sensitivity Analyses", "18"],
  ["References", "19"],
];

export type {
  RcStep,
  StepStatus,
  SubElementTone,
  RcPersona,
  PersonaSpec,
  CapabilityCategory,
  ConformanceItem,
  ConformanceStatus,
  SiteBasis,
  MethodSpec,
  LinkSpec,
  SiteOptionSpec,
  HandoffInputSpec,
  ScopingAspectSpec,
  LadderSpec,
  CreditFenceSpec,
  DepositionRowSpec,
  DoseSplitSpec,
  UncertaintySourceSpec,
};

export {
  RC_STEPS,
  RC_PERSONAS,
  RC_PERSONA_STEPS,
  CAPABILITY_CATEGORIES,
  CONFORMANCE_ITEMS,
  SUB_ELEMENT_SECTIONS,
  SUB_ELEMENT_TONES,
  RC_BOUNDING_SRS,
  RC_SR_LINKED_NM,
  RC_METHODS,
  RC_UPSTREAM_LINKS,
  RC_DOWNSTREAM_LINKS,
  SITE_OPTIONS,
  HANDOFF_INPUTS,
  CONSEQUENCE_METRIC_NOTES,
  SCOPING_ASPECTS,
  SCOPE_LEVEL_LABELS,
  PROTECTIVE_ACTION_LABELS,
  INCIDENT_PHASE_LABELS,
  EVAC_DELAY_LABELS,
  EVAC_DELAY_TOTAL,
  EVAC_SPEED_FACTOR_LABELS,
  SITE_DATA_BASIS_LABELS,
  MET_PERIOD_LADDER,
  MET_PARAM_CHIPS,
  DISPERSION_LADDER,
  DISPERSION_CLASS_LABELS,
  DISPERSION_MODEL_METHOD,
  SAMPLING_LADDER,
  CREDIT_FENCE,
  DEPOSITION_ROWS,
  DEPOSITION_NOTE,
  EXPOSURE_PATHWAY_LABELS,
  EXPOSURE_PATHWAY_NOTES,
  DOSE_SPLITS,
  HE_PARAM_SPLITS,
  HE_AGE_GENDER,
  HE_BASIS,
  COST_CATEGORY_ICONS,
  ECONOMIC_ROW_META,
  RC_CODE_ICONS,
  UNCERTAINTY_SOURCES,
  RISK_SIGNIFICANCE_LABELS,
  MU_SR,
  BS_SR,
  SS_SR,
  SURROGATE_METRIC_NOTE,
  RC_TOC,
};

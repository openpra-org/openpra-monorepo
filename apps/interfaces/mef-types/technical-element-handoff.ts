type HandoffElement = "POS" | "IE" | "SC" | "SY" | "HRA" | "DA" | "ES" | "ESQ" | "MS" | "RC" | "RI";

interface HandoffSectionSpec {
  element: HandoffElement;
  key: string;
  name: string;
  contents: string;
  readers: readonly HandoffElement[];
}

const HANDOFF_ELEMENTS: readonly HandoffElement[] = ["POS", "IE", "SC", "SY", "HRA", "DA", "ES", "ESQ", "MS", "RC", "RI"];

const HANDOFF_ELEMENT_CODES: Record<HandoffElement, string> = {
  POS: "POS",
  IE: "IE",
  SC: "SC",
  SY: "SY",
  HRA: "HR",
  DA: "DA",
  ES: "ES",
  ESQ: "ESQ",
  MS: "MS",
  RC: "RC",
  RI: "RI",
};

const HANDOFF_ELEMENT_NAMES: Record<HandoffElement, string> = {
  POS: "Plant Operating States",
  IE: "Initiating Events",
  SC: "Success Criteria",
  SY: "Systems Analysis",
  HRA: "Human Reliability Analysis",
  DA: "Data Analysis",
  ES: "Event Sequence Analysis",
  ESQ: "Event Sequence Quantification",
  MS: "Mechanistic Source Term",
  RC: "Radiological Consequence",
  RI: "Risk Integration",
};

const HANDOFF_SECTIONS = [
  { element: "POS", key: "operating-states", name: "Operating states", contents: "Each state with its mode, mean duration, entry frequency and time fraction.", readers: ["IE", "SC", "SY", "HRA", "DA", "ES", "ESQ", "RI"] },
  { element: "POS", key: "sources-and-barriers", name: "Sources and barriers", contents: "Radioactive material sources with location and barriers, and radionuclide transport barriers with status, breach criteria and monitoring.", readers: ["IE", "SC", "ES", "ESQ", "MS", "RI"] },
  { element: "POS", key: "hazard-groups", name: "Hazard groups", contents: "Hazard group reviews.", readers: ["ESQ", "RI"] },
  { element: "POS", key: "screening", name: "Screening", contents: "State screening records with the retained decision and its justification.", readers: ["RI"] },
  { element: "POS", key: "assumptions", name: "Assumptions", contents: "Model uncertainty and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "IE", key: "initiator-groups", name: "Initiator groups", contents: "Groups with their members, bounding initiator and applicable operating states.", readers: ["SC", "HRA", "DA", "ES", "ESQ"] },
  { element: "IE", key: "frequencies", name: "Frequencies", contents: "Each group's frequency with its basis and DA source.", readers: ["DA", "ESQ"] },
  { element: "IE", key: "barrier-impacts", name: "Barrier impacts", contents: "The barrier impacts of each initiator.", readers: ["ESQ"] },
  { element: "IE", key: "screened-initiators", name: "Screened initiators", contents: "Screening status, frequency, criterion and basis of screened initiators.", readers: ["ESQ"] },
  { element: "IE", key: "module-count", name: "Module count", contents: "Modules per plant.", readers: ["DA", "ESQ"] },
  { element: "IE", key: "assumptions", name: "Assumptions", contents: "Model uncertainty and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "SC", key: "success-criteria", name: "Success criteria", contents: "Overall success criteria with their key safety functions and sequence references.", readers: ["SY", "DA", "ES"] },
  { element: "SC", key: "system-criteria", name: "System criteria", contents: "System success criteria with required capacities and system dependencies.", readers: ["SY"] },
  { element: "SC", key: "end-states", name: "End states", contents: "End state definitions with their release category references.", readers: ["ES"] },
  { element: "SC", key: "mission-times", name: "Mission times", contents: "Mission times and component mission times.", readers: ["SY", "DA", "ESQ"] },
  { element: "SC", key: "barrier-criteria", name: "Barrier criteria", contents: "Radionuclide barrier criteria.", readers: ["ESQ", "ES"] },
  { element: "SC", key: "operator-criteria", name: "Operator criteria", contents: "Human action success criteria with time available.", readers: ["HRA", "ES"] },
  { element: "SC", key: "assumptions", name: "Assumptions", contents: "Model uncertainty and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "SY", key: "systems", name: "Systems", contents: "System definitions with name, abbreviation and mission time.", readers: ["HRA", "ES", "ESQ"] },
  { element: "SY", key: "fault-trees", name: "Fault trees", contents: "Logic models with top gate, gates, events and transfers.", readers: ["DA", "ES", "ESQ"] },
  { element: "SY", key: "basic-events", name: "Basic events", contents: "Basic events with their values, value sources and failure modes.", readers: ["DA", "ES", "ESQ"] },
  { element: "SY", key: "common-cause-groups", name: "Common cause groups", contents: "Groups with members, factors and totals.", readers: ["DA", "ESQ"] },
  { element: "SY", key: "dependency-networks", name: "Dependency networks", contents: "Bayesian networks and their HCL configurations.", readers: ["ES", "ESQ"] },
  { element: "SY", key: "qualification", name: "Qualification", contents: "Environmental design basis and over-capacity considerations.", readers: ["ESQ"] },
  { element: "SY", key: "assumptions", name: "Assumptions", contents: "Model uncertainty, uncertainty analyses and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "HRA", key: "human-failure-events", name: "Human failure events", contents: "Human failure events with their HEP quantifications.", readers: ["SY", "DA", "ESQ"] },
  { element: "HRA", key: "operator-actions", name: "Operator actions", contents: "Post-initiator actions with cue, time available and time required.", readers: ["ESQ", "ES"] },
  { element: "HRA", key: "recovery-actions", name: "Recovery actions", contents: "Recovery actions and their HEPs.", readers: ["DA", "ESQ"] },
  { element: "HRA", key: "dependence", name: "Dependence", contents: "Dependence assessments and the joint HEP floor.", readers: ["ESQ"] },
  { element: "HRA", key: "assumptions", name: "Assumptions", contents: "Model uncertainty and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "DA", key: "parameters", name: "Parameters", contents: "Parameter estimates (rates, probabilities, frequencies and HEPs) with distributions and mission times.", readers: ["IE", "SY", "HRA", "ESQ"] },
  { element: "DA", key: "failure-modes", name: "Failure modes", contents: "Failure modes and component boundaries.", readers: ["SY"] },
  { element: "DA", key: "common-cause", name: "Common cause", contents: "Common cause estimations, vectors and factors.", readers: ["SY", "ESQ"] },
  { element: "DA", key: "maintenance", name: "Maintenance", contents: "Coincident maintenance unavailabilities.", readers: ["SY"] },
  { element: "DA", key: "outages", name: "Outages", contents: "Outage hours and entries per year for each operating state.", readers: ["POS"] },
  { element: "DA", key: "uncertainty", name: "Uncertainty", contents: "Uncertainty register, sensitivity cases and pre-operational assumptions.", readers: ["ESQ"] },

  { element: "ES", key: "scope", name: "Scope", contents: "Initiator groups, operating states and sources in scope.", readers: ["SY", "ESQ"] },
  { element: "ES", key: "safety-functions", name: "Safety functions", contents: "Key safety functions with their supporting systems.", readers: ["SC", "SY"] },
  { element: "ES", key: "event-trees", name: "Event trees", contents: "Trees with functional events, fault tree links, sequences and transfers.", readers: ["ESQ", "RI"] },
  { element: "ES", key: "sequences", name: "Sequences", contents: "Sequence records with path, end state, family and release category.", readers: ["SC", "ESQ", "RI"] },
  { element: "ES", key: "families", name: "Families", contents: "Families with members, release categories and representative initiator and state.", readers: ["ESQ", "MS", "RC", "RI"] },
  { element: "ES", key: "release-categories", name: "Release categories", contents: "Release categories with their sequences.", readers: ["MS", "RC"] },
  { element: "ES", key: "screening", name: "Screening", contents: "Screening records.", readers: ["RI"] },
  { element: "ES", key: "dependency-networks", name: "Dependency networks", contents: "Bayesian networks and their HCL configurations.", readers: ["ESQ"] },
  { element: "ES", key: "timing", name: "Timing and phenomena", contents: "Sequence timelines, operator-action windows, phenomenological conditions and repair credit.", readers: ["HRA", "ESQ"] },
  { element: "ES", key: "dynamic-runs", name: "Dynamic runs", contents: "Dynamic PRA runs and their branches.", readers: ["ESQ"] },
  { element: "ES", key: "uncertainty", name: "Uncertainty", contents: "Model uncertainty register, sensitivity proposals, pre-operational assumptions and sequence and family assumptions.", readers: ["ESQ", "RI"] },

  { element: "ESQ", key: "frequencies", name: "Frequencies", contents: "Family and sequence frequencies with uncertainty and contributors.", readers: ["RI"] },
  { element: "ESQ", key: "importance", name: "Importance", contents: "Importance analyses.", readers: ["DA", "RI"] },
  { element: "ESQ", key: "coverage", name: "Coverage", contents: "Scope coverage and multi-reactor sequences.", readers: ["RI"] },
  { element: "ESQ", key: "uncertainty", name: "Uncertainty", contents: "Uncertainty assessments, sensitivity studies and the screened-event assessment.", readers: ["DA", "RI"] },
  { element: "ESQ", key: "created-values", name: "Values ESQ created", contents: "Values typed in ESQ: initiator frequencies, split fractions, basic event values, joint HEPs and non-recovery HEPs.", readers: ["DA"] },
  { element: "ESQ", key: "responses", name: "Responses", contents: "Responses to RI feedback.", readers: ["RI"] },

  { element: "MS", key: "source-terms", name: "Source terms", contents: "Source term definitions with release phases, nuclide releases and elevation, plus source inventories, transport assessments and bounding sequences.", readers: ["RC"] },
  { element: "MS", key: "uncertainty", name: "Uncertainty", contents: "Model uncertainty assessments and sensitivity studies.", readers: ["RI"] },
  { element: "MS", key: "responses", name: "Responses", contents: "Responses to RI feedback.", readers: ["RI"] },

  { element: "RC", key: "consequences", name: "Consequences", contents: "Consequence metrics and results for each release category and family.", readers: ["RI"] },
  { element: "RC", key: "uncertainty", name: "Uncertainty", contents: "Model uncertainty assessments.", readers: ["RI"] },
  { element: "RC", key: "responses", name: "Responses", contents: "Responses to RI feedback.", readers: ["RI"] },

  { element: "RI", key: "criteria", name: "Criteria", contents: "Relative importance criteria for Fussell-Vesely, risk achievement worth, the aggregate and individual limits, and the minimum reporting frequency.", readers: ["ESQ"] },
  { element: "RI", key: "consequence-measures", name: "Consequence measures", contents: "The consequence measures in scope.", readers: ["RC"] },
  { element: "RI", key: "feedback-to-esq", name: "Feedback to ESQ", contents: "Family and contributor feedback.", readers: ["ESQ"] },
  { element: "RI", key: "feedback-to-ms", name: "Feedback to MS", contents: "Release category and source term feedback.", readers: ["MS"] },
  { element: "RI", key: "feedback-to-rc", name: "Feedback to RC", contents: "Metric and release category feedback.", readers: ["RC"] },
  { element: "RI", key: "feedback-to-other-elements", name: "Feedback to other elements", contents: "Significance, reasons, recommendations and messages for POS, IE, ES, SC, SY, HR and DA.", readers: ["POS", "IE", "ES", "SC", "SY", "HRA", "DA"] },
] as const satisfies readonly HandoffSectionSpec[];

type HandoffSectionKey = (typeof HANDOFF_SECTIONS)[number]["key"];

interface HandoffSection extends Omit<HandoffSectionSpec, "key"> {
  key: HandoffSectionKey;
}

const ALL_HANDOFF_SECTIONS: readonly HandoffSection[] = HANDOFF_SECTIONS;

function handoffAddress(section: Pick<HandoffSection, "element" | "name">): string {
  return `${HANDOFF_ELEMENT_CODES[section.element]}.${section.name}`;
}

function handoffSectionsOf(element: HandoffElement): HandoffSection[] {
  return ALL_HANDOFF_SECTIONS.filter((section) => section.element === element);
}

function handoffSection(element: HandoffElement, key: HandoffSectionKey): HandoffSection | undefined {
  return ALL_HANDOFF_SECTIONS.find((section) => section.element === element && section.key === key);
}

function importedSections(consumer: HandoffElement, producer: HandoffElement): HandoffSection[] {
  return ALL_HANDOFF_SECTIONS.filter((section) => section.element === producer && section.readers.includes(consumer));
}

function importedProducers(consumer: HandoffElement): HandoffElement[] {
  return HANDOFF_ELEMENTS.filter((producer) => importedSections(consumer, producer).length > 0);
}

function importedAddresses(consumer: HandoffElement, producer: HandoffElement): string {
  return importedSections(consumer, producer).map(handoffAddress).join(" · ");
}

export {
  HANDOFF_ELEMENTS,
  HANDOFF_ELEMENT_CODES,
  HANDOFF_ELEMENT_NAMES,
  ALL_HANDOFF_SECTIONS,
  handoffAddress,
  handoffSection,
  handoffSectionsOf,
  importedAddresses,
  importedProducers,
  importedSections,
};
export type { HandoffElement, HandoffSection, HandoffSectionKey };

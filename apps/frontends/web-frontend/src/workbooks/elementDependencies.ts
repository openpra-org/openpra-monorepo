type ElementCode = "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC" | "RI";

interface ElementMeta {
  code: ElementCode;
  name: string;
  icon: string;
}

const ELEMENT_META: Record<ElementCode, ElementMeta> = {
  POS: { code: "POS", name: "Plant Operating States", icon: "Layers" },
  IE: { code: "IE", name: "Initiating Event Analysis", icon: "Bolt" },
  ES: { code: "ES", name: "Event Sequence Analysis", icon: "Tree" },
  SC: { code: "SC", name: "Success Criteria Development", icon: "Target" },
  SY: { code: "SY", name: "Systems Analysis", icon: "Settings" },
  HR: { code: "HR", name: "Human Reliability Analysis", icon: "Person" },
  DA: { code: "DA", name: "Data Analysis", icon: "Database" },
  ESQ: { code: "ESQ", name: "Event Sequence Quantification", icon: "Sigma" },
  MS: { code: "MS", name: "Mechanistic Source Term", icon: "Atom" },
  RC: { code: "RC", name: "Radiological Consequence", icon: "Wind" },
  RI: { code: "RI", name: "Risk Integration", icon: "Scale" },
};

interface LaneEntry {
  element: ElementCode;
  role: string;
  detail: string;
}

interface ElementInterface {
  inputs: LaneEntry[];
  bidirectional: LaneEntry[];
  outputs: LaneEntry[];
  funnelsToEsq: boolean;
}

const ELEMENT_INTERFACE: Record<ElementCode, ElementInterface> = {
  POS: {
    inputs: [],
    bidirectional: [],
    outputs: [
      { element: "IE", role: "Operating states", detail: "Every initiating-event search runs against these states." },
      { element: "ES", role: "Operating states", detail: "Each event sequence is delineated within them." },
      { element: "SC", role: "Operating states", detail: "Each success criterion is set for a state and evolution." },
      { element: "SY", role: "Alignments", detail: "The per-state alignments the system models assume." },
      { element: "HR", role: "Operating states", detail: "The states and timing windows the human actions sit in." },
      { element: "DA", role: "Per-state context", detail: "The states and outage timelines behind the parameter time fractions." },
    ],
    funnelsToEsq: true,
  },
  IE: {
    inputs: [
      { element: "POS", role: "Operating states", detail: "The states the initiating-event search runs against." },
      { element: "MS", role: "Sources & barriers", detail: "The radionuclide sources and transport barriers for source-related events." },
    ],
    bidirectional: [],
    outputs: [
      { element: "ES", role: "Initiating events", detail: "The grouped initiating events each sequence begins from." },
      { element: "ESQ", role: "Frequencies", detail: "The frequencies and the screened set the quantification consumes." },
      { element: "HR", role: "Support fault trees", detail: "The support-system initiating fault trees the recovery analysis builds on." },
      { element: "SC", role: "Challenges", detail: "The initiating-event challenges the success criteria are set against." },
    ],
    funnelsToEsq: true,
  },
  ES: {
    inputs: [
      { element: "IE", role: "Initiating events", detail: "The events each sequence begins from." },
      { element: "POS", role: "Operating states", detail: "The states each sequence is delineated within." },
      { element: "DA", role: "Repair data", detail: "The repair data behind any credited recovery." },
    ],
    bidirectional: [
      { element: "SC", role: "Success criteria", detail: "Success criteria delineate the sequences, and the sequences set the functions the criteria are written for." },
      { element: "MS", role: "Release categories", detail: "End states define the release categories, which the source term characterizes." },
    ],
    outputs: [
      { element: "SY", role: "Sequences", detail: "The sequences and end states the system models support." },
      { element: "RC", role: "Release categories", detail: "The release-category end states the consequence analysis takes." },
      { element: "ESQ", role: "Sequence model", detail: "The integrated sequence model the quantification solves." },
    ],
    funnelsToEsq: true,
  },
  SC: {
    inputs: [
      { element: "POS", role: "Operating states", detail: "The states and evolutions each criterion is set for." },
      { element: "IE", role: "Challenges", detail: "The initiating-event challenges the criteria respond to." },
    ],
    bidirectional: [
      { element: "ES", role: "Safety functions", detail: "The sequences set the functions, and the criteria delineate the sequences." },
    ],
    outputs: [
      { element: "SY", role: "System missions", detail: "The success criteria the system models must meet." },
      { element: "ESQ", role: "Passive criteria", detail: "The passive-means criteria the quantification carries." },
    ],
    funnelsToEsq: true,
  },
  SY: {
    inputs: [
      { element: "ES", role: "Sequences", detail: "The sequences and top events the systems are modeled for." },
      { element: "SC", role: "Top events", detail: "The success criteria the system models are built to." },
      { element: "POS", role: "Alignments", detail: "The per-state alignments the models assume." },
    ],
    bidirectional: [
      { element: "DA", role: "Parameters", detail: "Systems hands the basic events to fill, data hands back the probabilities and CCF parameters." },
      { element: "HR", role: "Human failure events", detail: "Systems models include the HFEs, and human reliability defines them in the system context." },
    ],
    outputs: [
      { element: "ESQ", role: "Cutsets", detail: "The system cutsets and survivability the quantification solves." },
      { element: "IE", role: "Fault trees", detail: "The system fault trees used for the initiating-event frequencies." },
    ],
    funnelsToEsq: true,
  },
  HR: {
    inputs: [
      { element: "POS", role: "Operating states", detail: "The states and windows the actions sit in." },
      { element: "ES", role: "Sequences", detail: "The sequences the operator actions appear in." },
      { element: "SC", role: "Success criteria", detail: "The criteria the recovery actions must meet." },
      { element: "IE", role: "Support fault trees", detail: "The support-system initiating fault trees the recovery builds on." },
      { element: "DA", role: "Estimation machinery", detail: "The Bayesian estimation machinery for data-informed human error probabilities." },
    ],
    bidirectional: [
      { element: "SY", role: "System context", detail: "Systems supplies the model context, and human reliability hands back the HFE probabilities." },
    ],
    outputs: [
      { element: "ESQ", role: "Human error probabilities", detail: "The HFE probabilities and their dependencies the quantification consumes." },
    ],
    funnelsToEsq: true,
  },
  DA: {
    inputs: [
      { element: "POS", role: "Per-state context", detail: "The operating states and outage timelines behind the time fractions." },
    ],
    bidirectional: [
      { element: "SY", role: "Basic events", detail: "Systems hands DA the basic events to fill, DA hands back the probabilities and CCF parameters." },
    ],
    outputs: [
      { element: "IE", role: "Frequencies", detail: "The initiating-event frequencies and their data sources." },
      { element: "HR", role: "Parameters", detail: "The estimation machinery for data-informed human error probabilities." },
      { element: "ES", role: "Repair data", detail: "The repair data behind any credited recovery." },
      { element: "ESQ", role: "Every number", detail: "Every parameter value the quantification needs." },
    ],
    funnelsToEsq: true,
  },
  ESQ: {
    inputs: [
      { element: "IE", role: "Frequencies", detail: "The initiating-event frequencies and the screened set." },
      { element: "ES", role: "Sequence model", detail: "The integrated event-sequence model." },
      { element: "SC", role: "Passive criteria", detail: "The passive-means success criteria." },
      { element: "SY", role: "Cutsets", detail: "The system cutsets and survivability." },
      { element: "HR", role: "Human error probabilities", detail: "The HFE probabilities and their dependencies." },
      { element: "DA", role: "Parameters", detail: "Every parameter value the quantification needs." },
    ],
    bidirectional: [
      { element: "RI", role: "Significance criteria", detail: "Quantification finds the contributors, integration sets the criteria they are judged against." },
    ],
    outputs: [],
    funnelsToEsq: false,
  },
  MS: {
    inputs: [],
    bidirectional: [
      { element: "ES", role: "Release categories", detail: "The end states define the release categories the source term characterizes." },
      { element: "RI", role: "Risk significance", detail: "The source term hands up its uncertainty, integration hands back the risk significance." },
    ],
    outputs: [
      { element: "RC", role: "Source terms", detail: "The release-category source terms the consequence analysis disperses." },
    ],
    funnelsToEsq: false,
  },
  RC: {
    inputs: [
      { element: "MS", role: "Source terms", detail: "The release-category source terms the dispersion starts from." },
      { element: "ES", role: "Release categories", detail: "The release-category end states the consequence is per." },
    ],
    bidirectional: [
      { element: "RI", role: "Consequence measures", detail: "Integration sets the consequence measures, the consequence table reports against them." },
    ],
    outputs: [],
    funnelsToEsq: false,
  },
  RI: {
    inputs: [],
    bidirectional: [
      { element: "ESQ", role: "Family frequencies", detail: "Quantification hands up the frequencies, integration hands back the significance criteria." },
      { element: "RC", role: "Family consequences", detail: "The consequence hands up the table, integration hands back the consequence measures." },
      { element: "MS", role: "Source-term uncertainty", detail: "The source term hands up its uncertainty for the propagation, integration hands back the significance." },
    ],
    outputs: [
      { element: "ES", role: "Reporting floor", detail: "The minimum reporting consequence the end-state definition uses." },
      { element: "SC", role: "Reporting floor", detail: "The minimum reporting consequence the criteria carry." },
    ],
    funnelsToEsq: false,
  },
};

type CitationKind = "verbatim" | "funnel" | "prose";

interface CrossCitation {
  from: string;
  fromElement: ElementCode;
  to: string;
  toElement: ElementCode;
  kind: CitationKind;
}

const VERBATIM_PAIRS: [string, string][] = [
  ["IE-A2", "MS-B2"],
  ["IE-C9", "ESQ-D8"],
  ["ES-A4", "HLR-SC-A"],
  ["ES-A4", "HLR-SC-B"],
  ["ES-A8", "RI-A5"],
  ["ES-A10", "SC-B4"],
  ["ES-A13", "SC-A2"],
  ["ES-A13", "SC-A3"],
  ["ES-C1", "HLR-MS-A"],
  ["ES-C7", "HLR-SC-A"],
  ["ES-C7", "HLR-SC-B"],
  ["ES-C9", "SY-A31"],
  ["ES-C9", "DA-C20"],
  ["SC-A5", "ES-A3"],
  ["SC-A3", "RI-A5"],
  ["SC-B3", "HLR-IE-B"],
  ["SC-B3", "HLR-POS-A"],
  ["SC-B3", "HLR-ES-A"],
  ["SC-B3", "HLR-ES-B"],
  ["SY-A21", "HLR-HR-C"],
  ["SY-A23", "HLR-ES-A"],
  ["SY-A23", "HLR-HR-C"],
  ["SY-A27", "DA-C18"],
  ["SY-A31", "DA-C20"],
  ["SY-B4", "DA-D8"],
  ["HR-A7", "IE-C11"],
  ["DA-A2", "SY-A7"],
  ["DA-A2", "SY-A9"],
  ["DA-A2", "SY-A12"],
  ["DA-A2", "SY-A14"],
  ["DA-A2", "SY-A15"],
  ["DA-A2", "SY-A16"],
  ["DA-A2", "SY-A17"],
  ["DA-A2", "SY-A25"],
  ["DA-C20", "SY-A31"],
  ["DA-C24", "POS-C1"],
  ["DA-C26", "POS-C1"],
  ["ESQ-A2", "ES-A9"],
  ["ESQ-A7", "HR-H1"],
  ["ESQ-A7", "HR-H2"],
  ["ESQ-A7", "HR-H5"],
  ["ESQ-A8", "HLR-HR-D"],
  ["ESQ-A8", "HLR-HR-G"],
  ["ESQ-A8", "HLR-HR-H"],
  ["ESQ-A8", "HLR-DA-C"],
  ["ESQ-A8", "HLR-DA-D"],
  ["ESQ-C2", "HR-G6"],
  ["ESQ-C2", "HR-G7"],
  ["ESQ-C2", "HR-G8"],
  ["ESQ-C2", "HR-G12"],
  ["ESQ-C8", "SY-A29"],
  ["ESQ-C8", "HR-H2"],
  ["ESQ-C9", "SY-A29"],
  ["ESQ-C9", "HR-H2"],
  ["ESQ-D6", "HLR-RI-A"],
  ["ESQ-D7", "HLR-RI-B"],
  ["ESQ-D8", "IE-C9"],
  ["ESQ-E2", "IE-C19"],
  ["ESQ-E2", "SC-B5"],
  ["ESQ-E2", "HR-D8"],
  ["ESQ-E2", "HR-G14"],
  ["ESQ-E2", "DA-D3"],
  ["MS-A1", "ES-C1"],
  ["MS-A1", "ES-C2"],
  ["MS-A2", "ES-C1"],
  ["MS-A3", "ES-C1"],
  ["MS-C1", "HLR-ES-C"],
  ["MS-C3", "HLR-ES-C"],
  ["RCRE-A3", "ES-C1"],
  ["RCRE-A3", "HLR-MS-A"],
  ["RCRE-B1", "RI-A1"],
  ["RCQ-B3", "HLR-RI-B"],
  ["RI-B1", "HLR-ESQ-D"],
  ["RI-B1", "HLR-RCQ-D"],
  ["RI-C1", "ESQ-E1"],
  ["RI-C1", "MS-D3"],
  ["RI-C1", "RCQ-C1"],
  ["RI-C4", "ESQ-E2"],
  ["RI-C4", "MS-D4"],
  ["RI-C4", "RCQ-C2"],
  ["RI-D1", "ESQ-F2"],
];

const FUNNEL_PAIRS: [string, string][] = [
  ["POS-A12", "ESQ-E1"],
  ["POS-B7", "ESQ-E1"],
  ["IE-A17", "ESQ-E1"],
  ["ES-A14", "ESQ-E1"],
  ["ES-B9", "ESQ-E1"],
  ["ES-C10", "ESQ-E1"],
  ["SC-A10", "ESQ-E1"],
  ["SC-B9", "ESQ-E1"],
  ["SY-A32", "ESQ-E1"],
  ["SY-B16", "ESQ-E1"],
  ["HR-A9", "ESQ-E1"],
  ["HR-D9", "ESQ-E1"],
  ["HR-E8", "ESQ-E1"],
  ["DA-A5", "ESQ-E1"],
];

const PROSE_PAIRS: [string, string][] = [
  ["IE_notes", "HLR-SY-A"],
  ["IE_notes", "HLR-HR-F"],
  ["IE_notes", "HLR-HR-G"],
  ["IE_notes", "HLR-HR-H"],
  ["IE_notes", "HLR-DA-C"],
  ["IE_notes", "HLR-DA-D"],
  ["HR_notes", "SY-A31"],
  ["HR_notes", "DA-C20"],
  ["DA_notes", "IE-A7"],
  ["DA_notes", "IE-A11"],
  ["DA_notes", "IE-A12"],
  ["DA_notes", "IE-A13"],
  ["DA_notes", "IE-A16"],
  ["DA_notes", "IE-C9"],
  ["DA_notes", "IE-D1"],
  ["DA_notes", "HLR-SY-A"],
  ["DA_notes", "HLR-SY-B"],
  ["DA_notes", "HLR-HR-A"],
  ["DA_notes", "HLR-HR-B"],
  ["DA_notes", "HLR-HR-C"],
  ["DA_notes", "HLR-HR-D"],
  ["DA_notes", "SY-C1"],
];

function elementOfRef(ref: string): ElementCode {
  const bare = ref.startsWith("HLR-") ? ref.slice(4) : ref;
  const head = bare.split("_")[0];
  if (head.startsWith("ESQ")) return "ESQ";
  if (head.startsWith("RC")) return "RC";
  if (head.startsWith("POS")) return "POS";
  if (head.startsWith("IE")) return "IE";
  if (head.startsWith("ES")) return "ES";
  if (head.startsWith("SC")) return "SC";
  if (head.startsWith("SY")) return "SY";
  if (head.startsWith("HR")) return "HR";
  if (head.startsWith("DA")) return "DA";
  if (head.startsWith("MS")) return "MS";
  if (head.startsWith("RI")) return "RI";
  return "POS";
}

function hlrOf(ref: string): string {
  if (ref.startsWith("HLR-")) return ref;
  const parts = ref.split("-");
  if (parts.length < 2 || parts[1].length === 0) return ref;
  return `HLR-${parts[0]}-${parts[1].charAt(0)}`;
}

function buildCitations(): CrossCitation[] {
  const out: CrossCitation[] = [];
  const groups: [[string, string][], CitationKind][] = [
    [VERBATIM_PAIRS, "verbatim"],
    [FUNNEL_PAIRS, "funnel"],
    [PROSE_PAIRS, "prose"],
  ];
  for (const [pairs, kind] of groups) {
    for (const [from, to] of pairs) {
      const fromElement = elementOfRef(from);
      const toElement = elementOfRef(to);
      if (fromElement === toElement) continue;
      out.push({ from, fromElement, to, toElement, kind });
    }
  }
  return out;
}

const CITATIONS: CrossCitation[] = buildCitations();

interface DependencyChip {
  element: ElementCode;
  hlrs: string[];
}

const PIPELINE_ORDER: ElementCode[] = ["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC", "RI"];

function byPipeline(a: LaneEntry, b: LaneEntry): number {
  return PIPELINE_ORDER.indexOf(a.element) - PIPELINE_ORDER.indexOf(b.element);
}

function elementMeta(code: ElementCode): ElementMeta {
  return ELEMENT_META[code];
}

function elementInterface(code: ElementCode): ElementInterface {
  const iface = ELEMENT_INTERFACE[code];
  return {
    inputs: [...iface.inputs].sort(byPipeline),
    bidirectional: [...iface.bidirectional].sort(byPipeline),
    outputs: [...iface.outputs].sort(byPipeline),
    funnelsToEsq: iface.funnelsToEsq,
  };
}

function linkBarProviders(code: ElementCode): LaneEntry[] {
  const iface = ELEMENT_INTERFACE[code];
  return [...iface.inputs, ...iface.bidirectional].sort(byPipeline);
}

interface OrderedLaneEntry {
  entry: LaneEntry;
  lane: "in" | "bi";
}

function inputSideLanes(code: ElementCode): OrderedLaneEntry[] {
  const iface = ELEMENT_INTERFACE[code];
  const merged: OrderedLaneEntry[] = [
    ...iface.inputs.map((entry) => ({ entry, lane: "in" as const })),
    ...iface.bidirectional.map((entry) => ({ entry, lane: "bi" as const })),
  ];
  return merged.sort((a, b) => PIPELINE_ORDER.indexOf(a.entry.element) - PIPELINE_ORDER.indexOf(b.entry.element));
}

function bridgesFor(fromCode: ElementCode, toCode: ElementCode): string[] {
  const seen = new Set<string>();
  for (const c of CITATIONS) {
    if (c.kind === "funnel") continue;
    if (c.fromElement === fromCode && c.toElement === toCode) seen.add(hlrOf(c.to));
  }
  return Array.from(seen);
}

function dockDependenciesForSr(code: ElementCode, sr: string): DependencyChip[] {
  const byElement = new Map<ElementCode, Set<string>>();
  for (const c of CITATIONS) {
    if (c.kind === "funnel") continue;
    if (c.fromElement !== code || c.from !== sr) continue;
    if (c.toElement === code) continue;
    const set = byElement.get(c.toElement) ?? new Set<string>();
    set.add(hlrOf(c.to));
    byElement.set(c.toElement, set);
  }
  return Array.from(byElement.entries()).map(([element, hlrs]) => ({ element, hlrs: Array.from(hlrs) }));
}

export type { ElementCode, ElementMeta, LaneEntry, ElementInterface, CrossCitation, CitationKind, DependencyChip, OrderedLaneEntry };
export {
  ELEMENT_META,
  ELEMENT_INTERFACE,
  CITATIONS,
  elementMeta,
  elementInterface,
  linkBarProviders,
  inputSideLanes,
  bridgesFor,
  dockDependenciesForSr,
  hlrOf,
};

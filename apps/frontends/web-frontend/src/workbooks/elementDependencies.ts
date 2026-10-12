type ElementCode = "POS" | "IE" | "ES" | "SC" | "SY" | "HR" | "DA" | "ESQ" | "MS" | "RC" | "RI";

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

export type { ElementCode, CrossCitation, CitationKind, DependencyChip };
export {
  CITATIONS,
  dockDependenciesForSr,
  hlrOf,
};

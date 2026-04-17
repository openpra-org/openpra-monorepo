export type OpenPraQuantumCanonicalCaseRole = "ws5_priority" | "ws6_acceptance" | "ws5_and_ws6";

export interface OpenPraQuantumCanonicalCase {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  role: OpenPraQuantumCanonicalCaseRole;
  notes: string;
}

export interface OpenPraQuantumCanonicalCasePackSummary {
  ws5PriorityCases: OpenPraQuantumCanonicalCase[];
  ws6AcceptanceCases: OpenPraQuantumCanonicalCase[];
  allCases: OpenPraQuantumCanonicalCase[];
  allCaseLabels: string[];
}

const CANONICAL_CASES: OpenPraQuantumCanonicalCase[] = [
  {
    caseLabel: "phase2b_row_0698__G_G348",
    subtreeId: "G:G348",
    topologyClass: "A",
    role: "ws5_and_ws6",
    notes: "Exact A path and primary WS6 exact acceptance case.",
  },
  {
    caseLabel: "phase2b_row_1037__G_G348",
    subtreeId: "G:G348",
    topologyClass: "A",
    role: "ws5_priority",
    notes: "Second exact A path case in the WS5 canonical overlap cohort.",
  },
  {
    caseLabel: "phase2b_row_0905__G_G939",
    subtreeId: "G:G939",
    topologyClass: "C",
    role: "ws5_and_ws6",
    notes: "Harder C path and primary WS6 nontrivial acceptance case.",
  },
];

export function getOpenPraQuantumCanonicalCasePackSummary(): OpenPraQuantumCanonicalCasePackSummary {
  const ws5PriorityCases = CANONICAL_CASES.filter(
    (entry) => entry.role === "ws5_priority" || entry.role === "ws5_and_ws6",
  );
  const ws6AcceptanceCases = CANONICAL_CASES.filter(
    (entry) => entry.role === "ws6_acceptance" || entry.role === "ws5_and_ws6",
  );

  return {
    ws5PriorityCases,
    ws6AcceptanceCases,
    allCases: [...CANONICAL_CASES],
    allCaseLabels: CANONICAL_CASES.map((entry) => entry.caseLabel),
  };
}

export function getOpenPraQuantumCanonicalCaseByLabel(caseLabel: string): OpenPraQuantumCanonicalCase {
  const found = CANONICAL_CASES.find((entry) => entry.caseLabel === caseLabel);
  if (!found) {
    throw new Error(`Unknown canonical caseLabel=${caseLabel}.`);
  }
  return found;
}

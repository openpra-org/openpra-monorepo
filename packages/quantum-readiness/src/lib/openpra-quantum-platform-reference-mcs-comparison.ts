export interface OpenPraQuantumReferenceMcsComparisonInput {
  candidateEventSets: string[][];
  referenceEventSets: string[][];
}

export interface OpenPraQuantumReferenceMcsComparisonOutput {
  comparisonStatus: "compared" | "invalid_input";
  exactMatches: string[][];
  missingReferenceSets: string[][];
  extraCandidateSets: string[][];
  boundednessStatement: string;
  errors: string[];
}

function canonicalize(set: string[]): string {
  return [...set].sort().join("|");
}

function normalizeSets(sets: string[][]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const s of sets) {
    m.set(canonicalize(s), [...s].sort());
  }
  return m;
}

export function compareOpenPraQuantumCandidateMcsToReference(
  input: OpenPraQuantumReferenceMcsComparisonInput,
): OpenPraQuantumReferenceMcsComparisonOutput {
  const errors: string[] = [];

  if (!Array.isArray(input.candidateEventSets)) {
    errors.push("candidateEventSets must be an array");
  }

  if (!Array.isArray(input.referenceEventSets)) {
    errors.push("referenceEventSets must be an array");
  }

  if (errors.length > 0) {
    return {
      comparisonStatus: "invalid_input",
      exactMatches: [],
      missingReferenceSets: [],
      extraCandidateSets: [],
      boundednessStatement: "Invalid input. No reference comparison performed.",
      errors,
    };
  }

  const candidates = normalizeSets(input.candidateEventSets);
  const refs = normalizeSets(input.referenceEventSets);

  const exactMatches: string[][] = [];
  const missingReferenceSets: string[][] = [];
  const extraCandidateSets: string[][] = [];

  for (const [key, refSet] of refs.entries()) {
    if (candidates.has(key)) {
      exactMatches.push(refSet);
    } else {
      missingReferenceSets.push(refSet);
    }
  }

  for (const [key, candSet] of candidates.entries()) {
    if (!refs.has(key)) {
      extraCandidateSets.push(candSet);
    }
  }

  return {
    comparisonStatus: "compared",
    exactMatches,
    missingReferenceSets,
    extraCandidateSets,
    boundednessStatement:
      "Candidate event sets were compared against a provided reference set. This comparison does not by itself prove PRA quantification validity.",
    errors: [],
  };
}

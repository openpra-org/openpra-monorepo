export interface OpenPraQuantumReferenceExtractionResult {
  extractionStatus: "extracted" | "invalid_input" | "not_found";
  caseId: string;
  rootGateId: string;
  referenceEventSets: string[][];
  referenceBitstrings: string[];
  referenceCount: number;
  extractionPath: string;
  boundednessStatement: string;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArrayArray(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((x) => typeof x === "string"));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function normalizeSets(sets: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];

  for (const set of sets) {
    const normalized = [...set].sort();
    const key = normalized.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(normalized);
    }
  }

  return out;
}

export function extractOpenPraQuantumReferenceMcs(artifact: unknown): OpenPraQuantumReferenceExtractionResult {
  if (!isObject(artifact)) {
    return {
      extractionStatus: "invalid_input",
      caseId: "",
      rootGateId: "",
      referenceEventSets: [],
      referenceBitstrings: [],
      referenceCount: 0,
      extractionPath: "",
      boundednessStatement: "Invalid reference artifact. No MCS reference extracted.",
      errors: ["artifact must be an object"],
    };
  }

  const caseId = String(artifact.model_id ?? artifact.modelId ?? artifact.caseId ?? "");

  const rootGateId = String(
    artifact.candidate_root_node_id ?? artifact.candidateRootNodeId ?? artifact.rootGateId ?? "",
  );

  const direct = artifact.frozen_mcs_reference;
  if (isObject(direct)) {
    const sets = direct.basicEventIdSets;
    const bitstrings = direct.bitstrings;

    if (isStringArrayArray(sets)) {
      return {
        extractionStatus: "extracted",
        caseId,
        rootGateId,
        referenceEventSets: normalizeSets(sets),
        referenceBitstrings: isStringArray(bitstrings) ? bitstrings : [],
        referenceCount: sets.length,
        extractionPath: "frozen_mcs_reference.basicEventIdSets",
        boundednessStatement: "Reference MCS extracted from authoritative frozen_mcs_reference.basicEventIdSets.",
        errors: [],
      };
    }
  }

  const candidates = artifact.clQuboCandidates;
  if (Array.isArray(candidates)) {
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (!isObject(candidate)) {
        continue;
      }

      const frozen = candidate.frozenMcsReference;
      if (!isObject(frozen)) {
        continue;
      }

      const sets = frozen.basicEventIdSets;
      const bitstrings = frozen.bitstrings;

      if (isStringArrayArray(sets)) {
        return {
          extractionStatus: "extracted",
          caseId: String(candidate.modelId ?? caseId),
          rootGateId: String(candidate.candidateRootNodeId ?? rootGateId),
          referenceEventSets: normalizeSets(sets),
          referenceBitstrings: isStringArray(bitstrings) ? bitstrings : [],
          referenceCount: sets.length,
          extractionPath: `clQuboCandidates[${i}].frozenMcsReference.basicEventIdSets`,
          boundednessStatement: "Reference MCS extracted from clQuboCandidates frozenMcsReference.basicEventIdSets.",
          errors: [],
        };
      }
    }
  }

  return {
    extractionStatus: "not_found",
    caseId,
    rootGateId,
    referenceEventSets: [],
    referenceBitstrings: [],
    referenceCount: 0,
    extractionPath: "",
    boundednessStatement: "No supported frozen MCS reference structure was found.",
    errors: ["supported reference field not found"],
  };
}

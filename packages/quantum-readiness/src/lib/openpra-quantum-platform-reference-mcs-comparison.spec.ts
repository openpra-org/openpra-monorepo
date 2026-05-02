import { compareOpenPraQuantumCandidateMcsToReference } from "./openpra-quantum-platform-reference-mcs-comparison";

describe("OpenPRA reference MCS comparison", () => {
  it("identifies exact matches independent of ordering", () => {
    const result = compareOpenPraQuantumCandidateMcsToReference({
      candidateEventSets: [["BE2", "BE1"], ["BE3"]],
      referenceEventSets: [["BE1", "BE2"], ["BE4"]],
    });

    expect(result.comparisonStatus).toBe("compared");
    expect(result.exactMatches).toEqual([["BE1", "BE2"]]);
    expect(result.missingReferenceSets).toEqual([["BE4"]]);
    expect(result.extraCandidateSets).toEqual([["BE3"]]);
  });

  it("handles complete recovery", () => {
    const result = compareOpenPraQuantumCandidateMcsToReference({
      candidateEventSets: [["BE1"], ["BE2"]],
      referenceEventSets: [["BE1"], ["BE2"]],
    });

    expect(result.missingReferenceSets).toEqual([]);
    expect(result.extraCandidateSets).toEqual([]);
  });

  it("rejects invalid input", () => {
    const result = compareOpenPraQuantumCandidateMcsToReference({
      candidateEventSets: null as any,
      referenceEventSets: [["BE1"]],
    });

    expect(result.comparisonStatus).toBe("invalid_input");
  });
});

import { extractOpenPraQuantumReferenceMcs } from "./openpra-quantum-platform-reference-extractor";

describe("OpenPRA reference extractor", () => {
  it("extracts authoritative phase5 frozen_mcs_reference", () => {
    const result = extractOpenPraQuantumReferenceMcs({
      model_id: "phase2b_row_0905",
      candidate_root_node_id: "G:G939",
      frozen_mcs_reference: {
        minimalCutSetCount: 2,
        basicEventIdSets: [["B:BE2", "B:BE1"], ["B:BE3"]],
        bitstrings: ["110", "001"],
      },
    });

    expect(result.extractionStatus).toBe("extracted");
    expect(result.referenceCount).toBe(2);
    expect(result.referenceEventSets).toEqual([["B:BE1", "B:BE2"], ["B:BE3"]]);
    expect(result.extractionPath).toBe("frozen_mcs_reference.basicEventIdSets");
  });

  it("extracts phase4 clQuboCandidates frozenMcsReference", () => {
    const result = extractOpenPraQuantumReferenceMcs({
      modelId: "phase2b_row_1037",
      clQuboCandidates: [
        {
          modelId: "phase2b_row_1037",
          candidateRootNodeId: "G:G348",
          frozenMcsReference: {
            minimalCutSetCount: 3,
            basicEventIdSets: [
              ["B:BE3634"],
              ["B:BE3637", "B:BE3638", "B:BE3642"],
              ["B:BE3637", "B:BE3639", "B:BE3642"],
            ],
            bitstrings: ["10000", "01101", "01011"],
          },
        },
      ],
    });

    expect(result.extractionStatus).toBe("extracted");
    expect(result.caseId).toBe("phase2b_row_1037");
    expect(result.rootGateId).toBe("G:G348");
    expect(result.referenceCount).toBe(3);
    expect(result.extractionPath).toBe("clQuboCandidates[0].frozenMcsReference.basicEventIdSets");
  });

  it("returns not found for unsupported shapes", () => {
    const result = extractOpenPraQuantumReferenceMcs({
      modelId: "bad",
      clQuboCandidates: [],
    });

    expect(result.extractionStatus).toBe("not_found");
    expect(result.referenceCount).toBe(0);
  });

  it("rejects invalid input", () => {
    const result = extractOpenPraQuantumReferenceMcs(null);

    expect(result.extractionStatus).toBe("invalid_input");
  });
});

import { importOpenPraQuantumBoundedShadowAnalysis } from "./openpra-quantum-platform-bounded-downstream-consumer";

describe("OpenPRA bounded downstream consumer", () => {
  it("imports bounded shadow analysis with guardrails", () => {
    const result = importOpenPraQuantumBoundedShadowAnalysis({
      sourceModelId: "openpra_baseline_model",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendSubmissionId: "d7momkdqrg3c738lh8sg",
      backendName: "ibm_marrakesh",
      recoveredCandidateSets: [["BE1"], ["BE2"]],
      referenceEventSets: [["BE1"], ["BE3"]],
      exactMatches: [["BE1"]],
      missingReferenceSets: [["BE3"]],
      extraCandidateSets: [["BE2"]],
      disposition: "partial_recovery",
      requiresOperatorAttention: true,
      evidenceClass: "platform_ibm_hardware_new",
    });

    expect(result.importStatus).toBe("imported_with_guardrails");
    expect(result.productionPraQuantificationAllowed).toBe(false);
    expect(result.comparisonSummary.exactMatchCount).toBe(1);
  });

  it("rejects invalid input", () => {
    const result = importOpenPraQuantumBoundedShadowAnalysis({
      sourceModelId: "",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendSubmissionId: "job",
      backendName: "ibm_marrakesh",
      recoveredCandidateSets: [],
      referenceEventSets: [],
      exactMatches: [],
      missingReferenceSets: [],
      extraCandidateSets: [],
      disposition: "partial_recovery",
      requiresOperatorAttention: true,
      evidenceClass: "platform_ibm_hardware_new",
    });

    expect(result.importStatus).toBe("invalid_input");
    expect(result.productionPraQuantificationAllowed).toBe(false);
  });
});

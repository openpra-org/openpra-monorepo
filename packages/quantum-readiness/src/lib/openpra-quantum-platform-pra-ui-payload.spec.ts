import { buildOpenPraQuantumPraUiPayload } from "./openpra-quantum-platform-pra-ui-payload";
import { importOpenPraQuantumBoundedShadowAnalysis } from "./openpra-quantum-platform-bounded-downstream-consumer";

describe("OpenPRA quantum PRA UI payload", () => {
  it("builds guarded UI payload from bounded shadow analysis", () => {
    const shadow = importOpenPraQuantumBoundedShadowAnalysis({
      sourceModelId: "openpra_baseline_model",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendSubmissionId: "d7momkdqrg3c738lh8sg",
      backendName: "ibm_marrakesh",
      recoveredCandidateSets: [["BE1"]],
      referenceEventSets: [["BE1"]],
      exactMatches: [["BE1"]],
      missingReferenceSets: [],
      extraCandidateSets: [],
      disposition: "exact_hardware_recovery",
      requiresOperatorAttention: false,
      evidenceClass: "platform_ibm_hardware_new",
    });

    const payload = buildOpenPraQuantumPraUiPayload({
      shadowAnalysis: shadow,
      jobId: "d7momkdqrg3c738lh8sg",
      backendName: "ibm_marrakesh",
      artifactRoot: "/tmp/artifacts",
    });

    expect(payload.status).toBe("ready_with_guardrails");
    expect(payload.productionPraQuantificationAllowed).toBe(false);
    expect(payload.guardrails).toContain("No comparative quantum performance claim is made.");
  });

  it("blocks incomplete payloads", () => {
    const shadow = importOpenPraQuantumBoundedShadowAnalysis({
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

    const payload = buildOpenPraQuantumPraUiPayload({
      shadowAnalysis: shadow,
      jobId: "",
      backendName: "ibm_marrakesh",
      artifactRoot: "/tmp/artifacts",
    });

    expect(payload.status).toBe("blocked");
    expect(payload.productionPraQuantificationAllowed).toBe(false);
  });
});

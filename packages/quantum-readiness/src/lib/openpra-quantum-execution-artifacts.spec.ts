import { buildOpenpraQuantumExecutionArtifactBundleFromRawCounts } from "./openpra-quantum-execution-artifacts";

describe("openpra-quantum-execution-artifacts", () => {
  it("wraps raw counts into execution artifact and provenance manifest", () => {
    const bundle = buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(
      {
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
        providerType: "simulator",
        providerName: "qiskit-aer",
        backendName: "aer_simulator",
        executionMode: "counts_only",
        shots: 100,
        rawCounts: {
          "000": 10,
          "011": 30,
          "100": 60,
        },
      },
      {
        createdBy: "jest:test",
      },
    );

    expect(bundle.executionArtifact.schemaVersion).toBe("1.0.0");
    expect(bundle.executionArtifact.artifactType).toBe("execution");
    expect(bundle.executionArtifact.providerType).toBe("simulator");
    expect(bundle.executionArtifact.providerName).toBe("qiskit-aer");
    expect(bundle.executionArtifact.backendName).toBe("aer_simulator");
    expect(bundle.executionArtifact.shots).toBe(100);
    expect(bundle.executionArtifact.rawCounts).toEqual({
      "000": 10,
      "011": 30,
      "100": 60,
    });

    expect(bundle.provenanceManifest.artifactType).toBe("provenance_manifest");
    expect(bundle.provenanceManifest.relatedArtifactIds).toContain(bundle.executionArtifact.artifactId);
    expect(bundle.provenanceManifest.relatedArtifactIds).toContain("preparation:phase2b_row_0001:TOP:abc");
    expect(bundle.provenanceManifest.acceptanceGateResults).toEqual({
      hasPreparationArtifactReference: true,
      hasRawCounts: true,
      shotsMatchRawCountsTotal: true,
    });
  });
});

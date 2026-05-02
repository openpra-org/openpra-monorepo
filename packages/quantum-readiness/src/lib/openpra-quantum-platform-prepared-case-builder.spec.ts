import {
  OPENPRA_QUANTUM_DEFAULT_PREPARED_CASE_BOUNDEDNESS_STATEMENT,
  buildOpenPraQuantumPreparedCaseId,
  buildOpenPraQuantumPreparedCasePackage,
} from "./openpra-quantum-platform-prepared-case-builder";

describe("OpenPRA quantum prepared case package builder", () => {
  it("builds a deterministic prepared case id", () => {
    expect(
      buildOpenPraQuantumPreparedCaseId({
        subtreeId: "phase2b_row_0905",
        rootGateId: "G:G939",
        backendFamily: "ibm_gate",
        backendMode: "remote_hardware",
      }),
    ).toBe("prepared_case_phase2b_row_0905_G_G939_ibm_gate_remote_hardware_v1");
  });

  it("builds and validates an IBM prepared case package", () => {
    const pkg = buildOpenPraQuantumPreparedCasePackage({
      sourceModelId: "openpra_baseline_model",
      sourceModelPath: "/tmp/openpra/source_model.json",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      preparationToolVersion: "v1",
      backendFamily: "ibm_gate",
      backendMode: "remote_hardware",
      encodingFamily: "cl_qubo_gate_qaoa",
      supportedInputShape: {
        basicEventCount: 8,
        qubitCountIfGateBased: 8,
        topologyClassIfAvailable: "C",
        eligibilityStatus: "eligible",
      },
      artifactRoot: "/tmp/openpra/prepared_case",
      submissionManifestPath: "/tmp/openpra/prepared_case/submission_manifest.json",
      expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
      failureTaxonomyVersion: "v1",
      generatedTimestampUtc: "2026-04-25T00:00:00Z",
      generatingTool: "unit_test",
      generatingToolVersion: "v1",
      inputArtifactPaths: ["/tmp/input.json"],
      outputArtifactPaths: ["/tmp/output.json"],
      evidenceClass: "dry_run_evidence",
      repositoryRootIfAvailable: "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo",
      gitBranchIfAvailable: "feature/openpra_quantum_integration_v1",
      gitCommitIfAvailable: "9e264dea4796553df55154dbc1d4778d67e2e252",
    });

    expect(pkg.preparedCase.preparedCaseId).toBe("prepared_case_phase2b_row_0905_G_G939_ibm_gate_remote_hardware_v1");
    expect(pkg.preparedCase.boundednessStatement).toBe(OPENPRA_QUANTUM_DEFAULT_PREPARED_CASE_BOUNDEDNESS_STATEMENT);
    expect(pkg.preparedCase.provenanceBlock.evidenceClass).toBe("dry_run_evidence");
  });

  it("preserves batch metadata as orchestration metadata only", () => {
    const pkg = buildOpenPraQuantumPreparedCasePackage({
      sourceModelId: "openpra_baseline_model",
      sourceModelPath: "/tmp/openpra/source_model.json",
      subtreeId: "phase2b_row_1037",
      rootGateId: "G:G348",
      preparationToolVersion: "v1",
      backendFamily: "local_gate",
      backendMode: "local_validation",
      encodingFamily: "cl_qubo_gate_qaoa",
      supportedInputShape: {
        basicEventCount: 5,
        qubitCountIfGateBased: 5,
        topologyClassIfAvailable: "A",
        eligibilityStatus: "eligible",
      },
      artifactRoot: "/tmp/openpra/prepared_case",
      submissionManifestPath: "/tmp/openpra/prepared_case/submission_manifest.json",
      expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
      failureTaxonomyVersion: "v1",
      generatedTimestampUtc: "2026-04-25T00:00:00Z",
      generatingTool: "unit_test",
      generatingToolVersion: "v1",
      inputArtifactPaths: ["/tmp/input.json"],
      outputArtifactPaths: ["/tmp/output.json"],
      evidenceClass: "dry_run_evidence",
      batchId: "batch_001",
      batchPosition: 1,
      batchPolicyId: "orchestration_only_v1",
    });

    expect(pkg.preparedCase.batchMetadata).toEqual({
      batchId: "batch_001",
      batchPosition: 1,
      batchPolicyId: "orchestration_only_v1",
    });
  });

  it("rejects incompatible backend family and mode through prepared case validation", () => {
    expect(() =>
      buildOpenPraQuantumPreparedCasePackage({
        sourceModelId: "openpra_baseline_model",
        sourceModelPath: "/tmp/openpra/source_model.json",
        subtreeId: "phase2b_row_0905",
        rootGateId: "G:G939",
        preparationToolVersion: "v1",
        backendFamily: "annealing",
        backendMode: "remote_hardware",
        encodingFamily: "cl_qubo_gate_qaoa",
        supportedInputShape: {
          basicEventCount: 8,
          eligibilityStatus: "eligible",
        },
        artifactRoot: "/tmp/openpra/prepared_case",
        submissionManifestPath: "/tmp/openpra/prepared_case/submission_manifest.json",
        expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
        failureTaxonomyVersion: "v1",
        generatedTimestampUtc: "2026-04-25T00:00:00Z",
        generatingTool: "unit_test",
        generatingToolVersion: "v1",
        inputArtifactPaths: ["/tmp/input.json"],
        outputArtifactPaths: ["/tmp/output.json"],
        evidenceClass: "dry_run_evidence",
      }),
    ).toThrow(/Invalid OpenPRA quantum prepared case/);
  });
});

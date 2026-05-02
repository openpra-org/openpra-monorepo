import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildOpenPraQuantumPreparedCasePackage } from "./openpra-quantum-platform-prepared-case-builder";
import { runOpenPraQuantumIbmAdapterDryRun } from "./openpra-quantum-platform-ibm-adapter";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openpra-quantum-ibm-adapter-"));
}

function buildIbmPreparedCase() {
  const outputDirectory = makeTempDir();

  return buildOpenPraQuantumPreparedCasePackage({
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
    artifactRoot: outputDirectory,
    submissionManifestPath: path.join(outputDirectory, "submission_manifest.json"),
    expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
    failureTaxonomyVersion: "v1",
    generatedTimestampUtc: "2026-04-26T00:00:00Z",
    generatingTool: "unit_test",
    generatingToolVersion: "v1",
    inputArtifactPaths: ["/tmp/input.json"],
    outputArtifactPaths: ["/tmp/output.json"],
    evidenceClass: "dry_run_evidence",
    repositoryRootIfAvailable: "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo",
    gitBranchIfAvailable: "feature/openpra_quantum_integration_v1",
    gitCommitIfAvailable: "9e264dea4796553df55154dbc1d4778d67e2e252",
  }).preparedCase;
}

describe("OpenPRA quantum IBM adapter dry run", () => {
  it("writes dry run IBM submission artifacts without live submission", () => {
    const outputDirectory = makeTempDir();

    const result = runOpenPraQuantumIbmAdapterDryRun({
      preparedCase: buildIbmPreparedCase(),
      outputDirectory,
      ibmBackendName: "ibm_torino",
      shotCount: 8192,
      circuitArtifactPath: "/tmp/openpra/circuit.qpy",
      dryRun: true,
      generatedTimestampUtc: "2026-04-26T00:00:00Z",
      adapterToolVersion: "v1",
      repositoryRootIfAvailable: "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo",
      gitBranchIfAvailable: "feature/openpra_quantum_integration_v1",
      gitCommitIfAvailable: "9e264dea4796553df55154dbc1d4778d67e2e252",
    });

    expect(result.executionStatus).toBe("dry_run_completed");
    expect(result.parserStatus).toBe("parser_not_applicable");
    expect(result.liveSubmissionPerformed).toBe(false);
    expect(result.backendFamily).toBe("ibm_gate");
    expect(result.backendMode).toBe("remote_hardware");

    expect(fs.existsSync(result.submissionManifestPath)).toBe(true);
    expect(fs.existsSync(result.adapterProvenancePath)).toBe(true);
    expect(fs.existsSync(result.sha256Path)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(result.submissionManifestPath, "utf8"));

    expect(manifest.ibmBackendName).toBe("ibm_torino");
    expect(manifest.shotCount).toBe(8192);
    expect(manifest.liveSubmissionPerformed).toBe(false);
    expect(manifest.boundednessStatement).toContain("does not contact IBM");
  });

  it("rejects non IBM prepared cases", () => {
    const outputDirectory = makeTempDir();

    const localPreparedCase = buildOpenPraQuantumPreparedCasePackage({
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
      artifactRoot: outputDirectory,
      submissionManifestPath: path.join(outputDirectory, "submission_manifest.json"),
      expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
      failureTaxonomyVersion: "v1",
      generatedTimestampUtc: "2026-04-26T00:00:00Z",
      generatingTool: "unit_test",
      generatingToolVersion: "v1",
      inputArtifactPaths: ["/tmp/input.json"],
      outputArtifactPaths: ["/tmp/output.json"],
      evidenceClass: "dry_run_evidence",
    }).preparedCase;

    expect(() =>
      runOpenPraQuantumIbmAdapterDryRun({
        preparedCase: localPreparedCase,
        outputDirectory,
        ibmBackendName: "ibm_torino",
        shotCount: 8192,
        circuitArtifactPath: "/tmp/openpra/circuit.qpy",
        dryRun: true,
        generatedTimestampUtc: "2026-04-26T00:00:00Z",
        adapterToolVersion: "v1",
      }),
    ).toThrow(/backendFamily = ibm_gate/);
  });

  it("rejects invalid shot counts", () => {
    expect(() =>
      runOpenPraQuantumIbmAdapterDryRun({
        preparedCase: buildIbmPreparedCase(),
        outputDirectory: makeTempDir(),
        ibmBackendName: "ibm_torino",
        shotCount: 0,
        circuitArtifactPath: "/tmp/openpra/circuit.qpy",
        dryRun: true,
        generatedTimestampUtc: "2026-04-26T00:00:00Z",
        adapterToolVersion: "v1",
      }),
    ).toThrow(/shotCount must be a positive integer/);
  });
});

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeOpenPraQuantumPreparedCaseArtifacts } from "./openpra-quantum-platform-prepared-case-artifact-writer";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openpra-quantum-prepared-case-writer-"));
}

describe("OpenPRA quantum prepared case artifact writer", () => {
  it("writes prepared case, provenance, manifest, and sha256 artifacts", () => {
    const outputDirectory = makeTempDir();

    const result = writeOpenPraQuantumPreparedCaseArtifacts({
      outputDirectory,
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

    expect(fs.existsSync(result.preparedCasePath)).toBe(true);
    expect(fs.existsSync(result.provenancePath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(result.sha256Path)).toBe(true);

    const preparedCase = JSON.parse(fs.readFileSync(result.preparedCasePath, "utf8"));

    expect(preparedCase.preparedCaseId).toBe("prepared_case_phase2b_row_0905_G_G939_ibm_gate_remote_hardware_v1");
    expect(preparedCase.backendFamily).toBe("ibm_gate");
    expect(preparedCase.backendMode).toBe("remote_hardware");

    const shaText = fs.readFileSync(result.sha256Path, "utf8");

    expect(shaText).toContain("openpra_quantum_prepared_case_v1.json");
    expect(shaText).toContain("openpra_quantum_prepared_case_provenance_v1.json");
    expect(shaText).toContain("openpra_quantum_prepared_case_manifest_v1.json");
  });

  it("rejects invalid backend pair before writing artifacts", () => {
    const outputDirectory = makeTempDir();

    expect(() =>
      writeOpenPraQuantumPreparedCaseArtifacts({
        outputDirectory,
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
        artifactRoot: outputDirectory,
        submissionManifestPath: path.join(outputDirectory, "submission_manifest.json"),
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

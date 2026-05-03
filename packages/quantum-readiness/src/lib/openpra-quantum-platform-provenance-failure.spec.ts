import {
  OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION,
  OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
  OpenPraQuantumFailureRecord,
  OpenPraQuantumProvenanceBlock,
  assertOpenPraQuantumFailureRecord,
  assertOpenPraQuantumProvenanceBlock,
  isOpenPraQuantumEvidenceClass,
  isOpenPraQuantumFailureCategory,
  validateOpenPraQuantumFailureRecord,
  validateOpenPraQuantumProvenanceBlock,
} from "./openpra-quantum-platform-provenance-failure";

function buildValidProvenanceBlock(
  overrides: Partial<OpenPraQuantumProvenanceBlock> = {},
): OpenPraQuantumProvenanceBlock {
  return {
    provenanceSchemaVersion: OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
    generatedTimestampUtc: "2026-04-25T00:00:00Z",
    generatingTool: "unit_test",
    generatingToolVersion: "v1",
    repositoryRootIfAvailable: "/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo",
    gitBranchIfAvailable: "feature/openpra_quantum_integration_v1",
    gitCommitIfAvailable: "9e264dea4796553df55154dbc1d4778d67e2e252",
    inputArtifactPaths: ["/tmp/input.json"],
    outputArtifactPaths: ["/tmp/output.json"],
    evidenceClass: "dry_run_evidence",
    boundednessStatement:
      "This provenance block supports a bounded OpenPRA quantum workflow and does not imply platform completion.",
    ...overrides,
  };
}

function buildValidFailureRecord(overrides: Partial<OpenPraQuantumFailureRecord> = {}): OpenPraQuantumFailureRecord {
  return {
    failureId: "failure_001",
    failureTaxonomyVersion: OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION,
    failureCategory: "parser_failure",
    failureStage: "raw_result_parser",
    preparedCaseIdIfAvailable: "prepared_case_001",
    rawResultIdIfAvailable: "raw_result_001",
    backendFamilyIfAvailable: "ibm_gate",
    backendModeIfAvailable: "remote_hardware",
    timestampUtc: "2026-04-25T00:00:00Z",
    shortMessage: "Parser failed on malformed fixture",
    recoverable: true,
    retryRecommended: false,
    operatorAttentionRequired: true,
    artifactPathsIfAvailable: ["/tmp/parser.log"],
    ...overrides,
  };
}

describe("OpenPRA quantum provenance evidence classes", () => {
  it("accepts known evidence classes", () => {
    expect(isOpenPraQuantumEvidenceClass("platform_ibm_hardware_new")).toBe(true);
    expect(isOpenPraQuantumEvidenceClass("frontend_rendered_evidence")).toBe(true);
  });

  it("rejects unknown evidence classes", () => {
    expect(isOpenPraQuantumEvidenceClass("unlabeled_hardware")).toBe(false);
  });
});

describe("OpenPRA quantum failure categories", () => {
  it("accepts known failure categories", () => {
    expect(isOpenPraQuantumFailureCategory("boundedness_failure")).toBe(true);
    expect(isOpenPraQuantumFailureCategory("parser_failure")).toBe(true);
  });

  it("rejects unknown failure categories", () => {
    expect(isOpenPraQuantumFailureCategory("bad_failure")).toBe(false);
  });
});

describe("OpenPRA quantum provenance validator", () => {
  it("accepts a valid provenance block", () => {
    const result = validateOpenPraQuantumProvenanceBlock(buildValidProvenanceBlock());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("warns that frontend evidence is not canonical recovery evidence", () => {
    const result = validateOpenPraQuantumProvenanceBlock(
      buildValidProvenanceBlock({
        evidenceClass: "frontend_rendered_evidence",
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("frontend rendered evidence must not be treated as canonical recovery evidence");
  });

  it("warns that local exact validation is not hardware execution", () => {
    const result = validateOpenPraQuantumProvenanceBlock(
      buildValidProvenanceBlock({
        evidenceClass: "local_exact_validation",
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("local exact validation evidence must not be described as hardware execution");
  });

  it("rejects missing boundedness statement", () => {
    const result = validateOpenPraQuantumProvenanceBlock(
      buildValidProvenanceBlock({
        boundednessStatement: "",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("boundednessStatement is required and must be a nonempty string");
  });

  it("asserts valid provenance blocks without throwing", () => {
    expect(() => assertOpenPraQuantumProvenanceBlock(buildValidProvenanceBlock())).not.toThrow();
  });

  it("throws for invalid provenance blocks", () => {
    expect(() =>
      assertOpenPraQuantumProvenanceBlock(
        buildValidProvenanceBlock({
          inputArtifactPaths: "not-array" as unknown as string[],
        }),
      ),
    ).toThrow(/Invalid OpenPRA quantum provenance block/);
  });
});

describe("OpenPRA quantum failure validator", () => {
  it("accepts a valid failure record", () => {
    const result = validateOpenPraQuantumFailureRecord(buildValidFailureRecord());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("requires boundedness failure to demand operator attention", () => {
    const result = validateOpenPraQuantumFailureRecord(
      buildValidFailureRecord({
        failureCategory: "boundedness_failure",
        operatorAttentionRequired: false,
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("boundedness_failure must set operatorAttentionRequired to true");
  });

  it("warns when provenance failure is marked recoverable", () => {
    const result = validateOpenPraQuantumFailureRecord(
      buildValidFailureRecord({
        failureCategory: "provenance_failure",
        recoverable: true,
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "provenance_failure marked recoverable; verify that evidence chain remains defensible",
    );
  });

  it("rejects invalid artifact path list", () => {
    const result = validateOpenPraQuantumFailureRecord(
      buildValidFailureRecord({
        artifactPathsIfAvailable: "not-array" as unknown as string[],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("artifactPathsIfAvailable must be an array of strings when present");
  });

  it("asserts valid failure records without throwing", () => {
    expect(() => assertOpenPraQuantumFailureRecord(buildValidFailureRecord())).not.toThrow();
  });

  it("throws for invalid failure records", () => {
    expect(() =>
      assertOpenPraQuantumFailureRecord(
        buildValidFailureRecord({
          failureId: "",
        }),
      ),
    ).toThrow(/Invalid OpenPRA quantum failure record/);
  });
});

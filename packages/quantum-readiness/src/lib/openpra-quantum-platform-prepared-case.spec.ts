import {
  OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME,
  OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION,
  OpenPraQuantumPreparedCase,
  assertOpenPraQuantumPreparedCase,
  validateOpenPraQuantumPreparedCase,
} from "./openpra-quantum-platform-prepared-case";
import {
  isAllowedOpenPraQuantumBackendModePair,
  isOpenPraQuantumBackendFamily,
  isOpenPraQuantumBackendMode,
} from "./openpra-quantum-platform-backend-mode";

function buildValidPreparedCase(overrides: Partial<OpenPraQuantumPreparedCase> = {}): OpenPraQuantumPreparedCase {
  return {
    schemaName: OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME,
    schemaVersion: OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION,
    preparedCaseId: "prepared_case_phase2b_row_0905_G_G939_v1",
    sourceModelId: "openpra_baseline_model",
    sourceModelPath: "/tmp/openpra/source_model.json",
    subtreeId: "phase2b_row_0905",
    rootGateId: "G:G939",
    preparationTimestampUtc: "2026-04-25T00:00:00Z",
    preparationToolVersion: "openpra_quantum_platform_prepared_case_v1",
    backendFamily: "ibm_gate",
    backendMode: "remote_hardware",
    encodingFamily: "cl_qubo_gate_qaoa",
    supportedInputShape: {
      basicEventCount: 8,
      qubitCountIfGateBased: 8,
      topologyClassIfAvailable: "C",
      eligibilityStatus: "eligible",
      eligibilityReason: "Within v1 gate based eligibility envelope",
    },
    boundednessStatement:
      "This prepared case is part of a bounded OpenPRA quantum workflow. It does not by itself establish comparative quantum performance, production readiness, or unrestricted downstream PRA validity.",
    artifactRoot: "/tmp/openpra/prepared_case",
    submissionManifestPath: "/tmp/openpra/prepared_case/submission_manifest.json",
    expectedResultSchema: "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_v1",
    provenanceBlock: {
      evidenceClass: "dry_run_evidence",
      generatingTool: "unit_test",
    },
    failureTaxonomyVersion: "v1",
    ...overrides,
  };
}

describe("OpenPRA quantum backend mode definitions", () => {
  it("accepts known backend families", () => {
    expect(isOpenPraQuantumBackendFamily("local_gate")).toBe(true);
    expect(isOpenPraQuantumBackendFamily("ibm_gate")).toBe(true);
    expect(isOpenPraQuantumBackendFamily("annealing")).toBe(true);
    expect(isOpenPraQuantumBackendFamily("fixture")).toBe(true);
  });

  it("rejects unknown backend families", () => {
    expect(isOpenPraQuantumBackendFamily("unknown_backend")).toBe(false);
  });

  it("accepts known backend modes", () => {
    expect(isOpenPraQuantumBackendMode("local_validation")).toBe(true);
    expect(isOpenPraQuantumBackendMode("remote_hardware")).toBe(true);
    expect(isOpenPraQuantumBackendMode("annealing_vendor_pending")).toBe(true);
  });

  it("enforces allowed family and mode pairs", () => {
    expect(
      isAllowedOpenPraQuantumBackendModePair({
        backendFamily: "ibm_gate",
        backendMode: "remote_hardware",
      }),
    ).toBe(true);

    expect(
      isAllowedOpenPraQuantumBackendModePair({
        backendFamily: "annealing",
        backendMode: "remote_hardware",
      }),
    ).toBe(false);
  });
});

describe("OpenPRA quantum prepared case validator", () => {
  it("accepts a valid IBM prepared case", () => {
    const result = validateOpenPraQuantumPreparedCase(buildValidPreparedCase());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts batch metadata only as orchestration metadata", () => {
    const result = validateOpenPraQuantumPreparedCase(
      buildValidPreparedCase({
        batchMetadata: {
          batchId: "batch_001",
          batchPosition: 0,
          batchPolicyId: "single_case_canonical_batch_wrapper_v1",
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "batchMetadata is orchestration metadata only and does not change the canonical prepared case unit",
    );
  });

  it("rejects missing boundedness statement", () => {
    const result = validateOpenPraQuantumPreparedCase(
      buildValidPreparedCase({
        boundednessStatement: "",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("boundednessStatement is required and must be a nonempty string");
  });

  it("rejects missing provenance block", () => {
    const candidate = buildValidPreparedCase();

    const result = validateOpenPraQuantumPreparedCase({
      ...candidate,
      provenanceBlock: {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("provenanceBlock must be a nonempty object");
  });

  it("rejects incompatible backend family and mode pairs", () => {
    const result = validateOpenPraQuantumPreparedCase(
      buildValidPreparedCase({
        backendFamily: "annealing",
        backendMode: "remote_hardware",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("backendFamily/backendMode pair is not allowed: annealing/remote_hardware");
  });

  it("asserts valid prepared cases without throwing", () => {
    expect(() => assertOpenPraQuantumPreparedCase(buildValidPreparedCase())).not.toThrow();
  });

  it("throws for invalid prepared cases", () => {
    expect(() =>
      assertOpenPraQuantumPreparedCase(
        buildValidPreparedCase({
          expectedResultSchema: "",
        }),
      ),
    ).toThrow(/Invalid OpenPRA quantum prepared case/);
  });
});

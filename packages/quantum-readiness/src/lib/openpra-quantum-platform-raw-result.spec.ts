import {
  OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME,
  OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION,
  OpenPraQuantumRawResult,
  assertOpenPraQuantumRawResult,
  isOpenPraQuantumRawResultExecutionStatus,
  isOpenPraQuantumRawResultParserStatus,
  validateOpenPraQuantumRawResult,
} from "./openpra-quantum-platform-raw-result";

function buildValidRawResult(overrides: Partial<OpenPraQuantumRawResult> = {}): OpenPraQuantumRawResult {
  return {
    schemaName: OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME,
    schemaVersion: OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION,
    rawResultId: "raw_result_phase2b_row_0905_G_G939_ibm_v1",
    preparedCaseId: "prepared_case_phase2b_row_0905_G_G939_v1",
    backendSubmissionId: "ibm_job_placeholder_001",
    backendFamily: "ibm_gate",
    backendMode: "remote_hardware",
    executionStatus: "completed",
    parserStatus: "parsed",
    returnedArtifactRoot: "/tmp/openpra/raw_result",
    returnedProvenanceBlock: {
      evidenceClass: "platform_ibm_hardware_new",
      generatingTool: "unit_test",
    },
    canonicalRecoveryEntrypointTarget: "/tmp/openpra/raw_result/canonical_recovery_input.json",
    boundednessStatement:
      "This raw result is part of a bounded OpenPRA quantum workflow. It is not an authoritative recovery classification until processed through the canonical recovery entrypoint.",
    backendRawPayload: {
      shots: 8192,
      counts: {
        "00001001": 152,
      },
    },
    ...overrides,
  };
}

describe("OpenPRA quantum raw result status definitions", () => {
  it("accepts known execution statuses", () => {
    expect(isOpenPraQuantumRawResultExecutionStatus("completed")).toBe(true);
    expect(isOpenPraQuantumRawResultExecutionStatus("vendor_pending")).toBe(true);
    expect(isOpenPraQuantumRawResultExecutionStatus("fixture_completed")).toBe(true);
  });

  it("rejects unknown execution statuses", () => {
    expect(isOpenPraQuantumRawResultExecutionStatus("done")).toBe(false);
  });

  it("accepts known parser statuses", () => {
    expect(isOpenPraQuantumRawResultParserStatus("parsed")).toBe(true);
    expect(isOpenPraQuantumRawResultParserStatus("fixture_parsed")).toBe(true);
  });

  it("rejects unknown parser statuses", () => {
    expect(isOpenPraQuantumRawResultParserStatus("parser_done")).toBe(false);
  });
});

describe("OpenPRA quantum raw result validator", () => {
  it("accepts a valid IBM raw result envelope", () => {
    const result = validateOpenPraQuantumRawResult(buildValidRawResult());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain(
      "backendRawPayload is backend specific and is not an authoritative recovery classification",
    );
  });

  it("rejects missing canonical recovery entrypoint target", () => {
    const result = validateOpenPraQuantumRawResult(
      buildValidRawResult({
        canonicalRecoveryEntrypointTarget: "",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("canonicalRecoveryEntrypointTarget is required and must be a nonempty string");
  });

  it("rejects missing returned provenance block", () => {
    const result = validateOpenPraQuantumRawResult(
      buildValidRawResult({
        returnedProvenanceBlock: {},
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("returnedProvenanceBlock must be a nonempty object");
  });

  it("rejects incompatible backend family and mode pairs", () => {
    const result = validateOpenPraQuantumRawResult(
      buildValidRawResult({
        backendFamily: "annealing",
        backendMode: "remote_hardware",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("backendFamily/backendMode pair is not allowed: annealing/remote_hardware");
  });

  it("warns when execution completed but parsing has not started", () => {
    const result = validateOpenPraQuantumRawResult(
      buildValidRawResult({
        executionStatus: "completed",
        parserStatus: "not_started",
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      "execution completed but parser has not started; canonical recovery cannot proceed yet",
    );
  });

  it("asserts valid raw results without throwing", () => {
    expect(() => assertOpenPraQuantumRawResult(buildValidRawResult())).not.toThrow();
  });

  it("throws for invalid raw results", () => {
    expect(() =>
      assertOpenPraQuantumRawResult(
        buildValidRawResult({
          rawResultId: "",
        }),
      ),
    ).toThrow(/Invalid OpenPRA quantum raw result/);
  });
});

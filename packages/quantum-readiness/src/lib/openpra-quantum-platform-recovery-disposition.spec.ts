import { assignOpenPraQuantumRecoveryDisposition } from "./openpra-quantum-platform-recovery-disposition";

describe("OpenPRA recovery disposition", () => {
  it("assigns exact hardware recovery", () => {
    const result = assignOpenPraQuantumRecoveryDisposition({
      declaredExactMatchCount: 4,
      unionExactMatchCount: 4,
      referenceCount: 4,
    });

    expect(result.disposition).toBe("exact_hardware_recovery");
    expect(result.requiresOperatorAttention).toBe(false);
  });

  it("assigns union sensitivity recovery", () => {
    const result = assignOpenPraQuantumRecoveryDisposition({
      declaredExactMatchCount: 3,
      unionExactMatchCount: 4,
      referenceCount: 4,
    });

    expect(result.disposition).toBe("union_sensitivity_recovery");
    expect(result.requiresOperatorAttention).toBe(true);
  });

  it("assigns partial recovery", () => {
    const result = assignOpenPraQuantumRecoveryDisposition({
      declaredExactMatchCount: 2,
      unionExactMatchCount: 3,
      referenceCount: 4,
    });

    expect(result.disposition).toBe("partial_recovery");
    expect(result.requiresOperatorAttention).toBe(true);
  });

  it("handles missing reference set", () => {
    const result = assignOpenPraQuantumRecoveryDisposition({
      declaredExactMatchCount: 0,
      unionExactMatchCount: 0,
      referenceCount: 0,
    });

    expect(result.disposition).toBe("no_reference");
    expect(result.requiresOperatorAttention).toBe(true);
  });

  it("rejects invalid input", () => {
    const result = assignOpenPraQuantumRecoveryDisposition({
      declaredExactMatchCount: -1,
      unionExactMatchCount: 0,
      referenceCount: 4,
    });

    expect(result.disposition).toBe("invalid_input");
  });
});

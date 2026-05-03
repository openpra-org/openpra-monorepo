export type OpenPraQuantumRecoveryDisposition =
  | "exact_hardware_recovery"
  | "union_sensitivity_recovery"
  | "partial_recovery"
  | "no_reference"
  | "invalid_input";

export interface OpenPraQuantumRecoveryDispositionInput {
  declaredExactMatchCount: number;
  unionExactMatchCount: number;
  referenceCount: number;
}

export interface OpenPraQuantumRecoveryDispositionOutput {
  disposition: OpenPraQuantumRecoveryDisposition;
  requiresOperatorAttention: boolean;
  boundednessStatement: string;
  errors: string[];
}

export function assignOpenPraQuantumRecoveryDisposition(
  input: OpenPraQuantumRecoveryDispositionInput,
): OpenPraQuantumRecoveryDispositionOutput {
  const errors: string[] = [];

  for (const [name, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${name} must be a nonnegative integer`);
    }
  }

  if (errors.length > 0) {
    return {
      disposition: "invalid_input",
      requiresOperatorAttention: true,
      boundednessStatement: "Invalid input. No recovery disposition assigned.",
      errors,
    };
  }

  if (input.referenceCount === 0) {
    return {
      disposition: "no_reference",
      requiresOperatorAttention: true,
      boundednessStatement:
        "No reference MCS were provided. Recovery disposition cannot establish semantic completeness.",
      errors: [],
    };
  }

  if (input.declaredExactMatchCount >= input.referenceCount) {
    return {
      disposition: "exact_hardware_recovery",
      requiresOperatorAttention: false,
      boundednessStatement:
        "Declared orientation recovered all provided reference MCS. This does not imply comparative quantum performance or downstream PRA validity.",
      errors: [],
    };
  }

  if (input.unionExactMatchCount >= input.referenceCount) {
    return {
      disposition: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
      boundednessStatement:
        "Orientation union recovered all provided reference MCS. Operator attention is required because recovery depends on sensitivity logic.",
      errors: [],
    };
  }

  return {
    disposition: "partial_recovery",
    requiresOperatorAttention: true,
    boundednessStatement: "Not all provided reference MCS were recovered. Operator attention is required.",
    errors: [],
  };
}

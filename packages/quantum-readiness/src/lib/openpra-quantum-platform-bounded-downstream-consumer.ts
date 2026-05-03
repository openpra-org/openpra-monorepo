import { OpenPraQuantumRecoveryDisposition } from "./openpra-quantum-platform-recovery-disposition";

export interface OpenPraQuantumBoundedDownstreamConsumerInput {
  sourceModelId: string;
  subtreeId: string;
  rootGateId: string;
  backendSubmissionId: string;
  backendName: string;
  recoveredCandidateSets: string[][];
  referenceEventSets: string[][];
  exactMatches: string[][];
  missingReferenceSets: string[][];
  extraCandidateSets: string[][];
  disposition: OpenPraQuantumRecoveryDisposition;
  requiresOperatorAttention: boolean;
  evidenceClass: string;
}

export interface OpenPraQuantumBoundedDownstreamConsumerOutput {
  objectType: "bounded_quantum_shadow_analysis";
  importStatus: "imported_with_guardrails" | "invalid_input";
  sourceModelId: string;
  subtreeId: string;
  rootGateId: string;
  backendSubmissionId: string;
  backendName: string;
  comparisonSummary: {
    recoveredCandidateCount: number;
    referenceCount: number;
    exactMatchCount: number;
    missingReferenceCount: number;
    extraCandidateCount: number;
  };
  disposition: OpenPraQuantumRecoveryDisposition;
  requiresOperatorAttention: boolean;
  evidenceClass: string;
  productionPraQuantificationAllowed: false;
  boundednessStatement: string;
  errors: string[];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function importOpenPraQuantumBoundedShadowAnalysis(
  input: OpenPraQuantumBoundedDownstreamConsumerInput,
): OpenPraQuantumBoundedDownstreamConsumerOutput {
  const errors: string[] = [];

  for (const field of [
    "sourceModelId",
    "subtreeId",
    "rootGateId",
    "backendSubmissionId",
    "backendName",
    "evidenceClass",
  ]) {
    if (!nonEmpty((input as unknown as Record<string, unknown>)[field])) {
      errors.push(`${field} is required`);
    }
  }

  if (!Array.isArray(input.recoveredCandidateSets)) {
    errors.push("recoveredCandidateSets must be an array");
  }

  if (!Array.isArray(input.referenceEventSets)) {
    errors.push("referenceEventSets must be an array");
  }

  if (errors.length > 0) {
    return {
      objectType: "bounded_quantum_shadow_analysis",
      importStatus: "invalid_input",
      sourceModelId: input.sourceModelId ?? "",
      subtreeId: input.subtreeId ?? "",
      rootGateId: input.rootGateId ?? "",
      backendSubmissionId: input.backendSubmissionId ?? "",
      backendName: input.backendName ?? "",
      comparisonSummary: {
        recoveredCandidateCount: 0,
        referenceCount: 0,
        exactMatchCount: 0,
        missingReferenceCount: 0,
        extraCandidateCount: 0,
      },
      disposition: input.disposition ?? "invalid_input",
      requiresOperatorAttention: true,
      evidenceClass: input.evidenceClass ?? "unknown",
      productionPraQuantificationAllowed: false,
      boundednessStatement: "Invalid bounded shadow analysis input. Downstream PRA use is not allowed.",
      errors,
    };
  }

  return {
    objectType: "bounded_quantum_shadow_analysis",
    importStatus: "imported_with_guardrails",
    sourceModelId: input.sourceModelId,
    subtreeId: input.subtreeId,
    rootGateId: input.rootGateId,
    backendSubmissionId: input.backendSubmissionId,
    backendName: input.backendName,
    comparisonSummary: {
      recoveredCandidateCount: input.recoveredCandidateSets.length,
      referenceCount: input.referenceEventSets.length,
      exactMatchCount: input.exactMatches.length,
      missingReferenceCount: input.missingReferenceSets.length,
      extraCandidateCount: input.extraCandidateSets.length,
    },
    disposition: input.disposition,
    requiresOperatorAttention: input.requiresOperatorAttention,
    evidenceClass: input.evidenceClass,
    productionPraQuantificationAllowed: false,
    boundednessStatement:
      "This object is a bounded quantum shadow analysis import. It may support comparison and review but is not authorized for production PRA quantification.",
    errors: [],
  };
}

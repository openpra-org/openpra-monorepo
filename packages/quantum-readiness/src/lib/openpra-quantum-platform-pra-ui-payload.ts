import { OpenPraQuantumBoundedDownstreamConsumerOutput } from "./openpra-quantum-platform-bounded-downstream-consumer";

import {
  OpenPraQuantumProviderCapability,
  getOpenPraQuantumProviderRegistry,
} from "./openpra-quantum-platform-provider-registry";

export interface OpenPraQuantumPraUiPayloadInput {
  shadowAnalysis: OpenPraQuantumBoundedDownstreamConsumerOutput;
  jobId: string;
  backendName: string;
  artifactRoot: string;
}

export interface OpenPraQuantumPraUiPayload {
  payloadType: "openpra_quantum_pra_review_payload";
  status: "ready_with_guardrails" | "blocked";
  title: string;
  job: {
    jobId: string;
    backendName: string;
    evidenceClass: string;
  };
  subtree: {
    sourceModelId: string;
    subtreeId: string;
    rootGateId: string;
  };
  comparisonSummary: OpenPraQuantumBoundedDownstreamConsumerOutput["comparisonSummary"];
  disposition: string;
  requiresOperatorAttention: boolean;
  productionPraQuantificationAllowed: false;
  artifactRoot: string;
  boundednessStatement: string;
  guardrails: string[];
  providerRegistry: OpenPraQuantumProviderCapability[];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildOpenPraQuantumPraUiPayload(input: OpenPraQuantumPraUiPayloadInput): OpenPraQuantumPraUiPayload {
  const guardrails = [
    "No comparative quantum performance claim is made.",
    "No production PRA quantification is authorized.",
    "Raw hardware evidence must remain distinct from semantic recovery evidence.",
    "Operator attention is required when disposition is not exact hardware recovery.",
  ];

  const valid =
    input.shadowAnalysis.importStatus === "imported_with_guardrails" &&
    nonEmpty(input.jobId) &&
    nonEmpty(input.backendName) &&
    nonEmpty(input.artifactRoot);

  return {
    payloadType: "openpra_quantum_pra_review_payload",
    status: valid ? "ready_with_guardrails" : "blocked",
    title: "Quantum PRA Review",
    job: {
      jobId: input.jobId,
      backendName: input.backendName,
      evidenceClass: input.shadowAnalysis.evidenceClass,
    },
    subtree: {
      sourceModelId: input.shadowAnalysis.sourceModelId,
      subtreeId: input.shadowAnalysis.subtreeId,
      rootGateId: input.shadowAnalysis.rootGateId,
    },
    comparisonSummary: input.shadowAnalysis.comparisonSummary,
    disposition: input.shadowAnalysis.disposition,
    requiresOperatorAttention: input.shadowAnalysis.requiresOperatorAttention,
    productionPraQuantificationAllowed: false,
    artifactRoot: input.artifactRoot,
    boundednessStatement:
      "This UI payload presents a bounded quantum PRA review object. It supports review and comparison only and does not authorize production PRA quantification.",
    guardrails,
    providerRegistry: getOpenPraQuantumProviderRegistry(),
  };
}

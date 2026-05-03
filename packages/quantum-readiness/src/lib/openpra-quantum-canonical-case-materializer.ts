import * as fs from "node:fs";
import * as path from "node:path";

import {
  getOpenPraQuantumCanonicalCasePackSummary,
  type OpenPraQuantumCanonicalCasePackSummary,
} from "./openpra-quantum-canonical-case-pack";
import {
  SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
  assertOpenPraQuantumBoundedImportanceResponse,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";
import { buildOpenPraQuantumBoundedImportanceServiceFacade } from "./openpra-quantum-bounded-importance-service-facade";
import {
  createOpenPraQuantumProviderExecutionRequest,
  type CreateOpenPraQuantumProviderExecutionRequestParams,
} from "./openpra-quantum-provider-request-contract";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";

export interface OpenPraQuantumCanonicalCaseMaterializationRequest {
  rootDirectoryPath: string;
  boundedImportanceResponsesByCaseLabel: Record<string, OpenPraQuantumBoundedImportanceResponse>;
  providerRequestsByCaseLabel: Record<string, CreateOpenPraQuantumProviderExecutionRequestParams>;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumCanonicalCaseMaterializationBoundedResult {
  caseLabel: string;
  responsePath: string;
  provenanceManifestPath: string | null;
}

export interface OpenPraQuantumCanonicalCaseMaterializationProviderResult {
  caseLabel: string;
  requestPath: string;
  provenanceManifestPath: string;
}

export interface OpenPraQuantumCanonicalCaseMaterializationSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  ws5CaseLabels: string[];
  ws6CaseLabels: string[];
  boundedImportanceResultCount: number;
  providerRequestResultCount: number;
  boundedImportanceResults: OpenPraQuantumCanonicalCaseMaterializationBoundedResult[];
  providerRequestResults: OpenPraQuantumCanonicalCaseMaterializationProviderResult[];
}

export interface OpenPraQuantumCanonicalCaseMaterializationResult {
  canonicalCasePackSummary: OpenPraQuantumCanonicalCasePackSummary;
  summary: OpenPraQuantumCanonicalCaseMaterializationSummary;
  summaryPath: string;
  manifestPath: string;
}

export function materializeOpenPraQuantumCanonicalCasePackArtifacts(
  request: OpenPraQuantumCanonicalCaseMaterializationRequest,
): OpenPraQuantumCanonicalCaseMaterializationResult {
  const canonicalCasePackSummary = getOpenPraQuantumCanonicalCasePackSummary();
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-canonical-case-materializer-v1";

  const boundedImportanceRoot = path.join(request.rootDirectoryPath, "bounded_importance");
  const providerRequestRoot = path.join(request.rootDirectoryPath, "provider_requests");
  fs.mkdirSync(boundedImportanceRoot, { recursive: true });
  fs.mkdirSync(providerRequestRoot, { recursive: true });

  const boundedImportanceResults = canonicalCasePackSummary.ws5PriorityCases.map((caseEntry) => {
    const response = request.boundedImportanceResponsesByCaseLabel[caseEntry.caseLabel];
    if (!response) {
      throw new Error(`Missing bounded importance response for caseLabel=${caseEntry.caseLabel}.`);
    }

    assertOpenPraQuantumBoundedImportanceResponse(response);

    if (response.caseLabel !== caseEntry.caseLabel) {
      throw new Error(`Bounded importance response caseLabel mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    if (response.subtreeId !== caseEntry.subtreeId) {
      throw new Error(`Bounded importance subtreeId mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    if (response.topologyClass !== caseEntry.topologyClass) {
      throw new Error(`Bounded importance topologyClass mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    if (response.boundednessStatement !== SCREENING_LEVEL_BOUNDEDNESS_STATEMENT) {
      throw new Error(`Boundedness statement mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    const result = buildOpenPraQuantumBoundedImportanceServiceFacade({
      rootDirectoryPath: path.join(boundedImportanceRoot, caseEntry.caseLabel),
      subtreeId: response.subtreeId,
      topologyClass: response.topologyClass,
      recoveryMode: response.recoveryMode,
      operatorAttentionRequired: response.operatorAttentionRequired,
      quantumImportance: response.quantumImportance,
      classicalBaseline: response.classicalBaseline,
      comparisonStatistics: response.comparisonStatistics,
      provenanceManifestPath: response.provenanceManifestPath,
      sourceRecoveryArtifactPath: response.sourceRecoveryArtifactPath,
      generatedAtUtc: response.generatedAtUtc,
      caseLabel: response.caseLabel,
      expectedResponse: response,
      inputArtifactPaths: request.inputArtifactPaths ?? [],
      scriptVersion,
    });

    return {
      caseLabel: caseEntry.caseLabel,
      responsePath: result.persistedArtifacts.responsePath,
      provenanceManifestPath: result.persistedArtifacts.provenanceManifestPath ?? null,
    };
  });

  const providerRequestResults = canonicalCasePackSummary.ws6AcceptanceCases.map((caseEntry) => {
    const providerRequestParams = request.providerRequestsByCaseLabel[caseEntry.caseLabel];
    if (!providerRequestParams) {
      throw new Error(`Missing provider request parameters for caseLabel=${caseEntry.caseLabel}.`);
    }

    if (providerRequestParams.caseLabel !== caseEntry.caseLabel) {
      throw new Error(`Provider request caseLabel mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    if (providerRequestParams.subtreeId !== caseEntry.subtreeId) {
      throw new Error(`Provider request subtreeId mismatch for caseLabel=${caseEntry.caseLabel}.`);
    }

    const providerRequest = createOpenPraQuantumProviderExecutionRequest(providerRequestParams);

    const persisted = persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: path.join(providerRequestRoot, caseEntry.caseLabel),
      request: providerRequest,
      inputArtifactPaths: request.inputArtifactPaths ?? [],
      scriptVersion,
    });

    return {
      caseLabel: caseEntry.caseLabel,
      requestPath: persisted.requestPath,
      provenanceManifestPath: persisted.provenanceManifestPath,
    };
  });

  const summary: OpenPraQuantumCanonicalCaseMaterializationSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    ws5CaseLabels: canonicalCasePackSummary.ws5PriorityCases.map((entry) => entry.caseLabel),
    ws6CaseLabels: canonicalCasePackSummary.ws6AcceptanceCases.map((entry) => entry.caseLabel),
    boundedImportanceResultCount: boundedImportanceResults.length,
    providerRequestResultCount: providerRequestResults.length,
    boundedImportanceResults,
    providerRequestResults,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "canonical_case_materialization_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_case_materialization_manifest_v1.json");

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_canonical_case_materialization_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    ws5CaseLabels: summary.ws5CaseLabels,
    ws6CaseLabels: summary.ws6CaseLabels,
  });

  return {
    canonicalCasePackSummary,
    summary,
    summaryPath,
    manifestPath,
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

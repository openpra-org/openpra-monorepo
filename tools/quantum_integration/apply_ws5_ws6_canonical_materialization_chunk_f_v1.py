#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")


def read_text(rel: str) -> str:
    return (REPO_ROOT / rel).read_text(encoding="utf-8")


def write_text(rel: str, text: str) -> None:
    path = REPO_ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def insert_after(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, marker + block, 1)


def insert_before(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, block + marker, 1)


def main() -> None:
    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-materializer.ts",
        """import * as fs from "node:fs";
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
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-canonical-case-materializer-v1";

  const boundedImportanceRoot = path.join(
    request.rootDirectoryPath,
    "bounded_importance",
  );
  const providerRequestRoot = path.join(
    request.rootDirectoryPath,
    "provider_requests",
  );
  fs.mkdirSync(boundedImportanceRoot, { recursive: true });
  fs.mkdirSync(providerRequestRoot, { recursive: true });

  const boundedImportanceResults =
    canonicalCasePackSummary.ws5PriorityCases.map((caseEntry) => {
      const response =
        request.boundedImportanceResponsesByCaseLabel[caseEntry.caseLabel];
      if (!response) {
        throw new Error(
          `Missing bounded importance response for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      assertOpenPraQuantumBoundedImportanceResponse(response);

      if (response.caseLabel !== caseEntry.caseLabel) {
        throw new Error(
          `Bounded importance response caseLabel mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      if (response.subtreeId !== caseEntry.subtreeId) {
        throw new Error(
          `Bounded importance subtreeId mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      if (response.topologyClass !== caseEntry.topologyClass) {
        throw new Error(
          `Bounded importance topologyClass mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      if (response.boundednessStatement !== SCREENING_LEVEL_BOUNDEDNESS_STATEMENT) {
        throw new Error(
          `Boundedness statement mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
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
        provenanceManifestPath:
          result.persistedArtifacts.provenanceManifestPath ?? null,
      };
    });

  const providerRequestResults =
    canonicalCasePackSummary.ws6AcceptanceCases.map((caseEntry) => {
      const providerRequestParams =
        request.providerRequestsByCaseLabel[caseEntry.caseLabel];
      if (!providerRequestParams) {
        throw new Error(
          `Missing provider request parameters for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      if (providerRequestParams.caseLabel !== caseEntry.caseLabel) {
        throw new Error(
          `Provider request caseLabel mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      if (providerRequestParams.subtreeId !== caseEntry.subtreeId) {
        throw new Error(
          `Provider request subtreeId mismatch for caseLabel=${caseEntry.caseLabel}.`,
        );
      }

      const providerRequest = createOpenPraQuantumProviderExecutionRequest(
        providerRequestParams,
      );

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
    ws5CaseLabels: canonicalCasePackSummary.ws5PriorityCases.map(
      (entry) => entry.caseLabel,
    ),
    ws6CaseLabels: canonicalCasePackSummary.ws6AcceptanceCases.map(
      (entry) => entry.caseLabel,
    ),
    boundedImportanceResultCount: boundedImportanceResults.length,
    providerRequestResultCount: providerRequestResults.length,
    boundedImportanceResults,
    providerRequestResults,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_case_materialization_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_case_materialization_manifest_v1.json",
  );

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
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\\n`, "utf8");
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-materialization-loader.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import type { OpenPraQuantumCanonicalCaseMaterializationSummary } from "./openpra-quantum-canonical-case-materializer";

export interface OpenPraQuantumCanonicalCaseMaterializationLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumCanonicalCaseMaterializationLoadResult {
  summary: OpenPraQuantumCanonicalCaseMaterializationSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary(
  request: OpenPraQuantumCanonicalCaseMaterializationLoadRequest,
): OpenPraQuantumCanonicalCaseMaterializationLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_case_materialization_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical case materialization summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalCaseMaterializationSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_case_materialization_manifest_v1.json",
  );
  const manifest = fs.existsSync(manifestPath)
    ? (readJson(manifestPath) as Record<string, unknown>)
    : null;

  return {
    summary,
    summaryPath,
    manifest,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-materializer.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary } from "./openpra-quantum-canonical-case-materialization-loader";
import { materializeOpenPraQuantumCanonicalCasePackArtifacts } from "./openpra-quantum-canonical-case-materializer";

describe("openpra-quantum-canonical-case-materializer", () => {
  it("materializes and loads the canonical WS5 and WS6 case pack", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-case-pack-"));

    const result = materializeOpenPraQuantumCanonicalCasePackArtifacts({
      rootDirectoryPath: tempDir,
      boundedImportanceResponsesByCaseLabel: {
        phase2b_row_0698__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_0698__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_1037__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_1037__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_0905__G_G939: buildBoundedResponse({
          caseLabel: "phase2b_row_0905__G_G939",
          subtreeId: "G:G939",
          topologyClass: "C",
        }),
      },
      providerRequestsByCaseLabel: {
        phase2b_row_0698__G_G348: {
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 exact path request",
        },
        phase2b_row_0905__G_G939: {
          requestId: "provider-request-0905",
          subtreeId: "G:G939",
          caseLabel: "phase2b_row_0905__G_G939",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 C path request",
        },
      },
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-canonical-case-materializer.spec",
    });

    expect(result.summary.boundedImportanceResultCount).toBe(3);
    expect(result.summary.providerRequestResultCount).toBe(2);
    expect(fs.existsSync(result.summaryPath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary({
      rootDirectoryPath: tempDir,
    });

    expect(loaded.summary.ws5CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.summary.ws6CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});

function buildBoundedResponse(input: {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
}) {
  return {
    subtreeId: input.subtreeId,
    topologyClass: input.topologyClass,
    recoveryMode: "exact_hardware_recovery",
    operatorAttentionRequired: false,
    boundednessStatement: SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    quantumImportance: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    classicalBaseline: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    comparisonStatistics: {
      sharedBasicEventCount: 1,
      fvCorrelation: 1,
      rawCorrelation: 1,
      birnbaumCorrelation: 1,
      fvMaxAbsoluteDeviation: 0,
      rawMaxAbsoluteDeviation: 0,
      birnbaumMaxAbsoluteDeviation: 0,
      disagreementCount: 0,
    },
    provenanceManifestPath: `/provenance/${input.caseLabel}.json`,
    sourceRecoveryArtifactPath: `/recovery/${input.caseLabel}.json`,
    generatedAtUtc: "2026-04-17T17:03:17.743Z",
    caseLabel: input.caseLabel,
  };
}
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-provider-request-store";\n',
        'export * from "./openpra-quantum-canonical-case-materializer";\nexport * from "./openpra-quantum-canonical-case-materialization-loader";\n',
        "index chunk f exports",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  persistOpenPraQuantumProviderExecutionRequest,\n",
        "  loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary,\n  materializeOpenPraQuantumCanonicalCasePackArtifacts,\n",
        "service chunk f import functions",
    )
    service_text = insert_after(
        service_text,
        "  type CreateOpenPraQuantumProviderExecutionRequestParams,\n",
        "  type OpenPraQuantumCanonicalCaseMaterializationLoadResult,\n  type OpenPraQuantumCanonicalCaseMaterializationRequest,\n  type OpenPraQuantumCanonicalCaseMaterializationResult,\n",
        "service chunk f import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumCanonicalCaseMaterializationRequest =
  OpenPraQuantumCanonicalCaseMaterializationRequest;

export interface QuantumLoadLatestCanonicalCaseMaterializationRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk f request interfaces",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  materializeCanonicalCasePackArtifacts(
    request: QuantumCanonicalCaseMaterializationRequest,
  ): OpenPraQuantumCanonicalCaseMaterializationResult {
    return materializeOpenPraQuantumCanonicalCasePackArtifacts(request);
  }

  loadLatestCanonicalCaseMaterializationSummary(
    request: QuantumLoadLatestCanonicalCaseMaterializationRequest,
  ): OpenPraQuantumCanonicalCaseMaterializationLoadResult {
    return loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary(request);
  }

""",
        "service chunk f methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumProviderExecutionRequestStoreResult,\n",
        "  OpenPraQuantumCanonicalCaseMaterializationLoadResult,\n  OpenPraQuantumCanonicalCaseMaterializationResult,\n",
        "controller chunk f import result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestProviderExecutionRequest,\n",
        "  type QuantumCanonicalCaseMaterializationRequest,\n  type QuantumLoadLatestCanonicalCaseMaterializationRequest,\n",
        "controller chunk f service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumCanonicalCaseMaterializationRequestBody
  extends QuantumCanonicalCaseMaterializationRequest {}

export interface QuantumLoadLatestCanonicalCaseMaterializationRequestBody
  extends QuantumLoadLatestCanonicalCaseMaterializationRequest {}

""",
        "controller chunk f request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/canonical-case-pack/materialize")
  @HttpCode(HttpStatus.OK)
  materializeCanonicalCasePackArtifacts(
    @Body() body: QuantumCanonicalCaseMaterializationRequestBody,
  ): OpenPraQuantumCanonicalCaseMaterializationResult {
    try {
      return this.quantumReadinessService.materializeCanonicalCasePackArtifacts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/canonical-case-pack/materialize/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestCanonicalCaseMaterializationSummary(
    @Body() body: QuantumLoadLatestCanonicalCaseMaterializationRequestBody,
  ): OpenPraQuantumCanonicalCaseMaterializationLoadResult {
    try {
      return this.quantumReadinessService.loadLatestCanonicalCaseMaterializationSummary(
        body,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk f methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalMaterialization.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService canonical materialization", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(
      graphModelServiceMock as unknown as GraphModelService,
    );
  });

  it("materializes and loads the canonical case pack artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-service-"));

    const result = service.materializeCanonicalCasePackArtifacts({
      rootDirectoryPath: tempDir,
      boundedImportanceResponsesByCaseLabel: {
        phase2b_row_0698__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_0698__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_1037__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_1037__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_0905__G_G939: buildBoundedResponse({
          caseLabel: "phase2b_row_0905__G_G939",
          subtreeId: "G:G939",
          topologyClass: "C",
        }),
      },
      providerRequestsByCaseLabel: {
        phase2b_row_0698__G_G348: buildProviderRequest({
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
        }),
        phase2b_row_0905__G_G939: buildProviderRequest({
          requestId: "provider-request-0905",
          subtreeId: "G:G939",
          caseLabel: "phase2b_row_0905__G_G939",
        }),
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.canonicalMaterialization.service.spec",
    });

    expect(result.summary.boundedImportanceResultCount).toBe(3);
    expect(result.summary.providerRequestResultCount).toBe(2);
    expect(fs.existsSync(result.summaryPath)).toBe(true);

    const loaded = service.loadLatestCanonicalCaseMaterializationSummary({
      rootDirectoryPath: tempDir,
    });

    expect(loaded.summary.ws5CaseLabels).toHaveLength(3);
    expect(loaded.summary.ws6CaseLabels).toHaveLength(2);
  });
});

function buildBoundedResponse(input: {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
}) {
  return {
    subtreeId: input.subtreeId,
    topologyClass: input.topologyClass,
    recoveryMode: "exact_hardware_recovery",
    operatorAttentionRequired: false,
    boundednessStatement:
      "Bounded screening level use only. Results are not a substitute for a full PRA importance analysis.",
    quantumImportance: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    classicalBaseline: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    comparisonStatistics: {
      sharedBasicEventCount: 1,
      fvCorrelation: 1,
      rawCorrelation: 1,
      birnbaumCorrelation: 1,
      fvMaxAbsoluteDeviation: 0,
      rawMaxAbsoluteDeviation: 0,
      birnbaumMaxAbsoluteDeviation: 0,
      disagreementCount: 0,
    },
    provenanceManifestPath: `/provenance/${input.caseLabel}.json`,
    sourceRecoveryArtifactPath: `/recovery/${input.caseLabel}.json`,
    generatedAtUtc: "2026-04-17T17:03:17.743Z",
    caseLabel: input.caseLabel,
  };
}

function buildProviderRequest(input: {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
}) {
  return {
    requestId: input.requestId,
    subtreeId: input.subtreeId,
    caseLabel: input.caseLabel,
    providerName: "ibm_runtime",
    backendName: "ibm_torino",
    shots: 8192,
    resilienceLevel: 0,
    createdAtUtc: "2026-04-17T17:03:17.743Z",
    notes: "Canonical WS6 request",
  };
}
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalMaterialization.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical materialization", () => {
  let controller: QuantumReadinessController;
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(
      graphModelServiceMock as unknown as GraphModelService,
    );

    controller = new QuantumReadinessController(service);
  });

  it("materializes and loads canonical case artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-controller-"));

    const result = controller.materializeCanonicalCasePackArtifacts({
      rootDirectoryPath: tempDir,
      boundedImportanceResponsesByCaseLabel: {
        phase2b_row_0698__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_0698__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_1037__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_1037__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_0905__G_G939: buildBoundedResponse({
          caseLabel: "phase2b_row_0905__G_G939",
          subtreeId: "G:G939",
          topologyClass: "C",
        }),
      },
      providerRequestsByCaseLabel: {
        phase2b_row_0698__G_G348: buildProviderRequest({
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
        }),
        phase2b_row_0905__G_G939: buildProviderRequest({
          requestId: "provider-request-0905",
          subtreeId: "G:G939",
          caseLabel: "phase2b_row_0905__G_G939",
        }),
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.canonicalMaterialization.controller.spec",
    });

    expect(result.summary.boundedImportanceResultCount).toBe(3);
    expect(fs.existsSync(result.summaryPath)).toBe(true);

    const loaded = controller.loadLatestCanonicalCaseMaterializationSummary({
      rootDirectoryPath: tempDir,
    });

    expect(loaded.summary.ws5CaseLabels).toHaveLength(3);
    expect(loaded.summary.ws6CaseLabels).toHaveLength(2);
  });
});

function buildBoundedResponse(input: {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
}) {
  return {
    subtreeId: input.subtreeId,
    topologyClass: input.topologyClass,
    recoveryMode: "exact_hardware_recovery",
    operatorAttentionRequired: false,
    boundednessStatement:
      "Bounded screening level use only. Results are not a substitute for a full PRA importance analysis.",
    quantumImportance: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    classicalBaseline: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    comparisonStatistics: {
      sharedBasicEventCount: 1,
      fvCorrelation: 1,
      rawCorrelation: 1,
      birnbaumCorrelation: 1,
      fvMaxAbsoluteDeviation: 0,
      rawMaxAbsoluteDeviation: 0,
      birnbaumMaxAbsoluteDeviation: 0,
      disagreementCount: 0,
    },
    provenanceManifestPath: `/provenance/${input.caseLabel}.json`,
    sourceRecoveryArtifactPath: `/recovery/${input.caseLabel}.json`,
    generatedAtUtc: "2026-04-17T17:03:17.743Z",
    caseLabel: input.caseLabel,
  };
}

function buildProviderRequest(input: {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
}) {
  return {
    requestId: input.requestId,
    subtreeId: input.subtreeId,
    caseLabel: input.caseLabel,
    providerName: "ibm_runtime",
    backendName: "ibm_torino",
    shots: 8192,
    resilienceLevel: 0,
    createdAtUtc: "2026-04-17T17:03:17.743Z",
    notes: "Canonical WS6 request",
  };
}
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.canonicalMaterialization.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalMaterialization.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("materializes and loads the canonical case pack through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-http-"));

    const materialized = await request(app.getHttpServer())
      .post("/canonical-case-pack/materialize")
      .send({
        rootDirectoryPath: tempDir,
        boundedImportanceResponsesByCaseLabel: {
          phase2b_row_0698__G_G348: buildBoundedResponse({
            caseLabel: "phase2b_row_0698__G_G348",
            subtreeId: "G:G348",
            topologyClass: "A",
          }),
          phase2b_row_1037__G_G348: buildBoundedResponse({
            caseLabel: "phase2b_row_1037__G_G348",
            subtreeId: "G:G348",
            topologyClass: "A",
          }),
          phase2b_row_0905__G_G939: buildBoundedResponse({
            caseLabel: "phase2b_row_0905__G_G939",
            subtreeId: "G:G939",
            topologyClass: "C",
          }),
        },
        providerRequestsByCaseLabel: {
          phase2b_row_0698__G_G348: buildProviderRequest({
            requestId: "provider-request-0698",
            subtreeId: "G:G348",
            caseLabel: "phase2b_row_0698__G_G348",
          }),
          phase2b_row_0905__G_G939: buildProviderRequest({
            requestId: "provider-request-0905",
            subtreeId: "G:G939",
            caseLabel: "phase2b_row_0905__G_G939",
          }),
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.canonicalMaterialization.http.spec",
      })
      .expect(200);

    expect(materialized.body.summary.boundedImportanceResultCount).toBe(3);
    expect(materialized.body.summary.providerRequestResultCount).toBe(2);
    expect(fs.existsSync(materialized.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/canonical-case-pack/materialize/load-latest")
      .send({
        rootDirectoryPath: tempDir,
      })
      .expect(200);

    expect(loaded.body.summary.ws5CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.body.summary.ws6CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});

function buildBoundedResponse(input: {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
}) {
  return {
    subtreeId: input.subtreeId,
    topologyClass: input.topologyClass,
    recoveryMode: "exact_hardware_recovery",
    operatorAttentionRequired: false,
    boundednessStatement:
      "Bounded screening level use only. Results are not a substitute for a full PRA importance analysis.",
    quantumImportance: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    classicalBaseline: [
      {
        basicEventId: "BE_A",
        fussellVesely: 0.5,
        riskAchievementWorth: 2.0,
        birnbaum: 0.1,
      },
    ],
    comparisonStatistics: {
      sharedBasicEventCount: 1,
      fvCorrelation: 1,
      rawCorrelation: 1,
      birnbaumCorrelation: 1,
      fvMaxAbsoluteDeviation: 0,
      rawMaxAbsoluteDeviation: 0,
      birnbaumMaxAbsoluteDeviation: 0,
      disagreementCount: 0,
    },
    provenanceManifestPath: `/provenance/${input.caseLabel}.json`,
    sourceRecoveryArtifactPath: `/recovery/${input.caseLabel}.json`,
    generatedAtUtc: "2026-04-17T17:03:17.743Z",
    caseLabel: input.caseLabel,
  };
}

function buildProviderRequest(input: {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
}) {
  return {
    requestId: input.requestId,
    subtreeId: input.subtreeId,
    caseLabel: input.caseLabel,
    providerName: "ibm_runtime",
    backendName: "ibm_torino",
    shots: 8192,
    resilienceLevel: 0,
    createdAtUtc: "2026-04-17T17:03:17.743Z",
    notes: "Canonical WS6 request",
  };
}
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws5_ws6_canonical_materialization_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_canonical_materialization_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_WS6_CANONICAL_MATERIALIZATION_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-materializer.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalMaterialization.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalMaterialization.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.canonicalMaterialization.http.spec.ts" "$RUN_DIR/http_tests/"

COMMIT_HASH="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BRANCH_NAME="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

python3 - <<'PY' "$RUN_DIR" "$COMMIT_HASH" "$BRANCH_NAME"
from pathlib import Path
import json
import sys
from datetime import datetime, timezone

run_dir = Path(sys.argv[1])
commit_hash = sys.argv[2]
branch_name = sys.argv[3]

summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "checkpointName": "OPENPRA_QUANTUM_WS5_WS6_CANONICAL_MATERIALIZATION_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/canonical-case-pack/materialize",
        "/canonical-case-pack/materialize/load-latest",
    ],
    "interpretation": (
        "Chunk F adds canonical case pack materialization and summary loading "
        "for WS5 bounded importance and WS6 provider request artifacts."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_ws6_canonical_materialization_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS5 WS6 Canonical Materialization Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /canonical-case-pack/materialize
- /canonical-case-pack/materialize/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_WS6_CANONICAL_MATERIALIZATION_CHECKPOINT_MEMO_v1.txt").write_text(
    memo,
    encoding="utf-8",
)
PY

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$RUN_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$RUN_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
""",
    )

    print("Applied WS5/WS6 canonical materialization chunk F successfully.")


if __name__ == "__main__":
    main()

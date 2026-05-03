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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Could not find expected block for {label}.")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, block + marker, 1)


def insert_after(text: str, marker: str, block: str, label: str) -> str:
    if marker not in text:
        raise RuntimeError(f"Could not find marker for {label}.")
    return text.replace(marker, marker + block, 1)


def main() -> None:
    # ------------------------------------------------------------------
    # Package-layer loader: bounded importance
    # ------------------------------------------------------------------
    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-bounded-importance-artifact-loader.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumBoundedImportanceResponse,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";

export interface OpenPraQuantumBoundedImportanceArtifactLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumBoundedImportanceArtifactLoadResult {
  response: OpenPraQuantumBoundedImportanceResponse;
  responsePath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function loadLatestOpenPraQuantumBoundedImportanceArtifacts(
  request: OpenPraQuantumBoundedImportanceArtifactLoadRequest,
): OpenPraQuantumBoundedImportanceArtifactLoadResult {
  const candidates = findFilesRecursive(
    request.rootDirectoryPath,
    "bounded_importance_response_v1.json",
  );

  const matches = candidates
    .map((responsePath) => buildBoundedImportanceLoadCandidate(responsePath))
    .filter((candidate) =>
      request.caseLabel
        ? candidate.response.caseLabel === request.caseLabel
        : true,
    )
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No bounded importance artifacts found.");
  }

  const selected = matches[0];
  return {
    response: selected.response,
    responsePath: selected.responsePath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface BoundedImportanceLoadCandidate {
  response: OpenPraQuantumBoundedImportanceResponse;
  responsePath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildBoundedImportanceLoadCandidate(
  responsePath: string,
): BoundedImportanceLoadCandidate {
  const response = readJson(responsePath) as OpenPraQuantumBoundedImportanceResponse;
  assertOpenPraQuantumBoundedImportanceResponse(response);

  const dirPath = path.dirname(responsePath);
  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest = fs.existsSync(provenanceManifestPath)
    ? (readJson(provenanceManifestPath) as Record<string, unknown>)
    : null;

  return {
    response,
    responsePath,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath)
      ? provenanceManifestPath
      : null,
    mtimeMs: fs.statSync(responsePath).mtimeMs,
  };
}

function findFilesRecursive(rootDirectoryPath: string, fileName: string): string[] {
  if (!fs.existsSync(rootDirectoryPath)) {
    return [];
  }

  const results: string[] = [];
  walk(rootDirectoryPath, fileName, results);
  results.sort();
  return results;
}

function walk(currentPath: string, fileName: string, results: string[]): void {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, fileName, results);
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      results.push(fullPath);
    }
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
""",
    )

    # ------------------------------------------------------------------
    # Package-layer loader: execution artifacts
    # ------------------------------------------------------------------
    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-execution-artifact-loader.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumExecutionRecord,
  assertOpenPraQuantumExecutionResult,
  type OpenPraQuantumExecutionRecord,
  type OpenPraQuantumExecutionResult,
} from "./openpra-quantum-execution-bridge-contract";

export interface OpenPraQuantumExecutionArtifactLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumExecutionArtifactLoadResult {
  executionRecord: OpenPraQuantumExecutionRecord;
  executionRecordPath: string;
  executionResult: OpenPraQuantumExecutionResult | null;
  executionResultPath: string | null;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function loadLatestOpenPraQuantumExecutionArtifacts(
  request: OpenPraQuantumExecutionArtifactLoadRequest,
): OpenPraQuantumExecutionArtifactLoadResult {
  const candidates = findFilesRecursive(
    request.rootDirectoryPath,
    "execution_record_v1.json",
  );

  const matches = candidates
    .map((recordPath) => buildExecutionLoadCandidate(recordPath))
    .filter((candidate) =>
      request.caseLabel
        ? candidate.executionRecord.caseLabel === request.caseLabel
        : true,
    )
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No execution artifacts found.");
  }

  const selected = matches[0];
  return {
    executionRecord: selected.executionRecord,
    executionRecordPath: selected.executionRecordPath,
    executionResult: selected.executionResult,
    executionResultPath: selected.executionResultPath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface ExecutionLoadCandidate {
  executionRecord: OpenPraQuantumExecutionRecord;
  executionRecordPath: string;
  executionResult: OpenPraQuantumExecutionResult | null;
  executionResultPath: string | null;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildExecutionLoadCandidate(
  executionRecordPath: string,
): ExecutionLoadCandidate {
  const executionRecord = readJson(executionRecordPath) as OpenPraQuantumExecutionRecord;
  assertOpenPraQuantumExecutionRecord(executionRecord);

  const dirPath = path.dirname(executionRecordPath);

  const executionResultPath = path.join(dirPath, "execution_result_v1.json");
  const executionResult = fs.existsSync(executionResultPath)
    ? (readJson(executionResultPath) as OpenPraQuantumExecutionResult)
    : null;

  if (executionResult) {
    assertOpenPraQuantumExecutionResult(executionResult);
  }

  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest = fs.existsSync(provenanceManifestPath)
    ? (readJson(provenanceManifestPath) as Record<string, unknown>)
    : null;

  return {
    executionRecord,
    executionRecordPath,
    executionResult,
    executionResultPath: fs.existsSync(executionResultPath)
      ? executionResultPath
      : null,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath)
      ? provenanceManifestPath
      : null,
    mtimeMs: fs.statSync(executionRecordPath).mtimeMs,
  };
}

function findFilesRecursive(rootDirectoryPath: string, fileName: string): string[] {
  if (!fs.existsSync(rootDirectoryPath)) {
    return [];
  }

  const results: string[] = [];
  walk(rootDirectoryPath, fileName, results);
  results.sort();
  return results;
}

function walk(currentPath: string, fileName: string, results: string[]): void {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, fileName, results);
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      results.push(fullPath);
    }
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
""",
    )

    # ------------------------------------------------------------------
    # Package specs
    # ------------------------------------------------------------------
    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-bounded-importance-artifact-loader.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { buildOpenPraQuantumBoundedImportanceServiceFacade } from "./openpra-quantum-bounded-importance-service-facade";
import { loadLatestOpenPraQuantumBoundedImportanceArtifacts } from "./openpra-quantum-bounded-importance-artifact-loader";

describe("openpra-quantum-bounded-importance-artifact-loader", () => {
  it("loads the latest bounded importance artifact by case label", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-loader-"));

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A" as const,
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
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc: "2026-04-17T17:03:17.743Z",
      caseLabel: "phase2b_row_0698__G_G348",
    };

    buildOpenPraQuantumBoundedImportanceServiceFacade({
      rootDirectoryPath: tempDir,
      inputArtifactPaths: [],
      scriptVersion: "bounded-importance-loader.spec",
      ...expectedResponse,
      expectedResponse,
    });

    const loaded = loadLatestOpenPraQuantumBoundedImportanceArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.response.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.response.boundednessStatement).toBe(
      SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    );
    expect(fs.existsSync(loaded.responsePath)).toBe(true);
    expect(fs.existsSync(loaded.provenanceManifestPath ?? "")).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-execution-artifact-loader.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOpenPraQuantumExecutionRecordServiceStub } from "./openpra-quantum-execution-record-service-stub";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

describe("openpra-quantum-execution-artifact-loader", () => {
  it("loads the latest execution artifacts by case label", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-loader-"));

    buildOpenPraQuantumExecutionRecordServiceStub({
      rootDirectoryPath: tempDir,
      executionRecord: {
        subtreeId: "G:G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        jobId: "job-0698",
        shots: 8192,
        resilienceLevel: 0,
        status: "submitted",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        submittedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      executionResult: {
        jobId: "job-0698",
        status: "completed",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
      },
      inputArtifactPaths: [],
      scriptVersion: "execution-artifact-loader.spec",
    });

    const loaded = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.executionResult?.status).toBe("completed");
    expect(fs.existsSync(loaded.executionRecordPath)).toBe(true);
    expect(fs.existsSync(loaded.provenanceManifestPath ?? "")).toBe(true);
  });
});
""",
    )

    # ------------------------------------------------------------------
    # Update index.ts
    # ------------------------------------------------------------------
    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-bounded-importance-artifact-store";\n',
        'export * from "./openpra-quantum-bounded-importance-artifact-loader";\n',
        "index ws5 loader export",
    )
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-execution-artifact-store";\n',
        'export * from "./openpra-quantum-execution-artifact-loader";\n',
        "index ws6 loader export",
    )
    write_text(index_rel, index_text)

    # ------------------------------------------------------------------
    # Update service.ts
    # ------------------------------------------------------------------
    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  buildOpenPraQuantumExecutionRecordServiceStub,\n",
        "  loadLatestOpenPraQuantumBoundedImportanceArtifacts,\n  loadLatestOpenPraQuantumExecutionArtifacts,\n",
        "service import functions",
    )

    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumExecutionRecordServiceStubResult,\n",
        "  type OpenPraQuantumBoundedImportanceArtifactLoadResult,\n  type OpenPraQuantumExecutionArtifactLoadResult,\n",
        "service import result types",
    )

    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export interface QuantumLoadLatestBoundedImportanceRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface QuantumLoadLatestExecutionArtifactsRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

""",
        "service load request interfaces",
    )

    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  loadLatestBoundedImportanceArtifacts(
    request: QuantumLoadLatestBoundedImportanceRequest,
  ): OpenPraQuantumBoundedImportanceArtifactLoadResult {
    return loadLatestOpenPraQuantumBoundedImportanceArtifacts(request);
  }

  loadLatestExecutionArtifacts(
    request: QuantumLoadLatestExecutionArtifactsRequest,
  ): OpenPraQuantumExecutionArtifactLoadResult {
    return loadLatestOpenPraQuantumExecutionArtifacts(request);
  }

""",
        "service load methods",
    )

    write_text(service_rel, service_text)

    # ------------------------------------------------------------------
    # Update controller.ts
    # ------------------------------------------------------------------
    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumExecutionRecordServiceStubResult,\n",
        "  OpenPraQuantumBoundedImportanceArtifactLoadResult,\n  OpenPraQuantumExecutionArtifactLoadResult,\n",
        "controller quantum-readiness import types",
    )

    controller_text = insert_after(
        controller_text,
        "  type QuantumExecutionRecordServiceStubRequest,\n",
        "  type QuantumLoadLatestBoundedImportanceRequest,\n  type QuantumLoadLatestExecutionArtifactsRequest,\n",
        "controller service import types",
    )

    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumLoadLatestBoundedImportanceRequestBody
  extends QuantumLoadLatestBoundedImportanceRequest {}

export interface QuantumLoadLatestExecutionArtifactsRequestBody
  extends QuantumLoadLatestExecutionArtifactsRequest {}

""",
        "controller load request bodies",
    )

    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/importance/bounded/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestBoundedImportanceArtifacts(
    @Body() body: QuantumLoadLatestBoundedImportanceRequestBody,
  ): OpenPraQuantumBoundedImportanceArtifactLoadResult {
    try {
      return this.quantumReadinessService.loadLatestBoundedImportanceArtifacts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/record-stub/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestExecutionArtifacts(
    @Body() body: QuantumLoadLatestExecutionArtifactsRequestBody,
  ): OpenPraQuantumExecutionArtifactLoadResult {
    try {
      return this.quantumReadinessService.loadLatestExecutionArtifacts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller load methods",
    )

    write_text(controller_rel, controller_text)

    # ------------------------------------------------------------------
    # New web-backend unit specs
    # ------------------------------------------------------------------
    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.loadArtifacts.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService artifact loading", () => {
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

  it("loads latest bounded importance artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-service-load-"));
    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A" as const,
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
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc: "2026-04-17T17:03:17.743Z",
      caseLabel: "phase2b_row_0698__G_G348",
    };

    service.buildBoundedImportanceServiceFacade({
      rootDirectoryPath: tempDir,
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.loadArtifacts.service.spec",
      ...expectedResponse,
      expectedResponse,
    });

    const loaded = service.loadLatestBoundedImportanceArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.response.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.response.boundednessStatement).toBe(
      SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    );
    expect(fs.existsSync(loaded.responsePath)).toBe(true);
  });

  it("loads latest execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-service-load-"));

    service.buildExecutionRecordServiceStub({
      rootDirectoryPath: tempDir,
      executionRecord: {
        subtreeId: "G:G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        jobId: "job-0698",
        shots: 8192,
        resilienceLevel: 0,
        status: "submitted",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        submittedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      executionResult: {
        jobId: "job-0698",
        status: "completed",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.loadArtifacts.service.spec",
    });

    const loaded = service.loadLatestExecutionArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.executionResult?.status).toBe("completed");
    expect(fs.existsSync(loaded.executionRecordPath)).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.loadArtifacts.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController artifact loading", () => {
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

  it("loads latest bounded importance artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-controller-load-"));
    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A" as const,
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
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc: "2026-04-17T17:03:17.743Z",
      caseLabel: "phase2b_row_0698__G_G348",
    };

    controller.buildBoundedImportanceServiceFacade({
      rootDirectoryPath: tempDir,
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.loadArtifacts.controller.spec",
      ...expectedResponse,
      expectedResponse,
    });

    const loaded = controller.loadLatestBoundedImportanceArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.response.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(fs.existsSync(loaded.responsePath)).toBe(true);
  });

  it("loads latest execution artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-controller-load-"));

    controller.buildExecutionRecordServiceStub({
      rootDirectoryPath: tempDir,
      executionRecord: {
        subtreeId: "G:G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        jobId: "job-0698",
        shots: 8192,
        resilienceLevel: 0,
        status: "submitted",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        submittedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      executionResult: {
        jobId: "job-0698",
        status: "completed",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.loadArtifacts.controller.spec",
    });

    const loaded = controller.loadLatestExecutionArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(fs.existsSync(loaded.executionRecordPath)).toBe(true);
  });
});
""",
    )

    # ------------------------------------------------------------------
    # New web-backend HTTP specs
    # ------------------------------------------------------------------
    write_text(
        "packages/web-backend/tests/quantumReadiness.importanceBounded.loadLatest.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.importanceBounded.loadLatest.http", () => {
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

  it("loads the latest bounded importance artifact through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-http-load-"));
    const generatedAtUtc = "2026-04-17T17:03:17.743Z";

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A",
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
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc,
      caseLabel: "phase2b_row_0698__G_G348",
    };

    await request(app.getHttpServer())
      .post("/importance/bounded")
      .send({
        rootDirectoryPath: tempDir,
        subtreeId: expectedResponse.subtreeId,
        topologyClass: expectedResponse.topologyClass,
        recoveryMode: expectedResponse.recoveryMode,
        operatorAttentionRequired: expectedResponse.operatorAttentionRequired,
        quantumImportance: expectedResponse.quantumImportance,
        classicalBaseline: expectedResponse.classicalBaseline,
        comparisonStatistics: expectedResponse.comparisonStatistics,
        provenanceManifestPath: expectedResponse.provenanceManifestPath,
        sourceRecoveryArtifactPath: expectedResponse.sourceRecoveryArtifactPath,
        generatedAtUtc: expectedResponse.generatedAtUtc,
        caseLabel: expectedResponse.caseLabel,
        expectedResponse,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/importance/bounded/load-latest")
      .send({
        rootDirectoryPath: tempDir,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(response.body.response.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(response.body.response.boundednessStatement).toBe(
      SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    );
    expect(fs.existsSync(response.body.responsePath)).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.executionRecordStub.loadLatest.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.executionRecordStub.loadLatest.http", () => {
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

  it("loads the latest execution artifact through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-http-load-"));

    await request(app.getHttpServer())
      .post("/execution/record-stub")
      .send({
        rootDirectoryPath: tempDir,
        executionRecord: {
          subtreeId: "G:G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          jobId: "job-0698",
          shots: 8192,
          resilienceLevel: 0,
          status: "submitted",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          submittedAtUtc: "2026-04-17T17:03:17.743Z",
          caseLabel: "phase2b_row_0698__G_G348",
        },
        executionResult: {
          jobId: "job-0698",
          status: "completed",
          rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
          recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.executionRecordStub.loadLatest.http.spec",
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: tempDir,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(response.body.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(response.body.executionResult.status).toBe("completed");
    expect(fs.existsSync(response.body.executionRecordPath)).toBe(true);
  });
});
""",
    )

    # ------------------------------------------------------------------
    # Checkpoint bundle script
    # ------------------------------------------------------------------
    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws5_ws6_artifact_load_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_artifact_load_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_WS6_ARTIFACT_LOAD_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-bounded-importance-artifact-loader.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-execution-artifact-loader.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.loadArtifacts.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.loadArtifacts.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.importanceBounded.loadLatest.http.spec.ts" "$RUN_DIR/http_tests/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.executionRecordStub.loadLatest.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS5_WS6_ARTIFACT_LOAD_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/importance/bounded/load-latest",
        "/execution/record-stub/load-latest",
    ],
    "interpretation": (
        "Chunk D adds artifact-backed loading for WS5 bounded importance and "
        "WS6 execution records across package, service, controller, and HTTP layers."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_ws6_artifact_load_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS5 WS6 Artifact Load Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /importance/bounded/load-latest
- /execution/record-stub/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_WS6_ARTIFACT_LOAD_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied WS5/WS6 artifact load chunk D successfully.")


if __name__ == "__main__":
    main()

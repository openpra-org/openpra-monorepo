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
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-pack.ts",
        """export type OpenPraQuantumCanonicalCaseRole =
  | "ws5_priority"
  | "ws6_acceptance"
  | "ws5_and_ws6";

export interface OpenPraQuantumCanonicalCase {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  role: OpenPraQuantumCanonicalCaseRole;
  notes: string;
}

export interface OpenPraQuantumCanonicalCasePackSummary {
  ws5PriorityCases: OpenPraQuantumCanonicalCase[];
  ws6AcceptanceCases: OpenPraQuantumCanonicalCase[];
  allCases: OpenPraQuantumCanonicalCase[];
  allCaseLabels: string[];
}

const CANONICAL_CASES: OpenPraQuantumCanonicalCase[] = [
  {
    caseLabel: "phase2b_row_0698__G_G348",
    subtreeId: "G:G348",
    topologyClass: "A",
    role: "ws5_and_ws6",
    notes: "Exact A path and primary WS6 exact acceptance case.",
  },
  {
    caseLabel: "phase2b_row_1037__G_G348",
    subtreeId: "G:G348",
    topologyClass: "A",
    role: "ws5_priority",
    notes: "Second exact A path case in the WS5 canonical overlap cohort.",
  },
  {
    caseLabel: "phase2b_row_0905__G_G939",
    subtreeId: "G:G939",
    topologyClass: "C",
    role: "ws5_and_ws6",
    notes: "Harder C path and primary WS6 nontrivial acceptance case.",
  },
];

export function getOpenPraQuantumCanonicalCasePackSummary(): OpenPraQuantumCanonicalCasePackSummary {
  const ws5PriorityCases = CANONICAL_CASES.filter(
    (entry) => entry.role === "ws5_priority" || entry.role === "ws5_and_ws6",
  );
  const ws6AcceptanceCases = CANONICAL_CASES.filter(
    (entry) => entry.role === "ws6_acceptance" || entry.role === "ws5_and_ws6",
  );

  return {
    ws5PriorityCases,
    ws6AcceptanceCases,
    allCases: [...CANONICAL_CASES],
    allCaseLabels: CANONICAL_CASES.map((entry) => entry.caseLabel),
  };
}

export function getOpenPraQuantumCanonicalCaseByLabel(
  caseLabel: string,
): OpenPraQuantumCanonicalCase {
  const found = CANONICAL_CASES.find((entry) => entry.caseLabel === caseLabel);
  if (!found) {
    throw new Error(`Unknown canonical caseLabel=${caseLabel}.`);
  }
  return found;
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-pack.spec.ts",
        """import {
  getOpenPraQuantumCanonicalCaseByLabel,
  getOpenPraQuantumCanonicalCasePackSummary,
} from "./openpra-quantum-canonical-case-pack";

describe("openpra-quantum-canonical-case-pack", () => {
  it("returns the locked WS5 and WS6 canonical cases", () => {
    const summary = getOpenPraQuantumCanonicalCasePackSummary();

    expect(summary.ws5PriorityCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);

    expect(summary.ws6AcceptanceCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });

  it("loads a canonical case by label", () => {
    const entry = getOpenPraQuantumCanonicalCaseByLabel("phase2b_row_0905__G_G939");
    expect(entry.subtreeId).toBe("G:G939");
    expect(entry.topologyClass).toBe("C");
  });
});
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-request-contract.ts",
        """export interface OpenPraQuantumProviderExecutionRequest {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
  providerName: string;
  backendName: string;
  shots: number;
  resilienceLevel: number;
  createdAtUtc: string;
  notes: string | null;
}

export interface CreateOpenPraQuantumProviderExecutionRequestParams {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
  providerName: string;
  backendName: string;
  shots: number;
  resilienceLevel?: number;
  createdAtUtc?: string;
  notes?: string | null;
}

export function createOpenPraQuantumProviderExecutionRequest(
  params: CreateOpenPraQuantumProviderExecutionRequestParams,
): OpenPraQuantumProviderExecutionRequest {
  const request: OpenPraQuantumProviderExecutionRequest = {
    requestId: requireNonEmpty(params.requestId, "requestId"),
    subtreeId: requireNonEmpty(params.subtreeId, "subtreeId"),
    caseLabel: requireNonEmpty(params.caseLabel, "caseLabel"),
    providerName: requireNonEmpty(params.providerName, "providerName"),
    backendName: requireNonEmpty(params.backendName, "backendName"),
    shots: normalizePositiveInteger(params.shots, "shots"),
    resilienceLevel:
      params.resilienceLevel === undefined
        ? 0
        : normalizeNonNegativeInteger(params.resilienceLevel, "resilienceLevel"),
    createdAtUtc: params.createdAtUtc ?? new Date().toISOString(),
    notes: params.notes ?? null,
  };

  assertOpenPraQuantumProviderExecutionRequest(request);
  return request;
}

export function assertOpenPraQuantumProviderExecutionRequest(
  request: OpenPraQuantumProviderExecutionRequest,
): void {
  requireNonEmpty(request.requestId, "requestId");
  requireNonEmpty(request.subtreeId, "subtreeId");
  requireNonEmpty(request.caseLabel, "caseLabel");
  requireNonEmpty(request.providerName, "providerName");
  requireNonEmpty(request.backendName, "backendName");
  normalizePositiveInteger(request.shots, "shots");
  normalizeNonNegativeInteger(request.resilienceLevel, "resilienceLevel");
  requireNonEmpty(request.createdAtUtc, "createdAtUtc");
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non empty string.`);
  }
  return value;
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non negative integer.`);
  }
  return value;
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-request-store.ts",
        """import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumProviderExecutionRequest,
  type OpenPraQuantumProviderExecutionRequest,
} from "./openpra-quantum-provider-request-contract";

export interface PersistOpenPraQuantumProviderExecutionRequestParams {
  rootDirectoryPath: string;
  request: OpenPraQuantumProviderExecutionRequest;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderExecutionRequestStoreResult {
  requestDirectoryPath: string;
  requestPath: string;
  provenanceManifestPath: string;
}

export interface OpenPraQuantumProviderExecutionRequestLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumProviderExecutionRequestLoadResult {
  request: OpenPraQuantumProviderExecutionRequest;
  requestPath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function persistOpenPraQuantumProviderExecutionRequest(
  params: PersistOpenPraQuantumProviderExecutionRequestParams,
): OpenPraQuantumProviderExecutionRequestStoreResult {
  assertOpenPraQuantumProviderExecutionRequest(params.request);

  const requestDirectoryPath = buildRequestDirectoryPath(
    params.rootDirectoryPath,
    params.request,
  );
  fs.mkdirSync(requestDirectoryPath, { recursive: true });

  const requestPath = path.join(requestDirectoryPath, "provider_execution_request_v1.json");
  const provenanceManifestPath = path.join(
    requestDirectoryPath,
    "provenance_manifest_v1.json",
  );

  writeJson(requestPath, params.request);

  const manifest = {
    artifactType: "openpra_quantum_provider_execution_request_manifest",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion:
      params.scriptVersion ?? "openpra-quantum-provider-request-store-v1",
    requestDirectoryPath,
    requestId: params.request.requestId,
    caseLabel: params.request.caseLabel,
    requestPath,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    sha256: {
      request: sha256File(requestPath),
    },
  };

  writeJson(provenanceManifestPath, manifest);

  return {
    requestDirectoryPath,
    requestPath,
    provenanceManifestPath,
  };
}

export function loadLatestOpenPraQuantumProviderExecutionRequest(
  request: OpenPraQuantumProviderExecutionRequestLoadRequest,
): OpenPraQuantumProviderExecutionRequestLoadResult {
  const candidates = findFilesRecursive(
    request.rootDirectoryPath,
    "provider_execution_request_v1.json",
  );

  const matches = candidates
    .map((requestPath) => buildLoadCandidate(requestPath))
    .filter((candidate) =>
      request.caseLabel ? candidate.request.caseLabel === request.caseLabel : true,
    )
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No provider execution request artifacts found.");
  }

  const selected = matches[0];
  return {
    request: selected.request,
    requestPath: selected.requestPath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface ProviderRequestLoadCandidate {
  request: OpenPraQuantumProviderExecutionRequest;
  requestPath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildLoadCandidate(requestPath: string): ProviderRequestLoadCandidate {
  const request = readJson(requestPath) as OpenPraQuantumProviderExecutionRequest;
  assertOpenPraQuantumProviderExecutionRequest(request);

  const dirPath = path.dirname(requestPath);
  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest = fs.existsSync(provenanceManifestPath)
    ? (readJson(provenanceManifestPath) as Record<string, unknown>)
    : null;

  return {
    request,
    requestPath,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath)
      ? provenanceManifestPath
      : null,
    mtimeMs: fs.statSync(requestPath).mtimeMs,
  };
}

function buildRequestDirectoryPath(
  rootDirectoryPath: string,
  request: OpenPraQuantumProviderExecutionRequest,
): string {
  const label = sanitize(request.caseLabel ?? request.requestId);
  return path.join(rootDirectoryPath, label);
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
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
    if (entry.isFile() and entry.name == fileName):
      pass
"""
        .replace("and", "&&")
        .replace(":\n      pass", " {\n      results.push(fullPath);\n    }")
        + """
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\\n`, "utf8");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath: string): string {
  const h = crypto.createHash("sha256");
  const text = fs.readFileSync(filePath, "utf8");
  h.update(text, "utf8");
  return h.digest("hex");
}
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-provider-request-store.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import {
  loadLatestOpenPraQuantumProviderExecutionRequest,
  persistOpenPraQuantumProviderExecutionRequest,
} from "./openpra-quantum-provider-request-store";

describe("openpra-quantum-provider-request-store", () => {
  it("persists and loads a provider execution request", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-"));

    const request = createOpenPraQuantumProviderExecutionRequest({
      requestId: "provider-request-0698",
      subtreeId: "G:G348",
      caseLabel: "phase2b_row_0698__G_G348",
      providerName: "ibm_runtime",
      backendName: "ibm_torino",
      shots: 8192,
      resilienceLevel: 0,
      createdAtUtc: "2026-04-17T17:03:17.743Z",
      notes: "WS6 exact path request",
    });

    const persisted = persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      request,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-provider-request-store.spec",
    });

    const loaded = loadLatestOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.request.requestId).toBe("provider-request-0698");
    expect(loaded.request.backendName).toBe("ibm_torino");
    expect(fs.existsSync(persisted.requestPath)).toBe(true);
    expect(fs.existsSync(persisted.provenanceManifestPath)).toBe(true);
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-execution-artifact-loader";\n',
        'export * from "./openpra-quantum-canonical-case-pack";\nexport * from "./openpra-quantum-provider-request-contract";\nexport * from "./openpra-quantum-provider-request-store";\n',
        "index chunk e exports",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumExecutionArtifacts,\n",
        "  createOpenPraQuantumProviderExecutionRequest,\n  getOpenPraQuantumCanonicalCasePackSummary,\n  loadLatestOpenPraQuantumProviderExecutionRequest,\n  persistOpenPraQuantumProviderExecutionRequest,\n",
        "service chunk e imports functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumExecutionArtifactLoadResult,\n",
        "  type OpenPraQuantumCanonicalCasePackSummary,\n  type OpenPraQuantumProviderExecutionRequestLoadResult,\n  type OpenPraQuantumProviderExecutionRequestStoreResult,\n  type CreateOpenPraQuantumProviderExecutionRequestParams,\n",
        "service chunk e imports types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export interface QuantumBuildProviderExecutionRequest {
  rootDirectoryPath: string;
  executionRequest: CreateOpenPraQuantumProviderExecutionRequestParams;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface QuantumLoadLatestProviderExecutionRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

""",
        "service chunk e request interfaces",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  getCanonicalCasePackSummary(): OpenPraQuantumCanonicalCasePackSummary {
    return getOpenPraQuantumCanonicalCasePackSummary();
  }

  buildProviderExecutionRequest(
    request: QuantumBuildProviderExecutionRequest,
  ): OpenPraQuantumProviderExecutionRequestStoreResult {
    const executionRequest = createOpenPraQuantumProviderExecutionRequest(
      request.executionRequest,
    );

    return persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: request.rootDirectoryPath,
      request: executionRequest,
      inputArtifactPaths: request.inputArtifactPaths ?? [],
      scriptVersion:
        request.scriptVersion ?? "quantum-readiness.service.buildProviderExecutionRequest",
    });
  }

  loadLatestProviderExecutionRequest(
    request: QuantumLoadLatestProviderExecutionRequest,
  ): OpenPraQuantumProviderExecutionRequestLoadResult {
    return loadLatestOpenPraQuantumProviderExecutionRequest(request);
  }

""",
        "service chunk e methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumExecutionArtifactLoadResult,\n",
        "  OpenPraQuantumCanonicalCasePackSummary,\n  OpenPraQuantumProviderExecutionRequestLoadResult,\n  OpenPraQuantumProviderExecutionRequestStoreResult,\n",
        "controller chunk e import types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestExecutionArtifactsRequest,\n",
        "  type QuantumBuildProviderExecutionRequest,\n  type QuantumLoadLatestProviderExecutionRequest,\n",
        "controller chunk e service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumBuildProviderExecutionRequestBody
  extends QuantumBuildProviderExecutionRequest {}

export interface QuantumLoadLatestProviderExecutionRequestBody
  extends QuantumLoadLatestProviderExecutionRequest {}

""",
        "controller chunk e request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/canonical-case-pack/summary")
  @HttpCode(HttpStatus.OK)
  getCanonicalCasePackSummary(): OpenPraQuantumCanonicalCasePackSummary {
    try {
      return this.quantumReadinessService.getCanonicalCasePackSummary();
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/provider-request")
  @HttpCode(HttpStatus.OK)
  buildProviderExecutionRequest(
    @Body() body: QuantumBuildProviderExecutionRequestBody,
  ): OpenPraQuantumProviderExecutionRequestStoreResult {
    try {
      return this.quantumReadinessService.buildProviderExecutionRequest(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/provider-request/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestProviderExecutionRequest(
    @Body() body: QuantumLoadLatestProviderExecutionRequestBody,
  ): OpenPraQuantumProviderExecutionRequestLoadResult {
    try {
      return this.quantumReadinessService.loadLatestProviderExecutionRequest(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk e methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService canonical case pack and provider request", () => {
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

  it("returns the canonical case pack summary", () => {
    const summary = service.getCanonicalCasePackSummary();

    expect(summary.ws5PriorityCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);

    expect(summary.ws6AcceptanceCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });

  it("builds and loads provider execution request artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-service-"));

    const persisted = service.buildProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      executionRequest: {
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
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.casePackProvider.service.spec",
    });

    const loaded = service.loadLatestProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.request.requestId).toBe("provider-request-0698");
    expect(loaded.request.backendName).toBe("ibm_torino");
    expect(fs.existsSync(persisted.requestPath)).toBe(true);
    expect(fs.existsSync(persisted.provenanceManifestPath)).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical case pack and provider request", () => {
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

  it("returns the canonical case pack summary through the controller", () => {
    const summary = controller.getCanonicalCasePackSummary();

    expect(summary.ws5PriorityCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });

  it("builds and loads provider request artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-controller-"));

    const persisted = controller.buildProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      executionRequest: {
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
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.casePackProvider.controller.spec",
    });

    const loaded = controller.loadLatestProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.request.requestId).toBe("provider-request-0698");
    expect(fs.existsSync(persisted.requestPath)).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.canonicalCasePack.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalCasePack.http", () => {
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

  it("returns the canonical case pack summary", async () => {
    const response = await request(app.getHttpServer())
      .post("/canonical-case-pack/summary")
      .send({})
      .expect(200);

    expect(response.body.ws5PriorityCases.map((entry: { caseLabel: string }) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);

    expect(response.body.ws6AcceptanceCases.map((entry: { caseLabel: string }) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.providerRequest.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerRequest.http", () => {
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

  it("writes and loads provider execution request artifacts through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-http-"));

    const persisted = await request(app.getHttpServer())
      .post("/execution/provider-request")
      .send({
        rootDirectoryPath: tempDir,
        executionRequest: {
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
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.providerRequest.http.spec",
      })
      .expect(200);

    expect(fs.existsSync(persisted.body.requestPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/execution/provider-request/load-latest")
      .send({
        rootDirectoryPath: tempDir,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loaded.body.request.requestId).toBe("provider-request-0698");
    expect(loaded.body.request.backendName).toBe("ibm_torino");
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws5_ws6_casepack_provider_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_casepack_provider_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-pack.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-provider-request-store.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.canonicalCasePack.http.spec.ts" "$RUN_DIR/http_tests/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.providerRequest.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/canonical-case-pack/summary",
        "/execution/provider-request",
        "/execution/provider-request/load-latest",
    ],
    "interpretation": (
        "Chunk E adds canonical case pack foundation and provider request persistence "
        "for the next WS5 and WS6 implementation stage."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_ws6_casepack_provider_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS5 WS6 Case Pack Provider Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /canonical-case-pack/summary
- /execution/provider-request
- /execution/provider-request/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied WS5/WS6 case pack provider chunk E successfully.")


if __name__ == "__main__":
    main()

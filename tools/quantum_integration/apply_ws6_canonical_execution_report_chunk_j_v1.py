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
        "packages/quantum-readiness/src/lib/openpra-quantum-ws6-canonical-execution-report.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import { getOpenPraQuantumCanonicalCasePackSummary } from "./openpra-quantum-canonical-case-pack";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

export interface OpenPraQuantumWs6CanonicalExecutionReportRequest {
  rootDirectoryPath: string;
  sourceExecutionArtifactsRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportRow {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  jobId: string;
  executionStatus: string;
  resultStatus: string | null;
  hasExecutionResult: boolean;
  rawCountsArtifactPath: string | null;
  recoveryArtifactPath: string | null;
  provenanceManifestPath: string | null;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  sourceExecutionArtifactsRootDirectoryPath: string;
  caseLabels: string[];
  topologyCounts: Record<string, number>;
  totalCases: number;
  completedCount: number;
  failedCount: number;
  missingResultCount: number;
  allCompleted: boolean;
  rows: OpenPraQuantumWs6CanonicalExecutionReportRow[];
}

export interface OpenPraQuantumWs6CanonicalExecutionReportResult {
  summary: OpenPraQuantumWs6CanonicalExecutionReportSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
  summary: OpenPraQuantumWs6CanonicalExecutionReportSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumWs6CanonicalExecutionReport(
  request: OpenPraQuantumWs6CanonicalExecutionReportRequest,
): OpenPraQuantumWs6CanonicalExecutionReportResult {
  const canonical = getOpenPraQuantumCanonicalCasePackSummary();
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-ws6-canonical-execution-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const rows: OpenPraQuantumWs6CanonicalExecutionReportRow[] =
    canonical.ws6AcceptanceCases.map((caseEntry) => {
      const loaded = loadLatestOpenPraQuantumExecutionArtifacts({
        rootDirectoryPath: request.sourceExecutionArtifactsRootDirectoryPath,
        caseLabel: caseEntry.caseLabel,
      });

      if (loaded.executionRecord.caseLabel !== caseEntry.caseLabel) {
        throw new Error(`Case label mismatch for ${caseEntry.caseLabel}.`);
      }
      if (loaded.executionRecord.subtreeId !== caseEntry.subtreeId) {
        throw new Error(`Subtree mismatch for ${caseEntry.caseLabel}.`);
      }

      return {
        caseLabel: caseEntry.caseLabel,
        subtreeId: caseEntry.subtreeId,
        topologyClass: caseEntry.topologyClass,
        jobId: loaded.executionRecord.jobId,
        executionStatus: loaded.executionRecord.status,
        resultStatus: loaded.executionResult?.status ?? null,
        hasExecutionResult: loaded.executionResult !== null,
        rawCountsArtifactPath: loaded.executionResult?.rawCountsArtifactPath ?? null,
        recoveryArtifactPath: loaded.executionResult?.recoveryArtifactPath ?? null,
        provenanceManifestPath: loaded.provenanceManifestPath,
      };
    });

  const topologyCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.topologyClass] = (acc[row.topologyClass] ?? 0) + 1;
    return acc;
  }, {});

  const summary: OpenPraQuantumWs6CanonicalExecutionReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    sourceExecutionArtifactsRootDirectoryPath:
      request.sourceExecutionArtifactsRootDirectoryPath,
    caseLabels: rows.map((row) => row.caseLabel),
    topologyCounts,
    totalCases: rows.length,
    completedCount: rows.filter((row) => row.executionStatus === "completed").length,
    failedCount: rows.filter((row) => row.executionStatus === "failed").length,
    missingResultCount: rows.filter((row) => !row.hasExecutionResult).length,
    allCompleted: rows.every(
      (row) => row.executionStatus === "completed" and row.hasExecutionResult
    ),
    rows,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "ws6_canonical_execution_report_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "ws6_canonical_execution_report_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_ws6_canonical_execution_report_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    caseLabels: summary.caseLabels,
    totalCases: summary.totalCases,
  });

  return {
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumWs6CanonicalExecutionReport(
  request: OpenPraQuantumWs6CanonicalExecutionReportLoadRequest,
): OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "ws6_canonical_execution_report_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No WS6 canonical execution report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumWs6CanonicalExecutionReportSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "ws6_canonical_execution_report_manifest_v1.json",
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

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\\n`, "utf8");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
"""
        .replace(" and ", " && "),
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-ws6-canonical-execution-report.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { completeOpenPraQuantumProviderBridgeSubmission } from "./openpra-quantum-provider-bridge-completion";
import {
  buildOpenPraQuantumWs6CanonicalExecutionReport,
  loadLatestOpenPraQuantumWs6CanonicalExecutionReport,
} from "./openpra-quantum-ws6-canonical-execution-report";

describe("openpra-quantum-ws6-canonical-execution-report", () => {
  it("builds and loads the WS6 canonical execution report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-canonical-report-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      const providerRequest = createOpenPraQuantumProviderExecutionRequest({
        requestId: entry.requestId,
        subtreeId: entry.subtreeId,
        caseLabel: entry.caseLabel,
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        shots: 8192,
        resilienceLevel: 0,
        createdAtUtc: "2026-04-17T17:03:17.743Z",
        notes: "WS6 canonical execution report request",
      });

      persistOpenPraQuantumProviderExecutionRequest({
        rootDirectoryPath: providerRequestRoot,
        request: providerRequest,
        inputArtifactPaths: [],
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });

      submitOpenPraQuantumProviderBridgeRequest({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });

      completeOpenPraQuantumProviderBridgeSubmission({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
        recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });
    }

    const built = buildOpenPraQuantumWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
      sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
      scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
    });

    expect(built.summary.totalCases).toBe(2);
    expect(built.summary.completedCount).toBe(2);
    expect(built.summary.allCompleted).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.summary.topologyCounts).toEqual({ A: 1, C: 1 });
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-canonical-bounded-report";\n',
        'export * from "./openpra-quantum-ws6-canonical-execution-report";\n',
        "index chunk j export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumCanonicalBoundedReport,\n",
        "  buildOpenPraQuantumWs6CanonicalExecutionReport,\n  loadLatestOpenPraQuantumWs6CanonicalExecutionReport,\n",
        "service chunk j import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumCanonicalBoundedReportResult,\n",
        "  type OpenPraQuantumWs6CanonicalExecutionReportLoadResult,\n  type OpenPraQuantumWs6CanonicalExecutionReportRequest,\n  type OpenPraQuantumWs6CanonicalExecutionReportResult,\n",
        "service chunk j import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumWs6CanonicalExecutionReportRequest =
  OpenPraQuantumWs6CanonicalExecutionReportRequest;

export interface QuantumLoadLatestWs6CanonicalExecutionReportRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk j request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildWs6CanonicalExecutionReport(
    request: QuantumWs6CanonicalExecutionReportRequest,
  ): OpenPraQuantumWs6CanonicalExecutionReportResult {
    return buildOpenPraQuantumWs6CanonicalExecutionReport(request);
  }

  loadLatestWs6CanonicalExecutionReport(
    request: QuantumLoadLatestWs6CanonicalExecutionReportRequest,
  ): OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
    return loadLatestOpenPraQuantumWs6CanonicalExecutionReport(request);
  }

""",
        "service chunk j methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumCanonicalBoundedReportResult,\n",
        "  OpenPraQuantumWs6CanonicalExecutionReportLoadResult,\n  OpenPraQuantumWs6CanonicalExecutionReportResult,\n",
        "controller chunk j result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestCanonicalBoundedReportRequest,\n",
        "  type QuantumWs6CanonicalExecutionReportRequest,\n  type QuantumLoadLatestWs6CanonicalExecutionReportRequest,\n",
        "controller chunk j service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumWs6CanonicalExecutionReportRequestBody
  extends QuantumWs6CanonicalExecutionReportRequest {}

export interface QuantumLoadLatestWs6CanonicalExecutionReportRequestBody
  extends QuantumLoadLatestWs6CanonicalExecutionReportRequest {}

""",
        "controller chunk j request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/execution/provider-bridge/canonical-report")
  @HttpCode(HttpStatus.OK)
  buildWs6CanonicalExecutionReport(
    @Body() body: QuantumWs6CanonicalExecutionReportRequestBody,
  ): OpenPraQuantumWs6CanonicalExecutionReportResult {
    try {
      return this.quantumReadinessService.buildWs6CanonicalExecutionReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/provider-bridge/canonical-report/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestWs6CanonicalExecutionReport(
    @Body() body: QuantumLoadLatestWs6CanonicalExecutionReportRequestBody,
  ): OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
    try {
      return this.quantumReadinessService.loadLatestWs6CanonicalExecutionReport(
        body,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk j methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService WS6 canonical execution report", () => {
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

  it("builds and loads the WS6 canonical execution report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-report-service-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      service.buildProviderExecutionRequest({
        rootDirectoryPath: providerRequestRoot,
        executionRequest: {
          requestId: entry.requestId,
          subtreeId: entry.subtreeId,
          caseLabel: entry.caseLabel,
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 canonical execution report request",
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });

      service.submitProviderBridgeRequest({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });

      service.completeProviderBridgeSubmission({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
        recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });
    }

    const built = service.buildWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
      sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
      scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
    });

    expect(built.summary.totalCases).toBe(2);
    expect(built.summary.completedCount).toBe(2);
    expect(built.summary.allCompleted).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController WS6 canonical execution report", () => {
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

  it("builds and loads the WS6 canonical execution report through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-report-controller-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      controller.buildProviderExecutionRequest({
        rootDirectoryPath: providerRequestRoot,
        executionRequest: {
          requestId: entry.requestId,
          subtreeId: entry.subtreeId,
          caseLabel: entry.caseLabel,
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 canonical execution report request",
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.controller.spec",
      });

      controller.submitProviderBridgeRequest({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.controller.spec",
      });

      controller.completeProviderBridgeSubmission({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
        recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.controller.spec",
      });
    }

    const built = controller.buildWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
      sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
      scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.controller.spec",
    });

    expect(built.summary.totalCases).toBe(2);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = controller.loadLatestWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toHaveLength(2);
    expect(loaded.summary.allCompleted).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.ws6CanonicalExecutionReport.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.ws6CanonicalExecutionReport.http", () => {
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

  it("builds and loads the WS6 canonical execution report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-report-http-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      await request(app.getHttpServer())
        .post("/execution/provider-request")
        .send({
          rootDirectoryPath: providerRequestRoot,
          executionRequest: {
            requestId: entry.requestId,
            subtreeId: entry.subtreeId,
            caseLabel: entry.caseLabel,
            providerName: "ibm_runtime",
            backendName: "ibm_torino",
            shots: 8192,
            resilienceLevel: 0,
            createdAtUtc: "2026-04-17T17:03:17.743Z",
            notes: "WS6 canonical execution report request",
          },
          inputArtifactPaths: [],
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/execution/provider-bridge/submit")
        .send({
          providerRequestRootDirectoryPath: providerRequestRoot,
          executionArtifactsRootDirectoryPath: executionArtifactsRoot,
          caseLabel: entry.caseLabel,
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/execution/provider-bridge/complete")
        .send({
          executionArtifactsRootDirectoryPath: executionArtifactsRoot,
          caseLabel: entry.caseLabel,
          rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
          recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);
    }

    const built = await request(app.getHttpServer())
      .post("/execution/provider-bridge/canonical-report")
      .send({
        rootDirectoryPath: reportRoot,
        sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
      })
      .expect(200);

    expect(built.body.summary.totalCases).toBe(2);
    expect(built.body.summary.completedCount).toBe(2);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/execution/provider-bridge/canonical-report/load-latest")
      .send({
        rootDirectoryPath: reportRoot,
      })
      .expect(200);

    expect(loaded.body.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.body.summary.allCompleted).toBe(true);
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws6_canonical_execution_report_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws6_canonical_execution_report_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-ws6-canonical-execution-report.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.ws6CanonicalExecutionReport.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/execution/provider-bridge/canonical-report",
        "/execution/provider-bridge/canonical-report/load-latest",
    ],
    "interpretation": (
        "Chunk J adds the canonical WS6 execution report for the locked acceptance "
        "pair and exposes report generation and loading through the backend."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws6_canonical_execution_report_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS6 Canonical Execution Report Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /execution/provider-bridge/canonical-report
- /execution/provider-bridge/canonical-report/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied WS6 canonical execution report chunk J successfully.")


if __name__ == "__main__":
    main()

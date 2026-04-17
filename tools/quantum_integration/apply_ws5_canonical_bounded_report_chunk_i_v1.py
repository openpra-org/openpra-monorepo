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
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-bounded-report.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";
import { getOpenPraQuantumCanonicalCasePackSummary } from "./openpra-quantum-canonical-case-pack";
import { loadLatestOpenPraQuantumBoundedImportanceArtifacts } from "./openpra-quantum-bounded-importance-artifact-loader";

export interface OpenPraQuantumCanonicalBoundedReportRequest {
  rootDirectoryPath: string;
  sourceBoundedImportanceRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumCanonicalBoundedReportRow {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  recoveryMode: string;
  operatorAttentionRequired: boolean;
  boundednessMatches: boolean;
  responsePath: string;
  provenanceManifestPath: string | null;
}

export interface OpenPraQuantumCanonicalBoundedReportSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  sourceBoundedImportanceRootDirectoryPath: string;
  caseLabels: string[];
  topologyCounts: Record<string, number>;
  totalCases: number;
  boundednessAllMatch: boolean;
  operatorAttentionCount: number;
  rows: OpenPraQuantumCanonicalBoundedReportRow[];
}

export interface OpenPraQuantumCanonicalBoundedReportResult {
  summary: OpenPraQuantumCanonicalBoundedReportSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumCanonicalBoundedReportLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumCanonicalBoundedReportLoadResult {
  summary: OpenPraQuantumCanonicalBoundedReportSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumCanonicalBoundedReport(
  request: OpenPraQuantumCanonicalBoundedReportRequest,
): OpenPraQuantumCanonicalBoundedReportResult {
  const canonical = getOpenPraQuantumCanonicalCasePackSummary();
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-canonical-bounded-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const rows: OpenPraQuantumCanonicalBoundedReportRow[] =
    canonical.ws5PriorityCases.map((caseEntry) => {
      const loaded = loadLatestOpenPraQuantumBoundedImportanceArtifacts({
        rootDirectoryPath: request.sourceBoundedImportanceRootDirectoryPath,
        caseLabel: caseEntry.caseLabel,
      });

      const response = loaded.response as OpenPraQuantumBoundedImportanceResponse;

      if (response.caseLabel !== caseEntry.caseLabel) {
        throw new Error(`Case label mismatch for ${caseEntry.caseLabel}.`);
      }
      if (response.subtreeId !== caseEntry.subtreeId) {
        throw new Error(`Subtree mismatch for ${caseEntry.caseLabel}.`);
      }
      if (response.topologyClass !== caseEntry.topologyClass) {
        throw new Error(`Topology mismatch for ${caseEntry.caseLabel}.`);
      }

      return {
        caseLabel: caseEntry.caseLabel,
        subtreeId: response.subtreeId,
        topologyClass: response.topologyClass,
        recoveryMode: response.recoveryMode,
        operatorAttentionRequired: response.operatorAttentionRequired,
        boundednessMatches:
          response.boundednessStatement === SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
        responsePath: loaded.responsePath,
        provenanceManifestPath: loaded.provenanceManifestPath,
      };
    });

  const topologyCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.topologyClass] = (acc[row.topologyClass] ?? 0) + 1;
    return acc;
  }, {});

  const summary: OpenPraQuantumCanonicalBoundedReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    sourceBoundedImportanceRootDirectoryPath:
      request.sourceBoundedImportanceRootDirectoryPath,
    caseLabels: rows.map((row) => row.caseLabel),
    topologyCounts,
    totalCases: rows.length,
    boundednessAllMatch: rows.every((row) => row.boundednessMatches),
    operatorAttentionCount: rows.filter((row) => row.operatorAttentionRequired).length,
    rows,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_bounded_report_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_bounded_report_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_canonical_bounded_report_manifest",
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

export function loadLatestOpenPraQuantumCanonicalBoundedReport(
  request: OpenPraQuantumCanonicalBoundedReportLoadRequest,
): OpenPraQuantumCanonicalBoundedReportLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_bounded_report_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical bounded report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalBoundedReportSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_bounded_report_manifest_v1.json",
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
""",
    )

    write_text(
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-bounded-report.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { buildOpenPraQuantumBoundedImportanceServiceFacade } from "./openpra-quantum-bounded-importance-service-facade";
import {
  buildOpenPraQuantumCanonicalBoundedReport,
  loadLatestOpenPraQuantumCanonicalBoundedReport,
} from "./openpra-quantum-canonical-bounded-report";

describe("openpra-quantum-canonical-bounded-report", () => {
  it("builds and loads a canonical bounded importance report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-report-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" as const },
    ]) {
      const response = {
        subtreeId: entry.subtreeId,
        topologyClass: entry.topologyClass,
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
        provenanceManifestPath: `/provenance/${entry.caseLabel}.json`,
        sourceRecoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        generatedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: entry.caseLabel,
      };

      buildOpenPraQuantumBoundedImportanceServiceFacade({
        rootDirectoryPath: sourceRoot,
        ...response,
        expectedResponse: response,
        inputArtifactPaths: [],
        scriptVersion: "openpra-quantum-canonical-bounded-report.spec",
      });
    }

    const built = buildOpenPraQuantumCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
      sourceBoundedImportanceRootDirectoryPath: sourceRoot,
      scriptVersion: "openpra-quantum-canonical-bounded-report.spec",
    });

    expect(built.summary.totalCases).toBe(3);
    expect(built.summary.boundednessAllMatch).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.summary.topologyCounts).toEqual({ A: 2, C: 1 });
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-provider-bridge-completion";\n',
        'export * from "./openpra-quantum-canonical-bounded-report";\n',
        "index chunk i export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  materializeOpenPraQuantumCanonicalCasePackArtifacts,\n",
        "  buildOpenPraQuantumCanonicalBoundedReport,\n  loadLatestOpenPraQuantumCanonicalBoundedReport,\n",
        "service chunk i import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumCanonicalCaseMaterializationResult,\n",
        "  type OpenPraQuantumCanonicalBoundedReportLoadResult,\n  type OpenPraQuantumCanonicalBoundedReportRequest,\n  type OpenPraQuantumCanonicalBoundedReportResult,\n",
        "service chunk i import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumCanonicalBoundedReportRequest =
  OpenPraQuantumCanonicalBoundedReportRequest;

export interface QuantumLoadLatestCanonicalBoundedReportRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk i request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildCanonicalBoundedReport(
    request: QuantumCanonicalBoundedReportRequest,
  ): OpenPraQuantumCanonicalBoundedReportResult {
    return buildOpenPraQuantumCanonicalBoundedReport(request);
  }

  loadLatestCanonicalBoundedReport(
    request: QuantumLoadLatestCanonicalBoundedReportRequest,
  ): OpenPraQuantumCanonicalBoundedReportLoadResult {
    return loadLatestOpenPraQuantumCanonicalBoundedReport(request);
  }

""",
        "service chunk i methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumCanonicalCaseMaterializationResult,\n",
        "  OpenPraQuantumCanonicalBoundedReportLoadResult,\n  OpenPraQuantumCanonicalBoundedReportResult,\n",
        "controller chunk i result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestCanonicalCaseMaterializationRequest,\n",
        "  type QuantumCanonicalBoundedReportRequest,\n  type QuantumLoadLatestCanonicalBoundedReportRequest,\n",
        "controller chunk i service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumCanonicalBoundedReportRequestBody
  extends QuantumCanonicalBoundedReportRequest {}

export interface QuantumLoadLatestCanonicalBoundedReportRequestBody
  extends QuantumLoadLatestCanonicalBoundedReportRequest {}

""",
        "controller chunk i request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/importance/bounded/canonical-report")
  @HttpCode(HttpStatus.OK)
  buildCanonicalBoundedReport(
    @Body() body: QuantumCanonicalBoundedReportRequestBody,
  ): OpenPraQuantumCanonicalBoundedReportResult {
    try {
      return this.quantumReadinessService.buildCanonicalBoundedReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/importance/bounded/canonical-report/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestCanonicalBoundedReport(
    @Body() body: QuantumLoadLatestCanonicalBoundedReportRequestBody,
  ): OpenPraQuantumCanonicalBoundedReportLoadResult {
    try {
      return this.quantumReadinessService.loadLatestCanonicalBoundedReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk i methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalBoundedReport.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService canonical bounded report", () => {
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

  it("builds and loads the canonical bounded report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-service-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" as const },
    ]) {
      const response = {
        subtreeId: entry.subtreeId,
        topologyClass: entry.topologyClass,
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
        provenanceManifestPath: `/provenance/${entry.caseLabel}.json`,
        sourceRecoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        generatedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: entry.caseLabel,
      };

      service.buildBoundedImportanceServiceFacade({
        rootDirectoryPath: sourceRoot,
        ...response,
        expectedResponse: response,
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.canonicalBoundedReport.service.spec",
      });
    }

    const built = service.buildCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
      sourceBoundedImportanceRootDirectoryPath: sourceRoot,
      scriptVersion: "quantumReadiness.canonicalBoundedReport.service.spec",
    });

    expect(built.summary.totalCases).toBe(3);
    expect(built.summary.boundednessAllMatch).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalBoundedReport.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical bounded report", () => {
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

  it("builds and loads the canonical bounded report through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-controller-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" as const },
    ]) {
      const response = {
        subtreeId: entry.subtreeId,
        topologyClass: entry.topologyClass,
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
        provenanceManifestPath: `/provenance/${entry.caseLabel}.json`,
        sourceRecoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        generatedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: entry.caseLabel,
      };

      controller.buildBoundedImportanceServiceFacade({
        rootDirectoryPath: sourceRoot,
        ...response,
        expectedResponse: response,
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.canonicalBoundedReport.controller.spec",
      });
    }

    const built = controller.buildCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
      sourceBoundedImportanceRootDirectoryPath: sourceRoot,
      scriptVersion: "quantumReadiness.canonicalBoundedReport.controller.spec",
    });

    expect(built.summary.totalCases).toBe(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = controller.loadLatestCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toHaveLength(3);
    expect(loaded.summary.boundednessAllMatch).toBe(true);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.canonicalBoundedReport.http.spec.ts",
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

describe("quantumReadiness.canonicalBoundedReport.http", () => {
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

  it("builds and loads the canonical bounded report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-http-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" },
    ]) {
      const response = {
        subtreeId: entry.subtreeId,
        topologyClass: entry.topologyClass,
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
        provenanceManifestPath: `/provenance/${entry.caseLabel}.json`,
        sourceRecoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        generatedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: entry.caseLabel,
      };

      await request(app.getHttpServer())
        .post("/importance/bounded")
        .send({
          rootDirectoryPath: sourceRoot,
          ...response,
          expectedResponse: response,
          inputArtifactPaths: [],
          scriptVersion: "quantumReadiness.canonicalBoundedReport.http.spec",
        })
        .expect(200);
    }

    const built = await request(app.getHttpServer())
      .post("/importance/bounded/canonical-report")
      .send({
        rootDirectoryPath: reportRoot,
        sourceBoundedImportanceRootDirectoryPath: sourceRoot,
        scriptVersion: "quantumReadiness.canonicalBoundedReport.http.spec",
      })
      .expect(200);

    expect(built.body.summary.totalCases).toBe(3);
    expect(built.body.summary.boundednessAllMatch).toBe(true);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/importance/bounded/canonical-report/load-latest")
      .send({
        rootDirectoryPath: reportRoot,
      })
      .expect(200);

    expect(loaded.body.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.body.summary.topologyCounts).toEqual({ A: 2, C: 1 });
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_ws5_canonical_bounded_report_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_canonical_bounded_report_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_CANONICAL_BOUNDED_REPORT_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-canonical-bounded-report.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalBoundedReport.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalBoundedReport.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.canonicalBoundedReport.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS5_CANONICAL_BOUNDED_REPORT_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/importance/bounded/canonical-report",
        "/importance/bounded/canonical-report/load-latest",
    ],
    "interpretation": (
        "Chunk I adds the canonical bounded importance report for the locked WS5 "
        "case pack and exposes report generation and loading through the backend."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_canonical_bounded_report_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum WS5 Canonical Bounded Report Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /importance/bounded/canonical-report
- /importance/bounded/canonical-report/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_CANONICAL_BOUNDED_REPORT_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied WS5 canonical bounded report chunk I successfully.")


if __name__ == "__main__":
    main()

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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-summary.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumCanonicalProgramReport,
  type OpenPraQuantumCanonicalProgramReportLoadResult,
} from "./openpra-quantum-canonical-program-report";

export interface OpenPraQuantumFrontendSummaryRequest {
  rootDirectoryPath: string;
  canonicalProgramReportRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumFrontendCaseSummaryRow {
  caseLabel: string;
  topologyClass: string | null;
  inWs5BoundedReport: boolean;
  inWs6ExecutionReport: boolean;
  boundednessMatches: boolean | null;
  ws6ExecutionStatus: string | null;
  ws6HasResult: boolean | null;
  showInFrontend: boolean;
}

export interface OpenPraQuantumFrontendSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  canonicalProgramReportRootDirectoryPath: string;
  readinessStatus: "ready" | "blocked";
  readyForFrontend: boolean;
  totalWs5Cases: number;
  totalWs6Cases: number;
  totalUnionCases: number;
  ws5CoverageComplete: boolean;
  ws6CoverageComplete: boolean;
  ws6MissingResultCount: number;
  operatorAttentionCount: number;
  caseRows: OpenPraQuantumFrontendCaseSummaryRow[];
}

export interface OpenPraQuantumFrontendSummaryResult {
  canonicalProgramReport: OpenPraQuantumCanonicalProgramReportLoadResult;
  summary: OpenPraQuantumFrontendSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumFrontendSummaryLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumFrontendSummaryLoadResult {
  summary: OpenPraQuantumFrontendSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumFrontendSummary(
  request: OpenPraQuantumFrontendSummaryRequest,
): OpenPraQuantumFrontendSummaryResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-frontend-summary-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const canonicalProgramReport = loadLatestOpenPraQuantumCanonicalProgramReport({
    rootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
  });

  const summary: OpenPraQuantumFrontendSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    canonicalProgramReportRootDirectoryPath:
      request.canonicalProgramReportRootDirectoryPath,
    readinessStatus: canonicalProgramReport.summary.readyForFrontend
      ? "ready"
      : "blocked",
    readyForFrontend: canonicalProgramReport.summary.readyForFrontend,
    totalWs5Cases: canonicalProgramReport.summary.totalWs5Cases,
    totalWs6Cases: canonicalProgramReport.summary.totalWs6Cases,
    totalUnionCases: canonicalProgramReport.summary.totalUnionCases,
    ws5CoverageComplete: canonicalProgramReport.summary.boundednessAllMatch,
    ws6CoverageComplete: canonicalProgramReport.summary.ws6AllCompleted,
    ws6MissingResultCount: canonicalProgramReport.summary.ws6MissingResultCount,
    operatorAttentionCount: canonicalProgramReport.summary.operatorAttentionCount,
    caseRows: canonicalProgramReport.summary.rows.map((row) => ({
      caseLabel: row.caseLabel,
      topologyClass: row.topologyClass,
      inWs5BoundedReport: row.inWs5BoundedReport,
      inWs6ExecutionReport: row.inWs6ExecutionReport,
      boundednessMatches: row.boundednessMatches,
      ws6ExecutionStatus: row.ws6ExecutionStatus,
      ws6HasResult: row.ws6HasResult,
      showInFrontend:
        row.inWs5BoundedReport &&
        (row.inWs6ExecutionReport ? row.ws6HasResult === true : true),
    })),
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_summary_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_frontend_summary_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    readinessStatus: summary.readinessStatus,
    readyForFrontend: summary.readyForFrontend,
    totalUnionCases: summary.totalUnionCases,
  });

  return {
    canonicalProgramReport,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumFrontendSummary(
  request: OpenPraQuantumFrontendSummaryLoadRequest,
): OpenPraQuantumFrontendSummaryLoadResult {
  const summaryPath = path.join(request.rootDirectoryPath, "frontend_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_summary_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-summary.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendSummary,
  loadLatestOpenPraQuantumFrontendSummary,
} from "./openpra-quantum-frontend-summary";

describe("openpra-quantum-frontend-summary", () => {
  it("builds and loads the frontend summary from the canonical program report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-summary-"));
    const programReportRoot = path.join(tempDir, "program_report");
    const frontendRoot = path.join(tempDir, "frontend_summary");

    fs.mkdirSync(programReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(programReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: programReportRoot,
          boundedReportRootDirectoryPath: "/bounded",
          ws6ExecutionReportRootDirectoryPath: "/ws6",
          ws5CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          ws6CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          unionCaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
            "phase2b_row_1037__G_G348",
          ],
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          boundednessAllMatch: true,
          ws6AllCompleted: true,
          readyForFrontend: true,
          operatorAttentionCount: 0,
          ws6MissingResultCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    const built = buildOpenPraQuantumFrontendSummary({
      rootDirectoryPath: frontendRoot,
      canonicalProgramReportRootDirectoryPath: programReportRoot,
      scriptVersion: "openpra-quantum-frontend-summary.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.readinessStatus).toBe("ready");
    expect(built.summary.totalUnionCases).toBe(3);
    expect(built.summary.caseRows).toHaveLength(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumFrontendSummary({
      rootDirectoryPath: frontendRoot,
    });

    expect(loaded.summary.readyForFrontend).toBe(true);
    expect(loaded.summary.caseRows[0].showInFrontend).toBe(true);
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-canonical-program-report";\n',
        'export * from "./openpra-quantum-frontend-summary";\n',
        "index chunk l export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumCanonicalProgramReport,\n",
        "  buildOpenPraQuantumFrontendSummary,\n  loadLatestOpenPraQuantumFrontendSummary,\n",
        "service chunk l import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumCanonicalProgramReportResult,\n",
        "  type OpenPraQuantumFrontendSummaryLoadResult,\n  type OpenPraQuantumFrontendSummaryRequest,\n  type OpenPraQuantumFrontendSummaryResult,\n",
        "service chunk l import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumFrontendSummaryRequest =
  OpenPraQuantumFrontendSummaryRequest;

export interface QuantumLoadLatestFrontendSummaryRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk l request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildFrontendSummary(
    request: QuantumFrontendSummaryRequest,
  ): OpenPraQuantumFrontendSummaryResult {
    return buildOpenPraQuantumFrontendSummary(request);
  }

  loadLatestFrontendSummary(
    request: QuantumLoadLatestFrontendSummaryRequest,
  ): OpenPraQuantumFrontendSummaryLoadResult {
    return loadLatestOpenPraQuantumFrontendSummary(request);
  }

""",
        "service chunk l methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumCanonicalProgramReportResult,\n",
        "  OpenPraQuantumFrontendSummaryLoadResult,\n  OpenPraQuantumFrontendSummaryResult,\n",
        "controller chunk l result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestCanonicalProgramReportRequest,\n",
        "  type QuantumFrontendSummaryRequest,\n  type QuantumLoadLatestFrontendSummaryRequest,\n",
        "controller chunk l service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumFrontendSummaryRequestBody
  extends QuantumFrontendSummaryRequest {}

export interface QuantumLoadLatestFrontendSummaryRequestBody
  extends QuantumLoadLatestFrontendSummaryRequest {}

""",
        "controller chunk l request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/frontend-summary")
  @HttpCode(HttpStatus.OK)
  buildFrontendSummary(
    @Body() body: QuantumFrontendSummaryRequestBody,
  ): OpenPraQuantumFrontendSummaryResult {
    try {
      return this.quantumReadinessService.buildFrontendSummary(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/frontend-summary/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestFrontendSummary(
    @Body() body: QuantumLoadLatestFrontendSummaryRequestBody,
  ): OpenPraQuantumFrontendSummaryLoadResult {
    try {
      return this.quantumReadinessService.loadLatestFrontendSummary(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk l methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSummary.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend summary", () => {
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

  it("builds and loads the frontend summary", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-service-"));
    const programReportRoot = path.join(tempDir, "program_report");
    const frontendRoot = path.join(tempDir, "frontend_summary");

    fs.mkdirSync(programReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(programReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: programReportRoot,
          boundedReportRootDirectoryPath: "/bounded",
          ws6ExecutionReportRootDirectoryPath: "/ws6",
          ws5CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          ws6CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          unionCaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
            "phase2b_row_1037__G_G348",
          ],
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          boundednessAllMatch: true,
          ws6AllCompleted: true,
          readyForFrontend: true,
          operatorAttentionCount: 0,
          ws6MissingResultCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    const built = service.buildFrontendSummary({
      rootDirectoryPath: frontendRoot,
      canonicalProgramReportRootDirectoryPath: programReportRoot,
      scriptVersion: "quantumReadiness.frontendSummary.service.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.readinessStatus).toBe("ready");
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestFrontendSummary({
      rootDirectoryPath: frontendRoot,
    });

    expect(loaded.summary.totalUnionCases).toBe(3);
    expect(loaded.summary.caseRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSummary.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController frontend summary", () => {
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

  it("builds and loads the frontend summary through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-controller-"));
    const programReportRoot = path.join(tempDir, "program_report");
    const frontendRoot = path.join(tempDir, "frontend_summary");

    fs.mkdirSync(programReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(programReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: programReportRoot,
          boundedReportRootDirectoryPath: "/bounded",
          ws6ExecutionReportRootDirectoryPath: "/ws6",
          ws5CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          ws6CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          unionCaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
            "phase2b_row_1037__G_G348",
          ],
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          boundednessAllMatch: true,
          ws6AllCompleted: true,
          readyForFrontend: true,
          operatorAttentionCount: 0,
          ws6MissingResultCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    const built = controller.buildFrontendSummary({
      rootDirectoryPath: frontendRoot,
      canonicalProgramReportRootDirectoryPath: programReportRoot,
      scriptVersion: "quantumReadiness.frontendSummary.controller.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = controller.loadLatestFrontendSummary({
      rootDirectoryPath: frontendRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.caseRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.frontendSummary.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSummary.http", () => {
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

  it("builds and loads the frontend summary through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-http-"));
    const programReportRoot = path.join(tempDir, "program_report");
    const frontendRoot = path.join(tempDir, "frontend_summary");

    fs.mkdirSync(programReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(programReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: programReportRoot,
          boundedReportRootDirectoryPath: "/bounded",
          ws6ExecutionReportRootDirectoryPath: "/ws6",
          ws5CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          ws6CaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          unionCaseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
            "phase2b_row_1037__G_G348",
          ],
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          boundednessAllMatch: true,
          ws6AllCompleted: true,
          readyForFrontend: true,
          operatorAttentionCount: 0,
          ws6MissingResultCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    const built = await request(app.getHttpServer())
      .post("/frontend-summary")
      .send({
        rootDirectoryPath: frontendRoot,
        canonicalProgramReportRootDirectoryPath: programReportRoot,
        scriptVersion: "quantumReadiness.frontendSummary.http.spec",
      })
      .expect(200);

    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(built.body.summary.readinessStatus).toBe("ready");
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/frontend-summary/load-latest")
      .send({
        rootDirectoryPath: frontendRoot,
      })
      .expect(200);

    expect(loaded.body.summary.totalUnionCases).toBe(3);
    expect(loaded.body.summary.caseRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_frontend_summary_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_frontend_summary_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_FRONTEND_SUMMARY_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-frontend-summary.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSummary.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSummary.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.frontendSummary.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_FRONTEND_SUMMARY_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/frontend-summary",
        "/frontend-summary/load-latest",
    ],
    "interpretation": (
        "Chunk L adds a frontend-facing readiness summary derived from the "
        "canonical program report and exposes it through the backend."
    ),
}

(run_dir / "notes" / "openpra_quantum_frontend_summary_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Frontend Summary Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /frontend-summary
- /frontend-summary/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_FRONTEND_SUMMARY_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied frontend summary chunk L successfully.")


if __name__ == "__main__":
    main()

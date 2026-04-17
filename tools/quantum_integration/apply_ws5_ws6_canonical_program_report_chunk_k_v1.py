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
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-program-report.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumCanonicalBoundedReport,
  type OpenPraQuantumCanonicalBoundedReportLoadResult,
} from "./openpra-quantum-canonical-bounded-report";
import {
  loadLatestOpenPraQuantumWs6CanonicalExecutionReport,
  type OpenPraQuantumWs6CanonicalExecutionReportLoadResult,
} from "./openpra-quantum-ws6-canonical-execution-report";

export interface OpenPraQuantumCanonicalProgramReportRequest {
  rootDirectoryPath: string;
  boundedReportRootDirectoryPath: string;
  ws6ExecutionReportRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumCanonicalProgramReportRow {
  caseLabel: string;
  topologyClass: string | null;
  inWs5BoundedReport: boolean;
  inWs6ExecutionReport: boolean;
  boundednessMatches: boolean | null;
  ws6ExecutionStatus: string | null;
  ws6HasResult: boolean | null;
}

export interface OpenPraQuantumCanonicalProgramReportSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  boundedReportRootDirectoryPath: string;
  ws6ExecutionReportRootDirectoryPath: string;
  ws5CaseLabels: string[];
  ws6CaseLabels: string[];
  unionCaseLabels: string[];
  totalWs5Cases: number;
  totalWs6Cases: number;
  totalUnionCases: number;
  boundednessAllMatch: boolean;
  ws6AllCompleted: boolean;
  readyForFrontend: boolean;
  operatorAttentionCount: number;
  ws6MissingResultCount: number;
  rows: OpenPraQuantumCanonicalProgramReportRow[];
}

export interface OpenPraQuantumCanonicalProgramReportResult {
  boundedReport: OpenPraQuantumCanonicalBoundedReportLoadResult;
  ws6ExecutionReport: OpenPraQuantumWs6CanonicalExecutionReportLoadResult;
  summary: OpenPraQuantumCanonicalProgramReportSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumCanonicalProgramReportLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumCanonicalProgramReportLoadResult {
  summary: OpenPraQuantumCanonicalProgramReportSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumCanonicalProgramReport(
  request: OpenPraQuantumCanonicalProgramReportRequest,
): OpenPraQuantumCanonicalProgramReportResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-canonical-program-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const boundedReport = loadLatestOpenPraQuantumCanonicalBoundedReport({
    rootDirectoryPath: request.boundedReportRootDirectoryPath,
  });

  const ws6ExecutionReport = loadLatestOpenPraQuantumWs6CanonicalExecutionReport({
    rootDirectoryPath: request.ws6ExecutionReportRootDirectoryPath,
  });

  const boundedRowsByCaseLabel = new Map(
    boundedReport.summary.rows.map((row) => [row.caseLabel, row]),
  );
  const executionRowsByCaseLabel = new Map(
    ws6ExecutionReport.summary.rows.map((row) => [row.caseLabel, row]),
  );

  const unionCaseLabels = Array.from(
    new Set([
      ...boundedReport.summary.caseLabels,
      ...ws6ExecutionReport.summary.caseLabels,
    ]),
  ).sort();

  const rows: OpenPraQuantumCanonicalProgramReportRow[] = unionCaseLabels.map(
    (caseLabel) => {
      const boundedRow = boundedRowsByCaseLabel.get(caseLabel);
      const executionRow = executionRowsByCaseLabel.get(caseLabel);

      return {
        caseLabel,
        topologyClass:
          boundedRow?.topologyClass ?? executionRow?.topologyClass ?? null,
        inWs5BoundedReport: Boolean(boundedRow),
        inWs6ExecutionReport: Boolean(executionRow),
        boundednessMatches: boundedRow?.boundednessMatches ?? null,
        ws6ExecutionStatus: executionRow?.executionStatus ?? null,
        ws6HasResult: executionRow?.hasExecutionResult ?? null,
      };
    },
  );

  const summary: OpenPraQuantumCanonicalProgramReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    boundedReportRootDirectoryPath: request.boundedReportRootDirectoryPath,
    ws6ExecutionReportRootDirectoryPath:
      request.ws6ExecutionReportRootDirectoryPath,
    ws5CaseLabels: boundedReport.summary.caseLabels,
    ws6CaseLabels: ws6ExecutionReport.summary.caseLabels,
    unionCaseLabels,
    totalWs5Cases: boundedReport.summary.totalCases,
    totalWs6Cases: ws6ExecutionReport.summary.totalCases,
    totalUnionCases: unionCaseLabels.length,
    boundednessAllMatch: boundedReport.summary.boundednessAllMatch,
    ws6AllCompleted: ws6ExecutionReport.summary.allCompleted,
    readyForFrontend:
      boundedReport.summary.boundednessAllMatch &&
      ws6ExecutionReport.summary.allCompleted,
    operatorAttentionCount: boundedReport.summary.operatorAttentionCount,
    ws6MissingResultCount: ws6ExecutionReport.summary.missingResultCount,
    rows,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_program_report_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_program_report_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_canonical_program_report_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    boundedReportRootDirectoryPath: request.boundedReportRootDirectoryPath,
    ws6ExecutionReportRootDirectoryPath:
      request.ws6ExecutionReportRootDirectoryPath,
    totalUnionCases: summary.totalUnionCases,
    readyForFrontend: summary.readyForFrontend,
  });

  return {
    boundedReport,
    ws6ExecutionReport,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumCanonicalProgramReport(
  request: OpenPraQuantumCanonicalProgramReportLoadRequest,
): OpenPraQuantumCanonicalProgramReportLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "canonical_program_report_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical program report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalProgramReportSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "canonical_program_report_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-canonical-program-report.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumCanonicalProgramReport,
  loadLatestOpenPraQuantumCanonicalProgramReport,
} from "./openpra-quantum-canonical-program-report";

describe("openpra-quantum-canonical-program-report", () => {
  it("builds and loads the canonical program report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-program-report-"));
    const boundedReportRoot = path.join(tempDir, "bounded_report");
    const ws6ReportRoot = path.join(tempDir, "ws6_report");
    const programReportRoot = path.join(tempDir, "program_report");

    fs.mkdirSync(boundedReportRoot, { recursive: true });
    fs.mkdirSync(ws6ReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(boundedReportRoot, "canonical_bounded_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: boundedReportRoot,
          sourceBoundedImportanceRootDirectoryPath: "/source/bounded",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 2, C: 1 },
          totalCases: 3,
          boundednessAllMatch: true,
          operatorAttentionCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0698.json",
              provenanceManifestPath: "/responses/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/1037.json",
              provenanceManifestPath: "/responses/1037.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0905.json",
              provenanceManifestPath: "/responses/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    fs.writeFileSync(
      path.join(ws6ReportRoot, "ws6_canonical_execution_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: ws6ReportRoot,
          sourceExecutionArtifactsRootDirectoryPath: "/source/ws6",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 1, C: 1 },
          totalCases: 2,
          completedCount: 2,
          failedCount: 0,
          missingResultCount: 0,
          allCompleted: true,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              jobId: "provider-request-0698",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0698.json",
              recoveryArtifactPath: "/recovery/0698.json",
              provenanceManifestPath: "/execution/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              jobId: "provider-request-0905",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0905.json",
              recoveryArtifactPath: "/recovery/0905.json",
              provenanceManifestPath: "/execution/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = buildOpenPraQuantumCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
      boundedReportRootDirectoryPath: boundedReportRoot,
      ws6ExecutionReportRootDirectoryPath: ws6ReportRoot,
      scriptVersion: "openpra-quantum-canonical-program-report.spec",
    })

    expect(built.summary.totalWs5Cases).toBe(3)
    expect(built.summary.totalWs6Cases).toBe(2)
    expect(built.summary.totalUnionCases).toBe(3)
    expect(built.summary.readyForFrontend).toBe(true)
    expect(fs.existsSync(built.summaryPath)).toBe(true)
    expect(fs.existsSync(built.manifestPath)).toBe(true)

    const loaded = loadLatestOpenPraQuantumCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
    })

    expect(loaded.summary.ws5CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ])
    expect(loaded.summary.ws6CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
    ])
    expect(loaded.summary.readyForFrontend).toBe(true)
  })
})
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-ws6-canonical-execution-report";\n',
        'export * from "./openpra-quantum-canonical-program-report";\n',
        "index chunk k export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumWs6CanonicalExecutionReport,\n",
        "  buildOpenPraQuantumCanonicalProgramReport,\n  loadLatestOpenPraQuantumCanonicalProgramReport,\n",
        "service chunk k import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumWs6CanonicalExecutionReportResult,\n",
        "  type OpenPraQuantumCanonicalProgramReportLoadResult,\n  type OpenPraQuantumCanonicalProgramReportRequest,\n  type OpenPraQuantumCanonicalProgramReportResult,\n",
        "service chunk k import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumCanonicalProgramReportRequest =
  OpenPraQuantumCanonicalProgramReportRequest;

export interface QuantumLoadLatestCanonicalProgramReportRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk k request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildCanonicalProgramReport(
    request: QuantumCanonicalProgramReportRequest,
  ): OpenPraQuantumCanonicalProgramReportResult {
    return buildOpenPraQuantumCanonicalProgramReport(request);
  }

  loadLatestCanonicalProgramReport(
    request: QuantumLoadLatestCanonicalProgramReportRequest,
  ): OpenPraQuantumCanonicalProgramReportLoadResult {
    return loadLatestOpenPraQuantumCanonicalProgramReport(request);
  }

""",
        "service chunk k methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumWs6CanonicalExecutionReportResult,\n",
        "  OpenPraQuantumCanonicalProgramReportLoadResult,\n  OpenPraQuantumCanonicalProgramReportResult,\n",
        "controller chunk k result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestWs6CanonicalExecutionReportRequest,\n",
        "  type QuantumCanonicalProgramReportRequest,\n  type QuantumLoadLatestCanonicalProgramReportRequest,\n",
        "controller chunk k service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumCanonicalProgramReportRequestBody
  extends QuantumCanonicalProgramReportRequest {}

export interface QuantumLoadLatestCanonicalProgramReportRequestBody
  extends QuantumLoadLatestCanonicalProgramReportRequest {}

""",
        "controller chunk k request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/canonical-program-report")
  @HttpCode(HttpStatus.OK)
  buildCanonicalProgramReport(
    @Body() body: QuantumCanonicalProgramReportRequestBody,
  ): OpenPraQuantumCanonicalProgramReportResult {
    try {
      return this.quantumReadinessService.buildCanonicalProgramReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/canonical-program-report/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestCanonicalProgramReport(
    @Body() body: QuantumLoadLatestCanonicalProgramReportRequestBody,
  ): OpenPraQuantumCanonicalProgramReportLoadResult {
    try {
      return this.quantumReadinessService.loadLatestCanonicalProgramReport(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk k methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalProgramReport.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService canonical program report", () => {
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

  it("builds and loads the canonical program report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-program-report-service-"));
    const boundedReportRoot = path.join(tempDir, "bounded_report");
    const ws6ReportRoot = path.join(tempDir, "ws6_report");
    const programReportRoot = path.join(tempDir, "program_report");

    fs.mkdirSync(boundedReportRoot, { recursive: true });
    fs.mkdirSync(ws6ReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(boundedReportRoot, "canonical_bounded_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: boundedReportRoot,
          sourceBoundedImportanceRootDirectoryPath: "/source/bounded",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 2, C: 1 },
          totalCases: 3,
          boundednessAllMatch: true,
          operatorAttentionCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0698.json",
              provenanceManifestPath: "/responses/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/1037.json",
              provenanceManifestPath: "/responses/1037.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0905.json",
              provenanceManifestPath: "/responses/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    fs.writeFileSync(
      path.join(ws6ReportRoot, "ws6_canonical_execution_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: ws6ReportRoot,
          sourceExecutionArtifactsRootDirectoryPath: "/source/ws6",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 1, C: 1 },
          totalCases: 2,
          completedCount: 2,
          failedCount: 0,
          missingResultCount: 0,
          allCompleted: true,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              jobId: "provider-request-0698",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0698.json",
              recoveryArtifactPath: "/recovery/0698.json",
              provenanceManifestPath: "/execution/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              jobId: "provider-request-0905",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0905.json",
              recoveryArtifactPath: "/recovery/0905.json",
              provenanceManifestPath: "/execution/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = service.buildCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
      boundedReportRootDirectoryPath: boundedReportRoot,
      ws6ExecutionReportRootDirectoryPath: ws6ReportRoot,
      scriptVersion: "quantumReadiness.canonicalProgramReport.service.spec",
    })

    expect(built.summary.totalWs5Cases).toBe(3)
    expect(built.summary.totalWs6Cases).toBe(2)
    expect(built.summary.readyForFrontend).toBe(true)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = service.loadLatestCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
    })

    expect(loaded.summary.unionCaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_0905__G_G939",
      "phase2b_row_1037__G_G348",
    ].sort())
  })
})
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalProgramReport.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical program report", () => {
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

  it("builds and loads the canonical program report through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-program-report-controller-"));
    const boundedReportRoot = path.join(tempDir, "bounded_report");
    const ws6ReportRoot = path.join(tempDir, "ws6_report");
    const programReportRoot = path.join(tempDir, "program_report");

    fs.mkdirSync(boundedReportRoot, { recursive: true });
    fs.mkdirSync(ws6ReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(boundedReportRoot, "canonical_bounded_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: boundedReportRoot,
          sourceBoundedImportanceRootDirectoryPath: "/source/bounded",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 2, C: 1 },
          totalCases: 3,
          boundednessAllMatch: true,
          operatorAttentionCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0698.json",
              provenanceManifestPath: "/responses/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/1037.json",
              provenanceManifestPath: "/responses/1037.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0905.json",
              provenanceManifestPath: "/responses/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    fs.writeFileSync(
      path.join(ws6ReportRoot, "ws6_canonical_execution_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: ws6ReportRoot,
          sourceExecutionArtifactsRootDirectoryPath: "/source/ws6",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 1, C: 1 },
          totalCases: 2,
          completedCount: 2,
          failedCount: 0,
          missingResultCount: 0,
          allCompleted: true,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              jobId: "provider-request-0698",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0698.json",
              recoveryArtifactPath: "/recovery/0698.json",
              provenanceManifestPath: "/execution/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              jobId: "provider-request-0905",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0905.json",
              recoveryArtifactPath: "/recovery/0905.json",
              provenanceManifestPath: "/execution/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = controller.buildCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
      boundedReportRootDirectoryPath: boundedReportRoot,
      ws6ExecutionReportRootDirectoryPath: ws6ReportRoot,
      scriptVersion: "quantumReadiness.canonicalProgramReport.controller.spec",
    })

    expect(built.summary.totalUnionCases).toBe(3)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = controller.loadLatestCanonicalProgramReport({
      rootDirectoryPath: programReportRoot,
    })

    expect(loaded.summary.readyForFrontend).toBe(true)
    expect(loaded.summary.totalWs5Cases).toBe(3)
    expect(loaded.summary.totalWs6Cases).toBe(2)
  })
})
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.canonicalProgramReport.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalProgramReport.http", () => {
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

  it("builds and loads the canonical program report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-program-report-http-"));
    const boundedReportRoot = path.join(tempDir, "bounded_report");
    const ws6ReportRoot = path.join(tempDir, "ws6_report");
    const programReportRoot = path.join(tempDir, "program_report");

    fs.mkdirSync(boundedReportRoot, { recursive: true });
    fs.mkdirSync(ws6ReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(boundedReportRoot, "canonical_bounded_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: boundedReportRoot,
          sourceBoundedImportanceRootDirectoryPath: "/source/bounded",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_1037__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 2, C: 1 },
          totalCases: 3,
          boundednessAllMatch: true,
          operatorAttentionCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0698.json",
              provenanceManifestPath: "/responses/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/1037.json",
              provenanceManifestPath: "/responses/1037.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0905.json",
              provenanceManifestPath: "/responses/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    fs.writeFileSync(
      path.join(ws6ReportRoot, "ws6_canonical_execution_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: ws6ReportRoot,
          sourceExecutionArtifactsRootDirectoryPath: "/source/ws6",
          caseLabels: [
            "phase2b_row_0698__G_G348",
            "phase2b_row_0905__G_G939",
          ],
          topologyCounts: { A: 1, C: 1 },
          totalCases: 2,
          completedCount: 2,
          failedCount: 0,
          missingResultCount: 0,
          allCompleted: true,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              jobId: "provider-request-0698",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0698.json",
              recoveryArtifactPath: "/recovery/0698.json",
              provenanceManifestPath: "/execution/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              jobId: "provider-request-0905",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0905.json",
              recoveryArtifactPath: "/recovery/0905.json",
              provenanceManifestPath: "/execution/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = await request(app.getHttpServer())
      .post("/canonical-program-report")
      .send({
        rootDirectoryPath: programReportRoot,
        boundedReportRootDirectoryPath: boundedReportRoot,
        ws6ExecutionReportRootDirectoryPath: ws6ReportRoot,
        scriptVersion: "quantumReadiness.canonicalProgramReport.http.spec",
      })
      .expect(200)

    expect(built.body.summary.totalUnionCases).toBe(3)
    expect(built.body.summary.readyForFrontend).toBe(true)
    expect(fs.existsSync(built.body.summaryPath)).toBe(true)

    const loaded = await request(app.getHttpServer())
      .post("/canonical-program-report/load-latest")
      .send({
        rootDirectoryPath: programReportRoot,
      })
      .expect(200)

    expect(loaded.body.summary.totalWs5Cases).toBe(3)
    expect(loaded.body.summary.totalWs6Cases).toBe(2)
    expect(loaded.body.summary.readyForFrontend).toBe(true)
  })
})
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_canonical_program_report_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_canonical_program_report_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_CANONICAL_PROGRAM_REPORT_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-canonical-program-report.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalProgramReport.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.canonicalProgramReport.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.canonicalProgramReport.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_CANONICAL_PROGRAM_REPORT_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/canonical-program-report",
        "/canonical-program-report/load-latest",
    ],
    "interpretation": (
        "Chunk K adds the unified canonical program report that aggregates the "
        "WS5 canonical bounded report and the WS6 canonical execution report."
    ),
}

(run_dir / "notes" / "openpra_quantum_canonical_program_report_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Canonical Program Report Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /canonical-program-report
- /canonical-program-report/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_CANONICAL_PROGRAM_REPORT_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied canonical program report chunk K successfully.")


if __name__ == "__main__":
    main()

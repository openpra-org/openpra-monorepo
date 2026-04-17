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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-workspace-snapshot.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumCanonicalProgramReport,
  type OpenPraQuantumCanonicalProgramReportLoadResult,
} from "./openpra-quantum-canonical-program-report";
import {
  loadLatestOpenPraQuantumFrontendSummary,
  type OpenPraQuantumFrontendSummaryLoadResult,
} from "./openpra-quantum-frontend-summary";

export interface OpenPraQuantumFrontendWorkspaceSnapshotRequest {
  rootDirectoryPath: string;
  frontendSummaryRootDirectoryPath: string;
  canonicalProgramReportRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotCard {
  id: string;
  title: string;
  status: "ready" | "blocked" | "complete" | "partial";
  primaryValue: string;
  secondaryValue: string;
  notes: string[];
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotCaseRow {
  caseLabel: string;
  topologyClass: string | null;
  showInFrontend: boolean;
  inWs5BoundedReport: boolean;
  inWs6ExecutionReport: boolean;
  boundednessMatches: boolean | null;
  ws6ExecutionStatus: string | null;
  ws6HasResult: boolean | null;
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  frontendSummaryRootDirectoryPath: string;
  canonicalProgramReportRootDirectoryPath: string;
  readyForFrontend: boolean;
  readinessStatus: "ready" | "blocked";
  cards: OpenPraQuantumFrontendWorkspaceSnapshotCard[];
  caseRows: OpenPraQuantumFrontendWorkspaceSnapshotCaseRow[];
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotResult {
  frontendSummary: OpenPraQuantumFrontendSummaryLoadResult;
  canonicalProgramReport: OpenPraQuantumCanonicalProgramReportLoadResult;
  summary: OpenPraQuantumFrontendWorkspaceSnapshotSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumFrontendWorkspaceSnapshotLoadResult {
  summary: OpenPraQuantumFrontendWorkspaceSnapshotSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumFrontendWorkspaceSnapshot(
  request: OpenPraQuantumFrontendWorkspaceSnapshotRequest,
): OpenPraQuantumFrontendWorkspaceSnapshotResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-frontend-workspace-snapshot-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendSummary = loadLatestOpenPraQuantumFrontendSummary({
    rootDirectoryPath: request.frontendSummaryRootDirectoryPath,
  });

  const canonicalProgramReport = loadLatestOpenPraQuantumCanonicalProgramReport({
    rootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
  });

  const topologyCounts = canonicalProgramReport.summary.rows.reduce<Record<string, number>>(
    (acc, row) => {
      const key = row.topologyClass ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const cards: OpenPraQuantumFrontendWorkspaceSnapshotCard[] = [
    {
      id: "readiness",
      title: "Frontend readiness",
      status: frontendSummary.summary.readyForFrontend ? "ready" : "blocked",
      primaryValue: frontendSummary.summary.readyForFrontend ? "Ready" : "Blocked",
      secondaryValue: `${frontendSummary.summary.totalUnionCases} tracked cases`,
      notes: [
        `WS5 cases: ${frontendSummary.summary.totalWs5Cases}`,
        `WS6 cases: ${frontendSummary.summary.totalWs6Cases}`,
      ],
    },
    {
      id: "ws5",
      title: "WS5 bounded coverage",
      status: frontendSummary.summary.ws5CoverageComplete ? "complete" : "partial",
      primaryValue: `${frontendSummary.summary.totalWs5Cases} cases`,
      secondaryValue: frontendSummary.summary.ws5CoverageComplete
        ? "All bounded checks matched"
        : "Bounded checks incomplete",
      notes: [
        `Operator attention count: ${frontendSummary.summary.operatorAttentionCount}`,
      ],
    },
    {
      id: "ws6",
      title: "WS6 execution coverage",
      status: frontendSummary.summary.ws6CoverageComplete ? "complete" : "partial",
      primaryValue: `${frontendSummary.summary.totalWs6Cases} cases`,
      secondaryValue: frontendSummary.summary.ws6CoverageComplete
        ? "All execution cases completed"
        : "Execution cases still incomplete",
      notes: [
        `Missing result count: ${frontendSummary.summary.ws6MissingResultCount}`,
      ],
    },
    {
      id: "topology",
      title: "Topology mix",
      status: "complete",
      primaryValue: Object.entries(topologyCounts)
        .map(([key, value]) => `${key}:${value}`)
        .join(" "),
      secondaryValue: `${canonicalProgramReport.summary.totalUnionCases} union cases`,
      notes: [
        `WS5 ready: ${canonicalProgramReport.summary.boundednessAllMatch}`,
        `WS6 ready: ${canonicalProgramReport.summary.ws6AllCompleted}`,
      ],
    },
  ];

  const caseRows: OpenPraQuantumFrontendWorkspaceSnapshotCaseRow[] =
    frontendSummary.summary.caseRows.map((row) => ({
      caseLabel: row.caseLabel,
      topologyClass: row.topologyClass,
      showInFrontend: row.showInFrontend,
      inWs5BoundedReport: row.inWs5BoundedReport,
      inWs6ExecutionReport: row.inWs6ExecutionReport,
      boundednessMatches: row.boundednessMatches,
      ws6ExecutionStatus: row.ws6ExecutionStatus,
      ws6HasResult: row.ws6HasResult,
    }));

  const summary: OpenPraQuantumFrontendWorkspaceSnapshotSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    frontendSummaryRootDirectoryPath: request.frontendSummaryRootDirectoryPath,
    canonicalProgramReportRootDirectoryPath:
      request.canonicalProgramReportRootDirectoryPath,
    readyForFrontend: frontendSummary.summary.readyForFrontend,
    readinessStatus: frontendSummary.summary.readinessStatus,
    cards,
    caseRows,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_workspace_snapshot_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_workspace_snapshot_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_frontend_workspace_snapshot_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    readyForFrontend: summary.readyForFrontend,
    readinessStatus: summary.readinessStatus,
    cardCount: summary.cards.length,
    caseRowCount: summary.caseRows.length,
  });

  return {
    frontendSummary,
    canonicalProgramReport,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumFrontendWorkspaceSnapshot(
  request: OpenPraQuantumFrontendWorkspaceSnapshotLoadRequest,
): OpenPraQuantumFrontendWorkspaceSnapshotLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_workspace_snapshot_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend workspace snapshot found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendWorkspaceSnapshotSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_workspace_snapshot_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-workspace-snapshot.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendWorkspaceSnapshot,
  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,
} from "./openpra-quantum-frontend-workspace-snapshot";

describe("openpra-quantum-frontend-workspace-snapshot", () => {
  it("builds and loads the frontend workspace snapshot", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-workspace-"));
    const frontendSummaryRoot = path.join(tempDir, "frontend_summary");
    const canonicalProgramReportRoot = path.join(tempDir, "program_report");
    const snapshotRoot = path.join(tempDir, "workspace_snapshot");

    fs.mkdirSync(frontendSummaryRoot, { recursive: true });
    fs.mkdirSync(canonicalProgramReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(frontendSummaryRoot, "frontend_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:40:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: frontendSummaryRoot,
          canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
          readinessStatus: "ready",
          readyForFrontend: true,
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          ws5CoverageComplete: true,
          ws6CoverageComplete: true,
          ws6MissingResultCount: 0,
          operatorAttentionCount: 0,
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
              showInFrontend: true,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    fs.writeFileSync(
      path.join(canonicalProgramReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: canonicalProgramReportRoot,
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

    const built = buildOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
      frontendSummaryRootDirectoryPath: frontendSummaryRoot,
      canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
      scriptVersion: "openpra-quantum-frontend-workspace-snapshot.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.cards).toHaveLength(4);
    expect(built.summary.caseRows).toHaveLength(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.cards[0].title).toBe("Frontend readiness");
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-frontend-summary";\n',
        'export * from "./openpra-quantum-frontend-workspace-snapshot";\n',
        "index chunk m export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumFrontendSummary,\n",
        "  buildOpenPraQuantumFrontendWorkspaceSnapshot,\n  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,\n",
        "service chunk m import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumFrontendSummaryResult,\n",
        "  type OpenPraQuantumFrontendWorkspaceSnapshotLoadResult,\n  type OpenPraQuantumFrontendWorkspaceSnapshotRequest,\n  type OpenPraQuantumFrontendWorkspaceSnapshotResult,\n",
        "service chunk m import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumFrontendWorkspaceSnapshotRequest =
  OpenPraQuantumFrontendWorkspaceSnapshotRequest;

export interface QuantumLoadLatestFrontendWorkspaceSnapshotRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk m request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildFrontendWorkspaceSnapshot(
    request: QuantumFrontendWorkspaceSnapshotRequest,
  ): OpenPraQuantumFrontendWorkspaceSnapshotResult {
    return buildOpenPraQuantumFrontendWorkspaceSnapshot(request);
  }

  loadLatestFrontendWorkspaceSnapshot(
    request: QuantumLoadLatestFrontendWorkspaceSnapshotRequest,
  ): OpenPraQuantumFrontendWorkspaceSnapshotLoadResult {
    return loadLatestOpenPraQuantumFrontendWorkspaceSnapshot(request);
  }

""",
        "service chunk m methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumFrontendSummaryResult,\n",
        "  OpenPraQuantumFrontendWorkspaceSnapshotLoadResult,\n  OpenPraQuantumFrontendWorkspaceSnapshotResult,\n",
        "controller chunk m result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestFrontendSummaryRequest,\n",
        "  type QuantumFrontendWorkspaceSnapshotRequest,\n  type QuantumLoadLatestFrontendWorkspaceSnapshotRequest,\n",
        "controller chunk m service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumFrontendWorkspaceSnapshotRequestBody
  extends QuantumFrontendWorkspaceSnapshotRequest {}

export interface QuantumLoadLatestFrontendWorkspaceSnapshotRequestBody
  extends QuantumLoadLatestFrontendWorkspaceSnapshotRequest {}

""",
        "controller chunk m request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/frontend-workspace-snapshot")
  @HttpCode(HttpStatus.OK)
  buildFrontendWorkspaceSnapshot(
    @Body() body: QuantumFrontendWorkspaceSnapshotRequestBody,
  ): OpenPraQuantumFrontendWorkspaceSnapshotResult {
    try {
      return this.quantumReadinessService.buildFrontendWorkspaceSnapshot(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/frontend-workspace-snapshot/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestFrontendWorkspaceSnapshot(
    @Body() body: QuantumLoadLatestFrontendWorkspaceSnapshotRequestBody,
  ): OpenPraQuantumFrontendWorkspaceSnapshotLoadResult {
    try {
      return this.quantumReadinessService.loadLatestFrontendWorkspaceSnapshot(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk m methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendWorkspaceSnapshot.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend workspace snapshot", () => {
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

  it("builds and loads the frontend workspace snapshot", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-workspace-service-"));
    const frontendSummaryRoot = path.join(tempDir, "frontend_summary");
    const canonicalProgramReportRoot = path.join(tempDir, "program_report");
    const snapshotRoot = path.join(tempDir, "workspace_snapshot");

    fs.mkdirSync(frontendSummaryRoot, { recursive: true });
    fs.mkdirSync(canonicalProgramReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(frontendSummaryRoot, "frontend_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:40:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: frontendSummaryRoot,
          canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
          readinessStatus: "ready",
          readyForFrontend: true,
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          ws5CoverageComplete: true,
          ws6CoverageComplete: true,
          ws6MissingResultCount: 0,
          operatorAttentionCount: 0,
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
              showInFrontend: true,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    fs.writeFileSync(
      path.join(canonicalProgramReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: canonicalProgramReportRoot,
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

    const built = service.buildFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
      frontendSummaryRootDirectoryPath: frontendSummaryRoot,
      canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
      scriptVersion: "quantumReadiness.frontendWorkspaceSnapshot.service.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.cards).toHaveLength(4);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.caseRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendWorkspaceSnapshot.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController frontend workspace snapshot", () => {
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

  it("builds and loads the frontend workspace snapshot through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-workspace-controller-"));
    const frontendSummaryRoot = path.join(tempDir, "frontend_summary");
    const canonicalProgramReportRoot = path.join(tempDir, "program_report");
    const snapshotRoot = path.join(tempDir, "workspace_snapshot");

    fs.mkdirSync(frontendSummaryRoot, { recursive: true });
    fs.mkdirSync(canonicalProgramReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(frontendSummaryRoot, "frontend_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:40:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: frontendSummaryRoot,
          canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
          readinessStatus: "ready",
          readyForFrontend: true,
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          ws5CoverageComplete: true,
          ws6CoverageComplete: true,
          ws6MissingResultCount: 0,
          operatorAttentionCount: 0,
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
              showInFrontend: true,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    fs.writeFileSync(
      path.join(canonicalProgramReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: canonicalProgramReportRoot,
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

    const built = controller.buildFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
      frontendSummaryRootDirectoryPath: frontendSummaryRoot,
      canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
      scriptVersion: "quantumReadiness.frontendWorkspaceSnapshot.controller.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = controller.loadLatestFrontendWorkspaceSnapshot({
      rootDirectoryPath: snapshotRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.cards).toHaveLength(4);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.frontendWorkspaceSnapshot.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendWorkspaceSnapshot.http", () => {
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

  it("builds and loads the frontend workspace snapshot through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-workspace-http-"));
    const frontendSummaryRoot = path.join(tempDir, "frontend_summary");
    const canonicalProgramReportRoot = path.join(tempDir, "program_report");
    const snapshotRoot = path.join(tempDir, "workspace_snapshot");

    fs.mkdirSync(frontendSummaryRoot, { recursive: true });
    fs.mkdirSync(canonicalProgramReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(frontendSummaryRoot, "frontend_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:40:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: frontendSummaryRoot,
          canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
          readinessStatus: "ready",
          readyForFrontend: true,
          totalWs5Cases: 3,
          totalWs6Cases: 2,
          totalUnionCases: 3,
          ws5CoverageComplete: true,
          ws6CoverageComplete: true,
          ws6MissingResultCount: 0,
          operatorAttentionCount: 0,
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
              showInFrontend: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
              showInFrontend: true,
            },
          ],
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    );

    fs.writeFileSync(
      path.join(canonicalProgramReportRoot, "canonical_program_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:30:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: canonicalProgramReportRoot,
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
      .post("/frontend-workspace-snapshot")
      .send({
        rootDirectoryPath: snapshotRoot,
        frontendSummaryRootDirectoryPath: frontendSummaryRoot,
        canonicalProgramReportRootDirectoryPath: canonicalProgramReportRoot,
        scriptVersion: "quantumReadiness.frontendWorkspaceSnapshot.http.spec",
      })
      .expect(200);

    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(built.body.summary.cards).toHaveLength(4);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/frontend-workspace-snapshot/load-latest")
      .send({
        rootDirectoryPath: snapshotRoot,
      })
      .expect(200);

    expect(loaded.body.summary.readinessStatus).toBe("ready");
    expect(loaded.body.summary.caseRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_frontend_workspace_snapshot_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_frontend_workspace_snapshot_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_FRONTEND_WORKSPACE_SNAPSHOT_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-frontend-workspace-snapshot.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendWorkspaceSnapshot.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendWorkspaceSnapshot.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.frontendWorkspaceSnapshot.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_FRONTEND_WORKSPACE_SNAPSHOT_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/frontend-workspace-snapshot",
        "/frontend-workspace-snapshot/load-latest",
    ],
    "interpretation": (
        "Chunk M adds a frontend workspace snapshot derived from the frontend "
        "summary and canonical program report."
    ),
}

(run_dir / "notes" / "openpra_quantum_frontend_workspace_snapshot_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Frontend Workspace Snapshot Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /frontend-workspace-snapshot
- /frontend-workspace-snapshot/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_FRONTEND_WORKSPACE_SNAPSHOT_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied frontend workspace snapshot chunk M successfully.")


if __name__ == "__main__":
    main()

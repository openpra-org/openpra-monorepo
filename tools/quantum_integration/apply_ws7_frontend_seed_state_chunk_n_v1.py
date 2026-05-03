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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-seed-state.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,
  type OpenPraQuantumFrontendWorkspaceSnapshotLoadResult,
} from "./openpra-quantum-frontend-workspace-snapshot";

export interface OpenPraQuantumFrontendSeedStateRequest {
  rootDirectoryPath: string;
  frontendWorkspaceSnapshotRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumFrontendSeedBadge {
  label: string;
  tone: "success" | "warning";
}

export interface OpenPraQuantumFrontendSeedWidget {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  status: "ready" | "blocked" | "complete" | "partial";
  notes: string[];
}

export interface OpenPraQuantumFrontendSeedCaseTableRow {
  caseLabel: string;
  topologyClass: string | null;
  displayStatus: "ready" | "blocked" | "partial";
  showInFrontend: boolean;
  boundednessMatches: boolean | null;
  ws6ExecutionStatus: string | null;
  ws6HasResult: boolean | null;
}

export interface OpenPraQuantumFrontendSeedStateSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  frontendWorkspaceSnapshotRootDirectoryPath: string;
  readyForFrontend: boolean;
  readinessStatus: "ready" | "blocked";
  badge: OpenPraQuantumFrontendSeedBadge;
  widgets: OpenPraQuantumFrontendSeedWidget[];
  caseTableRows: OpenPraQuantumFrontendSeedCaseTableRow[];
}

export interface OpenPraQuantumFrontendSeedStateResult {
  frontendWorkspaceSnapshot: OpenPraQuantumFrontendWorkspaceSnapshotLoadResult;
  summary: OpenPraQuantumFrontendSeedStateSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumFrontendSeedStateLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumFrontendSeedStateLoadResult {
  summary: OpenPraQuantumFrontendSeedStateSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumFrontendSeedState(
  request: OpenPraQuantumFrontendSeedStateRequest,
): OpenPraQuantumFrontendSeedStateResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-frontend-seed-state-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendWorkspaceSnapshot =
    loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
    });

  const badge: OpenPraQuantumFrontendSeedBadge =
    frontendWorkspaceSnapshot.summary.readyForFrontend
      ? {
          label: "Frontend ready",
          tone: "success",
        }
      : {
          label: "Frontend blocked",
          tone: "warning",
        };

  const widgets: OpenPraQuantumFrontendSeedWidget[] =
    frontendWorkspaceSnapshot.summary.cards.map((card) => ({
      id: card.id,
      title: card.title,
      value: card.primaryValue,
      subtitle: card.secondaryValue,
      status: card.status,
      notes: card.notes,
    }));

  const caseTableRows: OpenPraQuantumFrontendSeedCaseTableRow[] =
    frontendWorkspaceSnapshot.summary.caseRows.map((row) => ({
      caseLabel: row.caseLabel,
      topologyClass: row.topologyClass,
      displayStatus:
        row.showInFrontend && row.boundednessMatches !== false
          ? "ready"
          : row.inWs5BoundedReport || row.inWs6ExecutionReport
            ? "partial"
            : "blocked",
      showInFrontend: row.showInFrontend,
      boundednessMatches: row.boundednessMatches,
      ws6ExecutionStatus: row.ws6ExecutionStatus,
      ws6HasResult: row.ws6HasResult,
    }));

  const summary: OpenPraQuantumFrontendSeedStateSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    frontendWorkspaceSnapshotRootDirectoryPath:
      request.frontendWorkspaceSnapshotRootDirectoryPath,
    readyForFrontend: frontendWorkspaceSnapshot.summary.readyForFrontend,
    readinessStatus: frontendWorkspaceSnapshot.summary.readinessStatus,
    badge,
    widgets,
    caseTableRows,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_seed_state_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_seed_state_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_frontend_seed_state_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    readyForFrontend: summary.readyForFrontend,
    readinessStatus: summary.readinessStatus,
    widgetCount: summary.widgets.length,
    caseRowCount: summary.caseTableRows.length,
  });

  return {
    frontendWorkspaceSnapshot,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumFrontendSeedState(
  request: OpenPraQuantumFrontendSeedStateLoadRequest,
): OpenPraQuantumFrontendSeedStateLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_seed_state_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend seed state found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendSeedStateSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_seed_state_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-seed-state.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendSeedState,
  loadLatestOpenPraQuantumFrontendSeedState,
} from "./openpra-quantum-frontend-seed-state";

describe("openpra-quantum-frontend-seed-state", () => {
  it("builds and loads the frontend seed state", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-state-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
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

    const built = buildOpenPraQuantumFrontendSeedState({
      rootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
      scriptVersion: "openpra-quantum-frontend-seed-state.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.badge.label).toBe("Frontend ready");
    expect(built.summary.widgets).toHaveLength(4);
    expect(built.summary.caseTableRows).toHaveLength(3);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumFrontendSeedState({
      rootDirectoryPath: seedRoot,
    });

    expect(loaded.summary.readinessStatus).toBe("ready");
    expect(loaded.summary.caseTableRows[0].displayStatus).toBe("ready");
  });
});
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-frontend-workspace-snapshot";\n',
        'export * from "./openpra-quantum-frontend-seed-state";\n',
        "index chunk n export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,\n",
        "  buildOpenPraQuantumFrontendSeedState,\n  loadLatestOpenPraQuantumFrontendSeedState,\n",
        "service chunk n import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumFrontendWorkspaceSnapshotResult,\n",
        "  type OpenPraQuantumFrontendSeedStateLoadResult,\n  type OpenPraQuantumFrontendSeedStateRequest,\n  type OpenPraQuantumFrontendSeedStateResult,\n",
        "service chunk n import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumFrontendSeedStateRequest =
  OpenPraQuantumFrontendSeedStateRequest;

export interface QuantumLoadLatestFrontendSeedStateRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk n request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildFrontendSeedState(
    request: QuantumFrontendSeedStateRequest,
  ): OpenPraQuantumFrontendSeedStateResult {
    return buildOpenPraQuantumFrontendSeedState(request);
  }

  loadLatestFrontendSeedState(
    request: QuantumLoadLatestFrontendSeedStateRequest,
  ): OpenPraQuantumFrontendSeedStateLoadResult {
    return loadLatestOpenPraQuantumFrontendSeedState(request);
  }

""",
        "service chunk n methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumFrontendWorkspaceSnapshotResult,\n",
        "  OpenPraQuantumFrontendSeedStateLoadResult,\n  OpenPraQuantumFrontendSeedStateResult,\n",
        "controller chunk n result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestFrontendWorkspaceSnapshotRequest,\n",
        "  type QuantumFrontendSeedStateRequest,\n  type QuantumLoadLatestFrontendSeedStateRequest,\n",
        "controller chunk n service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumFrontendSeedStateRequestBody
  extends QuantumFrontendSeedStateRequest {}

export interface QuantumLoadLatestFrontendSeedStateRequestBody
  extends QuantumLoadLatestFrontendSeedStateRequest {}

""",
        "controller chunk n request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/frontend-seed-state")
  @HttpCode(HttpStatus.OK)
  buildFrontendSeedState(
    @Body() body: QuantumFrontendSeedStateRequestBody,
  ): OpenPraQuantumFrontendSeedStateResult {
    try {
      return this.quantumReadinessService.buildFrontendSeedState(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/frontend-seed-state/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestFrontendSeedState(
    @Body() body: QuantumLoadLatestFrontendSeedStateRequestBody,
  ): OpenPraQuantumFrontendSeedStateLoadResult {
    try {
      return this.quantumReadinessService.loadLatestFrontendSeedState(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk n methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSeedState.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend seed state", () => {
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

  it("builds and loads the frontend seed state", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-service-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
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

    const built = service.buildFrontendSeedState({
      rootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
      scriptVersion: "quantumReadiness.frontendSeedState.service.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(built.summary.widgets).toHaveLength(4);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestFrontendSeedState({
      rootDirectoryPath: seedRoot,
    });

    expect(loaded.summary.badge.label).toBe("Frontend ready");
    expect(loaded.summary.caseTableRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSeedState.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController frontend seed state", () => {
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

  it("builds and loads the frontend seed state through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-controller-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
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

    const built = controller.buildFrontendSeedState({
      rootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
      scriptVersion: "quantumReadiness.frontendSeedState.controller.spec",
    });

    expect(built.summary.readyForFrontend).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = controller.loadLatestFrontendSeedState({
      rootDirectoryPath: seedRoot,
    });

    expect(loaded.summary.badge.label).toBe("Frontend ready");
    expect(loaded.summary.widgets).toHaveLength(4);
  });
});
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.frontendSeedState.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSeedState.http", () => {
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

  it("builds and loads the frontend seed state through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-http-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
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
      .post("/frontend-seed-state")
      .send({
        rootDirectoryPath: seedRoot,
        frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
        scriptVersion: "quantumReadiness.frontendSeedState.http.spec",
      })
      .expect(200);

    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(built.body.summary.badge.label).toBe("Frontend ready");
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/frontend-seed-state/load-latest")
      .send({
        rootDirectoryPath: seedRoot,
      })
      .expect(200);

    expect(loaded.body.summary.readinessStatus).toBe("ready");
    expect(loaded.body.summary.caseTableRows).toHaveLength(3);
  });
});
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_frontend_seed_state_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_frontend_seed_state_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_FRONTEND_SEED_STATE_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-frontend-seed-state.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSeedState.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSeedState.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.frontendSeedState.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_FRONTEND_SEED_STATE_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/frontend-seed-state",
        "/frontend-seed-state/load-latest",
    ],
    "interpretation": (
        "Chunk N adds a frontend seed state derived from the workspace snapshot "
        "so the UI can hydrate directly from one stable artifact."
    ),
}

(run_dir / "notes" / "openpra_quantum_frontend_seed_state_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Frontend Seed State Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /frontend-seed-state
- /frontend-seed-state/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_FRONTEND_SEED_STATE_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied frontend seed state chunk N successfully.")


if __name__ == "__main__":
    main()

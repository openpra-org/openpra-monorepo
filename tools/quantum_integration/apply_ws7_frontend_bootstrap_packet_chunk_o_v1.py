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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-bootstrap-packet.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumFrontendSeedState,
  type OpenPraQuantumFrontendSeedStateLoadResult,
} from "./openpra-quantum-frontend-seed-state";
import {
  loadLatestOpenPraQuantumFrontendWorkspaceSnapshot,
  type OpenPraQuantumFrontendWorkspaceSnapshotLoadResult,
} from "./openpra-quantum-frontend-workspace-snapshot";

export interface OpenPraQuantumFrontendBootstrapPacketRequest {
  rootDirectoryPath: string;
  frontendSeedStateRootDirectoryPath: string;
  frontendWorkspaceSnapshotRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumFrontendBootstrapNavItem {
  id: string;
  label: string;
  enabled: boolean;
  count: number | null;
}

export interface OpenPraQuantumFrontendBootstrapPacketSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  frontendSeedStateRootDirectoryPath: string;
  frontendWorkspaceSnapshotRootDirectoryPath: string;
  readyForFrontend: boolean;
  readinessStatus: "ready" | "blocked";
  headerBadgeLabel: string;
  widgetCount: number;
  caseRowCount: number;
  nav: OpenPraQuantumFrontendBootstrapNavItem[];
  widgetTitles: string[];
  readyCaseCount: number;
  partialCaseCount: number;
  blockedCaseCount: number;
}

export interface OpenPraQuantumFrontendBootstrapPacketResult {
  frontendSeedState: OpenPraQuantumFrontendSeedStateLoadResult;
  frontendWorkspaceSnapshot: OpenPraQuantumFrontendWorkspaceSnapshotLoadResult;
  summary: OpenPraQuantumFrontendBootstrapPacketSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumFrontendBootstrapPacketLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumFrontendBootstrapPacketLoadResult {
  summary: OpenPraQuantumFrontendBootstrapPacketSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumFrontendBootstrapPacket(
  request: OpenPraQuantumFrontendBootstrapPacketRequest,
): OpenPraQuantumFrontendBootstrapPacketResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-frontend-bootstrap-packet-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendSeedState = loadLatestOpenPraQuantumFrontendSeedState({
    rootDirectoryPath: request.frontendSeedStateRootDirectoryPath,
  });

  const frontendWorkspaceSnapshot =
    loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
      rootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
    });

  const readyCaseCount = frontendSeedState.summary.caseTableRows.filter(
    (row) => row.displayStatus === "ready",
  ).length;
  const partialCaseCount = frontendSeedState.summary.caseTableRows.filter(
    (row) => row.displayStatus === "partial",
  ).length;
  const blockedCaseCount = frontendSeedState.summary.caseTableRows.filter(
    (row) => row.displayStatus === "blocked",
  ).length;

  const summary: OpenPraQuantumFrontendBootstrapPacketSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    frontendSeedStateRootDirectoryPath:
      request.frontendSeedStateRootDirectoryPath,
    frontendWorkspaceSnapshotRootDirectoryPath:
      request.frontendWorkspaceSnapshotRootDirectoryPath,
    readyForFrontend: frontendSeedState.summary.readyForFrontend,
    readinessStatus: frontendSeedState.summary.readinessStatus,
    headerBadgeLabel: frontendSeedState.summary.badge.label,
    widgetCount: frontendSeedState.summary.widgets.length,
    caseRowCount: frontendSeedState.summary.caseTableRows.length,
    nav: [
      {
        id: "overview",
        label: "Overview",
        enabled: true,
        count: frontendSeedState.summary.widgets.length,
      },
      {
        id: "cases",
        label: "Cases",
        enabled: frontendSeedState.summary.caseTableRows.length > 0,
        count: frontendSeedState.summary.caseTableRows.length,
      },
      {
        id: "workspace",
        label: "Workspace",
        enabled: frontendWorkspaceSnapshot.summary.cards.length > 0,
        count: frontendWorkspaceSnapshot.summary.cards.length,
      },
    ],
    widgetTitles: frontendSeedState.summary.widgets.map((widget) => widget.title),
    readyCaseCount,
    partialCaseCount,
    blockedCaseCount,
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_bootstrap_packet_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_bootstrap_packet_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_frontend_bootstrap_packet_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    readyForFrontend: summary.readyForFrontend,
    readinessStatus: summary.readinessStatus,
    widgetCount: summary.widgetCount,
    caseRowCount: summary.caseRowCount,
  });

  return {
    frontendSeedState,
    frontendWorkspaceSnapshot,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumFrontendBootstrapPacket(
  request: OpenPraQuantumFrontendBootstrapPacketLoadRequest,
): OpenPraQuantumFrontendBootstrapPacketLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_bootstrap_packet_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend bootstrap packet found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendBootstrapPacketSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_bootstrap_packet_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-bootstrap-packet.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendBootstrapPacket,
  loadLatestOpenPraQuantumFrontendBootstrapPacket,
} from "./openpra-quantum-frontend-bootstrap-packet";

describe("openpra-quantum-frontend-bootstrap-packet", () => {
  it("builds and loads the frontend bootstrap packet", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-bootstrap-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const workspaceRoot = path.join(tempDir, "workspace_snapshot");
    const packetRoot = path.join(tempDir, "bootstrap_packet");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
          readyForFrontend: true,
          readinessStatus: "ready",
          badge: {
            label: "Frontend ready",
            tone: "success",
          },
          widgets: [
            {
              id: "readiness",
              title: "Frontend readiness",
              value: "Ready",
              subtitle: "3 tracked cases",
              status: "ready",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              value: "3 cases",
              subtitle: "All bounded checks matched",
              status: "complete",
              notes: ["Operator attention count: 0"],
            },
          ],
          caseTableRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              displayStatus: "partial",
              showInFrontend: true,
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
    )

    fs.writeFileSync(
      path.join(workspaceRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceRoot,
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
    )

    const built = buildOpenPraQuantumFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
      scriptVersion: "openpra-quantum-frontend-bootstrap-packet.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(built.summary.headerBadgeLabel).toBe("Frontend ready")
    expect(built.summary.widgetCount).toBe(2)
    expect(built.summary.caseRowCount).toBe(3)
    expect(built.summary.readyCaseCount).toBe(2)
    expect(built.summary.partialCaseCount).toBe(1)
    expect(fs.existsSync(built.summaryPath)).toBe(true)
    expect(fs.existsSync(built.manifestPath)).toBe(true)

    const loaded = loadLatestOpenPraQuantumFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
    })

    expect(loaded.summary.readinessStatus).toBe("ready")
    expect(loaded.summary.nav).toHaveLength(3)
  })
})
""",
    )

    index_rel = "packages/quantum-readiness/src/lib/index.ts"
    index_text = read_text(index_rel)
    index_text = insert_after(
        index_text,
        'export * from "./openpra-quantum-frontend-seed-state";\n',
        'export * from "./openpra-quantum-frontend-bootstrap-packet";\n',
        "index chunk o export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumFrontendSeedState,\n",
        "  buildOpenPraQuantumFrontendBootstrapPacket,\n  loadLatestOpenPraQuantumFrontendBootstrapPacket,\n",
        "service chunk o import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumFrontendSeedStateResult,\n",
        "  type OpenPraQuantumFrontendBootstrapPacketLoadResult,\n  type OpenPraQuantumFrontendBootstrapPacketRequest,\n  type OpenPraQuantumFrontendBootstrapPacketResult,\n",
        "service chunk o import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumFrontendBootstrapPacketRequest =
  OpenPraQuantumFrontendBootstrapPacketRequest;

export interface QuantumLoadLatestFrontendBootstrapPacketRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk o request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildFrontendBootstrapPacket(
    request: QuantumFrontendBootstrapPacketRequest,
  ): OpenPraQuantumFrontendBootstrapPacketResult {
    return buildOpenPraQuantumFrontendBootstrapPacket(request);
  }

  loadLatestFrontendBootstrapPacket(
    request: QuantumLoadLatestFrontendBootstrapPacketRequest,
  ): OpenPraQuantumFrontendBootstrapPacketLoadResult {
    return loadLatestOpenPraQuantumFrontendBootstrapPacket(request);
  }

""",
        "service chunk o methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumFrontendSeedStateResult,\n",
        "  OpenPraQuantumFrontendBootstrapPacketLoadResult,\n  OpenPraQuantumFrontendBootstrapPacketResult,\n",
        "controller chunk o result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestFrontendSeedStateRequest,\n",
        "  type QuantumFrontendBootstrapPacketRequest,\n  type QuantumLoadLatestFrontendBootstrapPacketRequest,\n",
        "controller chunk o service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumFrontendBootstrapPacketRequestBody
  extends QuantumFrontendBootstrapPacketRequest {}

export interface QuantumLoadLatestFrontendBootstrapPacketRequestBody
  extends QuantumLoadLatestFrontendBootstrapPacketRequest {}

""",
        "controller chunk o request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/frontend-bootstrap-packet")
  @HttpCode(HttpStatus.OK)
  buildFrontendBootstrapPacket(
    @Body() body: QuantumFrontendBootstrapPacketRequestBody,
  ): OpenPraQuantumFrontendBootstrapPacketResult {
    try {
      return this.quantumReadinessService.buildFrontendBootstrapPacket(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/frontend-bootstrap-packet/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestFrontendBootstrapPacket(
    @Body() body: QuantumLoadLatestFrontendBootstrapPacketRequestBody,
  ): OpenPraQuantumFrontendBootstrapPacketLoadResult {
    try {
      return this.quantumReadinessService.loadLatestFrontendBootstrapPacket(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk o methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendBootstrapPacket.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend bootstrap packet", () => {
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

  it("builds and loads the frontend bootstrap packet", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-bootstrap-service-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const workspaceRoot = path.join(tempDir, "workspace_snapshot");
    const packetRoot = path.join(tempDir, "bootstrap_packet");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
          readyForFrontend: true,
          readinessStatus: "ready",
          badge: {
            label: "Frontend ready",
            tone: "success",
          },
          widgets: [
            {
              id: "readiness",
              title: "Frontend readiness",
              value: "Ready",
              subtitle: "3 tracked cases",
              status: "ready",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              value: "3 cases",
              subtitle: "All bounded checks matched",
              status: "complete",
              notes: ["Operator attention count: 0"],
            },
          ],
          caseTableRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              displayStatus: "partial",
              showInFrontend: true,
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
    )

    fs.writeFileSync(
      path.join(workspaceRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceRoot,
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
    )

    const built = service.buildFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
      scriptVersion: "quantumReadiness.frontendBootstrapPacket.service.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(built.summary.headerBadgeLabel).toBe("Frontend ready")
    expect(built.summary.nav).toHaveLength(3)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = service.loadLatestFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
    })

    expect(loaded.summary.caseRowCount).toBe(3)
    expect(loaded.summary.readyCaseCount).toBe(2)
  })
})
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendBootstrapPacket.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController frontend bootstrap packet", () => {
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

  it("builds and loads the frontend bootstrap packet through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-bootstrap-controller-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const workspaceRoot = path.join(tempDir, "workspace_snapshot");
    const packetRoot = path.join(tempDir, "bootstrap_packet");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
          readyForFrontend: true,
          readinessStatus: "ready",
          badge: {
            label: "Frontend ready",
            tone: "success",
          },
          widgets: [
            {
              id: "readiness",
              title: "Frontend readiness",
              value: "Ready",
              subtitle: "3 tracked cases",
              status: "ready",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              value: "3 cases",
              subtitle: "All bounded checks matched",
              status: "complete",
              notes: ["Operator attention count: 0"],
            },
          ],
          caseTableRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              displayStatus: "partial",
              showInFrontend: true,
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
    )

    fs.writeFileSync(
      path.join(workspaceRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceRoot,
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
    )

    const built = controller.buildFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
      scriptVersion: "quantumReadiness.frontendBootstrapPacket.controller.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = controller.loadLatestFrontendBootstrapPacket({
      rootDirectoryPath: packetRoot,
    })

    expect(loaded.summary.headerBadgeLabel).toBe("Frontend ready")
    expect(loaded.summary.nav).toHaveLength(3)
  })
})
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.frontendBootstrapPacket.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendBootstrapPacket.http", () => {
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

  it("builds and loads the frontend bootstrap packet through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-bootstrap-http-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const workspaceRoot = path.join(tempDir, "workspace_snapshot");
    const packetRoot = path.join(tempDir, "bootstrap_packet");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
          readyForFrontend: true,
          readinessStatus: "ready",
          badge: {
            label: "Frontend ready",
            tone: "success",
          },
          widgets: [
            {
              id: "readiness",
              title: "Frontend readiness",
              value: "Ready",
              subtitle: "3 tracked cases",
              status: "ready",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              value: "3 cases",
              subtitle: "All bounded checks matched",
              status: "complete",
              notes: ["Operator attention count: 0"],
            },
          ],
          caseTableRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              displayStatus: "partial",
              showInFrontend: true,
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
    )

    fs.writeFileSync(
      path.join(workspaceRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceRoot,
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
    )

    const built = await request(app.getHttpServer())
      .post("/frontend-bootstrap-packet")
      .send({
        rootDirectoryPath: packetRoot,
        frontendSeedStateRootDirectoryPath: seedRoot,
        frontendWorkspaceSnapshotRootDirectoryPath: workspaceRoot,
        scriptVersion: "quantumReadiness.frontendBootstrapPacket.http.spec",
      })
      .expect(200)

    expect(built.body.summary.readyForFrontend).toBe(true)
    expect(built.body.summary.headerBadgeLabel).toBe("Frontend ready")
    expect(fs.existsSync(built.body.summaryPath)).toBe(true)

    const loaded = await request(app.getHttpServer())
      .post("/frontend-bootstrap-packet/load-latest")
      .send({
        rootDirectoryPath: packetRoot,
      })
      .expect(200)

    expect(loaded.body.summary.widgetCount).toBe(2)
    expect(loaded.body.summary.caseRowCount).toBe(3)
    expect(loaded.body.summary.nav).toHaveLength(3)
  })
})
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_frontend_bootstrap_packet_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_frontend_bootstrap_packet_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_FRONTEND_BOOTSTRAP_PACKET_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-frontend-bootstrap-packet.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendBootstrapPacket.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendBootstrapPacket.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.frontendBootstrapPacket.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_FRONTEND_BOOTSTRAP_PACKET_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/frontend-bootstrap-packet",
        "/frontend-bootstrap-packet/load-latest",
    ],
    "interpretation": (
        "Chunk O adds a frontend bootstrap packet derived from the seed state "
        "and workspace snapshot for direct UI initialization."
    ),
}

(run_dir / "notes" / "openpra_quantum_frontend_bootstrap_packet_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Frontend Bootstrap Packet Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /frontend-bootstrap-packet
- /frontend-bootstrap-packet/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_FRONTEND_BOOTSTRAP_PACKET_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied frontend bootstrap packet chunk O successfully.")


if __name__ == "__main__":
    main()

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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-dashboard-payload.ts",
        """import * as fs from "node:fs";
import * as path from "node:path";

import {
  loadLatestOpenPraQuantumFrontendBootstrapPacket,
  type OpenPraQuantumFrontendBootstrapPacketLoadResult,
} from "./openpra-quantum-frontend-bootstrap-packet";
import {
  loadLatestOpenPraQuantumFrontendSeedState,
  type OpenPraQuantumFrontendSeedStateLoadResult,
} from "./openpra-quantum-frontend-seed-state";

export interface OpenPraQuantumFrontendDashboardPayloadRequest {
  rootDirectoryPath: string;
  frontendBootstrapPacketRootDirectoryPath: string;
  frontendSeedStateRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumFrontendDashboardHeader {
  title: string;
  subtitle: string;
  badgeLabel: string;
  readinessStatus: "ready" | "blocked";
}

export interface OpenPraQuantumFrontendDashboardWidget {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  status: "ready" | "blocked" | "complete" | "partial";
  notes: string[];
}

export interface OpenPraQuantumFrontendDashboardCaseRow {
  caseLabel: string;
  topologyClass: string | null;
  displayStatus: "ready" | "blocked" | "partial";
  showInFrontend: boolean;
  boundednessMatches: boolean | null;
  ws6ExecutionStatus: string | null;
  ws6HasResult: boolean | null;
}

export interface OpenPraQuantumFrontendDashboardPayloadSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  frontendBootstrapPacketRootDirectoryPath: string;
  frontendSeedStateRootDirectoryPath: string;
  readyForFrontend: boolean;
  readinessStatus: "ready" | "blocked";
  header: OpenPraQuantumFrontendDashboardHeader;
  nav: Array<{
    id: string;
    label: string;
    enabled: boolean;
    count: number | null;
  }>;
  widgets: OpenPraQuantumFrontendDashboardWidget[];
  caseRows: OpenPraQuantumFrontendDashboardCaseRow[];
  totals: {
    widgetCount: number;
    caseRowCount: number;
    readyCaseCount: number;
    partialCaseCount: number;
    blockedCaseCount: number;
  };
}

export interface OpenPraQuantumFrontendDashboardPayloadResult {
  frontendBootstrapPacket: OpenPraQuantumFrontendBootstrapPacketLoadResult;
  frontendSeedState: OpenPraQuantumFrontendSeedStateLoadResult;
  summary: OpenPraQuantumFrontendDashboardPayloadSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumFrontendDashboardPayloadLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumFrontendDashboardPayloadLoadResult {
  summary: OpenPraQuantumFrontendDashboardPayloadSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumFrontendDashboardPayload(
  request: OpenPraQuantumFrontendDashboardPayloadRequest,
): OpenPraQuantumFrontendDashboardPayloadResult {
  const scriptVersion =
    request.scriptVersion ?? "openpra-quantum-frontend-dashboard-payload-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendBootstrapPacket = loadLatestOpenPraQuantumFrontendBootstrapPacket({
    rootDirectoryPath: request.frontendBootstrapPacketRootDirectoryPath,
  });

  const frontendSeedState = loadLatestOpenPraQuantumFrontendSeedState({
    rootDirectoryPath: request.frontendSeedStateRootDirectoryPath,
  });

  const summary: OpenPraQuantumFrontendDashboardPayloadSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    frontendBootstrapPacketRootDirectoryPath:
      request.frontendBootstrapPacketRootDirectoryPath,
    frontendSeedStateRootDirectoryPath:
      request.frontendSeedStateRootDirectoryPath,
    readyForFrontend: frontendBootstrapPacket.summary.readyForFrontend,
    readinessStatus: frontendBootstrapPacket.summary.readinessStatus,
    header: {
      title: "OpenPRA quantum readiness",
      subtitle: `${frontendBootstrapPacket.summary.caseRowCount} frontend case rows`,
      badgeLabel: frontendBootstrapPacket.summary.headerBadgeLabel,
      readinessStatus: frontendBootstrapPacket.summary.readinessStatus,
    },
    nav: frontendBootstrapPacket.summary.nav,
    widgets: frontendSeedState.summary.widgets.map((widget) => ({
      id: widget.id,
      title: widget.title,
      value: widget.value,
      subtitle: widget.subtitle,
      status: widget.status,
      notes: widget.notes,
    })),
    caseRows: frontendSeedState.summary.caseTableRows.map((row) => ({
      caseLabel: row.caseLabel,
      topologyClass: row.topologyClass,
      displayStatus: row.displayStatus,
      showInFrontend: row.showInFrontend,
      boundednessMatches: row.boundednessMatches,
      ws6ExecutionStatus: row.ws6ExecutionStatus,
      ws6HasResult: row.ws6HasResult,
    })),
    totals: {
      widgetCount: frontendBootstrapPacket.summary.widgetCount,
      caseRowCount: frontendBootstrapPacket.summary.caseRowCount,
      readyCaseCount: frontendBootstrapPacket.summary.readyCaseCount,
      partialCaseCount: frontendBootstrapPacket.summary.partialCaseCount,
      blockedCaseCount: frontendBootstrapPacket.summary.blockedCaseCount,
    },
  };

  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_dashboard_payload_summary_v1.json",
  );
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_dashboard_payload_manifest_v1.json",
  );

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_frontend_dashboard_payload_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    readyForFrontend: summary.readyForFrontend,
    readinessStatus: summary.readinessStatus,
    widgetCount: summary.totals.widgetCount,
    caseRowCount: summary.totals.caseRowCount,
  });

  return {
    frontendBootstrapPacket,
    frontendSeedState,
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumFrontendDashboardPayload(
  request: OpenPraQuantumFrontendDashboardPayloadLoadRequest,
): OpenPraQuantumFrontendDashboardPayloadLoadResult {
  const summaryPath = path.join(
    request.rootDirectoryPath,
    "frontend_dashboard_payload_summary_v1.json",
  );

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend dashboard payload found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendDashboardPayloadSummary;
  const manifestPath = path.join(
    request.rootDirectoryPath,
    "frontend_dashboard_payload_manifest_v1.json",
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
        "packages/quantum-readiness/src/lib/openpra-quantum-frontend-dashboard-payload.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildOpenPraQuantumFrontendDashboardPayload,
  loadLatestOpenPraQuantumFrontendDashboardPayload,
} from "./openpra-quantum-frontend-dashboard-payload";

describe("openpra-quantum-frontend-dashboard-payload", () => {
  it("builds and loads the frontend dashboard payload", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-dashboard-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const bootstrapRoot = path.join(tempDir, "bootstrap_packet");
    const dashboardRoot = path.join(tempDir, "dashboard_payload");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(bootstrapRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:10:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
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
      path.join(bootstrapRoot, "frontend_bootstrap_packet_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:05:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: bootstrapRoot,
          frontendSeedStateRootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          headerBadgeLabel: "Frontend ready",
          widgetCount: 2,
          caseRowCount: 3,
          nav: [
            {
              id: "overview",
              label: "Overview",
              enabled: true,
              count: 2,
            },
            {
              id: "cases",
              label: "Cases",
              enabled: true,
              count: 3,
            },
            {
              id: "workspace",
              label: "Workspace",
              enabled: true,
              count: 2,
            },
          ],
          widgetTitles: ["Frontend readiness", "WS5 bounded coverage"],
          readyCaseCount: 2,
          partialCaseCount: 1,
          blockedCaseCount: 0,
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = buildOpenPraQuantumFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
      frontendBootstrapPacketRootDirectoryPath: bootstrapRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      scriptVersion: "openpra-quantum-frontend-dashboard-payload.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(built.summary.header.badgeLabel).toBe("Frontend ready")
    expect(built.summary.widgets).toHaveLength(2)
    expect(built.summary.caseRows).toHaveLength(3)
    expect(built.summary.totals.readyCaseCount).toBe(2)
    expect(fs.existsSync(built.summaryPath)).toBe(true)
    expect(fs.existsSync(built.manifestPath)).toBe(true)

    const loaded = loadLatestOpenPraQuantumFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
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
        'export * from "./openpra-quantum-frontend-bootstrap-packet";\n',
        'export * from "./openpra-quantum-frontend-dashboard-payload";\n',
        "index chunk p export",
    )
    write_text(index_rel, index_text)

    service_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
    service_text = read_text(service_rel)

    service_text = insert_after(
        service_text,
        "  loadLatestOpenPraQuantumFrontendBootstrapPacket,\n",
        "  buildOpenPraQuantumFrontendDashboardPayload,\n  loadLatestOpenPraQuantumFrontendDashboardPayload,\n",
        "service chunk p import functions",
    )
    service_text = insert_after(
        service_text,
        "  type OpenPraQuantumFrontendBootstrapPacketResult,\n",
        "  type OpenPraQuantumFrontendDashboardPayloadLoadResult,\n  type OpenPraQuantumFrontendDashboardPayloadRequest,\n  type OpenPraQuantumFrontendDashboardPayloadResult,\n",
        "service chunk p import types",
    )
    service_text = insert_before(
        service_text,
        "export interface QuantumImportanceComparisonRequest {\n",
        """export type QuantumFrontendDashboardPayloadRequest =
  OpenPraQuantumFrontendDashboardPayloadRequest;

export interface QuantumLoadLatestFrontendDashboardPayloadRequest {
  rootDirectoryPath: string;
}

""",
        "service chunk p request aliases",
    )
    service_text = insert_before(
        service_text,
        "  compareImportanceMeasures(request: QuantumImportanceComparisonRequest): QuantumImportanceComparisonResult {\n",
        """  buildFrontendDashboardPayload(
    request: QuantumFrontendDashboardPayloadRequest,
  ): OpenPraQuantumFrontendDashboardPayloadResult {
    return buildOpenPraQuantumFrontendDashboardPayload(request);
  }

  loadLatestFrontendDashboardPayload(
    request: QuantumLoadLatestFrontendDashboardPayloadRequest,
  ): OpenPraQuantumFrontendDashboardPayloadLoadResult {
    return loadLatestOpenPraQuantumFrontendDashboardPayload(request);
  }

""",
        "service chunk p methods",
    )
    write_text(service_rel, service_text)

    controller_rel = "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
    controller_text = read_text(controller_rel)

    controller_text = insert_after(
        controller_text,
        "  OpenPraQuantumFrontendBootstrapPacketResult,\n",
        "  OpenPraQuantumFrontendDashboardPayloadLoadResult,\n  OpenPraQuantumFrontendDashboardPayloadResult,\n",
        "controller chunk p result types",
    )
    controller_text = insert_after(
        controller_text,
        "  type QuantumLoadLatestFrontendBootstrapPacketRequest,\n",
        "  type QuantumFrontendDashboardPayloadRequest,\n  type QuantumLoadLatestFrontendDashboardPayloadRequest,\n",
        "controller chunk p service types",
    )
    controller_text = insert_before(
        controller_text,
        "export interface QuantumRecoveryCandidateDirRequest {\n",
        """export interface QuantumFrontendDashboardPayloadRequestBody
  extends QuantumFrontendDashboardPayloadRequest {}

export interface QuantumLoadLatestFrontendDashboardPayloadRequestBody
  extends QuantumLoadLatestFrontendDashboardPayloadRequest {}

""",
        "controller chunk p request bodies",
    )
    controller_text = insert_before(
        controller_text,
        '  @Post("/importance/compare/write/by-kind")\n',
        """  @Post("/frontend-dashboard-payload")
  @HttpCode(HttpStatus.OK)
  buildFrontendDashboardPayload(
    @Body() body: QuantumFrontendDashboardPayloadRequestBody,
  ): OpenPraQuantumFrontendDashboardPayloadResult {
    try {
      return this.quantumReadinessService.buildFrontendDashboardPayload(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/frontend-dashboard-payload/load-latest")
  @HttpCode(HttpStatus.OK)
  loadLatestFrontendDashboardPayload(
    @Body() body: QuantumLoadLatestFrontendDashboardPayloadRequestBody,
  ): OpenPraQuantumFrontendDashboardPayloadLoadResult {
    try {
      return this.quantumReadinessService.loadLatestFrontendDashboardPayload(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

""",
        "controller chunk p methods",
    )
    write_text(controller_rel, controller_text)

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendDashboardPayload.service.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService frontend dashboard payload", () => {
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

  it("builds and loads the frontend dashboard payload", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-dashboard-service-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const bootstrapRoot = path.join(tempDir, "bootstrap_packet");
    const dashboardRoot = path.join(tempDir, "dashboard_payload");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(bootstrapRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:10:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
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
      path.join(bootstrapRoot, "frontend_bootstrap_packet_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:05:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: bootstrapRoot,
          frontendSeedStateRootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          headerBadgeLabel: "Frontend ready",
          widgetCount: 2,
          caseRowCount: 3,
          nav: [
            {
              id: "overview",
              label: "Overview",
              enabled: true,
              count: 2,
            },
            {
              id: "cases",
              label: "Cases",
              enabled: true,
              count: 3,
            },
            {
              id: "workspace",
              label: "Workspace",
              enabled: true,
              count: 2,
            },
          ],
          widgetTitles: ["Frontend readiness", "WS5 bounded coverage"],
          readyCaseCount: 2,
          partialCaseCount: 1,
          blockedCaseCount: 0,
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = service.buildFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
      frontendBootstrapPacketRootDirectoryPath: bootstrapRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      scriptVersion: "quantumReadiness.frontendDashboardPayload.service.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(built.summary.header.badgeLabel).toBe("Frontend ready")
    expect(built.summary.totals.partialCaseCount).toBe(1)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = service.loadLatestFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
    })

    expect(loaded.summary.widgetCount).toBeUndefined()
    expect(loaded.summary.totals.widgetCount).toBe(2)
    expect(loaded.summary.caseRows).toHaveLength(3)
  })
})
""",
    )

    write_text(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendDashboardPayload.controller.spec.ts",
        """import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController frontend dashboard payload", () => {
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

  it("builds and loads the frontend dashboard payload through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-dashboard-controller-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const bootstrapRoot = path.join(tempDir, "bootstrap_packet");
    const dashboardRoot = path.join(tempDir, "dashboard_payload");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(bootstrapRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:10:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
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
      path.join(bootstrapRoot, "frontend_bootstrap_packet_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:05:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: bootstrapRoot,
          frontendSeedStateRootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          headerBadgeLabel: "Frontend ready",
          widgetCount: 2,
          caseRowCount: 3,
          nav: [
            {
              id: "overview",
              label: "Overview",
              enabled: true,
              count: 2,
            },
            {
              id: "cases",
              label: "Cases",
              enabled: true,
              count: 3,
            },
            {
              id: "workspace",
              label: "Workspace",
              enabled: true,
              count: 2,
            },
          ],
          widgetTitles: ["Frontend readiness", "WS5 bounded coverage"],
          readyCaseCount: 2,
          partialCaseCount: 1,
          blockedCaseCount: 0,
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = controller.buildFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
      frontendBootstrapPacketRootDirectoryPath: bootstrapRoot,
      frontendSeedStateRootDirectoryPath: seedRoot,
      scriptVersion: "quantumReadiness.frontendDashboardPayload.controller.spec",
    })

    expect(built.summary.readyForFrontend).toBe(true)
    expect(fs.existsSync(built.summaryPath)).toBe(true)

    const loaded = controller.loadLatestFrontendDashboardPayload({
      rootDirectoryPath: dashboardRoot,
    })

    expect(loaded.summary.header.badgeLabel).toBe("Frontend ready")
    expect(loaded.summary.nav).toHaveLength(3)
  })
})
""",
    )

    write_text(
        "packages/web-backend/tests/quantumReadiness.frontendDashboardPayload.http.spec.ts",
        """import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendDashboardPayload.http", () => {
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

  it("builds and loads the frontend dashboard payload through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-dashboard-http-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const bootstrapRoot = path.join(tempDir, "bootstrap_packet");
    const dashboardRoot = path.join(tempDir, "dashboard_payload");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(bootstrapRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:10:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
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
      path.join(bootstrapRoot, "frontend_bootstrap_packet_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:05:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: bootstrapRoot,
          frontendSeedStateRootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          headerBadgeLabel: "Frontend ready",
          widgetCount: 2,
          caseRowCount: 3,
          nav: [
            {
              id: "overview",
              label: "Overview",
              enabled: true,
              count: 2,
            },
            {
              id: "cases",
              label: "Cases",
              enabled: true,
              count: 3,
            },
            {
              id: "workspace",
              label: "Workspace",
              enabled: true,
              count: 2,
            },
          ],
          widgetTitles: ["Frontend readiness", "WS5 bounded coverage"],
          readyCaseCount: 2,
          partialCaseCount: 1,
          blockedCaseCount: 0,
        },
        null,
        2,
      ) + "\\n",
      encoding="utf8",
    )

    const built = await request(app.getHttpServer())
      .post("/frontend-dashboard-payload")
      .send({
        rootDirectoryPath: dashboardRoot,
        frontendBootstrapPacketRootDirectoryPath: bootstrapRoot,
        frontendSeedStateRootDirectoryPath: seedRoot,
        scriptVersion: "quantumReadiness.frontendDashboardPayload.http.spec",
      })
      .expect(200)

    expect(built.body.summary.readyForFrontend).toBe(true)
    expect(built.body.summary.header.badgeLabel).toBe("Frontend ready")
    expect(fs.existsSync(built.body.summaryPath)).toBe(true)

    const loaded = await request(app.getHttpServer())
      .post("/frontend-dashboard-payload/load-latest")
      .send({
        rootDirectoryPath: dashboardRoot,
      })
      .expect(200)

    expect(loaded.body.summary.totals.widgetCount).toBe(2)
    expect(loaded.body.summary.totals.caseRowCount).toBe(3)
    expect(loaded.body.summary.nav).toHaveLength(3)
  })
})
""",
    )

    write_text(
        "tools/quantum_integration/openpra_quantum_build_frontend_dashboard_payload_checkpoint_v1.sh",
        """#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_frontend_dashboard_payload_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_FRONTEND_DASHBOARD_PAYLOAD_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-frontend-dashboard-payload.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendDashboardPayload.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.frontendDashboardPayload.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.frontendDashboardPayload.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_FRONTEND_DASHBOARD_PAYLOAD_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/frontend-dashboard-payload",
        "/frontend-dashboard-payload/load-latest",
    ],
    "interpretation": (
        "Chunk P adds a frontend dashboard payload derived from the bootstrap "
        "packet and seed state for direct screen rendering."
    ),
}

(run_dir / "notes" / "openpra_quantum_frontend_dashboard_payload_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\\n",
    encoding="utf-8",
)

memo = f\"\"\"OpenPRA Quantum Frontend Dashboard Payload Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /frontend-dashboard-payload
- /frontend-dashboard-payload/load-latest

Interpretation
{summary["interpretation"]}
\"\"\"

(run_dir / "notes" / "OPENPRA_QUANTUM_FRONTEND_DASHBOARD_PAYLOAD_CHECKPOINT_MEMO_v1.txt").write_text(
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

    print("Applied frontend dashboard payload chunk P successfully.")


if __name__ == "__main__":
    main()

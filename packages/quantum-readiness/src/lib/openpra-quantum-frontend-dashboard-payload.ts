import * as fs from "node:fs";
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-frontend-dashboard-payload-v1";

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
    frontendBootstrapPacketRootDirectoryPath: request.frontendBootstrapPacketRootDirectoryPath,
    frontendSeedStateRootDirectoryPath: request.frontendSeedStateRootDirectoryPath,
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

  const summaryPath = path.join(request.rootDirectoryPath, "frontend_dashboard_payload_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_dashboard_payload_manifest_v1.json");

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
  const summaryPath = path.join(request.rootDirectoryPath, "frontend_dashboard_payload_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend dashboard payload found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendDashboardPayloadSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_dashboard_payload_manifest_v1.json");
  const manifest = fs.existsSync(manifestPath) ? (readJson(manifestPath) as Record<string, unknown>) : null;

  return {
    summary,
    summaryPath,
    manifest,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

import * as fs from "node:fs";
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

export const OPENPRA_QUANTUM_FRONTEND_BOOTSTRAP_PACKET_BOUNDEDNESS_STATEMENT =
  "Screening level bounded integration review only. This payload does not imply unrestricted production readiness, comparative benefit, or claims beyond the documented project scope.";

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
  boundednessStatement: string;
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-frontend-bootstrap-packet-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendSeedState = loadLatestOpenPraQuantumFrontendSeedState({
    rootDirectoryPath: request.frontendSeedStateRootDirectoryPath,
  });

  const frontendWorkspaceSnapshot = loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
    rootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
  });

  const readyCaseCount = frontendSeedState.summary.caseTableRows.filter((row) => row.displayStatus === "ready").length;
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
    frontendSeedStateRootDirectoryPath: request.frontendSeedStateRootDirectoryPath,
    frontendWorkspaceSnapshotRootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
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
    boundednessStatement: OPENPRA_QUANTUM_FRONTEND_BOOTSTRAP_PACKET_BOUNDEDNESS_STATEMENT,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "frontend_bootstrap_packet_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_bootstrap_packet_manifest_v1.json");

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
    boundednessStatement: summary.boundednessStatement,
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
  const summaryPath = path.join(request.rootDirectoryPath, "frontend_bootstrap_packet_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend bootstrap packet found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendBootstrapPacketSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_bootstrap_packet_manifest_v1.json");
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

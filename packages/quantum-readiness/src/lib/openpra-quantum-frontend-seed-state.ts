import * as fs from "node:fs";
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-frontend-seed-state-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendWorkspaceSnapshot = loadLatestOpenPraQuantumFrontendWorkspaceSnapshot({
    rootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
  });

  const badge: OpenPraQuantumFrontendSeedBadge =
    frontendWorkspaceSnapshot.summary.readyForFrontend ?
      {
        label: "Frontend ready",
        tone: "success",
      }
    : {
        label: "Frontend blocked",
        tone: "warning",
      };

  const widgets: OpenPraQuantumFrontendSeedWidget[] = frontendWorkspaceSnapshot.summary.cards.map((card) => ({
    id: card.id,
    title: card.title,
    value: card.primaryValue,
    subtitle: card.secondaryValue,
    status: card.status,
    notes: card.notes,
  }));

  const caseTableRows: OpenPraQuantumFrontendSeedCaseTableRow[] = frontendWorkspaceSnapshot.summary.caseRows.map(
    (row) => ({
      caseLabel: row.caseLabel,
      topologyClass: row.topologyClass,
      displayStatus:
        row.showInFrontend && row.boundednessMatches !== false ? "ready"
        : row.inWs5BoundedReport || row.inWs6ExecutionReport ? "partial"
        : "blocked",
      showInFrontend: row.showInFrontend,
      boundednessMatches: row.boundednessMatches,
      ws6ExecutionStatus: row.ws6ExecutionStatus,
      ws6HasResult: row.ws6HasResult,
    }),
  );

  const summary: OpenPraQuantumFrontendSeedStateSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    frontendWorkspaceSnapshotRootDirectoryPath: request.frontendWorkspaceSnapshotRootDirectoryPath,
    readyForFrontend: frontendWorkspaceSnapshot.summary.readyForFrontend,
    readinessStatus: frontendWorkspaceSnapshot.summary.readinessStatus,
    badge,
    widgets,
    caseTableRows,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "frontend_seed_state_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_seed_state_manifest_v1.json");

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
  const summaryPath = path.join(request.rootDirectoryPath, "frontend_seed_state_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend seed state found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendSeedStateSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_seed_state_manifest_v1.json");
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

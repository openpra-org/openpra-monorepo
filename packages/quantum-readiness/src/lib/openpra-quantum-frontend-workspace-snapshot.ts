import * as fs from "node:fs";
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-frontend-workspace-snapshot-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const frontendSummary = loadLatestOpenPraQuantumFrontendSummary({
    rootDirectoryPath: request.frontendSummaryRootDirectoryPath,
  });

  const canonicalProgramReport = loadLatestOpenPraQuantumCanonicalProgramReport({
    rootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
  });

  const topologyCounts = canonicalProgramReport.summary.rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.topologyClass ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

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
      secondaryValue:
        frontendSummary.summary.ws5CoverageComplete ? "All bounded checks matched" : "Bounded checks incomplete",
      notes: [`Operator attention count: ${frontendSummary.summary.operatorAttentionCount}`],
    },
    {
      id: "ws6",
      title: "WS6 execution coverage",
      status: frontendSummary.summary.ws6CoverageComplete ? "complete" : "partial",
      primaryValue: `${frontendSummary.summary.totalWs6Cases} cases`,
      secondaryValue:
        frontendSummary.summary.ws6CoverageComplete ?
          "All execution cases completed"
        : "Execution cases still incomplete",
      notes: [`Missing result count: ${frontendSummary.summary.ws6MissingResultCount}`],
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

  const caseRows: OpenPraQuantumFrontendWorkspaceSnapshotCaseRow[] = frontendSummary.summary.caseRows.map((row) => ({
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
    canonicalProgramReportRootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
    readyForFrontend: frontendSummary.summary.readyForFrontend,
    readinessStatus: frontendSummary.summary.readinessStatus,
    cards,
    caseRows,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "frontend_workspace_snapshot_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_workspace_snapshot_manifest_v1.json");

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
  const summaryPath = path.join(request.rootDirectoryPath, "frontend_workspace_snapshot_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No frontend workspace snapshot found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumFrontendWorkspaceSnapshotSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_workspace_snapshot_manifest_v1.json");
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

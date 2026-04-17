import * as fs from "node:fs";
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-frontend-summary-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const canonicalProgramReport = loadLatestOpenPraQuantumCanonicalProgramReport({
    rootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
  });

  const summary: OpenPraQuantumFrontendSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    canonicalProgramReportRootDirectoryPath: request.canonicalProgramReportRootDirectoryPath,
    readinessStatus: canonicalProgramReport.summary.readyForFrontend ? "ready" : "blocked",
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
      showInFrontend: row.inWs5BoundedReport && (row.inWs6ExecutionReport ? row.ws6HasResult === true : true),
    })),
  };

  const summaryPath = path.join(request.rootDirectoryPath, "frontend_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_summary_manifest_v1.json");

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
  const manifestPath = path.join(request.rootDirectoryPath, "frontend_summary_manifest_v1.json");
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

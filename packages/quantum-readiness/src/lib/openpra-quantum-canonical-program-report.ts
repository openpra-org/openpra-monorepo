import * as fs from "node:fs";
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
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-canonical-program-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const boundedReport = loadLatestOpenPraQuantumCanonicalBoundedReport({
    rootDirectoryPath: request.boundedReportRootDirectoryPath,
  });

  const ws6ExecutionReport = loadLatestOpenPraQuantumWs6CanonicalExecutionReport({
    rootDirectoryPath: request.ws6ExecutionReportRootDirectoryPath,
  });

  const boundedRowsByCaseLabel = new Map(boundedReport.summary.rows.map((row) => [row.caseLabel, row]));
  const executionRowsByCaseLabel = new Map(ws6ExecutionReport.summary.rows.map((row) => [row.caseLabel, row]));

  const unionCaseLabels = Array.from(
    new Set([...boundedReport.summary.caseLabels, ...ws6ExecutionReport.summary.caseLabels]),
  ).sort();

  const rows: OpenPraQuantumCanonicalProgramReportRow[] = unionCaseLabels.map((caseLabel) => {
    const boundedRow = boundedRowsByCaseLabel.get(caseLabel);
    const executionRow = executionRowsByCaseLabel.get(caseLabel);

    return {
      caseLabel,
      topologyClass: boundedRow?.topologyClass ?? executionRow?.topologyClass ?? null,
      inWs5BoundedReport: Boolean(boundedRow),
      inWs6ExecutionReport: Boolean(executionRow),
      boundednessMatches: boundedRow?.boundednessMatches ?? null,
      ws6ExecutionStatus: executionRow?.executionStatus ?? null,
      ws6HasResult: executionRow?.hasExecutionResult ?? null,
    };
  });

  const summary: OpenPraQuantumCanonicalProgramReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    boundedReportRootDirectoryPath: request.boundedReportRootDirectoryPath,
    ws6ExecutionReportRootDirectoryPath: request.ws6ExecutionReportRootDirectoryPath,
    ws5CaseLabels: boundedReport.summary.caseLabels,
    ws6CaseLabels: ws6ExecutionReport.summary.caseLabels,
    unionCaseLabels,
    totalWs5Cases: boundedReport.summary.totalCases,
    totalWs6Cases: ws6ExecutionReport.summary.totalCases,
    totalUnionCases: unionCaseLabels.length,
    boundednessAllMatch: boundedReport.summary.boundednessAllMatch,
    ws6AllCompleted: ws6ExecutionReport.summary.allCompleted,
    readyForFrontend: boundedReport.summary.boundednessAllMatch && ws6ExecutionReport.summary.allCompleted,
    operatorAttentionCount: boundedReport.summary.operatorAttentionCount,
    ws6MissingResultCount: ws6ExecutionReport.summary.missingResultCount,
    rows,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "canonical_program_report_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_program_report_manifest_v1.json");

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_canonical_program_report_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    boundedReportRootDirectoryPath: request.boundedReportRootDirectoryPath,
    ws6ExecutionReportRootDirectoryPath: request.ws6ExecutionReportRootDirectoryPath,
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
  const summaryPath = path.join(request.rootDirectoryPath, "canonical_program_report_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical program report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalProgramReportSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_program_report_manifest_v1.json");
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

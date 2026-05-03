import * as fs from "node:fs";
import * as path from "node:path";

import { getOpenPraQuantumCanonicalCasePackSummary } from "./openpra-quantum-canonical-case-pack";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

export interface OpenPraQuantumWs6CanonicalExecutionReportRequest {
  rootDirectoryPath: string;
  sourceExecutionArtifactsRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportRow {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  jobId: string;
  executionStatus: string;
  resultStatus: string | null;
  hasExecutionResult: boolean;
  rawCountsArtifactPath: string | null;
  recoveryArtifactPath: string | null;
  provenanceManifestPath: string | null;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  sourceExecutionArtifactsRootDirectoryPath: string;
  caseLabels: string[];
  topologyCounts: Record<string, number>;
  totalCases: number;
  completedCount: number;
  failedCount: number;
  missingResultCount: number;
  allCompleted: boolean;
  rows: OpenPraQuantumWs6CanonicalExecutionReportRow[];
}

export interface OpenPraQuantumWs6CanonicalExecutionReportResult {
  summary: OpenPraQuantumWs6CanonicalExecutionReportSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
  summary: OpenPraQuantumWs6CanonicalExecutionReportSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumWs6CanonicalExecutionReport(
  request: OpenPraQuantumWs6CanonicalExecutionReportRequest,
): OpenPraQuantumWs6CanonicalExecutionReportResult {
  const canonical = getOpenPraQuantumCanonicalCasePackSummary();
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-ws6-canonical-execution-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const rows: OpenPraQuantumWs6CanonicalExecutionReportRow[] = canonical.ws6AcceptanceCases.map((caseEntry) => {
    const loaded = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: request.sourceExecutionArtifactsRootDirectoryPath,
      caseLabel: caseEntry.caseLabel,
    });

    if (loaded.executionRecord.caseLabel !== caseEntry.caseLabel) {
      throw new Error(`Case label mismatch for ${caseEntry.caseLabel}.`);
    }
    if (loaded.executionRecord.subtreeId !== caseEntry.subtreeId) {
      throw new Error(`Subtree mismatch for ${caseEntry.caseLabel}.`);
    }

    return {
      caseLabel: caseEntry.caseLabel,
      subtreeId: caseEntry.subtreeId,
      topologyClass: caseEntry.topologyClass,
      jobId: loaded.executionRecord.jobId,
      executionStatus: loaded.executionRecord.status,
      resultStatus: loaded.executionResult?.status ?? null,
      hasExecutionResult: loaded.executionResult !== null,
      rawCountsArtifactPath: loaded.executionResult?.rawCountsArtifactPath ?? null,
      recoveryArtifactPath: loaded.executionResult?.recoveryArtifactPath ?? null,
      provenanceManifestPath: loaded.provenanceManifestPath,
    };
  });

  const topologyCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.topologyClass] = (acc[row.topologyClass] ?? 0) + 1;
    return acc;
  }, {});

  const summary: OpenPraQuantumWs6CanonicalExecutionReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    sourceExecutionArtifactsRootDirectoryPath: request.sourceExecutionArtifactsRootDirectoryPath,
    caseLabels: rows.map((row) => row.caseLabel),
    topologyCounts,
    totalCases: rows.length,
    completedCount: rows.filter((row) => row.executionStatus === "completed").length,
    failedCount: rows.filter((row) => row.executionStatus === "failed").length,
    missingResultCount: rows.filter((row) => !row.hasExecutionResult).length,
    allCompleted: rows.every((row) => row.executionStatus === "completed" && row.hasExecutionResult),
    rows,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "ws6_canonical_execution_report_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "ws6_canonical_execution_report_manifest_v1.json");

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_ws6_canonical_execution_report_manifest",
    generatedAtUtc: summary.generatedAtUtc,
    scriptVersion,
    summaryPath,
    manifestPath,
    caseLabels: summary.caseLabels,
    totalCases: summary.totalCases,
  });

  return {
    summary,
    summaryPath,
    manifestPath,
  };
}

export function loadLatestOpenPraQuantumWs6CanonicalExecutionReport(
  request: OpenPraQuantumWs6CanonicalExecutionReportLoadRequest,
): OpenPraQuantumWs6CanonicalExecutionReportLoadResult {
  const summaryPath = path.join(request.rootDirectoryPath, "ws6_canonical_execution_report_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No WS6 canonical execution report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumWs6CanonicalExecutionReportSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "ws6_canonical_execution_report_manifest_v1.json");
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

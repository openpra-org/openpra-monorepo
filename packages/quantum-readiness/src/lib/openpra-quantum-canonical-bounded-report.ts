import * as fs from "node:fs";
import * as path from "node:path";

import {
  SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";
import { getOpenPraQuantumCanonicalCasePackSummary } from "./openpra-quantum-canonical-case-pack";
import { loadLatestOpenPraQuantumBoundedImportanceArtifacts } from "./openpra-quantum-bounded-importance-artifact-loader";

export interface OpenPraQuantumCanonicalBoundedReportRequest {
  rootDirectoryPath: string;
  sourceBoundedImportanceRootDirectoryPath: string;
  scriptVersion?: string;
}

export interface OpenPraQuantumCanonicalBoundedReportRow {
  caseLabel: string;
  subtreeId: string;
  topologyClass: "A" | "C";
  recoveryMode: string;
  operatorAttentionRequired: boolean;
  boundednessMatches: boolean;
  responsePath: string;
  provenanceManifestPath: string | null;
}

export interface OpenPraQuantumCanonicalBoundedReportSummary {
  generatedAtUtc: string;
  scriptVersion: string;
  rootDirectoryPath: string;
  sourceBoundedImportanceRootDirectoryPath: string;
  caseLabels: string[];
  topologyCounts: Record<string, number>;
  totalCases: number;
  boundednessAllMatch: boolean;
  operatorAttentionCount: number;
  rows: OpenPraQuantumCanonicalBoundedReportRow[];
}

export interface OpenPraQuantumCanonicalBoundedReportResult {
  summary: OpenPraQuantumCanonicalBoundedReportSummary;
  summaryPath: string;
  manifestPath: string;
}

export interface OpenPraQuantumCanonicalBoundedReportLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumCanonicalBoundedReportLoadResult {
  summary: OpenPraQuantumCanonicalBoundedReportSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function buildOpenPraQuantumCanonicalBoundedReport(
  request: OpenPraQuantumCanonicalBoundedReportRequest,
): OpenPraQuantumCanonicalBoundedReportResult {
  const canonical = getOpenPraQuantumCanonicalCasePackSummary();
  const scriptVersion = request.scriptVersion ?? "openpra-quantum-canonical-bounded-report-v1";

  fs.mkdirSync(request.rootDirectoryPath, { recursive: true });

  const rows: OpenPraQuantumCanonicalBoundedReportRow[] = canonical.ws5PriorityCases.map((caseEntry) => {
    const loaded = loadLatestOpenPraQuantumBoundedImportanceArtifacts({
      rootDirectoryPath: request.sourceBoundedImportanceRootDirectoryPath,
      caseLabel: caseEntry.caseLabel,
    });

    const response = loaded.response as OpenPraQuantumBoundedImportanceResponse;

    if (response.caseLabel !== caseEntry.caseLabel) {
      throw new Error(`Case label mismatch for ${caseEntry.caseLabel}.`);
    }
    if (response.subtreeId !== caseEntry.subtreeId) {
      throw new Error(`Subtree mismatch for ${caseEntry.caseLabel}.`);
    }
    if (response.topologyClass !== caseEntry.topologyClass) {
      throw new Error(`Topology mismatch for ${caseEntry.caseLabel}.`);
    }

    return {
      caseLabel: caseEntry.caseLabel,
      subtreeId: response.subtreeId,
      topologyClass: response.topologyClass,
      recoveryMode: response.recoveryMode,
      operatorAttentionRequired: response.operatorAttentionRequired,
      boundednessMatches: response.boundednessStatement === SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
      responsePath: loaded.responsePath,
      provenanceManifestPath: loaded.provenanceManifestPath,
    };
  });

  const topologyCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.topologyClass] = (acc[row.topologyClass] ?? 0) + 1;
    return acc;
  }, {});

  const summary: OpenPraQuantumCanonicalBoundedReportSummary = {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion,
    rootDirectoryPath: request.rootDirectoryPath,
    sourceBoundedImportanceRootDirectoryPath: request.sourceBoundedImportanceRootDirectoryPath,
    caseLabels: rows.map((row) => row.caseLabel),
    topologyCounts,
    totalCases: rows.length,
    boundednessAllMatch: rows.every((row) => row.boundednessMatches),
    operatorAttentionCount: rows.filter((row) => row.operatorAttentionRequired).length,
    rows,
  };

  const summaryPath = path.join(request.rootDirectoryPath, "canonical_bounded_report_summary_v1.json");
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_bounded_report_manifest_v1.json");

  writeJson(summaryPath, summary);
  writeJson(manifestPath, {
    artifactType: "openpra_quantum_canonical_bounded_report_manifest",
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

export function loadLatestOpenPraQuantumCanonicalBoundedReport(
  request: OpenPraQuantumCanonicalBoundedReportLoadRequest,
): OpenPraQuantumCanonicalBoundedReportLoadResult {
  const summaryPath = path.join(request.rootDirectoryPath, "canonical_bounded_report_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical bounded report summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalBoundedReportSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_bounded_report_manifest_v1.json");
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

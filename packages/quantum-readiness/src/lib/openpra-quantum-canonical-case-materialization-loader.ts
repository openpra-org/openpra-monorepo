import * as fs from "node:fs";
import * as path from "node:path";

import type { OpenPraQuantumCanonicalCaseMaterializationSummary } from "./openpra-quantum-canonical-case-materializer";

export interface OpenPraQuantumCanonicalCaseMaterializationLoadRequest {
  rootDirectoryPath: string;
}

export interface OpenPraQuantumCanonicalCaseMaterializationLoadResult {
  summary: OpenPraQuantumCanonicalCaseMaterializationSummary;
  summaryPath: string;
  manifest: Record<string, unknown> | null;
  manifestPath: string | null;
}

export function loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary(
  request: OpenPraQuantumCanonicalCaseMaterializationLoadRequest,
): OpenPraQuantumCanonicalCaseMaterializationLoadResult {
  const summaryPath = path.join(request.rootDirectoryPath, "canonical_case_materialization_summary_v1.json");

  if (!fs.existsSync(summaryPath)) {
    throw new Error("No canonical case materialization summary found.");
  }

  const summary = readJson(summaryPath) as OpenPraQuantumCanonicalCaseMaterializationSummary;
  const manifestPath = path.join(request.rootDirectoryPath, "canonical_case_materialization_manifest_v1.json");
  const manifest = fs.existsSync(manifestPath) ? (readJson(manifestPath) as Record<string, unknown>) : null;

  return {
    summary,
    summaryPath,
    manifest,
    manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

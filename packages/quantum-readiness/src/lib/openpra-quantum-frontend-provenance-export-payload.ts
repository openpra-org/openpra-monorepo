import * as fs from "node:fs";
import * as path from "node:path";

export interface OpenPraQuantumFrontendProvenanceExportPayloadRequest {
  rootDirectoryPath: string;
  subtreeId?: string | null;
  caseLabel?: string | null;
  rootGateId?: string | null;
  scriptVersion?: string | null;
}

export interface OpenPraQuantumFrontendProvenanceExportPayloadResult {
  target: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  };
  summary: {
    topologyClass: string | null;
    basicEventCount: number | null;
    providerBackendName: string | null;
    recoveryPrimaryMode: string | null;
    boundednessStatement: string | null;
    matchedArtifactCount: number;
    exportBundleCount: number;
    manifestCount: number;
    sha256Count: number;
  };
  provenance: {
    rootDirectoryPath: string;
    scriptVersion: string;
    generatedAtUtc: string;
    matchedArtifactPaths: string[];
    manifestPaths: string[];
    sha256Paths: string[];
  };
  exports: {
    bundles: OpenPraQuantumFrontendProvenanceExportBundle[];
    manifests: OpenPraQuantumFrontendProvenanceExportFile[];
    checksums: OpenPraQuantumFrontendProvenanceExportFile[];
  };
  readiness: {
    hasProvenanceArtifacts: boolean;
    hasExportBundle: boolean;
    recommendation: string;
  };
}

export interface OpenPraQuantumFrontendProvenanceExportFile {
  path: string;
  fileName: string;
  kind: "manifest" | "checksum";
}

export interface OpenPraQuantumFrontendProvenanceExportBundle {
  path: string;
  fileName: string;
  kind: "bundle";
  hasSha256: boolean;
  pairedSha256Path: string | null;
}

type ArtifactKind = "preparation" | "providerRequest" | "recovery" | "importance" | "unknown";

interface Selector {
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
}

interface NormalizedArtifact {
  artifactPath: string;
  artifactKind: ArtifactKind;
  data: Record<string, unknown>;
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
  phase2bRowId: string | null;
  score: number;
}

export function buildOpenPraQuantumFrontendProvenanceExportPayload(
  request: OpenPraQuantumFrontendProvenanceExportPayloadRequest,
): OpenPraQuantumFrontendProvenanceExportPayloadResult {
  if (!request.rootDirectoryPath || request.rootDirectoryPath.trim() === "") {
    throw new Error("rootDirectoryPath is required.");
  }

  const rootDirectoryPath = path.resolve(request.rootDirectoryPath);

  if (!fs.existsSync(rootDirectoryPath)) {
    throw new Error(`rootDirectoryPath does not exist: ${rootDirectoryPath}`);
  }

  const selector: Selector = {
    subtreeId: normalizeText(request.subtreeId),
    caseLabel: normalizeText(request.caseLabel),
    rootGateId: normalizeText(request.rootGateId),
  };

  const allFilePaths = findFilesRecursive(rootDirectoryPath);

  const normalizedArtifacts = allFilePaths
    .filter((filePath: string) => filePath.toLowerCase().endsWith(".json"))
    .map((artifactPath: string) => normalizeArtifact(artifactPath, selector))
    .filter((artifact: NormalizedArtifact | null): artifact is NormalizedArtifact => artifact !== null);

  const scopedArtifacts =
    selector.subtreeId !== null || selector.caseLabel !== null || selector.rootGateId !== null ?
      normalizedArtifacts.filter((artifact: NormalizedArtifact) => artifact.score > 0)
    : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;
  const activeExportPaths = selectExportPaths(allFilePaths, selector);

  const topologyClass = firstArtifactString(activeArtifacts, "topologyClass", "topology_class");

  const basicEventCount = firstArtifactNumber(
    activeArtifacts,
    "basicEventCount",
    "basic_event_count",
    "nBasic",
    "n_basic",
  );

  const providerBackendName = firstArtifactString(activeArtifacts, "backendName", "backend");

  const recoveryPrimaryMode = firstArtifactString(activeArtifacts, "primaryMode", "primary_mode");

  const boundednessStatement = firstArtifactString(activeArtifacts, "boundednessStatement", "boundedness_statement");

  const matchedArtifactPaths = buildMatchedArtifactPaths(activeArtifacts, 8);
  const manifestPaths = activeExportPaths.filter((filePath: string) => isManifestLike(filePath)).slice(0, 12);
  const sha256Paths = activeExportPaths
    .filter((filePath: string) => filePath.toLowerCase().endsWith(".sha256"))
    .slice(0, 12);
  const bundlePaths = activeExportPaths.filter((filePath: string) => isBundleLike(filePath)).slice(0, 8);

  return {
    target: {
      subtreeId: firstString(
        selector.subtreeId,
        ...activeArtifacts.map((artifact: NormalizedArtifact) => artifact.subtreeId),
      ),
      caseLabel: firstString(
        selector.caseLabel,
        ...activeArtifacts.map((artifact: NormalizedArtifact) => artifact.caseLabel),
      ),
      rootGateId: firstString(
        selector.rootGateId,
        ...activeArtifacts.map((artifact: NormalizedArtifact) => artifact.rootGateId),
      ),
      phase2bRowId: firstString(...activeArtifacts.map((artifact: NormalizedArtifact) => artifact.phase2bRowId)),
    },
    summary: {
      topologyClass,
      basicEventCount,
      providerBackendName,
      recoveryPrimaryMode,
      boundednessStatement,
      matchedArtifactCount: matchedArtifactPaths.length,
      exportBundleCount: bundlePaths.length,
      manifestCount: manifestPaths.length,
      sha256Count: sha256Paths.length,
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion: normalizeText(request.scriptVersion) ?? "openpra-quantum-frontend-provenance-export-payload.v1",
      generatedAtUtc: new Date().toISOString(),
      matchedArtifactPaths,
      manifestPaths,
      sha256Paths,
    },
    exports: {
      bundles: bundlePaths.map((bundlePath: string) => buildBundleRecord(bundlePath, activeExportPaths)),
      manifests: manifestPaths.map((filePath: string) => ({
        path: filePath,
        fileName: path.basename(filePath),
        kind: "manifest" as const,
      })),
      checksums: sha256Paths.map((filePath: string) => ({
        path: filePath,
        fileName: path.basename(filePath),
        kind: "checksum" as const,
      })),
    },
    readiness: {
      hasProvenanceArtifacts: matchedArtifactPaths.length > 0 && manifestPaths.length > 0,
      hasExportBundle: bundlePaths.length > 0,
      recommendation: buildRecommendation({
        matchedArtifactCount: matchedArtifactPaths.length,
        manifestCount: manifestPaths.length,
        bundleCount: bundlePaths.length,
      }),
    },
  };
}

function normalizeArtifact(artifactPath: string, selector: Selector): NormalizedArtifact | null {
  const data = readJsonObject(artifactPath);

  if (data === null) {
    return null;
  }

  const subtreeId = firstString(
    findValue(data, "subtreeId"),
    findValue(data, "subtree_id"),
    findValue(data, "phase2bRowId"),
    findValue(data, "phase2b_row_id"),
  );

  const caseLabel = firstString(findValue(data, "caseLabel"), findValue(data, "case_label"));

  const rootGateId = firstString(findValue(data, "rootGateId"), findValue(data, "root_gate_id"));

  const phase2bRowId = firstString(findValue(data, "phase2bRowId"), findValue(data, "phase2b_row_id"), subtreeId);

  return {
    artifactPath,
    artifactKind: classifyArtifact(data, artifactPath),
    data,
    subtreeId,
    caseLabel,
    rootGateId,
    phase2bRowId,
    score: computeScore(
      {
        subtreeId,
        caseLabel,
        rootGateId,
        phase2bRowId,
      },
      selector,
    ),
  };
}

function classifyArtifact(data: Record<string, unknown>, artifactPath: string): ArtifactKind {
  const normalizedPath = artifactPath.toLowerCase();

  if (
    normalizedPath.includes("importance") ||
    hasAnyKey(data, [
      "boundednessStatement",
      "boundedness_statement",
      "comparisonStatistics",
      "comparison_statistics",
      "rawSpearman",
      "birnbaumSpearman",
      "fvSpearman",
    ])
  ) {
    return "importance";
  }

  if (
    normalizedPath.includes("recovery") ||
    hasAnyKey(data, [
      "primaryMode",
      "primary_mode",
      "tier1RecoveredExactCutSetCount",
      "unionRecoveredCount",
      "unionAllRecovered",
    ])
  ) {
    return "recovery";
  }

  if (
    normalizedPath.includes("provider") ||
    normalizedPath.includes("execution_request") ||
    hasAnyKey(data, ["jobId", "backendName", "providerName", "shots", "status"])
  ) {
    return "providerRequest";
  }

  if (
    normalizedPath.includes("preparation") ||
    normalizedPath.includes("canonical_case_pack") ||
    normalizedPath.includes("materialization") ||
    hasAnyKey(data, ["topologyClass", "requiredQubits", "statevectorVerification"])
  ) {
    return "preparation";
  }

  return "unknown";
}

function computeScore(
  candidate: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  },
  selector: Selector,
): number {
  let score = 0;

  if (selector.subtreeId !== null) {
    if (selector.subtreeId === normalizeText(candidate.subtreeId)) {
      score += 50;
    }
    if (selector.subtreeId === normalizeText(candidate.phase2bRowId)) {
      score += 40;
    }
  }

  if (selector.caseLabel !== null && selector.caseLabel === normalizeText(candidate.caseLabel)) {
    score += 35;
  }

  if (selector.rootGateId !== null && selector.rootGateId === normalizeText(candidate.rootGateId)) {
    score += 25;
  }

  if (selector.subtreeId === null && selector.caseLabel === null && selector.rootGateId === null) {
    return 1;
  }

  return score;
}

function buildRecommendation(input: {
  matchedArtifactCount: number;
  manifestCount: number;
  bundleCount: number;
}): string {
  if (input.matchedArtifactCount > 0 && input.manifestCount > 0 && input.bundleCount > 0) {
    return "ready_for_handoff_bundle_review";
  }

  if (input.matchedArtifactCount > 0 && input.manifestCount > 0) {
    return "provenance_ready_export_pending";
  }

  if (input.matchedArtifactCount > 0) {
    return "artifact_chain_present_manifest_pending";
  }

  return "provenance_incomplete";
}

function buildBundleRecord(bundlePath: string, exportPaths: string[]): OpenPraQuantumFrontendProvenanceExportBundle {
  const sha256Candidate = `${bundlePath}.sha256`;
  const hasSha256 = exportPaths.includes(sha256Candidate);

  return {
    path: bundlePath,
    fileName: path.basename(bundlePath),
    kind: "bundle",
    hasSha256,
    pairedSha256Path: hasSha256 ? sha256Candidate : null,
  };
}

function buildMatchedArtifactPaths(artifacts: NormalizedArtifact[], limit: number): string[] {
  const seen = new Set<string>();
  const collected: string[] = [];

  const ordered = [...artifacts].sort((left: NormalizedArtifact, right: NormalizedArtifact) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.artifactPath.localeCompare(right.artifactPath);
  });

  for (const artifact of ordered) {
    if (seen.has(artifact.artifactPath)) {
      continue;
    }

    seen.add(artifact.artifactPath);
    collected.push(artifact.artifactPath);

    if (collected.length >= limit) {
      break;
    }
  }

  return collected;
}

function selectExportPaths(filePaths: string[], selector: Selector): string[] {
  const relevant = filePaths.filter((filePath: string) => isExportRelevant(filePath));

  if (selector.subtreeId === null && selector.caseLabel === null && selector.rootGateId === null) {
    return relevant.sort((left: string, right: string) => left.localeCompare(right));
  }

  const loweredSelectors = [selector.subtreeId, selector.caseLabel, selector.rootGateId]
    .filter((value: string | null): value is string => value !== null)
    .map((value: string) => value.toLowerCase());

  const filtered = relevant.filter((filePath: string) => {
    const loweredPath = filePath.toLowerCase();
    return loweredSelectors.some((selectorValue: string) => loweredPath.includes(selectorValue));
  });

  const active = filtered.length > 0 ? filtered : relevant;
  return active.sort((left: string, right: string) => left.localeCompare(right));
}

function isExportRelevant(filePath: string): boolean {
  const loweredPath = filePath.toLowerCase();

  return (
    loweredPath.endsWith(".tar.gz") ||
    loweredPath.endsWith(".sha256") ||
    loweredPath.includes("manifest") ||
    loweredPath.includes("provenance") ||
    loweredPath.includes("handoff") ||
    loweredPath.includes("bundle") ||
    loweredPath.includes("checkpoint")
  );
}

function isManifestLike(filePath: string): boolean {
  const loweredName = path.basename(filePath).toLowerCase();

  return loweredName.endsWith(".json") && (loweredName.includes("manifest") || loweredName.includes("provenance"));
}

function isBundleLike(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".tar.gz");
}

function findFilesRecursive(rootDirectoryPath: string): string[] {
  const results: string[] = [];
  const stack: string[] = [rootDirectoryPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (!currentPath) {
      continue;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  }

  return results.sort((left: string, right: string) => left.localeCompare(right));
}

function readJsonObject(artifactPath: string): Record<string, unknown> | null {
  try {
    const rawText = fs.readFileSync(artifactPath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasAnyKey(data: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key: string) => findValue(data, key) !== undefined);
}

function findValue(input: unknown, dottedPath: string): unknown {
  if (!dottedPath || input === null || input === undefined) {
    return undefined;
  }

  const parts = dottedPath.split(".");
  let current: unknown = input;

  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }

    if (!(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function firstArtifactString(artifacts: NormalizedArtifact[], ...paths: string[]): string | null {
  for (const artifact of artifacts) {
    const value = firstString(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactNumber(artifacts: NormalizedArtifact[], ...paths: string[]): number | null {
  for (const artifact of artifacts) {
    const value = firstNumber(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

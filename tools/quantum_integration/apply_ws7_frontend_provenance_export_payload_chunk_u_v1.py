#!/usr/bin/env python3
from pathlib import Path
import re
import textwrap

REPO_ROOT = Path.cwd()

PATCH_SCRIPT_REL = "tools/quantum_integration/apply_ws7_frontend_provenance_export_payload_chunk_u_v1.py"
CHECKPOINT_SCRIPT_REL = "tools/quantum_integration/openpra_quantum_build_frontend_provenance_export_payload_checkpoint_v1.sh"

NEW_FILES = {
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.ts": r'''
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
    selector.subtreeId !== null || selector.caseLabel !== null || selector.rootGateId !== null
      ? normalizedArtifacts.filter((artifact: NormalizedArtifact) => artifact.score > 0)
      : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;
  const activeExportPaths = selectExportPaths(allFilePaths, selector);

  const topologyClass = firstArtifactString(
    activeArtifacts,
    "topologyClass",
    "topology_class",
  );

  const basicEventCount = firstArtifactNumber(
    activeArtifacts,
    "basicEventCount",
    "basic_event_count",
    "nBasic",
    "n_basic",
  );

  const providerBackendName = firstArtifactString(
    activeArtifacts,
    "backendName",
    "backend",
  );

  const recoveryPrimaryMode = firstArtifactString(
    activeArtifacts,
    "primaryMode",
    "primary_mode",
  );

  const boundednessStatement = firstArtifactString(
    activeArtifacts,
    "boundednessStatement",
    "boundedness_statement",
  );

  const matchedArtifactPaths = buildMatchedArtifactPaths(activeArtifacts, 8);
  const manifestPaths = activeExportPaths.filter((filePath: string) => isManifestLike(filePath)).slice(0, 12);
  const sha256Paths = activeExportPaths.filter((filePath: string) => filePath.toLowerCase().endsWith(".sha256")).slice(0, 12);
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
      phase2bRowId: firstString(
        ...activeArtifacts.map((artifact: NormalizedArtifact) => artifact.phase2bRowId),
      ),
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
      scriptVersion:
        normalizeText(request.scriptVersion) ??
        "openpra-quantum-frontend-provenance-export-payload.v1",
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

  const caseLabel = firstString(
    findValue(data, "caseLabel"),
    findValue(data, "case_label"),
  );

  const rootGateId = firstString(
    findValue(data, "rootGateId"),
    findValue(data, "root_gate_id"),
  );

  const phase2bRowId = firstString(
    findValue(data, "phase2bRowId"),
    findValue(data, "phase2b_row_id"),
    subtreeId,
  );

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

function buildBundleRecord(
  bundlePath: string,
  exportPaths: string[],
): OpenPraQuantumFrontendProvenanceExportBundle {
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

function buildMatchedArtifactPaths(
  artifacts: NormalizedArtifact[],
  limit: number,
): string[] {
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

function selectExportPaths(
  filePaths: string[],
  selector: Selector,
): string[] {
  const relevant = filePaths.filter((filePath: string) => isExportRelevant(filePath));

  if (selector.subtreeId === null && selector.caseLabel === null && selector.rootGateId === null) {
    return relevant.sort((left: string, right: string) => left.localeCompare(right));
  }

  const loweredSelectors = [
    selector.subtreeId,
    selector.caseLabel,
    selector.rootGateId,
  ]
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

  return (
    loweredName.endsWith(".json") &&
    (loweredName.includes("manifest") || loweredName.includes("provenance"))
  );
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

function firstArtifactString(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): string | null {
  for (const artifact of artifacts) {
    const value = firstString(
      ...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)),
    );
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactNumber(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): number | null {
  for (const artifact of artifacts) {
    const value = firstNumber(
      ...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)),
    );
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
''',
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendProvenanceExportPayload } from "./openpra-quantum-frontend-provenance-export-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

function writeText(rootDirectoryPath: string, relativePath: string, value: string): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
}

describe("buildOpenPraQuantumFrontendProvenanceExportPayload", () => {
  it("builds a frontend provenance and export payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-frontend-provenance-export-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement: "screening only",
    });

    writeText(
      rootDirectoryPath,
      "_work/checkpoints/OPENPRA_SAMPLE_RELEASE_BUNDLE_v1_20260418_000000Z.tar.gz",
      "bundle",
    );
    writeText(
      rootDirectoryPath,
      "_work/checkpoints/OPENPRA_SAMPLE_RELEASE_BUNDLE_v1_20260418_000000Z.tar.gz.sha256",
      "sha256",
    );
    writeJson(
      rootDirectoryPath,
      "_work/checkpoints/workflow_release_manifest_v1.json",
      { status: "ok" },
    );
    writeJson(
      rootDirectoryPath,
      "_work/checkpoints/provenance_manifest_v1.json",
      { status: "ok" },
    );

    const result = buildOpenPraQuantumFrontendProvenanceExportPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendProvenanceExportPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.recoveryPrimaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.boundednessStatement).toBe("screening only");
    expect(result.summary.exportBundleCount).toBe(1);
    expect(result.summary.manifestCount).toBe(2);
    expect(result.summary.sha256Count).toBe(1);
    expect(result.exports.bundles[0].hasSha256).toBe(true);
    expect(result.readiness.recommendation).toBe("ready_for_handoff_bundle_review");
    expect(result.provenance.matchedArtifactPaths.length).toBe(4);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendProvenanceExportPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.service.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend provenance export payload", () => {
  it("returns the provenance export payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-service-frontend-provenance-export-"),
    );

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      boundednessStatement: "screening only",
    });

    const result =
      QuantumReadinessService.prototype.getFrontendProvenanceExportPayload.call(
        {} as QuantumReadinessService,
        {
          rootDirectoryPath,
          subtreeId: "phase2b_row_0698",
          scriptVersion: "quantumReadiness.frontendProvenanceExportPayload.service.spec",
        },
      );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.boundednessStatement).toBe("screening only");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.controller.spec.ts": r'''
import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend provenance export payload", () => {
  it("routes the provenance export payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        exportBundleCount: 1,
      },
    };

    const mockQuantumReadinessService = {
      getFrontendProvenanceExportPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result =
      QuantumReadinessController.prototype.getFrontendProvenanceExportPayloadHttp.call(
        {
          quantumReadinessService: mockQuantumReadinessService,
        } as unknown as QuantumReadinessController,
        "/tmp/openpra-root",
        "phase2b_row_0905",
        "phase2b_row_0905",
        "G:G939",
      );

    expect(
      mockQuantumReadinessService.getFrontendProvenanceExportPayload,
    ).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendProvenanceExportPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
''',
    "packages/web-backend/tests/quantumReadiness.frontendProvenanceExportPayload.http.spec.ts": r'''
import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendProvenanceExportPayload.http", () => {
  it("loads the frontend provenance export payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        exportBundleCount: 1,
        manifestCount: 2,
      },
      readiness: {
        recommendation: "ready_for_handoff_bundle_review",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendProvenanceExportPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendProvenanceExportPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendProvenanceExportPayloadHttp(
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.exportBundleCount).toBe(1);
    expect(result.readiness.recommendation).toBe("ready_for_handoff_bundle_review");
  });
});
''',
}

CHECKPOINT_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BASE_DIR="$REPO_ROOT/_work/openpra_quantum_frontend_provenance_export_payload_checkpoint_v1"
OUT_DIR="$BASE_DIR/OPENPRA_QUANTUM_FRONTEND_PROVENANCE_EXPORT_PAYLOAD_CHECKPOINT_v1_${STAMP}"

mkdir -p "$OUT_DIR"

copy_into_checkpoint() {
  local rel_path="$1"
  mkdir -p "$OUT_DIR/$(dirname "$rel_path")"
  cp "$REPO_ROOT/$rel_path" "$OUT_DIR/$rel_path"
}

copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.spec.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/index.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.service.spec.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendProvenanceExportPayload.controller.spec.ts"
copy_into_checkpoint "packages/web-backend/tests/quantumReadiness.frontendProvenanceExportPayload.http.spec.ts"
copy_into_checkpoint "tools/quantum_integration/apply_ws7_frontend_provenance_export_payload_chunk_u_v1.py"
copy_into_checkpoint "tools/quantum_integration/openpra_quantum_build_frontend_provenance_export_payload_checkpoint_v1.sh"

tar -czf "${OUT_DIR}.tar.gz" -C "$BASE_DIR" "$(basename "$OUT_DIR")"
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256"

echo "$OUT_DIR"
echo "${OUT_DIR}.tar.gz"
echo "${OUT_DIR}.tar.gz.sha256"
'''

SERVICE_IMPORT_BLOCK = r'''
import {
  buildOpenPraQuantumFrontendProvenanceExportPayload,
  OpenPraQuantumFrontendProvenanceExportPayloadRequest,
  OpenPraQuantumFrontendProvenanceExportPayloadResult,
} from "../../../quantum-readiness/src/index";
'''

SERVICE_METHOD_BLOCK = r'''
  getFrontendProvenanceExportPayload(
    request: OpenPraQuantumFrontendProvenanceExportPayloadRequest,
  ): OpenPraQuantumFrontendProvenanceExportPayloadResult {
    return buildOpenPraQuantumFrontendProvenanceExportPayload(request);
  }

'''

CONTROLLER_IMPORT_BLOCK = r'''
import { Get, Query } from "@nestjs/common";
'''

CONTROLLER_METHOD_BLOCK = r'''
  @Get("frontend/provenance-export-payload")
  @Get("frontend/provenanceExportPayload")
  @Get("frontendProvenanceExportPayload")
  getFrontendProvenanceExportPayloadHttp(
    @Query("rootDirectoryPath") rootDirectoryPath: string,
    @Query("subtreeId") subtreeId?: string,
    @Query("caseLabel") caseLabel?: string,
    @Query("rootGateId") rootGateId?: string,
  ) {
    return this.quantumReadinessService.getFrontendProvenanceExportPayload({
      rootDirectoryPath,
      subtreeId: subtreeId ?? null,
      caseLabel: caseLabel ?? null,
      rootGateId: rootGateId ?? null,
      scriptVersion: "quantumReadiness.controller.frontendProvenanceExportPayload.http",
    });
  }

'''

INDEX_EXPORT_LINE = 'export * from "./openpra-quantum-frontend-provenance-export-payload";\n'


def normalize_block(content: str) -> str:
    return textwrap.dedent(content).lstrip("\n")


def write_text_file(relative_path: str, content: str) -> None:
    target_path = REPO_ROOT / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(normalize_block(content), encoding="utf-8")


def read_text_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def write_existing_file(relative_path: str, content: str) -> None:
    (REPO_ROOT / relative_path).write_text(content, encoding="utf-8")


def ensure_import_block(relative_path: str, import_block: str) -> None:
    content = read_text_file(relative_path)
    block = normalize_block(import_block).rstrip() + "\n"

    if block.strip() in content:
        return

    import_matches = list(re.finditer(r"^import .*?;\n", content, flags=re.MULTILINE))
    if not import_matches:
        raise RuntimeError(f"Could not find import section in {relative_path}")

    insert_index = import_matches[-1].end()
    updated = content[:insert_index] + block + content[insert_index:]
    write_existing_file(relative_path, updated)


def ensure_export_line(relative_path: str, export_line: str) -> None:
    content = read_text_file(relative_path)

    if export_line.strip() in content:
        return

    updated = content.rstrip() + "\n" + export_line
    write_existing_file(relative_path, updated)


def insert_before_last_marker(relative_path: str, block: str, markers: list[str]) -> None:
    content = read_text_file(relative_path)
    normalized_block = normalize_block(block).rstrip() + "\n"

    if normalized_block.strip() in content:
        return

    for marker in markers:
        position = content.rfind(marker)
        if position != -1:
            updated = content[:position] + normalized_block + content[position:]
            write_existing_file(relative_path, updated)
            return

    raise RuntimeError(
        f"Could not find insertion marker in {relative_path}. Tried: {markers}"
    )


def main() -> None:
    for relative_path, content in NEW_FILES.items():
        write_text_file(relative_path, content)

    write_text_file(CHECKPOINT_SCRIPT_REL, CHECKPOINT_SCRIPT)

    ensure_export_line(
        "packages/quantum-readiness/src/lib/index.ts",
        INDEX_EXPORT_LINE,
    )

    ensure_import_block(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts",
        SERVICE_IMPORT_BLOCK,
    )
    insert_before_last_marker(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts",
        SERVICE_METHOD_BLOCK,
        [
            "\n  private ",
            "\n}\n",
            "\n}\r\n",
        ],
    )

    ensure_import_block(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts",
        CONTROLLER_IMPORT_BLOCK,
    )
    insert_before_last_marker(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts",
        CONTROLLER_METHOD_BLOCK,
        [
            "\n  private toHttpException(",
            "\n  private ",
            "\n}\n",
            "\n}\r\n",
        ],
    )

    print("Applied frontend provenance export payload chunk U successfully.")


if __name__ == "__main__":
    main()

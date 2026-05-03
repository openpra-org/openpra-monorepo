import fs from "node:fs";
import path from "node:path";

import { buildOpenpraQuantumRecoveryFromArtifacts } from "./openpra-quantum-recovery-artifacts";
import { buildOpenpraQuantumRecoveryBatchRollupFromArtifacts } from "./openpra-quantum-recovery-batch-artifacts";
import type { OpenpraQuantumRecoveryArtifactBundle } from "./openpra-quantum-recovery-artifacts";
import type {
  OpenpraQuantumRecoveryBatchArtifactBundle,
  OpenpraQuantumRecoveryBatchArtifactCase,
} from "./openpra-quantum-recovery-batch-artifacts";
import type { QuantumRecoveryLadderResult } from "./quantum-recovery";
import type { OpenpraQuantumRecoveryBatchRollup } from "./openpra-quantum-recovery-rollup";

const PACKAGE_METADATA_FILENAME = "package_metadata.json";
const RAW_COUNTS_FILENAME = "raw_counts.json";
const CLASSICAL_REFERENCE_FILENAME = "classical_reference_mcs.json";
const PACKAGE_RESULT_FILENAME = "openpra_package_recovery_result_v1.json";
const LEGACY_RESULT_FILENAME = "openpra_recovery_ladder_result_v1.json";

export type OpenpraQuantumRecoveryBatchSelectionMode =
  | "all_candidate_dirs"
  | "package_result_only"
  | "legacy_validated_only";

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function requireDirectoryExists(dirPath: string, fieldName: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${fieldName} does not exist: ${dirPath}`);
  }

  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`${fieldName} is not a directory: ${dirPath}`);
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function candidateArtifactPath(candidateDir: string, fileName: string): string {
  return path.join(candidateDir, fileName);
}

function hasCandidateArtifacts(candidateDir: string): boolean {
  return (
    fs.existsSync(candidateArtifactPath(candidateDir, PACKAGE_METADATA_FILENAME)) &&
    fs.existsSync(candidateArtifactPath(candidateDir, RAW_COUNTS_FILENAME)) &&
    fs.existsSync(candidateArtifactPath(candidateDir, CLASSICAL_REFERENCE_FILENAME))
  );
}

function hasPackageRecoveryResult(candidateDir: string): boolean {
  return fs.existsSync(candidateArtifactPath(candidateDir, PACKAGE_RESULT_FILENAME));
}

function hasLegacyValidatedRecoveryResult(candidateDir: string): boolean {
  return fs.existsSync(candidateArtifactPath(candidateDir, LEGACY_RESULT_FILENAME));
}

export function loadOpenpraQuantumRecoveryArtifactBundleFromCandidateDir(
  candidateDir: string,
): OpenpraQuantumRecoveryArtifactBundle {
  const normalizedCandidateDir = requireNonEmptyString(candidateDir, "candidateDir");
  requireDirectoryExists(normalizedCandidateDir, "candidateDir");

  const packageMetadataPath = candidateArtifactPath(normalizedCandidateDir, PACKAGE_METADATA_FILENAME);
  const rawCountsPath = candidateArtifactPath(normalizedCandidateDir, RAW_COUNTS_FILENAME);
  const classicalReferencePath = candidateArtifactPath(normalizedCandidateDir, CLASSICAL_REFERENCE_FILENAME);

  if (!fs.existsSync(packageMetadataPath)) {
    throw new Error(`Missing candidate artifact: ${packageMetadataPath}`);
  }

  if (!fs.existsSync(rawCountsPath)) {
    throw new Error(`Missing candidate artifact: ${rawCountsPath}`);
  }

  if (!fs.existsSync(classicalReferencePath)) {
    throw new Error(`Missing candidate artifact: ${classicalReferencePath}`);
  }

  return {
    packageMetadata: readJsonFile(packageMetadataPath),
    rawCounts: readJsonFile(rawCountsPath),
    classicalReferenceMcs: readJsonFile(classicalReferencePath),
  };
}

export function buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
  const bundle = loadOpenpraQuantumRecoveryArtifactBundleFromCandidateDir(candidateDir);
  return buildOpenpraQuantumRecoveryFromArtifacts(bundle);
}

export function loadOpenpraPackageRecoveryResultFromCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
  const normalizedCandidateDir = requireNonEmptyString(candidateDir, "candidateDir");
  requireDirectoryExists(normalizedCandidateDir, "candidateDir");

  const resultPath = candidateArtifactPath(normalizedCandidateDir, PACKAGE_RESULT_FILENAME);
  if (!fs.existsSync(resultPath)) {
    throw new Error(`Missing package recovery result: ${resultPath}`);
  }

  return readJsonFile<QuantumRecoveryLadderResult>(resultPath);
}

export function discoverOpenpraCandidateDirsInBatchRoot(
  batchRoot: string,
  selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "all_candidate_dirs",
): string[] {
  const normalizedBatchRoot = requireNonEmptyString(batchRoot, "batchRoot");
  requireDirectoryExists(normalizedBatchRoot, "batchRoot");

  return fs
    .readdirSync(normalizedBatchRoot)
    .map((name) => path.join(normalizedBatchRoot, name))
    .filter((fullPath) => fs.statSync(fullPath).isDirectory())
    .filter((fullPath) => hasCandidateArtifacts(fullPath))
    .filter((fullPath) => {
      if (selectionMode === "all_candidate_dirs") {
        return true;
      }

      if (selectionMode === "package_result_only") {
        return hasPackageRecoveryResult(fullPath);
      }

      if (selectionMode === "legacy_validated_only") {
        return hasLegacyValidatedRecoveryResult(fullPath);
      }

      return true;
    })
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

export function loadOpenpraQuantumRecoveryBatchArtifactBundleFromBatchRoot(
  batchRoot: string,
  candidateDirs?: string[],
  selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
): OpenpraQuantumRecoveryBatchArtifactBundle {
  const normalizedBatchRoot = requireNonEmptyString(batchRoot, "batchRoot");
  requireDirectoryExists(normalizedBatchRoot, "batchRoot");

  const dirs =
    candidateDirs && candidateDirs.length > 0 ?
      [...candidateDirs]
    : discoverOpenpraCandidateDirsInBatchRoot(normalizedBatchRoot, selectionMode);

  const cases: OpenpraQuantumRecoveryBatchArtifactCase[] = dirs.map((candidateDir) => {
    const normalizedCandidateDir = requireNonEmptyString(candidateDir, "candidateDir");
    requireDirectoryExists(normalizedCandidateDir, "candidateDir");

    const label = path.basename(normalizedCandidateDir);
    const resultPath = candidateArtifactPath(normalizedCandidateDir, PACKAGE_RESULT_FILENAME);

    if (!hasPackageRecoveryResult(normalizedCandidateDir)) {
      throw new Error(
        `Missing package recovery result for candidate dir ${normalizedCandidateDir}. Expected ${resultPath}`,
      );
    }

    return {
      label,
      candidateDir: normalizedCandidateDir,
      resultPath,
      result: loadOpenpraPackageRecoveryResultFromCandidateDir(normalizedCandidateDir),
    };
  });

  return {
    batchRoot: normalizedBatchRoot,
    cases,
  };
}

export function buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(
  batchRoot: string,
  candidateDirs?: string[],
  selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
): OpenpraQuantumRecoveryBatchRollup {
  const bundle = loadOpenpraQuantumRecoveryBatchArtifactBundleFromBatchRoot(batchRoot, candidateDirs, selectionMode);

  return buildOpenpraQuantumRecoveryBatchRollupFromArtifacts(bundle);
}

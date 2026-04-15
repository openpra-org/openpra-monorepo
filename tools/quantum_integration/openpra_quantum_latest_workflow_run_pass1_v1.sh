#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/latest_workflow_run_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.latestWorkflowRun.http.spec.ts"

echo "==> Writing quantumReadiness.service.ts"
cat > "${SERVICE_PATH}" <<'EOF'
import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
  buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot,
  buildOpenpraQuantumRecoveryFromCandidateDir,
  buildOpenpraQuantumWorkflowRunScaffold,
  buildQuantumPreparationClQuboExport,
  buildQuantumPreparationExport,
  writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
  writeOpenpraQuantumPreparationArtifactBundleToFilesystem,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type OpenpraQuantumExecutionArtifactBundle,
  type OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  type OpenpraQuantumExecutionProviderType,
  type OpenpraQuantumPreparationArtifactBundle,
  type OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  type OpenpraQuantumRecoveryBatchRollup,
  type OpenpraQuantumRecoveryBatchSelectionMode,
  type OpenpraQuantumWorkflowRunScaffoldRequest,
  type OpenpraQuantumWorkflowRunScaffoldResult,
  type QuantumPreparationExport,
  type QuantumRecoveryLadderResult
} from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { adaptFaultTreeGraphInput } from "./openPraFaultTreeGraph.adapter";

export interface QuantumExecutionArtifactRawCountsRequest {
  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  shots: number;
  rawCounts: Record<string, number>;
  jobIdOrRunId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface QuantumRecoveryBatchRunInput {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumRecoveryArtifactWriteResult {
  outputDir: string;
  recoveryArtifactPath: string;
}

export interface QuantumRecoveryBatchRollupWriteResult {
  outputDir: string;
  recoveryBatchRollupPath: string;
}

export interface QuantumPreparationWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  preparationWrite: OpenpraQuantumPreparationArtifactFilesystemWriteResult;
}

export interface QuantumExecutionWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  executionWrite: OpenpraQuantumExecutionArtifactFilesystemWriteResult;
}

export interface QuantumRecoveryWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  recoveryWrite: QuantumRecoveryArtifactWriteResult;
}

export interface QuantumRecoveryBatchWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  batchWrite: QuantumRecoveryBatchRollupWriteResult;
}

export interface QuantumFullPipelineWorkflowRunResult {
  workflowRun: OpenpraQuantumWorkflowRunScaffoldResult;
  preparationWrite?: OpenpraQuantumPreparationArtifactFilesystemWriteResult;
  executionWrite?: OpenpraQuantumExecutionArtifactFilesystemWriteResult;
  recoveryWrite?: QuantumRecoveryArtifactWriteResult;
  batchWrite?: QuantumRecoveryBatchRollupWriteResult;
}

export interface QuantumWorkflowRunInspectionResult {
  workflowRunDir: string;
  manifestPath: string | null;
  directories: {
    artifacts: string | null;
    preparation: string | null;
    execution: string | null;
    recovery: string | null;
    batch: string | null;
    logs: string | null;
  };
  files: {
    preparationBundles: string[];
    preparationArtifacts: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    recoveryBatchRollups: string[];
    logFiles: string[];
  };
}

export interface QuantumWorkflowRunListingEntry {
  workflowRunDir: string;
  workflowKind: string | null;
  createdAtUtc: string | null;
  manifestPath: string | null;
}

export interface QuantumWorkflowRunListingResult {
  rootDir: string;
  entries: QuantumWorkflowRunListingEntry[];
}

export interface QuantumLatestWorkflowRunResult {
  rootDir: string;
  latest: QuantumWorkflowRunListingEntry | null;
  inspection: QuantumWorkflowRunInspectionResult | null;
}

@Injectable()
export class QuantumReadinessService {
  constructor(private readonly graphModelService: GraphModelService) {}

  createWorkflowRunScaffold(
    request: OpenpraQuantumWorkflowRunScaffoldRequest
  ): OpenpraQuantumWorkflowRunScaffoldResult {
    return buildOpenpraQuantumWorkflowRunScaffold(request);
  }

  createPreparationWorkflowRun(
    rootDir: string,
    graph: FaultTreeGraph | Record<string, unknown>,
    modelId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): QuantumPreparationWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "preparation",
      requestedBy: "web-backend:quantumReadiness.service"
    });

    const preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
      graph,
      workflowRun.directories.preparation,
      modelName,
      options
    );

    return {
      workflowRun,
      preparationWrite
    };
  }

  async createPreparationWorkflowRunById(
    rootDir: string,
    faultTreeId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<QuantumPreparationWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return this.createPreparationWorkflowRun(
      rootDir,
      converted,
      faultTreeId,
      subtreeId,
      modelName,
      options
    );
  }

  createExecutionWorkflowRun(
    rootDir: string,
    request: QuantumExecutionArtifactRawCountsRequest
  ): QuantumExecutionWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      workflowKind: "execution",
      requestedBy: "web-backend:quantumReadiness.service"
    });

    const executionWrite = this.buildExecutionArtifactsFromRawCountsToFilesystem(
      request,
      workflowRun.directories.execution
    );

    return {
      workflowRun,
      executionWrite
    };
  }

  createRecoveryWorkflowRun(
    rootDir: string,
    candidateDir: string,
    modelId: string,
    subtreeId: string
  ): QuantumRecoveryWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery",
      requestedBy: "web-backend:quantumReadiness.service"
    });

    const recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(
      candidateDir,
      workflowRun.directories.recovery
    );

    return {
      workflowRun,
      recoveryWrite
    };
  }

  createRecoveryBatchWorkflowRun(
    rootDir: string,
    batchRoot: string,
    modelId: string,
    subtreeId: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only"
  ): QuantumRecoveryBatchWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery_batch",
      requestedBy: "web-backend:quantumReadiness.service"
    });

    const batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
      batchRoot,
      workflowRun.directories.batch,
      candidateDirs,
      selectionMode
    );

    return {
      workflowRun,
      batchWrite
    };
  }

  createFullPipelineWorkflowRun(
    rootDir: string,
    modelId: string,
    subtreeId: string,
    graph?: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
    executionRequest?: QuantumExecutionArtifactRawCountsRequest,
    recoveryCandidateDir?: string,
    recoveryBatch?: QuantumRecoveryBatchRunInput
  ): QuantumFullPipelineWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "full_pipeline",
      requestedBy: "web-backend:quantumReadiness.service"
    });

    const result: QuantumFullPipelineWorkflowRunResult = {
      workflowRun
    };

    if (graph) {
      result.preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        graph,
        workflowRun.directories.preparation,
        modelName,
        options
      );
    }

    if (executionRequest) {
      result.executionWrite = this.buildExecutionArtifactsFromRawCountsToFilesystem(
        executionRequest,
        workflowRun.directories.execution
      );
    }

    if (recoveryCandidateDir) {
      result.recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(
        recoveryCandidateDir,
        workflowRun.directories.recovery
      );
    }

    if (recoveryBatch) {
      result.batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
        recoveryBatch.batchRoot,
        workflowRun.directories.batch,
        recoveryBatch.candidateDirs,
        recoveryBatch.selectionMode ?? "package_result_only"
      );
    }

    return result;
  }

  async createFullPipelineWorkflowRunById(
    rootDir: string,
    faultTreeId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
    executionRequest?: QuantumExecutionArtifactRawCountsRequest,
    recoveryCandidateDir?: string,
    recoveryBatch?: QuantumRecoveryBatchRunInput
  ): Promise<QuantumFullPipelineWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return this.createFullPipelineWorkflowRun(
      rootDir,
      faultTreeId,
      subtreeId,
      converted,
      modelName,
      options,
      executionRequest,
      recoveryCandidateDir,
      recoveryBatch
    );
  }

  inspectWorkflowRun(workflowRunDir: string): QuantumWorkflowRunInspectionResult {
    const resolvedRunDir = path.resolve(workflowRunDir);

    if (!fs.existsSync(resolvedRunDir)) {
      throw new Error(`workflowRunDir does not exist: ${resolvedRunDir}`);
    }

    const artifactsDir = path.join(resolvedRunDir, "artifacts");
    const preparationDir = path.join(artifactsDir, "preparation");
    const executionDir = path.join(artifactsDir, "execution");
    const recoveryDir = path.join(artifactsDir, "recovery");
    const batchDir = path.join(artifactsDir, "batch");
    const logsDir = path.join(resolvedRunDir, "logs");
    const manifestPath = path.join(
      resolvedRunDir,
      "openpra_quantum_workflow_run_manifest_v1.json"
    );

    return {
      workflowRunDir: resolvedRunDir,
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
      directories: {
        artifacts: fs.existsSync(artifactsDir) ? artifactsDir : null,
        preparation: fs.existsSync(preparationDir) ? preparationDir : null,
        execution: fs.existsSync(executionDir) ? executionDir : null,
        recovery: fs.existsSync(recoveryDir) ? recoveryDir : null,
        batch: fs.existsSync(batchDir) ? batchDir : null,
        logs: fs.existsSync(logsDir) ? logsDir : null
      },
      files: {
        preparationBundles: listFilesMatching(
          preparationDir,
          /^openpra_quantum_preparation_bundle_v1\.json$/
        ),
        preparationArtifacts: listFilesMatching(
          preparationDir,
          /^openpra_quantum_preparation_artifact_.*\.json$/
        ),
        executionArtifacts: listFilesMatching(
          executionDir,
          /^openpra_quantum_execution_artifact_v1\.json$/
        ),
        executionProvenance: listFilesMatching(
          executionDir,
          /^openpra_quantum_execution_provenance_manifest_v1\.json$/
        ),
        recoveryArtifacts: listFilesMatching(
          recoveryDir,
          /^openpra_quantum_recovery_artifact_v1\.json$/
        ),
        recoveryBatchRollups: listFilesMatching(
          batchDir,
          /^openpra_quantum_recovery_batch_rollup_v1\.json$/
        ),
        logFiles: listAllFiles(logsDir)
      }
    };
  }

  listWorkflowRuns(rootDir: string): QuantumWorkflowRunListingResult {
    const resolvedRootDir = path.resolve(rootDir);

    if (!fs.existsSync(resolvedRootDir)) {
      throw new Error(`rootDir does not exist: ${resolvedRootDir}`);
    }

    const entries = fs
      .readdirSync(resolvedRootDir)
      .map((entry) => path.join(resolvedRootDir, entry))
      .filter((entryPath) => fs.statSync(entryPath).isDirectory())
      .filter((entryPath) => path.basename(entryPath).startsWith("openpra_quantum_"))
      .map((entryPath) => {
        const manifestPath = path.join(
          entryPath,
          "openpra_quantum_workflow_run_manifest_v1.json"
        );

        let workflowKind: string | null = null;
        let createdAtUtc: string | null = null;

        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
            workflowKind?: string;
            createdAtUtc?: string;
          };
          workflowKind = manifest.workflowKind ?? null;
          createdAtUtc = manifest.createdAtUtc ?? null;
        }

        return {
          workflowRunDir: entryPath,
          workflowKind,
          createdAtUtc,
          manifestPath: fs.existsSync(manifestPath) ? manifestPath : null
        };
      })
      .sort((a, b) => {
        const left = a.createdAtUtc ?? "";
        const right = b.createdAtUtc ?? "";
        return right.localeCompare(left);
      });

    return {
      rootDir: resolvedRootDir,
      entries
    };
  }

  getLatestWorkflowRun(rootDir: string): QuantumLatestWorkflowRunResult {
    const listing = this.listWorkflowRuns(rootDir);
    const latest = listing.entries.length > 0 ? listing.entries[0] : null;

    return {
      rootDir: listing.rootDir,
      latest,
      inspection: latest ? this.inspectWorkflowRun(latest.workflowRunDir) : null
    };
  }

  analyzeFaultTreeGraph(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenPraFaultTreeReadinessResult {
    return analyzeGraphLikeInputToReadiness(graph, modelName, options);
  }

  analyzeFaultTreeGraphPreparation(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): QuantumPreparationExport {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);

    return buildQuantumPreparationExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );
  }

  analyzeFaultTreeGraphPreparationArtifacts(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenpraQuantumPreparationArtifactBundle {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
      clQuboExport,
      {
        createdBy: "web-backend:quantumReadiness.service"
      }
    );
  }

  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    graph: FaultTreeGraph | Record<string, unknown>,
    outputDir: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    const bundle = this.analyzeFaultTreeGraphPreparationArtifacts(
      graph,
      modelName,
      options
    );

    return writeOpenpraQuantumPreparationArtifactBundleToFilesystem(
      bundle,
      outputDir
    );
  }

  async analyzeFaultTreeGraphById(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<OpenPraFaultTreeReadinessResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return analyzeGraphLikeInputToReadiness(converted, modelName, options);
  }

  async analyzeFaultTreeGraphByIdPreparation(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<QuantumPreparationExport> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(
      converted,
      modelName,
      options
    );

    return buildQuantumPreparationExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );
  }

  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    const graph = (await this.graphModelService.getFaultTreeGraph(
      faultTreeId
    )) as FaultTreeGraph | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(
      converted,
      modelName,
      options
    );
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
      clQuboExport,
      {
        createdBy: "web-backend:quantumReadiness.service"
      }
    );
  }

  buildExecutionArtifactsFromRawCounts(
    request: QuantumExecutionArtifactRawCountsRequest
  ): OpenpraQuantumExecutionArtifactBundle {
    return buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(request, {
      createdBy: "web-backend:quantumReadiness.service"
    });
  }

  buildExecutionArtifactsFromRawCountsToFilesystem(
    request: QuantumExecutionArtifactRawCountsRequest,
    outputDir: string
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    const bundle = this.buildExecutionArtifactsFromRawCounts(request);

    return writeOpenpraQuantumExecutionArtifactBundleToFilesystem(
      bundle,
      outputDir
    );
  }

  analyzeRecoveryCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
    return buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  }

  analyzeRecoveryCandidateDirToFilesystem(
    candidateDir: string,
    outputDir: string
  ): QuantumRecoveryArtifactWriteResult {
    const result = this.analyzeRecoveryCandidateDir(candidateDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryArtifactPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_recovery_artifact_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      recoveryArtifactPath,
      JSON.stringify(result, null, 2) + "\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      recoveryArtifactPath
    };
  }

  analyzeRecoveryBatchRoot(
    batchRoot: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only"
  ): OpenpraQuantumRecoveryBatchRollup {
    return buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(
      batchRoot,
      candidateDirs,
      selectionMode
    );
  }

  analyzeRecoveryBatchRootToFilesystem(
    batchRoot: string,
    outputDir: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only"
  ): QuantumRecoveryBatchRollupWriteResult {
    const rollup = this.analyzeRecoveryBatchRoot(
      batchRoot,
      candidateDirs,
      selectionMode
    );
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryBatchRollupPath = path.join(
      resolvedOutputDir,
      "openpra_quantum_recovery_batch_rollup_v1.json"
    );

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(
      recoveryBatchRollupPath,
      JSON.stringify(rollup, null, 2) + "\n",
      "utf8"
    );

    return {
      outputDir: resolvedOutputDir,
      recoveryBatchRollupPath
    };
  }
}

function analyzeGraphLikeInputToReadiness(
  graph: FaultTreeGraph | Record<string, unknown>,
  modelName?: string,
  options: OpenPraFaultTreeReadinessOptions = {}
): OpenPraFaultTreeReadinessResult {
  const converted = adaptFaultTreeGraphInput(graph);

  return analyzeLikelyOpenPraFaultTreeGraphReadiness(
    {
      faultTreeId: converted.faultTreeId,
      modelName,
      nodes: converted.nodes,
      edges: converted.edges
    },
    options
  );
}

function listFilesMatching(dirPath: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((entry) => pattern.test(entry))
    .map((entry) => path.join(dirPath, entry))
    .sort();
}

function listAllFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .map((entry) => path.join(dirPath, entry))
    .filter((entryPath) => fs.statSync(entryPath).isFile())
    .sort();
}
EOF

echo "==> Writing quantumReadiness.controller.ts"
cat > "${CONTROLLER_PATH}" <<'EOF'
import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenpraQuantumExecutionArtifactBundle,
  OpenpraQuantumExecutionArtifactFilesystemWriteResult,
  OpenpraQuantumPreparationArtifactBundle,
  OpenpraQuantumPreparationArtifactFilesystemWriteResult,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  OpenpraQuantumWorkflowRunScaffoldResult,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult
} from "quantum-readiness";

import {
  QuantumExecutionArtifactRawCountsRequest,
  QuantumReadinessService,
  type QuantumExecutionWorkflowRunResult,
  type QuantumFullPipelineWorkflowRunResult,
  type QuantumLatestWorkflowRunResult,
  type QuantumPreparationWorkflowRunResult,
  type QuantumRecoveryArtifactWriteResult,
  type QuantumRecoveryBatchRunInput,
  type QuantumRecoveryBatchRollupWriteResult,
  type QuantumRecoveryBatchWorkflowRunResult,
  type QuantumRecoveryWorkflowRunResult,
  type QuantumWorkflowRunInspectionResult,
  type QuantumWorkflowRunListingResult
} from "./quantumReadiness.service";

export interface QuantumReadinessGraphRequest {
  graph: FaultTreeGraph | Record<string, unknown>;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumReadinessGraphByIdRequest {
  faultTreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumPreparationArtifactsWriteRequest
  extends QuantumReadinessGraphRequest {
  outputDir: string;
}

export interface QuantumPreparationWorkflowRunRequest
  extends QuantumReadinessGraphRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
}

export interface QuantumPreparationWorkflowByIdRequest {
  rootDir: string;
  faultTreeId: string;
  subtreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

export interface QuantumExecutionArtifactRawCountsWriteRequest
  extends QuantumExecutionArtifactRawCountsRequest {
  outputDir: string;
}

export interface QuantumExecutionWorkflowRunRequest
  extends QuantumExecutionArtifactRawCountsRequest {
  rootDir: string;
}

export interface QuantumRecoveryWorkflowRunRequest {
  rootDir: string;
  candidateDir: string;
  modelId: string;
  subtreeId: string;
}

export interface QuantumRecoveryBatchWorkflowRunRequest {
  rootDir: string;
  batchRoot: string;
  modelId: string;
  subtreeId: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumFullPipelineWorkflowRunRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  graph?: FaultTreeGraph | Record<string, unknown>;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
  executionRequest?: QuantumExecutionArtifactRawCountsRequest;
  recoveryCandidateDir?: string;
  recoveryBatch?: QuantumRecoveryBatchRunInput;
}

export interface QuantumFullPipelineWorkflowByIdRequest {
  rootDir: string;
  faultTreeId: string;
  subtreeId: string;
  modelName?: string;
  options?: OpenPraFaultTreeReadinessOptions;
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
  executionRequest?: QuantumExecutionArtifactRawCountsRequest;
  recoveryCandidateDir?: string;
  recoveryBatch?: QuantumRecoveryBatchRunInput;
}

export interface QuantumWorkflowRunInspectionRequest {
  workflowRunDir: string;
}

export interface QuantumWorkflowRunListingRequest {
  rootDir: string;
}

export interface QuantumLatestWorkflowRunRequest {
  rootDir: string;
}

export interface QuantumRecoveryCandidateDirRequest {
  candidateDir: string;
}

export interface QuantumRecoveryCandidateDirWriteRequest {
  candidateDir: string;
  outputDir: string;
}

export interface QuantumRecoveryBatchRootRequest {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

export interface QuantumRecoveryBatchRootWriteRequest
  extends QuantumRecoveryBatchRootRequest {
  outputDir: string;
}

export interface QuantumWorkflowRunScaffoldRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  workflowKind:
    | "preparation"
    | "execution"
    | "recovery"
    | "recovery_batch"
    | "full_pipeline";
  requestedBy?: string;
  notes?: string[];
  createdAtUtc?: string;
}

@Controller()
export class QuantumReadinessController {
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

  @Post("/workflow/run-scaffold")
  @HttpCode(HttpStatus.OK)
  createWorkflowRunScaffold(
    @Body() body: QuantumWorkflowRunScaffoldRequest
  ): OpenpraQuantumWorkflowRunScaffoldResult {
    try {
      return this.quantumReadinessService.createWorkflowRunScaffold(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/inspect-run")
  @HttpCode(HttpStatus.OK)
  inspectWorkflowRun(
    @Body() body: QuantumWorkflowRunInspectionRequest
  ): QuantumWorkflowRunInspectionResult {
    try {
      return this.quantumReadinessService.inspectWorkflowRun(body.workflowRunDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/list-runs")
  @HttpCode(HttpStatus.OK)
  listWorkflowRuns(
    @Body() body: QuantumWorkflowRunListingRequest
  ): QuantumWorkflowRunListingResult {
    try {
      return this.quantumReadinessService.listWorkflowRuns(body.rootDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/latest-run")
  @HttpCode(HttpStatus.OK)
  getLatestWorkflowRun(
    @Body() body: QuantumLatestWorkflowRunRequest
  ): QuantumLatestWorkflowRunResult {
    try {
      return this.quantumReadinessService.getLatestWorkflowRun(body.rootDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/preparation-run")
  @HttpCode(HttpStatus.OK)
  createPreparationWorkflowRun(
    @Body() body: QuantumPreparationWorkflowRunRequest
  ): QuantumPreparationWorkflowRunResult {
    try {
      return this.quantumReadinessService.createPreparationWorkflowRun(
        body.rootDir,
        body.graph,
        body.modelId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/preparation-run/by-id")
  @HttpCode(HttpStatus.OK)
  async createPreparationWorkflowRunById(
    @Body() body: QuantumPreparationWorkflowByIdRequest
  ): Promise<QuantumPreparationWorkflowRunResult> {
    try {
      return await this.quantumReadinessService.createPreparationWorkflowRunById(
        body.rootDir,
        body.faultTreeId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/execution-run")
  @HttpCode(HttpStatus.OK)
  createExecutionWorkflowRun(
    @Body() body: QuantumExecutionWorkflowRunRequest
  ): QuantumExecutionWorkflowRunResult {
    try {
      return this.quantumReadinessService.createExecutionWorkflowRun(body.rootDir, {
        modelId: body.modelId,
        subtreeId: body.subtreeId,
        sourcePreparationArtifactId: body.sourcePreparationArtifactId,
        providerType: body.providerType,
        providerName: body.providerName,
        backendName: body.backendName,
        executionMode: body.executionMode,
        shots: body.shots,
        rawCounts: body.rawCounts,
        ...(body.jobIdOrRunId ? { jobIdOrRunId: body.jobIdOrRunId } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.metadata ? { metadata: body.metadata } : {})
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/recovery-run")
  @HttpCode(HttpStatus.OK)
  createRecoveryWorkflowRun(
    @Body() body: QuantumRecoveryWorkflowRunRequest
  ): QuantumRecoveryWorkflowRunResult {
    try {
      return this.quantumReadinessService.createRecoveryWorkflowRun(
        body.rootDir,
        body.candidateDir,
        body.modelId,
        body.subtreeId
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/recovery-batch-run")
  @HttpCode(HttpStatus.OK)
  createRecoveryBatchWorkflowRun(
    @Body() body: QuantumRecoveryBatchWorkflowRunRequest
  ): QuantumRecoveryBatchWorkflowRunResult {
    try {
      return this.quantumReadinessService.createRecoveryBatchWorkflowRun(
        body.rootDir,
        body.batchRoot,
        body.modelId,
        body.subtreeId,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only"
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/full-pipeline-run")
  @HttpCode(HttpStatus.OK)
  createFullPipelineWorkflowRun(
    @Body() body: QuantumFullPipelineWorkflowRunRequest
  ): QuantumFullPipelineWorkflowRunResult {
    try {
      return this.quantumReadinessService.createFullPipelineWorkflowRun(
        body.rootDir,
        body.modelId,
        body.subtreeId,
        body.graph,
        body.modelName,
        this.resolveOptions(body),
        body.executionRequest,
        body.recoveryCandidateDir,
        body.recoveryBatch
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/workflow/full-pipeline-run/by-id")
  @HttpCode(HttpStatus.OK)
  async createFullPipelineWorkflowRunById(
    @Body() body: QuantumFullPipelineWorkflowByIdRequest
  ): Promise<QuantumFullPipelineWorkflowRunResult> {
    try {
      return await this.quantumReadinessService.createFullPipelineWorkflowRunById(
        body.rootDir,
        body.faultTreeId,
        body.subtreeId,
        body.modelName,
        this.resolveOptions(body),
        body.executionRequest,
        body.recoveryCandidateDir,
        body.recoveryBatch
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraph(
    @Body() body: QuantumReadinessGraphRequest
  ): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparation(
    @Body() body: QuantumReadinessGraphRequest
  ): QuantumPreparationExport {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparation(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifacts(
    @Body() body: QuantumReadinessGraphRequest
  ): OpenpraQuantumPreparationArtifactBundle {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifacts(
        body.graph,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts/write")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    @Body() body: QuantumPreparationArtifactsWriteRequest
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        body.graph,
        body.outputDir,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphById(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<OpenPraFaultTreeReadinessResult> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphById(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparation(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<QuantumPreparationExport> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparation(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparationArtifacts(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body)
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCounts(
    @Body() body: QuantumExecutionArtifactRawCountsRequest
  ): OpenpraQuantumExecutionArtifactBundle {
    try {
      return this.quantumReadinessService.buildExecutionArtifactsFromRawCounts(body);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts/write")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCountsToFilesystem(
    @Body() body: QuantumExecutionArtifactRawCountsWriteRequest
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    try {
      return this.quantumReadinessService.buildExecutionArtifactsFromRawCountsToFilesystem(
        {
          modelId: body.modelId,
          subtreeId: body.subtreeId,
          sourcePreparationArtifactId: body.sourcePreparationArtifactId,
          providerType: body.providerType,
          providerName: body.providerName,
          backendName: body.backendName,
          executionMode: body.executionMode,
          shots: body.shots,
          rawCounts: body.rawCounts,
          ...(body.jobIdOrRunId ? { jobIdOrRunId: body.jobIdOrRunId } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...(body.metadata ? { metadata: body.metadata } : {})
        },
        body.outputDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDir(
    @Body() body: QuantumRecoveryCandidateDirRequest
  ): QuantumRecoveryLadderResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDir(body.candidateDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDirToFilesystem(
    @Body() body: QuantumRecoveryCandidateDirWriteRequest
  ): QuantumRecoveryArtifactWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDirToFilesystem(
        body.candidateDir,
        body.outputDir
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRoot(
    @Body() body: QuantumRecoveryBatchRootRequest
  ): OpenpraQuantumRecoveryBatchRollup {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRoot(
        body.batchRoot,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only"
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRootToFilesystem(
    @Body() body: QuantumRecoveryBatchRootWriteRequest
  ): QuantumRecoveryBatchRollupWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRootToFilesystem(
        body.batchRoot,
        body.outputDir,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only"
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private resolveOptions(
    body:
      | QuantumReadinessGraphRequest
      | QuantumReadinessGraphByIdRequest
      | QuantumPreparationWorkflowRunRequest
      | QuantumPreparationWorkflowByIdRequest
      | QuantumFullPipelineWorkflowRunRequest
      | QuantumFullPipelineWorkflowByIdRequest
  ): OpenPraFaultTreeReadinessOptions {
    return {
      ...(body.options ?? {}),
      ...(body.heuristics !== undefined ? { heuristics: body.heuristics } : {}),
      ...(body.analysis !== undefined ? { analysis: body.analysis } : {})
    };
  }

  private toHttpException(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : "Something went wrong";

    if (
      message.startsWith("No fault tree graph found for faultTreeId") ||
      message.startsWith("workflowRunDir does not exist") ||
      message.startsWith("rootDir does not exist")
    ) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    if (
      message.includes("candidateDir does not exist") ||
      message.includes("batchRoot does not exist") ||
      message.includes("Missing candidate artifact") ||
      message.includes("Missing package recovery result")
    ) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    return new HttpException(message, HttpStatus.BAD_REQUEST);
  }
}
EOF

echo "==> Writing quantumReadiness.latestWorkflowRun.http.spec.ts"
cat > "${HTTP_SPEC_PATH}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface LatestWorkflowRunHttpResponse {
  rootDir: string;
  latest: {
    workflowRunDir: string;
    workflowKind: string | null;
    createdAtUtc: string | null;
    manifestPath: string | null;
  } | null;
  inspection: {
    manifestPath: string | null;
    files: {
      preparationBundles: string[];
    };
  } | null;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP latest workflow run", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/quantum-readiness/workflow/latest-run returns newest workflow run with inspection summary", async () => {
    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-latest-workflow-root-")
    );

    const runOld = path.join(rootDir, "openpra_quantum_preparation_old");
    const runNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    fs.mkdirSync(path.join(runOld, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runNew, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runNew, "logs"), { recursive: true });

    writeJson(path.join(runOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z"
    });

    writeJson(path.join(runNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z"
    });

    writeJson(
      path.join(runNew, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"),
      { ok: true }
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/latest-run")
      .send({
        rootDir
      })
      .expect(200);

    const body = response.body as LatestWorkflowRunHttpResponse;

    expect(body.latest).not.toBeNull();
    expect(body.latest!.workflowKind).toBe("full_pipeline");
    expect(body.latest!.workflowRunDir).toContain("openpra_quantum_full_pipeline_new");
    expect(body.inspection).not.toBeNull();
    expect(body.inspection!.files.preparationBundles.length).toBe(1);
  });
});
EOF

echo "==> Running quantum-readiness tests"
if ./node_modules/.bin/nx test quantum-readiness > "${REPORT_DIR}/nx_test_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
fi

echo "==> Running web-backend tests"
if ./node_modules/.bin/nx test web-backend > "${REPORT_DIR}/nx_test_web_backend.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_web_backend.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_web_backend.status"
fi

echo "==> Running quantum-readiness build"
if ./node_modules/.bin/nx build quantum-readiness > "${REPORT_DIR}/nx_build_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
fi

echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "quantum-readiness test: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "web-backend test: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness build: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"

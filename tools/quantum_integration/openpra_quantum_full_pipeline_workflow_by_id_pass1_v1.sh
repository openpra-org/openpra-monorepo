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

REPORT_DIR="artifacts/quantum_integration/full_pipeline_workflow_by_id_pass1_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

SERVICE_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
CONTROLLER_PATH="packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
HTTP_SPEC_PATH="packages/web-backend/tests/quantumReadiness.fullPipelineWorkflowById.http.spec.ts"

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
  type QuantumPreparationWorkflowRunResult,
  type QuantumRecoveryArtifactWriteResult,
  type QuantumRecoveryBatchRunInput,
  type QuantumRecoveryBatchRollupWriteResult,
  type QuantumRecoveryBatchWorkflowRunResult,
  type QuantumRecoveryWorkflowRunResult
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

    if (message.startsWith("No fault tree graph found for faultTreeId")) {
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

echo "==> Writing quantumReadiness.fullPipelineWorkflowById.http.spec.ts"
cat > "${HTTP_SPEC_PATH}" <<'EOF'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { buildOpenpraQuantumRecoveryFromCandidateDir } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1
} from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface FullPipelineWorkflowByIdHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      preparation: string;
      execution: string;
      recovery: string;
      batch: string;
    };
  };
  preparationWrite?: {
    bundlePath: string;
    artifactPaths: string[];
  };
  executionWrite?: {
    executionArtifactPath: string;
    provenanceManifestPath: string;
  };
  recoveryWrite?: {
    recoveryArtifactPath: string;
  };
  batchWrite?: {
    recoveryBatchRollupPath: string;
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeCandidateArtifacts(
  candidateDir: string,
  modelId: string,
  candidateRootNodeId: string
): void {
  writeJson(path.join(candidateDir, "package_metadata.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3
  });

  writeJson(path.join(candidateDir, "raw_counts.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3,
    ordered_basic_event_ids: ["A", "B", "C"],
    bitstring_convention: "declared_order",
    counts: {
      "100": 50,
      "011": 30,
      "000": 20
    },
    shots_total: 100
  });

  writeJson(path.join(candidateDir, "classical_reference_mcs.json"), {
    modelId,
    candidateRootNodeId,
    frozenMcsReference: {
      minimalCutSetCount: 2,
      basicEventIdSets: [["A"], ["B", "C"]],
      bitstrings: ["100", "011"]
    }
  });
}

function makePackageRecoveryResult(candidateDir: string): void {
  const result = buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  writeJson(path.join(candidateDir, "openpra_package_recovery_result_v1.json"), result);
}

describe("QuantumReadiness HTTP full pipeline workflow run by id", () => {
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

  beforeEach(() => {
    graphModelServiceMock.getFaultTreeGraph.mockReset();
  });

  it("POST /api/quantum-readiness/workflow/full-pipeline-run/by-id creates scaffold and writes all available pipeline artifacts from stored graph", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(
      cloneOpenPraFixture(openPraNormalizedCase1)
    );

    const rootDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-full-pipeline-by-id-root-")
    );

    const candidateRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-full-pipeline-by-id-candidate-")
    );
    const recoveryCandidateDir = path.join(candidateRoot, "0001_phase2b_row_test");
    fs.mkdirSync(recoveryCandidateDir, { recursive: true });
    makeCandidateArtifacts(recoveryCandidateDir, "phase2b_row_test", "G:GTEST");

    const batchRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "qr-full-pipeline-by-id-batch-")
    );
    const candidateA = path.join(batchRoot, "0001_phase2b_row_a");
    const candidateB = path.join(batchRoot, "0002_phase2b_row_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });

    makeCandidateArtifacts(candidateA, "phase2b_row_a", "G:GA");
    makeCandidateArtifacts(candidateB, "phase2b_row_b", "G:GB");
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/full-pipeline-run/by-id")
      .send({
        rootDir,
        faultTreeId: "openpra_graph_case_1",
        subtreeId: "TOP",
        modelName: "Full Pipeline By Id Graph",
        executionRequest: {
          modelId: "openpra_graph_case_1",
          subtreeId: "TOP",
          sourcePreparationArtifactId: "preparation:openpra_graph_case_1:TOP:abc",
          providerType: "simulator",
          providerName: "qiskit-aer",
          backendName: "aer_simulator",
          executionMode: "counts_only",
          shots: 100,
          rawCounts: {
            "000": 10,
            "011": 30,
            "100": 60
          }
        },
        recoveryCandidateDir,
        recoveryBatch: {
          batchRoot,
          selectionMode: "package_result_only"
        }
      })
      .expect(200);

    const body = response.body as FullPipelineWorkflowByIdHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith(
      "openpra_graph_case_1"
    );

    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.preparation)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.execution)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.recovery)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.batch)).toBe(true);

    expect(body.preparationWrite).toBeDefined();
    expect(fs.existsSync(body.preparationWrite!.bundlePath)).toBe(true);
    expect(body.preparationWrite!.artifactPaths.length).toBeGreaterThan(0);

    expect(body.executionWrite).toBeDefined();
    expect(fs.existsSync(body.executionWrite!.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(body.executionWrite!.provenanceManifestPath)).toBe(true);

    expect(body.recoveryWrite).toBeDefined();
    expect(fs.existsSync(body.recoveryWrite!.recoveryArtifactPath)).toBe(true);

    expect(body.batchWrite).toBeDefined();
    expect(fs.existsSync(body.batchWrite!.recoveryBatchRollupPath)).toBe(true);
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

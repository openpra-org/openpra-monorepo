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
  type QuantumRecoveryLadderResult,
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
    request: OpenpraQuantumWorkflowRunScaffoldRequest,
  ): OpenpraQuantumWorkflowRunScaffoldResult {
    return buildOpenpraQuantumWorkflowRunScaffold(request);
  }

  createPreparationWorkflowRun(
    rootDir: string,
    graph: FaultTreeGraph | Record<string, unknown>,
    modelId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): QuantumPreparationWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "preparation",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
      graph,
      workflowRun.directories.preparation,
      modelName,
      options,
    );

    return {
      workflowRun,
      preparationWrite,
    };
  }

  async createPreparationWorkflowRunById(
    rootDir: string,
    faultTreeId: string,
    subtreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<QuantumPreparationWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return this.createPreparationWorkflowRun(rootDir, converted, faultTreeId, subtreeId, modelName, options);
  }

  createExecutionWorkflowRun(
    rootDir: string,
    request: QuantumExecutionArtifactRawCountsRequest,
  ): QuantumExecutionWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId: request.modelId,
      subtreeId: request.subtreeId,
      workflowKind: "execution",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const executionWrite = this.buildExecutionArtifactsFromRawCountsToFilesystem(
      request,
      workflowRun.directories.execution,
    );

    return {
      workflowRun,
      executionWrite,
    };
  }

  createRecoveryWorkflowRun(
    rootDir: string,
    candidateDir: string,
    modelId: string,
    subtreeId: string,
  ): QuantumRecoveryWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(candidateDir, workflowRun.directories.recovery);

    return {
      workflowRun,
      recoveryWrite,
    };
  }

  createRecoveryBatchWorkflowRun(
    rootDir: string,
    batchRoot: string,
    modelId: string,
    subtreeId: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): QuantumRecoveryBatchWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "recovery_batch",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
      batchRoot,
      workflowRun.directories.batch,
      candidateDirs,
      selectionMode,
    );

    return {
      workflowRun,
      batchWrite,
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
    recoveryBatch?: QuantumRecoveryBatchRunInput,
  ): QuantumFullPipelineWorkflowRunResult {
    const workflowRun = this.createWorkflowRunScaffold({
      rootDir,
      modelId,
      subtreeId,
      workflowKind: "full_pipeline",
      requestedBy: "web-backend:quantumReadiness.service",
    });

    const result: QuantumFullPipelineWorkflowRunResult = {
      workflowRun,
    };

    if (graph) {
      result.preparationWrite = this.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        graph,
        workflowRun.directories.preparation,
        modelName,
        options,
      );
    }

    if (executionRequest) {
      result.executionWrite = this.buildExecutionArtifactsFromRawCountsToFilesystem(
        executionRequest,
        workflowRun.directories.execution,
      );
    }

    if (recoveryCandidateDir) {
      result.recoveryWrite = this.analyzeRecoveryCandidateDirToFilesystem(
        recoveryCandidateDir,
        workflowRun.directories.recovery,
      );
    }

    if (recoveryBatch) {
      result.batchWrite = this.analyzeRecoveryBatchRootToFilesystem(
        recoveryBatch.batchRoot,
        workflowRun.directories.batch,
        recoveryBatch.candidateDirs,
        recoveryBatch.selectionMode ?? "package_result_only",
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
    recoveryBatch?: QuantumRecoveryBatchRunInput,
  ): Promise<QuantumFullPipelineWorkflowRunResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

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
      recoveryBatch,
    );
  }

  analyzeFaultTreeGraph(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenPraFaultTreeReadinessResult {
    return analyzeGraphLikeInputToReadiness(graph, modelName, options);
  }

  analyzeFaultTreeGraphPreparation(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): QuantumPreparationExport {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);

    return buildQuantumPreparationExport(readinessResult.normalizedFaultTree, readinessResult.report);
  }

  analyzeFaultTreeGraphPreparationArtifacts(
    graph: FaultTreeGraph | Record<string, unknown>,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenpraQuantumPreparationArtifactBundle {
    const readinessResult = analyzeGraphLikeInputToReadiness(graph, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report,
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    graph: FaultTreeGraph | Record<string, unknown>,
    outputDir: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    const bundle = this.analyzeFaultTreeGraphPreparationArtifacts(graph, modelName, options);

    return writeOpenpraQuantumPreparationArtifactBundleToFilesystem(bundle, outputDir);
  }

  async analyzeFaultTreeGraphById(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<OpenPraFaultTreeReadinessResult> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return analyzeGraphLikeInputToReadiness(converted, modelName, options);
  }

  async analyzeFaultTreeGraphByIdPreparation(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<QuantumPreparationExport> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(converted, modelName, options);

    return buildQuantumPreparationExport(readinessResult.normalizedFaultTree, readinessResult.report);
  }

  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {},
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    const graph = (await this.graphModelService.getFaultTreeGraph(faultTreeId)) as
      | FaultTreeGraph
      | Record<string, unknown>;

    const converted = adaptFaultTreeGraphInput(graph, faultTreeId);

    if (!converted.nodes || converted.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    const readinessResult = analyzeGraphLikeInputToReadiness(converted, modelName, options);
    const clQuboExport = buildQuantumPreparationClQuboExport(
      readinessResult.normalizedFaultTree,
      readinessResult.report,
    );

    return buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  buildExecutionArtifactsFromRawCounts(
    request: QuantumExecutionArtifactRawCountsRequest,
  ): OpenpraQuantumExecutionArtifactBundle {
    return buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(request, {
      createdBy: "web-backend:quantumReadiness.service",
    });
  }

  buildExecutionArtifactsFromRawCountsToFilesystem(
    request: QuantumExecutionArtifactRawCountsRequest,
    outputDir: string,
  ): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
    const bundle = this.buildExecutionArtifactsFromRawCounts(request);

    return writeOpenpraQuantumExecutionArtifactBundleToFilesystem(bundle, outputDir);
  }

  analyzeRecoveryCandidateDir(candidateDir: string): QuantumRecoveryLadderResult {
    return buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  }

  analyzeRecoveryCandidateDirToFilesystem(candidateDir: string, outputDir: string): QuantumRecoveryArtifactWriteResult {
    const result = this.analyzeRecoveryCandidateDir(candidateDir);
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryArtifactPath = path.join(resolvedOutputDir, "openpra_quantum_recovery_artifact_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(recoveryArtifactPath, JSON.stringify(result, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      recoveryArtifactPath,
    };
  }

  analyzeRecoveryBatchRoot(
    batchRoot: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): OpenpraQuantumRecoveryBatchRollup {
    return buildOpenpraQuantumRecoveryBatchRollupFromBatchRoot(batchRoot, candidateDirs, selectionMode);
  }

  analyzeRecoveryBatchRootToFilesystem(
    batchRoot: string,
    outputDir: string,
    candidateDirs?: string[],
    selectionMode: OpenpraQuantumRecoveryBatchSelectionMode = "package_result_only",
  ): QuantumRecoveryBatchRollupWriteResult {
    const rollup = this.analyzeRecoveryBatchRoot(batchRoot, candidateDirs, selectionMode);
    const resolvedOutputDir = path.resolve(outputDir);
    const recoveryBatchRollupPath = path.join(resolvedOutputDir, "openpra_quantum_recovery_batch_rollup_v1.json");

    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    fs.writeFileSync(recoveryBatchRollupPath, JSON.stringify(rollup, null, 2) + "\n", "utf8");

    return {
      outputDir: resolvedOutputDir,
      recoveryBatchRollupPath,
    };
  }
}

function analyzeGraphLikeInputToReadiness(
  graph: FaultTreeGraph | Record<string, unknown>,
  modelName?: string,
  options: OpenPraFaultTreeReadinessOptions = {},
): OpenPraFaultTreeReadinessResult {
  const converted = adaptFaultTreeGraphInput(graph);

  return analyzeLikelyOpenPraFaultTreeGraphReadiness(
    {
      faultTreeId: converted.faultTreeId,
      modelName,
      nodes: converted.nodes,
      edges: converted.edges,
    },
    options,
  );
}

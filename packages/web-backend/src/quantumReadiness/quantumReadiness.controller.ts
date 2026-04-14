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
  QuantumPreparationExport,
  QuantumRecoveryLadderResult,
} from "quantum-readiness";

import {
  QuantumExecutionArtifactRawCountsRequest,
  QuantumReadinessService,
  type QuantumRecoveryArtifactWriteResult,
  type QuantumRecoveryBatchRollupWriteResult,
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

export interface QuantumPreparationArtifactsWriteRequest extends QuantumReadinessGraphRequest {
  outputDir: string;
}

export interface QuantumExecutionArtifactRawCountsWriteRequest extends QuantumExecutionArtifactRawCountsRequest {
  outputDir: string;
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

export interface QuantumRecoveryBatchRootWriteRequest extends QuantumRecoveryBatchRootRequest {
  outputDir: string;
}

@Controller()
export class QuantumReadinessController {
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

  @Post("/fault-tree-graph")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraph(@Body() body: QuantumReadinessGraphRequest): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(body.graph, body.modelName, this.resolveOptions(body));
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparation(@Body() body: QuantumReadinessGraphRequest): QuantumPreparationExport {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparation(
        body.graph,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifacts(
    @Body() body: QuantumReadinessGraphRequest,
  ): OpenpraQuantumPreparationArtifactBundle {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifacts(
        body.graph,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/preparation-artifacts/write")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
    @Body() body: QuantumPreparationArtifactsWriteRequest,
  ): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraphPreparationArtifactsToFilesystem(
        body.graph,
        body.outputDir,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphById(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<OpenPraFaultTreeReadinessResult> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphById(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparation(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<QuantumPreparationExport> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparation(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/fault-tree-graph/by-id/preparation-artifacts")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphByIdPreparationArtifacts(
    @Body() body: QuantumReadinessGraphByIdRequest,
  ): Promise<OpenpraQuantumPreparationArtifactBundle> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphByIdPreparationArtifacts(
        body.faultTreeId,
        body.modelName,
        this.resolveOptions(body),
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/execution/artifacts/raw-counts")
  @HttpCode(HttpStatus.OK)
  buildExecutionArtifactsFromRawCounts(
    @Body() body: QuantumExecutionArtifactRawCountsRequest,
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
    @Body() body: QuantumExecutionArtifactRawCountsWriteRequest,
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
          ...(body.metadata ? { metadata: body.metadata } : {}),
        },
        body.outputDir,
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDir(@Body() body: QuantumRecoveryCandidateDirRequest): QuantumRecoveryLadderResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDir(body.candidateDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/candidate-dir/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDirToFilesystem(
    @Body() body: QuantumRecoveryCandidateDirWriteRequest,
  ): QuantumRecoveryArtifactWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDirToFilesystem(body.candidateDir, body.outputDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRoot(@Body() body: QuantumRecoveryBatchRootRequest): OpenpraQuantumRecoveryBatchRollup {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRoot(
        body.batchRoot,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only",
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post("/recovery/batch-root/write")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryBatchRootToFilesystem(
    @Body() body: QuantumRecoveryBatchRootWriteRequest,
  ): QuantumRecoveryBatchRollupWriteResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryBatchRootToFilesystem(
        body.batchRoot,
        body.outputDir,
        body.candidateDirs,
        body.selectionMode ?? "package_result_only",
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private resolveOptions(
    body: QuantumReadinessGraphRequest | QuantumReadinessGraphByIdRequest,
  ): OpenPraFaultTreeReadinessOptions {
    return {
      ...(body.options ?? {}),
      ...(body.heuristics !== undefined ? { heuristics: body.heuristics } : {}),
      ...(body.analysis !== undefined ? { analysis: body.analysis } : {}),
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

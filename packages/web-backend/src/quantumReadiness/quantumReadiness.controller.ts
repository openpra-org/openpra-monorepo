import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type {
  OpenPraFaultTreeReadinessOptions,
  OpenPraFaultTreeReadinessResult,
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchSelectionMode,
  QuantumPreparationExport,
  QuantumRecoveryLadderResult,
} from "quantum-readiness";

import { QuantumReadinessService } from "./quantumReadiness.service";

/**
 * Request body for quantum readiness analysis of a fault tree graph.
 */
export interface QuantumReadinessGraphRequest {
  /**
   * Fault tree graph payload shaped like the shared OpenPRA graph contract,
   * or a normalized OpenPRA graph object.
   */
  graph: FaultTreeGraph | Record<string, unknown>;

  /**
   * Optional human readable model name.
   */
  modelName?: string;

  /**
   * Optional legacy wrapper for heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;

  /**
   * Optional top-level heuristics overrides.
   */
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];

  /**
   * Optional top-level readiness analysis overrides.
   */
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

/**
 * Request body for quantum readiness analysis by stored faultTreeId.
 */
export interface QuantumReadinessGraphByIdRequest {
  /**
   * Existing fault tree identifier used by the graph model layer.
   */
  faultTreeId: string;

  /**
   * Optional human readable model name.
   */
  modelName?: string;

  /**
   * Optional legacy wrapper for heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;

  /**
   * Optional top-level heuristics overrides.
   */
  heuristics?: OpenPraFaultTreeReadinessOptions["heuristics"];

  /**
   * Optional top-level readiness analysis overrides.
   */
  analysis?: OpenPraFaultTreeReadinessOptions["analysis"];
}

/**
 * Request body for filesystem-backed single-case recovery.
 */
export interface QuantumRecoveryCandidateDirRequest {
  candidateDir: string;
}

/**
 * Request body for filesystem-backed batch recovery rollup.
 */
export interface QuantumRecoveryBatchRootRequest {
  batchRoot: string;
  candidateDirs?: string[];
  selectionMode?: OpenpraQuantumRecoveryBatchSelectionMode;
}

/**
 * Controller for quantum readiness analysis endpoints.
 */
@Controller()
export class QuantumReadinessController {
  /**
   * Construct controller with quantum readiness service dependency.
   *
   * @param quantumReadinessService - Service that performs graph readiness analysis
   */
  constructor(private readonly quantumReadinessService: QuantumReadinessService) {}

  /**
   * Analyze a fault tree graph for quantum readiness.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph
   */
  @Post("/fault-tree-graph")
  @HttpCode(HttpStatus.OK)
  analyzeFaultTreeGraph(@Body() body: QuantumReadinessGraphRequest): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(body.graph, body.modelName, this.resolveOptions(body));
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Analyze a fault tree graph and export deterministic preparation payloads.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/preparation
   */
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

  /**
   * Retrieve a stored fault tree graph by id and analyze it for readiness.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/by-id
   */
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

  /**
   * Retrieve a stored fault tree graph by id and export deterministic preparation payloads.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/by-id/preparation
   */
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

  /**
   * Build a validated quantum recovery result from a single candidate directory.
   *
   * Mounted under:
   * /api/quantum-readiness/recovery/candidate-dir
   */
  @Post("/recovery/candidate-dir")
  @HttpCode(HttpStatus.OK)
  analyzeRecoveryCandidateDir(@Body() body: QuantumRecoveryCandidateDirRequest): QuantumRecoveryLadderResult {
    try {
      return this.quantumReadinessService.analyzeRecoveryCandidateDir(body.candidateDir);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Build a batch recovery rollup from a batch root.
   *
   * Mounted under:
   * /api/quantum-readiness/recovery/batch-root
   */
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

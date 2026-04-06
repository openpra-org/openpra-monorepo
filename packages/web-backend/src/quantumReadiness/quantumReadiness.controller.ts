import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import type { OpenPraFaultTreeReadinessOptions } from "quantum-readiness";
import type { OpenPraFaultTreeReadinessResult } from "quantum-readiness";

import { QuantumReadinessService } from "./quantumReadiness.service";

/**
 * Request body for quantum readiness analysis of a fault tree graph.
 */
export interface QuantumReadinessGraphRequest {
  /**
   * Fault tree graph payload shaped like the shared OpenPRA graph contract.
   */
  graph: FaultTreeGraph;

  /**
   * Optional human readable model name.
   */
  modelName?: string;

  /**
   * Optional heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;
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
   * Optional heuristics and readiness analysis overrides.
   */
  options?: OpenPraFaultTreeReadinessOptions;
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
  analyzeFaultTreeGraph(
    @Body() body: QuantumReadinessGraphRequest
  ): OpenPraFaultTreeReadinessResult {
    try {
      return this.quantumReadinessService.analyzeFaultTreeGraph(
        body.graph,
        body.modelName,
        body.options ?? {}
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * Retrieve a stored fault tree graph by id and analyze it for quantum readiness.
   *
   * Mounted under:
   * /api/quantum-readiness/fault-tree-graph/by-id
   */
  @Post("/fault-tree-graph/by-id")
  @HttpCode(HttpStatus.OK)
  async analyzeFaultTreeGraphById(
    @Body() body: QuantumReadinessGraphByIdRequest
  ): Promise<OpenPraFaultTreeReadinessResult> {
    try {
      return await this.quantumReadinessService.analyzeFaultTreeGraphById(
        body.faultTreeId,
        body.modelName,
        body.options ?? {}
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : "Something went wrong";

    if (message.startsWith("No fault tree graph found for faultTreeId")) {
      return new HttpException(message, HttpStatus.NOT_FOUND);
    }

    return new HttpException(message, HttpStatus.BAD_REQUEST);
  }
}

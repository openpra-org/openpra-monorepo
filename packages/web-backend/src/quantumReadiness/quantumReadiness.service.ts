import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult
} from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";

/**
 * Backend integration service for quantum readiness analysis of fault tree graphs.
 *
 * This is the backend-side seam into the quantum-readiness package.
 * It supports direct graph analysis and graph lookup by faultTreeId.
 */
@Injectable()
export class QuantumReadinessService {
  /**
   * Construct the service with graph model lookup support.
   *
   * @param graphModelService - Existing backend service for retrieving stored graph models
   */
  constructor(private readonly graphModelService: GraphModelService) {}

  /**
   * Analyze a shared FaultTreeGraph using the default OpenPRA heuristics.
   *
   * @param graph - Fault tree graph with nodes and edges
   * @param modelName - Optional human-readable model name
   * @param options - Optional heuristics and readiness analysis overrides
   * @returns End-to-end readiness analysis result
   */
  analyzeFaultTreeGraph(
    graph: FaultTreeGraph,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): OpenPraFaultTreeReadinessResult {
    return analyzeLikelyOpenPraFaultTreeGraphToReadiness(graph, modelName, options);
  }

  /**
   * Retrieve a stored fault tree graph by id and analyze it for readiness.
   *
   * @param faultTreeId - Fault tree identifier used by the existing graph model layer
   * @param modelName - Optional human-readable model name override
   * @param options - Optional heuristics and readiness analysis overrides
   * @returns End-to-end readiness analysis result
   */
  async analyzeFaultTreeGraphById(
    faultTreeId: string,
    modelName?: string,
    options: OpenPraFaultTreeReadinessOptions = {}
  ): Promise<OpenPraFaultTreeReadinessResult> {
    const graph = await this.graphModelService.getFaultTreeGraph(faultTreeId);

    if (!graph.nodes || graph.nodes.length === 0) {
      throw new Error(`No fault tree graph found for faultTreeId ${faultTreeId}.`);
    }

    return analyzeLikelyOpenPraFaultTreeGraphToReadiness(graph, modelName, options);
  }
}

function analyzeLikelyOpenPraFaultTreeGraphToReadiness(
  graph: FaultTreeGraph,
  modelName?: string,
  options: OpenPraFaultTreeReadinessOptions = {}
): OpenPraFaultTreeReadinessResult {
  return analyzeLikelyOpenPraFaultTreeGraphReadiness(
    {
      faultTreeId: graph.faultTreeId,
      modelName,
      nodes: graph.nodes,
      edges: graph.edges
    },
    options
  );
}

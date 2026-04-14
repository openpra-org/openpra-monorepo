import { Injectable } from "@nestjs/common";
import type { FaultTreeGraph } from "shared-types";
import {
  analyzeLikelyOpenPraFaultTreeGraphReadiness,
  buildQuantumPreparationExport,
  type OpenPraFaultTreeReadinessOptions,
  type OpenPraFaultTreeReadinessResult,
  type QuantumPreparationExport,
} from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { adaptFaultTreeGraphInput } from "./openPraFaultTreeGraph.adapter";

/**
 * Backend integration service for quantum readiness analysis of fault tree graphs.
 *
 * This is the backend side seam into the quantum readiness package.
 * It supports direct graph analysis and graph lookup by faultTreeId.
 */
@Injectable()
export class QuantumReadinessService {
  constructor(private readonly graphModelService: GraphModelService) {}

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

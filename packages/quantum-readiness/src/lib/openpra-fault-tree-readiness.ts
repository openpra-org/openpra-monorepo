import type {
  AnalyzeFaultTreeReadinessOptions,
  NormalizedFaultTree,
  QuantumReadinessReport
} from "./types";
import type { OpenPraFaultTreeGraphInput } from "./openpra-fault-tree-graph-adapter";
import type { LikelyOpenPraFaultTreeGraphHeuristicOverrides } from "./openpra-fault-tree-graph-heuristics";

import { adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree } from "./openpra-fault-tree-graph-heuristics";
import { analyzeFaultTreeReadiness, buildReadinessSummary } from "./quantum-readiness";

/**
 * Options for graph-to-readiness analysis using the default OpenPRA heuristics.
 */
export interface OpenPraFaultTreeReadinessOptions {
  /**
   * Optional overrides for graph node classification and interpretation.
   */
  heuristics?: LikelyOpenPraFaultTreeGraphHeuristicOverrides;

  /**
   * Optional readiness analysis options.
   */
  analysis?: AnalyzeFaultTreeReadinessOptions;
}

/**
 * Result of a full graph-to-readiness pass.
 */
export interface OpenPraFaultTreeReadinessResult {
  /**
   * The normalized fault tree derived from the graph.
   */
  normalizedFaultTree: NormalizedFaultTree;

  /**
   * The structured readiness report.
   */
  report: QuantumReadinessReport;

  /**
   * Human readable markdown summary.
   */
  summaryMarkdown: string;
}

/**
 * Analyze a likely OpenPRA fault tree graph end to end.
 *
 * This is the first package-level integration seam intended for later use by
 * web-backend or other callers. It takes a graph shaped like FaultTreeGraph,
 * adapts it into the normalized readiness model, runs the readiness analysis,
 * and returns both structured and human-readable outputs.
 */
export function analyzeLikelyOpenPraFaultTreeGraphReadiness(
  input: OpenPraFaultTreeGraphInput,
  options: OpenPraFaultTreeReadinessOptions = {}
): OpenPraFaultTreeReadinessResult {
  const normalizedFaultTree = adaptLikelyOpenPraFaultTreeGraphToNormalizedFaultTree(
    input,
    options.heuristics ?? {}
  );

  const report = analyzeFaultTreeReadiness(normalizedFaultTree, options.analysis ?? {});
  const summaryMarkdown = buildReadinessSummary(report);

  return {
    normalizedFaultTree,
    report,
    summaryMarkdown
  };
}

import type { FaultTreeGraph } from "./reactflowGraph/Graph";

export type FaultTreeAlgorithm = "bdd" | "zbdd";

export type FaultTreeApproximation = "rare_event" | "mcub";

export interface FaultTreeQuantificationRequest {
  graph: FaultTreeGraph;
  algorithm: FaultTreeAlgorithm;
  approximation?: FaultTreeApproximation;
  /** Maximum cut-set order (number of events). Omit to enumerate all orders. */
  maxOrder?: number;
  /** Probability truncation limit. Cut sets with probability below this value are excluded. */
  truncation?: number;
  transferTrees?: Record<string, FaultTreeGraph>;
}

export interface CutSetResult {
  events: string[];
  probability: number;
  contribution: number;
}

/** Per-order row from Table 2 of the WORKFLOW.md metadata display. */
export interface OrderStats {
  order: number;
  count: number;
  minProbability: number;
  maxProbability: number;
}

export interface ZbddDiagnostics {
  numNodes: number;
  numVariables: number;
  numProducts: number;
  maxProductSize: number;
}

export interface FaultTreeQuantificationResult {
  algorithm: FaultTreeAlgorithm;
  approximation?: FaultTreeApproximation;
  topEventProbability: number;
  cutSets: CutSetResult[];
  /** Per-order MCS distribution (count, min/max probability). Present for ZBDD results. */
  orderStats?: OrderStats[];
  zbddDiagnostics?: ZbddDiagnostics;
}

/**
 * Result of Phase 1 (Analyze): exact probability from BDD sweep + ZBDD order distribution.
 * No cut sets are enumerated. Used to show the user the shape of the result before they
 * decide on order/truncation limits.
 */
export interface FaultTreeMetadataResult {
  /** Exact top-event probability from BDD sweep. */
  topEventProbability: number;
  /** Per-order MCS count and probability range, derived from the full (unfiltered) ZBDD. */
  orderStats: OrderStats[];
}

import type { FaultTreeGraph } from "./reactflowGraph/Graph";

export type FaultTreeAlgorithm = "bdd" | "zbdd" | "mocus";

export type FaultTreeApproximation = "rare_event" | "mcub";

export interface FaultTreeQuantificationRequest {
  graph: FaultTreeGraph;
  algorithm: FaultTreeAlgorithm;
  approximation?: FaultTreeApproximation;
  maxOrder?: number;
  transferTrees?: Record<string, FaultTreeGraph>;
}

export interface CutSetResult {
  events: string[];
  probability: number;
  contribution: number;
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
  zbddDiagnostics?: ZbddDiagnostics;
}

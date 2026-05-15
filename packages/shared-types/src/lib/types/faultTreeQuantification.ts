import type { FaultTreeGraph } from "./reactflowGraph/Graph";
export type FaultTreeAlgorithm = "bdd" | "zbdd";
export type FaultTreeApproximation = "rare_event" | "mcub";
export interface FaultTreeQuantificationRequest {
  graph: FaultTreeGraph;
  algorithm: FaultTreeAlgorithm;
  approximation?: FaultTreeApproximation;
  maxOrder?: number;
  truncation?: number;
  transferTrees?: Record<string, FaultTreeGraph>;
}
export interface CutSetResult {
  events: string[];
  probability: number;
  contribution: number;
}
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
  orderStats?: OrderStats[];
  zbddDiagnostics?: ZbddDiagnostics;
}
export interface FaultTreeMetadataResult {
  topEventProbability: number;
  orderStats: OrderStats[];
}

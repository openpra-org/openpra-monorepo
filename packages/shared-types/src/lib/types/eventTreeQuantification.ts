import type { EventTreeGraph } from "./reactflowGraph/Graph";

export type EventTreeAlgorithm = "bdd" | "zbdd" | "mocus" | "monte_carlo";

export interface EventTreeQuantificationRequest {
  graph?: EventTreeGraph;
  algorithm: EventTreeAlgorithm;
}

export interface EventTreeCutSet {
  events: string[];
  probability: number;
  contribution: number;
}

export interface EventTreeSequenceResult {
  sequenceId: string;
  frequency: number;
  cutSets: EventTreeCutSet[];
}

export interface EventTreeQuantificationResult {
  algorithm: EventTreeAlgorithm;
  sequences: EventTreeSequenceResult[];
}

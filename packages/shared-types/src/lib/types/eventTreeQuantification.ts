import type { EventTreeGraph } from "./reactflowGraph/Graph";

export type EventTreeAlgorithm = "bdd" | "zbdd" | "mocus" | "monte_carlo";

export type EventTreeApproximation = "rare_event" | "mcub";

export interface EventTreeQuantificationRequest {
  graph?: EventTreeGraph;
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  maxOrder?: number;
  numSamples?: number;
}

export interface EventTreeCutSet {
  events: string[];
  probability: number;
  contribution: number;
}

export interface EventTreeSequenceResult {
  sequenceId: string;
  frequency: number;
  probability?: number;
  path?: Array<{ functionalEventId: string; state: string }>;
  cutSets: EventTreeCutSet[];
}

export interface EventTreeQuantificationResult {
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  totalCdf?: number;
  numSamples?: number;
  sequences: EventTreeSequenceResult[];
}

import type { EventTreeGraph } from "./reactflowGraph/Graph";

export type EventTreeAlgorithm = "bdd" | "zbdd";

export type EventTreeApproximation = "rare_event" | "mcub";

export interface EventTreeQuantificationRequest {
  graph?: EventTreeGraph;
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  /** Maximum cut-set order (number of events). Omit to enumerate all orders. */
  maxOrder?: number;
  /** Probability truncation limit. Cut sets with probability below this value are excluded. */
  truncation?: number;
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

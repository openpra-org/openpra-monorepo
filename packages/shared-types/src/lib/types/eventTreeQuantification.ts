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

/** One row of the per-order MCS distribution table (WORKFLOW.md Table 2). */
export interface EventTreeOrderStat {
  order: number;
  count: number;
  minFrequency: number;
  maxFrequency: number;
}

/** Compact per-sequence entry returned by Phase 1 (Analyze). */
export interface EventTreeSequenceSummary {
  sequenceId: string;
  frequency: number;
  /** Per-order MCS distribution (Table 2). Present only when returned by getEventTreeMetadata. */
  orderStats?: EventTreeOrderStat[];
}

/**
 * Phase 1 (Analyze) result for an event tree.
 * Contains exact sequence frequencies and per-order MCS distribution without cut-set enumeration.
 */
export interface EventTreeMetadataResult {
  totalCdf: number;
  sequences: EventTreeSequenceSummary[];
}

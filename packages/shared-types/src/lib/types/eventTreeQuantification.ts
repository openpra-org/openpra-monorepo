import type { EventTreeGraph } from "./reactflowGraph/Graph";
export type EventTreeAlgorithm = "bdd" | "zbdd";
export type EventTreeApproximation = "rare_event" | "mcub";
export interface EventTreeQuantificationRequest {
  graph?: EventTreeGraph;
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  maxOrder?: number;
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
  path?: Array<{
    functionalEventId: string;
    state: string;
  }>;
  cutSets: EventTreeCutSet[];
}
export interface EventTreeQuantificationResult {
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  totalCdf?: number;
  numSamples?: number;
  sequences: EventTreeSequenceResult[];
}
export interface EventTreeOrderStat {
  order: number;
  count: number;
  minFrequency: number;
  maxFrequency: number;
}
export interface EventTreeSequenceSummary {
  sequenceId: string;
  frequency: number;
  orderStats?: EventTreeOrderStat[];
}
export interface EventTreeMetadataResult {
  totalCdf: number;
  sequences: EventTreeSequenceSummary[];
}

/**
 * DTOs for fault-tree quantification via the praxis engine.
 * Used by the backend API and the frontend UI.
 */

import type { FaultTreeGraph } from "./reactflowGraph/Graph";

// ─── Algorithm / approximation enums ─────────────────────────────────────────

/** Quantification algorithm selection. */
export type FaultTreeAlgorithm = "bdd" | "zbdd" | "mocus";

/**
 * Approximation method for top-event probability.
 * Only relevant for `zbdd` and `mocus` algorithms.
 * - `rare_event` — P(top) ≈ Σ P(MCS_i)
 * - `mcub`       — P(top) ≈ 1 − ∏(1 − P(MCS_i))
 */
export type FaultTreeApproximation = "rare_event" | "mcub";

// ─── Request ──────────────────────────────────────────────────────────────────

/** Sent by the frontend to `POST /fault-tree/:id/quantify`. */
export interface FaultTreeQuantificationRequest {
  /** The MEF fault-tree graph to quantify. */
  graph: FaultTreeGraph;
  /** Algorithm to use. */
  algorithm: FaultTreeAlgorithm;
  /**
   * Approximation method.
   * Required for `zbdd` and `mocus`; ignored for `bdd`.
   */
  approximation?: FaultTreeApproximation;
  /**
   * Maximum cut-set order (number of events per set).
   * If omitted the engine enumerates all orders.
   */
  maxOrder?: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

/** A single minimal cut set in the quantification result. */
export interface CutSetResult {
  /** Human-readable event names that form this cut set. */
  events: string[];
  /** Joint probability of all events in the cut set failing. */
  probability: number;
  /**
   * Fractional contribution of this cut set to the top-event probability.
   * contribution = cutSetProbability / topEventProbability.
   */
  contribution: number;
}

/** Returned by `POST /fault-tree/:id/quantify`. */
export interface FaultTreeQuantificationResult {
  /** Algorithm that was used. */
  algorithm: FaultTreeAlgorithm;
  /** Approximation that was applied (undefined for BDD). */
  approximation?: FaultTreeApproximation;
  /** Top-event probability. */
  topEventProbability: number;
  /**
   * Minimal cut sets, sorted by increasing probability.
   * Empty when `algorithm === "bdd"`.
   */
  cutSets: CutSetResult[];
}

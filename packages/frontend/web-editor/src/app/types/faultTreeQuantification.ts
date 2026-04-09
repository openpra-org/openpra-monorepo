/**
 * Probability / quantification data attached to each fault tree node.
 * Gates carry only name/description; leaf nodes carry the full quantification.
 */

// ---------------------------------------------------------------------------
// Top-level probability type
// ---------------------------------------------------------------------------

export type ProbabilityType = "constant" | "distribution" | "bayesian_network_link";

// ---------------------------------------------------------------------------
// Distribution event category
// ---------------------------------------------------------------------------

/** Whether the failure is modelled as a per-demand probability or a rate over time */
export type EventType = "on_demand" | "during_operation";

// ---------------------------------------------------------------------------
// Distribution sub-types per event category
// ---------------------------------------------------------------------------

/** Distributions applicable to on-demand failures (probability per demand) */
export type OnDemandDistributionType = "lognormal" | "beta" | "normal" | "uniform";

/** Distributions applicable to time-based / during-operation failures */
export type DuringOperationDistributionType = "exponential" | "weibull" | "gamma" | "lognormal";

export type DistributionType = OnDemandDistributionType | DuringOperationDistributionType;

// ---------------------------------------------------------------------------
// Distribution parameter shapes
// ---------------------------------------------------------------------------

export interface LognormalParams {
  /** Median of the lognormal distribution (geometric mean) */
  median: number;
  /** Error factor EF = exp(1.645 × σ); relates to the spread */
  errorFactor: number;
}

export interface BetaParams {
  /** Shape parameter α (successes + 1 in Bayesian sense) */
  alpha: number;
  /** Shape parameter β (failures + 1 in Bayesian sense) */
  betaParam: number;
}

export interface NormalParams {
  mean: number;
  stdDev: number;
}

export interface UniformParams {
  lower: number;
  upper: number;
}

export interface ExponentialParams {
  /** Failure rate λ in failures per hour */
  failureRate: number;
}

export interface WeibullParams {
  /** Scale parameter (characteristic life) λ */
  scale: number;
  /** Shape parameter β — β>1 ageing, β=1 random, β<1 infant mortality */
  shape: number;
  /** Location / threshold parameter γ (usually 0) */
  location: number;
}

export interface GammaParams {
  /** Shape parameter α */
  shape: number;
  /** Rate parameter β = 1 / scale */
  rate: number;
}

export interface LognormalTimeParams {
  /** Log-mean μ (natural log scale) */
  mean: number;
  stdDev: number;
}

export type DistributionParams =
  | LognormalParams
  | BetaParams
  | NormalParams
  | UniformParams
  | ExponentialParams
  | WeibullParams
  | GammaParams
  | LognormalTimeParams;

// ---------------------------------------------------------------------------
// House event state (no probability — deterministic true/false)
// ---------------------------------------------------------------------------

export type HouseEventState = "true" | "false";

// ---------------------------------------------------------------------------
// Full node quantification record
// ---------------------------------------------------------------------------

export interface FaultTreeNodeQuantification {
  /** Human-readable name / identifier (e.g. "P-001A-FAIL-TO-RUN") */
  name: string;
  /** Free-text description */
  description: string;

  // ── Leaf-node probability ────────────────────────────────────────────────
  probabilityType: ProbabilityType;

  // Constant branch
  constantValue?: number;

  // Distribution branch
  eventType?: EventType;
  distributionType?: DistributionType;
  distributionParams?: DistributionParams;

  // Bayesian Network Link branch
  bayesianNetworkId?: number;
  bayesianNetworkNodeId?: string;

  // ── House event state ────────────────────────────────────────────────────
  houseEventState?: HouseEventState;

  // ── At-Least gate ────────────────────────────────────────────────────────
  /** Minimum number of inputs that must be true (K in K-of-N) */
  kValue?: number;

  // ── Transfer gate ────────────────────────────────────────────────────────
  /** ID of the fault tree this transfer gate points to */
  targetFaultTreeId?: string;
}

// ---------------------------------------------------------------------------
// Default factories
// ---------------------------------------------------------------------------

export function defaultQuantification(): FaultTreeNodeQuantification {
  return {
    name: "",
    description: "",
    probabilityType: "constant",
    constantValue: 0,
  };
}

export function defaultGateQuantification(): FaultTreeNodeQuantification {
  return { name: "", description: "", probabilityType: "constant" };
}

export function defaultAtLeastQuantification(): FaultTreeNodeQuantification {
  return { name: "", description: "", probabilityType: "constant", kValue: 2 };
}

export function defaultHouseQuantification(): FaultTreeNodeQuantification {
  return { name: "", description: "", probabilityType: "constant", houseEventState: "false" };
}

export type ProbabilityType = "constant" | "distribution" | "bayesian_network_link";
export type EventType = "on_demand" | "during_operation";
export type OnDemandDistributionType = "lognormal" | "beta" | "normal" | "uniform";
export type DuringOperationDistributionType = "exponential" | "weibull" | "gamma" | "lognormal";
export type DistributionType = OnDemandDistributionType | DuringOperationDistributionType;
export interface LognormalParams {
  median: number;
  errorFactor: number;
}
export interface BetaParams {
  alpha: number;
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
  failureRate: number;
}
export interface WeibullParams {
  scale: number;
  shape: number;
  location: number;
}
export interface GammaParams {
  shape: number;
  rate: number;
}
export interface LognormalTimeParams {
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
export type HouseEventState = "true" | "false";
export interface FaultTreeNodeQuantification {
  name: string;
  description: string;
  probabilityType: ProbabilityType;
  constantValue?: number;
  eventType?: EventType;
  distributionType?: DistributionType;
  distributionParams?: DistributionParams;
  bayesianNetworkId?: number;
  bayesianNetworkNodeId?: string;
  houseEventState?: HouseEventState;
  kValue?: number;
  targetFaultTreeId?: string;
}
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

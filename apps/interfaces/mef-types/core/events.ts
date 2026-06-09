import { Named, Unique } from "./meta";

export type Frequency = number;

export enum DistributionType {
  EXPONENTIAL = "exponential",
  BINOMIAL = "binomial",
  NORMAL = "normal",
  LOGNORMAL = "lognormal",
  WEIBULL = "weibull",
  POISSON = "poisson",
  UNIFORM = "uniform",
  BETA = "beta",
  GAMMA = "gamma",
  POINT_ESTIMATE = "point_estimate",
  LOGNORMAL_TIME = "lognormal_time",
}

export interface LognormalDistribution {
  type: DistributionType.LOGNORMAL;
  median: number;
  errorFactor: number;
}

export interface BetaDistribution {
  type: DistributionType.BETA;
  alpha: number;
  betaParam: number;
}

export interface NormalDistribution {
  type: DistributionType.NORMAL;
  mean: number;
  stdDev: number;
}

export interface UniformDistribution {
  type: DistributionType.UNIFORM;
  lower: number;
  upper: number;
}

export interface ExponentialDistribution {
  type: DistributionType.EXPONENTIAL;
  failureRate: number;
}

export interface WeibullDistribution {
  type: DistributionType.WEIBULL;
  scale: number;
  shape: number;
  location: number;
}

export interface GammaDistribution {
  type: DistributionType.GAMMA;
  shape: number;
  rate: number;
}

export interface LognormalTimeDistribution {
  type: DistributionType.LOGNORMAL_TIME;
  mean: number;
  stdDev: number;
}

export interface PointEstimateDistribution {
  type: DistributionType.POINT_ESTIMATE;
  value: number;
}

export interface BinomialDistribution {
  type: DistributionType.BINOMIAL;
  probability: number;
  trials: number;
}

export interface PoissonDistribution {
  type: DistributionType.POISSON;
  rate: number;
}

export type ParameterDistribution =
  | LognormalDistribution
  | BetaDistribution
  | NormalDistribution
  | UniformDistribution
  | ExponentialDistribution
  | WeibullDistribution
  | GammaDistribution
  | LognormalTimeDistribution
  | PointEstimateDistribution
  | BinomialDistribution
  | PoissonDistribution;

export interface FrequencyWithDistribution {
  value: Frequency;
  units: FrequencyUnit;
  distribution?: {
    type: DistributionType;
    parameters: number[];
  };
  source?: string;
}

export enum FrequencyUnit {
  PER_REACTOR_YEAR = "per-reactor-year",
  PER_CALENDAR_YEAR = "per-calendar-year",
  PER_CRITICAL_YEAR = "per-critical-year",
  PER_DEMAND = "per-demand",
  PER_PLANT_YEAR = "per-plant-year",
}

export interface BaseEvent extends Unique, Named {
  description?: string;
}

export interface BasicEvent extends BaseEvent {
  eventType: "BASIC";
}

export interface FunctionalEvent extends BaseEvent {
  eventType: "FUNCTIONAL";
}

export interface TopEvent extends FunctionalEvent {
  eventSubType: "TOP";
}

export interface InitiatingEvent extends BaseEvent {
  eventType: "INITIATING";
  frequency: Frequency | FrequencyWithDistribution;
}

export enum EndState {
  SUCCESSFUL_MITIGATION = "SUCCESSFUL_MITIGATION",
  RADIONUCLIDE_RELEASE = "RADIONUCLIDE_RELEASE",
}
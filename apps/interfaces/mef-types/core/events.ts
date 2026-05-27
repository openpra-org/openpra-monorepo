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
}

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

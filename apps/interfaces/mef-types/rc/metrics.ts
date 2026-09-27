export type RcMetricQuantity =
  | "INDIVIDUAL_DOSE"
  | "INDIVIDUAL_EARLY_FATALITY_RISK"
  | "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK"
  | "POPULATION_DOSE"
  | "LAND_CONTAMINATION_AREA"
  | "ECONOMIC_COST"
  | "CUSTOM";

export type RcMetricReceptor =
  | { kind: "EAB_MAXIMUM" }
  | { kind: "DISTANCE_PROFILE" }
  | { kind: "AVERAGE_BEYOND_EAB"; distanceKm?: number }
  | { kind: "WITHIN_RADIUS"; radiusKm?: number }
  | { kind: "OTHER"; description: string };

export type RcMetricWindowStart = "RELEASE_ONSET" | "PLUME_ARRIVAL";

export interface RcMetricWindow {
  seconds: number;
  start: RcMetricWindowStart;
}

export interface RcMetricStatistics {
  mean: boolean;
  percentiles: number[];
  exceedanceThresholds: number[];
}

export interface RcConsequenceMetric {
  id: string;
  name: string;
  quantity: RcMetricQuantity;
  customUnit?: string;
  receptor: RcMetricReceptor;
  window?: RcMetricWindow;
  protectiveActionsCredited: boolean;
  statistics: RcMetricStatistics;
  criterion: string;
  basis: string;
}

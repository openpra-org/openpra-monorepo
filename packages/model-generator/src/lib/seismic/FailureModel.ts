export enum DistributionTypes {
  SL = "SL",
}

export enum SystemState {
  SUCCESS = "S",
  FAILED = "F",
}

export type FailureModel = {
  distribution_type: DistributionTypes;
  median_seismic_acceleration: number;
  beta_r_uncertainty: number;
  beta_u_uncertainty: number;
  pga: string;
  amplification: number;
};

export type HouseEventFailureModel = {
  state: SystemState;
};

type Shock = {
  pga_bins: number[];
};

type Aftershock = Shock & {
  arrival_params: {
    a: number;
    b: number;
    c: number;
    p: number;
    alpha: number;
  };
  mission: number;
  dt: number;
};

type MainShock = Shock & {
  correlation: boolean;
  damage_accumulation: boolean;
  amplification: boolean;
};

type SeismicInput = {
  consider_aftershocks?: boolean;
  aftershocks?: Aftershock;
  mainshock: MainShock;
};

export { SeismicInput };

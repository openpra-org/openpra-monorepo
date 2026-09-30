export interface RcEconomicRegion {
  index: number;
  name: string;
  farmFraction: number;
  dairySalesFraction: number;
  annualFarmSalesPerHectare: number;
  farmlandValuePerHectare: number;
  nonFarmlandValuePerPerson: number;
  original: string;
}

export interface RcEconomicCrop {
  index: number;
  name: string;
  growingStartDay: number;
  growingEndDay: number;
  farmlandFraction: number;
  original: string;
}

export interface RcSiteEconomyInput {
  filename: string;
  original: string;
  economicMultiplier: number;
  expectedRegions: number;
  regions: RcEconomicRegion[];
  crops: RcEconomicCrop[];
  sourceSiteRevision?: number;
}

export type RcEconomicCostCode = "EVACST" | "RELCST" | "POPCST" | "LTMCST" | "DLBCST" | "TIMDEC" | "DSRFCT" | "TFWKF" | "TFWKNF" | "CDFRM" | "FRFDL" | "CDNFRM" | "FRNFDL" | "DPRATE" | "DSRATE" | "WCDMCST" | "WFCDCST";

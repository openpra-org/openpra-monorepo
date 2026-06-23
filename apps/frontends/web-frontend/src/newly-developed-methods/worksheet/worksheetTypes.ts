export type FmeaSeverity = "HIGH" | "MED" | "LOW";

export type HazopGuideword =
  | "NO"
  | "MORE"
  | "LESS"
  | "REVERSE"
  | "AS WELL AS"
  | "PART OF"
  | "OTHER THAN"
  | "EARLY"
  | "LATE";

export interface FmeaRow {
  component: string;
  mode: string;
  cause: string;
  local: string;
  effect: string;
  detect: string;
  safeguard: string;
  sev: FmeaSeverity;
  ie: string;
}

export interface HazopRow {
  node: string;
  param: string;
  guide: HazopGuideword;
  dev: string;
  cause: string;
  cons: string;
  safeguard: string;
  ie: string;
}

export interface WorksheetModel {
  fmea: FmeaRow[];
  hazop: HazopRow[];
}

export type WorksheetMode = "fmea" | "hazop";

export const FMEA_SEVERITIES: FmeaSeverity[] = ["HIGH", "MED", "LOW"];
export const HAZOP_GUIDEWORDS: HazopGuideword[] = ["NO", "MORE", "LESS", "REVERSE", "AS WELL AS", "PART OF", "OTHER THAN", "EARLY", "LATE"];

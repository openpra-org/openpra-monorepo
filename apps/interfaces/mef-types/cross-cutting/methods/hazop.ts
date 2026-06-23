import { MethodBase } from "./master-logic-diagram";

export type HazopGuideword =
  | "NO"
  | "MORE"
  | "LESS"
  | "REVERSE"
  | "AS_WELL_AS"
  | "PART_OF"
  | "OTHER_THAN"
  | "EARLY"
  | "LATE";

export interface HazopDeviation {
  id: string;
  node: string;
  parameter: string;
  guideword: HazopGuideword;
  deviation: string;
  causes: string[];
  consequence: string;
  safeguards: string[];
  derivedInitiatorIds: string[];
}

export interface HazardOperabilityStudy extends MethodBase {
  methodKind: "HAZARD_OPERABILITY_STUDY";
  deviations: HazopDeviation[];
}

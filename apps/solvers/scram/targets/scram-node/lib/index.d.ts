import type { Model } from "../../../types/model";
import type { ScramNodeOptions } from "../../../types/quantify-request";
import type { QuantifyModelResult } from "../../../types/quantify-result";

export interface BuildModelSummary {
  totalBasicEvents: number;
  totalGates: number;
  totalFaultTrees: number;
  totalParameters: number;
  totalCCFGroups: number;
  basicEventNames: string[];
  gateNames: string[];
  faultTreeNames: string[];
}

export declare function QuantifyModel(options: ScramNodeOptions, model: Model): QuantifyModelResult;

export declare function BuildModelOnly(model: Model): BuildModelSummary;

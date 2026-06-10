import { ParameterDistribution } from "interfaces-mef-types/core/events";
import { BooleanNodeId, BasicEventId } from "./boolean-logic";

export type BasicEventValueModel = "PROBABILITY" | "RATE_PER_HOUR" | "RATE_PER_DEMAND";

export interface BasicEventBinding {
  basicEventId: BasicEventId;
  valueModel: BasicEventValueModel;
  pointProbability?: number;
  distribution?: ParameterDistribution;
  dataAnalysisParameterRef?: string;
}

export interface HouseEventStateBinding {
  houseEventId: BooleanNodeId;
  state: boolean;
}

export interface BasicEventBindingTable {
  id: number;
  name?: string;
  bindings: BasicEventBinding[];
  houseEventStates?: HouseEventStateBinding[];
}

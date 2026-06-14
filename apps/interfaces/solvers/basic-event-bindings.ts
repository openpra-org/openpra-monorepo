import { BooleanNodeId, BasicEventId } from "./boolean-logic";

export type ExpressionNode =
  | { kind: "constant"; value: number }
  | { kind: "parameter"; name: string }
  | { kind: "missionTime" }
  | { kind: "time" }
  | { kind: "op"; op: string; args: ExpressionNode[] };

export type RateBasis = "PER_DEMAND" | "PER_HOUR";

export type SummaryFamily = "LOGNORMAL" | "NORMAL";

export type SummaryCentral = { kind: "mean"; value: number } | { kind: "median"; value: number };

export type SummarySpread =
  | { kind: "errorFactor"; value: number }
  | { kind: "stdDev"; value: number }
  | { kind: "percentiles"; p05: number; p95: number };

export interface SummarySpec {
  central: SummaryCentral;
  spread: SummarySpread;
  family: SummaryFamily;
}

export type Exposure = { kind: "demands"; value: number } | { kind: "hours"; value: number };

export type RawDataPrior = "JEFFREYS" | "UNIFORM";

export interface RawDataSpec {
  failures: number;
  exposure: Exposure;
  prior: RawDataPrior;
}

export type BasicEventValue =
  | { kind: "probability"; value: number }
  | { kind: "rate"; rate: number; basis: RateBasis; missionTime?: number }
  | { kind: "summary"; summary: SummarySpec }
  | { kind: "rawData"; rawData: RawDataSpec }
  | { kind: "expression"; expression: ExpressionNode };

export interface BasicEventBinding {
  basicEventId: BasicEventId;
  value: BasicEventValue;
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
  parameters?: Record<string, ExpressionNode>;
}

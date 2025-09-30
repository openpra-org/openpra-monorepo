export interface Model {
  name?: string;
  description?: string;
  faultTrees?: FaultTree[];
  eventTrees?: EventTree[];
  ccfGroups?: CcfGroup[];
}

export interface FaultTree {
  name: string;
  description?: string;
  basicEvents?: BasicEvent[];
  houseEvents?: HouseEvent[];
  top: LogicExpr;
}

export interface BasicEvent {
  name: string;
  description?: string;
  p: number;
}

export interface HouseEvent {
  name: string;
  description?: string;
  state: boolean;
}

export type LogicExpr =
| { event: string }
| { op: "and"; args: LogicExpr[] }
| { op: "or";  args: LogicExpr[] }
| { op: "not"; arg:  LogicExpr }
| { op: "xor"; args: LogicExpr[] }
| { op: "nand"; args: LogicExpr[] }
| { op: "nor"; args: LogicExpr[] }
| { op: "atleast"; k: number; args: LogicExpr[] }

export interface EventTree {
  name: string;
  description?: string;
  initiatingEvent: InitiatingEvent;
  functionalEvents?: FunctionalEventDef[];
  sequences?: EventSequence[];
}

export interface InitiatingEvent {
  name: string;
  description?: string;
  frequency: number;
  unit?: "yr-1";
}

export interface FunctionalEventDef {
  name: string;
  description?: string;
}

export interface EventSequence {
  name?: string;
  functionalStates: FunctionalState[];
  endState: string;
  frequency?: number;
  unit?: "yr-1";
}

export interface FunctionalState {
  name: string;
  state: "failure" | "success" | "bypass";
}

export interface CcfGroup {
  name: string;
  description?: string;
  model: "beta-factor" | "alpha-factor" | "MGL" | "phi-factor";
  members: string[];
  distribution?: number;
  factors?: CcfFactor[];
}

export interface CcfFactor {
  level?: number;
  value?: number;
}

export type BooleanNodeId = string;
export type BasicEventId = string;

export enum BooleanOperator {
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  XOR = "XOR",
  ATLEAST = "ATLEAST",
  NULL = "NULL",
}

export const BOOLEAN_OPERATOR_GLYPHS: Record<BooleanOperator, string> = {
  AND: ".",
  OR: "+",
  NOT: "/",
  XOR: "^",
  ATLEAST: "k{}",
  NULL: "",
};

export enum BooleanNodeKind {
  GATE = "GATE",
  BASIC_EVENT = "BASIC_EVENT",
  HOUSE_EVENT = "HOUSE_EVENT",
}

export interface BooleanGateNode {
  id: BooleanNodeId;
  kind: BooleanNodeKind.GATE;
  operator: BooleanOperator;
  inputs: BooleanNodeId[];
  k?: number;
  name?: string;
}

export interface BooleanBasicEventNode {
  id: BooleanNodeId;
  kind: BooleanNodeKind.BASIC_EVENT;
  basicEventId: BasicEventId;
  name?: string;
}

export interface BooleanHouseEventNode {
  id: BooleanNodeId;
  kind: BooleanNodeKind.HOUSE_EVENT;
  name?: string;
}

export type BooleanNode = BooleanGateNode | BooleanBasicEventNode | BooleanHouseEventNode;

export interface BooleanTree {
  id: string;
  name?: string;
  topNodeId: BooleanNodeId;
  systemReference?: string;
}

export interface BooleanSequence {
  id: string;
  name?: string;
  initiatingEventId: BasicEventId;
  expressionNodeId: BooleanNodeId;
  endState?: string;
  eventSequenceReference?: string;
  plantOperatingStateReference?: string;
}

export interface BooleanModel {
  id: string;
  name?: string;
  nodes: Record<BooleanNodeId, BooleanNode>;
  faultTrees: BooleanTree[];
  sequences?: BooleanSequence[];
  houseEventIds?: BooleanNodeId[];
}

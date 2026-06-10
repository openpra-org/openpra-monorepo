export type BooleanNodeId = number;
export type BasicEventId = number;

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
}

export interface BooleanBasicEventNode {
  id: BooleanNodeId;
  kind: BooleanNodeKind.BASIC_EVENT;
  basicEventId: BasicEventId;
}

export interface BooleanHouseEventNode {
  id: BooleanNodeId;
  kind: BooleanNodeKind.HOUSE_EVENT;
}

export type BooleanNode = BooleanGateNode | BooleanBasicEventNode | BooleanHouseEventNode;

export interface BooleanTree {
  id: number;
  name?: string;
  topNodeId: BooleanNodeId;
  systemReference?: string;
}

export interface BooleanSequence {
  id: number;
  name?: string;
  initiatingEventId: BasicEventId;
  expressionNodeId: BooleanNodeId;
  endStateId?: number;
  eventSequenceReference?: string;
  plantOperatingStateReference?: string;
}

export interface EndStateNode {
  id: number;
  name?: string;
  sequenceIds: number[];
  aggregationNodeId?: BooleanNodeId;
  releaseCategoryReference?: string;
}

export interface BooleanModel {
  id: number;
  name?: string;
  nodes: Record<BooleanNodeId, BooleanNode>;
  faultTrees: BooleanTree[];
  sequences?: BooleanSequence[];
  endStates?: EndStateNode[];
  houseEventIds?: BooleanNodeId[];
}

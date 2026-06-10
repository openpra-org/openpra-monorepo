import { BooleanNodeId, BasicEventId } from "./boolean-logic";

export interface BasicEventLabel {
  basicEventId: BasicEventId;
  name: string;
  dataAnalysisParameterRef?: string;
}

export interface NodeLabel {
  nodeId: BooleanNodeId;
  name: string;
}

export interface SymbolTable {
  id: number;
  booleanModelRef: number;
  basicEventLabels?: BasicEventLabel[];
  nodeLabels?: NodeLabel[];
}

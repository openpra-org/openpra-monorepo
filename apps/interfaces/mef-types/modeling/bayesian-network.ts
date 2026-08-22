import type { CanvasLayoutMetadata, CanvasPosition, WorkbookEntityId } from "./shared";

interface BayesianNetworkEntityIdentity {
  id: WorkbookEntityId;
  code: string;
  name: string;
  description: string;
}

interface BayesianNetworkNodeState {
  id: WorkbookEntityId;
  code: string;
  name: string;
}

type BayesianNetworkNodeStates = [
  BayesianNetworkNodeState,
  BayesianNetworkNodeState,
  ...BayesianNetworkNodeState[],
];

interface BayesianNetworkChanceNode extends BayesianNetworkEntityIdentity {
  kind: "CHANCE_NODE";
  states: BayesianNetworkNodeStates;
}

type BayesianNetworkNode = BayesianNetworkChanceNode;

interface BayesianNetworkParentReference {
  nodeId: WorkbookEntityId;
  order: number;
}

interface BayesianNetworkDirectedEdge {
  id: WorkbookEntityId;
  parentNodeId: WorkbookEntityId;
  childNodeId: WorkbookEntityId;
}

interface BayesianNetworkParentStateSelection {
  parentNodeId: WorkbookEntityId;
  stateId: WorkbookEntityId;
}

interface BayesianNetworkCptValue {
  stateId: WorkbookEntityId;
  probability: number;
}

type BayesianNetworkCptValues = [
  BayesianNetworkCptValue,
  BayesianNetworkCptValue,
  ...BayesianNetworkCptValue[],
];

interface BayesianNetworkCptRow {
  id: WorkbookEntityId;
  parentStates: BayesianNetworkParentStateSelection[];
  values: BayesianNetworkCptValues;
}

interface BayesianNetworkConditionalProbabilityTable {
  nodeId: WorkbookEntityId;
  parents: BayesianNetworkParentReference[];
  rows: BayesianNetworkCptRow[];
}

interface BayesianNetworkNodePosition {
  nodeId: WorkbookEntityId;
  position: CanvasPosition;
}

interface BayesianNetworkEvidenceObservation {
  nodeId: WorkbookEntityId;
  stateId: WorkbookEntityId;
}

interface BayesianNetworkEvidenceConfiguration {
  observations: BayesianNetworkEvidenceObservation[];
}

interface BayesianNetworkDefinition {
  nodes: BayesianNetworkNode[];
  edges: BayesianNetworkDirectedEdge[];
  conditionalProbabilityTables: BayesianNetworkConditionalProbabilityTable[];
  nodePositions: BayesianNetworkNodePosition[];
  layout: CanvasLayoutMetadata;
}

export type {
  BayesianNetworkEntityIdentity,
  BayesianNetworkNodeState,
  BayesianNetworkNodeStates,
  BayesianNetworkChanceNode,
  BayesianNetworkNode,
  BayesianNetworkParentReference,
  BayesianNetworkDirectedEdge,
  BayesianNetworkParentStateSelection,
  BayesianNetworkCptValue,
  BayesianNetworkCptValues,
  BayesianNetworkCptRow,
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkNodePosition,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkDefinition,
};

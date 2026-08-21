import type { CanvasLayoutMetadata, CanvasPosition, MethodEntityId, MethodModelMetadata } from "../shared";

interface BayesianNetworkEntityIdentity {
  id: MethodEntityId;
  code: string;
  name: string;
  description: string;
}

interface BayesianNetworkNodeState {
  id: MethodEntityId;
  code: string;
  name: string;
}

type BayesianNetworkNodeStates = [BayesianNetworkNodeState, BayesianNetworkNodeState, ...BayesianNetworkNodeState[]];

interface BayesianNetworkChanceNode extends BayesianNetworkEntityIdentity {
  kind: "CHANCE_NODE";
  states: BayesianNetworkNodeStates;
}

type BayesianNetworkNode = BayesianNetworkChanceNode;

interface BayesianNetworkParentReference {
  nodeId: MethodEntityId;
  order: number;
}

interface BayesianNetworkDirectedEdge {
  id: MethodEntityId;
  parentNodeId: MethodEntityId;
  childNodeId: MethodEntityId;
}

interface BayesianNetworkParentStateSelection {
  parentNodeId: MethodEntityId;
  stateId: MethodEntityId;
}

interface BayesianNetworkCptValue {
  stateId: MethodEntityId;
  probability: number;
}

type BayesianNetworkCptValues = [BayesianNetworkCptValue, BayesianNetworkCptValue, ...BayesianNetworkCptValue[]];

interface BayesianNetworkCptRow {
  id: MethodEntityId;
  parentStates: BayesianNetworkParentStateSelection[];
  values: BayesianNetworkCptValues;
}

interface BayesianNetworkConditionalProbabilityTable {
  nodeId: MethodEntityId;
  parents: BayesianNetworkParentReference[];
  rows: BayesianNetworkCptRow[];
}

interface BayesianNetworkNodePosition {
  nodeId: MethodEntityId;
  position: CanvasPosition;
}

interface BayesianNetworkEvidenceObservation {
  nodeId: MethodEntityId;
  stateId: MethodEntityId;
}

interface BayesianNetworkEvidenceConfiguration {
  observations: BayesianNetworkEvidenceObservation[];
}

interface BayesianNetworkModel extends Omit<MethodModelMetadata, "methodType"> {
  methodType: "BAYESIAN_NETWORK";
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
  BayesianNetworkModel,
};

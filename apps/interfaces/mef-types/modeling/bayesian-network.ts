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

interface BayesianNetworkXdslNodeIdentifier {
  nodeId: WorkbookEntityId;
  sourceId: string;
}

/**
 * Presentation-only XDSL data that is not needed by the inference engine.
 * Keeping it beside the canonical model lets OpenPRA edit and quantify the
 * network without flattening GeNIe submodels or discarding vendor metadata.
 */
interface BayesianNetworkXdslMetadata {
  rootAttributes: Record<string, string>;
  extensionsXml?: string;
  nodeIdentifiers: BayesianNetworkXdslNodeIdentifier[];
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
  xdslMetadata?: BayesianNetworkXdslMetadata;
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
  BayesianNetworkXdslNodeIdentifier,
  BayesianNetworkXdslMetadata,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkDefinition,
};

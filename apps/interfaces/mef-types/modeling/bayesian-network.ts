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

/**
 * A virtual upstream node accepted by a reusable module. The contract keeps
 * the expected states beside the port so an instance can reject an
 * incompatible host node before any CPT is copied.
 */
interface BayesianNetworkModuleInputPort extends BayesianNetworkEntityIdentity {
  node: BayesianNetworkNode;
}

interface BayesianNetworkModuleOutputPort extends BayesianNetworkEntityIdentity {
  nodeId: WorkbookEntityId;
}

/** A reusable, self-contained Bayesian-network fragment. */
interface BayesianNetworkModuleTemplate extends BayesianNetworkEntityIdentity {
  nodes: BayesianNetworkNode[];
  edges: BayesianNetworkDirectedEdge[];
  conditionalProbabilityTables: BayesianNetworkConditionalProbabilityTable[];
  nodePositions: BayesianNetworkNodePosition[];
  inputPorts: BayesianNetworkModuleInputPort[];
  outputPorts: BayesianNetworkModuleOutputPort[];
}

interface BayesianNetworkModuleInputBinding {
  portId: WorkbookEntityId;
  nodeId: WorkbookEntityId;
}

interface BayesianNetworkModuleStateMapping {
  templateStateId: WorkbookEntityId;
  stateId: WorkbookEntityId;
}

interface BayesianNetworkModuleNodeMapping {
  templateNodeId: WorkbookEntityId;
  nodeId: WorkbookEntityId;
  stateMappings: BayesianNetworkModuleStateMapping[];
}

interface BayesianNetworkModuleOutputBinding {
  portId: WorkbookEntityId;
  nodeId: WorkbookEntityId;
}

/** Provenance and stable identity for one materialized module instance. */
interface BayesianNetworkModuleInstance extends BayesianNetworkEntityIdentity {
  templateId: WorkbookEntityId;
  inputBindings: BayesianNetworkModuleInputBinding[];
  nodeMappings: BayesianNetworkModuleNodeMapping[];
  outputBindings: BayesianNetworkModuleOutputBinding[];
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
  moduleTemplates?: BayesianNetworkModuleTemplate[];
  moduleInstances?: BayesianNetworkModuleInstance[];
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
  BayesianNetworkModuleInputPort,
  BayesianNetworkModuleOutputPort,
  BayesianNetworkModuleTemplate,
  BayesianNetworkModuleInputBinding,
  BayesianNetworkModuleStateMapping,
  BayesianNetworkModuleNodeMapping,
  BayesianNetworkModuleOutputBinding,
  BayesianNetworkModuleInstance,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkDefinition,
};

import type {
  CanvasLayoutMetadata,
  CanvasPosition,
  MethodEntityId,
  MethodEntityReference,
  MethodModelAudit,
  MethodModelMetadata,
  MethodModelRevision,
  MethodModelSchemaVersion,
} from "../shared";

interface FaultTreeEntityIdentity {
  id: MethodEntityId;
  code: string;
  name: string;
  description: string;
}

interface FaultTreeGateBase extends FaultTreeEntityIdentity {
  kind: "GATE";
}

interface FaultTreeAndGate extends FaultTreeGateBase {
  gateType: "AND";
}

interface FaultTreeOrGate extends FaultTreeGateBase {
  gateType: "OR";
}

interface FaultTreeNotGate extends FaultTreeGateBase {
  gateType: "NOT";
}

interface FaultTreeKOfNGate extends FaultTreeGateBase {
  gateType: "K_OF_N";
  k: number;
}

type FaultTreeGate = FaultTreeAndGate | FaultTreeOrGate | FaultTreeNotGate | FaultTreeKOfNGate;

interface FaultTreeTopGateReference {
  gateId: MethodEntityId;
}

interface FaultTreeBasicEventReference {
  id: MethodEntityId;
  kind: "BASIC_EVENT_REFERENCE";
  basicEventId: MethodEntityId;
}

interface FaultTreeHouseEvent extends FaultTreeEntityIdentity {
  kind: "HOUSE_EVENT";
  state: boolean;
}

interface FaultTreeUndevelopedEvent extends FaultTreeEntityIdentity {
  kind: "UNDEVELOPED_EVENT";
}

interface FaultTreeTransferReference extends FaultTreeEntityIdentity {
  kind: "TRANSFER_REFERENCE";
  target: MethodEntityReference;
}

type FaultTreeLeafNode =
  | FaultTreeBasicEventReference
  | FaultTreeHouseEvent
  | FaultTreeUndevelopedEvent
  | FaultTreeTransferReference;

interface FaultTreeGateInput {
  id: MethodEntityId;
  gateId: MethodEntityId;
  childId: MethodEntityId;
  order: number;
}

interface FaultTreeNodePosition {
  nodeId: MethodEntityId;
  position: CanvasPosition;
}

interface FaultTreeControlledDataSourceReference {
  workbookId: string;
  parameterId: MethodEntityId;
}

interface FaultTreeBasicEventProbability {
  value: number;
  controlledDataSource?: FaultTreeControlledDataSourceReference;
}

interface FaultTreeBasicEvent extends FaultTreeEntityIdentity {
  probability: FaultTreeBasicEventProbability;
}

interface FaultTreeBasicEventCatalogue extends MethodModelAudit {
  schemaVersion: MethodModelSchemaVersion;
  projectId: string;
  revision: MethodModelRevision;
  basicEvents: FaultTreeBasicEvent[];
}

interface FaultTreeModel extends Omit<MethodModelMetadata, "methodType"> {
  methodType: "FAULT_TREE";
  topGate: FaultTreeTopGateReference | null;
  gates: FaultTreeGate[];
  leafNodes: FaultTreeLeafNode[];
  gateInputs: FaultTreeGateInput[];
  nodePositions: FaultTreeNodePosition[];
  layout: CanvasLayoutMetadata;
}

export type {
  FaultTreeEntityIdentity,
  FaultTreeGateBase,
  FaultTreeAndGate,
  FaultTreeOrGate,
  FaultTreeNotGate,
  FaultTreeKOfNGate,
  FaultTreeGate,
  FaultTreeTopGateReference,
  FaultTreeBasicEventReference,
  FaultTreeHouseEvent,
  FaultTreeUndevelopedEvent,
  FaultTreeTransferReference,
  FaultTreeLeafNode,
  FaultTreeGateInput,
  FaultTreeNodePosition,
  FaultTreeControlledDataSourceReference,
  FaultTreeBasicEventProbability,
  FaultTreeBasicEvent,
  FaultTreeBasicEventCatalogue,
  FaultTreeModel,
};

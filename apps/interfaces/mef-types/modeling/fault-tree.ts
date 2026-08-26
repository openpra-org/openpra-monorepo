import type {
  CanvasLayoutMetadata,
  CanvasPosition,
  MethodEntityReference,
  WorkbookEntityId,
} from "./shared";
import type { HumanFailureEventReference, WorkbookParameterReference } from "./references";

interface FaultTreeEntityIdentity {
  id: WorkbookEntityId;
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
  gateId: WorkbookEntityId;
}

interface FaultTreeBasicEventReference {
  id: WorkbookEntityId;
  kind: "BASIC_EVENT_REFERENCE";
  basicEventId: WorkbookEntityId;
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
  id: WorkbookEntityId;
  gateId: WorkbookEntityId;
  childId: WorkbookEntityId;
  order: number;
}

interface FaultTreeNodePosition {
  nodeId: WorkbookEntityId;
  position: CanvasPosition;
}

type FaultTreeControlledDataSourceReference =
  | WorkbookParameterReference
  | HumanFailureEventReference;

interface FaultTreeBasicEventProbability {
  value: number;
  controlledDataSource?: FaultTreeControlledDataSourceReference;
}

interface FaultTreeBasicEvent extends FaultTreeEntityIdentity {
  probability: FaultTreeBasicEventProbability;
}

interface FaultTreeBasicEventCatalogueDefinition {
  basicEvents: FaultTreeBasicEvent[];
}

interface FaultTreeDefinition {
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
  FaultTreeBasicEventCatalogueDefinition,
  FaultTreeDefinition,
};

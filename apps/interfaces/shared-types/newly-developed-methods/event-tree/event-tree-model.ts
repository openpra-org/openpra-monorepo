import type {
  CanvasLayoutMetadata,
  CanvasPosition,
  MethodEntityId,
  MethodEntityReference,
  MethodModelMetadata,
  MethodModelReference,
} from "../shared";

interface EventTreeEntityIdentity {
  id: MethodEntityId;
  code: string;
  name: string;
  description: string;
}

interface EventTreeInitiatingEventReference {
  target: MethodEntityReference;
}

interface EventTreeControlledDataSourceReference {
  workbookId: string;
  parameterId: MethodEntityId;
}

interface EventTreeInitiatingEventFrequency {
  value: number;
  controlledDataSource?: EventTreeControlledDataSourceReference;
}

interface EventTreeFunctionalEvent extends EventTreeEntityIdentity {
  order: number;
}

interface EventTreeFunctionalEventFaultTreeLink {
  functionalEventId: MethodEntityId;
  faultTreeTopGate: MethodEntityReference;
}

type EventTreeBranchOutcome = "SUCCESS" | "FAILURE";

interface EventTreeSequencePathStep {
  functionalEventId: MethodEntityId;
  outcome: EventTreeBranchOutcome;
}

type EventTreeEndState = EventTreeEntityIdentity;

interface EventTreeEndStateBranchResult {
  kind: "END_STATE";
  endStateId: MethodEntityId;
}

interface EventTreeTransferBranchResult {
  kind: "TRANSFER";
  target: MethodEntityReference;
}

type EventTreeBranchResult = EventTreeEndStateBranchResult | EventTreeTransferBranchResult;

interface EventTreeSequence extends EventTreeEntityIdentity {
  path: EventTreeSequencePathStep[];
  result: EventTreeBranchResult;
}

interface EventTreeNodePosition {
  nodeId: MethodEntityId;
  position: CanvasPosition;
}

interface EventTreeHclConfigurationReference {
  configuration: MethodModelReference;
}

interface EventTreeCanvasLayout {
  metadata: CanvasLayoutMetadata;
  nodePositions: EventTreeNodePosition[];
}

interface EventTreeModel extends Omit<MethodModelMetadata, "methodType"> {
  methodType: "EVENT_TREE";
  initiatingEvent: EventTreeInitiatingEventReference | null;
  initiatingEventFrequency: EventTreeInitiatingEventFrequency | null;
  functionalEvents: EventTreeFunctionalEvent[];
  functionalEventFaultTreeLinks: EventTreeFunctionalEventFaultTreeLink[];
  endStates: EventTreeEndState[];
  sequences: EventTreeSequence[];
  hclConfiguration: EventTreeHclConfigurationReference | null;
  canvas: EventTreeCanvasLayout;
}

export type {
  EventTreeEntityIdentity,
  EventTreeInitiatingEventReference,
  EventTreeControlledDataSourceReference,
  EventTreeInitiatingEventFrequency,
  EventTreeFunctionalEvent,
  EventTreeFunctionalEventFaultTreeLink,
  EventTreeBranchOutcome,
  EventTreeSequencePathStep,
  EventTreeEndState,
  EventTreeEndStateBranchResult,
  EventTreeTransferBranchResult,
  EventTreeBranchResult,
  EventTreeSequence,
  EventTreeNodePosition,
  EventTreeHclConfigurationReference,
  EventTreeCanvasLayout,
  EventTreeModel,
};

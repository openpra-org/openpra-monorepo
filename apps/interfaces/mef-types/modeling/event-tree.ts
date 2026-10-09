import type {
  CanvasLayoutMetadata,
  CanvasPosition,
  MethodEntityReference,
  MethodModelReference,
  WorkbookEntityId,
} from "./shared";
import type { AnnualizationConvention } from "./quantitative-semantics";
import type { UncertainExpression } from "../core/uncertainty";

interface EventTreeEntityIdentity {
  id: WorkbookEntityId;
  code: string;
  name: string;
  description: string;
}

interface EventTreeInitiatingEventReference {
  target: MethodEntityReference;
}

interface EventTreeInitiatingEventFrequency {
  expression: UncertainExpression;
  annualization?: AnnualizationConvention;
}

interface EventTreeFunctionalEvent extends EventTreeEntityIdentity {
  order: number;
}

interface EventTreeFunctionalEventFaultTreeLink {
  functionalEventId: WorkbookEntityId;
  faultTreeTopGate: MethodEntityReference;
}

type EventTreeBranchOutcome = "SUCCESS" | "FAILURE" | "BYPASSED";

interface EventTreeSequencePathStep {
  functionalEventId: WorkbookEntityId;
  outcome: EventTreeBranchOutcome;
}

type EventTreeEndState = EventTreeEntityIdentity;

interface EventTreeEndStateBranchResult {
  kind: "END_STATE";
  endStateId: WorkbookEntityId;
}

interface EventTreeTransferBranchResult {
  kind: "TRANSFER";
  /** Continue from the destination tree entry. */
  target: MethodModelReference;
}

type EventTreeBranchResult = EventTreeEndStateBranchResult | EventTreeTransferBranchResult;

interface EventTreeSequence extends EventTreeEntityIdentity {
  path: EventTreeSequencePathStep[];
  result: EventTreeBranchResult;
}

interface EventTreeNodePosition {
  nodeId: WorkbookEntityId;
  position: CanvasPosition;
}

interface EventTreeHclConfigurationReference {
  configuration: MethodModelReference;
}

interface EventTreeCanvasLayout {
  metadata: CanvasLayoutMetadata;
  nodePositions: EventTreeNodePosition[];
}

interface EventTreeDefinition {
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
  EventTreeDefinition,
};

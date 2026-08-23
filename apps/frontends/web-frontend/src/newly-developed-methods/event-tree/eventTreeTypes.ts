import type {
  DynamicRun,
  EventSequence,
  EventTree,
  FunctionalEvent,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { FaultTreeTopEventReference } from "interfaces-mef-types/modeling";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";

type EventTreeRepresentation = "event-sequence-diagram" | "event-tree" | "table" | "dynamic";

interface EventTreeValidationFinding {
  code: string;
  message: string;
  entityId?: string;
  severity: "ERROR" | "WARNING";
}

interface EventTreeInitiatingEventOption {
  id: string;
  name: string;
  frequency?: number;
}

interface EventTreeTransferOption {
  id: string;
  name: string;
  sequenceIds: string[];
}

interface EventTreeCapabilities {
  author: boolean;
  quantification?: boolean;
  linkSelection?: boolean;
  resultOverlay?: boolean;
}

type EventTreeOperation =
  | { kind: "UPDATE_TREE"; changes: Partial<Pick<EventTree, "name" | "description" | "initiatingEventId" | "initiatingEventFrequency" | "plantOperatingStateId" | "endStateIds">> }
  | { kind: "ADD_FUNCTIONAL_EVENT"; functionalEvent: FunctionalEvent }
  | { kind: "UPDATE_FUNCTIONAL_EVENT"; functionalEventId: string; changes: Partial<Pick<FunctionalEvent, "name" | "label" | "description" | "faultTreeTopEvent">> }
  | { kind: "MOVE_FUNCTIONAL_EVENT"; functionalEventId: string; direction: -1 | 1 }
  | { kind: "DELETE_FUNCTIONAL_EVENT"; functionalEventId: string }
  | { kind: "SET_SEQUENCE_END_STATE"; sequenceId: string; endState: "SUCCESSFUL_MITIGATION" | "RADIONUCLIDE_RELEASE" }
  | { kind: "SET_SEQUENCE_TRANSFER"; sequenceId: string; targetEventTreeId: string | null; targetSequenceId?: string }
  | { kind: "SET_FAULT_TREE_REFERENCE"; functionalEventId: string; reference: FaultTreeTopEventReference | undefined }
  | { kind: "REPLACE"; model: EventTree };

interface EventTreeEditorProps {
  model: EventTree;
  eventSequences: EventSequence[];
  availableInitiatingEvents: EventTreeInitiatingEventOption[];
  availableTransfers: EventTreeTransferOption[];
  dynamicRun?: DynamicRun;
  representation: EventTreeRepresentation;
  capabilities: EventTreeCapabilities;
  selection: string | null;
  validation: EventTreeValidationFinding[];
  saveState?: "saving" | "saved" | "failed";
  analysisResult?: EventTreeAnalysisResult | null;
  resultIsStale?: boolean;
  running?: boolean;
  runError?: string | null;
  onOperation: (operation: EventTreeOperation) => void;
  onRepresentationChange: (representation: EventTreeRepresentation) => void;
  onSelectionChange: (entityId: string | null) => void;
  onSelectFaultTreeLink?: (functionalEvent: FunctionalEvent) => void;
  onOpenReference?: (reference: FaultTreeTopEventReference | { targetEventTreeId: string }) => void;
  onRun?: () => void;
}

interface EventTreeSequenceView {
  id: string;
  name: string;
  endState: string;
  releaseCategoryId?: string;
  meanFrequency?: number;
  path: Record<string, "SUCCESS" | "FAILURE">;
  transferTargetId?: string;
  conditionalProbability?: number;
  annualFrequency?: number;
}

interface EventTreeFunctionalEventView {
  id: string;
  code: string;
  label: string;
  sub: string;
}

interface EventTreeLeafReference {
  seq: string;
}

interface EventTreeNodeView {
  fe: number;
  S: EventTreeNodeView | EventTreeLeafReference;
  F: EventTreeNodeView | EventTreeLeafReference;
}

interface EventTreePresentationView {
  id: string;
  name: string;
  initiatingEventId: string;
  initiatingEventFrequency?: number;
  functionalEvents: EventTreeFunctionalEventView[];
  node: EventTreeNodeView | EventTreeLeafReference;
  sequences: EventTreeSequenceView[];
}

export type {
  EventTreeCapabilities,
  EventTreeEditorProps,
  EventTreeFunctionalEventView,
  EventTreeInitiatingEventOption,
  EventTreeLeafReference,
  EventTreeNodeView,
  EventTreeOperation,
  EventTreePresentationView,
  EventTreeRepresentation,
  EventTreeSequenceView,
  EventTreeTransferOption,
  EventTreeValidationFinding,
};

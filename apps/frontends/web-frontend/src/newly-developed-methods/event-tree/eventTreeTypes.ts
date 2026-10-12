import type {
  DynamicRun,
  EventSequence,
  EventTree,
  EventTreeOutcome,
  FunctionalEvent,
} from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventTreeInitiatingEventFrequency, FaultTreeTopEventReference } from "interfaces-mef-types/modeling";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { ParameterOption } from "../shared/uncertainEditor";
import type { TransferBreadcrumb } from "../shared/transferTrail";

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
  frequency?: EventTreeInitiatingEventFrequency;
}

interface EventTreeTransferOption {
  id: string;
  name: string;
  sequenceIds: string[];
}

interface EventTreeClassificationOption {
  id: string;
  name: string;
}

interface EventTreeCapabilities {
  author: boolean;
  quantification?: boolean;
  linkSelection?: boolean;
  resultOverlay?: boolean;
}

type EventTreeOperation =
  | { kind: "UPDATE_TREE"; changes: Partial<Pick<EventTree, "name" | "description" | "initiatingEventId" | "initiatingEventFrequency" | "plantOperatingStateId" | "endStateIds">> }
  | { kind: "ADD_FUNCTIONAL_EVENT"; functionalEvent: FunctionalEvent; index?: number }
  | { kind: "UPDATE_FUNCTIONAL_EVENT"; functionalEventId: string; changes: Partial<Pick<FunctionalEvent, "name" | "label" | "description" | "faultTreeTopEvent">> }
  | { kind: "MOVE_FUNCTIONAL_EVENT"; functionalEventId: string; direction: -1 | 1 }
  | { kind: "REORDER_FUNCTIONAL_EVENT"; functionalEventId: string; targetIndex: number }
  | { kind: "DELETE_FUNCTIONAL_EVENT"; functionalEventId: string }
  | { kind: "SET_SEQUENCE_END_STATE"; sequenceId: string; endState: "SUCCESSFUL_MITIGATION" | "RADIONUCLIDE_RELEASE"; endStateId?: string }
  | { kind: "SET_FUNCTIONAL_EVENT_BYPASS"; sequenceId: string; functionalEventId: string; bypassed: boolean }
  | { kind: "ADD_BRANCH"; sequenceId: string; functionalEventId: string; position: "TOP" | "BOTTOM" }
  | { kind: "REMOVE_BRANCH"; sequenceId: string; functionalEventId: string }
  | { kind: "SET_SEQUENCE_TRANSFER"; sequenceId: string; targetEventTreeId: string | null }
  | { kind: "SET_FAULT_TREE_REFERENCE"; functionalEventId: string; reference: FaultTreeTopEventReference | undefined }
  | { kind: "REPLACE"; model: EventTree };

interface EventTreeEndStateOption {
  id: string;
  code: string;
  name: string;
  release: boolean;
  source?: string;
}

interface EventTreeEditorProps {
  model: EventTree;
  eventSequences: EventSequence[];
  availableInitiatingEvents: EventTreeInitiatingEventOption[];
  availableOperatingStates?: EventTreeClassificationOption[];
  availableTransfers: EventTreeTransferOption[];
  editFrequency?: boolean;
  frequencyOptions?: readonly ParameterOption[];
  frequencyParameters?: ReadonlyMap<string, UncertainParameter>;
  sequenceFamilyOptions?: EventTreeClassificationOption[];
  releaseCategoryOptions?: EventTreeClassificationOption[];
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
  faultTreeName?: (reference: FaultTreeTopEventReference) => string | undefined;
  onUpdateEventSequence?: (
    eventSequenceId: string,
    changes: Partial<Pick<EventSequence, "sequenceFamilyId" | "releaseCategoryId">>,
  ) => void;
  onClassifySequence?: (
    sequenceId: string,
    changes: Partial<Pick<EventSequence, "sequenceFamilyId" | "releaseCategoryId">>,
  ) => void;
  sequenceFamilySource?: string;
  releaseCategorySource?: string;
  endStateOptions?: EventTreeEndStateOption[];
  onAddEndState?: (sequenceId: string) => void;
  onEditEndState?: (endStateId: string) => void;
  onOpenReference?: (reference: FaultTreeTopEventReference | { targetEventTreeId: string }) => void;
  breadcrumb?: TransferBreadcrumb;
  onRun?: () => void;
}

interface EventTreeSequenceView {
  id: string;
  name: string;
  endState: string;
  sequenceFamilyId?: string;
  releaseCategoryId?: string;
  meanFrequency?: number;
  path: Record<string, EventTreeOutcome>;
  endStateId?: string;
  endStateLabel?: string;
  transferTargetId?: string;
  conditionalProbability?: number;
  annualFrequency?: number;
}

interface EventTreeFunctionalEventView {
  id: string;
  code: string;
  label: string;
  linked: boolean;
}

interface EventTreeLeafReference {
  seq: string;
}

interface EventTreeBranchPoint {
  key: string;
  fe: number;
  outcomes: Array<{ state: EventTreeOutcome; sequence?: string }>;
}

interface EventTreeNodeOutcome {
  state: EventTreeOutcome;
  child: EventTreeNodeView | EventTreeLeafReference;
}

interface EventTreeNodeView {
  fe: number;
  outcomes: EventTreeNodeOutcome[];
}

interface EventTreePresentationView {
  id: string;
  name: string;
  initiatingEventId: string;
  initiatingEventFrequency?: EventTreeInitiatingEventFrequency;
  functionalEvents: EventTreeFunctionalEventView[];
  node: EventTreeNodeView | EventTreeLeafReference;
  sequences: EventTreeSequenceView[];
}

export type {
  EventTreeBranchPoint,
  EventTreeCapabilities,
  EventTreeClassificationOption,
  EventTreeEditorProps,
  EventTreeEndStateOption,
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

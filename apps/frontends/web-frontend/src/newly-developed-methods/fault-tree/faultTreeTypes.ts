import type {
  CanvasLayoutMetadata,
  FaultTreeBasicEvent,
  FaultTreeBasicEventCatalogueDefinition,
  FaultTreeDefinition,
  FaultTreeGate,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
  MethodEntityReference,
} from "interfaces-mef-types/modeling";
import type { FaultTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";

/**
 * The normalized, controlled model consumed by every fault-tree host.
 * Workbook identity and revision deliberately remain outside this boundary.
 */
interface FaultTreeEditorModel extends FaultTreeDefinition {
  modelId: string;
  code: string;
  name: string;
  description: string;
}

interface FaultTreeBasicEventPresentation {
  basicEventId: string;
  failureModeLabel?: string;
  failureModeShort?: string;
  commonCause?: boolean;
  repairCredited?: boolean;
}

interface FaultTreeEditorCatalogue extends FaultTreeBasicEventCatalogueDefinition {
  presentations?: FaultTreeBasicEventPresentation[];
}

type FaultTreeEditorMode = "AUTHOR" | "READ_ONLY" | "REFERENCE_SELECTION";

interface FaultTreeEditorCapabilities {
  mode: FaultTreeEditorMode;
  canEditBasicEvents: boolean;
  canEditLayout: boolean;
  canImport: boolean;
  canExport: boolean;
  canRunAnalysis: boolean;
}

type FaultTreeSelection =
  | { kind: "GATE"; gateId: string }
  | { kind: "LEAF"; leafId: string }
  | { kind: "BASIC_EVENT"; basicEventId: string }
  | null;

type FaultTreeSaveState = "saving" | "saved" | "failed";

interface FaultTreeTransferTarget {
  target: MethodEntityReference;
  code: string;
  name: string;
  description?: string;
}

type FaultTreeOpenReferenceRequest =
  | { kind: "GATE"; target: MethodEntityReference }
  | { kind: "BASIC_EVENT"; basicEventId: string }
  | { kind: "TRANSFER"; target: MethodEntityReference };

type OptionalId<T extends { id: string }> = T extends unknown ? Omit<T, "id"> & { id?: string } : never;
type NewFaultTreeGate = OptionalId<FaultTreeGate>;
type NewFaultTreeLeafNode = OptionalId<FaultTreeLeafNode>;
type NewFaultTreeBasicEvent = OptionalId<FaultTreeBasicEvent>;

type FaultTreeOperation =
  | {
      type: "UPDATE_MODEL";
      patch: Partial<Pick<FaultTreeEditorModel, "code" | "name" | "description">>;
    }
  | {
      type: "ADD_GATE";
      gate: NewFaultTreeGate;
      parentGateId?: string;
      order?: number;
      setAsTopGate?: boolean;
    }
  | { type: "UPDATE_GATE"; gateId: string; gate: FaultTreeGate }
  | { type: "DELETE_GATE"; gateId: string; subtree?: boolean }
  | {
      type: "ADD_LEAF";
      leaf: NewFaultTreeLeafNode;
      parentGateId?: string;
      order?: number;
    }
  | { type: "UPDATE_LEAF"; leafId: string; leaf: FaultTreeLeafNode }
  | { type: "DELETE_LEAF"; leafId: string; subtree?: boolean }
  | {
      type: "ADD_BASIC_EVENT";
      basicEvent: NewFaultTreeBasicEvent;
      parentGateId?: string;
      order?: number;
    }
  | { type: "UPDATE_BASIC_EVENT"; basicEventId: string; basicEvent: FaultTreeBasicEvent }
  | { type: "DELETE_BASIC_EVENT"; basicEventId: string }
  | { type: "CONNECT"; gateId: string; childId: string; inputId?: string; order?: number }
  | { type: "DISCONNECT"; inputId: string; subtree?: boolean }
  | { type: "REPARENT"; inputId: string; gateId: string; order?: number }
  | { type: "SET_TOP_GATE"; gateId: string | null }
  | { type: "SET_NODE_POSITION"; nodeId: string; position: FaultTreeNodePosition["position"] }
  | {
      type: "SET_LAYOUT";
      layout: CanvasLayoutMetadata;
      nodePositions?: FaultTreeNodePosition[];
    }
  | {
      type: "REPLACE_SNAPSHOT";
      model: FaultTreeEditorModel;
      catalogue: FaultTreeEditorCatalogue;
    };

interface FaultTreeOperationResult {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
  affectedId?: string;
}

interface FaultTreeEditorProps {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
  capabilities: FaultTreeEditorCapabilities;
  selection: FaultTreeSelection;
  validation: readonly ValidationIssue[];
  saveState: FaultTreeSaveState;
  analysisResult: FaultTreeAnalysisResult | null;
  resultIsStale: boolean;
  transferTargets?: readonly FaultTreeTransferTarget[];
  onOperation: (operation: FaultTreeOperation) => void;
  onSelectionChange: (selection: FaultTreeSelection) => void;
  onOpenReference: (request: FaultTreeOpenReferenceRequest) => void;
  /** The host supplies workbook identity/revision when it turns this intent into an API request. */
  onRun: () => void;
}

export type {
  FaultTreeEditorModel,
  FaultTreeBasicEventPresentation,
  FaultTreeEditorCatalogue,
  FaultTreeEditorMode,
  FaultTreeEditorCapabilities,
  FaultTreeSelection,
  FaultTreeSaveState,
  FaultTreeTransferTarget,
  FaultTreeOpenReferenceRequest,
  NewFaultTreeGate,
  NewFaultTreeLeafNode,
  NewFaultTreeBasicEvent,
  FaultTreeOperation,
  FaultTreeOperationResult,
  FaultTreeEditorProps,
};

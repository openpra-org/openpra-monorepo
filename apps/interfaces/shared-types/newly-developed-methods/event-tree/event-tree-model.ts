import type { EventTreeDefinition } from "interfaces-mef-types/modeling";
import type { WorkbookModelId } from "../shared";

interface EventTreeModel extends EventTreeDefinition {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
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
  EventTreeDefinition,
} from "interfaces-mef-types/modeling";
export type { EventTreeModel };

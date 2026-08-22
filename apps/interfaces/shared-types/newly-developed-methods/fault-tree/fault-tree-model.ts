import type {
  FaultTreeBasicEventCatalogueDefinition,
  FaultTreeDefinition,
} from "interfaces-mef-types/modeling";
import type { WorkbookAddress, WorkbookModelId } from "../shared";

interface FaultTreeBasicEventCatalogue
  extends WorkbookAddress,
    FaultTreeBasicEventCatalogueDefinition {}

interface FaultTreeModel extends FaultTreeDefinition {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
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
} from "interfaces-mef-types/modeling";
export type { FaultTreeBasicEventCatalogue, FaultTreeModel };

import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export interface FaultTreesType {
  SetFaultTrees: (parentId: string) => Promise<void>;
  AddFaultTree: (data: NestedModelJSON) => Promise<void>;
  EditFaultTree: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteFaultTree: (id: string) => Promise<void>;
}

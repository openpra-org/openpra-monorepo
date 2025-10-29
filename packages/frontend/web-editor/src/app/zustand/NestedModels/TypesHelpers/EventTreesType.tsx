import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

/**
 * Actions for Event Tree nested models.
 */
export interface EventTreesType {
  SetEventTrees: (parentId: string) => Promise<void>;
  AddEventTree: (data: NestedModelJSON) => Promise<void>;
  EditEventTree: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteEventTree: (id: string) => Promise<void>;
}

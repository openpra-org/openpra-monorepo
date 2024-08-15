import { NestedModelJSON } from "@openpra/shared-types/src/index";

export interface EventTreesType {
  SetEventTrees: (parentId: string) => Promise<void>;
  AddEventTree: (data: NestedModelJSON) => Promise<void>;
  EditEventTree: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteEventTree: (id: string) => Promise<void>;
}

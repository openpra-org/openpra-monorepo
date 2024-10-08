import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export interface InitiatingEventsType {
  SetInitiatingEvents: (parentId: string) => Promise<void>;
  AddInitiatingEvent: (data: NestedModelJSON) => Promise<void>;
  EditInitiatingEvent: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteInitiatingEvent: (id: string) => Promise<void>;
}

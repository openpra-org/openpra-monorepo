import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export type InitiatingEventsTypes = {
  SetInitiatingEvents: (parentId: string) => Promise<void>;
  AddInitiatingEvent: (data: NestedModelJSON) => Promise<void>;
  EditInitiatingEvent: (
    modelId: string,
    data: Partial<NestedModelJSON>,
  ) => Promise<void>;
  DeleteInitiatingEvent: (id: string) => Promise<void>;
};

import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface InternalEventsType {
  InternalEvents: InternalEventsModelType[];
}

export interface InternalEventsActionsType {
  SetInternalEvents: () => Promise<void>;
  AddInternalEvent: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditInternalEvent: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  DeleteInternalEvent: (id: number) => Promise<void>;
}

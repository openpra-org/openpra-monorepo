import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface InternalEventsType {
  internalEvents: InternalEventsModelType[];
}

export interface InternalEventsActionsType {
  setInternalEvents: () => Promise<void>;
  addInternalEvent: (data: Partial<TypedModelJSON>) => Promise<void>;
  editInternalEvent: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  deleteInternalEvent: (id: number) => Promise<void>;
}

import { InternalEventsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

/**
 * Public state shape for the Internal Events slice.
 */
export interface InternalEventsType {
  InternalEvents: InternalEventsModelType[];
}

/**
 * Action contract for CRUD operations on Internal Events.
 */
export interface InternalEventsActionsType {
  SetInternalEvents: () => Promise<void>;
  AddInternalEvent: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditInternalEvent: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  DeleteInternalEvent: (id: number) => Promise<void>;
}

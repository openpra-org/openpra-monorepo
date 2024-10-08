import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { InternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";

export interface InternalHazardsType {
  InternalHazards: InternalHazardsModelType[];
}

export interface InternalHazardsActionsType {
  SetInternalHazards: () => Promise<void>;
  AddInternalHazard: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditInternalHazard: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  DeleteInternalHazard: (id: number) => Promise<void>;
}

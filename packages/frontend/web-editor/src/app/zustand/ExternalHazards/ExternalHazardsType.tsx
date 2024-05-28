import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";

export interface ExternalHazardsType {
  ExternalHazards: ExternalHazardsModelType[];
}

export interface ExternalHazardsActionsType {
  SetExternalHazards: () => Promise<void>;
  AddExternalHazard: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditExternalHazard: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  DeleteExternalHazard: (id: number) => Promise<void>;
}

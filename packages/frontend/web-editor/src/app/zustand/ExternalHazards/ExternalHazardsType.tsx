import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";

export interface ExternalHazardsType {
  ExternalHazards: ExternalHazardsModelType[];
}

export interface ExternalHazardsActionsType {
  SetExternalHazards: () => Promise<void>;
  AddExternalHazard: (data: Partial<TypedModelJSON>) => Promise<any>;
  EditExternalHazard: (modelId: string, data: any) => Promise<any>;
  DeleteExternalHazard: (id: string) => Promise<void>;
}

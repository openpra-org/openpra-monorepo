import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface FullScopeType {
  FullScope: FullScopeModelType[];
}

export interface FullScopeActionsType {
  SetFullScope: () => Promise<void>;
  AddFullScope: (data: Partial<TypedModelJSON>) => Promise<any>;
  EditFullScope: (modelId: string, data: Partial<TypedModelJSON>) => Promise<any>;
  DeleteFullScope: (id: string) => Promise<void>;
}
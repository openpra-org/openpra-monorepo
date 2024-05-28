import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface FullScopeType {
  FullScope: FullScopeModelType[];
}

export interface FullScopeActionsType {
  SetFullScope: () => Promise<void>;
  AddFullScope: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditFullScope: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  DeleteFullScope: (id: number) => Promise<void>;
}

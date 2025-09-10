import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface FullScopeType {
  FullScope: FullScopeModelType[];
}

export interface FullScopeActionsType {
  SetFullScope: () => Promise<void>;
  AddFullScope: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditFullScope: (modelId: string, data: Partial<TypedModelJSON>) => Promise<TypedModelJSON>;
  DeleteFullScope: (id: number) => Promise<void>;
}

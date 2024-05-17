import { FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

export interface FullScopeType {
  fullScope: FullScopeModelType[];
  setFullScope: () => Promise<void>;
  addFullScope: (data: Partial<TypedModelJSON>) => Promise<void>;
  editFullScope: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  deleteFullScope: (id: number) => Promise<void>;
}

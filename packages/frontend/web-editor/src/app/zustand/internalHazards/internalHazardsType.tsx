import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { InternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";

export type InternalHazardsType = {
  internalHazards: InternalHazardsModelType[];
  setInternalHazards: () => Promise<void>;
  addInternalHazard: (data: Partial<TypedModelJSON>) => Promise<void>;
  editInternalHazard: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => Promise<void>;
  deleteInternalHazard: (id: number) => Promise<void>;
};

export type InternalHazardsStateType = {
  internalHazards: InternalHazardsModelType[];
}

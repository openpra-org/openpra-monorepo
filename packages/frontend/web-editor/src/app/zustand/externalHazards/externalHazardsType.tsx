import { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { ExternalHazardsModelType } from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";

export interface ExternalHazardsType {
  externalHazards: ExternalHazardsModelType[];
  setExternalHazards: () => Promise<void>;
  addExternalHazard: (data: Partial<TypedModelJSON>) => Promise<void>;
  editExternalHazard: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  deleteExternalHazard: (id: number) => Promise<void>;
}

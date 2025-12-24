import { TypedModelJSON } from 'shared-types/src/lib/types/modelTypes/largeModels/typedModel';
import { ExternalHazardsModelType } from 'shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel';

/**
 * Public state shape for the External Hazards slice.
 */
export interface ExternalHazardsType {
  ExternalHazards: ExternalHazardsModelType[];
}

/**
 * Action contract for CRUD operations on External Hazards.
 */
export interface ExternalHazardsActionsType {
  SetExternalHazards: () => Promise<void>;
  AddExternalHazard: (data: Partial<TypedModelJSON>) => Promise<void>;
  EditExternalHazard: (
    modelId: number,
    userId: number,
    data: Partial<TypedModelJSON>,
  ) => Promise<void>;
  DeleteExternalHazard: (id: number) => Promise<void>;
}

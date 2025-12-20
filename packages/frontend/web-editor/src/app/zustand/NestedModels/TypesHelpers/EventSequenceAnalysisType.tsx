import { NestedModelJSON } from 'shared-types/src/lib/types/modelTypes/innerModels/nestedModel';

/**
 * Actions for Event Sequence Analysis nested models.
 */
export interface EventSequenceAnalysisType {
  SetEventSequenceAnalysis: (parentId: string) => Promise<void>;
  AddEventSequenceAnalysis: (data: NestedModelJSON) => Promise<void>;
  EditEventSequenceAnalysis: (
    modelId: string,
    data: Partial<NestedModelJSON>,
  ) => Promise<void>;
  DeleteEventSequenceAnalysis: (id: string) => Promise<void>;
}

import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

/**
 * Actions for Event Sequence Diagrams nested models.
 */
export interface EventSequenceDiagramsType {
  SetEventSequenceDiagrams: (parentId: string) => Promise<void>;
  AddEventSequenceDiagram: (data: NestedModelJSON) => Promise<void>;
  EditEventSequenceDiagram: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteEventSequenceDiagram: (id: string) => Promise<void>;
}

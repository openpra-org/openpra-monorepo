import { NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

export interface MasterLogicDiagramsType {
  SetMasterLogicDiagrams: (parentId: string) => Promise<void>;
  AddMasterLogicDiagram: (data: NestedModelJSON) => Promise<void>;
  EditMasterLogicDiagram: (modelId: string, data: Partial<NestedModelJSON>) => Promise<void>;
  DeleteMasterLogicDiagram: (id: string) => Promise<void>;
}

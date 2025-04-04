import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";

function MasterLogicDiagramList() {
  const MasterLogicDiagrams = UseGlobalStore.use.NestedModels().InitiatingEventsAnalysis.MasterLogicDiagrams;
  const SetMasterLogicDiagrams = UseGlobalStore.use.SetMasterLogicDiagrams();
  const AddMasterLogicDiagram = UseGlobalStore.use.AddMasterLogicDiagram();
  const DeleteMasterLogicDiagram = UseGlobalStore.use.DeleteMasterLogicDiagram();
  const EditMasterLogicDiagram = UseGlobalStore.use.EditMasterLogicDiagram();

  return (
    <NestedModelListZustand
      NestedModelList={MasterLogicDiagrams}
      GetNestedModel={SetMasterLogicDiagrams}
      DeleteNestedModel={DeleteMasterLogicDiagram}
      EditNestedModel={EditMasterLogicDiagram}
      AddNestedModel={AddMasterLogicDiagram}
      name="master-logic-diagram"
    />
  );
}

export { MasterLogicDiagramList };

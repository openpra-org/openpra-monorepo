import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";
function FaultTreeList(): JSX.Element {
  const FaultTree = UseGlobalStore.use.NestedModels().SystemAnalysis.FaultTrees;
  const SetFaultTrees = UseGlobalStore.use.SetFaultTrees();
  const AddFaultTree = UseGlobalStore.use.AddFaultTree();
  const DeleteFaultTree = UseGlobalStore.use.DeleteFaultTree();
  const EditFaultTree = UseGlobalStore.use.EditFaultTree();
  return (
    <NestedModelListZustand
      NestedModelList={FaultTree}
      GetNestedModel={SetFaultTrees}
      DeleteNestedModel={DeleteFaultTree}
      EditNestedModel={EditFaultTree}
      AddNestedModel={AddFaultTree}
      name="fault-tree"
    />
  );
}
export { FaultTreeList };

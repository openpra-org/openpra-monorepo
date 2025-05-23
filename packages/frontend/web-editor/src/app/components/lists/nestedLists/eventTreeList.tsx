import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";

const EventTreeList = (): JSX.Element => {
  const EventTrees = UseGlobalStore.use.NestedModels().EventSequenceAnalysis.EventTrees;
  const SetEventTrees = UseGlobalStore.use.SetEventTrees();
  const AddEventTree = UseGlobalStore.use.AddEventTree();
  const DeleteEventTree = UseGlobalStore.use.DeleteEventTree();
  const EditEventTree = UseGlobalStore.use.EditEventTree();

  // TODO: Change this component to use the new one and delete the old component
  return (
    <NestedModelListZustand
      NestedModelList={EventTrees}
      GetNestedModel={SetEventTrees}
      DeleteNestedModel={DeleteEventTree}
      EditNestedModel={EditEventTree}
      AddNestedModel={AddEventTree}
      name="event-tree"
    />
  );
};

export { EventTreeList };

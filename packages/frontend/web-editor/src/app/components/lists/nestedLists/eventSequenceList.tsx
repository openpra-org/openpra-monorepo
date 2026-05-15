import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";
function EventSequenceList(): JSX.Element {
  const EventSequenceDiagrams = UseGlobalStore.use.NestedModels().EventSequenceAnalysis.EventSequenceDiagrams;
  const SetEventSequenceDiagrams = UseGlobalStore.use.SetEventSequenceDiagrams();
  const AddEventSequenceDiagram = UseGlobalStore.use.AddEventSequenceDiagram();
  const DeleteEventSequenceDiagram = UseGlobalStore.use.DeleteEventSequenceDiagram();
  const EditEventSequenceDiagram = UseGlobalStore.use.EditEventSequenceDiagram();
  return (
    <NestedModelListZustand
      NestedModelList={EventSequenceDiagrams}
      GetNestedModel={SetEventSequenceDiagrams}
      DeleteNestedModel={DeleteEventSequenceDiagram}
      EditNestedModel={EditEventSequenceDiagram}
      AddNestedModel={AddEventSequenceDiagram}
      name="event-sequence-diagram"
    />
  );
}
export { EventSequenceList };

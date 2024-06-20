import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";

function EventSequenceAnalysisList(): JSX.Element {
  const EventSequenceAnalysis = UseGlobalStore.use.NestedModels().EventSequenceAnalysis.EventSequenceAnalysisList;
  const SetEventSequenceAnalysis = UseGlobalStore.use.SetEventSequenceAnalysis();
  const AddEventSequenceAnalysis = UseGlobalStore.use.AddEventSequenceAnalysis();
  const DeleteEventSequenceAnalysis = UseGlobalStore.use.DeleteEventSequenceAnalysis();
  const EditEventSequenceAnalysis = UseGlobalStore.use.EditEventSequenceAnalysis();

  // TODO: Change this component to use the new one and delete the old component
  return (
    <NestedModelListZustand
      NestedModelList={EventSequenceAnalysis}
      GetNestedModel={SetEventSequenceAnalysis}
      DeleteNestedModel={DeleteEventSequenceAnalysis}
      EditNestedModel={EditEventSequenceAnalysis}
      AddNestedModel={AddEventSequenceAnalysis}
      name="event-sequence-analysis"
    />
  );
}

export { EventSequenceAnalysisList };

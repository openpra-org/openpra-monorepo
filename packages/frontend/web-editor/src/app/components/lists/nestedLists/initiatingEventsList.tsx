import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";

function InitiatingEventsList(): JSX.Element {
  const InitiatingEvents =
    UseGlobalStore.use.NestedModels().InitiatingEventsAnalysis.InitiatingEvents;
  const SetInitiatingEvents = UseGlobalStore.use.SetInitiatingEvents();
  const AddInitiatingEvent = UseGlobalStore.use.AddInitiatingEvent();
  const DeleteInitiatingEvent = UseGlobalStore.use.DeleteInitiatingEvent();
  const EditInitiatingEvent = UseGlobalStore.use.EditInitiatingEvent();

  // TODO: Change this component to use the new one and delete the old component
  return (
    <NestedModelListZustand
      NestedModelList={InitiatingEvents}
      GetNestedModel={SetInitiatingEvents}
      DeleteNestedModel={DeleteInitiatingEvent}
      EditNestedModel={EditInitiatingEvent}
      AddNestedModel={AddInitiatingEvent}
      name="initiating-event"
    />
  );
}

export { InitiatingEventsList };

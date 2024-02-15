import {
  DeleteInitiatingEvent,
  GetInitiatingEvents,
  PatchInitiatingEventLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function InitiatingEventsList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetInitiatingEvents}
      deleteNestedEndpoint={DeleteInitiatingEvent}
      patchNestedEndpoint={PatchInitiatingEventLabel}
      name="initiating-event"
    />
  );
}

export { InitiatingEventsList };

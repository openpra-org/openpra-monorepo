import {
  DeleteEventSequenceDiagram,
  GetEventSequenceDiagrams,
  PatchEventSequenceDiagramLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function EventSequenceList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetEventSequenceDiagrams}
      deleteNestedEndpoint={DeleteEventSequenceDiagram}
      patchNestedEndpoint={PatchEventSequenceDiagramLabel}
      name="event-sequence-diagram"
    />
  );
}
export { EventSequenceList };
